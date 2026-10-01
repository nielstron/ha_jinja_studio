// HA has no public Tools-tab registration API. Keep the version-sensitive hook
// here; the independently registered /jinja-studio panel is the fallback.
export const STUDIO_PAGE='jinja-studio';
const patched=Symbol.for('jinja_studio.tools_tab');
const route={tag:'jinja-studio-panel',load:()=>import('/jinja_studio_static/panel.js?v=0.1.1')};

export function registerStudioRoute(router) {
  if(!router.routerOptions?.routes)return false;
  if(router.routerOptions.routes[STUDIO_PAGE]===route)return false;
  router.routerOptions.routes[STUDIO_PAGE]=route;
  return true;
}

export function syncStudioTab(panel) {
  const group=panel.shadowRoot?.querySelector('ha-tab-group');
  if(!group)return;
  let tab=group.querySelector('[data-jinja-studio-tab]');
  const enabled=panel.hass?.user?.is_admin && panel.hass?.panels?.[STUDIO_PAGE];
  if(!enabled){tab?.remove();return;}
  if(!tab){
    tab=document.createElement('ha-tab-group-tab');tab.slot='nav';tab.panel=STUDIO_PAGE;tab.setAttribute('panel',STUDIO_PAGE);tab.dataset.jinjaStudioTab='';
    const link=document.createElement('a');link.href=`/config/tools/${STUDIO_PAGE}`;link.textContent='Jinja Studio';
    link.addEventListener('click',event=>{
      if(event.button!==0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)return;
      event.preventDefault();event.stopPropagation();
      panel._handlePageSelected({detail:{name:STUDIO_PAGE}});
    });
    tab.append(link);group.append(tab);
  }
  tab.active=panel.route.path.replace(/^\//,'')===STUDIO_PAGE;
  const router=panel.shadowRoot.querySelector('tools-router');
  if(router && registerStudioRoute(router))router.requestUpdate();
}

export function extendToolsClasses(Panel,Router) {
  if(!Router.prototype[patched]){
    const connected=Router.prototype.connectedCallback;
    Router.prototype.connectedCallback=function(){registerStudioRoute(this);connected.call(this);};
    const willUpdate=Router.prototype.willUpdate;
    Router.prototype.willUpdate=function(changes){registerStudioRoute(this);willUpdate?.call(this,changes);};
    Router.prototype[patched]=true;
  }
  if(!Panel.prototype[patched]){
    const updated=Panel.prototype.updated;
    Panel.prototype.updated=function(changes){updated?.call(this,changes);syncStudioTab(this);};
    Panel.prototype[patched]=true;
  }
}

if(globalThis.customElements){
  Promise.all([customElements.whenDefined('ha-panel-tools'),customElements.whenDefined('tools-router')]).then(()=>{
    extendToolsClasses(customElements.get('ha-panel-tools'),customElements.get('tools-router'));
  });
}
