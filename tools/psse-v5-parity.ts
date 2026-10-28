/** Licensed development reference comparison; publishes aggregates only. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {decodePsse} from '../src/importers/psse/decode';
import {normalizePsseBusBranch,type PsseBusBranchNetwork} from '../src/domain/psse/network';
import type {PsseCalculationResult} from '../src/domain/psse/results';
import {solvePsseNewton,effectivePsseNetwork} from '../src/analysis/psse/newton';
import {createPsseScenario,type PsseScenarioOperation} from '../src/domain/psse/scenario';
function stats(values:number[]){const a=values.filter(Number.isFinite).map(Math.abs).sort((x,y)=>x-y);return{count:a.length,max:a.length?a.at(-1):null,mean:a.length?a.reduce((x,y)=>x+y,0)/a.length:null,p95:a.length?a[Math.ceil(a.length*.95)-1]:null};}
function physicalBalance(network:PsseBusBranchNetwork,result:PsseCalculationResult){
 const busOutput=new Map(result.busResults.map(b=>[b.id,b])),branchOutput=new Map(result.branchResults.map(b=>[b.id,b]));
 const p=new Float64Array(network.buses.length),q=new Float64Array(network.buses.length);let generationP=0,generationQ=0,loadP=0,loadQ=0,shuntP=0,shuntQ=0,branchLossP=0,branchLossQ=0;let unavailableActiveBranches=0;
 for(let i=0;i<network.buses.length;i++){const b=network.buses[i],r=busOutput.get(b.id);if(b.status===1&&b.source){p[i]=r?.pGenerationMw??0;q[i]=r?.qGenerationMvar??0;generationP+=p[i];generationQ+=q[i];}}
 const voltage=(i:number)=>{const b=network.buses[i];return busOutput.get(b.id)?.vmPu??b.initialVm??1;};
 for(const l of network.loads)if(l.status===1){const v=voltage(l.bus),lp=l.pMw+l.ipMw*v+l.ypMw*v*v,lq=l.qMvar+l.iqMvar*v+l.yqMvar*v*v;p[l.bus]-=lp;q[l.bus]-=lq;loadP+=lp;loadQ+=lq;}
 for(const s of network.shunts)if(s.status===1){const v=voltage(s.bus),sp=s.gMw*v*v,sq=-s.bMvar*v*v;p[s.bus]-=sp;q[s.bus]-=sq;shuntP+=sp;shuntQ+=sq;}
 for(const b of network.branches)if(b.status===1){const r=branchOutput.get(b.id);if(!r||[r.pFromMw,r.qFromMvar,r.pToMw,r.qToMvar].some(v=>v===null)){unavailableActiveBranches++;continue;}p[b.from]-=r.pFromMw!;q[b.from]-=r.qFromMvar!;p[b.to]-=r.pToMw!;q[b.to]-=r.qToMvar!;branchLossP+=r.pFromMw!+r.pToMw!;branchLossQ+=r.qFromMvar!+r.qToMvar!;}
 const physical=network.buses.map((b,i)=>({b,i})).filter(({b})=>b.source&&b.status===1),internal=network.buses.map((b,i)=>({b,i})).filter(({b})=>!b.source&&b.status===1),kcl=(rows:typeof physical)=>({pMw:stats(rows.map(({i})=>p[i])),qMvar:stats(rows.map(({i})=>q[i])),complexMva:stats(rows.map(({i})=>Math.hypot(p[i],q[i])))});
 const knownP=result.generatorResults.filter(g=>g.pMw!==null).reduce((s,g)=>s+g.pMw!,0),knownQ=result.generatorResults.filter(g=>g.qMvar!==null).reduce((s,g)=>s+g.qMvar!,0),missingP=result.generatorResults.filter(g=>network.generators.find(n=>n.id===g.id)?.status===1&&g.pMw===null).length,missingQ=result.generatorResults.filter(g=>network.generators.find(n=>n.id===g.id)?.status===1&&g.qMvar===null).length;
 return{physicalBusKcl:kcl(physical),internalStarKcl:kcl(internal),unavailableActiveBranches,totals:{generationP,generationQ,loadP,loadQ,shuntP,shuntQ,branchLossP,branchLossQ,netPBalanceMw:generationP-loadP-shuntP-branchLossP,netQBalanceMvar:generationQ-loadQ-shuntQ-branchLossQ},machineOutput:{knownP,knownQ,unavailableActiveP:missingP,unavailableActiveQ:missingQ,completePAllocationResidualMw:missingP?null:knownP-generationP,completeQAllocationResidualMvar:missingQ?null:knownQ-generationQ},branchLossReconstruction:{pMw:stats(result.branchResults.filter(b=>b.pLossMw!==null).map(b=>b.pLossMw!-(b.pFromMw!+b.pToMw!))),qMvar:stats(result.branchResults.filter(b=>b.qLossMvar!==null).map(b=>b.qLossMvar!-(b.qFromMvar!+b.qToMvar!)))}};
}

const refs=[...JSON.parse(readFileSync('private-re/ac-v5-reference/reference-scenarios.json','utf8')),...JSON.parse(readFileSync('private-re/ac-v5-reference/reference-scenarios-nondivergent-001.json','utf8'))],summaries:any[]=[];
for(const filename of process.argv.slice(2)){
 const model=await decodePsse(Uint8Array.from(readFileSync(filename)).buffer,filename),network=normalizePsseBusBranch(model),equipment=new Map(model.equipment.map(e=>[e.id,e]));let baseHash:string|null=null;
 for(const variant of ['base','load2','load10','lineout','undo']){
  const attempts=refs.filter((r:any)=>r.sourceSha256===model.source.sha256&&r.scenario===variant),ref=attempts.find((r:any)=>r.solved===0)??attempts[0];if(!ref)continue;
  let operations:PsseScenarioOperation[]=[];
  if(variant.startsWith('load'))operations=network.loads.map(l=>({equipmentId:l.sourceEquipmentId,action:'LOAD_SCALE',value:variant==='load2'?1.02:1.1}));
  if(variant==='lineout'){const b=network.branches.find(b=>b.kind==='line'&&network.buses[b.from].externalNumber===514510&&network.buses[b.to].externalNumber===516112);if(!b)throw Error('SCENARIO_SOURCE_LINE_NOT_FOUND');operations=[{equipmentId:b.sourceEquipmentId,action:'STATUS',value:0}];}
  const scenario=createPsseScenario(network,operations),effective=effectivePsseNetwork(network,scenario),result=solvePsseNewton({model,network,scenario,options:{initialVoltagePolicy:'SOURCE_SAVED',remoteRegulation:true,maxIterations:100,maxQLimitRounds:12,tolerancePu:1e-5}});
  const signature=createHash('sha256').update(JSON.stringify([result.busResults,result.branchResults,result.generatorResults])).digest('hex');if(variant==='base')baseHash=signature;
  const summary:any={modelBusCount:network.buses.filter(b=>b.source).length,sourceSha256:model.source.sha256,scenario:variant,reference:{status:ref.status,solved:ref.solved,iterations:ref.iterations,options:ref.options,toleranceMva:ref.toleranceMva,attempts:attempts.map((a:any)=>({options:a.options,status:a.status,solved:a.solved,iterations:a.iterations}))},ga:{status:result.status,classification:result.classification,iterations:result.iterations,maxPMismatchPu:result.maxPMismatchPu,maxQMismatchPu:result.maxQMismatchPu,voltageControls:result.diagnostics.remoteRegulation},undoRestoresBase:variant==='undo'?signature===baseHash:null};
  writeFileSync('private-re/ac-v5-reference/ga-'+summary.modelBusCount+'-'+variant+'.json',JSON.stringify(result));
  if(result.status==='CONVERGED')summary.physical=physicalBalance(effective,result);
  if(result.status==='CONVERGED'&&ref.solved===0){
   const refBus=new Map<number,number>(ref.buses.NUMBER.map((n:number,i:number)=>[n,i])),refGen=new Map<string,number>(ref.generators.NUMBER.map((n:number,i:number)=>[n+'|'+String(ref.generators.ID[i]).trim(),i])),refBranch=new Map<string,number>(ref.branches.FROMNUMBER.map((n:number,i:number)=>[n+'|'+ref.branches.TONUMBER[i]+'|'+String(ref.branches.ID[i]).trim(),i]));
   const busById=new Map(result.busResults.map(b=>[b.id,b])),genById=new Map(result.generatorResults.map(g=>[g.id,g])),branchById=new Map(result.branchResults.map(b=>[b.id,b]));
   const vm:number[]=[],angles:number[]=[],qg:number[]=[],bp:number[]=[],bq:number[]=[],worst:any[]=[];let missingBus=0,missingGenerator=0,missingBranch=0;
   for(const b of network.buses.filter(b=>b.source&&b.status===1)){const i=refBus.get(b.externalNumber!),r=busById.get(b.id);if(i===undefined||r?.vmPu==null||r.vaDeg==null){missingBus++;continue;}const error=(r.vmPu-ref.buses.PU[i])/Math.max(Math.abs(ref.buses.PU[i]),1e-9);vm.push(error);angles.push(((r.vaDeg-ref.buses.ANGLED[i]+180)%360+360)%360-180);worst.push({bus:b.externalNumber,vmPu:r.vmPu,referenceVmPu:ref.buses.PU[i],relativeError:error});}
   for(const g of effective.generators.filter(g=>g.status===1)){const e=equipment.get(g.sourceEquipmentId)!,n=network.buses[g.bus].externalNumber,i=refGen.get(n+'|'+String(e.fields.machid??e.fields.id??'1').trim()),r=genById.get(g.id);if(i===undefined||r?.qMvar==null){missingGenerator++;continue;}qg.push((r.qMvar-ref.generators.QGEN[i])/Math.max(Math.abs(ref.generators.QGEN[i]),10));}
   for(const b of effective.branches.filter(b=>b.status===1&&b.kind!=='three-winding-leg')){const e=equipment.get(b.sourceEquipmentId)!,r=branchById.get(b.id);for(const from of [true,false]){const n=network.buses[from?b.from:b.to].externalNumber,m=network.buses[from?b.to:b.from].externalNumber,i=refBranch.get(n+'|'+m+'|'+String(e.fields.ckt??'1').trim()),p=from?r?.pFromMw:r?.pToMw,q=from?r?.qFromMvar:r?.qToMvar;if(i===undefined||p==null||q==null){missingBranch++;continue;}bp.push((p-ref.branches.P[i])/Math.max(Math.abs(ref.branches.P[i]),10));bq.push((q-ref.branches.Q[i])/Math.max(Math.abs(ref.branches.Q[i]),10));}}
   const sorted=[...angles].sort((a,b)=>a-b),offset=sorted[Math.floor(sorted.length/2)]??0;
   summary.parity={vmRelative:stats(vm),angleAlignedDeg:stats(angles.map(a=>((a-offset+180)%360+360)%360-180)),angleOffsetDeg:offset,generatorQNormalized:stats(qg),branchPNormalized:stats(bp),branchQNormalized:stats(bq),missingBus,missingGenerator,missingBranch,thresholdsPass:(stats(vm).p95??Infinity)<.01&&(stats(qg).p95??Infinity)<.01&&(stats(bp).p95??Infinity)<.01&&(stats(bq).p95??Infinity)<.01&&(stats(angles.map(a=>a-offset)).p95??Infinity)<=.5};
   writeFileSync('private-re/ac-v5-reference/worst-'+summary.modelBusCount+'-'+variant+'.json',JSON.stringify(worst.sort((a,b)=>Math.abs(b.relativeError)-Math.abs(a.relativeError)).slice(0,20),null,2));
  }
  summaries.push(summary);console.log(JSON.stringify({buses:summary.modelBusCount,scenario:variant,ga:summary.ga,reference:summary.reference,parity:summary.parity,undo:summary.undoRestoresBase}));
 }
}
mkdirSync('evidence/psse-v5',{recursive:true});writeFileSync('evidence/psse-v5/reference-parity.json',JSON.stringify({schema:'ga.psse.v5.reference-parity.v1',date:'2026-10-28',privacy:'Aggregate metrics only; raw models/results and 20 worst buses are private.',cases:summaries},null,2)+'\n');
