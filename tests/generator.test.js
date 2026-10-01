import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { BlocklyCore as Blockly, toolbox } from '../frontend/blocks.js';
import { generate } from '../frontend/generator.js';
import { examples } from '../frontend/examples.js';

const n = value => ({type:'math_number',fields:{NUM:value}});
const raw = code => ({type:'tb_raw_expression',fields:{CODE:code}});
const text = value => ({type:'text',fields:{TEXT:value}});
const output = value => ({type:'tb_output',inputs:{VALUE:{block:value}}});
const inputs = values => Object.fromEntries(Object.entries(values).map(([key,block])=>[key,{block}]));
const snapshot = {states:[{entity_id:'sensor.temperature',state:'22.5',attributes:{friendly_name:'Temperature',unit_of_measurement:'°C'}},{entity_id:'light.study',state:'on',attributes:{}},{entity_id:'light.bedroom',state:'off',attributes:{}},{entity_id:'climate.study',state:'heat',attributes:{temperature:21}}]};

function render(blocks,variables=[],context={}) {
  const workspace=new Blockly.Workspace();
  try {
    Blockly.serialization.workspaces.load({blocks:{languageVersion:0,blocks},variables},workspace);
    const template=generate(workspace);
    const python=spawnSync('uv',['run','python','-c','import json,sys; from dev.server import environment; d=json.load(sys.stdin); print(json.dumps(environment(d["snapshot"]).from_string(d["template"]).render(**d["context"])))'],{input:JSON.stringify({template,snapshot,context}),encoding:'utf8'});
    assert.equal(python.status,0,`${template}\n${python.stderr}`);
    return JSON.parse(python.stdout);
  } finally { workspace.dispose(); }
}

test('arithmetic preserves precedence around filters and nested operators',()=>{
  const multiply={type:'math_arithmetic',fields:{OP:'MULTIPLY'},inputs:inputs({A:{type:'math_arithmetic',fields:{OP:'ADD'},inputs:inputs({A:n(2),B:n(3)})},B:n(4)})};
  assert.equal(render([output(multiply)]),'20');
  const state={type:'ha_number',fields:{ENTITY:'sensor.temperature',DEFAULT:0}};
  assert.equal(render([output({type:'math_arithmetic',fields:{OP:'ADD'},inputs:inputs({A:state,B:n(2)})})]),'24.5');
});

test('string operations quote user text and preserve newlines and Jinja-like literals',()=>{
  assert.equal(render([{type:'tb_literal',fields:{TEXT:'Hello {{ unsafe }}\n"quoted"'}}]),'Hello {{ unsafe }}\n"quoted"');
  assert.equal(render([output({type:'tb_replace',inputs:inputs({VALUE:text('hello world'),OLD:text('world'),NEW:text('HA')})})]),'hello HA');
  assert.equal(render([output({type:'tb_split',inputs:inputs({VALUE:text('a,b'),SEP:text(',')})})]),"['a', 'b']");
});

test('rounding supports decimal precision for nearest, ceiling and floor',()=>{
  for(const [op,precision,value,expected] of [
    ['ROUND',2,12.345,'12.35'],
    ['ROUNDUP',2,12.341,'12.35'],
    ['ROUNDDOWN',2,12.349,'12.34'],
    ['ROUND',0,12.345,'12.0'],
    ['ROUND',-1,123.45,'120.0'],
  ]){
    assert.equal(render([output({type:'math_round',fields:{OP:op,PRECISION:precision},inputs:inputs({NUM:n(value)})})]),expected);
  }
});

test('existing round blocks without a precision field still round to whole numbers',()=>{
  assert.equal(render([output({type:'math_round',fields:{OP:'ROUND'},inputs:inputs({NUM:n(12.345)})})]),'12.0');
});

test('if/else produces only the chosen branch without formatting whitespace',()=>{
  const block={type:'controls_if',extraState:{hasElse:true},inputs:inputs({IF0:{type:'logic_boolean',fields:{BOOL:'FALSE'}},DO0:output(text('yes')),ELSE:output(text('no'))})};
  assert.equal(render([block]),'no');
});

test('variables accumulate across loop iterations using a Jinja namespace',()=>{
  const variable={id:'total-id',name:'total'}, item={id:'item-id',name:'item'};
  const get=v=>({type:'variables_get',fields:{VAR:v}});
  const loop={type:'controls_forEach',fields:{VAR:item},inputs:inputs({LIST:raw('[1, 2, 3]'),DO:{type:'variables_set',fields:{VAR:variable},inputs:inputs({VALUE:{type:'math_arithmetic',fields:{OP:'ADD'},inputs:inputs({A:get(variable),B:get(item)})}})}}),next:{block:output(get(variable))}};
  const start={type:'variables_set',fields:{VAR:variable},inputs:inputs({VALUE:n(0)}),next:{block:loop}};
  assert.equal(render([start],[variable,item]),'6');
});

test('prime checks correctly distinguish primes, squares, negatives and fractions',()=>{
  for(const [value,expected] of [[2,'True'],[17,'True'],[49,'False'],[1,'False'],[-3,'False'],[2.5,'False']]){
    assert.equal(render([output({type:'math_number_property',fields:{PROPERTY:'PRIME'},inputs:inputs({NUMBER_TO_CHECK:n(value)})})]),expected);
  }
});

test('population standard deviation generates a self-contained macro',()=>{
  assert.equal(render([output({type:'math_on_list',fields:{OP:'STD_DEV'},inputs:inputs({LIST:raw('[2,4,4,4,5,5,7,9]')})})]),'2.0');
});

test('slice, dict, arbitrary filters and generic functions produce native Jinja',()=>{
  assert.equal(render([output({type:'tb_slice',inputs:inputs({VALUE:text('abcdef'),START:n(1),END:n(4)})})]),'bcd');
  assert.equal(render([output({type:'tb_dict',inputs:inputs({PAIRS:raw('[("room", "study")]')})})]),"{'room': 'study'}");
  assert.equal(render([output({type:'tb_call',fields:{FUNCTION:'range'},inputs:inputs({ARGS:raw('[1,4]')})})]),'range(1, 4)');
});

test('all shipped examples compile and render against HA-like states',()=>{
  for(const create of Object.values(examples)) {
    const data=create(snapshot.states);
    assert.equal(typeof render(data.blocks.blocks,data.variables,{forecasts:{'weather.home':{forecast:[{temperature:20}]}}}),'string');
  }
});

test('every toolbox block has a Jinja generator and can be instantiated',()=>{
  const w=new Blockly.Workspace();
  try{for(const category of toolbox.contents)for(const entry of category.contents||[]){if(entry.kind!=='block')continue;assert.ok(Blockly.Blocks[entry.type],entry.type);w.newBlock(entry.type);}}
  finally{w.dispose();}
});
