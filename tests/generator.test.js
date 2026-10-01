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

test('lazy filters produce usable lists rather than generator representations',()=>{
  const filter=(name,value,args='')=>({type:'tb_filter',fields:{FILTER:name,ARGS:args},inputs:inputs({VALUE:raw(value)})});
  for(const [name,value,args,expected] of [
    ['map','["1", "2"]','"int"','[1, 2]'],
    ['select','[1, 2, 3]','"odd"','[1, 3]'],
    ['reject','[1, 2, 3]','"odd"','[2]'],
    ['selectattr','[{"x": 1}, {"x": 2}]','"x", "equalto", 2',"[{'x': 2}]"],
    ['rejectattr','[{"x": 1}, {"x": 2}]','"x", "equalto", 2',"[{'x': 1}]"],
    ['unique','[1, 1, 2]','','[1, 2]'],
    ['batch','[1, 2, 3]','2','[[1, 2], [3]]'],
    ['slice','[1, 2, 3, 4]','2','[[1, 2], [3, 4]]'],
  ])assert.equal(render([output(filter(name,value,args))]),expected,name);
});

test('map composes existing unary filters and attribute operations without duplicate operators',()=>{
  const map=(list,op)=>({type:'tb_map',inputs:inputs({LIST:raw(list),OP:op})});
  assert.equal(render([output(map('["hello", "world"]',{type:'tb_filter',fields:{FILTER:'upper'}}))]),"['HELLO', 'WORLD']");
  assert.equal(render([output(map('[{"x": 2}, {"x": 4}]',{type:'tb_property',fields:{KEY:'x'}}))]),'[2, 4]');
  assert.equal(render([output(map('[1.234, 2.345]',{type:'math_round',fields:{OP:'ROUND',PRECISION:1}}))]),'[1.2, 2.3]');
});

test('filter composes boolean predicates and map/filter remain native values in a chain',()=>{
  const map={type:'tb_map',inputs:inputs({LIST:raw('[1, 2, 3]'),OP:{type:'math_arithmetic',fields:{OP:'MULTIPLY'},inputs:inputs({A:{type:'tb_item'},B:n(2)})}})};
  const predicate={type:'logic_compare',fields:{OP:'GT'},inputs:inputs({A:{type:'tb_item'},B:n(2)})};
  assert.equal(render([output({type:'tb_filter_list',inputs:inputs({LIST:map,PREDICATE:predicate})})]),'[4, 6]');
  assert.equal(render([output({type:'tb_filter_list',inputs:inputs({LIST:raw('[1, 2, 3, 4]'),PREDICATE:{type:'math_number_property',fields:{PROPERTY:'EVEN'}}})})]),'[2, 4]');
  const states={type:'ha_entities',fields:{DOMAIN:'light'}};
  const on={type:'logic_compare',fields:{OP:'EQ'},inputs:inputs({A:{type:'tb_property',fields:{KEY:'state'}},B:text('on')})};
  const filtered={type:'tb_filter_list',inputs:inputs({LIST:states,PREDICATE:on})};
  assert.equal(render([output({type:'tb_map',inputs:inputs({LIST:filtered,OP:{type:'tb_property',fields:{KEY:'entity_id'}}})})]),"['light.study']");
});

test('nested maps scope current item and collection prerequisites execute inside loops',()=>{
  const inner={type:'tb_map',inputs:inputs({LIST:{type:'tb_item'},OP:{type:'math_single',fields:{OP:'ABS'}}})};
  assert.equal(render([output({type:'tb_map',inputs:inputs({LIST:raw('[[-1, 2], [-3]]'),OP:inner})})]),'[[1, 2], [3]]');
  const item={id:'list-id',name:'xs'};
  const mapped={type:'tb_map',inputs:inputs({LIST:{type:'variables_get',fields:{VAR:item}},OP:{type:'math_single',fields:{OP:'ABS'}}})};
  const loop={type:'controls_forEach',fields:{VAR:item},inputs:inputs({LIST:raw('[[-1], [-2]]'),DO:output(mapped)})};
  assert.equal(render([loop],[item]),'[1][2]');
});

test('collection-building in an elif condition stays lazy and in the correct branch',()=>{
  const unsafe={type:'tb_map',inputs:inputs({LIST:raw('undefined_list'),OP:{type:'tb_item'}})};
  const block={type:'controls_if',extraState:{elseIfCount:1},inputs:inputs({IF0:{type:'logic_boolean',fields:{BOOL:'TRUE'}},DO0:output(text('ok')),IF1:{type:'logic_compare',fields:{OP:'GT'},inputs:inputs({A:{type:'lists_length',inputs:inputs({VALUE:unsafe})},B:n(0)})},DO1:output(text('bad'))})};
  assert.equal(render([block]),'ok');
});

test('maps inside conditional expressions and boolean operations preserve short-circuit evaluation',()=>{
  const unsafe={type:'tb_map',inputs:inputs({LIST:raw('undefined_list'),OP:{type:'tb_item'}})};
  assert.equal(render([output({type:'logic_ternary',inputs:inputs({IF:{type:'logic_boolean',fields:{BOOL:'TRUE'}},THEN:text('ok'),ELSE:unsafe})})]),'ok');
  const unsafeTest={type:'tb_test',fields:{TEST:'iterable'},inputs:inputs({VALUE:unsafe})};
  assert.equal(render([output({type:'logic_operation',fields:{OP:'OR'},inputs:inputs({A:{type:'logic_boolean',fields:{BOOL:'TRUE'}},B:unsafeTest})})]),'True');
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
