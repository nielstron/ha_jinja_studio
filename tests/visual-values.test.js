import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {BlocklyCore as Blockly} from '../frontend/blocks.js';
import {generate} from '../frontend/generator.js';
import {iconName,hexColor,colorRgb,searchIcons} from '../frontend/visual-values.js';

function render(value,states=[]) {
  const workspace=new Blockly.Workspace();
  try{
    Blockly.serialization.workspaces.load({blocks:{languageVersion:0,blocks:[{type:'tb_output',inputs:{VALUE:{block:value}}}]}},workspace);
    const template=generate(workspace);
    const result=spawnSync('uv',['run','python','-c','import json,sys; from dev.server import environment; d=json.load(sys.stdin); print(environment({"states":d["states"]}).from_string(d["template"]).render())'],{input:JSON.stringify({template,states}),encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);return result.stdout.trim();
  }finally{workspace.dispose();}
}

test('icon blocks emit HA-compatible names and color blocks emit hex strings or RGB lists',()=>{
  assert.equal(render({type:'tb_icon',fields:{ICON:'mdi:weather-sunny'}}),'mdi:weather-sunny');
  assert.equal(render({type:'tb_color',fields:{COLOR:'#FF9800',FORMAT:'hex'}}),'#ff9800');
  assert.equal(render({type:'tb_color',fields:{COLOR:'#ff9800',FORMAT:'rgb'}}),'[255, 152, 0]');
});
test('icon and color outputs compose with conditions instead of executing any actions',()=>{
  const conditional=(yes,no)=>({type:'logic_ternary',inputs:{IF:{block:{type:'ha_is_state',fields:{ENTITY:'light.study',STATE:'on'}}},THEN:{block:yes},ELSE:{block:no}}});
  const icon=value=>({type:'tb_icon',fields:{ICON:value}}),color=value=>({type:'tb_color',fields:{COLOR:value}});
  const states=state=>[{entity_id:'light.study',state,attributes:{}}];
  assert.equal(render(conditional(icon('mdi:lightbulb-on'),icon('mdi:lightbulb-outline')),states('on')),'mdi:lightbulb-on');
  assert.equal(render(conditional(icon('mdi:lightbulb-on'),icon('mdi:lightbulb-outline')),states('off')),'mdi:lightbulb-outline');
  assert.equal(render(conditional(color('#4caf50'),color('#9e9e9e')),states('off')),'#9e9e9e');
});
test('picker values normalize precisely and reject invalid icon/color values',()=>{
  assert.equal(iconName(' MDI:Lightbulb '),'mdi:lightbulb');
  assert.equal(hexColor('#f80'),'#ff8800');assert.deepEqual(colorRgb('#000'),[0,0,0]);
  assert.throws(()=>iconName('mdi:bad"name'),/MDI icon/);
  assert.throws(()=>hexColor('red; background:url(x)'),/hex color/);
});
test('icon search includes aliases/categories, ranks exact names first and never mutates the catalog',()=>{
  const icons=[{name:'lightbulb-outline',aliases:[],tags:['Lighting']},{name:'lightbulb',aliases:['idea'],tags:['Lighting']},{name:'home',aliases:['house'],tags:['Buildings']}];
  assert.equal(searchIcons(icons,'mdi:lightbulb')[0].name,'lightbulb');
  assert.equal(searchIcons(icons,'idea lighting')[0].name,'lightbulb');
  assert.equal(searchIcons(icons,'house')[0].name,'home');
  assert.equal(searchIcons(icons)[0].name,'lightbulb');assert.equal(icons[0].name,'lightbulb-outline');
});
test('visual value fields and color format survive workspace export/import',()=>{
  const workspace=new Blockly.Workspace(),restored=new Blockly.Workspace();
  try{
    const color=workspace.newBlock('tb_color');color.setFieldValue('#2196f3','COLOR');color.setFieldValue('rgb','FORMAT');
    const icon=workspace.newBlock('tb_icon');icon.setFieldValue('mdi:robot-vacuum','ICON');
    Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(workspace),restored);
    assert.equal(generate(restored),generate(workspace));
    assert.equal(restored.getAllBlocks().find(b=>b.type==='tb_color').getFieldValue('FORMAT'),'rgb');
  }finally{workspace.dispose();restored.dispose();}
});
test('the MDI dependency contains the example icons and searchable metadata',()=>{
  const metadata=JSON.parse(readFileSync('node_modules/@mdi/svg/meta.json','utf8'));
  for(const name of ['lightbulb-on','lightbulb-outline','weather-sunny','robot-vacuum']){
    assert.ok(metadata.find(icon=>icon.name===name),name);
    assert.match(readFileSync(`node_modules/@mdi/svg/svg/${name}.svg`,'utf8'),/<path d="/);
  }
});
