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
 test(name+': native line style/width and font use independently captured Slider API records',()=>{
  const evidence=JSON.parse(fs.readFileSync(new URL('./fixtures/native-sld-fields.json',import.meta.url),'utf8'));
  const input=fixture(100);input.components.push({id:110,t:'Symbol',stype:'Busbar',map:'BU 102',pos:[4,0],rot:90,len:2,width:.05,layer:0,color:255},{id:120,t:'Link',p1:{sym:100,idx:0,pos:[0,0]},p2:{sym:110,idx:0,pos:[4,0]},layer:0,color:255,lstyle:evidence.api.enums.Dash,lwidth:.027});
  input.components[1].fh=9.1;input.components[1].font='Tahoma';
  let d=api.parseSldBinary(api.serializeSldBinary(input));const link=d.components.find(c=>c.id===120),label=d.components.find(c=>c.id===101);
  assert.equal(link.lstyle,evidence.api.link.lstyle);assert(Math.abs(link.lwidth-evidence.api.link.lwidth)<1e-7);assert.equal(label.fh*10,evidence.api.label.fh);
  assert.deepEqual([...link._rawObj.link_pre_knees].slice(0,8),evidence.samples[1].linkPreKnees.slice(0,8));
  assert.equal(label._rawObj.comp_post_map[9]&128,evidence.samples[2].labelPostMap[9]&128,'native custom-font flag');
  link.lstyle=evidence.api.enums.Dot;link.lwidth=.04;label.fh=8.5;
  d=api.parseSldBinary(api.serializeSldBinary(d));assert.equal(d.components.find(c=>c.id===120).lstyle,evidence.api.enums.Dot);assert.equal(d.components.find(c=>c.id===101).fh,8.5);
  for(const [sdef,status,display]of [[10,1,evidence.displayIndexEvidence.transformer],[3,1,evidence.displayIndexEvidence.systemSwitchClosed],[3,0,evidence.displayIndexEvidence.systemSwitchOpen]]){
   const doc=fixture(200);doc.components[0]={id:200,t:'Symbol',stype:'Branch',psse:sdef===10?'Transformer':'SwitchingDev',sdef,sourceStatus:status,map:`${sdef===10?'TR':'SYS'} 101 102 1`,pos:[0,0],layer:0,color:255,rot:270};
   const r=api.parseSldBinary(api.serializeSldBinary(doc));assert.equal(r.components.find(c=>c.id===200).displayIndex,display);
  }
 });
 test(name+': synthetic authored fonts, provenance, imported Label additions and graph deletion',()=>{
  for(const version of ['2.0.49.3','2.0.51.1']){
   const input=fixture(100),provenance={schema:'ga.sld.result.v1',key:'bus:100',resultId:'synthetic-unit',sourceSha256:'synthetic',scenarioHash:'synthetic',method:'LOSSLESS_DC'};
   input.components[1].fh=8.5;input.components[1].gaResult=provenance;
   const d=api.parseSldBinary(api.serializeSldBinary(input,version));assert.equal(d.components.find(c=>c.t==='Label').fh,8.5);
   const label=d.components.find(c=>c.t==='Label');assert.deepEqual({...label.gaResult},provenance);label.fh=12;label.font='Tahoma';label.vis=false;
   d.components.push({id:102,t:'Label',owner:100,text:'user label',pos:[1,1],layer:0,color:255,fh:11});
   let r=api.parseSldBinary(api.serializeSldBinary(d,version));assert.equal(r.components.length,3);const edited=r.components.find(c=>c.id===101);assert.equal(edited.fh,12);assert.equal(edited.font,'Tahoma');assert.equal(edited.vis,false);
   r.components=r.components.filter(c=>c.id!==101);r=api.parseSldBinary(api.serializeSldBinary(r,version));assert.deepEqual([...r.components.map(c=>c.id)].sort(),[100,102]);assert.equal(r.components.find(c=>c.id===102).owner,100);
  }
 });
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
   const byId=new Map(r.components.map(c=>[c.id,c]));
   for(const c of d.components){const actual=byId.get(c.id);for(const key of ['map','sdef','rot','layer','fh','font','fw','vis','text','owner'])assert.equal(actual[key],c[key],`${filename} #${c.id}.${key}`);
    for(const key of ['sym_tail','link_pre_knees','link_tail','lbl_font_info','comp_post_map'])if(c._rawObj[key])assert.deepEqual([...actual._rawObj[key]],[...c._rawObj[key]],`${filename} #${c.id}.${key}`);
    if(c.t==='Link')for(const side of ['p1','p2']){assert.equal(actual[side].sym,c[side].sym);assert.equal(actual[side].idx,c[side].idx);for(let i=0;i<2;i++)assert(Math.abs(actual[side].pos[i]-c[side].pos[i])<=1e-4);}
   }
   const count=d.components.reduce((r,c)=>(r[c.t]=(r[c.t]??0)+1,r),{});if(filename.includes('OAYTM')){assert.deepEqual(count,{Symbol:751,Link:856,Label:4473});assert.equal(d.layers.length,11);assert.equal(d.selectedObjectId,2915);}
   console.log(name,filename,JSON.stringify(count),d.layers.length,'layers; selected',d.selectedObjectId??'none');
  }
 });
}
