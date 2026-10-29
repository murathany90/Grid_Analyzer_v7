import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {engine,readModel,worker,saveEvidence} from './helpers.mjs';
import {ScenarioStore,deepFreeze} from '../src/modules/psse/scenarios/store.js';
import {resultStatus,fullAcEvidence} from '../src/modules/psse/calculations/status.js';
import {unpackModel} from '../src/modules/psse/importers/archive.js';
import {applyExtendedOperation,validateExtendedOperation} from '../src/modules/psse/scenarios/operations.js';
import {inspectAttachments} from '../src/modules/psse/importers/attachments.js';
import {ratePresentation} from '../src/modules/psse/calculations/rating.js';
const model=await readModel(),network=deepFreeze(engine.No(model)),counts={};
for(const e of model.equipment)counts[e.kind]=(counts[e.kind]??0)+1;
await saveEvidence('real-model',{source:model.source,counts,buses:network.buses.length,normalizedBranches:network.branches.length,findings:network.findings});
test('real SAV exact inventory and collision-free electrical identities',()=>{
  assert.equal(counts.bus,6851);assert.equal(counts.line,2403);assert.equal(counts.transformer,3703);assert.equal(counts.substation,1618);
  assert.equal(new Set(network.buses.map(b=>b.connectionKey)).size,network.buses.length);
  assert.equal(new Set(network.branches.map(b=>b.id)).size,network.branches.length);
  assert(network.branches.every(b=>network.buses[b.from]&&network.buses[b.to]));
  assert.equal(network.branches.filter(b=>b.kind==='line'&&b.sourceEquipmentId.startsWith('line:')).length,2403);
  const groups=new Map();for(const branch of network.branches.filter(b=>b.kind==='three-winding-leg')){if(!groups.has(branch.sourceEquipmentId))groups.set(branch.sourceEquipmentId,[]);groups.get(branch.sourceEquipmentId).push(branch);}
  for(const legs of groups.values()){assert.equal(legs.length,3);assert.equal(new Set(legs.map(b=>b.windingId)).size,3);assert(legs.every(b=>network.buses[b.from].source&&!network.buses[b.to].source));}
});
test('RAW parser preserves real source counts and terminal identities',async()=>{
  const raw=await readModel('control1/20261014_1200_SN3_TR0.raw'),n=engine.No(raw);
  assert.equal(raw.equipment.filter(e=>e.kind==='bus').length,6851);assert.equal(raw.equipment.filter(e=>e.kind==='line').length,2403);
  assert.equal(new Set(n.branches.map(b=>b.id)).size,n.branches.length);
  await saveEvidence('raw-model',{source:raw.source,counts:Object.fromEntries([...new Set(raw.equipment.map(e=>e.kind))].map(k=>[k,raw.equipment.filter(e=>e.kind===k).length])),findings:n.findings});
});
test('three-winding transformer retains physical terminals, star node and winding service states',async()=>{
  const m=await readModel('tests/fixtures/three-winding.raw'),n=engine.No(m),legs=n.branches.filter(b=>b.kind==='three-winding-leg');
  assert.equal(legs.length,3);assert.equal(n.buses.filter(b=>b.source).length,3);assert.equal(n.buses.filter(b=>!b.source).length,1);assert.deepEqual(legs.map(b=>b.status),[1,0,1]);assert.equal(new Set(legs.map(b=>b.windingId)).size,3);assert(legs.every(b=>n.buses[b.from].source&&!n.buses[b.to].source));
});
test('real PSS/E ZIP selects SAV and preserves sidecars; DGS ZIP is rejected',async()=>{
  const path='control1/20261014_1200_SN3_TR0(psse_sav+digerdosyalar).zip',bundle=await unpackModel(new File([await fs.readFile(path)],path));
  assert(bundle.model.name.endsWith('.sav'));assert.equal(bundle.sidecars.length,5);
  const parsed=await(await worker('parser'))({file:bundle.model});assert.equal(parsed.source.sha256,crypto.createHash('sha256').update(new Uint8Array(await bundle.model.arrayBuffer())).digest('hex'));assert.equal(parsed.equipment.filter(e=>e.kind==='bus').length,6851);
  await saveEvidence('zip-model',{source:parsed.source,counts:Object.fromEntries([...new Set(parsed.equipment.map(e=>e.kind))].map(k=>[k,parsed.equipment.filter(e=>e.kind===k).length])),sidecars:bundle.sidecars.map(f=>f.name)});
  const attachments=await inspectAttachments(parsed.source.sha256,bundle.sidecars,engine.z);assert.equal(attachments.items.length,5);assert(attachments.items.find(item=>item.format==='INVENTORY_JSON').catalog.tables.length>0);
  const dgs='control1/20261014_1200_SN3_TR0 (digslient_json).zip';await assert.rejects(()=>unpackModelFile(dgs),/PSS\/E/);
  async function unpackModelFile(p){return unpackModel(new File([await fs.readFile(p)],p));}
});
test('base is immutable; scenario IDs, topology, undo/redo and copy remain isolated',()=>{
  const book=new ScenarioStore(network,engine.Fo,model.source.sha256),branch=network.branches.find(b=>b.kind==='line'&&b.status===1),baseHash=book.current.hash;
  assert.throws(()=>{network.branches[0].status=0;},TypeError);
  book.apply({equipmentId:branch.sourceEquipmentId,action:'STATUS',value:0});assert.notEqual(book.current.hash,baseHash);assert.equal(network.branches.find(b=>b.id===branch.id).status,1);
  const effective=engine.fs(network,book.current);assert.equal(effective.branches.find(b=>b.id===branch.id).status,0);assert.notEqual(engine.zo(network),engine.zo(effective));
  const changed=book.current.hash;assert(book.undo());assert.equal(book.current.hash,baseHash);assert(book.redo());assert.equal(book.current.hash,changed);
  book.create('Kopya');book.reset();assert.equal(book.current.hash,baseHash);book.select('s1');assert.equal(book.current.hash,changed);
  const restored=new ScenarioStore(network,engine.Fo,model.source.sha256);restored.restore(book.serialize());assert.equal(restored.items.size,3);
  const before=restored.serialize();assert.throws(()=>restored.restore(book.serialize().replace(model.source.sha256,'wrong')),/MISMATCH/);assert.equal(restored.serialize(),before);
});
test('operation targets and values are checked; load/generator changes affect only overlay',()=>{
  const gen=network.generators.find(g=>g.pMinMw!==null&&g.pMaxMw!==null),load=network.loads[0];
  const scenario=engine.Fo(network,[{equipmentId:gen.sourceEquipmentId,action:'GENERATOR_P',value:gen.pMinMw},{equipmentId:load.sourceEquipmentId,action:'LOAD_SCALE',value:.8}]),effective=engine.fs(network,scenario);
  assert.equal(effective.loads[0].pMw,load.pMw*.8);assert.equal(network.loads[0].pMw,load.pMw);
  assert.throws(()=>engine.Fo(network,[{equipmentId:load.sourceEquipmentId,action:'GENERATOR_P',value:5}]),/TARGET/);
  assert.throws(()=>engine.Fo(network,[{equipmentId:load.sourceEquipmentId,action:'LOAD_SCALE',value:-1}]),/RANGE/);
});
test('one RATE helper covers MVA, AMP, missing ratings and disabled equipment',()=>{
  const branch={status:1,ratingBasis:'MVA',ratingsFromSource:[100,200],ratingsToSource:[100,200]},row={pFromMw:60,qFromMvar:80,pToMw:-60,qToMvar:-80};
  assert.equal(engine.v10RatePct(branch,row,0),100);assert.equal(engine.v10RatePct(branch,row,1),50);assert.equal(engine.v10RatePct(branch,row,2),null);
  assert.equal(engine.v10RatePct({...branch,status:0},row,0),null);
  assert.equal(engine.v10RatePct({...branch,ratingBasis:'AMP'},{iFromA:150,iToA:100},0),150);
  const result={id:'identity-unchanged',branchResults:[{id:'a',...row}]},n={branches:[{id:'a',...branch}]};
  assert.equal(ratePresentation(result,n,1).branchResults[0].loadingFromPct,50);assert.equal(ratePresentation(result,n,1).id,result.id);assert.equal(result.branchResults[0].loadingFromPct,undefined);
});
test('extended shunt and tap operations respect capability and recompute admittance',()=>{
  const n={baseMva:100,shunts:[{sourceEquipmentId:'s',selection:'FIXED',bMvar:2}],branches:[{sourceEquipmentId:'t',kind:'transformer',tapFrom:1,tapTo:1,rPu:0,xPu:.1,yff:{re:0,im:-10},yft:{re:0,im:10},ytf:{re:0,im:10},tapControl:{tapMinPu:.9,tapMaxPu:1.1,tapStepPu:.01}}]};
  applyExtendedOperation(n,{equipmentId:'s',action:'SHUNT_B',value:4});assert.equal(n.shunts[0].bMvar,4);
  applyExtendedOperation(n,{equipmentId:'t',action:'TAP_RATIO',value:1.02});assert(Math.abs(n.branches[0].yff.im+10/1.02**2)<1e-10);
  assert.throws(()=>validateExtendedOperation(n,{equipmentId:'t',action:'TAP_RATIO',value:1.025}),/STEP/);
});
test('real model NR/FDNS/DC statuses and identity are recorded without AC overclaim',async()=>{
  const solve=await worker('solver'),scenario=engine.Fo(network),results=[];
  for(const method of ['NR_POLAR','FDNS_XB','LOSSLESS_DC']){
    const r=await solve({model,network,scenario,method,options:{}});
    assert(engine.Wo(r,{sourceSha256:model.source.sha256,network,effectiveNetwork:engine.fs(network,scenario),scenario,method}));
    if(method==='LOSSLESS_DC')assert.notEqual(resultStatus(r),'CONVERGED');
    if(r.physicsCoverage!=='SUPPORTED')assert.equal(fullAcEvidence(r),false);
    results.push({method,status:r.status,presentationStatus:resultStatus(r),physics:r.physicsCoverage,iterations:r.iterations,elapsedMs:r.elapsedMs,p:r.maxPMismatchPu,q:r.maxQMismatchPu,findings:r.findings,id:r.id});
    if(method==='LOSSLESS_DC')assert(!engine.Wo(r,{sourceSha256:model.source.sha256,network,effectiveNetwork:network,scenario:engine.Fo(network,[{equipmentId:network.loads[0].sourceEquipmentId,action:'LOAD_SCALE',value:.9}])}));
  }
  await saveEvidence('real-calculations',results);
});
test('public result states distinguish all five requested outcomes',()=>{
  assert.equal(resultStatus(null),'NOT_RUN');assert.equal(resultStatus({status:'BLOCKED'}),'BLOCKED');assert.equal(resultStatus({status:'PARTIAL'}),'PARTIAL');assert.equal(resultStatus({status:'CONVERGED',method:'LOSSLESS_DC',physicsCoverage:'SUPPORTED'}),'APPROXIMATE');assert.equal(resultStatus({status:'CONVERGED',method:'NR_POLAR',physicsCoverage:'SUPPORTED'}),'CONVERGED');
});
test('NR and FDNS match an independent analytical two-bus AC solution; DC obeys active balance',async()=>{
  const m=await readModel('tests/fixtures/two-bus.raw'),n=engine.No(m),scenario=engine.Fo(n),solve=await worker('solver'),results=[];
  const p=.5,q=.2,r=.01,x=.1,a=2*(r*p+x*q)-1,c=(r*r+x*x)*(p*p+q*q),vSquared=(-a+Math.sqrt(a*a-4*c))/2,expectedVm=Math.sqrt(vSquared),expectedAngle=Math.atan2(-(x*p-r*q),vSquared+r*p+x*q)*180/Math.PI;
  for(const method of ['NR_POLAR','FDNS_XB','LOSSLESS_DC']){
    const result=await solve({model:m,network:n,scenario,method,options:{}});assert.equal(result.status,'CONVERGED',JSON.stringify(result.findings));
    const bus=result.busResults.find(b=>b.connectionKey==='2'),branch=result.branchResults[0];
    if(method!=='LOSSLESS_DC'){assert(Math.abs(bus.vmPu-expectedVm)<2e-6);assert(Math.abs(bus.vaDeg-expectedAngle)<2e-4);assert(Math.abs(branch.pToMw+50)<1e-4);assert(branch.pLossMw>0);}else{assert(Math.abs(branch.pFromMw-50)<1e-6);assert.equal(branch.qFromMvar,null);}
    results.push({method,status:resultStatus(result),vm:bus.vmPu,angle:bus.vaDeg,branch});
  }
  await saveEvidence('analytical-two-bus',{expectedVm,expectedAngle,results});
});
