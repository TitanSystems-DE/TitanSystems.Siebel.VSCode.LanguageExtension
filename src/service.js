'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ts = require('../vendor/typescript.js');
const normalizePath = file => file.replace(/\\/g, '/');
const typesRoot = normalizePath(path.resolve(__dirname, '../types'));
const builtins = new Map(['runtime.d.ts', 'siebel.d.ts'].map(name => {
    const file = path.posix.join(typesRoot, name);
    return [file, fs.readFileSync(file, 'utf8')];
}));

const virtualFile = (uri, extension) => path.posix.join(
    typesRoot, '__virtual__', crypto.createHash('sha256').update(uri).digest('hex') + extension,
);

/** One language service per active script, with sibling scripts sharing its global scope. */
class ScriptService {
    constructor(uri, text, options = {}, declarations = [], scripts = []) {
        this.uri = uri;
        // Virtual .ts name: no source rewriting, so every original offset remains valid.
        this.file = virtualFile(uri, '.ts');
        this.scripts = new Map();
        this.scriptFiles = new Map();
        this.files = new Map(builtins);
        this.uris = new Map();
        const addScript = script => {
            const file = virtualFile(script.uri, '.ts');
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
        return [...this.languageService.getSyntacticDiagnostics(this.file), ...this.languageService.getSemanticDiagnostics(this.file)];
    }
    completions(position, options = {}) {
        return this.languageService.getCompletionsAtPosition(this.file, position, {
            includeCompletionsForModuleExports: false,
            includeCompletionsWithInsertText: true,
            ...options,
        });
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
