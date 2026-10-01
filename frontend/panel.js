import { BlocklyCore as Blockly, toolbox, setEntities, setFieldPicker, entityInfo } from './blocks.js';
import { generate } from './generator.js';
import { examples } from './examples.js';
import { attributeChildren, applyAttributePath, resolveAttributePath, valueSummary } from './attribute-path.js';
import { actionConfig, actionSignature, actionInputs, responseVariables, requiredActions } from './action-response.js';
import { actionCatalog, filterActions, actionFields, actionDefaults } from './action-catalog.js';
import { iconName, hexColor, colorRgb, searchIcons, colorPalette } from './visual-values.js';

const escape = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

class TemplateBuilderPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({mode:'open'});
    this.shadowRoot.innerHTML = `
      <style>
        :host{display:block;height:100%;min-height:600px;color:var(--primary-text-color,#203438);font:14px system-ui,sans-serif;background:var(--primary-background-color,#f4f7f7)}
        *{box-sizing:border-box} button,input,select{font:inherit} button{cursor:pointer;border:1px solid var(--divider-color,#d6e0e1);border-radius:9px;padding:9px 13px;background:var(--card-background-color,white);color:inherit}button:hover{background:var(--secondary-background-color,#edf4f3)}button:disabled{opacity:.5;cursor:default}.primary{background:#147d78;color:white;border-color:#147d78}.primary:hover{background:#106d69}
        .shell{height:100%;display:flex;flex-direction:column}.header{padding:20px 26px 16px;background:var(--card-background-color,white);border-bottom:1px solid var(--divider-color,#dde6e5)}.headline,.toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.headline{justify-content:space-between;margin-bottom:18px}h1{font-size:24px;letter-spacing:-.7px;margin:0;font-weight:650}.subtitle{color:var(--secondary-text-color,#6d7f80);margin:5px 0 0;font-size:13px}.eyebrow{color:#147d78;letter-spacing:1.5px;text-transform:uppercase;font-size:10px;font-weight:750;margin-bottom:5px}.badge{background:#e9f3f0;color:#2f7163;padding:7px 11px;border-radius:30px;font-size:12px}.toolbar input{min-width:150px;width:220px;border:1px solid var(--divider-color,#d6e0e1);border-radius:9px;padding:9px 11px;background:var(--card-background-color,white);color:inherit}.toolbar select{max-width:185px;border:1px solid var(--divider-color,#d6e0e1);border-radius:9px;padding:9px;background:var(--card-background-color,white);color:inherit}.spacer{flex:1}.save-status{font-size:12px;color:var(--secondary-text-color,#6d7f80)}
        .content{flex:1;min-height:0;display:grid;grid-template-columns:minmax(420px,1fr) 350px;gap:16px;padding:16px}.canvas-card{display:flex;flex-direction:column;min-height:400px;overflow:hidden;background:var(--card-background-color,white);border:1px solid var(--divider-color,#dce5e4);border-radius:14px}.canvas-tools{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid var(--divider-color,#e2e8e7);font-size:12px;color:var(--secondary-text-color,#657a7b)}.canvas-tools button{padding:4px 9px;border:0;font-size:16px}.workspace{flex:1;min-height:360px;position:relative}.sidebar{display:flex;flex-direction:column;gap:14px;min-height:0}.card{background:var(--card-background-color,white);border:1px solid var(--divider-color,#dce5e4);border-radius:14px;overflow:hidden}.card-title{padding:13px 16px;display:flex;align-items:center;justify-content:space-between;font-weight:650;font-size:13px;border-bottom:1px solid var(--divider-color,#e3e9e8)}.card-title button{font-size:12px;padding:5px 9px}.preview{min-height:100px;max-height:210px;overflow:auto;padding:17px;font:16px/1.6 ui-monospace,monospace;white-space:pre-wrap;overflow-wrap:anywhere;margin:0}.preview.error{font-size:12px;color:#b64747}.preview.empty{color:#8b9999;font:13px system-ui}.code-card{flex:1;display:flex;flex-direction:column;min-height:140px}.code{font:12px/1.7 ui-monospace,SFMono-Regular,monospace;white-space:pre-wrap;overflow:auto;overflow-wrap:anywhere;padding:16px;margin:0;flex:1;color:var(--primary-text-color,#34565c)}.hint{padding:14px 16px;font-size:12px;line-height:1.7;color:var(--secondary-text-color,#6b7c7e)}.hint strong{color:var(--primary-text-color,#35565a)}.status-dot{display:inline-block;width:6px;height:6px;background:#61a88b;border-radius:50%;margin-right:5px}.footer{font-size:11px;color:var(--secondary-text-color,#758686);padding:0 22px 12px}.toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:12px 20px;background:#243c3f;color:white;z-index:10000;border-radius:10px;box-shadow:0 6px 25px #0002}.hidden{display:none!important}
        dialog{padding:0;border:1px solid #d4dfde;border-radius:16px;background:var(--card-background-color,white);color:inherit;width:min(640px,92vw);max-height:80vh;box-shadow:0 20px 100px #0003}dialog::backdrop{background:#132f3855;backdrop-filter:blur(3px)}.dialog-head{display:flex;align-items:center;justify-content:space-between;padding:18px 20px;border-bottom:1px solid var(--divider-color,#dce5e4)}.dialog-head h2{margin:0;font-size:18px}.search{display:flex;gap:8px;padding:14px 20px}.search input{flex:1;min-width:0;border:1px solid var(--divider-color,#d4dfde);padding:11px;border-radius:8px;background:inherit;color:inherit}.search select{max-width:130px;border:1px solid var(--divider-color,#d4dfde);border-radius:8px;background:inherit;color:inherit}.results{max-height:46vh;overflow:auto;padding:0 10px 12px}.entity-result{display:flex;align-items:center;text-align:left;gap:12px;width:100%;border:none;background:transparent;padding:11px 10px}.entity-result small{display:block;color:var(--secondary-text-color,#829091);font:11px ui-monospace,monospace;margin-top:4px}.entity-result .state{margin-left:auto;background:var(--secondary-background-color,#f0f5f4);padding:5px 9px;border-radius:6px;font-size:12px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.entity-icon{display:flex;align-items:center;justify-content:center;background:#e7f3f0;color:#278879;width:34px;height:34px;border-radius:10px;flex-shrink:0}.dialog-foot{padding:12px 20px;border-top:1px solid var(--divider-color,#dce5e4);font-size:12px;color:var(--secondary-text-color,#748685)}
        @media(max-width:950px){.content{grid-template-columns:minmax(300px,1fr) 300px}.header{padding:16px}.toolbar input{width:160px}}@media(max-width:700px){:host{height:auto;min-height:100vh}.content{display:flex;flex-direction:column}.canvas-card{height:60vh;min-height:430px}.sidebar{min-height:350px}.header{padding:14px}.toolbar{gap:6px}.toolbar button{padding:8px}.toolbar .spacer{display:none}.toolbar input{width:150px}.badge{display:none}}
      </style>
      <style>@media(max-width:700px){.shell{height:auto;min-height:100vh}.content{flex:none}.sidebar{min-height:0}.card{flex-shrink:0}.code-card{min-height:220px}}</style>
      <style>
        .data-nav{display:flex;align-items:center;gap:5px;flex-wrap:wrap;padding:0 20px 12px}.data-nav button{padding:5px 8px;font-size:12px;border:0;background:var(--secondary-background-color,#edf4f1)}.data-nav .path-separator{color:#829391}.data-selection{margin:0 20px 12px;padding:12px;background:var(--secondary-background-color,#eff5f3);border-radius:9px;display:flex;gap:10px;align-items:center;justify-content:space-between}.data-selection small{display:block;color:var(--secondary-text-color,#748685);font-size:11px;margin-top:3px}.data-row{display:flex;align-items:center;border-radius:9px;margin:3px 0}.data-row:hover{background:var(--secondary-background-color,#edf4f3)}.data-row .entity-result{min-width:0}.data-row .entity-result>span:first-child{overflow-wrap:anywhere}.data-row .use-data{flex-shrink:0;padding:7px 9px;margin-right:8px;font-size:12px}.browse-arrow{color:#147d78;font-size:20px;flex-shrink:0}.data-row .state{max-width:220px}
      </style>
      <div class="shell">
        <header class="header">
        <div class="toolbar"><select id="projects" aria-label="Saved projects"><option value="">Saved templates…</option></select><input id="name" aria-label="Template name" placeholder="Untitled template" value="My template"><span class="save-status" id="saved">Unsaved</span><button id="save" class="primary">Save</button><button id="new">New</button><span class="spacer"></span><select id="examples" aria-label="Examples"><option value="">Try an example…</option></select><button id="import">Import</button><button id="export">Export</button><input id="file" type="file" accept=".json" class="hidden"></div></header>
        <div class="content"><section class="canvas-card"><div class="canvas-tools"><span>Drag blocks together · Click an entity to select it</span><div><button id="undo" title="Undo">↶</button><button id="redo" title="Redo">↷</button><button id="fit" title="Fit blocks">⤢</button></div></div><div id="workspace" class="workspace"></div></section>
        <aside class="sidebar"><section class="card"><div class="card-title"><span>Live result</span><span id="render-status"><span class="status-dot"></span>Ready</span></div><pre id="preview" class="preview empty">Connect a block to an output to get started.</pre></section><section class="card code-card"><div class="card-title"><span>Generated Jinja</span><button id="copy">Copy template</button></div><pre id="code" class="code"></pre></section><section class="card hint"><strong>Your building blocks</strong><br>Use <strong>Home Assistant</strong> for entity inputs, <strong>Logic</strong> and <strong>Loops</strong> for structure, and <strong>Maths</strong> or <strong>Text & lists</strong> for transformations.<br><br><strong>Need another Jinja feature?</strong> Chain a named filter or add a raw expression or statement block.</section></aside></div><div class="footer" id="footer">Preview evaluates your template. It does not run scripts or change entities.</div>
      </div><dialog id="picker"><div class="dialog-head"><h2 id="picker-title">Choose an entity</h2><button id="close-picker" aria-label="Close">✕</button></div><div class="search"><input id="search" placeholder="Search names, entity IDs or states…" aria-label="Search entities"><select id="domain" aria-label="Entity domain"><option value="">All domains</option></select></div><nav id="data-nav" class="data-nav hidden" aria-label="Attribute path"></nav><div id="data-selection" class="data-selection hidden"></div><div id="results" class="results"></div><div class="dialog-foot" id="picker-help">Select an entity to use its state as an input.</div></dialog><div id="toast" class="toast hidden" role="status"></div>`;
    this.$ = id => this.shadowRoot.getElementById(id);
    this.$('code').closest('section').insertAdjacentHTML('afterend', `<section id="actions-card" class="card hidden"><div class="card-title"><span>Required actions · YAML</span><button id="copy-actions">Copy actions</button></div><pre id="actions-code" class="code"></pre><div class="hint">Run these actions <strong>before</strong> using the Jinja in your script or automation. A standalone template helper cannot run actions. Preview uses your saved sample; it never reruns an action automatically.</div></section>`);
    const actionUI=document.createElement('template');
    actionUI.innerHTML=`<style>.action-form{padding:16px 20px;display:grid;gap:12px;max-height:65vh;overflow:auto}.action-form label{display:grid;gap:5px;font-size:12px}.action-form input,.action-form select,.action-form textarea{width:100%;padding:9px;border:1px solid #d4dfde;border-radius:8px;background:inherit;color:inherit;font:13px system-ui}.action-form textarea{font:12px ui-monospace,monospace;resize:vertical}.action-buttons{display:flex;gap:8px;flex-wrap:wrap}.action-message{white-space:pre-wrap;color:#b64747;font-size:12px}.action-form small{color:#748685;line-height:1.5}</style><dialog id="action-dialog"><div class="dialog-head"><h2>Action response input</h2><button id="close-action" aria-label="Close action input">✕</button></div><div class="action-form"><label>Action<input id="action-name" placeholder="weather.get_forecasts" list="response-actions"><datalist id="response-actions"><option value="weather.get_forecasts"><option value="calendar.get_events"></datalist></label><label>Target entity<select id="action-entity"></select></label><label>Action data · JSON<textarea id="action-data" rows="3"></textarea></label><label>Response variable<input id="action-variable" placeholder="forecasts"></label><div class="action-buttons"><button id="fetch-response">Run action & fetch sample</button></div><small id="action-warning">Fetching explicitly runs this action in Home Assistant. Choose a read-only action; other actions may change devices. Nothing runs automatically.</small><label>Sample response · JSON<textarea id="action-sample" rows="5" placeholder="Fetch a sample, or paste response JSON here"></textarea></label><div id="action-message" class="action-message" role="status"></div><div class="action-buttons"><button id="browse-response" class="primary">Save & browse response</button><button id="save-response">Save input</button></div></div></dialog>`;
    this.shadowRoot.append(actionUI.content);
    this.$('action-name').removeAttribute('list');
    this.$('response-actions').remove();
    this.$('action-name').insertAdjacentHTML('afterend','<button id="choose-action">Choose available action…</button><div id="action-details" class="hint" style="padding:4px 0"></div>');
    const catalogUI=document.createElement('template');
    catalogUI.innerHTML=`<style>.catalog-options{display:flex;align-items:center;gap:10px;padding:0 20px 12px;font-size:12px}.catalog-options label{display:flex;gap:6px;align-items:center}.catalog-options span{margin-left:auto;color:#748685}.action-result{align-items:flex-start}.action-result .action-description{font:12px/1.5 system-ui;white-space:normal;max-width:440px}.action-result .state{flex-shrink:0}.field-guide{display:grid;gap:4px;margin-top:8px}</style><dialog id="action-picker"><div class="dialog-head"><h2>Choose an available action</h2><button id="close-action-picker" aria-label="Close action picker">✕</button></div><div class="search"><input id="action-search" placeholder="Search action names, IDs or descriptions…" aria-label="Search actions"><select id="action-domain" aria-label="Action integration"><option value="">All integrations</option></select></div><div class="catalog-options"><label><input id="response-only" type="checkbox" checked>Response-producing actions only</label><span id="action-count"></span></div><div id="action-results" class="results"></div><div class="dialog-foot">Only actions that return data can supply a template input. Selecting an action does not run it.</div></dialog>`;
    this.shadowRoot.append(catalogUI.content);
    this.$('preview').insertAdjacentHTML('beforebegin','<div id="visual-output" class="visual-output hidden" aria-label="Visual result"></div>');
    const visualUI=document.createElement('template');
    visualUI.innerHTML=`<style>.visual-output{padding:18px 16px 0;display:flex;align-items:center;gap:14px}.visual-output svg{width:48px;height:48px;fill:currentColor;color:#147d78}.visual-output .color-chip{width:64px;height:48px;border-radius:10px;border:1px solid #8c9d9e;box-shadow:0 2px 8px #0001}.visual-output small{color:#748685}.icon-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;padding:0 20px 18px;max-height:46vh;overflow:auto}.icon-tile{display:flex;align-items:center;flex-direction:column;gap:9px;min-height:100px;padding:14px 8px;font-size:11px;overflow-wrap:anywhere;text-align:center}.icon-tile svg{width:30px;height:30px;fill:currentColor;flex-shrink:0}.icon-tile.selected{border-color:#147d78;background:#e7f3f0;color:#147d78}.icon-count{padding:0 20px 12px;color:#748685;font-size:12px}.color-form{padding:20px;display:grid;gap:16px}.color-controls{display:flex;gap:12px;align-items:center}.color-controls input[type=color]{width:90px;height:64px;border:1px solid #d4dfde;background:inherit;border-radius:9px;padding:4px;cursor:pointer}.color-controls input[type=text]{padding:12px;border:1px solid #d4dfde;border-radius:9px;min-width:0;flex:1;background:inherit;color:inherit;font:16px ui-monospace,monospace}.color-palette{display:grid;grid-template-columns:repeat(10,1fr);gap:8px}.color-palette button{height:35px;padding:0;border:1px solid #8c9d9e;border-radius:7px}.color-palette button.selected{outline:3px solid #147d78;outline-offset:2px}.color-readout{display:flex;align-items:center;gap:12px;font:13px ui-monospace,monospace}.color-readout .color-chip{width:56px;height:40px;border-radius:8px;border:1px solid #8c9d9e}.color-error{color:#b64747;min-height:18px;font-size:12px}@media(max-width:500px){.icon-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.color-palette{grid-template-columns:repeat(5,1fr)}}</style><dialog id="icon-picker"><div class="dialog-head"><h2>Choose a Material Design Icon</h2><button id="close-icon" aria-label="Close icon picker">✕</button></div><div class="search"><input id="icon-search" placeholder="Search icons, aliases or categories…" aria-label="Search icons"></div><div id="icon-count" class="icon-count"></div><div id="icon-results" class="icon-grid"></div><div class="dialog-foot">Outputs an mdi:… string. Connect it to an output or use it in a conditional expression.</div></dialog><dialog id="color-picker"><div class="dialog-head"><h2>Choose a color</h2><button id="close-color" aria-label="Close color picker">✕</button></div><div class="color-form"><div class="color-controls"><input id="color-native" type="color" value="#ff9800" aria-label="Color wheel"><input id="color-hex" type="text" value="#ff9800" aria-label="Hex color" placeholder="#ff9800"></div><div id="color-palette" class="color-palette"></div><div id="color-readout" class="color-readout"></div><div id="color-error" class="color-error" role="status"></div><button id="use-color" class="primary">Use color</button></div><div class="dialog-foot">Use the block's format dropdown to output a hex string or an RGB list. Your destination must support templated colors.</div></dialog>`;
    this.shadowRoot.append(visualUI.content);
    this.projects = {};
    this.projectId = null;
    this.previewVersion = 0;
    this.dirty = false;
  }
  set hass(hass) {
    this._hass = hass;
    setEntities(Object.values(hass.states));
    if(this.isConnected && !this.workspace && !this.initializing)this.initialize().catch(e=>this.toast(e.message));
  }
  get hass() { return this._hass; }
  connectedCallback() {
    if(this._hass && !this.workspace && !this.initializing)this.initialize().catch(e=>this.toast(e.message));
  }
  disconnectedCallback() {
    this.previewVersion++;
    this.unsubscribe?.();
    clearTimeout(this.previewTimer);
    this.resizeObserver?.disconnect();
    window.removeEventListener('beforeunload',this.beforeUnload);
    window.removeEventListener('keydown',this.keydown);
    this.workspace?.dispose();
    this.workspace = null;
    this.initializing = false;
  }
  async initialize() {
    this.initializing = true;
    setFieldPicker((field,kind)=>this.openPicker(field,kind));
    this.workspace = Blockly.inject(this.$('workspace'), {
      toolbox,
      renderer:'zelos',
      media:'/jinja_studio_static/media/',
      grid:{spacing:24,length:2,colour:'#d4e2de',snap:true},
      zoom:{controls:true,wheel:true,startScale:.85,minScale:.35,maxScale:1.5},
      move:{scrollbars:true,drag:true,wheel:true},
      trashcan:true,
      theme:Blockly.Theme.defineTheme('studio',{base:Blockly.Themes.Classic,componentStyles:{workspaceBackgroundColour:'#f9fbfa',toolboxBackgroundColour:'#fff',toolboxForegroundColour:'#34504e',flyoutBackgroundColour:'#eef4f1',flyoutForegroundColour:'#385450',flyoutOpacity:1,scrollbarColour:'#b3cbc2',insertionMarkerColour:'#147d78',insertionMarkerOpacity:.3}}),
    });
    this.resizeObserver = new ResizeObserver(()=>Blockly.svgResize(this.workspace));
    this.resizeObserver.observe(this.$('workspace'));
    this.workspace.addChangeListener(event=>{
      if(event.isUiEvent || this.loading || event.type===Blockly.Events.FINISHED_LOADING)return;
      this.markDirty();
      this.update();
    });
    this.$('undo').onclick=()=>this.workspace.undo(false);
    this.$('redo').onclick=()=>this.workspace.undo(true);
    this.$('fit').onclick=()=>this.workspace.zoomToFit();
    this.$('name').oninput=()=>this.markDirty();
    this.$('save').onclick=()=>this.save();
    this.$('new').onclick=()=>{if(this.canReplace()){this.projectId=null;this.$('name').value='My template';this.load({});this.markDirty();}};
    this.$('projects').onchange=()=>{
      const id=this.$('projects').value;
      if(!id)return;
      if(!this.canReplace()){this.$('projects').value=this.projectId || '';return;}
      const p=this.projects[id];this.projectId=id;this.$('name').value=p.name;this.load(p.workspace);this.dirty=false;this.$('saved').textContent='Saved';this.writeDraft();
    };
    this.$('examples').innerHTML='<option value="">Try an example…</option>'+Object.keys(examples).map(name=>`<option>${escape(name)}</option>`).join('');
    this.$('examples').onchange=()=>{const name=this.$('examples').value;if(name && this.canReplace()){this.projectId=null;this.$('name').value=name;this.load(examples[name](Object.values(this.hass.states)));this.markDirty();}this.$('examples').value='';};
    this.$('copy').onclick=async()=>{await navigator.clipboard.writeText(this.template||'');this.toast('Jinja template copied');};
    this.$('copy-actions').onclick=async()=>{await navigator.clipboard.writeText(requiredActions(this.inputs));this.toast('Required action YAML copied');};
    this.$('close-action').onclick=()=>this.$('action-dialog').close();
    this.$('fetch-response').onclick=()=>this.fetchResponse();
    this.$('browse-response').onclick=()=>this.saveResponse(true);
    this.$('save-response').onclick=()=>this.saveResponse(false);
    this.$('choose-action').onclick=()=>this.openActionPicker();
    this.$('close-action-picker').onclick=()=>this.$('action-picker').close();
    this.$('action-search').oninput=()=>this.renderActionPicker();
    this.$('action-domain').onchange=()=>this.renderActionPicker();
    this.$('response-only').onchange=()=>this.renderActionPicker();
    this.$('action-name').oninput=()=>this.renderActionDetails();
    this.$('close-icon').onclick=()=>this.$('icon-picker').close();
    this.$('icon-search').oninput=()=>{this.iconLimit=120;this.renderIconPicker();};
    this.$('close-color').onclick=()=>this.$('color-picker').close();
    this.$('color-native').oninput=()=>{this.$('color-hex').value=this.$('color-native').value;this.renderColorPicker();};
    this.$('color-hex').oninput=()=>this.renderColorPicker();
    this.$('use-color').onclick=()=>{this.visualField.setValue(hexColor(this.$('color-hex').value));this.$('color-picker').close();};
    this.$('export').onclick=()=>this.export();
    this.$('import').onclick=()=>this.$('file').click();
    this.$('file').onchange=()=>this.import();
    this.$('close-picker').onclick=()=>this.$('picker').close();
    this.$('search').oninput=()=>this.renderPicker();
    this.$('domain').onchange=()=>this.renderPicker();
    this.beforeUnload=e=>{if(this.dirty){e.preventDefault();e.returnValue='';}};
    this.keydown=e=>{if((e.metaKey||e.ctrlKey)&&e.key==='s'){e.preventDefault();this.save();}};
    window.addEventListener('beforeunload',this.beforeUnload);
    window.addEventListener('keydown',this.keydown);
    if(this.hass.templateBuilderSnapshot){
      this.$('footer').textContent='Local preview uses a saved state snapshot and a Jinja sandbox. HA-specific behaviour is checked against HA before deployment.';
    }
    if(this.hass.templateBuilderDemo){this.$('footer').textContent='Demonstration entities and forecast samples. No real home data or device actions.';}
    this.projects=await this.hass.callWS({type:'jinja_studio/projects',action:'list'});
    this.renderProjects();
    const draft=JSON.parse(localStorage.getItem(this.draftKey())||localStorage.getItem(`template_builder_draft_${this.hass.user?.id||'local'}`)||'null');
    if(draft){this.projectId=draft.id;this.$('name').value=draft.name;this.load(draft.workspace);this.dirty=draft.dirty;this.$('saved').textContent=this.dirty?'Draft restored':'Saved';}
    else{this.load(examples['Entity value'](Object.values(this.hass.states)));this.dirty=false;this.$('saved').textContent='Example';}
    this.initializing=false;
  }
  draftKey() { return `jinja_studio_draft_${this.hass.user?.id||'local'}`; }
  writeDraft() { localStorage.setItem(this.draftKey(),JSON.stringify({id:this.projectId,name:this.$('name').value,workspace:Blockly.serialization.workspaces.save(this.workspace),dirty:this.dirty})); }
  markDirty() { this.dirty=true;this.$('saved').textContent='Unsaved · draft kept locally';this.writeDraft(); }
  canReplace() { return !this.dirty || confirm('Replace the unsaved template? Save it first to keep it as a named project.'); }
  load(state) {
    this.loading=true;
    Blockly.Events.disable();
    try{Blockly.serialization.workspaces.load(state,this.workspace);this.workspace.scrollCenter();}
    finally{Blockly.Events.enable();this.loading=false;}
    this.update();
  }
  update() {
    clearTimeout(this.previewTimer);
    this.previewVersion++;
    this.$('visual-output').classList.add('hidden');
    this.$('visual-output').replaceChildren();
    try{this.template=generate(this.workspace);this.inputs=actionInputs(this.workspace);this.$('actions-code').textContent=requiredActions(this.inputs);this.$('actions-card').classList.toggle('hidden',!this.inputs.length);this.$('code').textContent=this.template;this.$('copy').disabled=false;this.$('save').disabled=false;}
    catch(e){this.template=null;this.inputs=[];this.$('actions-card').classList.add('hidden');this.$('code').textContent=e.message;this.$('copy').disabled=true;this.$('save').disabled=true;this.showError(e.message);return;}
    this.$('render-status').textContent='Updating…';
    this.$('preview').className='preview empty';
    this.$('preview').textContent='Updating preview…';
    this.previewTimer=setTimeout(()=>this.preview(),350);
  }
  async preview() {
    const version=++this.previewVersion;
    await this.unsubscribe?.();this.unsubscribe=null;
    if(version!==this.previewVersion)return;
    if(!this.template){this.$('preview').className='preview empty';this.$('preview').textContent='Add some blocks to get started.';this.$('render-status').textContent='Ready';return;}
    this.$('render-status').textContent='Rendering…';
    try {
      const variables=responseVariables(this.inputs);
      const unsubscribe=await this.hass.connection.subscribeMessage(message=>{
        if(version!==this.previewVersion)return;
        if(message.error){this.showError(message.error);return;}
        this.$('preview').className='preview';this.$('preview').textContent=typeof message.result==='string'?message.result:JSON.stringify(message.result,null,2);this.$('render-status').innerHTML='<span class="status-dot"></span>Valid';
        this.renderVisualResult(message.result,version).catch(e=>{if(version===this.previewVersion)this.toast(`Visual preview: ${e.message}`);});
      },{type:'render_template',template:this.template,variables,report_errors:true});
      if(version!==this.previewVersion)unsubscribe();else this.unsubscribe=unsubscribe;
    } catch(e) { if(version===this.previewVersion)this.showError(e.message||String(e)); }
  }
  showError(message) { this.$('visual-output').classList.add('hidden');this.$('preview').className='preview error';this.$('preview').textContent=String(message);this.$('render-status').textContent='Needs attention'; }
  async save() {
    if(this.template===null){this.toast('Fix the block error before saving.');return;}
    const name=this.$('name').value.trim();if(!name){this.toast('Give the template a name.');this.$('name').focus();return;}
    const id=this.projectId||crypto.randomUUID();
    try{this.projects=await this.hass.callWS({type:'jinja_studio/projects',action:'save',project_id:id,project:{name,workspace:Blockly.serialization.workspaces.save(this.workspace),template:this.template}});this.projectId=id;this.dirty=false;this.$('saved').textContent='Saved';this.renderProjects();this.writeDraft();this.toast('Template saved');}
    catch(e){this.toast(`Could not save: ${e.message||e}`);}
  }
  renderProjects() { this.$('projects').innerHTML='<option value="">Saved templates…</option>'+Object.entries(this.projects).sort((a,b)=>a[1].name.localeCompare(b[1].name)).map(([id,p])=>`<option value="${escape(id)}">${escape(p.name)}</option>`).join('');this.$('projects').value=this.projectId||''; }
  export() {
    const data={version:1,name:this.$('name').value,workspace:Blockly.serialization.workspaces.save(this.workspace),template:this.template};
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=(data.name||'template').replace(/[^a-z0-9_-]/gi,'_')+'.json';a.click();URL.revokeObjectURL(url);
  }
  async import() {
    const file=this.$('file').files[0];this.$('file').value='';if(!file || !this.canReplace())return;
    const previous=Blockly.serialization.workspaces.save(this.workspace);
    try{const data=JSON.parse(await file.text());if(data.version!==1||!data.workspace)throw new Error('Expected a Template Builder export (version 1).');this.load(data.workspace);if(this.template===null)throw new Error('The imported workspace contains unsupported or invalid blocks.');this.projectId=null;this.$('name').value=data.name||'Imported template';this.markDirty();this.toast('Workspace imported');}
    catch(e){this.load(previous);this.toast(`Import failed: ${e.message}`);}
  }
  openPicker(field,kind) {
    if(kind==='action'){this.openActionInput(field.getSourceBlock());this.openActionPicker();return;}
    if(kind==='response'){this.openActionInput(field.getSourceBlock());return;}
    if(kind==='icon'){this.openIconPicker(field);return;}
    if(kind==='color'){this.openColorPicker(field);return;}
    this.activeField=field;this.pickerKind=kind;this.$('search').value='';
    this.attributePath=[];
    if(kind==='attribute')this.pickerAttributes=structuredClone(entityInfo(field.getSourceBlock().getFieldValue('ENTITY'))?.attributes||{});
    this.$('data-nav').classList.toggle('hidden',kind!=='attribute');
    this.$('data-selection').classList.add('hidden');
    const domains=[...new Set(Object.keys(this.hass.states).map(id=>id.split('.')[0]))].sort();
    this.$('domain').innerHTML='<option value="">All domains</option>'+domains.map(d=>`<option>${escape(d)}</option>`).join('');
    this.$('domain').classList.toggle('hidden',kind!=='entity');
    this.$('picker-title').textContent={entity:'Choose an entity',state:'Choose a state',attribute:'Choose an attribute'}[kind];
    this.$('picker-help').textContent={entity:'Search by friendly name or entity ID. The current state is shown on the right.',state:'Known states for this domain are suggestions. You can also enter a custom state.',attribute:'Browse objects and lists, then select a value. The picker builds the property, index and JSON blocks for you.'}[kind];
    this.$('search').placeholder={entity:'Search names, entity IDs or current states…',state:'Search states, or enter a custom state…',attribute:'Search attributes, or enter a custom key…'}[kind];
    this.renderPicker();this.$('picker').showModal();this.$('search').focus();
  }
  renderPicker() {
    const query=this.$('search').value.toLowerCase(), domain=this.$('domain').value;
    if(this.pickerKind==='entity'){
      const filtered=Object.values(this.hass.states).filter(s=>(!domain||s.entity_id.startsWith(domain+'.')) && `${s.entity_id} ${s.attributes.friendly_name||''} ${s.state}`.toLowerCase().includes(query)).sort((a,b)=>(a.attributes.friendly_name||a.entity_id).localeCompare(b.attributes.friendly_name||b.entity_id));
      this.$('results').innerHTML=filtered.map(s=>`<button class="entity-result" data-value="${escape(s.entity_id)}"><span class="entity-icon">${s.entity_id.startsWith('sensor.')?'◉':s.entity_id.startsWith('light.')?'☀':'◇'}</span><span>${escape(s.attributes.friendly_name||s.entity_id)}<small>${escape(s.entity_id)}</small></span><span class="state">${escape(s.state)}${s.attributes.unit_of_measurement?' '+escape(s.attributes.unit_of_measurement):''}</span></button>`).join('')||'<p class="hint">No matching entities.</p>';
    }else if(this.pickerKind==='attribute'){
      this.renderAttributePicker();
      return;
    }else{
      const id=this.activeField.getSourceBlock().getFieldValue('ENTITY'), state=entityInfo(id), domain=id.split('.')[0];
      const standard={binary_sensor:['on','off'],switch:['on','off'],light:['on','off'],input_boolean:['on','off'],person:['home','not_home'],cover:['open','closed','opening','closing'],climate:['off','heat','cool','auto','heat_cool','dry','fan_only'],media_player:['off','on','idle','playing','paused','standby'],lock:['locked','unlocked','locking','unlocking']};
      const choices=[...new Set([state?.state,...(state?.attributes.options||[]),...(standard[domain]||[]),'unknown','unavailable'].filter(Boolean))].filter(s=>String(s).toLowerCase().includes(query));
      if(this.$('search').value && !choices.includes(this.$('search').value))choices.push(this.$('search').value);
      this.$('results').innerHTML=choices.map(s=>`<button class="entity-result" data-value="${escape(s)}"><span>${escape(s)}</span>${s===state?.state?'<span class="state">Current state</span>':''}</button>`).join('');
    }
    this.$('results').querySelectorAll('[data-value]').forEach(button=>button.onclick=()=>{this.activeField.setValue(button.dataset.value);this.$('picker').close();});
  }
  renderAttributePicker() {
    const attributes=this.pickerAttributes;
    const path=this.attributePath;
    this.$('data-nav').innerHTML=`<button data-depth="0">${this.activeField.getSourceBlock().type==='ha_action_response'?'Response':'Attributes'}</button>`+path.map((step,i)=>step.kind==='json'?'':`<span class="path-separator">›</span><button data-depth="${i+1+(path[i+1]?.kind==='json'?1:0)}">${escape((step.kind==='index'?`[${step.value}]`:step.value)+(path[i+1]?.kind==='json'?' (JSON)':''))}</button>`).join('');
    this.$('data-nav').querySelectorAll('[data-depth]').forEach(button=>button.onclick=()=>{this.attributePath=path.slice(0,Number(button.dataset.depth));this.$('search').value='';this.renderAttributePicker();});
    const response=this.activeField.getSourceBlock().type==='ha_action_response';
    this.$('data-selection').classList.toggle('hidden',!path.length && !response);
    if(path.length || response){
      this.$('data-selection').innerHTML=`<span>Selected data<small>${escape(valueSummary(resolveAttributePath(attributes,path)))}</small></span><button class="primary" id="use-current-data">Use this value</button>`;
      this.$('use-current-data').onclick=()=>this.selectAttributePath(path);
    }
    const query=this.$('search').value.toLowerCase();
    const currentValue=resolveAttributePath(attributes,path);
    const choices=(currentValue!==null && typeof currentValue==='object'?attributeChildren(attributes,path):[]).filter(child=>`${child.label} ${child.summary}`.toLowerCase().includes(query));
    this.$('results').innerHTML=choices.map((child,i)=>`<div class="data-row"><button class="entity-result" data-child="${i}" aria-label="${child.container?'Browse':'Use'} ${escape(child.label)}"><span>${escape(child.label)}</span><span class="state">${escape(child.summary)}</span>${child.container?'<span class="browse-arrow">›</span>':''}</button>${child.container?`<button class="use-data" data-use-child="${i}" aria-label="Use ${escape(child.label)}">Use</button>`:''}</div>`).join('')||'<p class="hint">No matching values at this level.</p>';
    this.$('results').querySelectorAll('[data-child]').forEach(button=>button.onclick=()=>{
      const child=choices[Number(button.dataset.child)];
      if(child.container){this.attributePath=child.browsePath;this.$('search').value='';this.renderAttributePicker();}
      else this.selectAttributePath(child.path);
    });
    this.$('results').querySelectorAll('[data-use-child]').forEach(button=>button.onclick=()=>this.selectAttributePath(choices[Number(button.dataset.useChild)].path));
    const current=resolveAttributePath(attributes,path),custom=this.$('search').value;
    const array=Array.isArray(current);
    if(custom && (!array||/^-?\d+$/.test(custom)) && !choices.some(child=>child.label===(array?`[${custom}]`:custom))){
      const button=document.createElement('button');button.className='entity-result';button.textContent=`Use custom key: ${this.$('search').value}`;
      if(array)button.textContent=`Use index: ${custom}`;
      button.onclick=()=>this.selectAttributePath([...path,{kind:array?'index':'key',value:array?Number(custom):custom}]);
      this.$('results').append(button);
    }
  }
  selectAttributePath(path) {
    applyAttributePath(this.activeField.getSourceBlock(),path);
    this.$('picker').close();
    this.markDirty();
    this.update();
  }
  openActionInput(block) {
    this.actionBlock=block;
    this.$('action-name').value=block.getFieldValue('ACTION');
    this.$('action-data').value=block.getFieldValue('DATA');
    this.$('action-variable').value=block.getFieldValue('RESPONSE');
    const entity=block.getFieldValue('ENTITY');
    const entities=Object.values(this.hass.states).sort((a,b)=>(a.attributes.friendly_name||a.entity_id).localeCompare(b.attributes.friendly_name||b.entity_id));
    this.$('action-entity').innerHTML='<option value="">No target</option>'+(entity&&!this.hass.states[entity]?`<option value="${escape(entity)}">${escape(entity)}</option>`:'')+entities.map(s=>`<option value="${escape(s.entity_id)}">${escape(s.attributes.friendly_name||s.entity_id)} · ${escape(s.entity_id)}</option>`).join('');
    this.$('action-entity').value=entity;
    this.$('action-sample').value=block.responseSample ? JSON.stringify(block.responseSample.value,null,2) : '';
    this.sampleSignature=block.responseSample?.signature;
    this.$('action-sample').oninput=()=>{this.sampleSignature=null;};
    this.$('action-message').textContent='';
    this.renderActionDetails();
    this.$('action-warning').textContent=this.hass.templateBuilderSnapshot?'Local mode fetches weather.get_forecasts read-only over SSH from your HA instance. For other actions, paste sample response JSON. No action runs automatically.':'Fetching explicitly runs this action in Home Assistant. Choose a read-only action; other actions may change devices. Nothing runs automatically.';
    this.$('action-dialog').showModal();
  }
  async openActionPicker() {
    this.$('action-search').value='';this.$('action-domain').value='';this.$('response-only').checked=true;
    this.$('action-count').textContent='';this.$('action-results').innerHTML='<p class="hint">Loading available actions…</p>';
    this.catalog=[];
    this.$('action-picker').showModal();
    try{
      const services=await this.hass.callWS({type:'get_services'});
      this.catalog=actionCatalog(services,key=>this.hass.localize?.(key));
      const domains=[...new Set(this.catalog.map(action=>action.domain))];
      this.$('action-domain').innerHTML='<option value="">All integrations</option>'+domains.map(domain=>`<option>${escape(domain)}</option>`).join('');
      this.renderActionPicker();this.renderActionDetails();this.$('action-search').focus();
    }catch(e){this.$('action-results').innerHTML=`<p class="hint">${escape(e.message||String(e))}</p>`;}
  }
  renderActionPicker() {
    const actions=filterActions(this.catalog,{query:this.$('action-search').value,domain:this.$('action-domain').value,responseOnly:this.$('response-only').checked});
    this.$('action-count').textContent=`${actions.length} actions`;
    this.$('action-results').innerHTML=actions.map(action=>`<button class="entity-result action-result" data-action="${escape(action.id)}" ${action.response?'':'disabled'}><span><span>${escape(action.name)}</span><small>${escape(action.id)}</small>${action.description?`<small class="action-description">${escape(action.description)}</small>`:''}</span><span class="state">${action.response?(action.optionalResponse?'Optional response':'Returns data'):'No response'}</span></button>`).join('')||'<p class="hint">No matching actions. You can still enter an action ID manually.</p>';
    this.$('action-results').querySelectorAll('[data-action]:not(:disabled)').forEach(button=>button.onclick=()=>{
      const action=this.catalog.find(action=>action.id===button.dataset.action);
      if(this.$('action-name').value.trim()!==action.id){
        const data=JSON.stringify(actionDefaults(action));
        if(this.$('action-data').value.trim()!=='{}' && !confirm('Replace the current action data and sample with the selected action’s defaults?'))return;
        this.$('action-data').value=data;this.$('action-sample').value='';this.sampleSignature=null;
      }
      this.$('action-name').value=action.id;this.$('action-message').textContent='';this.renderActionDetails();this.$('action-picker').close();
    });
  }
  renderActionDetails() {
    const action=this.catalog?.find(action=>action.id===this.$('action-name').value.trim());
    if(!action){this.$('action-details').textContent='Browse actions to see their available input fields.';return;}
    const fields=actionFields(action,key=>this.hass.localize?.(key));
    this.$('action-details').innerHTML=`${action.description?`<span>${escape(action.description)}</span>`:''}<div class="field-guide">${fields.length?fields.map(field=>`<span><strong>${escape(field.key)}</strong>${field.required?' · required':''}${Object.hasOwn(field,'default')?` · default: ${escape(JSON.stringify(field.default))}`:''}${field.options.length?` · choices: ${escape(field.options.join(', '))}`:''}${field.description?`<br>${escape(field.description)}`:''}</span>`).join(''):'No action data fields declared.'}</div>`;
  }
  async loadIcons() {
    if(!this.iconsPromise)this.iconsPromise=fetch('/jinja_studio_static/icons.json').then(async response=>{
      if(!response.ok)throw new Error('Could not load the bundled icon catalog.');
      this.icons=await response.json();
      this.iconMap=new Map(this.icons.flatMap(icon=>[icon.name,...icon.aliases].map(name=>[name,icon])));
      return this.icons;
    }).catch(error=>{this.iconsPromise=null;throw error;});
    return this.iconsPromise;
  }
  iconSvg(icon) { return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${escape(icon.path)}"></path></svg>`; }
  async openIconPicker(field) {
    this.visualField=field;this.iconLimit=120;this.$('icon-search').value='';
    this.$('icon-count').textContent='Loading icons…';this.$('icon-results').replaceChildren();this.$('icon-picker').showModal();
    try{await this.loadIcons();this.renderIconPicker();this.$('icon-search').focus();}
    catch(e){this.$('icon-count').textContent=e.message;}
  }
  renderIconPicker() {
    if(!this.icons)return;
    const matches=searchIcons(this.icons,this.$('icon-search').value),shown=matches.slice(0,this.iconLimit);
    this.$('icon-count').textContent=`${matches.length} icons${matches.length>shown.length?` · showing ${shown.length}`:''}`;
    this.$('icon-results').innerHTML=shown.map(icon=>`<button class="icon-tile ${this.visualField.getValue()===`mdi:${icon.name}`?'selected':''}" data-icon="${escape(icon.name)}" aria-label="Choose mdi:${escape(icon.name)}">${this.iconSvg(icon)}<span>${escape(icon.name)}</span></button>`).join('')||'<p class="hint">No matching icons.</p>';
    this.$('icon-results').querySelectorAll('[data-icon]').forEach(button=>button.onclick=()=>{this.visualField.setValue(iconName(button.dataset.icon));this.$('icon-picker').close();});
    if(matches.length>shown.length){const more=document.createElement('button');more.textContent='Show more icons';more.style.gridColumn='1 / -1';more.onclick=()=>{this.iconLimit+=120;this.renderIconPicker();};this.$('icon-results').append(more);}
  }
  openColorPicker(field) {
    this.visualField=field;this.$('color-hex').value=field.getValue();
    this.$('color-palette').innerHTML=colorPalette.map(([name,hex])=>`<button style="background:${hex}" data-color="${hex}" aria-label="${name} ${hex}" title="${name} · ${hex}"></button>`).join('');
    this.$('color-palette').querySelectorAll('[data-color]').forEach(button=>button.onclick=()=>{this.$('color-hex').value=button.dataset.color;this.renderColorPicker();});
    this.renderColorPicker();this.$('color-picker').showModal();
  }
  renderColorPicker() {
    try{
      const hex=hexColor(this.$('color-hex').value),rgb=colorRgb(hex);
      this.$('color-native').value=hex;
      this.$('color-readout').innerHTML=`<span class="color-chip" style="background:${hex}"></span><span>${hex}<br>RGB: ${rgb.join(', ')}</span>`;
      this.$('color-error').textContent='';this.$('use-color').disabled=false;
      this.$('color-palette').querySelectorAll('[data-color]').forEach(button=>button.classList.toggle('selected',button.dataset.color===hex));
    }catch(e){this.$('color-error').textContent=e.message;this.$('use-color').disabled=true;}
  }
  async renderVisualResult(result,version) {
    const text=typeof result==='string'?result.trim():JSON.stringify(result);
    let html='';
    if(/^mdi:[a-z0-9-]+$/.test(text)){
      await this.loadIcons();
      const icon=this.iconMap.get(text.slice(4));
      if(icon)html=`${this.iconSvg(icon)}<small>Icon preview</small>`;
    }else if(/^#[0-9a-f]{6}$/i.test(text))html=`<span class="color-chip" style="background:${hexColor(text)}"></span><small>Color preview</small>`;
    else if(this.workspace?.getAllBlocks().some(block=>block.type==='tb_color') && /^\[\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\]$/.test(text)){
      const rgb=JSON.parse(text);
      if(rgb.every(value=>value>=0&&value<=255))html=`<span class="color-chip" style="background:rgb(${rgb.join(',')})"></span><small>RGB color preview</small>`;
    }
    if(version!==this.previewVersion)return;
    this.$('visual-output').innerHTML=html;this.$('visual-output').classList.toggle('hidden',!html);
  }
  actionFormConfig() {
    const fields={ACTION:this.$('action-name').value,ENTITY:this.$('action-entity').value,DATA:this.$('action-data').value,RESPONSE:this.$('action-variable').value};
    return actionConfig({getFieldValue:name=>fields[name]});
  }
  async fetchResponse() {
    this.$('action-message').textContent='';
    try {
      const config=this.actionFormConfig();
      if(!this.hass.templateBuilderSnapshot && config.action!=='weather.get_forecasts' && !confirm(`Run ${config.action} in Home Assistant? This may change devices.`))return;
      this.$('fetch-response').disabled=true;
      this.$('action-message').textContent='Fetching response…';
      const [domain,service]=config.action.split('.');
      const result=await this.hass.callWS({type:'call_service',domain,service,service_data:config.data,...(config.entity?{target:{entity_id:config.entity}}:{}),return_response:true});
      if(result.response===null || result.response===undefined)throw new Error('This action did not return response data.');
      this.$('action-sample').value=JSON.stringify(result.response,null,2);
      this.sampleSignature=actionSignature(config);
      this.$('action-message').textContent='Sample fetched. Save & browse to select a value.';
    } catch(e){this.$('action-message').textContent=e.message||String(e);}
    finally{this.$('fetch-response').disabled=false;}
  }
  saveResponse(browse) {
    try {
      const config=this.actionFormConfig(),signature=actionSignature(config);
      const raw=this.$('action-sample').value.trim();
      if(raw && this.sampleSignature && signature!==this.sampleSignature)throw new Error('Action settings changed. Fetch a new sample or replace the sample JSON.');
      if(browse && !raw)throw new Error('Fetch or paste a sample before browsing.');
      const value=raw?JSON.parse(raw):null;
      const block=this.actionBlock;
      Blockly.Events.setGroup(true);
      try {
        block.setFieldValue(config.action,'ACTION');block.setFieldValue(config.entity,'ENTITY');block.setFieldValue(JSON.stringify(config.data),'DATA');block.setFieldValue(config.variable,'RESPONSE');
        const before=Blockly.serialization.blocks.save(block).extraState || null;
        block.responseSample=raw?{signature,value}:null;
        Blockly.Events.fire(new Blockly.Events.BlockChange(block,'mutation',null,JSON.stringify(before),JSON.stringify(block.responseSample)));
      } finally{Blockly.Events.setGroup(false);}
      this.$('action-dialog').close();this.markDirty();this.update();
      if(browse){
        this.openPicker(block.getField('PICKER'),'attribute');
        this.pickerAttributes=structuredClone(value);this.$('picker-title').textContent='Choose a response value';this.$('search').placeholder='Search response values, or enter a custom key…';this.renderAttributePicker();
      }
    }catch(e){this.$('action-message').textContent=e.message||String(e);}
  }
  toast(message) { this.$('toast').textContent=message;this.$('toast').classList.remove('hidden');clearTimeout(this.toastTimer);this.toastTimer=setTimeout(()=>this.$('toast').classList.add('hidden'),3500); }
}
customElements.define('jinja-studio-panel',TemplateBuilderPanel);
