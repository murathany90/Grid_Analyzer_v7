import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
const runtime=fs.readFileSync(new URL('../../tools/psse-sld/studio_runtime.js',import.meta.url),'utf8');
const ts=fs.readFileSync(new URL('../../src/features/psse/sld-binary-codec.ts',import.meta.url),'utf8');
const load=code=>{const context={Uint8Array,DataView,TextEncoder,atob,structuredClone,performance};vm.createContext(context);vm.runInContext(code+';globalThis.api={parseSldBinary,serializeSldBinary};',context);return context.api;};
const apis=[['TypeScript',load(stripTypeScriptTypes(ts).replace(/^export /gm,''))],['browser',load(runtime.slice(runtime.indexOf('/* GENERATED CODEC START */'),runtime.indexOf('/* Part 2:')))]];
const fixture=id=>({format:'ga-sld-v1',fileVersion:'2.0.51.1',layers:[{n:0,desc:'Public fixture',vis:'Visible'}],components:[{id,t:'Symbol',stype:'Busbar',map:'BU 101',pos:[0,0],len:3,width:.1,rot:90,layer:0,color:255},{id:id+1,t:'Label',text:'Public label',owner:id,pos:[0,.4],layer:0,color:255}]});
for(const [name,api]of apis){
 test(name+': optional selected CArchive object preserves shared identity',()=>{
  for(const id of [1,37,2915,70001])for(const version of ['2.0.49.3','2.0.51.1']){
   const d=api.parseSldBinary(api.serializeSldBinary(fixture(id),version));
   d._u2=1;d._rawSelected=d.components.find(c=>c.id===id)._rawObj;d.selectedObjectId=id;
   const before=structuredClone(d),bytes=api.serializeSldBinary(d,version),r=api.parseSldBinary(bytes);
   assert.deepEqual(structuredClone(d),before,'serialize mutated source graph');
   assert.equal(r.selectedObjectId,id);const selected=Array.isArray(r._rawSelected)?r._rawSelected[2]:r._rawSelected;
   assert.equal(selected,r.components.find(c=>c.id===id)._rawObj);
   assert.equal(r.layers.length,d.layers.length);assert.equal(r.components.length,2);
   assert.equal(api.parseSldBinary(api.serializeSldBinary(r,version)).selectedObjectId,id);
  }
 });
 const directory=process.env.PSSE_SLD_DIR??new URL('../../control1/sld örnekleri/',import.meta.url);
 const names=fs.existsSync(directory)?fs.readdirSync(directory).filter(n=>n.toLowerCase().endsWith('.sld')):[];
 test(name+': private native regression files (read only)',{skip:!names.length},()=>{
  for(const filename of names){const file=new URL(encodeURIComponent(filename),typeof directory==='string'?new URL('file:///'+directory.replaceAll('\\','/')+'/'):directory);const d=api.parseSldBinary(new Uint8Array(fs.readFileSync(file))),r=api.parseSldBinary(api.serializeSldBinary(d,d.fileVersion));
   assert.equal(r.components.length,d.components.length,filename);assert.equal(r.layers.length,d.layers.length,filename);assert.equal(r.selectedObjectId,d.selectedObjectId,filename);
   const count=d.components.reduce((r,c)=>(r[c.t]=(r[c.t]??0)+1,r),{});if(filename.includes('OAYTM')){assert.deepEqual(count,{Symbol:751,Link:856,Label:4473});assert.equal(d.layers.length,11);assert.equal(d.selectedObjectId,2915);}
   console.log(name,filename,JSON.stringify(count),d.layers.length,'layers; selected',d.selectedObjectId??'none');
  }
 });
}
