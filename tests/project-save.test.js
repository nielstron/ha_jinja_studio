import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BlocklyCore as Blockly} from '../frontend/blocks.js';

let Panel;
globalThis.HTMLElement=class {};
globalThis.customElements={define:(_name,element)=>{Panel=element;}};
await import('../frontend/panel.js');

test('saving a new project works on HTTP without crypto.randomUUID',async()=>{
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'crypto');
  Object.defineProperty(globalThis,'crypto',{configurable:true,value:{}});
  const workspace=new Blockly.Workspace();
  const fields={name:{value:'HTTP project'},saved:{textContent:''}};
  const requests=[];
  const panel=Object.assign(Object.create(Panel.prototype),{
    workspace,template:'{{ 42 }}',projectId:null,
    $:id=>fields[id],
    _hass:{callWS:async message=>{requests.push(message);return {[message.project_id]:message.project};}},
    renderProjects(){},writeDraft(){},toast(){},
  });
  try {
    await panel.save();
    assert.equal(requests.length,1);
    assert.equal(requests[0].action,'save');
    assert.equal(requests[0].project.name,'HTTP project');
    assert.equal(requests[0].project_id,panel.projectId);
    assert.ok(panel.projectId);
    assert.equal(fields.saved.textContent,'Saved');
    await panel.save();
    assert.equal(requests[1].project_id,requests[0].project_id);
  } finally {
    workspace.dispose();
    Object.defineProperty(globalThis,'crypto',descriptor);
  }
});
