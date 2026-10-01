import * as BlocklyModule from 'blockly/core';
import 'blockly/blocks';
import * as En from 'blockly/msg/en';

// Blockly exposes CommonJS to Node and ESM to browser bundlers.
const Blockly = Reflect.get(BlocklyModule, 'default') ?? BlocklyModule;

Blockly.setLocale(En);

// Keep Blockly's block type so saved workspaces retain their round blocks.
const initializeRound = Blockly.Blocks.math_round.init;
Blockly.Blocks.math_round.init = function() {
  initializeRound.call(this);
  this.appendDummyInput('PRECISION_INPUT')
    .appendField('to')
    .appendField(new Blockly.FieldNumber(0, undefined, undefined, 1), 'PRECISION')
    .appendField('decimal places');
  this.setInputsInline(true);
  this.setTooltip('Round to the selected number of decimal places. Negative precision rounds to tens, hundreds, etc.');
};

let entityStates = {};
let selectField;
export const setEntities = states => { entityStates = Object.fromEntries(states.map(s => [s.entity_id, s])); };
export const setFieldPicker = picker => { selectField = picker; };
export const entityInfo = id => entityStates[id];

class EntityField extends Blockly.FieldTextInput {
  showEditor_() { selectField?.(this, 'entity'); }
  getText() { return entityStates[this.getValue()]?.attributes.friendly_name || this.getValue() || 'Choose entity…'; }
  static fromJson(options) { return new EntityField(options.text || ''); }
}
class StateField extends Blockly.FieldTextInput {
  showEditor_() { selectField?.(this, 'state'); }
  static fromJson(options) { return new StateField(options.text || 'on'); }
}
class AttributeField extends Blockly.FieldTextInput {
  showEditor_() { selectField?.(this, 'attribute'); }
  static fromJson(options) { return new AttributeField(options.text || 'friendly_name'); }
}
class ResponseField extends Blockly.FieldTextInput {
  showEditor_() { selectField?.(this, 'response'); }
  static fromJson() { return new ResponseField('Configure / browse…'); }
}
class ActionField extends Blockly.FieldTextInput {
  showEditor_() { selectField?.(this, 'action'); }
  static fromJson(options) { return new ActionField(options.text || 'weather.get_forecasts'); }
}
class IconField extends Blockly.FieldTextInput {
  showEditor_() { selectField?.(this, 'icon'); }
  static fromJson(options) { return new IconField(options.text || 'mdi:lightbulb'); }
}
class ColorField extends Blockly.FieldTextInput {
  showEditor_() { selectField?.(this, 'color'); }
  static fromJson(options) { return new ColorField(options.text || '#ff9800'); }
}
Blockly.fieldRegistry.register('field_ha_entity', EntityField);
Blockly.fieldRegistry.register('field_ha_state', StateField);
Blockly.fieldRegistry.register('field_ha_attribute', AttributeField);
Blockly.fieldRegistry.register('field_ha_response', ResponseField);
Blockly.fieldRegistry.register('field_ha_action', ActionField);
Blockly.fieldRegistry.register('field_tb_icon', IconField);
Blockly.fieldRegistry.register('field_tb_color', ColorField);

const value = name => ({ type: 'input_value', name });
const text = (name, initial = '') => ({ type: 'field_input', name, text: initial });
const dropdown = (name, options) => ({ type: 'field_dropdown', name, options });
const expression = (type, message0, args0, colour = 205, tooltip = '') => ({type, message0, args0, output: null, colour, tooltip, inputsInline: true});
const statement = (type, message0, args0, colour = 25, tooltip = '') => ({type, message0, args0, previousStatement: null, nextStatement: null, colour, tooltip});
const entity = { type: 'field_ha_entity', name: 'ENTITY', text: '' };

