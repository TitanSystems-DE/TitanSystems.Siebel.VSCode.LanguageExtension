'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
// Preload the actual engine: only the adapter's filesystem/path boundary is simulated.
require('../vendor/typescript.js');
test('Windows host: normalized compiler paths load original script and packaged declarations',()=>{
 const filename=path.resolve(__dirname,'../src/service.js');
 const realLoad=Module._load;
 const windowsPath={...path.win32,posix:path.posix,resolve:()=> 'C:\\Users\\Thomas\\.vscode\\extensions\\siebel-escript\\types'};
 const mockFs={...fs,readFileSync(file,...args){
  const basename=path.win32.basename(file);
  if(basename==='runtime.d.ts'||basename==='siebel.d.ts')return fs.readFileSync(path.join(__dirname,'../types',basename),...args);
  return fs.readFileSync(file,...args);
 }};
 const isolated=new Module(filename,module);isolated.filename=filename;isolated.paths=module.paths;
 try {
  Module._load=function(name,parent,...args){
   if(parent===isolated&&name==='node:path')return windowsPath;
   if(parent===isolated&&name==='node:fs')return mockFs;
   return realLoad.call(this,name,parent,...args);
  };
  isolated._compile(fs.readFileSync(filename,'utf8'),filename);
 }finally{Module._load=realLoad;}
 const {ScriptService}=isolated.exports;
 const s=new ScriptService('file:///c:/Users/Thomas/test/test.escript','var a = TheApplication();\na.');
 try {
  assert(s.completions(s.text.length)?.entries.some(e=>e.name==='GetBusObject'));
  s.update('var a = TheApplication();\na.GetBusObject("Account").GetBusComp("Account").ExecuteQuery("wrong");');
  assert.deepEqual(s.diagnostics().map(d=>d.code),[2345]);
  const offset=s.text.indexOf('GetBusObject')+3;
  assert(s.definitions(offset).some(d=>d.fileName.endsWith('siebel.d.ts')));
 }finally{s.dispose();}
});
