import {test} from 'node:test';
import assert from 'node:assert/strict';
import {actionCatalog,filterActions,actionFields,actionDefaults} from '../frontend/action-catalog.js';

const services={
  weather:{get_forecasts:{name:'Get forecasts',description:'Retrieve hourly or daily weather',response:{optional:false},fields:{type:{required:true,default:'daily',description:'Forecast interval',selector:{select:{options:['daily',{value:'hourly',label:'Hourly'}]}}}}}},
  calendar:{get_events:{response:{optional:false},fields:{dates:{fields:{start_date_time:{required:true},end_date_time:{}}}}}},
  script:{report:{name:'Device report',response:{optional:true}}},
  light:{turn_on:{name:'Turn on',fields:{brightness:{default:0}}}},
};

test('catalog lists registered actions and distinguishes required, optional and no response',()=>{
  const catalog=actionCatalog(services);
  assert.equal(catalog.length,4);
  assert.equal(filterActions(catalog).length,3);
  assert.equal(catalog.find(action=>action.id==='script.report').optionalResponse,true);
  assert.equal(catalog.find(action=>action.id==='light.turn_on').response,false);
  assert.equal(filterActions(catalog,{responseOnly:false}).length,4);
});
test('search matches IDs, names and descriptions, with integration filtering',()=>{
  const catalog=actionCatalog(services);
  assert.deepEqual(filterActions(catalog,{query:'hourly weather'}).map(action=>action.id),['weather.get_forecasts']);
  assert.deepEqual(filterActions(catalog,{query:'DEVICE report'}).map(action=>action.id),['script.report']);
  assert.deepEqual(filterActions(catalog,{domain:'calendar'}).map(action=>action.id),['calendar.get_events']);
  assert.deepEqual(filterActions(catalog,{domain:'light'}),[]);
});
test('names fall back gracefully when HA omits service translations',()=>{
  const calendar=actionCatalog(services).find(action=>action.domain==='calendar');
  assert.equal(calendar.name,'Get events');
  assert.equal(calendar.description,'');
  const translated=actionCatalog(services,key=>key==='component.calendar.services.get_events.name'?'Read calendar':null);
  assert.equal(translated.find(action=>action.domain==='calendar').name,'Read calendar');
});
test('field guides include sectioned fields and only declared defaults, including falsey values',()=>{
  const catalog=actionCatalog(services);
  assert.deepEqual(actionFields(catalog.find(action=>action.domain==='calendar')).map(field=>[field.key,field.required]),[['start_date_time',true],['end_date_time',false]]);
  assert.deepEqual(actionDefaults(catalog.find(action=>action.domain==='weather')),{type:'daily'});
  assert.deepEqual(actionFields(catalog.find(action=>action.domain==='weather'))[0].options,['daily','hourly']);
  assert.deepEqual(actionDefaults(catalog.find(action=>action.domain==='light')),{brightness:0});
  assert.deepEqual(actionDefaults(catalog.find(action=>action.domain==='calendar')),{});
});