Blockly.defineBlocksWithJsonArray([
  expression('ha_state', 'state of %1', [entity], 190, 'Select an entity by its name, domain or ID. States are strings; use the number block for maths.'),
  expression('ha_number', 'number from %1 default %2', [entity, {type:'field_number', name:'DEFAULT', value:0}], 190, 'Convert an entity state to a number, with a fallback for unavailable/non-numeric values.'),
  expression('ha_attribute', '%1 attribute %2', [entity, {type:'field_ha_attribute',name:'ATTRIBUTE',text:'friendly_name'}], 190),
  {type:'ha_action_response',message0:'action %1',args0:[{type:'field_ha_action',name:'ACTION',text:'weather.get_forecasts'}],message1:'on %1',args1:[entity],message2:'response %1 %2',args2:[text('RESPONSE','forecasts'),{type:'field_ha_response',name:'PICKER'}],output:null,colour:190,inputsInline:false,tooltip:'Click the action name to choose an available action. Configure an action, explicitly fetch a sample, and browse its response. Copy the required action YAML alongside your template.'},
  expression('ha_is_state', '%1 is %2', [entity, {type:'field_ha_state',name:'STATE',text:'on'}], 190, 'Entity and state pickers. Returns true or false.'),
  expression('ha_has_value', '%1 is available', [entity], 190),
  expression('ha_dynamic_state', 'state of entity ID %1', [value('ENTITY')], 190),
  expression('ha_entities', 'entities in %1', [dropdown('DOMAIN', [['all domains','all'],['sensors','sensor'],['binary sensors','binary_sensor'],['lights','light'],['switches','switch'],['climate','climate'],['people','person'],['covers','cover'],['media players','media_player'],['input booleans','input_boolean']])], 190, 'A list of state objects. Use object property blocks to read entity_id, state or attributes.'),
  expression('ha_now', '%1', [dropdown('KIND',[['local time now','now'],['UTC time now','utcnow']])], 190),
  statement('tb_output', 'output %1', [value('VALUE')], 25, 'Add an expression to the rendered template. Connect outputs to concatenate them.'),
  statement('tb_literal', 'write text %1', [text('TEXT','Hello')], 25, 'Literal text: spaces and newlines are preserved, including any Jinja-looking text.'),
  expression('tb_icon','icon %1',[{type:'field_tb_icon',name:'ICON',text:'mdi:lightbulb'}],25,'Select a Material Design Icon. Outputs an mdi:… string for an icon template; works in conditions and variables too.'),
  expression('tb_color','color %1 as %2',[{type:'field_tb_color',name:'COLOR',text:'#ff9800'},dropdown('FORMAT',[['hex color','hex'],['RGB list','rgb']])],25,'Pick a color. Outputs a hex string or an RGB list. Whether a destination accepts color templates depends on its integration/card.'),
  expression('tb_filter', '%1 → filter %2 arguments %3', [value('VALUE'),text('FILTER','round'),text('ARGS','')], 270, 'Any Jinja or Home Assistant filter. Arguments are Jinja expressions, e.g. 2 or ", ". Chain filters by connecting blocks.'),
  expression('tb_test', '%1 is %2 arguments %3', [value('VALUE'),text('TEST','number'),text('ARGS','')], 210, 'Any Jinja test, such as defined, number, string, iterable, equalto or match.'),
  expression('tb_call', 'call %1 with arguments %2', [text('FUNCTION','range'),value('ARGS')], 270, 'Pass a list of arguments. Supports Jinja globals and Home Assistant functions such as range, dict, expand, area_entities or as_timestamp.'),
  expression('tb_property', '%1 property / key %2', [value('VALUE'),text('KEY','state')], 160),
  expression('tb_index', '%1 at index %2', [value('VALUE'),value('INDEX')], 160, 'Zero-based indexing, including negative indices. Works for strings, lists and dictionaries.'),
  expression('tb_slice', 'slice %1 from %2 to %3', [value('VALUE'),value('START'),value('END')], 160),
  expression('tb_concat', 'join %1 with %2', [value('A'),value('B')], 160, 'Jinja ~ operator: converts both inputs to strings before joining.'),
  expression('tb_replace', 'in %1 replace %2 with %3', [value('VALUE'),value('OLD'),value('NEW')], 160),
  expression('tb_split', 'split %1 at %2', [value('VALUE'),value('SEP')], 160),
  expression('tb_join', 'join list %1 using %2', [value('VALUE'),value('SEP')], 160),
  expression('tb_contains', '%1 contains %2', [value('VALUE'),value('ITEM')], 210),
  expression('tb_range', 'numbers from %1 to %2 step %3', [value('START'),value('END'),value('STEP')], 120, 'End is exclusive, as in Jinja/Python range.'),
  expression('tb_loop_info', 'loop %1', [dropdown('PROPERTY',[['index (1-based)','index'],['index (0-based)','index0'],['first iteration','first'],['last iteration','last'],['length','length'],['previous item','previtem'],['next item','nextitem']])], 120, 'Use inside a for-each block.'),
  expression('tb_pair', 'key %1 value %2', [value('KEY'),value('VALUE')], 160),
  expression('tb_dict', 'dictionary from pairs %1', [value('PAIRS')], 160),
  expression('tb_raw_expression', 'Jinja expression %1', [text('CODE', 'none')], 290, 'Escape hatch for any Jinja expression. Do not include {{ }}.'),
  statement('tb_raw_statement', 'Jinja statement / template %1', [text('CODE', '{% set example = 1 %}')], 290, 'Advanced escape hatch: inserted verbatim. Use for macros, imports and other arbitrary Jinja syntax.'),
]);

