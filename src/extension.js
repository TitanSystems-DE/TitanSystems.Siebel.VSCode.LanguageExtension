'use strict';
const vscode = require('vscode');
const { ScriptService, ts } = require('./service');

function documentation(parts, tags = []) {
    const result = new vscode.MarkdownString(ts.displayPartsToString(parts || []));
    result.isTrusted = false;
    for (const tag of tags) {
        const text = typeof tag.text === 'string' ? tag.text : ts.displayPartsToString(tag.text || []);
        result.appendMarkdown(`\n\n*@${tag.name}* ${text}`);
    }
    return result;
}
function range(document, span) {
    return new vscode.Range(document.positionAt(span.start), document.positionAt(span.start + span.length));
}
function targetRange(text, span) {
    function at(offset) {
        const lines = text.slice(0, Math.max(0, offset)).split('\n');
        return new vscode.Position(lines.length - 1, lines[lines.length - 1].length);
    }
    return new vscode.Range(at(span.start), at(span.start + span.length));
}
function completionKind(kind) {
    const K = vscode.CompletionItemKind;
    return ({ method: K.Method, function: K.Function, property: K.Property, getter: K.Property, setter: K.Property,
        var: K.Variable, 'local var': K.Variable, const: K.Constant, interface: K.Interface, type: K.TypeParameter,
        class: K.Class, enum: K.Enum, 'enum member': K.EnumMember, keyword: K.Keyword, module: K.Module,
        constructor: K.Constructor, parameter: K.Variable, alias: K.Reference })[kind] ?? K.Text;
}
function symbolKind(kind) {
    const K = vscode.SymbolKind;
    return ({ function: K.Function, method: K.Method, class: K.Class, interface: K.Interface, type: K.Interface,
        const: K.Constant, module: K.Module, property: K.Property, enum: K.Enum })[kind] ?? K.Variable;
}

