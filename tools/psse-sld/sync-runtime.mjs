// Keep both browser entry points generated from one codec and one layout source.
import fs from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
const root=new URL('../../',import.meta.url);
const source=await fs.readFile(new URL('src/features/psse/sld-binary-codec.ts',root),'utf8');
const codec=stripTypeScriptTypes(source).replace(/^export /gm,'').split(/\r?\n/).map(l=>l.trimEnd()).join('\n');
const layout=await fs.readFile(new URL('tools/psse-sld/studio_layout.js',root),'utf8');
const model=await fs.readFile(new URL('tools/psse-sld/studio_model.js',root),'utf8');
const file=new URL('tools/psse-sld/studio_runtime.js',root);
const previous=await fs.readFile(file,'utf8');
const start=previous.indexOf('/* GENERATED CODEC START */'),end=previous.indexOf('/* Part 2:');
if(start<0||end<start)throw Error('Missing generated runtime boundaries');
const runtime=previous.slice(0,start)+'/* GENERATED CODEC START */\n'+codec+'\n\n'+layout+'\n'+model+'\n'+previous.slice(end);
await fs.writeFile(file,runtime.replace(/\r\n/g,'\n'));
await fs.writeFile(new URL('src/features/psse/sld-studio-runtime.js',root),'export function startSldStudio(){\n'+runtime.replace(/\r\n/g,'\n')+'\n}\n');
const css=(await fs.readFile(new URL('tools/psse-sld/studio_style.css',root),'utf8')).replace(/\r\n/g,'\n').replaceAll('.psse-module ','');
await fs.writeFile(new URL('src/features/psse/sld-studio.ts',root),`import { startSldStudio } from './sld-studio-runtime.js';
/* Generated from tools/psse-sld by sync-runtime.mjs. */
export function mountPsseSldStudio(): void {
  if (typeof window === 'undefined' || (window as any).__GA_SLD_STUDIO_MOUNTED__) return;
  (window as any).__GA_SLD_STUDIO_MOUNTED__ = true;
  if (!document.getElementById('ga-sld-studio-style')) {
    const style = document.createElement('style'); style.id = 'ga-sld-studio-style';
    style.textContent = ${JSON.stringify(css)};
    document.head.append(style);
  }
  startSldStudio();
}
`);
console.log('Synchronized codec, layout and browser runtime entry points');
