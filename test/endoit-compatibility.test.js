'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { inferEndoitThisType } = require('../src/endoit-compatibility');

const uri = path => ({ scheme: 'file', authority: '', path });
const workspace = uri('/workspace');

test('infers this types from Endoit script folders case-insensitively', () => {
    for (const [folder, expected] of [
        ['Business Service', 'Service'],
        ['business component', 'BusComp'],
        ['APPLET', 'WebApplet'],
        ['Application', 'Application'],
    ]) assert.equal(inferEndoitThisType(uri(`/workspace/connection/MAIN/${folder}/Object/Method.escript`), workspace), expected);
});

test('does not infer outside the Endoit layout or workspace', () => {
    assert.equal(inferEndoitThisType(uri('/workspace/Business Service/Object/Method.escript'), workspace), undefined);
    assert.equal(inferEndoitThisType(uri('/workspace/connection/MAIN/Other/Object/Method.escript'), workspace), undefined);
    assert.equal(inferEndoitThisType(uri('/elsewhere/connection/MAIN/Business Service/Object/Method.escript'), workspace), undefined);
});
