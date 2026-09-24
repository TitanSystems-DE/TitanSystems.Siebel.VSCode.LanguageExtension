'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ScriptService, ts } = require('../src/service');
const prefix = 'var bc: BusComp = TheApplication().GetBusObject("Account").GetBusComp("Account");\n';
function fixture(marked, extras, scripts) {
 const offset = marked.indexOf('/*cursor*/');
 const s = new ScriptService('file:///workspace/Account.escript', marked.replace('/*cursor*/',''), {}, extras, scripts);
 return { s, offset };
}
test('real eScript example and built-in declarations compile without standard libraries', () => {
 const s = new ScriptService('file:///Account.escript',fs.readFileSync(path.join(__dirname,'../examples/Account.escript'),'utf8'));
 assert.deepEqual(s.diagnostics(),[]);
 assert.equal(s.languageService.getProgram().getSourceFiles().length,3);
 s.dispose();
});
test('completions and completion details inside typed with', () => {
 const {s,offset}=fixture(prefix+'with(bc) { Get/*cursor*/ }');
 const entries=s.completions(offset).entries;
 for(const name of ['GetFieldValue','ExecuteQuery','SetSearchSpec']) assert(entries.some(e=>e.name===name),name);
 const detail=s.completionDetails(offset,entries.find(e=>e.name==='GetFieldValue'));
 assert(ts.displayPartsToString(detail.documentation).includes('current record'));
 const signature=ts.displayPartsToString(detail.displayParts);
 assert(signature.includes('chars'));
 assert(!signature.includes('SblStr'));
 s.dispose();
});
test('hover, definition, references and signature help preserve source coordinates', () => {
 const {s,offset}=fixture(prefix+'var emoji = "😀";\r\nwith(bc) { GetField/*cursor*/Value("Name"); GetFieldValue("Id"); }');
 const info=s.quickInfo(offset); assert(ts.displayPartsToString(info.documentation).includes('current record'));
 assert(s.definitions(offset).some(d=>d.fileName.endsWith('siebel.d.ts')));
 assert(s.references(offset).some(d=>d.fileName===s.file));
 const signature=s.signatureHelp(s.text.indexOf('("Name")')+1);
 assert(signature.items[0].parameters[0].documentation.length);
 assert.equal(s.targetUri(s.file),'file:///workspace/Account.escript');
 s.dispose();
});
test('live edits replace stale diagnostics and update inferred types', () => {
 const {s}=fixture(prefix+'with(bc) { ExecuteQuery("wrong"); }');
 assert.deepEqual(s.diagnostics().map(d=>d.code),[2345]);
 s.update(prefix+'with(bc) { ExecuteQuery(ForwardOnly); }');
 assert.deepEqual(s.diagnostics(),[]);
 s.update('var value = "text"; value.');
 assert(s.completions(s.text.length).entries.some(e=>e.name==='substring'));
 assert(!s.completions(s.text.length).entries.some(e=>e.name==='includes'));
 s.dispose();
});
test('standard browser, Node and modern JS globals remain excluded', () => {
 const {s}=fixture('Promise; Map; window; fetch; process;');
 assert.equal(s.diagnostics().length,5);
 s.dispose();
});
test('type completions expose Siebel types but hide TypeScript-only and compiler support types', () => {
 const {s}=fixture('var value: /*cursor*/');
 const names=new Set(s.completions(s.text.length).entries.map(entry=>entry.name));
 for(const name of ['chars','float','bool','Object','String','Number','Boolean','Array','Date','RegExp','BusComp']) assert(names.has(name),name);
 for(const name of ['string','number','boolean','any','unknown','never','bigint','symbol','object','void','ReadonlyArray','StringConstructor','SblStrIn','globalThis']) assert(!names.has(name),name);
 s.dispose();
});
test('TypeScript-only type annotations produce Siebel compatibility diagnostics', () => {
 const {s}=fixture('var text: string; var count: number; var flag: boolean; var loose: any; var values: chars[]; var choice: chars | float; function noResult(): void {}');
 const diagnostics=s.diagnostics().filter(d=>d.code===95001);
 assert.equal(diagnostics.length,7);
 assert(diagnostics.some(d=>String(d.messageText).includes("'chars'")));
 assert(diagnostics.some(d=>String(d.messageText).includes("'float'")));
 assert(diagnostics.some(d=>String(d.messageText).includes("'bool'")));
 assert(diagnostics.some(d=>String(d.messageText).includes('typeless')));
 s.dispose();
});
test('null can be assigned to every strongly typed eScript value', () => {
 const {s}=fixture('var bc: BusComp = null; bc = null; function accept(value: BusComp): BusComp { return null; } accept(null);');
 assert.deepEqual(s.diagnostics(),[]);
 s.update('var bc: BusComp = undefined;');
 assert(s.diagnostics().some(d=>d.code===2322));
 s.dispose();
});
test('function header comments assign a local this type', () => {
 for(const directive of ['// @this: Service','// @this = Service','// this: Service']) {
  const {s,offset}=fixture(`${directive}\nfunction Test() { this.Inv/*cursor*/okeMethod("Run"); }`);
  const entries=s.completions(offset).entries;
  assert(entries.some(e=>e.name==='InvokeMethod'),directive);
  assert(!entries.some(e=>e.name==='GetBusObject'),directive);
  assert.deepEqual(s.diagnostics(),[]);
  s.dispose();
 }
});
test('comment-declared this includes top-level members from sibling scripts', () => {
 const helperUri='file:///workspace/Shared.escript';
 const source='var LocalProperty: chars = "local";\n// @this: Service\nfunction Test() { this.Shared/*cursor*/Method("ok"); this.SharedProperty; this.LocalProperty; }';
 const {s,offset}=fixture(source,[],[{
  uri:helperUri,
  text:'function SharedMethod(value: chars): chars { return value; }\nvar SharedProperty: chars = "ready";',
 }]);
 const names=new Set(s.completions(offset).entries.map(entry=>entry.name));
 for(const name of ['InvokeMethod','LocalProperty','SharedMethod','SharedProperty']) assert(names.has(name),name);
 s.dispose();
});
test('separate eScript objects cannot accidentally share global event declarations', () => {
 const one=new ScriptService('file:///one.escript','var privateToObject: chars = "one";');
 const two=new ScriptService('file:///two.escript','privateToObject;');
 assert.equal(one.diagnostics().length,0);
 assert(two.diagnostics().some(d=>d.code===2304));one.dispose();two.dispose();
});
test('scripts in the same directory share functions, objects and navigation', () => {
 const helperUri='file:///workspace/Shared.escript';
 const main='var value: chars = SharedMethod();\nSharedObject.Run();';
 const s=new ScriptService('file:///workspace/Main.escript',main,{},[],[{
  uri:helperUri,
  text:'function SharedMethod(): chars { return "ok"; }\nvar SharedObject = { Run: function(): void {} };',
 }]);
 assert.deepEqual(s.diagnostics(),[]);
 const method=s.definitions(main.indexOf('SharedMethod')+3)[0];
 const object=s.definitions(main.indexOf('SharedObject')+3)[0];
 assert.equal(s.targetUri(method.fileName),helperUri);
 assert.equal(s.targetUri(object.fileName),helperUri);
 assert(s.references(main.indexOf('SharedMethod')+3).some(r=>s.targetUri(r.fileName)===helperUri));
 s.updateFile(helperUri,'function RenamedMethod(): chars { return "ok"; }');
 assert(s.diagnostics().some(d=>d.code===2304));
 s.dispose();
});
test('additional declarations provide completions and definition URI mapping', () => {
 const uri='file:///workspace/types/custom.d.ts';
 const {s,offset}=fixture('Custom/*cursor*/Function();',[{uri,text:'/** Customer-specific function. */ declare function CustomFunction(): string;'}]);
 assert.equal(s.diagnostics().length,0);
 assert.equal(s.targetUri(s.definitions(offset)[0].fileName),uri);
 assert(ts.displayPartsToString(s.quickInfo(offset).documentation).includes('Customer-specific'));
 s.dispose();
});
test('formatting returns edits and navigation exposes event functions', () => {
 const {s}=fixture('function Test(){var x:float=1;return x;}');
 assert(s.format({tabSize:4,insertSpaces:true}).length>0);
 assert(s.languageService.getNavigationTree(s.file).childItems.some(n=>n.text==='Test'));
 assert(s.languageService.getOutliningSpans(s.file).length>0);s.dispose();
});
