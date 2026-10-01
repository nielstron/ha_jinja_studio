import {test} from 'node:test';
import assert from 'node:assert/strict';
import {registerStudioRoute,extendToolsClasses,STUDIO_PAGE} from '../frontend/tools-tab.js';

test('Tools route adds Jinja Studio without replacing built-in routes and is idempotent',()=>{
  const yaml={tag:'tools-yaml-config'},router={routerOptions:{routes:{yaml}}};
  assert.equal(registerStudioRoute(router),true);
  assert.equal(router.routerOptions.routes.yaml,yaml);
  assert.equal(router.routerOptions.routes[STUDIO_PAGE].tag,'jinja-studio-panel');
  assert.equal(registerStudioRoute(router),false);
  assert.equal(registerStudioRoute({}),false);
});

test('route is registered before native lifecycle hooks and hooks are not double-wrapped',()=>{
  const calls=[];
  class Router{
    routerOptions={routes:{yaml:{tag:'tools-yaml-config'}}};
    connectedCallback(){calls.push(['connected',!!this.routerOptions.routes[STUDIO_PAGE]]);}
    willUpdate(){calls.push(['update',!!this.routerOptions.routes[STUDIO_PAGE]]);}
  }
  class Panel{updated(){calls.push(['panel']);}}
  extendToolsClasses(Panel,Router);
  const patched=Router.prototype.connectedCallback;
  extendToolsClasses(Panel,Router);assert.equal(Router.prototype.connectedCallback,patched);
  const router=new Router();router.connectedCallback();router.willUpdate(new Map());
  const panel=new Panel();panel.updated(new Map());
  assert.deepEqual(calls,[['connected',true],['update',true],['panel']]);
});
