import { BlocklyCore as Blockly } from './blocks.js';
import { actionConfig } from './action-response.js';
import { iconName, hexColor, colorRgb } from './visual-values.js';

// Parenthesize nested values rather than inheriting Python precedence: Jinja
// filters and exponentiation have different semantics from Python.
export const jinja = new Blockly.CodeGenerator('Jinja');
const ATOMIC = 0;
const NONE = 99;
const quote = value => JSON.stringify(String(value));
const expr = code => [code, ATOMIC];
const tag = code => `{%- ${code} -%}\n`;
const variable = (b,g) => 'ns.' + g.nameDB_.getName(b.getFieldValue('VAR'), Blockly.Names.NameType.VARIABLE);
const unaryInputs = {tb_filter:'VALUE',tb_test:'VALUE',tb_property:'VALUE',tb_index:'VALUE',tb_slice:'VALUE',tb_replace:'VALUE',tb_split:'VALUE',tb_join:'VALUE',lists_length:'VALUE',text_length:'VALUE',lists_isEmpty:'VALUE',text_isEmpty:'VALUE',math_round:'NUM',math_single:'NUM',math_trig:'NUM',math_number_property:'NUMBER_TO_CHECK',math_on_list:'LIST',ha_dynamic_state:'ENTITY',logic_negate:'BOOL'};
const input = (b,g,name,fallback='none') => g.valueToCode(b,name,NONE) || (g.currentItem && unaryInputs[b.type]===name?g.currentItem:fallback);
const group = (b,g,name,fallback='none') => `(${input(b,g,name,fallback)})`;
const lazyFilters = new Set(['map','select','reject','selectattr','rejectattr','unique','batch','slice']);
const temporary = (b,g) => {
  if(!g.temporaryNames.has(b.id))g.temporaryNames.set(b.id,g.temporaryNames.size+1);
  return g.temporaryNames.get(b.id);
};
function evaluate(g,callback) {
  const parent=g.pending;g.pending=[];
  try {const code=callback();return {code,pending:g.pending.join('')};}
  finally {g.pending=parent;}
}

jinja.init = function(workspace) {
  this.nameDB_ = new Blockly.Names('ns,true,false,none,loop,for,if,else,range,dict,set,macro,namespace');
  this.nameDB_.setVariableMap(workspace.getVariableMap());
  this.variables = workspace.getVariableMap().getAllVariables();
  this.variables.forEach(v => this.nameDB_.getName(v.getId(),Blockly.Names.NameType.VARIABLE));
  this.isInitialized = true;
  this.helpers = {};
  this.pending = [];
  this.currentItem = null;
  this.temporaryNames = new Map();
};
jinja.finish = function(code) {
  const names = this.variables.map(v=>this.nameDB_.getName(v.getId(),Blockly.Names.NameType.VARIABLE));
  return Object.values(this.helpers).join('') + (names.length ? tag(`set ns = namespace(${names.map(n=>`${n}=none`).join(', ')})`) : '') + code;
};
jinja.scrubNakedValue = function(code) {const pending=this.pending.join('');this.pending=[];return pending+`{{ ${code} }}`;};
jinja.scrub_ = function(b,code,thisOnly) { return code + (thisOnly ? '' : this.blockToCode(b.nextConnection?.targetBlock())); };

