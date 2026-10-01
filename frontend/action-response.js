const reserved = new Set('ns true false none True False None loop self super caller range dict namespace states state_attr is_state is_state_attr has_value now utcnow expand pi e this for if else elif set macro endfor endif endmacro import from as in is not and or with endwith filter endfilter block endblock extends include raw endraw do break continue'.split(' '));

export function actionConfig(block) {
  const action = block.getFieldValue('ACTION').trim();
  if (!/^[a-z_]\w*\.[a-z_]\w*$/.test(action)) throw new Error('Action must be domain.action, e.g. weather.get_forecasts.');
  const entity = block.getFieldValue('ENTITY').trim();
  if (entity && !/^[a-z_]\w*\.[a-z0-9_]+$/.test(entity)) throw new Error('Choose a valid target entity ID, or leave it empty for an untargeted action.');
  const data = JSON.parse(block.getFieldValue('DATA'));
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Action data must be a JSON object.');
  const variable = block.getFieldValue('RESPONSE').trim();
  if (!/^[a-zA-Z_]\w*$/.test(variable) || reserved.has(variable)) throw new Error('Response variable must be a non-reserved identifier, e.g. forecasts.');
  return {action,entity,data,variable};
}

export const actionSignature = config => JSON.stringify([config.action,config.entity,config.data]);

export function actionInputs(workspace) {
  const inputs = new Map();
  for (const block of workspace.getAllBlocks(false)) {
    if (block.type !== 'ha_action_response') continue;
    let enabled=true;
    for(let parent=block;parent;parent=parent.getParent())if(!parent.isEnabled()){enabled=false;break;}
    if(!enabled)continue;
    const config = actionConfig(block);
    const signature = actionSignature(config);
    const previous = inputs.get(config.variable);
    if (previous && previous.signature !== signature) throw new Error(`Response variable ${config.variable} is used for different actions.`);
    const sample = block.responseSample?.signature === signature ? block.responseSample : null;
    if (previous?.sample && sample && JSON.stringify(previous.sample.value) !== JSON.stringify(sample.value)) throw new Error(`Response variable ${config.variable} has different samples. Fetch the same response or use different variable names.`);
    inputs.set(config.variable,{...config,signature,sample:sample || previous?.sample});
  }
  return [...inputs.values()];
}

export function responseVariables(inputs) {
  return Object.fromEntries(inputs.map(input => {
    if (!input.sample) throw new Error(`Fetch or paste a sample for ${input.variable} using its Configure / browse field.`);
    return [input.variable,input.sample.value];
  }));
}

export function requiredActions(inputs) {
  return inputs.map(input => `- action: ${input.action}\n${input.entity ? `  target:\n    entity_id: ${JSON.stringify(input.entity)}\n` : ''}  data: ${JSON.stringify(input.data)}\n  response_variable: ${input.variable}`).join('\n');
}
