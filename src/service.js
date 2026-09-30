'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ts = require('../vendor/typescript.js');
const normalizePath = file => file.replace(/\\/g, '/');
const isEScriptDeclaration = uri => /\.d\.escript(?:[?#]|$)/i.test(uri);
function scriptIdentity(uri) {
    try {
        const parsed = new URL(uri);
        parsed.hash = '';
        parsed.search = '';
        let pathname = decodeURIComponent(parsed.pathname).replace(/\\/g, '/');
        // Windows drive-letter paths are case-insensitive even when represented
        // as file URIs with different casing or percent encoding.
        if (parsed.protocol === 'file:' && /^\/[a-z]:\//i.test(pathname)) pathname = pathname.toLowerCase();
        return `${parsed.protocol.toLowerCase()}//${parsed.host.toLowerCase()}${pathname}`;
    } catch {
        return uri;
    }
}
const typesRoot = normalizePath(path.resolve(__dirname, '../types'));
const builtins = new Map(['runtime.d.ts', 'siebel.d.ts'].map(name => {
    const file = path.posix.join(typesRoot, name);
    return [file, fs.readFileSync(file, 'utf8')];
}));
const hiddenCompletionNames = new Set([
    // TypeScript-only type keywords.
    'any', 'asserts', 'bigint', 'boolean', 'infer', 'keyof', 'never', 'number', 'object',
    'readonly', 'string', 'symbol', 'unique', 'unknown',
    // Compiler support declarations that are not Siebel eScript API surface.
    'ArrayConstructor', 'BooleanConstructor', 'CallableFunction', 'FunctionConstructor',
    'globalThis', 'IArguments', 'NewableFunction', 'NumberConstructor', 'ObjectConstructor',
    'ReadonlyArray', 'RegExpConstructor', 'RegExpExecArray', 'RegExpMatchArray', 'StringConstructor',
    'SblBoolIn', 'SblBoolOut', 'SblNumIn', 'SblNumOut', 'SblStrIn', 'SblStrOut',
]);
const incompatibleTypeKeywords = new Map([
    [ts.SyntaxKind.StringKeyword, ['string', "Use the Siebel eScript primitive type 'chars' instead of the TypeScript type 'string'."]],
    [ts.SyntaxKind.NumberKeyword, ['number', "Use the Siebel eScript primitive type 'float' instead of the TypeScript type 'number'."]],
    [ts.SyntaxKind.BooleanKeyword, ['boolean', "Use the Siebel eScript primitive type 'bool' instead of the TypeScript type 'boolean'."]],
    [ts.SyntaxKind.ObjectKeyword, ['object', "Use the Siebel eScript object type 'Object' instead of the TypeScript type 'object'."]],
    [ts.SyntaxKind.AnyKeyword, ['any', "Siebel eScript has no 'any' type. Omit the type annotation for a typeless variable."]],
    [ts.SyntaxKind.UnknownKeyword, ['unknown', "The TypeScript type 'unknown' is not supported by Siebel eScript."]],
    [ts.SyntaxKind.NeverKeyword, ['never', "The TypeScript type 'never' is not supported by Siebel eScript."]],
    [ts.SyntaxKind.BigIntKeyword, ['bigint', "The TypeScript type 'bigint' is not supported by Siebel eScript."]],
    [ts.SyntaxKind.SymbolKeyword, ['symbol', "The TypeScript type 'symbol' is not supported by Siebel eScript."]],
    [ts.SyntaxKind.VoidKeyword, ['void', "Siebel eScript has no 'void' data type. Omit the return type when a function returns no value."]],
]);
const incompatibleTypeSyntax = new Set([
    ts.SyntaxKind.ArrayType, ts.SyntaxKind.ConditionalType, ts.SyntaxKind.ConstructorType,
    ts.SyntaxKind.FunctionType, ts.SyntaxKind.ImportType, ts.SyntaxKind.IndexedAccessType,
    ts.SyntaxKind.InferType, ts.SyntaxKind.IntersectionType, ts.SyntaxKind.LiteralType,
    ts.SyntaxKind.MappedType, ts.SyntaxKind.NamedTupleMember, ts.SyntaxKind.OptionalType,
    ts.SyntaxKind.RestType, ts.SyntaxKind.TemplateLiteralType, ts.SyntaxKind.TupleType,
    ts.SyntaxKind.TypeLiteral, ts.SyntaxKind.TypeOperator, ts.SyntaxKind.TypePredicate,
    ts.SyntaxKind.TypeQuery, ts.SyntaxKind.UnionType,
]);

function compatibilityDiagnostics(sourceFile) {
    const result = [];
    const report = (node, messageText) => result.push({
        file: sourceFile, start: node.getStart(sourceFile), length: node.getWidth(sourceFile),
        category: ts.DiagnosticCategory.Error, code: 95001, messageText,
    });
    function visit(node) {
        const keyword = incompatibleTypeKeywords.get(node.kind);
        if (keyword) {
            report(node, keyword[1]);
            return;
        }
        if (incompatibleTypeSyntax.has(node.kind)) {
            report(node, 'This TypeScript type syntax is not supported by Siebel eScript.');
            return;
        }
        if (ts.isTypeReferenceNode(node) && node.typeArguments?.length) {
            report(node, 'Generic type arguments are not supported by Siebel eScript.');
            return;
        }
        if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) {
            report(node, 'TypeScript interface and type declarations are not supported in executable Siebel eScript files. Add shared declarations to a .d.escript file.');
            return;
        }
        if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node) || ts.isSatisfiesExpression?.(node)) {
            report(node, 'TypeScript type assertions are not supported by Siebel eScript.');
            return;
        }
        ts.forEachChild(node, visit);
    }
    visit(sourceFile);
    return result;
}

