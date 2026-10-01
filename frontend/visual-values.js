export function iconName(value) {
  const name=value.trim().toLowerCase().replace(/^mdi:/,'');
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name))throw new Error('Choose an MDI icon, e.g. mdi:lightbulb.');
  return `mdi:${name}`;
}

export function hexColor(value) {
  let hex=value.trim().toLowerCase();
  if(/^#[0-9a-f]{3}$/.test(hex))hex='#'+[...hex.slice(1)].map(c=>c+c).join('');
  if(!/^#[0-9a-f]{6}$/.test(hex))throw new Error('Enter a hex color, e.g. #ff9800.');
  return hex;
}

export function colorRgb(value) {
  const hex=hexColor(value);
  return [1,3,5].map(offset=>parseInt(hex.slice(offset,offset+2),16));
}

const popular=['lightbulb','lightbulb-outline','home','thermometer','weather-sunny','weather-cloudy','weather-rainy','battery','battery-alert','power','check-circle','alert','robot-vacuum','door','window-open','water','fan','bed','sofa','palette'];
export function searchIcons(icons,query='') {
  const words=query.toLowerCase().replace(/^mdi:/,'').trim().split(/\s+/).filter(Boolean);
  if(!words.length){
    const priorities=new Map(popular.map((name,index)=>[name,index]));
    return [...icons].sort((a,b)=>(priorities.get(a.name)??popular.length)-(priorities.get(b.name)??popular.length)||a.name.localeCompare(b.name));
  }
  return icons.filter(icon=>words.every(word=>`${icon.name} ${icon.aliases.join(' ')} ${icon.tags.join(' ')}`.toLowerCase().includes(word))).sort((a,b)=>(a.name===words.join('-')?-1:0)-(b.name===words.join('-')?-1:0)||a.name.localeCompare(b.name));
}

export const colorPalette=[
  ['Red','#f44336'],['Pink','#e91e63'],['Purple','#9c27b0'],['Deep purple','#673ab7'],['Indigo','#3f51b5'],['Blue','#2196f3'],['Light blue','#03a9f4'],['Cyan','#00bcd4'],['Teal','#009688'],['Green','#4caf50'],['Light green','#8bc34a'],['Lime','#cddc39'],['Yellow','#ffeb3b'],['Amber','#ffc107'],['Orange','#ff9800'],['Deep orange','#ff5722'],['Brown','#795548'],['Grey','#9e9e9e'],['Black','#000000'],['White','#ffffff'],
];
