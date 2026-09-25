'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ts = require('../vendor/typescript.js');
const normalizePath = file => file.replace(/\\/g, '/');
const isEScriptDeclaration = uri => /\.d\.escript(?:[?#]|$)/i.test(uri);
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
            report(node, 'TypeScript interface and type declarations are not supported in Siebel eScript files. Add shared declarations to a configured .d.ts file.');
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

const virtualFile = (uri, extension) => path.posix.join(
    typesRoot, '__virtual__', crypto.createHash('sha256').update(uri).digest('hex') + extension,
);

/** One language service per active script, with sibling scripts sharing its global scope. */
class ScriptService {
    constructor(uri, text, options = {}, declarations = [], scripts = []) {
        this.uri = uri;
        // Declaration scripts use a virtual .d.ts name so TypeScript applies ambient
        // declaration semantics. No source rewriting is needed, keeping offsets stable.
        this.file = virtualFile(uri, isEScriptDeclaration(uri) ? '.d.ts' : '.ts');
        this.scripts = new Map();
        this.scriptFiles = new Map();
        this.files = new Map(builtins);
        this.uris = new Map();
        const addScript = script => {
            const file = virtualFile(script.uri, isEScriptDeclaration(script.uri) ? '.d.ts' : '.ts');
            this.scripts.set(script.uri, file);
            this.scriptFiles.set(file, { text: script.text, version: 1 });
            this.uris.set(file, script.uri);
        };
        addScript({ uri, text });
        for (const script of scripts) if (script.uri !== uri) addScript(script);
        this.text = text;
        this.version = 1;
        for (const declaration of declarations) {
            const file = virtualFile(declaration.uri, '.d.ts');
            this.files.set(file, declaration.text);
            this.uris.set(file, declaration.uri);
        }
        this.options = {
            siebelEScript: true, noLib: true, types: [], noEmit: true,
            strict: options.strict !== false, useUnknownInCatchVariables: false,
            target: ts.ScriptTarget.ES5, module: ts.ModuleKind.None,
            moduleDetection: ts.ModuleDetectionKind.Legacy,
            ignoreDeprecations: '6.0', skipLibCheck: false,
        };
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
        const sourceFile = this.languageService.getProgram()?.getSourceFile(this.file);
        const hasThisDirective = /^\s*\/\/\s*(?:@this\s*[:=]|this\s*:)[ \t]*[A-Za-z_$][\w$]*\s*$/m.test(this.text);
        this.options.siebelThisComments = false;
        try {
            return [...this.languageService.getSyntacticDiagnostics(this.file),
                ...this.languageService.getSemanticDiagnostics(this.file).filter(diagnostic =>
                    !isAllowedNullAssignment(diagnostic) && !(hasThisDirective && diagnostic.code === 2683)),
                ...(sourceFile && !isEScriptDeclaration(this.uri) ? compatibilityDiagnostics(sourceFile) : [])];
        } finally {
            this.options.siebelThisComments = true;
        }
    }
    completions(position, options = {}) {
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
    completionDetails(position, entry) {
        return this.languageService.getCompletionEntryDetails(this.file, position, entry.name, {}, entry.source, {}, entry.data);
    }
    quickInfo(position) { return this.languageService.getQuickInfoAtPosition(this.file, position); }
    definitions(position) { return this.languageService.getDefinitionAtPosition(this.file, position) || []; }
    references(position) { return this.languageService.getReferencesAtPosition(this.file, position) || []; }
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
