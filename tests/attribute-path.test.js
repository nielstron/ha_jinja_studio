import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { BlocklyCore as Blockly } from '../frontend/blocks.js';
import { generate } from '../frontend/generator.js';
import { applyAttributePath, attributeChildren, containerValue, resolveAttributePath } from '../frontend/attribute-path.js';

const key=value=>({kind:'key',value});
const index=value=>({kind:'index',value});
const attributes={
  rooms:[{name:'Study',status:{progress:42}},{name:'Bedroom',status:{progress:7}}],
  json:JSON.stringify({forecast:[{temperature:21.5}]}),
  special:{'0':'string key','a.b':'dotted key','a"b':'quoted key'},
  empty:[],
  missing:null,
};

function setup() {
  const workspace=new Blockly.Workspace();
  const output=workspace.newBlock('tb_output');
  const attribute=workspace.newBlock('ha_attribute');
  attribute.setFieldValue('sensor.details','ENTITY');
  output.getInput('VALUE').connection.connect(attribute.outputConnection);
  return {workspace,output,attribute};
}

function render(workspace) {
  const template=generate(workspace);
  const snapshot={states:[{entity_id:'sensor.details',state:'on',attributes}]};
  const python=spawnSync('uv',['run','python','-c','import json,sys; from dev.server import environment; d=json.load(sys.stdin); print(json.dumps(environment(d["snapshot"]).from_string(d["template"]).render()))'],{input:JSON.stringify({template,snapshot}),encoding:'utf8'});
  assert.equal(python.status,0,`${template}\n${python.stderr}`);
  return JSON.parse(python.stdout);
}

test('nested dictionary and list selections generate a connected path and preserve the output',()=>{
  const {workspace,output,attribute}=setup();
  try {
    const outer=applyAttributePath(attribute,[key('rooms'),index(0),key('status'),key('progress')]);
    assert.equal(output.getInputTargetBlock('VALUE'),outer);
    assert.equal(render(workspace),'42');
    assert.equal(workspace.getTopBlocks().length,1);
  } finally {workspace.dispose();}
});

test('picking another path replaces generated wrappers without duplicating the old path',()=>{
  const {workspace,attribute}=setup();
  try {
    applyAttributePath(attribute,[key('rooms'),index(0),key('status'),key('progress')]);
    applyAttributePath(attribute,[key('rooms'),index(1),key('name')]);
    assert.equal(render(workspace),'Bedroom');
    assert.equal(workspace.getAllBlocks().length,5);
    applyAttributePath(attribute,[key('empty')]);
    assert.equal(render(workspace),'[]');
    assert.equal(workspace.getAllBlocks().length,2);
  } finally {workspace.dispose();}
});

test('picker paths recognize structured JSON strings and generate from_json before indexing',()=>{
  const path=[key('json'),{kind:'json'},key('forecast'),index(0),key('temperature')];
  assert.equal(resolveAttributePath(attributes,path),21.5);
  const {workspace,attribute}=setup();
  try {applyAttributePath(attribute,path);assert.equal(render(workspace),'21.5');assert.match(generate(workspace),/from_json/);}
  finally {workspace.dispose();}
});

test('dictionary keys remain strings, including numeric-looking and punctuation keys',()=>{
  const {workspace,attribute}=setup();
  try {for(const [name,expected] of Object.entries(attributes.special)){applyAttributePath(attribute,[key('special'),key(name)]);assert.equal(render(workspace),expected);}}
  finally {workspace.dispose();}
});

test('generated path metadata survives export/import and remains replaceable',()=>{
  const {workspace,attribute}=setup();
  const restored=new Blockly.Workspace();
  try {
    applyAttributePath(attribute,[key('rooms'),index(0),key('name')]);
    Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(workspace),restored);
    const root=restored.getAllBlocks().find(block=>block.type==='ha_attribute');
    applyAttributePath(root,[key('rooms'),index(1),key('name')]);
    assert.equal(render(restored),'Bedroom');
    assert.equal(restored.getAllBlocks().length,5);
  } finally {workspace.dispose();restored.dispose();}
});

test('manual consumer blocks remain connected when changing the attribute path',()=>{
  const {workspace,output,attribute}=setup();
  try {
    attribute.outputConnection.disconnect();
    const filter=workspace.newBlock('tb_filter');
    filter.setFieldValue('upper','FILTER');
    filter.getInput('VALUE').connection.connect(attribute.outputConnection);
    output.getInput('VALUE').connection.connect(filter.outputConnection);
    applyAttributePath(attribute,[key('rooms'),index(0),key('name')]);
    assert.equal(output.getInputTargetBlock('VALUE'),filter);
    assert.equal(render(workspace),'STUDY');
  } finally {workspace.dispose();}
});

test('browsing distinguishes empty containers, null, plain strings and JSON',()=>{
  const children=attributeChildren(attributes,[]);
  assert.equal(children.find(c=>c.label==='empty').container,true);
  assert.equal(children.find(c=>c.label==='missing').container,false);
  assert.deepEqual(attributeChildren(attributes,[key('empty')]),[]);
  assert.deepEqual(children.find(c=>c.label==='json').browsePath,[key('json'),{kind:'json'}]);
  assert.deepEqual(containerValue('{ordinary text}'),{value:'{ordinary text}',json:false});
  assert.equal(attributeChildren(attributes,[key('rooms')])[0].path.at(-1).kind,'index');
});
