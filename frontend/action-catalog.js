const humanize = value => value.replace(/_/g,' ').replace(/^./,c=>c.toUpperCase());

export function actionCatalog(services, localize=()=>null) {
  return Object.entries(services).flatMap(([domain,actions])=>Object.entries(actions).map(([service,metadata])=>({
    id:`${domain}.${service}`,domain,service,
    name:localize(`component.${domain}.services.${service}.name`) || metadata.name || humanize(service),
    description:localize(`component.${domain}.services.${service}.description`) || metadata.description || '',
    response:metadata.response !== undefined && metadata.response !== null,
    optionalResponse:metadata.response?.optional === true,
    metadata,
  }))).sort((a,b)=>a.domain.localeCompare(b.domain)||a.name.localeCompare(b.name));
}

export function filterActions(catalog,{query='',domain='',responseOnly=true}={}) {
  const words=query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return catalog.filter(action=>(!domain || action.domain===domain) && (!responseOnly || action.response) && words.every(word=>`${action.id} ${action.name} ${action.description}`.toLowerCase().includes(word)));
}

export function actionFields(action,localize=()=>null) {
  const fields=[];
  function visit(definitions) {
    for(const [key,field] of Object.entries(definitions)){
      if(field.fields){visit(field.fields);continue;}
      fields.push({key,name:localize(`component.${action.domain}.services.${action.service}.fields.${key}.name`)||field.name||humanize(key),description:localize(`component.${action.domain}.services.${action.service}.fields.${key}.description`)||field.description||'',required:field.required===true,options:(field.selector?.select?.options||[]).map(option=>typeof option==='string'?option:option.value),...(Object.hasOwn(field,'default')?{default:field.default}:{})});
    }
  }
  visit(action.metadata.fields || {});
  return fields;
}

export function actionDefaults(action) {
  return Object.fromEntries(actionFields(action).filter(field=>Object.hasOwn(field,'default')).map(field=>[field.key,field.default]));
}
