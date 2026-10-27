import type {PsseModel,PsseFinding} from '../../importers/psse/types';
import {auditPsseCapability} from '../../domain/psse/capability';
import {PSSE_ENGINE_VERSION,psseCalculationIdentity,psseTopologyHash,psseOptionsHash} from '../../domain/psse/identity';
import type {PsseCalculationResult,PsseBusResult,PsseGeneratorResult} from '../../domain/psse/results';
import {createPsseScenario,type PsseScenario} from '../../domain/psse/scenario';
import type {PsseBusBranchNetwork} from '../../domain/psse/network';
import {buildPsseJacobian} from './jacobian';
import {calculatePssePower,lowVoltageLoadFindings,psseQPlantAtBus,type PsseState} from './mismatch';
import {solvePssERealSparse} from './sparse';
import {buildPsseYbus} from './ybus';
import {psseGeneratorResults} from './machine-results';
import {psseBranchResults} from './outputs';
export interface PsseAcOptions {tolerancePu?:number;maxIterations?:number;maxQLimitRounds?:number;reactiveLimitsEnabled?:boolean;initialVoltagePolicy?:'FLAT'|'SOURCE_SAVED';minVoltagePu?:number;maxVoltagePu?:number;loadModelProfile?:'PSSE_SOURCE'|'GENERIC_ZIP';sourceUnits:'MVA_MVAR_DEG_PER_UNIT';}
export const DEFAULT_PSSE_AC_OPTIONS:PsseAcOptions={tolerancePu:1e-6,maxIterations:40,maxQLimitRounds:8,reactiveLimitsEnabled:true,initialVoltagePolicy:'FLAT',minVoltagePu:1e-3,maxVoltagePu:8,loadModelProfile:'PSSE_SOURCE',sourceUnits:'MVA_MVAR_DEG_PER_UNIT'};
export interface PsseProgress {phase:string;iteration:number;residualPu:number|null}
export interface PsseSolveInput {model:PsseModel;network:PsseBusBranchNetwork;scenario?:PsseScenario;options?:Partial<PsseAcOptions>;cancelled?:()=>boolean;progress?:(event:PsseProgress)=>void}
const opts=(input:PsseSolveInput)=>({...DEFAULT_PSSE_AC_OPTIONS,...input.options});
export function effectivePsseNetwork(network:PsseBusBranchNetwork,scenario:PsseScenario):PsseBusBranchNetwork{
 if(scenario.networkHash!==network.modelHash)throw Error('PSSE_SCENARIO_NETWORK_MISMATCH');const result=structuredClone(network);
 for(const operation of scenario.operations){if(operation.action==='STATUS'){const v=operation.value===true?1:operation.value===false?0:typeof operation.value==='number'&&[0,1].includes(operation.value)?operation.value:null;if(v===null)throw Error('PSSE_SCENARIO_STATUS_RANGE');for(const collection of [result.branches,result.generators,result.loads,result.shunts])for(const item of collection)if(item.sourceEquipmentId===operation.equipmentId)item.status=v as 0|1;}
  else if(operation.action==='GENERATOR_P'){for(const g of result.generators)if(g.sourceEquipmentId===operation.equipmentId)g.pMw=Number(operation.value);}
  else if(operation.action==='LOAD_SCALE'){const scale=Number(operation.value);for(const load of result.loads)if(load.sourceEquipmentId===operation.equipmentId){load.pMw*=scale;load.qMvar*=scale;load.ipMw*=scale;load.iqMvar*=scale;load.ypMw*=scale;load.yqMvar*=scale;}}
  else throw Error(`PSSE_SCENARIO_OPERATION_NOT_SUPPORTED:${operation.action}`);
 }
 for(const bus of result.buses)if(!bus.source){const legs=result.branches.filter(branch=>branch.sourceEquipmentId===bus.sourceEquipmentId);if(legs.length)bus.status=legs.some(branch=>branch.status===1)?1:0;}
 return result;
}
function emptyResult(identity:ReturnType<typeof psseCalculationIdentity>,network:PsseBusBranchNetwork,findings:PsseFinding[],status:PsseCalculationResult['status'],elapsedMs=0):PsseCalculationResult{return {schema:'ga.psse.calculation.v1',id:identity.id,identity,method:'NR_POLAR',status,physicsCoverage:status==='BLOCKED'?'BLOCKED':'PARTIAL',referenceComparisonStatus:'NOT_COMPARED',source:'GA_PSSE_CALCULATED',baseMva:network.baseMva,iterations:0,outerRounds:0,elapsedMs,maxPMismatchPu:null,maxQMismatchPu:null,busResults:network.buses.filter(b=>b.source).map(b=>({id:b.id,connectionKey:b.connectionKey,vmPu:null,vaDeg:null,pGenerationMw:null,qGenerationMvar:null,sourceEquipmentId:b.sourceEquipmentId})),branchResults:network.branches.map(b=>({id:b.id,sourceEquipmentId:b.sourceEquipmentId,terminalFrom:b.terminalFrom,terminalTo:b.terminalTo,pFromMw:null,qFromMvar:null,pToMw:null,qToMvar:null,pLossMw:null,qLossMvar:null})),generatorResults:network.generators.map(g=>({id:g.id,sourceEquipmentId:g.sourceEquipmentId,pMw:null,qMvar:null,limitState:'UNAVAILABLE'})),unsolvedIslands:[],diagnostics:{},findings};}
export function initializePsseState(network:PsseBusBranchNetwork,policy:'FLAT'|'SOURCE_SAVED'):PsseState{
 const n=network.buses.length,vm=new Float64Array(n),va=new Float64Array(n),busType=new Int8Array(n);for(let i=0;i<n;i++){const b=network.buses[i];busType[i]=b.status===0?4:b.type;if(policy==='SOURCE_SAVED'&&b.initialVm!==null&&b.initialVm>0){vm[i]=b.initialVm;va[i]=(b.initialVaDeg??0)*Math.PI/180;}else{vm[i]=1;va[i]=0;}}
 for(let i=0;i<n;i++)if(busType[i]===2){const plant=psseQPlantAtBus(network,i);if(plant.units.length>0&&plant.regulatingUnits.length===0)busType[i]=1;}
 for(const generator of network.generators)if(generator.status===1&&generator.vsPu!==null&&(busType[generator.bus]===2||busType[generator.bus]===3))vm[generator.bus]=generator.vsPu;
 return {vm,va,busType,qLimited:new Map(),qState:new Map()};
}
export function referenceBusesFor(network:PsseBusBranchNetwork,state:PsseState){const refs=new Set<number>();for(let i=0;i<state.busType.length;i++)if(state.busType[i]===3)refs.add(i);return refs;}
function mismatchAt(network:PsseBusBranchNetwork,ybus:ReturnType<typeof buildPsseYbus>,state:PsseState,refs:Set<number>){return calculatePssePower(network,ybus,state,refs);}
function maxMismatch(power:ReturnType<typeof mismatchAt>){return Math.max(power.maxP,power.maxQ);}
function runNewtonIslandSystem(input:PsseSolveInput,network:PsseBusBranchNetwork,state:PsseState,ybus:ReturnType<typeof buildPsseYbus>,refs:Set<number>,settings:PsseAcOptions,iterationOffset:number){
 let power=mismatchAt(network,ybus,state,refs),iteration=0,linearDiagnostics:unknown=null,lineSearchReductions=0;
 for(;iteration<settings.maxIterations!;iteration++){
  if(input.cancelled?.())return {status:'CANCELLED' as const,power,iteration,linearDiagnostics,lineSearchReductions};
  const residual=maxMismatch(power);input.progress?.({phase:'NR_POLAR',iteration:iterationOffset+iteration,residualPu:residual});if(residual<=settings.tolerancePu!)return {status:'CONVERGED' as const,power,iteration,linearDiagnostics,lineSearchReductions};
  const layout=buildPsseJacobian(network,ybus,state,power,refs),rhs=Float64Array.from(power.f,x=>-x);let solved;
  try{solved=solvePssERealSparse(layout.matrix,rhs);}catch(error){return {status:'NON_CONVERGED' as const,power,iteration,linearDiagnostics:{error:error instanceof Error?error.message:String(error),dimension:layout.matrix.N,nnz:layout.matrix.colIdx.length},lineSearchReductions};}
  linearDiagnostics=solved.diagnostics;if(!solved.x||solved.relativeResidual===null||solved.relativeResidual>1e-6)return {status:'NON_CONVERGED' as const,power,iteration,linearDiagnostics,lineSearchReductions};
  const dx=solved.x,oldVm=Float64Array.from(state.vm),oldVa=Float64Array.from(state.va),oldNorm=power.norm;let accepted=false;
  for(let alpha=1;alpha>=1/128;alpha/=2){for(let k=0;k<layout.angleBuses.length;k++)state.va[layout.angleBuses[k]]+=alpha*dx[k];for(let k=0;k<layout.vmBuses.length;k++)state.vm[layout.vmBuses[k]]+=alpha*dx[layout.vmColumn[layout.vmBuses[k]]];
   const valid=state.vm.every(v=>Number.isFinite(v)&&v>=settings.minVoltagePu!&&v<=settings.maxVoltagePu!)&&state.va.every(Number.isFinite);if(valid){const candidate=mismatchAt(network,ybus,state,refs);if(Number.isFinite(candidate.norm)&&(candidate.norm<oldNorm*(1-1e-5*alpha)||maxMismatch(candidate)<=settings.tolerancePu!)){power=candidate;accepted=true;if(alpha<1)lineSearchReductions++;break;}}
   state.vm.set(oldVm);state.va.set(oldVa);
  }
  if(!accepted)return {status:'NON_CONVERGED' as const,power,iteration:iteration+1,linearDiagnostics,lineSearchReductions};
 }
 power=mismatchAt(network,ybus,state,refs);return {status:maxMismatch(power)<=settings.tolerancePu!?'CONVERGED' as const:'NON_CONVERGED' as const,power,iteration,linearDiagnostics,lineSearchReductions};
}
function qAllocation(generators:PsseBusBranchNetwork['generators'],bus:number,qTotalMvar:number){
 const units=generators.filter(g=>g.status===1&&g.bus===bus),allocation=new Map<string,{q:number;state:PsseGeneratorResult['limitState']}>(),free=[...units];let remaining=qTotalMvar;
 for(let round=0;round<=units.length&&free.length;round++){const weight=free.reduce((s,g)=>s+Math.max(g.participation,0),0)||free.length,clamped:typeof free=[];for(const g of free){const share=remaining*(Math.max(g.participation,0)||1)/weight;if(share<g.qMinMvar-1e-8){allocation.set(g.id,{q:g.qMinMvar,state:'QMIN'});remaining-=g.qMinMvar;clamped.push(g);}else if(share>g.qMaxMvar+1e-8){allocation.set(g.id,{q:g.qMaxMvar,state:'QMAX'});remaining-=g.qMaxMvar;clamped.push(g);}}
  if(!clamped.length){for(const g of free){const share=remaining*(Math.max(g.participation,0)||1)/weight;allocation.set(g.id,{q:share,state:'FREE'});}break;}for(const g of clamped)free.splice(free.indexOf(g),1);
 }
 return allocation;
}
/** Sparse polar NR with voltage-dependent ZIP specified powers and a deterministic Q active set. */
export function solvePsseNewton(input:PsseSolveInput):PsseCalculationResult{
 const start=performance.now(),settings=opts(input),scenario=input.scenario??createPsseScenario(input.network),network=effectivePsseNetwork(input.network,scenario),optionsHash=psseOptionsHash(settings),identity=psseCalculationIdentity({mode:'PSSE',sourceSha256:network.sourceSha256,modelHash:network.modelHash,topologyHash:psseTopologyHash(network),normalizedModelHash:network.modelHash,normalizedRevision:network.revision,scenarioHash:scenario.hash,solver:'NR_POLAR',engineVersion:PSSE_ENGINE_VERSION,algorithmId:'NR_POLAR',algorithmRevision:'psse-nr-polar-1',controlPolicyId:settings.reactiveLimitsEnabled?'FIXED_CONTROLS_Q_LIMITS':'FIXED_CONTROLS_NO_Q_LIMITS',controlPolicyRevision:'fixed-controls-1',optionsHash,resultSchemaRevision:'psse-result-1',initialVoltagePolicy:settings.initialVoltagePolicy!});
 const audit=auditPsseCapability(input.model,network,'NR_POLAR');if(audit.status==='BLOCKED')return emptyResult(identity,network,audit.findings,'BLOCKED',performance.now()-start);
 const state=initializePsseState(network,settings.initialVoltagePolicy!),refs=referenceBusesFor(network,state),ybus=buildPsseYbus(network);let iterations=0,outerRounds=0,linearDiagnostics:unknown=null,lineSearchReductions=0,power:mismatchReturn|null=null;const findings=[...audit.findings],conversions:number[]=[];
 for(;outerRounds<=settings.maxQLimitRounds!;outerRounds++){
  const run=runNewtonIslandSystem(input,network,state,ybus,refs,settings,iterations);iterations+=run.iteration;linearDiagnostics=run.linearDiagnostics;lineSearchReductions+=run.lineSearchReductions;power=run.power;
  if(run.status==='CANCELLED')return {...emptyResult(identity,network,findings,'CANCELLED',performance.now()-start),iterations,outerRounds,diagnostics:{linearDiagnostics}};
  if(run.status!=='CONVERGED')return {...emptyResult(identity,network,findings,'NON_CONVERGED',performance.now()-start),iterations,outerRounds,maxPMismatchPu:power.maxP,maxQMismatchPu:power.maxQ,diagnostics:{linearDiagnostics,lineSearchReductions}};
  if(!settings.reactiveLimitsEnabled)break;
  let changed=false;
  for(const bus of network.buses.map((_,i)=>i))if(state.busType[bus]===2||state.busType[bus]===3){const plant=psseQPlantAtBus(network,bus);if(!plant.units.length)continue;const requiredQ=(power.q[bus]+power.loadQ[bus])*network.baseMva,totalMin=plant.minimumQ,totalMax=plant.maximumQ;
   if(state.busType[bus]===3){if(requiredQ<totalMin-.02||requiredQ>totalMax+.02){findings.push({severity:'ERROR',code:'REFERENCE_Q_LIMIT_EXCEEDED',message:`Reference bus requires ${requiredQ.toFixed(4)} Mvar outside [${totalMin}, ${totalMax}].`});return {...emptyResult(identity,network,findings,'BLOCKED',performance.now()-start),iterations,outerRounds,maxPMismatchPu:power.maxP,maxQMismatchPu:power.maxQ};}}
   else if(requiredQ<totalMin-.02||requiredQ>totalMax+.02){const limit=requiredQ<totalMin?totalMin:totalMax;state.busType[bus]=1;state.qLimited.set(bus,limit/network.baseMva);state.qState.set(bus,limit===totalMin?'QMIN':'QMAX');conversions.push(bus);changed=true;}
  }
  if(!changed)break;if(outerRounds===settings.maxQLimitRounds)return {...emptyResult(identity,network,[...findings,{severity:'ERROR',code:'Q_LIMIT_ROUND_LIMIT',message:'Reactive-limit active set did not settle within the configured outer-round limit.'}],'NON_CONVERGED',performance.now()-start),iterations,outerRounds};
 }
 const finalPower=power??mismatchAt(network,ybus,state,refs),lowVoltage=lowVoltageLoadFindings(network,state,settings.loadModelProfile!);findings.push(...lowVoltage);if(lowVoltage.some(f=>f.severity==='ERROR'))return {...emptyResult(identity,network,findings,'BLOCKED',performance.now()-start),iterations,outerRounds,maxPMismatchPu:finalPower.maxP,maxQMismatchPu:finalPower.maxQ};
 const busResults:PsseBusResult[]=network.buses.flatMap((b,i)=>b.source?[{id:b.id,connectionKey:b.connectionKey,vmPu:b.status===1?state.vm[i]:null,vaDeg:b.status===1?state.va[i]*180/Math.PI:null,pGenerationMw:b.status===1?(finalPower.p[i]+finalPower.loadP[i])*network.baseMva:null,qGenerationMvar:b.status===1?(finalPower.q[i]+finalPower.loadQ[i])*network.baseMva:null,sourceEquipmentId:b.sourceEquipmentId}]:[]);
 const branchResults=psseBranchResults(network,state);
 const generatorResults=psseGeneratorResults(network,state,finalPower,settings.reactiveLimitsEnabled!,findings);
 const result:PsseCalculationResult={schema:'ga.psse.calculation.v1',id:identity.id,identity,method:'NR_POLAR',status:'CONVERGED',physicsCoverage:findings.some(f=>f.code==='PER_MACHINE_DISPATCH_UNAVAILABLE'||f.code==='GENERIC_ZIP_BELOW_PSSE_BREAKPOINT'||f.code==='BASE_KV_UNAVAILABLE_PER_UNIT_PROFILE')?'PARTIAL':'SUPPORTED',referenceComparisonStatus:'NOT_COMPARED',source:'GA_PSSE_CALCULATED',baseMva:network.baseMva,iterations,outerRounds,elapsedMs:performance.now()-start,maxPMismatchPu:finalPower.maxP,maxQMismatchPu:finalPower.maxQ,busResults,branchResults,generatorResults,unsolvedIslands:[],diagnostics:{sparse:{dimension:linearDiagnostics&&typeof linearDiagnostics==='object'?(linearDiagnostics as {dimension?:number}).dimension??null:network.buses.length,nnz:linearDiagnostics&&typeof linearDiagnostics==='object'?(linearDiagnostics as {nnz?:number}).nnz??null:null,backend:'KLU_WASM',linearDiagnostics},lineSearchReductions,activeQLimitBuses:conversions.map(i=>network.buses[i].id),busCount:network.buses.length,branchCount:network.branches.length,ybusNnz:ybus.nnz},findings};return result;
}
type mismatchReturn=ReturnType<typeof calculatePssePower>;
