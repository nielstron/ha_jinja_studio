import {parseArguments,filterDefinition,argumentValue,encodeArguments} from './filter-arguments.js';
import {BlocklyCore as Blockly} from './blocks.js';

const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export class FilterEditor {
  constructor(panel) {
    this.panel=panel;
    const template=document.createElement('template');
    template.innerHTML=`<style>
      .filter-form{padding:16px 20px;display:grid;gap:14px;max-height:65vh;overflow:auto}.filter-form label{display:grid;gap:6px}.filter-form input,.filter-form select{width:100%;padding:9px;border:1px solid var(--divider-color,#d4dfde);border-radius:8px;background:var(--card-background-color,white);color:inherit}.filter-description{font-size:12px;line-height:1.6;color:var(--secondary-text-color,#748685);white-space:pre-wrap}.filter-arg{display:grid;grid-template-columns:22px 130px 100px minmax(0,1fr);gap:8px;align-items:center;margin:9px 0}.filter-arg input[type=checkbox]{width:18px}.filter-arg label{font-size:12px}.filter-arg small{font-size:10px;color:var(--secondary-text-color,#748685)}.filter-error{color:#b64747;font-size:12px}.filter-extra{display:flex;gap:8px;flex-wrap:wrap}.filter-map{display:grid;gap:12px}.filter-note{font-size:12px;line-height:1.5;color:var(--secondary-text-color,#748685)}@media(max-width:550px){.filter-arg{grid-template-columns:22px 90px minmax(0,1fr)}.filter-arg .arg-type{grid-column:3}.filter-arg .arg-value{grid-column:2 / 4}}
    </style><dialog id="filter-dialog"><div class="dialog-head"><h2>Configure operation</h2><button id="close-filter" aria-label="Close filter editor">✕</button></div><div class="filter-form"><label>Jinja / Home Assistant filter<select id="filter-name"></select></label><div id="filter-description" class="filter-description"></div><div id="filter-map" class="filter-map hidden"><label>Map each item by<select id="map-mode"><option value="attribute">Reading an attribute</option><option value="filter">Applying a filter</option></select></label><label id="mapped-filter-label">Apply this filter<select id="mapped-filter"></select></label></div><div id="filter-args"></div><datalist id="filter-attributes"></datalist><datalist id="filter-tests"></datalist><div id="filter-extra" class="filter-extra"><button id="add-positional">Add positional argument</button><button id="add-named">Add named argument</button></div><div class="filter-note">Choose a value type: Text is quoted automatically; Expression accepts connected-template expressions. Optional arguments use their defaults unless enabled.<br><br>To compose an arbitrary operation, use <strong>Map list</strong> or <strong>Filter list</strong> from Text & lists and plug the same operation blocks into their sockets.</div><div id="filter-error" class="filter-error" role="status"></div><button id="save-filter" class="primary">Apply operation</button></div></dialog>`;
    panel.shadowRoot.append(template.content);
    this.$=id=>panel.$(id);
    this.$('close-filter').onclick=()=>this.$('filter-dialog').close();
    this.$('filter-name').onchange=()=>this.configure('',true);
    this.$('map-mode').onchange=()=>this.configure('',false);
    this.$('mapped-filter').onchange=()=>this.configure('',false);
    this.$('add-positional').onclick=()=>this.addRow({name:`argument ${this.extraIndex++}`,positional:true,extra:true},'');
    this.$('add-named').onclick=()=>this.addRow({name:'',extra:true},'');
    this.$('save-filter').onclick=()=>this.save();
  }
  async open(block) {
    this.block=block;this.$('filter-error').textContent='';
    try {
      this.catalog=await this.panel.hass.callWS({type:'jinja_studio/filters'});
      this.$('filter-name').innerHTML=this.catalog.filters.map(f=>`<option value="${escape(f.name)}">${escape(f.name)}</option>`).join('');
      this.$('mapped-filter').innerHTML=this.catalog.filters.filter(f=>f.name!=='map').map(f=>`<option>${escape(f.name)}</option>`).join('');
      this.$('filter-name').value=block.getFieldValue('FILTER');
      if(!this.$('filter-name').value)throw Error(`Filter ${block.getFieldValue('FILTER')} is not registered in this environment.`);
      this.$('filter-tests').innerHTML=this.catalog.tests.map(t=>`<option value="${escape(t)}">`).join('');
      this.$('filter-attributes').innerHTML=this.attributeOptions(block).map(a=>`<option value="${escape(a)}">`).join('');
      this.configure(block.getFieldValue('ARGS'),true);
      this.$('filter-dialog').showModal();
    } catch(error) {this.panel.toast(`Could not configure operation: ${error.message}`);}
  }
  attributeOptions(block) {
    const choices=new Set(['entity_id','state','name','attributes.friendly_name']);
    const walk=(value,prefix='',depth=0)=>{
      if(!value||typeof value!=='object'||depth>3)return;
      if(Array.isArray(value)){for(const item of value.slice(0,3))walk(item,prefix,depth);return;}
      for(const [key,child] of Object.entries(value)){
        const path=prefix?`${prefix}.${key}`:key;choices.add(path);walk(child,path,depth+1);
      }
    };
    let source=block.getInputTargetBlock('VALUE');
    while(source?.type==='tb_filter')source=source.getInputTargetBlock('VALUE');
    if(source?.type==='ha_attribute')walk(this.panel.hass.states[source.getFieldValue('ENTITY')]?.attributes[source.getFieldValue('ATTRIBUTE')]);
    else if(source?.type==='ha_action_response')walk(source.responseSample?.value);
    else for(const state of Object.values(this.panel.hass.states))walk(state);
    return [...choices].sort();
  }
  configure(args,resetMode) {
    const name=this.$('filter-name').value,parsed=parseArguments(args);
    if(resetMode){this.$('map-mode').value=Object.hasOwn(parsed.named,'attribute')||parsed.positional.length===0?'attribute':'filter';this.$('mapped-filter').value=argumentValue(parsed.positional[0]||'"float"').value;}
    this.$('filter-map').classList.toggle('hidden',name!=='map');
    this.$('mapped-filter-label').classList.toggle('hidden',this.$('map-mode').value!=='filter');
    const mapped=this.$('mapped-filter').value||'float';
    this.definition=filterDefinition(this.catalog,name,this.$('map-mode').value,mapped);
    this.$('filter-description').textContent=this.definition.description;
    this.$('filter-args').replaceChildren();this.rows=[];this.extraIndex=1;
    for(const parameter of this.definition.parameters){
      const expression=Object.hasOwn(parsed.named,parameter.name)?parsed.named[parameter.name]:(parameter.positional?parsed.positional.shift():'');
      delete parsed.named[parameter.name];
      if(name==='map'&&parameter.name==='filter')continue;
      this.addRow(parameter,expression);
    }
    for(const expression of parsed.positional)this.addRow({name:`argument ${this.extraIndex++}`,positional:true,extra:true},expression);
    for(const [key,expression] of Object.entries(parsed.named))this.addRow({name:key,extra:true},expression);
    if(!this.definition.parameters.length&&!this.rows.length)this.$('filter-args').textContent='This filter takes no arguments.';
    this.$('add-positional').classList.toggle('hidden',!this.definition.variadic.includes('VAR_POSITIONAL'));
    this.$('add-named').classList.toggle('hidden',!this.definition.variadic.includes('VAR_KEYWORD'));
    this.$('filter-error').textContent='';
  }
  addRow(parameter,expression='') {
    const initial=argumentValue(expression,parameter),row=document.createElement('div');row.className='filter-arg';
    const inferred=argumentValue(parameter.default==='omitted'?'':parameter.default||'',parameter);
    if(!expression&&inferred.type!=='expression')initial.type=inferred.type;
    if(parameter.type)initial.type='text';
    row.innerHTML=`<input class="arg-enabled" type="checkbox" aria-label="Use ${escape(parameter.name||'named argument')}" ${expression||parameter.required?'checked':''} ${parameter.required?'disabled':''}><label>${parameter.extra&&!parameter.positional?`<input class="arg-name" value="${escape(parameter.name)}" placeholder="Argument name">`:`<span>${escape(parameter.name)}</span>`}<small>${parameter.required?'required':`default: ${escape(parameter.default??'omitted')}`}</small></label><select class="arg-type" aria-label="${escape(parameter.name)} value type"><option value="text">Text</option><option value="number">Number</option><option value="boolean">Boolean</option><option value="expression">Expression</option></select><input class="arg-value" aria-label="${escape(parameter.name)}" value="${escape(initial.value)}" placeholder="${escape(inferred.value||'Value')}" ${parameter.type==='attribute'?'list="filter-attributes"':parameter.type==='test'?'list="filter-tests"':''}>`;
    row.querySelector('.arg-type').value=initial.type;
    const input=row.querySelector('.arg-value');
    if(parameter.choices||initial.type==='boolean'){
      const list=document.createElement('datalist');list.id=`filter-choice-${this.rows.length}`;
      list.innerHTML=(parameter.choices||['true','false']).map(value=>`<option value="${escape(value)}">`).join('');row.append(list);input.setAttribute('list',list.id);
    }
    const enabled=row.querySelector('.arg-enabled');
    const sync=()=>{input.disabled=!enabled.checked;row.querySelector('.arg-type').disabled=!enabled.checked;};
    enabled.onchange=sync;sync();
    input.oninput=()=>{enabled.checked=true;sync();};
    this.$('filter-args').append(row);this.rows.push({parameter,row});
  }
  save() {
    try {
      const values={},extraPositional=[],extraNamed={};
      if(this.$('filter-name').value==='map'&&this.$('map-mode').value==='filter')values.filter={type:'text',value:this.$('mapped-filter').value};
      for(const {parameter,row} of this.rows){
        const supplied={type:row.querySelector('.arg-type').value,value:row.querySelector('.arg-value').value,enabled:row.querySelector('.arg-enabled').checked};
        if(parameter.extra){if(!supplied.enabled)continue;if(parameter.positional)extraPositional.push(supplied);else extraNamed[row.querySelector('.arg-name').value]=supplied;}
        else values[parameter.name]=supplied;
      }
      const args=encodeArguments(this.definition,values,extraPositional,extraNamed);
      Blockly.Events.setGroup(true);
      try {this.block.setFieldValue(this.$('filter-name').value,'FILTER');this.block.setFieldValue(args,'ARGS');}
      finally {Blockly.Events.setGroup(false);}
      this.$('filter-dialog').close();this.panel.markDirty();this.panel.update();
    } catch(error) {this.$('filter-error').textContent=error.message;}
  }
}