const initializeActionResponse=Blockly.Blocks.ha_action_response.init;
Blockly.Blocks.ha_action_response.init=function() {
  initializeActionResponse.call(this);
  this.appendDummyInput('ACTION_DATA').appendField(new Blockly.FieldTextInput('{"type":"hourly"}'),'DATA').setVisible(false);
};
Blockly.Blocks.ha_action_response.saveExtraState = function() { return this.responseSample || null; };
Blockly.Blocks.ha_action_response.loadExtraState = function(state) { this.responseSample = state; };

export const toolbox = {
  kind: 'categoryToolbox',
  contents: [
    {kind:'category',name:'Output',colour:'#cf7a30',contents:['tb_output','tb_literal','tb_icon','tb_color'].map(block)},
    {kind:'category',name:'Home Assistant',colour:'#249fa5',contents:['ha_state','ha_number','ha_attribute','ha_action_response','ha_is_state','ha_has_value','ha_dynamic_state','ha_entities','ha_now'].map(block)},
    {kind:'category',name:'Logic',colour:'#597fc0',contents:['controls_if','logic_compare','logic_operation','logic_negate','logic_boolean','logic_null','logic_ternary','tb_contains','tb_test'].map(block)},
    {kind:'category',name:'Loops',colour:'#66a154',contents:['controls_forEach','tb_range','tb_loop_info'].map(block)},
    {kind:'category',name:'Maths',colour:'#667cc4',contents:['math_number','math_arithmetic','math_single','math_round','math_modulo','math_constrain','math_constant','math_trig','math_on_list','math_number_property'].map(block)},
    {kind:'category',name:'Text & lists',colour:'#409a79',contents:['text','tb_concat','tb_replace','tb_split','tb_join','text_length','text_isEmpty','lists_create_with','lists_length','lists_isEmpty','tb_index','tb_slice','tb_property','tb_pair','tb_dict'].map(block)},
    {kind:'category',name:'Variables',colour:'#a45b9b',custom:'VARIABLE'},
    {kind:'category',name:'Jinja & filters',colour:'#9365ba',contents:[
      {kind:'label',text:'Connect filters into a chain'},
      ...['float','int','round','default','lower','upper','trim','replace','join','length','sum','min','max','sort','unique','map','select','reject','selectattr','rejectattr','list','tojson','regex_replace','timestamp_custom'].map(f=>({kind:'block',type:'tb_filter',fields:{FILTER:f}})),
      block('tb_call'),block('tb_raw_expression'),block('tb_raw_statement'),
    ]},
  ],
};
function block(type) { return {kind:'block',type}; }

export const BlocklyCore = Blockly;