function isAllowedNullAssignment(diagnostic) {
    if (![2322, 2345, 2412].includes(diagnostic.code)) return false;
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
    return /type 'null' is not assignable to (?:parameter of )?type/i.test(message);
}

function isAllowedDynamicObjectProperty(diagnostic, sourceFile, checker) {
    if (diagnostic.code !== 2339 || diagnostic.start === undefined || !sourceFile || !checker) return false;
    let node = ts.getTokenAtPosition(sourceFile, diagnostic.start);
    while (node && !ts.isPropertyAccessExpression(node)) node = node.parent;
    if (!node) return false;
    const receiver = checker.getTypeAtLocation(node.expression);
    const receiverName = checker.typeToString(receiver);
    return receiverName === 'Object' || receiverName === '{}';
}

function escriptDiagnostic(diagnostic) {
    return diagnostic.code === 7006
        ? { ...diagnostic, category: ts.DiagnosticCategory.Warning }
        : diagnostic;
}

const virtualFile = (uri, extension) => path.posix.join(
    typesRoot, '__virtual__', crypto.createHash('sha256').update(uri).digest('hex') + extension,
);

/** One language service per active script, with sibling scripts sharing its global scope. */
class ScriptService {
    constructor(uri, text, options = {}, scripts = []) {
        this.uri = uri;
        // Declaration scripts use a virtual .d.ts name so TypeScript applies ambient
        // declaration semantics. No source rewriting is needed, keeping offsets stable.
        this.file = virtualFile(uri, isEScriptDeclaration(uri) ? '.d.ts' : '.ts');
        this.scripts = new Map();
        this.scriptIdentities = new Map();
        this.scriptFiles = new Map();
        this.files = new Map(builtins);
        this.uris = new Map();
        const addScript = script => {
            const identity = scriptIdentity(script.uri);
            const existing = this.scriptIdentities.get(identity);
            if (existing) {
                this.scripts.set(script.uri, existing);
                return;
            }
            const file = virtualFile(script.uri, isEScriptDeclaration(script.uri) ? '.d.ts' : '.ts');
            this.scriptIdentities.set(identity, file);
            this.scripts.set(script.uri, file);
            this.scriptFiles.set(file, { text: script.text, version: 1 });
            this.uris.set(file, script.uri);
        };
        addScript({ uri, text });
        for (const script of scripts) if (script.uri !== uri) addScript(script);
        this.text = text;
        this.version = 1;
        this.options = {
            siebelEScript: true, noLib: true, types: [], noEmit: true,
            strict: options.strict !== false, useUnknownInCatchVariables: false,
            target: ts.ScriptTarget.ES5, module: ts.ModuleKind.None,
            moduleDetection: ts.ModuleDetectionKind.Legacy,
            ignoreDeprecations: '6.0', skipLibCheck: false,
        };
        this.metadata = options.metadata;
        const read = file => {
            file = normalizePath(file);
            return this.scriptFiles.get(file)?.text ?? this.files.get(file);
        };
        this.host = {
            getCompilationSettings: () => this.options,
            getScriptFileNames: () => [...this.scriptFiles.keys(), ...this.files.keys()],
            getScriptVersion: file => String(this.scriptFiles.get(normalizePath(file))?.version ?? 1),
            getScriptSnapshot: file => { const content = read(file); return content === undefined ? undefined : ts.ScriptSnapshot.fromString(content); },
            getScriptKind: () => ts.ScriptKind.TS,
            getCurrentDirectory: () => typesRoot,
            getDefaultLibFileName: () => path.posix.join(typesRoot, 'runtime.d.ts'),
            fileExists: file => read(file) !== undefined,
            readFile: read,
            readDirectory: () => [],
            directoryExists: dir => normalizePath(dir) === typesRoot || normalizePath(dir) === path.posix.dirname(this.file),
            useCaseSensitiveFileNames: () => true,
            getNewLine: () => '\n',
        };
        this.languageService = ts.createLanguageService(this.host);
    }
    update(text) { this.updateFile(this.uri, text); }
    updateFile(uri, text) {
        const file = this.scripts.get(uri);
        const script = file && this.scriptFiles.get(file);
        if (!script || script.text === text) return false;
        script.text = text;
        script.version++;
        if (uri === this.uri) { this.text = text; this.version = script.version; }
        return true;
    }
    dispose() { this.languageService.dispose(); }
    diagnostics() {
        const program = this.languageService.getProgram();
        const sourceFile = program?.getSourceFile(this.file);
        const checker = program?.getTypeChecker();
        const hasThisDirective = /^\s*\/\/\s*(?:@this\s*[:=]|this\s*:)[ \t]*[A-Za-z_$][\w$]*[ \t]*;?[ \t]*$/m.test(this.text);
        this.options.siebelThisComments = false;
        try {
            return [...this.languageService.getSyntacticDiagnostics(this.file),
                ...this.languageService.getSemanticDiagnostics(this.file).filter(diagnostic =>
                    !isAllowedNullAssignment(diagnostic)
                    && !isAllowedDynamicObjectProperty(diagnostic, sourceFile, checker)
                    && !(hasThisDirective && diagnostic.code === 2683)),
                ...(sourceFile && !isEScriptDeclaration(this.uri) ? compatibilityDiagnostics(sourceFile) : [])]
                .map(escriptDiagnostic);
        } finally {
            this.options.siebelThisComments = true;
        }
    }
    completions(position, options = {}) {
        const repository = this.repositoryCompletions(position);
        if (repository) return repository;
        const result = this.languageService.getCompletionsAtPosition(this.file, position, {
            includeCompletionsForModuleExports: false,
            includeCompletionsWithInsertText: true,
            ...options,
        });
        if (result) {
            const typePosition = /:\s*$/.test(this.text.slice(0, position));
            result.entries = result.entries.filter(entry => !hiddenCompletionNames.has(entry.name) && !(typePosition && entry.name === 'void'));
        }
        return result;
    }
    repositoryCompletions(position) {
        const metadata = this.metadata;
        if (!metadata || !metadata.capabilities) return undefined;
        const source = this.languageService.getProgram()?.getSourceFile(this.file);
        if (!source) return undefined;
        let target;
        const visit = node => {
            if (position < node.getFullStart() || position > node.end + 1) return;
            if (ts.isCallExpression(node) && node.arguments.length && position >= node.arguments[0].getStart(source) && position <= node.arguments[0].end + 1) target = node;
            ts.forEachChild(node, visit);
        };
        visit(source);
        if (!target || !ts.isPropertyAccessExpression(target.expression)) return undefined;
        const method = target.expression.name.text;
        let names;
        if (method === 'GetBusObject' && metadata.capabilities.businessObjects) {
            names = metadata.businessObjects;
        } else if (method === 'GetBusComp' && metadata.capabilities.businessComponents) {
            const identity = this.repositoryIdentity(target.expression.expression, source, new Set());
            names = identity?.kind === 'BusObject' ? metadata.businessComponents.get(identity.name) : undefined;
            if (!names) names = [...new Set([...metadata.businessComponents.values()].flat().concat([...metadata.fields.keys()]))];
        } else if (new Set(['ActivateField', 'GetFieldValue', 'GetFormattedFieldValue', 'SetFieldValue', 'SetFormattedFieldValue', 'SetSearchSpec']).has(method) && metadata.capabilities.fields) {
            const identity = this.repositoryIdentity(target.expression.expression, source, new Set());
            if (identity?.kind === 'BusComp') names = metadata.fields.get(identity.name);
        }
        if (!names) return undefined;
        const argument = target.arguments[0];
        const start = ts.isStringLiteralLike(argument) ? argument.getStart(source) + 1 : argument.getStart(source);
        const length = Math.max(0, Math.min(position, argument.end) - start);
        return {
            isGlobalCompletion: false, isMemberCompletion: false, isNewIdentifierLocation: false,
            entries: [...new Set(names)].sort((a, b) => a.localeCompare(b)).map(name => ({
                name, kind: 'string', kindModifiers: '', sortText: '0', insertText: name,
                replacementSpan: { start, length },
            })),
        };
    }
    repositoryIdentity(expression, source, seen) {
        if (!expression || seen.has(expression)) return undefined;
        seen.add(expression);
        if (ts.isParenthesizedExpression(expression)) return this.repositoryIdentity(expression.expression, source, seen);
        if (ts.isCallExpression(expression) && ts.isPropertyAccessExpression(expression.expression)) {
            const method = expression.expression.name.text;
            const first = expression.arguments[0];
            if (method === 'GetBusObject' && first && ts.isStringLiteralLike(first)) return { kind: 'BusObject', name: first.text };
            if (method === 'GetBusComp' && first && ts.isStringLiteralLike(first)) return { kind: 'BusComp', name: first.text };
        }
        if (ts.isIdentifier(expression)) {
            const checker = this.languageService.getProgram()?.getTypeChecker();
            const symbol = checker?.getSymbolAtLocation(expression);
            for (const declaration of symbol?.declarations || []) {
                if (ts.isVariableDeclaration(declaration) && declaration.initializer) {
                    const result = this.repositoryIdentity(declaration.initializer, source, seen);
                    if (result) return result;
                }
            }
            // Preserve identity through a simple assignment that precedes the use.
            let latest;
            const find = node => {
                if (node.getStart(source) >= expression.getStart(source)) return;
                if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
                    ts.isIdentifier(node.left) && node.left.text === expression.text) latest = node.right;
                ts.forEachChild(node, find);
            };
            find(source);
            if (latest) return this.repositoryIdentity(latest, source, seen);
        }
        return undefined;
    }
    completionDetails(position, entry) {
        return this.languageService.getCompletionEntryDetails(this.file, position, entry.name, {}, entry.source, {}, entry.data);
    }
    quickInfo(position) { return this.languageService.getQuickInfoAtPosition(this.file, position); }
    definitions(position) { return this.languageService.getDefinitionAtPosition(this.file, position) || []; }
    references(position) { return this.languageService.getReferencesAtPosition(this.file, position) || []; }
    referenceParameterSpans() {
        const program = this.languageService.getProgram();
        const source = program?.getSourceFile(this.file);
        const checker = program?.getTypeChecker();
        if (!source || !checker) return [];
        const parameters = new Set();
        const spans = [];
        const collectParameters = node => {
            if (ts.isParameter(node) && ts.isIdentifier(node.name)) {
                const prefix = this.text.slice(node.getStart(source), node.name.getStart(source));
                if (prefix.includes('&')) {
                    const symbol = checker.getSymbolAtLocation(node.name);
                    if (symbol) parameters.add(symbol);
                }
            }
            ts.forEachChild(node, collectParameters);
        };
        const collectReferences = node => {
            if (ts.isIdentifier(node) && parameters.has(checker.getSymbolAtLocation(node))) {
                spans.push({ start: node.getStart(source), length: node.getWidth(source) });
            }
            ts.forEachChild(node, collectReferences);
        };
        collectParameters(source);
        if (parameters.size) collectReferences(source);
        return spans;
    }
    isReferenceParameterAt(position) {
        return this.referenceParameterSpans().some(span => position >= span.start && position < span.start + span.length);
    }
    isWorkspaceExtensionAt(position) {
        const program = this.languageService.getProgram();
        const source = program?.getSourceFile(this.file);
        const checker = program?.getTypeChecker();
        if (!source || !checker) return false;
        const token = ts.getTokenAtPosition(source, position);
        const symbol = token && checker.getSymbolAtLocation(token);
        if (!symbol) return false;
        const supportedDeclarations = new Set([
            ts.SyntaxKind.MethodDeclaration, ts.SyntaxKind.MethodSignature,
            ts.SyntaxKind.PropertyDeclaration, ts.SyntaxKind.PropertySignature,
            ts.SyntaxKind.GetAccessor, ts.SyntaxKind.SetAccessor,
        ]);
        return (symbol.declarations || []).some(declaration => {
            if (!supportedDeclarations.has(declaration.kind)) return false;
            const uri = this.targetUri(declaration.getSourceFile().fileName);
            return uri !== undefined && isEScriptDeclaration(uri);
        });
    }
    signatureHelp(position) { return this.languageService.getSignatureHelpItems(this.file, position, undefined); }
    format(options) {
        return this.languageService.getFormattingEditsForDocument(this.file, {
            indentSize: options.tabSize, tabSize: options.tabSize, convertTabsToSpaces: options.insertSpaces,
            newLineCharacter: this.text.includes('\r\n') ? '\r\n' : '\n',
            insertSpaceAfterCommaDelimiter: true, insertSpaceBeforeAndAfterBinaryOperators: true,
            insertSpaceAfterKeywordsInControlFlowStatements: true,
        });
    }
    source(file) { file = normalizePath(file); return this.scriptFiles.get(file)?.text ?? this.files.get(file); }
    targetUri(file) { return this.uris.get(normalizePath(file)); }
}
module.exports = { ScriptService, ts };
