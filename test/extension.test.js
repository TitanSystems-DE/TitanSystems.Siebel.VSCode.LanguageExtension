'use strict';
// API adapter test. This simulates the stable VS Code API; it is not an Electron UI test.
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const wait = () => new Promise(resolve=>setTimeout(resolve,240));
const disposable = () => ({dispose(){}});
class Position { constructor(line,character){this.line=line;this.character=character;} }
class Range { constructor(start,end){this.start=start;this.end=end;} }
class Uri {
 constructor(value){this.value=value;this.path=decodeURIComponent(new URL(value).pathname);}
 toString(){return this.value;}
 static parse(s){return new Uri(s);}
 static file(s){return new Uri(pathToFileURL(s).href);}
 static joinPath(base,...parts){const u=new URL(base.toString());u.pathname=path.posix.join(u.pathname,...parts);return new Uri(u.href);}
}
class MarkdownString {
 constructor(value=''){this.value=value;}
 appendMarkdown(value){this.value+=value;return this;}
 appendCodeblock(value,language){this.value+='```'+language+'\n'+value+'\n```';return this;}
}
class Document {
 constructor(text,name='Account.escript',languageId='escript'){this.text=text;this.uri=Uri.parse('file:///workspace/'+name);this.languageId=languageId;this.version=1;this.isClosed=false;}
 getText(){return this.text;}
 positionAt(offset){const lines=this.text.slice(0,offset).split('\n');return new Position(lines.length-1,lines.at(-1).length);}
 offsetAt(p){const lines=this.text.split('\n');return lines.slice(0,p.line).reduce((n,l)=>n+l.length+1,0)+p.character;}
}
function stub(document){
 const documents=Array.isArray(document)?document:[document];
 document=documents[0];
 const providers={},events={},diagnostics=new Map(),logs=[],decorations=[];
 const editors=documents.map(document=>({document,setDecorations:(_type,ranges)=>decorations.push({document,ranges})}));
 const api={Position,Range,Uri,MarkdownString,
 CompletionItemKind:new Proxy({}, {get:(_,k)=>k}),SymbolKind:new Proxy({}, {get:(_,k)=>k}),DiagnosticSeverity:{Error:0,Warning:1},
 CompletionItem:class {constructor(label,kind){this.label=label;this.kind=kind;}},
 Diagnostic:class {constructor(range,message,severity){Object.assign(this,{range,message,severity});}},
 Hover:class {constructor(contents,range){Object.assign(this,{contents,range});}},
 Location:class {constructor(uri,range){Object.assign(this,{uri,range});}},
 SignatureHelp:class {},
 SemanticTokensLegend:class {constructor(tokenTypes,tokenModifiers){Object.assign(this,{tokenTypes,tokenModifiers});}},
 SemanticTokensBuilder:class {constructor(){this.items=[];}push(range,type,modifiers){this.items.push({range,type,modifiers});}build(){return this.items;}},
 SignatureInformation:class {constructor(label,documentation){Object.assign(this,{label,documentation});}},
 ParameterInformation:class {constructor(label,documentation){Object.assign(this,{label,documentation});}},
 SnippetString:class {constructor(value){this.value=value;}},
 DocumentSymbol:class {constructor(name,detail,kind,range,selectionRange){Object.assign(this,{name,detail,kind,range,selectionRange});}},
 FoldingRange:class {constructor(start,end){Object.assign(this,{start,end});}},
 TextEdit:{replace:(range,newText)=>({range,newText})},
 window:{visibleTextEditors:editors,createOutputChannel:()=>({appendLine:s=>logs.push(s),dispose(){}}),
  createTextEditorDecorationType:options=>({options,dispose(){}}),
  onDidChangeVisibleTextEditors:fn=>{events.onDidChangeVisibleTextEditors=fn;return disposable();}},
 workspace:{textDocuments:documents,getConfiguration:()=>({get:(_name,fallback)=>fallback}),getWorkspaceFolder:()=>({uri:Uri.parse('file:///workspace')}),
  fs:{readDirectory:async uri=>documents.filter(d=>path.posix.dirname(d.uri.path)===uri.path).map(d=>[path.posix.basename(d.uri.path),1]),readFile:async uri=>Buffer.from(documents.find(d=>d.uri.toString()===uri.toString()).getText())},
  findFiles:async pattern=>pattern==='**/*.d.escript'?documents.filter(d=>d.uri.path.toLowerCase().endsWith('.d.escript')).map(d=>d.uri):[],
  createFileSystemWatcher:()=>({onDidChange:()=>disposable(),onDidCreate:()=>disposable(),onDidDelete:()=>disposable(),dispose(){}})},
 languages:{createDiagnosticCollection:()=>({set:(uri,data)=>diagnostics.set(uri.toString(),data),delete:uri=>diagnostics.delete(uri.toString()),dispose(){diagnostics.clear();}})},
 commands:{registerCommand:(name,fn)=>{events[name]=fn;return disposable();}},
 };
 for(const name of ['onDidOpenTextDocument','onDidChangeTextDocument','onDidCloseTextDocument','onDidChangeConfiguration']) api.workspace[name]=fn=>{events[name]=fn;return disposable();};
 for(const name of ['CompletionItem','Hover','Definition','Reference','SignatureHelp','DocumentFormattingEdit','DocumentSymbol','FoldingRange']) {
  api.languages['register'+name+'Provider']=(selector,provider,...triggers)=>{assert.equal(selector.language,'escript');providers[name]=provider;return disposable();};
 }
 api.languages.registerDocumentSemanticTokensProvider=(selector,provider,legend)=>{assert.equal(selector.language,'escript');providers.SemanticTokens=provider;providers.SemanticTokensLegend=legend;return disposable();};
 return {api,providers,events,diagnostics,logs,decorations};
}
test('extension activation, providers, live diagnostics and close lifecycle',async()=>{
 const text='var bc: BusComp = TheApplication().GetBusObject("Account").GetBusComp("Account");\nSharedHelper();\nwith(bc) {\n    ExecuteQuery("wrong");\n    GetFieldValue("Name");\n}\n';
 const doc=new Document(text),helper=new Document('function SharedHelper(): chars { return "ok"; }','Shared.escript'),fake=stub([doc,helper]),context={subscriptions:[]};
 const original=Module._load;
 let extension;
 try {Module._load=function(name,...args){return name==='vscode'?fake.api:original.call(this,name,...args);};extension=require('../src/extension');}
 finally {Module._load=original;}
 try {
  assert.equal(extension.activate(context).engineVersion,'6.0.3');
  await wait();
  assert.deepEqual(fake.diagnostics.get(doc.uri.toString()).map(d=>d.code),[2345]);
  const token={isCancellationRequested:false};
  const cursor=doc.positionAt(text.indexOf('GetFieldValue')+5);
  const hover=await fake.providers.Hover.provideHover(doc,cursor,token);
  assert(hover.contents.some(m=>m.value.includes('current record')));
  const definitions=await fake.providers.Definition.provideDefinition(doc,cursor,token);
  assert(definitions.some(l=>l.uri.path.endsWith('/types/siebel.d.ts')));
  const sharedCursor=doc.positionAt(text.indexOf('SharedHelper')+3);
  const sharedDefinitions=await fake.providers.Definition.provideDefinition(doc,sharedCursor,token);
  assert(sharedDefinitions.some(l=>l.uri.toString()===helper.uri.toString()));
  const refs=await fake.providers.Reference.provideReferences(doc,cursor,{includeDeclaration:false},token);
  assert(refs.some(r=>r.uri.toString()===doc.uri.toString()));
  const items=await fake.providers.CompletionItem.provideCompletionItems(doc,doc.positionAt(text.indexOf('    GetField')),token);
  const item=items.find(i=>i.label==='SetSearchSpec');assert(item);
  await fake.providers.CompletionItem.resolveCompletionItem(item,token);
  assert(item.detail.includes('SetSearchSpec'));assert(item.documentation.value.length>0);
  const signature=await fake.providers.SignatureHelp.provideSignatureHelp(doc,doc.positionAt(text.indexOf('("Name")')+1),token);
  assert(signature.signatures[0].parameters[0].documentation.value.length>0);
  const edits=await fake.providers.DocumentFormattingEdit.provideDocumentFormattingEdits(doc,{tabSize:4,insertSpaces:true},token);
  assert(Array.isArray(edits));
  const folds=await fake.providers.FoldingRange.provideFoldingRanges(doc,{},token);assert(folds.length>0);
  doc.text=text.replace('"wrong"','ForwardOnly');doc.version++;
  fake.events.onDidChangeTextDocument({document:doc});await wait();
  assert.deepEqual(fake.diagnostics.get(doc.uri.toString()),[]);
  fake.events['escript.restartLanguageService']();await wait();
  assert.deepEqual(fake.diagnostics.get(doc.uri.toString()),[]);
  doc.isClosed=true;fake.events.onDidCloseTextDocument(doc);
  assert(!fake.diagnostics.has(doc.uri.toString()));
  assert(!fake.logs.some(s=>s.startsWith('[Error]')),fake.logs.join('\n'));
 } finally {for(const d of context.subscriptions.toReversed())d.dispose();}
});
test('.d.escript documents are validated globally across directories',async()=>{
 const declaration=new Document('interface Clib { WriteLn(arg: String): void; }','types/custom.d.escript');
 const script=new Document('Clib.WriteLn("hello");\nForeignOnly();','scripts/Main.escript');
 const foreign=new Document('function ForeignOnly(): chars { return "foreign"; }','other/Foreign.escript');
 const fake=stub([declaration,script,foreign]),context={subscriptions:[]};
 const original=Module._load;
 let extension;
 try {
  delete require.cache[require.resolve('../src/extension')];
  Module._load=function(name,...args){return name==='vscode'?fake.api:original.call(this,name,...args);};
  extension=require('../src/extension');
 } finally {Module._load=original;}
 try {
  extension.activate(context);
  await wait();
  assert.deepEqual(fake.diagnostics.get(declaration.uri.toString()),[]);
  assert.deepEqual(fake.diagnostics.get(script.uri.toString()).map(d=>d.code),[2304]);
  declaration.text='interface Clib {}';declaration.version++;
  fake.events.onDidChangeTextDocument({document:declaration});
  await wait();
  assert(fake.diagnostics.get(script.uri.toString()).some(d=>d.code===2339));
 } finally {for(const d of context.subscriptions.toReversed())d.dispose();}
});
test('workspace .d.ts files are ignored',async()=>{
 const declaration=new Document('declare function TypeScriptOnly(): string;','types/custom.d.ts','typescript');
 const script=new Document('TypeScriptOnly();','scripts/Main.escript');
 const fake=stub([declaration,script]),context={subscriptions:[]};
 const original=Module._load;let extension;
 try {
  delete require.cache[require.resolve('../src/extension')];
  Module._load=function(name,...args){return name==='vscode'?fake.api:original.call(this,name,...args);};
  extension=require('../src/extension');
 } finally {Module._load=original;}
 try {
  extension.activate(context);await wait();
  assert(fake.diagnostics.get(script.uri.toString()).some(d=>d.code===2304));
 } finally {for(const d of context.subscriptions.toReversed())d.dispose();}
});
test('implicit any parameter diagnostics are exposed as VS Code warnings',async()=>{
 const doc=new Document('function Untyped(parameter) { return parameter; }');
 const fake=stub(doc),context={subscriptions:[]};
 const original=Module._load;let extension;
 try {
  delete require.cache[require.resolve('../src/extension')];
  Module._load=function(name,...args){return name==='vscode'?fake.api:original.call(this,name,...args);};
  extension=require('../src/extension');
 } finally {Module._load=original;}
 try {
  extension.activate(context);await wait();
  const diagnostic=fake.diagnostics.get(doc.uri.toString()).find(d=>d.code===7006);
  assert(diagnostic);assert.equal(diagnostic.severity,fake.api.DiagnosticSeverity.Warning);
 } finally {for(const d of context.subscriptions.toReversed())d.dispose();}
});
test('reference parameters are underlined in declarations and function bodies',async()=>{
 const doc=new Document('function Update(&status: chars) { status = "Done"; }');
 const fake=stub(doc),context={subscriptions:[]};
 const original=Module._load;let extension;
 try {
  delete require.cache[require.resolve('../src/extension')];
  Module._load=function(name,...args){return name==='vscode'?fake.api:original.call(this,name,...args);};
  extension=require('../src/extension');
 } finally {Module._load=original;}
 try {
  extension.activate(context);await wait();
  const latest=fake.decorations.filter(entry=>entry.document===doc).at(-1);
  assert(latest);assert.equal(latest.ranges.length,2);
  assert.deepEqual(latest.ranges.map(item=>doc.getText().split('\n')[item.start.line].slice(item.start.character,item.end.character)),['status','status']);
  const semantic=await fake.providers.SemanticTokens.provideDocumentSemanticTokens(doc,{isCancellationRequested:false});
  assert.equal(semantic.length,2);
  assert(semantic.every(item=>item.type==='variable'&&item.modifiers.includes('referenceParameter')));
  const hover=await fake.providers.Hover.provideHover(doc,doc.positionAt(doc.getText().lastIndexOf('status')+2),{isCancellationRequested:false});
  assert.equal(hover.contents[0].value,'`PassedByReference`');
 } finally {for(const d of context.subscriptions.toReversed())d.dispose();}
});
test('hover identifies workspace .d.escript methods as extensions but excludes bundled APIs',async()=>{
 const declaration=new Document('interface CustomApiType { Run(): void; } declare const CustomApi: CustomApiType;','types/custom.d.escript');
 const doc=new Document('CustomApi.Run(); Clib.WriteLn("built in");','Main.escript');
 const fake=stub([doc,declaration]),context={subscriptions:[]};
 const original=Module._load;let extension;
 try {
  delete require.cache[require.resolve('../src/extension')];
  Module._load=function(name,...args){return name==='vscode'?fake.api:original.call(this,name,...args);};
  extension=require('../src/extension');
 } finally {Module._load=original;}
 try {
  extension.activate(context);await wait();
  const token={isCancellationRequested:false};
  const custom=await fake.providers.Hover.provideHover(doc,doc.positionAt(doc.getText().indexOf('Run')+1),token);
  const bundled=await fake.providers.Hover.provideHover(doc,doc.positionAt(doc.getText().indexOf('WriteLn')+1),token);
  assert.equal(custom.contents[0].value,'`Extension`');
  assert(!bundled.contents.some(item=>item.value.includes('Extension')));
 } finally {for(const d of context.subscriptions.toReversed())d.dispose();}
});
