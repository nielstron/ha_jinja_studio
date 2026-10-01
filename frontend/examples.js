const literal = text => ({type:'text',fields:{TEXT:text}});
const num = value => ({type:'math_number',fields:{NUM:value}});
const output = value => ({type:'tb_output',inputs:{VALUE:{block:value}}});
const reading = entities => entities.find(e=>e.entity_id.startsWith('sensor.')&&e.attributes.unit_of_measurement==='°C') || entities.find(e=>e.entity_id.startsWith('sensor.')&&Number.isFinite(Number(e.state))) || entities[0];
const workspace = (blocks,variables=[]) => ({blocks:{languageVersion:0,blocks:blocks.map((b,i)=>({...b,x:60,y:50+i*180}))},variables});
const whenLightOn=(entities,yes,no)=>({type:'logic_ternary',inputs:{IF:{block:{type:'ha_is_state',fields:{ENTITY:entities.find(e=>e.entity_id.startsWith('light.'))?.entity_id||'light.living_room',STATE:'on'}}},THEN:{block:yes},ELSE:{block:no}}});

export const examples = {
  'Forecast-aware heating (demo)': entities => {
    const weather=entities.find(e=>e.entity_id.startsWith('weather.'))?.entity_id||'weather.home';
    const thermostat=entities.find(e=>e.entity_id.startsWith('climate.') && typeof e.attributes.temperature==='number')?.entity_id||'climate.study';
    const count={id:'cold-hours',name:'cold_hours'},hour={id:'forecast-hour',name:'hour'};
    const get=variable=>({type:'variables_get',fields:{VAR:variable}});
    const prop=(value,key)=>({type:'tb_property',fields:{KEY:key},inputs:{VALUE:{block:value}}});
    const forecast={type:'ha_action_response',id:'demo-forecast-source',fields:{ACTION:'weather.get_forecasts',ENTITY:weather,DATA:'{"type":"hourly"}',RESPONSE:'forecasts'},extraState:{signature:JSON.stringify(['weather.get_forecasts',weather,{type:'hourly'}]),value:{[weather]:{forecast:[18.5,17.2,16.9,19.4,20.6,21.8].map((temperature,i)=>({datetime:`2026-10-01T${String(i+12).padStart(2,'0')}:00:00+00:00`,temperature}))}}}};
    const weatherResult=prop(forecast,weather),hours=prop(weatherResult,'forecast');
    weatherResult.data=hours.data=JSON.stringify({attributeRoot:forecast.id});weatherResult.inputsInline=hours.inputsInline=false;
    const threshold={type:'math_arithmetic',fields:{OP:'MINUS'},inputs:{A:{block:{type:'ha_attribute',fields:{ENTITY:thermostat,ATTRIBUTE:'temperature'}}},B:{block:num(2)}}};
    const cold={type:'logic_compare',fields:{OP:'LT'},inputs:{A:{block:prop(get(hour),'temperature')},B:{block:threshold}}};
    const result=output({type:'logic_ternary',inputs:{IF:{block:{type:'logic_compare',fields:{OP:'GTE'},inputs:{A:{block:get(count)},B:{block:num(2)}}}},THEN:{block:{type:'tb_icon',fields:{ICON:'mdi:radiator'}}},ELSE:{block:{type:'tb_icon',fields:{ICON:'mdi:radiator-off'}}}}});
    const loop={type:'controls_forEach',id:'forecast-loop',fields:{VAR:hour},inputs:{LIST:{block:hours},DO:{block:{type:'controls_if',inputs:{IF0:{block:cold},DO0:{block:{type:'math_change',fields:{VAR:count},inputs:{DELTA:{block:num(1)}}}}}}}},next:{block:result}};
    return workspace([{type:'variables_set',fields:{VAR:count},inputs:{VALUE:{block:num(0)}},next:{block:loop}}],[count,hour]);
  },
  'Conditional icon': entities=>workspace([output(whenLightOn(entities,{type:'tb_icon',fields:{ICON:'mdi:lightbulb-on'}},{type:'tb_icon',fields:{ICON:'mdi:lightbulb-outline'}}))]),
  'Conditional color': entities=>workspace([output(whenLightOn(entities,{type:'tb_color',fields:{COLOR:'#4caf50',FORMAT:'hex'}},{type:'tb_color',fields:{COLOR:'#9e9e9e',FORMAT:'hex'}}))]),
  'Weather forecast (fetch sample)': entities => workspace([output({type:'ha_action_response',fields:{ACTION:'weather.get_forecasts',ENTITY:entities.find(e=>e.entity_id.startsWith('weather.'))?.entity_id||'weather.home',DATA:'{"type":"hourly"}',RESPONSE:'forecasts'}})]),
  'Entity value': entities => workspace([output({type:'ha_number',fields:{ENTITY:reading(entities)?.entity_id||'sensor.temperature',DEFAULT:0}})]),
  'Maths & rounding': entities => workspace([output({type:'tb_filter',fields:{FILTER:'round',ARGS:'1'},inputs:{VALUE:{block:{type:'math_arithmetic',fields:{OP:'MULTIPLY'},inputs:{A:{block:{type:'ha_number',fields:{ENTITY:reading(entities)?.entity_id||'sensor.temperature',DEFAULT:0}}},B:{block:num(1.8)}}}}}})]),
  'If / else': entities => workspace([{type:'controls_if',extraState:{hasElse:true},inputs:{IF0:{block:{type:'ha_is_state',fields:{ENTITY:entities.find(s=>s.entity_id.startsWith('light.'))?.entity_id||entities[0]?.entity_id||'light.living_room',STATE:'on'}}},DO0:{block:output(literal('The light is on'))},ELSE:{block:output(literal('The light is off'))}}}]),
  'Loop over lights': () => workspace([{type:'controls_forEach',fields:{VAR:{id:'light-item',name:'light'}},inputs:{LIST:{block:{type:'ha_entities',fields:{DOMAIN:'light'}}},DO:{block:output({type:'tb_concat',inputs:{A:{block:{type:'tb_property',fields:{KEY:'entity_id'},inputs:{VALUE:{block:{type:'variables_get',fields:{VAR:{id:'light-item',name:'light'}}}}}}},B:{block:literal('\n')}}})}}}], [{id:'light-item',name:'light'}]),
  'String manipulation': entities => workspace([output({type:'tb_filter',fields:{FILTER:'upper',ARGS:''},inputs:{VALUE:{block:{type:'ha_attribute',fields:{ENTITY:reading(entities)?.entity_id||'sensor.temperature',ATTRIBUTE:'friendly_name'}}}}})]),
};
