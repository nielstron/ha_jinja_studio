import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseArguments,filterDefinition,argumentValue,encodeArguments} from '../frontend/filter-arguments.js';

const catalog={filters:[{name:'map',parameters:[],variadic:[]},{name:'selectattr',parameters:[],variadic:[]},{name:'round',parameters:[{name:'precision',required:false,positional:false,default:'0'},{name:'method',required:false,positional:false,default:'"common"'}],variadic:[]}]};
test('argument parsing preserves nested expressions, commas and equals in quoted text',()=>{
  assert.deepEqual(parseArguments('"a,b=c", [1, 2], attribute="attributes.x", default={"a": [3, 4]}'),{positional:['"a,b=c"','[1, 2]'],named:{attribute:'"attributes.x"',default:'{"a": [3, 4]}'}});
  assert.throws(()=>parseArguments('attribute="oops'),/Unbalanced/);
});
test('map explicitly separates attribute selection from per-item filter arguments',()=>{
  const definition=filterDefinition(catalog,'map','attribute');
  assert.deepEqual(definition.parameters.map(p=>p.name),['attribute','default']);
  assert.equal(encodeArguments(definition,{attribute:{type:'text',value:'attributes.temperature'},default:{type:'number',value:'0'}}),'attribute="attributes.temperature", default=0');
  const filter=filterDefinition(catalog,'map','filter','round');
  assert.equal(encodeArguments(filter,{filter:{type:'text',value:'round'},precision:{type:'number',value:'2'}}),'"round", precision=2');
  assert.throws(()=>filterDefinition(catalog,'map','filter','map'),/Chain another/);
});
test('typed argument fields quote strings and preserve numbers, booleans and expressions',()=>{
  assert.deepEqual(argumentValue('"state"'),{type:'text',value:'state'});
  assert.deepEqual(argumentValue('false'),{type:'boolean',value:'false'});
  assert.equal(encodeArguments(filterDefinition(catalog,'round'),{precision:{type:'number',value:'2'},method:{type:'text',value:'ceil'}}),'precision=2, method="ceil"');
  assert.equal(encodeArguments(filterDefinition(catalog,'round'),{precision:{type:'number',value:'2',enabled:false}}),'');
  assert.equal(encodeArguments({parameters:[{name:'default',positional:false}],variadic:[]},{default:{type:'text',value:''}}),'default=""');
});
test('selectattr shows attribute, test and value as explicit positional arguments',()=>{
  const definition=filterDefinition(catalog,'selectattr');
  assert.equal(encodeArguments(definition,{attribute:{type:'text',value:'state'},test:{type:'text',value:'equalto'},value:{type:'text',value:'on'}}),'"state", "equalto", "on"');
  assert.throws(()=>encodeArguments(definition,{}),/attribute is required/);
});
