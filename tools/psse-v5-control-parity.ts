/** Aggregate-only comparison of original tiny controls against a local licensed API cache. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {decodePsse} from '../src/importers/psse/decode';
import {normalizePsseBusBranch} from '../src/domain/psse/network';
import {solvePsseNewton} from '../src/analysis/psse/newton';
const references=JSON.parse(readFileSync('private-re/ac-v5-reference/reference-synthetic.json','utf8')),cases=[];
for(const ref of references){
 const filename=`.tmp/psse-v5-fixtures/${ref.fixture}.rawx`,model=await decodePsse(Uint8Array.from(readFileSync(filename)).buffer,filename),network=normalizePsseBusBranch(model),result=solvePsseNewton({model,network,options:{remoteRegulation:true,initialVoltagePolicy:'SOURCE_SAVED',maxIterations:100,tolerancePu:1e-8}});
 const busIndex=new Map<number,number>(ref.buses?.NUMBER.map((n:number,i:number)=>[n,i])??[]),machineIndex=new Map<string,number>(ref.generators?.NUMBER.map((n:number,i:number)=>[n+'|'+String(ref.generators.ID[i]).trim(),i])??[]),byId=new Map(model.equipment.map(e=>[e.id,e]));
 let maxVmPu=0,maxQgMvar=0,unmatched=0;
 let referencePhysicalMaxKclMva:number|null=null;
 if(ref.solved===0){
  const p=new Map<number,number>(),q=new Map<number,number>(),add=(map:Map<number,number>,bus:number,value:number)=>map.set(bus,(map.get(bus)??0)+value);
  ref.generators.NUMBER.forEach((bus:number,i:number)=>{if(ref.generators.STATUS[i]===1){add(p,bus,ref.generators.PGEN[i]);add(q,bus,ref.generators.QGEN[i]);}});
  for(const l of network.loads.filter(l=>l.status===1)){const bus=network.buses[l.bus].externalNumber!,i=busIndex.get(bus)!,v=ref.buses.PU[i];add(p,bus,-l.pMw-l.ipMw*v-l.ypMw*v*v);add(q,bus,-l.qMvar-l.iqMvar*v-l.yqMvar*v*v);}
  for(const shunt of network.shunts.filter(s=>s.status===1)){const bus=network.buses[shunt.bus].externalNumber!,v=ref.buses.PU[busIndex.get(bus)!];add(p,bus,-shunt.gMw*v*v);add(q,bus,shunt.bMvar*v*v);}
  ref.branches.FROMNUMBER.forEach((bus:number,i:number)=>{if(ref.branches.STATUS[i]===1){add(p,bus,-ref.branches.P[i]);add(q,bus,-ref.branches.Q[i]);}});
  referencePhysicalMaxKclMva=Math.max(0,...ref.buses.NUMBER.map((bus:number)=>Math.hypot(p.get(bus)??0,q.get(bus)??0)));
 }
 if(result.status==='CONVERGED'&&ref.solved===0){for(const b of network.buses){const i=busIndex.get(b.externalNumber!),r=result.busResults.find(r=>r.id===b.id);if(i===undefined||r?.vmPu==null){unmatched++;continue;}maxVmPu=Math.max(maxVmPu,Math.abs(r.vmPu-ref.buses.PU[i]));}
 for(const g of network.generators){const e=byId.get(g.sourceEquipmentId)!,i=machineIndex.get(network.buses[g.bus].externalNumber+'|'+String(e.fields.machid??'1').trim()),r=result.generatorResults.find(r=>r.id===g.id);if(i===undefined||r?.qMvar==null){unmatched++;continue;}maxQgMvar=Math.max(maxQgMvar,Math.abs(r.qMvar-ref.generators.QGEN[i]));}}
 cases.push({fixture:ref.fixture,referenceStatus:ref.status,referenceOptions:ref.options,referenceToleranceMva:ref.toleranceMva,referencePhysicalMaxKclMva,referencePhysicalUsable:referencePhysicalMaxKclMva!==null&&referencePhysicalMaxKclMva<.01,droopActual:ref.droopActual??null,gaStatus:result.status,classification:result.classification,controls:result.diagnostics.remoteRegulation??null,maxVmPu:result.status==='CONVERGED'&&ref.solved===0?maxVmPu:null,maxQgMvar:result.status==='CONVERGED'&&ref.solved===0?maxQgMvar:null,unmatched,parityWithinReferenceTolerance:result.status==='CONVERGED'&&ref.solved===0&&unmatched===0&&maxVmPu<1e-4&&maxQgMvar<.02});
}
mkdirSync('evidence/psse-v5',{recursive:true});writeFileSync('evidence/psse-v5/control-reference-parity.json',JSON.stringify({schema:'ga.psse.v5.control-reference.v1',privacy:'Original synthetic fixture names and aggregate errors only; no real-grid values.',cases},null,2)+'\n');
console.log(JSON.stringify(cases.map(c=>({fixture:c.fixture,ga:c.gaStatus,reference:c.referenceStatus,maxVmPu:c.maxVmPu,maxQgMvar:c.maxQgMvar,pass:c.parityWithinReferenceTolerance}))));