const f = jinja.forBlock;
f.tb_output = (b,g) => `{{ ${input(b,g,'VALUE','""')} }}`;
f.tb_literal = b => `{{ ${quote(b.getFieldValue('TEXT'))} }}`;
f.tb_icon = b => expr(quote(iconName(b.getFieldValue('ICON'))));
f.tb_color = b => expr(b.getFieldValue('FORMAT')==='rgb'?JSON.stringify(colorRgb(b.getFieldValue('COLOR'))):quote(hexColor(b.getFieldValue('COLOR'))));
f.tb_item = (b,g) => {if(!g.currentItem)throw Error('Current item must be inside a map/filter operation.');return expr(g.currentItem);};
function collection(b,g,isFilter) {
  const list=input(b,g,'LIST','[]'),suffix=temporary(b,g);
  const item=`_tb_item_${suffix}`,result=`_tb_list_${suffix}`;
  const parentItem=g.currentItem,parentPending=g.pending;
  let operation,body;
  g.currentItem=item;g.pending=[];
  try {operation=input(b,g,isFilter?'PREDICATE':'OP',isFilter?'true':item);body=g.pending.join('');}
  finally {g.currentItem=parentItem;g.pending=parentPending;}
  g.pending.push(tag(`set ${result} = namespace(items=[])`)+tag(`for ${item} in ${list}`)+body+
    (isFilter?tag(`if ${operation}`):'')+tag(`set ${result}.items = ${result}.items + [${isFilter?item:operation}]`)+
    (isFilter?tag('endif'):'')+tag('endfor'));
  return expr(`${result}.items`);
}
f.tb_map = (b,g) => collection(b,g,false);
f.tb_filter_list = (b,g) => collection(b,g,true);
f.text = b => expr(quote(b.getFieldValue('TEXT')));
f.math_number = b => expr(String(b.getFieldValue('NUM')));
f.logic_boolean = b => expr(b.getFieldValue('BOOL')==='TRUE'?'true':'false');
f.logic_null = () => expr('none');
f.logic_compare = (b,g) => expr(`${group(b,g,'A')} ${{EQ:'==',NEQ:'!=',LT:'<',LTE:'<=',GT:'>',GTE:'>='}[b.getFieldValue('OP')]} ${group(b,g,'B')}`);
f.logic_operation = (b,g) => {
  const a=evaluate(g,()=>group(b,g,'A','false')),right=evaluate(g,()=>group(b,g,'B','false')),and=b.getFieldValue('OP')==='AND';
  if(!right.pending){g.pending.push(a.pending);return expr(`${a.code} ${and?'and':'or'} ${right.code}`);}
  const name=`_tb_bool_${temporary(b,g)}`;
  g.pending.push(a.pending+tag(`set ${name} = namespace(value=${a.code})`)+tag(`if ${and?'':'not '}${name}.value`)+right.pending+tag(`set ${name}.value = ${right.code}`)+tag('endif'));
  return expr(`${name}.value`);
};
f.logic_negate = (b,g) => expr(`not ${group(b,g,'BOOL','false')}`);
f.logic_ternary = (b,g) => {
  const condition=evaluate(g,()=>group(b,g,'IF','false')),yes=evaluate(g,()=>group(b,g,'THEN')),no=evaluate(g,()=>group(b,g,'ELSE'));
  g.pending.push(condition.pending);
  if(!yes.pending&&!no.pending)return expr(`${yes.code} if ${condition.code} else ${no.code}`);
  const name=`_tb_choice_${temporary(b,g)}`;
  g.pending.push(tag(`set ${name} = namespace(value=none)`)+tag(`if ${condition.code}`)+yes.pending+tag(`set ${name}.value = ${yes.code}`)+tag('else')+no.pending+tag(`set ${name}.value = ${no.code}`)+tag('endif'));
  return expr(`${name}.value`);
};
f.math_arithmetic = (b,g) => expr(`${group(b,g,'A','0')} ${{ADD:'+',MINUS:'-',MULTIPLY:'*',DIVIDE:'/',POWER:'**'}[b.getFieldValue('OP')]} ${group(b,g,'B','0')}`);
f.math_modulo = (b,g) => expr(`${group(b,g,'DIVIDEND','0')} % ${group(b,g,'DIVISOR','1')}`);
f.math_round = (b,g) => expr(`${group(b,g,'NUM','0')} | round(${b.getFieldValue('PRECISION')}, '${{ROUND:'common',ROUNDUP:'ceil',ROUNDDOWN:'floor'}[b.getFieldValue('OP')]}')`);
f.math_single = (b,g) => {
  const n=group(b,g,'NUM','0');
  return expr({ROOT:`${n} ** 0.5`,ABS:`${n} | abs`,NEG:`-${n}`,LN:`${n} | log`,LOG10:`${n} | log(10)`,EXP:`e ** ${n}`,POW10:`10 ** ${n}`}[b.getFieldValue('OP')]);
};
f.math_constant = b => expr({PI:'pi',E:'e',GOLDEN_RATIO:'((1 + 5 ** 0.5) / 2)',SQRT2:'(2 ** 0.5)',SQRT1_2:'(0.5 ** 0.5)',INFINITY:'("inf" | float)'}[b.getFieldValue('CONSTANT')]);
f.math_trig = (b,g) => {
  const n=group(b,g,'NUM','0'), op=b.getFieldValue('OP').toLowerCase();
  return expr(op.startsWith('a') ? `(${n} | ${op}) * 180 / pi` : `(${n} * pi / 180) | ${op}`);
};
f.math_constrain = (b,g) => expr(`([${group(b,g,'VALUE','0')}, ${group(b,g,'LOW','0')}] | max, ${group(b,g,'HIGH','100')}) | min`);
f.math_number_property = (b,g) => {
  const n=group(b,g,'NUMBER_TO_CHECK','0');
  if(b.getFieldValue('PROPERTY')==='PRIME'){
    g.helpers.prime=tag('macro _tb_prime(n)')+tag('set q = namespace(prime=n is number and n == (n | int) and n >= 2)')+tag('if q.prime')+tag('for d in range(2, ((n ** 0.5) | int) + 1)')+tag('if n % d == 0')+tag('set q.prime = false')+tag('endif')+tag('endfor')+tag('endif')+'{{ "true" if q.prime else "false" }}'+tag('endmacro');
    return expr(`_tb_prime(${n}) == "true"`);
  }
  return expr({EVEN:`${n} % 2 == 0`,ODD:`${n} % 2 != 0`,WHOLE:`${n} % 1 == 0`,POSITIVE:`${n} > 0`,NEGATIVE:`${n} < 0`,DIVISIBLE_BY:`${n} % ${group(b,g,'DIVISOR','1')} == 0`}[b.getFieldValue('PROPERTY')]);
};
f.math_on_list = (b,g) => {
  const list=group(b,g,'LIST','[]'), op=b.getFieldValue('OP');
  if(op==='SUM'||op==='MIN'||op==='MAX')return expr(`${list} | ${op.toLowerCase()}`);
  if(op==='AVERAGE')return expr(`(${list} | average)`);
  if(op==='MEDIAN')return expr(`(${list} | median)`);
  if(op==='MODE')return expr(`${list} | statistical_mode`);
  if(op==='STD_DEV'){
    g.helpers.stdev=tag('macro _tb_stdev(xs)')+tag('set q = namespace(mean=xs | average, sum=0)')+tag('for x in xs')+tag('set q.sum = q.sum + ((x | float) - q.mean) ** 2')+tag('endfor')+'{{ (q.sum / (xs | length)) ** 0.5 }}'+tag('endmacro');
    return expr(`_tb_stdev(${list}) | float`);
  }
  if(op==='RANDOM')return expr(`${list} | random`);
  throw new Error(`${op.toLowerCase()} needs a custom Jinja expression or filter.`);
};
f.ha_state = b => expr(`states(${quote(b.getFieldValue('ENTITY'))})`);
f.ha_number = b => expr(`states(${quote(b.getFieldValue('ENTITY'))}) | float(${b.getFieldValue('DEFAULT')})`);
f.ha_attribute = b => expr(`state_attr(${quote(b.getFieldValue('ENTITY'))}, ${quote(b.getFieldValue('ATTRIBUTE'))})`);
f.ha_action_response = b => expr(actionConfig(b).variable);
f.ha_is_state = b => expr(`is_state(${quote(b.getFieldValue('ENTITY'))}, ${quote(b.getFieldValue('STATE'))})`);
f.ha_has_value = b => expr(`has_value(${quote(b.getFieldValue('ENTITY'))})`);
f.ha_dynamic_state = (b,g) => expr(`states(${input(b,g,'ENTITY','""')})`);
f.ha_entities = b => expr(b.getFieldValue('DOMAIN')==='all'?'states':`states.${b.getFieldValue('DOMAIN')}`);
f.ha_now = b => expr(`${b.getFieldValue('KIND')}()`);
f.tb_filter = (b,g) => {
  const name=b.getFieldValue('FILTER').trim();
  if(!/^[a-zA-Z_]\w*$/.test(name))throw new Error('Filter names must be identifiers.');
  const args=b.getFieldValue('ARGS').trim();
  return expr(`${group(b,g,'VALUE')} | ${name}${args ? `(${args})` : ''}${lazyFilters.has(name)?' | list':''}`);
};
f.tb_test = (b,g) => {
  const name=b.getFieldValue('TEST').trim();
  if(!/^[a-zA-Z_]\w*$/.test(name))throw new Error('Test names must be identifiers.');
  const args=b.getFieldValue('ARGS').trim();
  return expr(`${group(b,g,'VALUE')} is ${name}${args ? `(${args})` : ''}`);
};
f.tb_call = (b,g) => {
  const name=b.getFieldValue('FUNCTION').trim();
  if(!/^[a-zA-Z_]\w*(\.[a-zA-Z_]\w*)*$/.test(name))throw new Error('Function names must be identifiers or dotted names.');
  return expr(`${name}(*${group(b,g,'ARGS','[]')})`);
};
f.tb_property = (b,g) => expr(`${group(b,g,'VALUE')}[${quote(b.getFieldValue('KEY'))}]`);
f.tb_index = (b,g) => expr(`${group(b,g,'VALUE')}[${input(b,g,'INDEX','0')}]`);
f.tb_slice = (b,g) => expr(`${group(b,g,'VALUE')}[${input(b,g,'START','')}:${input(b,g,'END','')}]`);
f.tb_concat = (b,g) => expr(`${group(b,g,'A','""')} ~ ${group(b,g,'B','""')}`);
f.tb_replace = (b,g) => expr(`${group(b,g,'VALUE','""')} | replace(${input(b,g,'OLD','""')}, ${input(b,g,'NEW','""')})`);
f.tb_split = (b,g) => expr(`${group(b,g,'VALUE','""')}.split(${input(b,g,'SEP','" "')})`);
f.tb_join = (b,g) => expr(`${group(b,g,'VALUE','[]')} | join(${input(b,g,'SEP','", "')})`);
f.tb_contains = (b,g) => expr(`${group(b,g,'ITEM')} in ${group(b,g,'VALUE','[]')}`);
f.tb_range = (b,g) => expr(`range(${input(b,g,'START','0')}, ${input(b,g,'END','10')}, ${input(b,g,'STEP','1')})`);
f.tb_loop_info = b => expr(`loop.${b.getFieldValue('PROPERTY')}`);
f.tb_pair = (b,g) => expr(`(${input(b,g,'KEY','""')}, ${input(b,g,'VALUE')})`);
f.tb_dict = (b,g) => expr(`dict(${input(b,g,'PAIRS','[]')})`);
f.tb_raw_expression = b => expr(b.getFieldValue('CODE').trim() || 'none');
f.tb_raw_statement = b => b.getFieldValue('CODE') + '\n';
f.variables_get = (b,g) => expr(variable(b,g));
f.variables_set = (b,g) => tag(`set ${variable(b,g)} = ${input(b,g,'VALUE')}`);
f.math_change = (b,g) => tag(`set ${variable(b,g)} = (${variable(b,g)} | float(0)) + ${group(b,g,'DELTA','1')}`);
f.controls_if = (b,g) => {
  let code='',count=0;
  for(let i=0;b.getInput(`IF${i}`);i++){
    const parent=g.pending;g.pending=[];
    const condition=input(b,g,`IF${i}`,'false'),pending=g.pending.join('');g.pending=parent;
    code+=(i?tag('else'):'')+pending+tag(`if ${condition}`)+g.statementToCode(b,`DO${i}`);count++;
  }
  if(b.getInput('ELSE'))code+=tag('else')+g.statementToCode(b,'ELSE');
  return code+tag('endif').repeat(count);
};
f.controls_forEach = (b,g) => {
  const name=g.nameDB_.getName(b.getFieldValue('VAR'),Blockly.Names.NameType.VARIABLE);
  const temporary=`_item_${b.id.replace(/\W/g,'_')}`;
  return tag(`for ${temporary} in ${input(b,g,'LIST','[]')}`)+tag(`set ns.${name} = ${temporary}`)+g.statementToCode(b,'DO')+tag('endfor');
};
f.lists_create_with = (b,g) => expr(`[${Array.from({length:b.itemCount_},(_,i)=>input(b,g,`ADD${i}`)).join(', ')}]`);
f.lists_length = f.text_length = (b,g) => expr(`${group(b,g,b.type==='text_length'?'VALUE':'VALUE','[]')} | length`);
f.lists_isEmpty = f.text_isEmpty = (b,g) => expr(`(${group(b,g,'VALUE','[]')} | length) == 0`);

// Emit collection-building loops immediately before their consuming statement,
// within the same condition/loop scope, without serializing values through JSON.
for(const [type,handler] of Object.entries(f)){
  f[type]=(block,g)=>{
    if(block.outputConnection)return handler(block,g);
    const parent=g.pending;g.pending=[];
    try {const code=handler(block,g);return g.pending.join('')+code;}
    finally {g.pending=parent;}
  };
}
export function generate(workspace) { return jinja.workspaceToCode(workspace); }
