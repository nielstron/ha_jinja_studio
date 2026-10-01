// Preserve nested Jinja expressions while separating positional/named arguments.
export function parseArguments(source) {
  const parts=[];let start=0,depth=0,quote=null,escaped=false;
  for(let i=0;i<source.length;i++){
    const char=source[i];
    if(quote){if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char===quote)quote=null;continue;}
    if(char==='"'||char==="'"){quote=char;continue;}
    if('([{'.includes(char))depth++;
    if(')]}'.includes(char))depth--;
    if(char===','&&depth===0){parts.push(source.slice(start,i).trim());start=i+1;}
  }
  if(quote||depth!==0)throw Error('Unbalanced argument expression.');
  parts.push(source.slice(start).trim());
  const positional=[],named={};
  for(const part of parts.filter(Boolean)){
    const match=part.match(/^([a-zA-Z_]\w*)\s*=(?!=)([\s\S]*)$/);
    if(match)named[match[1]]=match[2].trim();else positional.push(part);
  }
  return {positional,named};
}

const parameter=(name,extra={})=>({name,positional:true,required:false,...extra});
export function filterDefinition(catalog,name,mapMode='attribute',mappedFilter='float') {
  const filter=catalog.filters.find(filter=>filter.name===name);
  if(!filter)throw Error(`Unknown filter: ${name}`);
  if(name==='map'){
    if(mapMode==='attribute')return {...filter,parameters:[parameter('attribute',{positional:false,required:true,type:'attribute'}),parameter('default',{positional:false})],variadic:[]};
    if(mappedFilter==='map')throw Error('Chain another map block instead of mapping map.');
    const target=filterDefinition(catalog,mappedFilter);
    return {...filter,parameters:[parameter('filter',{required:true,type:'filter'}),...target.parameters],variadic:target.variadic};
  }
  if(['select','reject','selectattr','rejectattr'].includes(name))return {...filter,parameters:[...(name.endsWith('attr')?[parameter('attribute',{required:true,type:'attribute'})]:[]),parameter('test',{type:'test'}),parameter('value')],variadic:['VAR_POSITIONAL']};
  return {...filter,parameters:filter.parameters.map(p=>({...p,
    type:p.name==='attribute'?'attribute':p.type,
    choices:name==='round'&&p.name==='method'?['common','ceil','floor']:p.choices,
  }))};
}

export function argumentValue(expression='',parameter={}) {
  if(expression==='')return {type:parameter.type==='attribute'?'text':'expression',value:''};
  if(/^(true|false|True|False)$/.test(expression))return {type:'boolean',value:expression.toLowerCase()};
  if(/^-?\d+(\.\d+)?$/.test(expression))return {type:'number',value:expression};
  if(expression.startsWith('"')){try{const value=JSON.parse(expression);if(typeof value==='string')return {type:'text',value};}catch{}}
  if(/^'[^'\\]*'$/.test(expression))return {type:'text',value:expression.slice(1,-1)};
  return {type:'expression',value:expression};
}

export function expressionValue({type,value}) {
  if(type==='text')return JSON.stringify(value);
  if(value==='')return '';
  if(type==='boolean'){if(!['true','false'].includes(value))throw Error('Choose true or false.');return value;}
  if(type==='number'&&!/^-?\d+(\.\d+)?$/.test(value))throw Error('Enter a number.');
  return value;
}

export function encodeArguments(definition,values,extraPositional=[],extraNamed={}) {
  const args=[];let gap=false;
  for(const parameter of definition.parameters){
    const supplied=values[parameter.name];
    const expression=supplied?.enabled===false?'':expressionValue(supplied||{type:'expression',value:''});
    if(!expression){if(parameter.required)throw Error(`${parameter.name} is required.`);if(parameter.positional)gap=true;continue;}
    if(parameter.positional){if(gap)throw Error(`Fill the preceding positional argument before ${parameter.name}.`);args.push(expression);}
    else args.push(`${parameter.name}=${expression}`);
  }
  const extra=extraPositional.map(value=>expressionValue(value)).filter(Boolean);
  // Positional arguments must precede all keyword arguments.
  const index=args.findIndex(value=>/^[a-zA-Z_]\w*=/.test(value));
  args.splice(index<0?args.length:index,0,...extra);
  for(const [name,value] of Object.entries(extraNamed)){
    if(!/^[a-zA-Z_]\w*$/.test(name))throw Error(`Invalid argument name: ${name}`);
    const expression=expressionValue(value);if(expression)args.push(`${name}=${expression}`);
  }
  return args.join(', ');
}
