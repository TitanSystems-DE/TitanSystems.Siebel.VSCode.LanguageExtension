'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ScriptService, ts } = require('../src/service');
const prefix = 'var bc: BusComp = TheApplication().GetBusObject("Account").GetBusComp("Account");\n';
function fixture(marked, extras) {
 const offset = marked.indexOf('/*cursor*/');
 const s = new ScriptService('file:///workspace/Account.escript', marked.replace('/*cursor*/',''), {}, extras);
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
test('separate eScript objects cannot accidentally share global event declarations', () => {
 const one=new ScriptService('file:///one.escript','var privateToObject: string = "one";');
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
