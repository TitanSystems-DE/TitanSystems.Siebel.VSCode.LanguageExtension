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
 constructor(text){this.text=text;this.uri=Uri.parse('file:///workspace/Account.escript');this.languageId='escript';this.version=1;this.isClosed=false;}
 getText(){return this.text;}
 positionAt(offset){const lines=this.text.slice(0,offset).split('\n');return new Position(lines.length-1,lines.at(-1).length);}
 offsetAt(p){const lines=this.text.split('\n');return lines.slice(0,p.line).reduce((n,l)=>n+l.length+1,0)+p.character;}
}
function stub(document){
 const providers={},events={},diagnostics=new Map(),logs=[];
 const api={Position,Range,Uri,MarkdownString,
 CompletionItemKind:new Proxy({}, {get:(_,k)=>k}),SymbolKind:new Proxy({}, {get:(_,k)=>k}),DiagnosticSeverity:{Error:0,Warning:1},
 CompletionItem:class {constructor(label,kind){this.label=label;this.kind=kind;}},
 Diagnostic:class {constructor(range,message,severity){Object.assign(this,{range,message,severity});}},
 Hover:class {constructor(contents,range){Object.assign(this,{contents,range});}},
 Location:class {constructor(uri,range){Object.assign(this,{uri,range});}},
 SignatureHelp:class {},
 SignatureInformation:class {constructor(label,documentation){Object.assign(this,{label,documentation});}},
 ParameterInformation:class {constructor(label,documentation){Object.assign(this,{label,documentation});}},
 SnippetString:class {constructor(value){this.value=value;}},
 DocumentSymbol:class {constructor(name,detail,kind,range,selectionRange){Object.assign(this,{name,detail,kind,range,selectionRange});}},
 FoldingRange:class {constructor(start,end){Object.assign(this,{start,end});}},
 TextEdit:{replace:(range,newText)=>({range,newText})},
 window:{createOutputChannel:()=>({appendLine:s=>logs.push(s),dispose(){}})},
 workspace:{textDocuments:[document],getConfiguration:()=>({get:(_name,fallback)=>fallback}),getWorkspaceFolder:()=>({uri:Uri.parse('file:///workspace')}),
  fs:{readFile:async()=>{throw Error('not used');}},
  createFileSystemWatcher:()=>({onDidChange:()=>disposable(),onDidCreate:()=>disposable(),onDidDelete:()=>disposable(),dispose(){}})},
 languages:{createDiagnosticCollection:()=>({set:(uri,data)=>diagnostics.set(uri.toString(),data),delete:uri=>diagnostics.delete(uri.toString()),dispose(){diagnostics.clear();}})},
 commands:{registerCommand:(name,fn)=>{events[name]=fn;return disposable();}},
 };
 for(const name of ['onDidOpenTextDocument','onDidChangeTextDocument','onDidCloseTextDocument','onDidChangeConfiguration']) api.workspace[name]=fn=>{events[name]=fn;return disposable();};
 for(const name of ['CompletionItem','Hover','Definition','Reference','SignatureHelp','DocumentFormattingEdit','DocumentSymbol','FoldingRange']) {
  api.languages['register'+name+'Provider']=(selector,provider,...triggers)=>{assert.equal(selector.language,'escript');providers[name]=provider;return disposable();};
 }
 return {api,providers,events,diagnostics,logs};
}
test('extension activation, providers, live diagnostics and close lifecycle',async()=>{
 const text='var bc: BusComp = TheApplication().GetBusObject("Account").GetBusComp("Account");\nwith(bc) {\n    ExecuteQuery("wrong");\n    GetFieldValue("Name");\n}\n';
 const doc=new Document(text),fake=stub(doc),context={subscriptions:[]};
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
