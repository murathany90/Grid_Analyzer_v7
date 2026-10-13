import assert from 'node:assert/strict';import {verifySeriesSvg} from './sld-v32-geometry.mjs';
import {nativeSeriesEvidence} from './sld-v32-native-series.mjs';
export async function sldV32BrowserAcceptance(page){
 const names=await page.evaluate(async()=>{const {circuitNames}=await import('/tests/helpers/sld-v32-circuits.ts');return circuitNames;});let count=0;
 for(const name of names)for(const orientation of ['vertical','horizontal']){
  const golden=await page.evaluate(async({name,orientation})=>{
   const {sourceCircuit}=await import('/tests/helpers/sld-v32-circuits.ts'),{SvgSldRenderer}=await import('/src/features/sld/sld-renderer.ts'),{allVoltageBands}=await import('/src/domain/model/voltage-band.ts');
   const f=sourceCircuit(name),g=f.graph,host=document.createElement('div');host.style.width='1440px';host.style.height='900px';document.querySelector('#app').replaceChildren(host);
   const equipment=[...g.equipment.map(e=>({id:e.id,name:e.name,sourceClass:e.sourceClass,busIds:e.terminals,siteIds:['S'],inService:true,voltageKv:400,lvKv:33})),...g.switches.map(s=>({id:s.id,name:s.id,sourceClass:s.sourceClass,busIds:[s.from,s.to],siteIds:['S'],inService:true,closed:f.network.switches.find(e=>e.id===s.id).closed}))];
   const d={scope:orientation==='horizontal'?'bay':'station',station:f.network.sites[0],selectedId:null,orientation,groups:[],equipment,bays:f.source.bays,selectedBay:{id:'F',name:'Source feeder'},terminals:[],switches:[],regionalSites:[],regionalBranches:[],unresolvedSwitches:0,graph:g,voltageBands:allVoltageBands(),page:0,technical:false,scenario:{...ctx.scenario.current,switchState:{}},settings:ctx.settings.value,n1Detail:null,selectedN1IslandId:null,lod:'overview'};
   new SvgSldRenderer().render(host,d,()=>{});if(host.querySelectorAll('[data-physical-switch]').length!==(orientation==='horizontal'?g.switches.filter(s=>s.bayId==='F').length:g.switches.length))throw Error('Native switch omitted: '+name);
   const main=name==='coupler'?[]:f.main,branches=name==='coupler'?[...f.main,...f.branches]:[...f.branches,...(name==='unknown-order'?g.switches.filter(s=>s.from===s.to).map(s=>({id:s.id,from:s.from,to:s.to,sourceClass:s.sourceClass,usage:s.sourceUsage,unresolved:true})):[])];
   return {orientation,fixture:{graph:g},feeders:[{id:'F',main,branches}]};
  },{name,orientation});const proof=await verifySeriesSvg(page,golden);if(orientation==='vertical')await nativeSeriesEvidence(page,golden.fixture);if(name==='bypass'&&orientation==='vertical')assert.equal(proof.unrelatedRailCrossings,0,'Foreign selector must detour outside real rails');count++;
  if(name==='breaker-line'&&orientation==='vertical'){
   // Recreate the reported defect while retaining source IDs, native endpoints,
   // fixed-contact attachment and inventory. The independent test must reject it.
   await page.locator('[data-physical-switch="ElmCoup|SW0"]').evaluate(g=>{const glyph=g.querySelector('[data-device-glyph]');glyph.setAttribute('transform','translate(32 0) '+glyph.getAttribute('transform'));for(const path of g.querySelectorAll('path[data-connection]')){const n=path.getAttribute('d').match(/-?\d+(?:\.\d+)?/g).map(Number),a=[n[0],n[1]],b=n.slice(-2);if(path.dataset.contactSide==='FROM')b[0]+=32;else a[0]+=32;path.setAttribute('d',`M${a} L${a[0]},${b[1]} L${b}`);}for(const key of ['contactFrom','contactTo','contactIn','contactOut']){const n=g.dataset[key].split(',').map(Number);n[0]+=32;g.dataset[key]=n.join(',');}});
   await assert.rejects(()=>verifySeriesSvg(page,golden),/off-axis|false external bypass/);
  }
 }
 assert.equal(count,26);console.log('SLD V3.2 P0 browser PASS: 13 independent native circuits × 2 orientations; actual fixed contacts, source order, inline series, open gaps, branched series and real bypasses.');
}
