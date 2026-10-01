import { build } from 'esbuild';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';

const destination = 'custom_components/jinja_studio/frontend';
await mkdir(destination, { recursive: true });
await build({
  entryPoints: ['frontend/panel.js'],
  outfile: `${destination}/panel.js`,
  bundle: true,
  format: 'esm',
  minify: true,
  target: 'es2022',
  legalComments: 'eof',
});
await build({entryPoints:['frontend/tools-tab.js'],outfile:`${destination}/tools-tab.js`,bundle:true,format:'esm',minify:true,target:'es2022',legalComments:'eof',external:['/jinja_studio_static/*']});
await cp('node_modules/blockly/media', `${destination}/media`, { recursive: true });
const metadata=JSON.parse(await readFile('node_modules/@mdi/svg/meta.json','utf8'));
const icons=[];
for(const icon of metadata){
  const svg=await readFile(`node_modules/@mdi/svg/svg/${icon.name}.svg`,'utf8');
  const [,path]=svg.match(/<path d="([^"]+)"/);
  icons.push({name:icon.name,aliases:icon.aliases,tags:icon.tags,path});
}
await writeFile(`${destination}/icons.json`,JSON.stringify(icons));
await writeFile(`${destination}/MDI-LICENSE`,(await readFile('node_modules/@mdi/svg/LICENSE','utf8')).replace(/\r\n/g,'\n'));
console.log(`Built self-contained panel, Blockly media and ${icons.length} MDI icons (lazy-loaded).`);