function activate(context) {
    const selector = { language: 'escript' };
    const output = vscode.window.createOutputChannel('Siebel eScript');
    const diagnostics = vscode.languages.createDiagnosticCollection('escript');
    const models = new Map();
    const declarations = new Map();
    const timers = new Map();
    let generation = 0;
    let disposed = false;
    const configuration = document => vscode.workspace.getConfiguration('escript', document.uri);
    const eligible = document => document.languageId === 'escript' && !document.isClosed;
    const error = err => output.appendLine(`[Error] ${err && err.stack || err}`);
    async function safe(run, fallback) { try { return await run(); } catch (err) { error(err); return fallback; } }

    async function customTypes(document) {
        const folder = vscode.workspace.getWorkspaceFolder(document.uri);
        const files = configuration(document).get('typeDefinitionFiles', []);
        if (!folder || !files.length) return [];
        const key = folder.uri.toString() + JSON.stringify(files);
        if (!declarations.has(key)) {
            declarations.set(key, Promise.all(files.map(async relative => {
                if (typeof relative !== 'string' || !relative.endsWith('.d.ts') || relative.startsWith('/') || relative.includes(':') || relative.split(/[\\/]/).includes('..')) {
                    throw new Error('escript.typeDefinitionFiles must contain workspace-relative .d.ts paths: ' + relative);
                }
                const uri = vscode.Uri.joinPath(folder.uri, ...relative.split(/[\\/]/));
                const open = vscode.workspace.textDocuments.find(d => d.uri.toString() === uri.toString());
                const text = open ? open.getText() : Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8');
                return { uri: uri.toString(), text };
            })));
        }
        return declarations.get(key);
    }
    async function model(document) {
        const key = document.uri.toString();
        let result = models.get(key);
        if (!result) {
            const requestedGeneration = generation;
            // Missing optional files must not disable the built-in language features.
            const extra = await safe(() => customTypes(document), []);
            if (disposed || !eligible(document)) return undefined;
            if (requestedGeneration !== generation) return model(document);
            result = models.get(key);
            if (!result) {
                result = new ScriptService(key, document.getText(), { strict: configuration(document).get('strict', true) }, extra);
                models.set(key, result);
            }
        }
        result.update(document.getText());
        return result;
    }
    async function validate(document) {
        if (disposed || !eligible(document)) return;
        const version = document.version;
        const currentGeneration = generation;
        const result = await model(document);
        if (!result || document.isClosed || version !== document.version || currentGeneration !== generation) return;
        const max = Math.max(1, Math.min(1000, configuration(document).get('maxProblems', 100)));
        const items = result.diagnostics().slice(0, max).map(d => {
            const item = new vscode.Diagnostic(range(document, { start: d.start || 0, length: d.length || 0 }),
                ts.flattenDiagnosticMessageText(d.messageText, '\n'),
                d.category === ts.DiagnosticCategory.Warning ? vscode.DiagnosticSeverity.Warning : vscode.DiagnosticSeverity.Error);
            item.source = 'Siebel eScript';
            item.code = d.code;
            return item;
        });
        diagnostics.set(document.uri, items);
    }
    function schedule(document) {
        if (!eligible(document) || disposed) return;
        const key = document.uri.toString();
        clearTimeout(timers.get(key));
        timers.set(key, setTimeout(() => { timers.delete(key); safe(() => validate(document)); }, 180));
    }
    function reset() {
        generation++;
        for (const service of models.values()) service.dispose();
        models.clear(); declarations.clear();
        for (const document of vscode.workspace.textDocuments) schedule(document);
    }
    function location(service, entry) {
        const text = service.source(entry.fileName);
        if (text === undefined) return undefined;
        const mapped = service.targetUri(entry.fileName);
        return new vscode.Location(mapped ? vscode.Uri.parse(mapped) : vscode.Uri.file(entry.fileName), targetRange(text, entry.textSpan));
    }

    context.subscriptions.push(output, diagnostics);
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider(selector, {
        async provideCompletionItems(document, position, token) {
            return safe(async () => {
                if (token.isCancellationRequested) return [];
                const service = await model(document);
                if (!service) return [];
                const offset = document.offsetAt(position);
                const data = service.completions(offset);
                if (!data) return [];
                return data.entries.map(entry => {
                    const item = new vscode.CompletionItem(entry.name, completionKind(entry.kind));
                    item.sortText = entry.sortText;
                    item.filterText = entry.filterText || entry.name;
                    item.insertText = entry.isSnippet ? new vscode.SnippetString(entry.insertText || entry.name) : entry.insertText || entry.name;
                    const span = entry.replacementSpan || data.optionalReplacementSpan;
                    if (span) item.range = range(document, span);
                    item._escript = { uri: document.uri.toString(), offset, entry, version: document.version, generation };
                    return item;
                });
            }, []);
        },
        async resolveCompletionItem(item, token) {
            return safe(async () => {
                const request = item._escript;
                if (!request || token.isCancellationRequested || request.generation !== generation) return item;
                const document = vscode.workspace.textDocuments.find(d => d.uri.toString() === request.uri);
                if (!document || document.version !== request.version) return item;
                const service = await model(document);
                const detail = service && service.completionDetails(request.offset, request.entry);
                if (detail) {
                    item.detail = ts.displayPartsToString(detail.displayParts);
                    item.documentation = documentation(detail.documentation, detail.tags);
                }
                return item;
            }, item);
        },
    }, '.', '"', "'"));
    context.subscriptions.push(vscode.languages.registerHoverProvider(selector, {
        provideHover: (document, position, token) => safe(async () => {
            if (token.isCancellationRequested) return undefined;
            const service = await model(document);
            const info = service && service.quickInfo(document.offsetAt(position));
            if (!info) return undefined;
            const signature = new vscode.MarkdownString().appendCodeblock(ts.displayPartsToString(info.displayParts), 'typescript');
            return new vscode.Hover([signature, documentation(info.documentation, info.tags)], range(document, info.textSpan));
        }),
    }));
    context.subscriptions.push(vscode.languages.registerDefinitionProvider(selector, {
        provideDefinition: (document, position, token) => safe(async () => {
            if (token.isCancellationRequested) return [];
            const service = await model(document);
            return service ? service.definitions(document.offsetAt(position)).map(d => location(service, d)).filter(Boolean) : [];
        }, []),
    }));
    context.subscriptions.push(vscode.languages.registerReferenceProvider(selector, {
        provideReferences: (document, position, options, token) => safe(async () => {
            if (token.isCancellationRequested) return [];
            const service = await model(document);
            return service ? service.references(document.offsetAt(position)).filter(d => options.includeDeclaration || !d.isDefinition).map(d => location(service, d)).filter(Boolean) : [];
        }, []),
    }));
    context.subscriptions.push(vscode.languages.registerSignatureHelpProvider(selector, {
        provideSignatureHelp: (document, position, token) => safe(async () => {
            if (token.isCancellationRequested) return undefined;
            const service = await model(document);
            const data = service && service.signatureHelp(document.offsetAt(position));
            if (!data) return undefined;
            const help = new vscode.SignatureHelp();
            help.activeSignature = data.selectedItemIndex;
            help.activeParameter = data.argumentIndex;
            help.signatures = data.items.map(item => {
                const prefix = ts.displayPartsToString(item.prefixDisplayParts);
                const separator = ts.displayPartsToString(item.separatorDisplayParts);
                const parameters = item.parameters.map(p => ts.displayPartsToString(p.displayParts));
                const signature = new vscode.SignatureInformation(prefix + parameters.join(separator) + ts.displayPartsToString(item.suffixDisplayParts), documentation(item.documentation, item.tags));
                let start = prefix.length;
                signature.parameters = item.parameters.map((parameter, index) => {
                    const end = start + parameters[index].length;
                    const result = new vscode.ParameterInformation([start, end], documentation(parameter.documentation));
                    start = end + separator.length;
                    return result;
                });
                // VS Code uses per-signature activeParameter for variadic parameter lists.
                signature.activeParameter = Math.max(0, Math.min(data.argumentIndex, signature.parameters.length - 1));
                return signature;
            });
            return help;
        }),
    }, '(', ','));
    context.subscriptions.push(vscode.languages.registerDocumentFormattingEditProvider(selector, {
        provideDocumentFormattingEdits: (document, options, token) => safe(async () => {
            if (token.isCancellationRequested) return [];
            const service = await model(document);
            return service ? service.format(options).map(edit => vscode.TextEdit.replace(range(document, edit.span), edit.newText)) : [];
        }, []),
    }));
    context.subscriptions.push(vscode.languages.registerDocumentSymbolProvider(selector, {
        provideDocumentSymbols: (document, token) => safe(async () => {
            if (token.isCancellationRequested) return [];
            const service = await model(document);
            if (!service) return [];
            const tree = service.languageService.getNavigationTree(service.file);
            function convert(node) {
                const span = node.spans[0];
                const symbol = new vscode.DocumentSymbol(node.text, '', symbolKind(node.kind), range(document, span), range(document, node.nameSpan || span));
                symbol.children = (node.childItems || []).map(convert);
                return symbol;
            }
            return (tree.childItems || []).map(convert);
        }, []),
    }));
    context.subscriptions.push(vscode.languages.registerFoldingRangeProvider(selector, {
        provideFoldingRanges: (document, _context, token) => safe(async () => {
            if (token.isCancellationRequested) return [];
            const service = await model(document);
            return service ? service.languageService.getOutliningSpans(service.file).map(item => {
                const start = document.positionAt(item.textSpan.start).line;
                const end = document.positionAt(item.textSpan.start + item.textSpan.length).line;
                return end > start ? new vscode.FoldingRange(start, end) : undefined;
            }).filter(Boolean) : [];
        }, []),
    }));
    context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(document => { if (eligible(document)) schedule(document); else if (document.uri.path.endsWith('.d.ts')) reset(); }));
    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(event => { if (eligible(event.document)) schedule(event.document); else if (event.document.uri.path.endsWith('.d.ts')) reset(); }));
    context.subscriptions.push(vscode.workspace.onDidCloseTextDocument(document => {
        const key = document.uri.toString();
        clearTimeout(timers.get(key)); timers.delete(key);
        models.get(key)?.dispose(); models.delete(key);
        diagnostics.delete(document.uri);
        if (document.uri.path.endsWith('.d.ts')) reset();
    }));
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(event => { if (event.affectsConfiguration('escript')) reset(); }));
    const watcher = vscode.workspace.createFileSystemWatcher('**/*.d.ts');
    context.subscriptions.push(watcher, watcher.onDidChange(reset), watcher.onDidCreate(reset), watcher.onDidDelete(reset));
    context.subscriptions.push(vscode.commands.registerCommand('escript.restartLanguageService', () => {
        reset(); output.appendLine('Language service restarted.');
    }));
    context.subscriptions.push({ dispose() {
        disposed = true; generation++;
        for (const timer of timers.values()) clearTimeout(timer);
        timers.clear();
        for (const service of models.values()) service.dispose();
        models.clear(); declarations.clear();
    } });
    for (const document of vscode.workspace.textDocuments) schedule(document);
    output.appendLine(`Siebel eScript activated; bundled TypeScript ${ts.version}, static with-scopes, server/ST types.`);
    return { engineVersion: ts.version };
}
module.exports = { activate };
