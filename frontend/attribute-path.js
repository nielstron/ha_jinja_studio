import { BlocklyCore as Blockly } from './blocks.js';

// A path uses typed steps so dictionary keys such as "0" remain strings.
export function resolveAttributePath(attributes, path) {
  return path.reduce((value, step) => step.kind === 'json' ? JSON.parse(value) : value[step.value], attributes);
}

export function containerValue(value) {
  if (typeof value === 'string' && /^[\s]*[\[{]/.test(value)) {
    try {
      const parsed = JSON.parse(value);
      if (parsed !== null && typeof parsed === 'object') return { value: parsed, json: true };
    } catch { /* A string that resembles JSON can still be ordinary text. */ }
  }
  return { value, json: false };
}

export function valueSummary(value) {
  const decoded = containerValue(value);
  const prefix = decoded.json ? 'JSON · ' : '';
  const data = decoded.value;
  if (Array.isArray(data)) return `${prefix}list · ${data.length} items`;
  if (data !== null && typeof data === 'object') return `${prefix}object · ${Object.keys(data).length} keys`;
  return value === null ? 'null' : String(value);
}

export function attributeChildren(attributes, path) {
  const value = resolveAttributePath(attributes, path);
  const array = Array.isArray(value);
  return Object.entries(value).map(([key, child]) => {
    const step = { kind: array ? 'index' : 'key', value: array ? Number(key) : key };
    const decoded = containerValue(child);
    return {
      label: array ? `[${key}]` : key,
      summary: valueSummary(child),
      path: [...path, step],
      browsePath: [...path, step, ...(decoded.json ? [{ kind: 'json' }] : [])],
      container: decoded.value !== null && typeof decoded.value === 'object',
    };
  });
}

const marker = root => JSON.stringify({ attributeRoot: root.id });

export function applyAttributePath(root, path) {
  const response = root.type === 'ha_action_response';
  if (!response && (!path.length || path[0].kind !== 'key')) throw new Error('An attribute path must start with an attribute key.');
  const workspace = root.workspace;
  let outer = root;
  // Replace only wrappers previously made by this picker; keep the consumer.
  while (outer.getParent()?.data === marker(root) && outer.getParent().getInputTargetBlock('VALUE') === outer) {
    outer = outer.getParent();
  }
  const target = outer.outputConnection.targetConnection;
  const position = workspace.rendered ? outer.getRelativeToSurfaceXY() : null;
  const group = Blockly.Events.getGroup();
  Blockly.Events.setGroup(true);
  try {
    if (target) outer.outputConnection.disconnect();
    if (outer !== root) {
      root.outputConnection.disconnect();
      outer.dispose(false);
    }
    if (!response) root.setFieldValue(path[0].value, 'ATTRIBUTE');
    let current = root;
    for (const step of response ? path : path.slice(1)) {
      const type = { key: 'tb_property', index: 'tb_index', json: 'tb_filter' }[step.kind];
      const block = workspace.newBlock(type);
      if (response) block.setInputsInline(false);
      block.data = marker(root);
      if (step.kind === 'key') block.setFieldValue(step.value, 'KEY');
      if (step.kind === 'json') { block.setFieldValue('from_json', 'FILTER'); block.setFieldValue('', 'ARGS'); }
      if (workspace.rendered) block.initSvg();
      block.getInput('VALUE').connection.connect(current.outputConnection);
      if (step.kind === 'index') {
        const index = workspace.newBlock('math_number');
        index.setFieldValue(step.value, 'NUM');
        if (workspace.rendered) index.initSvg();
        block.getInput('INDEX').connection.connect(index.outputConnection);
        if (workspace.rendered) index.render();
      }
      if (workspace.rendered) block.render();
      current = block;
    }
    if (target) target.connect(current.outputConnection);
    else if (position) {
      const here = current.getRelativeToSurfaceXY();
      current.moveBy(position.x - here.x, position.y - here.y);
    }
    if (workspace.rendered) root.render();
    return current;
  } finally { Blockly.Events.setGroup(group); }
}
