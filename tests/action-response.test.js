import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { BlocklyCore as Blockly, setFieldPicker } from '../frontend/blocks.js';
import { generate } from '../frontend/generator.js';
import { applyAttributePath } from '../frontend/attribute-path.js';
import { actionConfig, actionSignature, actionInputs, responseVariables, requiredActions } from '../frontend/action-response.js';

const sample={'weather.home':{forecast:[{temperature:21.5},{temperature:18}]}};
const key=value=>({kind:'key',value});
const index=value=>({kind:'index',value});
test('clicking the action name opens the action picker instead of a text editor',()=>{
  const workspace=new Blockly.Workspace();
  let selected;
  setFieldPicker((field,kind)=>{selected={field,kind};});
  try {
    const field=workspace.newBlock('ha_action_response').getField('ACTION');
    field.showEditor_();
    assert.equal(selected.kind,'action');
    assert.equal(selected.field,field);
  } finally {setFieldPicker(null);workspace.dispose();}
});
function setup() {
  const workspace=new Blockly.Workspace();
  const root=workspace.newBlock('ha_action_response');
  root.setFieldValue('weather.home','ENTITY');
  const output=workspace.newBlock('tb_output');
  output.getInput('VALUE').connection.connect(root.outputConnection);
  root.responseSample={signature:actionSignature(actionConfig(root)),value:sample};
  return {workspace,root,output};
}
function render(workspace) {
  const template=generate(workspace),variables=responseVariables(actionInputs(workspace));
  const result=spawnSync('uv',['run','python','-c','import json,sys; from dev.server import environment; d=json.load(sys.stdin); print(environment({"states":[]}).from_string(d["template"]).render(**d["variables"]))'],{input:JSON.stringify({template,variables}),encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  return result.stdout.trim();
}

test('forecast response paths generate variable references, not entity attributes or embedded samples',()=>{
  const {workspace,root}=setup();
  try {
    applyAttributePath(root,[key('weather.home'),key('forecast'),index(0),key('temperature')]);
    assert.equal(render(workspace),'21.5');
    assert.match(generate(workspace),/forecasts/);
    assert.doesNotMatch(generate(workspace),/state_attr|21\.5/);
    assert.equal(requiredActions(actionInputs(workspace)),'- action: weather.get_forecasts\n  target:\n    entity_id: "weather.home"\n  data: {"type":"hourly"}\n  response_variable: forecasts');
  } finally {workspace.dispose();}
});

test('response samples and replaceable paths survive workspace serialization',()=>{
  const {workspace,root}=setup(),restored=new Blockly.Workspace();
  try {
    applyAttributePath(root,[key('weather.home'),key('forecast'),index(0),key('temperature')]);
    Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(workspace),restored);
    const response=restored.getAllBlocks().find(b=>b.type==='ha_action_response');
    assert.deepEqual(response.responseSample.value,sample);
    applyAttributePath(response,[key('weather.home'),key('forecast'),index(1),key('temperature')]);
    assert.equal(render(restored),'18');
    applyAttributePath(response,[]);
    assert.equal(restored.getAllBlocks().length,2);
    assert.match(render(restored),/forecast/);
  } finally {workspace.dispose();restored.dispose();}
});

test('changed action settings invalidate samples, but renaming a variable retains its data',()=>{
  const {workspace,root}=setup();
  try {
    root.setFieldValue('hourly_weather','RESPONSE');
    assert.deepEqual(responseVariables(actionInputs(workspace)),{hourly_weather:sample});
    root.setFieldValue('{"type":"daily"}','DATA');
    assert.throws(()=>responseVariables(actionInputs(workspace)),/Fetch or paste a sample/);
  } finally {workspace.dispose();}
});

test('configuration rejects invalid JSON, actions and reserved variable names',()=>{
  const {workspace,root}=setup();
  try {
    for(const name of ['ns','for','states','bad-name','True']){
      root.setFieldValue(name,'RESPONSE');assert.throws(()=>actionConfig(root),/identifier/);
    }
    root.setFieldValue('forecasts','RESPONSE');
    root.setFieldValue('[]','DATA');assert.throws(()=>actionConfig(root),/JSON object/);
    root.setFieldValue('{}','DATA');root.setFieldValue('weather.get_forecasts()','ACTION');assert.throws(()=>actionConfig(root),/domain.action/);
  } finally {workspace.dispose();}
});

test('conflicting response variables fail clearly and disabled inputs are excluded',()=>{
  const {workspace,root,output}=setup();
  try {
    const second=workspace.newBlock('ha_action_response');second.setFieldValue('weather.home','ENTITY');
    assert.equal(actionInputs(workspace).length,1);
    second.setFieldValue('{"type":"daily"}','DATA');
    assert.throws(()=>actionInputs(workspace),/different actions/);
    second.setDisabledReason(true,'test');
    assert.equal(actionInputs(workspace).length,1);
    output.setDisabledReason(true,'test');
    assert.deepEqual(actionInputs(workspace),[]);
    assert.equal(requiredActions([]),'');
    assert.deepEqual(responseVariables([]),{});
  } finally {workspace.dispose();}
});

test('generic untargeted response actions and scalar samples are supported',()=>{
  const {workspace,root}=setup();
  try {
    root.setFieldValue('script.get_data','ACTION');root.setFieldValue('','ENTITY');root.setFieldValue('{}','DATA');
    root.responseSample={signature:actionSignature(actionConfig(root)),value:42};
    assert.equal(render(workspace),'42');
    assert.doesNotMatch(requiredActions(actionInputs(workspace)),/target/);
  } finally {workspace.dispose();}
});

test('Home Assistant entity IDs can have numeric-leading object IDs',()=>{
  const {workspace,root}=setup();
  try {
    root.setFieldValue('weather.51_huttenstrasse_oberstrass','ENTITY');
    assert.equal(actionConfig(root).entity,'weather.51_huttenstrasse_oberstrass');
  } finally {workspace.dispose();}
});
