'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { decodeStringList, referencedNames, EndoitMetadataProvider } = require('../src/metadata');

test('Endoit generated lists and index mappings are parsed without evaluation',()=>{
 assert.deepEqual(decodeStringList('const list = ["Id","Name"] as const;\nexport type Fields = (typeof list)[number];'),['Id','Name']);
 const index='export type BusObjectBusComps = {\n\t"Account": import("./busobjects/Account").BusComps;\n};\nexport type BusCompFields = {\n\t"Account": BusCompFieldType<import("./buscomps/Account").Fields>;\n};';
 assert.deepEqual(referencedNames(index,'BusObjectBusComps','busobjects'),[{name:'Account',file:'Account'}]);
 assert.deepEqual(referencedNames(index,'BusCompFields','buscomps'),[{name:'Account',file:'Account'}]);
});
test('Endoit provider follows the active connection shim and caches its snapshot',async()=>{
 const files=new Map([
  ['/workspace/connection-shim.ts','import { BusObjectBusComps, BusCompFields } from "./types/server/types";'],
  ['/workspace/types/server/types.ts','export type BusObjectBusComps = {"Account": import("./busobjects/Account").BusComps;};\nexport type BusCompFields = {"Account": BusCompFieldType<import("./buscomps/Account").Fields>;};'],
  ['/workspace/types/server/busobjects/Account.ts','const list = ["Account"] as const; export type BusComps = (typeof list)[number];'],
  ['/workspace/types/server/buscomps/Account.ts','const list = ["Id","Name"] as const; export type Fields = (typeof list)[number];'],
 ]);let reads=0;
 const fs={joinPath:(base,...parts)=>`${base}/${parts.join('/')}`,readFile:async uri=>{reads++;if(!files.has(uri))throw new Error('missing');return Buffer.from(files.get(uri));}};
 const provider=new EndoitMetadataProvider('/workspace',fs);
 const first=await provider.snapshot();
 assert.deepEqual(first.businessObjects,['Account']);
 assert.deepEqual(first.businessComponents.get('Account'),['Account']);
 assert.deepEqual(first.fields.get('Account'),['Id','Name']);
 await provider.snapshot();assert.equal(reads,4);
 provider.invalidate();await provider.snapshot();assert.equal(reads,8);
});
