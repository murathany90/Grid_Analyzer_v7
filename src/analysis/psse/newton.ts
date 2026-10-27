import type {PsseModel,PsseFinding} from '../../importers/psse/types';
import {auditPsseCapability} from '../../domain/psse/capability';
import {PSSE_ENGINE_VERSION,psseCalculationIdentity,psseTopologyHash,psseOptionsHash} from '../../domain/psse/identity';
import {psseCalculationClassification,type PsseCalculationResult,type PsseBusResult,type PsseGeneratorResult} from '../../domain/psse/results';
import {createPsseScenario,type PsseScenario} from '../../domain/psse/scenario';
import type {PsseBusBranchNetwork} from '../../domain/psse/network';
import {buildPsseJacobian} from './jacobian';
import {calculatePssePower,lowVoltageLoadFindings,psseQPlantAtBus,type PsseState} from './mismatch';
import {solvePssERealSparse} from './sparse';
import {buildPsseYbus} from './ybus';
import {psseGeneratorResults} from './machine-results';
import {psseBranchResults,psseBranchResultFromTerminalPowers} from './outputs';
import {applyPsseFixedControls,preparePsseAcReduction,recoverPsseAcExpansion} from './ac-reduction';
import {retapPsseBranch} from '../../domain/psse/network';
export interface PsseAcOptions {tolerancePu?:number;maxIterations?:number;maxQLimitRounds?:number;reactiveLimitsEnabled?:boolean;initialVoltagePolicy?:'FLAT'|'SOURCE_SAVED';minVoltagePu?:number;maxVoltagePu?:number;loadModelProfile?:'PSSE_SOURCE'|'GENERIC_ZIP';automaticAdjustments?:boolean;maxAdjustmentRounds?:number;remoteRegulation?:boolean;remoteChasing?:boolean;maxRemoteRounds?:number;sourceUnits:'MVA_MVAR_DEG_PER_UNIT';}
export const DEFAULT_PSSE_AC_OPTIONS:PsseAcOptions={tolerancePu:1e-6,maxIterations:40,maxQLimitRounds:8,reactiveLimitsEnabled:true,initialVoltagePolicy:'FLAT',minVoltagePu:1e-3,maxVoltagePu:8,loadModelProfile:'PSSE_SOURCE',automaticAdjustments:false,maxAdjustmentRounds:10,remoteRegulation:false,remoteChasing:false,maxRemoteRounds:15,sourceUnits:'MVA_MVAR_DEG_PER_UNIT'};
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
function emptyResult(identity:ReturnType<typeof psseCalculationIdentity>,network:PsseBusBranchNetwork,findings:PsseFinding[],status:PsseCalculationResult['status'],elapsedMs=0):PsseCalculationResult{const physicsCoverage=status==='BLOCKED'?'BLOCKED':'PARTIAL';return {schema:'ga.psse.calculation.v1',id:identity.id,identity,method:'NR_POLAR',status,classification:psseCalculationClassification({status,physicsCoverage,findings}),physicsCoverage,referenceComparisonStatus:'NOT_COMPARED',source:'GA_PSSE_CALCULATED',baseMva:network.baseMva,iterations:0,outerRounds:0,elapsedMs,maxPMismatchPu:null,maxQMismatchPu:null,busResults:network.buses.filter(b=>b.source).map(b=>({id:b.id,connectionKey:b.connectionKey,vmPu:null,vaDeg:null,pGenerationMw:null,qGenerationMvar:null,sourceEquipmentId:b.sourceEquipmentId})),branchResults:network.branches.map(b=>({id:b.id,sourceEquipmentId:b.sourceEquipmentId,terminalFrom:b.terminalFrom,terminalTo:b.terminalTo,pFromMw:null,qFromMvar:null,pToMw:null,qToMvar:null,pLossMw:null,qLossMvar:null})),generatorResults:network.generators.map(g=>({id:g.id,sourceEquipmentId:g.sourceEquipmentId,pMw:null,qMvar:null,limitState:'UNAVAILABLE'})),unsolvedIslands:[],diagnostics:{},findings};}
export function initializePsseState(network:PsseBusBranchNetwork,policy:'FLAT'|'SOURCE_SAVED'):PsseState{
 const n=network.buses.length,vm=new Float64Array(n),va=new Float64Array(n),busType=new Int8Array(n);for(let i=0;i<n;i++){const b=network.buses[i];busType[i]=b.status===0?4:b.type;if(policy==='SOURCE_SAVED'&&b.initialVm!==null&&b.initialVm>0){vm[i]=b.initialVm;va[i]=(b.initialVaDeg??0)*Math.PI/180;}else{vm[i]=1;va[i]=0;}}
 for(let i=0;i<n;i++)if(busType[i]===2){const plant=psseQPlantAtBus(network,i);if(plant.units.length>0&&plant.regulatingUnits.length===0)busType[i]=1;}
 if(policy==='FLAT')for(const generator of network.generators)if(generator.status===1&&generator.qControl==='REGULATING'&&generator.vsPu!==null&&(busType[generator.bus]===2||busType[generator.bus]===3))vm[generator.bus]=generator.vsPu;
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
export interface PsseAdjustmentSummary {rounds:number;tapMoves:number;shuntMoves:number;tapAtLimit:number;shuntAtLimit:number;continuousShunts:number;rolledBack:boolean}
const ADJUSTMENT_EPS=1e-6;
/** One PSS/E-style adjustment pass: at most one tap step or one shunt block step per device per pass. */
function applyPsseAdjustments(network:PsseBusBranchNetwork,state:PsseState,keyToNode:Map<string,number>,appliedShuntSteps:Map<string,number[]>):PsseAdjustmentSummary{
 const summary:PsseAdjustmentSummary={rounds:0,tapMoves:0,shuntMoves:0,tapAtLimit:0,shuntAtLimit:0,continuousShunts:0,rolledBack:false};
 for(const branch of network.branches){
  const control=branch.tapControl;if(branch.status!==1||!control)continue;
  const node=keyToNode.get(control.regulatedKey);if(node===undefined)continue;
  const vm=state.vm[node]!;let raise:boolean|null=null;
  if(vm<control.vminPu-ADJUSTMENT_EPS)raise=true;else if(vm>control.vmaxPu+ADJUSTMENT_EPS)raise=false;else continue;
  // Far-side voltage responds inversely to the winding-1 ratio (V_far ~ V_tap/a1); tap-side directly. SAV sign flag reverses.
  const step=(raise!==control.regulatesTapSide?-1:1)*(control.reverse?-1:1)*control.tapStepPu;
  const target=branch.tapFrom+step,capped=Math.min(control.tapMaxPu,Math.max(control.tapMinPu,target));
  if(Math.abs(capped-branch.tapFrom)<1e-12){summary.tapAtLimit++;continue;}
  retapPsseBranch(branch,capped);summary.tapMoves++;
 }
 for(const shunt of network.shunts){
  const control=shunt.switchedControl;if(shunt.status!==1||!control)continue;
  if(control.modsw!==1){if(control.modsw===2)summary.continuousShunts++;continue;}
  const node=control.remoteKey?keyToNode.get(control.remoteKey)??shunt.bus:shunt.bus,vm=state.vm[node]!;
  const applied=appliedShuntSteps.get(shunt.id)??control.blocks.map(()=>0);appliedShuntSteps.set(shunt.id,applied);
  if(vm>=control.vloPu-ADJUSTMENT_EPS&&vm<=control.vhiPu+ADJUSTMENT_EPS)continue;
  const increaseB=vm<control.vloPu;let moved=false;
  if(increaseB){
   for(let i=0;i<control.blocks.length&&!moved;i++){const block=control.blocks[i]!;if(block.susceptanceMvar>0&&applied[i]!<block.steps){applied[i]!++;shunt.bMvar+=block.susceptanceMvar;moved=true;}}
  }else{
   for(let i=control.blocks.length-1;i>=0&&!moved;i--){const block=control.blocks[i]!;if(block.susceptanceMvar>0&&applied[i]!>0){applied[i]!--;shunt.bMvar-=block.susceptanceMvar;moved=true;}}
   for(let i=0;i<control.blocks.length&&!moved;i++){const block=control.blocks[i]!;if(block.susceptanceMvar<0&&applied[i]!<block.steps){applied[i]!++;shunt.bMvar+=block.susceptanceMvar;moved=true;}}
  }
  if(moved)summary.shuntMoves++;else summary.shuntAtLimit++;
 }
 return summary;
}
/** Sparse polar NR with voltage-dependent ZIP specified powers and a deterministic Q active set. */
export function solvePsseNewton(input:PsseSolveInput):PsseCalculationResult{
 const start=performance.now(),settings=opts(input),scenario=input.scenario??createPsseScenario(input.network),network=effectivePsseNetwork(input.network,scenario),fixed=applyPsseFixedControls(input.model,network,settings.initialVoltagePolicy!,settings.remoteRegulation!),reduction=preparePsseAcReduction(input.model,fixed.network),solveNetwork=reduction.network,optionsHash=psseOptionsHash(settings),approximateControls=fixed.counts.remoteQHeld+fixed.counts.droopQHeld+fixed.counts.localVoltageSetpointHeld+reduction.counts.sourceVoltageDisagreementCount+reduction.counts.cycleRank>0,controlPolicy=`${settings.reactiveLimitsEnabled?'FIXED_CONTROLS_Q_LIMITS':'FIXED_CONTROLS_NO_Q_LIMITS'}${approximateControls?'_SOURCE_SAVED_Q_HOLD':''}`,controlPolicyRevision=approximateControls?'fixed-controls-source-saved-q-hold-1':'fixed-controls-1',identity=psseCalculationIdentity({mode:'PSSE',sourceSha256:network.sourceSha256,modelHash:network.modelHash,topologyHash:psseTopologyHash(network),normalizedModelHash:network.modelHash,normalizedRevision:network.revision,scenarioHash:scenario.hash,solver:'NR_POLAR',engineVersion:PSSE_ENGINE_VERSION,algorithmId:'NR_POLAR',algorithmRevision:'psse-nr-polar-2',controlPolicyId:controlPolicy,controlPolicyRevision,optionsHash,resultSchemaRevision:'psse-result-1',initialVoltagePolicy:settings.initialVoltagePolicy!});
 const audit=auditPsseCapability(input.model,solveNetwork,'NR_POLAR'),auditFindings=settings.remoteRegulation?audit.findings.filter(f=>f.code!=='REMOTE_REGULATION_FIXED_Q_SOURCE_SAVED'):audit.findings,findings=[...auditFindings,...fixed.findings,...reduction.findings];if(audit.status==='BLOCKED'||findings.some(f=>f.severity==='ERROR'))return emptyResult(identity,network,findings,'BLOCKED',performance.now()-start);
 const state=initializePsseState(solveNetwork,settings.initialVoltagePolicy!),refs=referenceBusesFor(solveNetwork,state);let ybus=buildPsseYbus(solveNetwork);
 if(settings.remoteRegulation){
  for(const generator of solveNetwork.generators)if(generator.status===1&&generator.qControl==='REGULATING'&&generator.vsPu!==null&&(generator.remoteBus===null||generator.remoteBus===generator.bus)&&state.busType[generator.bus]===2)state.vm[generator.bus]=generator.vsPu;
  if(!settings.remoteChasing){
   let terminalPv=0;
   for(const generator of solveNetwork.generators)if(generator.status===1&&generator.qControl==='FIXED_Q'&&generator.remoteBus!==null&&generator.remoteBus!==generator.bus&&generator.remoteBus>=0&&generator.vsPu!==null&&generator.qMinMvar!==generator.qMaxMvar){
    generator.qControl='REGULATING';terminalPv++;
    if(state.busType[generator.bus]===1){state.busType[generator.bus]=2;state.vm[generator.bus]=generator.vsPu;}
   }
   if(terminalPv)findings.push({severity:'WARNING',code:'REMOTE_REGULATION_TERMINAL_PV_APPROXIMATION',message:`${terminalPv} remote-regulated machine(s) are approximated by terminal-bus PV regulation at the remote setpoint value; the IREG bus setpoint itself is not enforced in this profile.`});
  }
 }const initialPower=mismatchAt(solveNetwork,ybus,state,refs);let iterations=0,outerRounds=0,linearDiagnostics:unknown=null,lineSearchReductions=0,power:mismatchReturn|null=null;const conversions:number[]=[];
 for(;outerRounds<=settings.maxQLimitRounds!;outerRounds++){
  const run=runNewtonIslandSystem(input,solveNetwork,state,ybus,refs,settings,iterations);iterations+=run.iteration;linearDiagnostics=run.linearDiagnostics;lineSearchReductions+=run.lineSearchReductions;power=run.power;
  if(run.status==='CANCELLED')return {...emptyResult(identity,network,findings,'CANCELLED',performance.now()-start),iterations,outerRounds,diagnostics:{linearDiagnostics}};
  if(run.status!=='CONVERGED')return {...emptyResult(identity,network,findings,'NON_CONVERGED',performance.now()-start),iterations,outerRounds,maxPMismatchPu:power.maxP,maxQMismatchPu:power.maxQ,diagnostics:{linearDiagnostics,lineSearchReductions}};
  if(!settings.reactiveLimitsEnabled)break;
  let changed=false;
  for(const bus of solveNetwork.buses.map((_,i)=>i))if(state.busType[bus]===2||state.busType[bus]===3){const plant=psseQPlantAtBus(solveNetwork,bus);if(!plant.units.length)continue;const requiredQ=(power.q[bus]+power.loadQ[bus])*solveNetwork.baseMva,totalMin=plant.minimumQ,totalMax=plant.maximumQ;
   if(state.busType[bus]===3){if(requiredQ<totalMin-.02||requiredQ>totalMax+.02){findings.push({severity:'ERROR',code:'REFERENCE_Q_LIMIT_EXCEEDED',message:`Reference bus requires ${requiredQ.toFixed(4)} Mvar outside [${totalMin}, ${totalMax}].`});return {...emptyResult(identity,network,findings,'BLOCKED',performance.now()-start),iterations,outerRounds,maxPMismatchPu:power.maxP,maxQMismatchPu:power.maxQ};}}
   else if(requiredQ<totalMin-.02||requiredQ>totalMax+.02){const limit=requiredQ<totalMin?totalMin:totalMax;state.busType[bus]=1;state.qLimited.set(bus,limit/network.baseMva);state.qState.set(bus,limit===totalMin?'QMIN':'QMAX');conversions.push(bus);changed=true;}
  }
  if(!changed)break;if(outerRounds===settings.maxQLimitRounds)return {...emptyResult(identity,network,[...findings,{severity:'ERROR',code:'Q_LIMIT_ROUND_LIMIT',message:'Reactive-limit active set did not settle within the configured outer-round limit.'}],'NON_CONVERGED',performance.now()-start),iterations,outerRounds};
 }
 let remoteSummary:{rounds:number;groups:number;settled:number;maxVoltageErrorPu:number;limitedMachines:number;revertedGroups?:number}|null=null;
 if(settings.remoteRegulation&&fixed.remoteGroups.length&&settings.remoteChasing){
  const machineById=new Map(solveNetwork.generators.map(g=>[g.sourceEquipmentId,g]));
  const groups=fixed.remoteGroups.map(group=>({...group,node:group.remoteBus>=0&&group.remoteBus<input.network.buses.length?reduction.busToNode[group.remoteBus]!:null,gain:1,previousError:0,initialError:0})).filter((group):group is typeof group&{node:number;vsPu:number}=>group.node!==null&&group.vsPu!==null);
  let rounds=0,limitedMachines=0,failedRounds=0;
  const maxRounds=settings.maxRemoteRounds??15;
  for(const group of groups){const vm=state.vm[group.node]!;group.initialError=group.vsPu-vm;}
  const baselineQ=new Map(solveNetwork.generators.filter(g=>g.qControl==='FIXED_Q').map(g=>[g.id,g.qFixedMvar])),baselineVm=Float64Array.from(state.vm),baselineVa=Float64Array.from(state.va);
  for(;rounds<maxRounds;rounds++){
   let worst=0,movedAny=false;
   const previousQ=new Map(solveNetwork.generators.filter(g=>g.qControl==='FIXED_Q').map(g=>[g.id,g.qFixedMvar])),previousVm=Float64Array.from(state.vm),previousVa=Float64Array.from(state.va);
   for(const group of groups){
    const vm=state.vm[group.node]!,error=group.vsPu-vm;worst=Math.max(worst,Math.abs(error));
    if(Math.abs(error)<=1e-4)continue;
    if(error*group.previousError<0&&Math.abs(error)>Math.abs(group.previousError))group.gain=Math.max(group.gain/2,.02);
    group.previousError=error;
    const self=ybus.rows[group.node]!.get(group.node!),bSelf=self?self.im:0;
    const dqPu=Math.max(-.08,Math.min(.08,error*(-bSelf)*Math.max(vm,.5)*group.gain)),dqMvar=dqPu*solveNetwork.baseMva;
    const machines=group.machines.map(id=>machineById.get(id)).filter((m):m is NonNullable<typeof m>=>m!==undefined);
    const weight=machines.reduce((sum,m)=>sum+Math.max(m.participation,0),0)||machines.length;
    for(const machine of machines){
     const share=dqMvar*(Math.max(machine.participation,0)||1)/weight,target=machine.qFixedMvar??machine.qMvar,clamped=Math.min(machine.qMaxMvar,Math.max(machine.qMinMvar,target+share));
     if(Math.abs(clamped-target)>1e-12){movedAny=true;if(clamped===machine.qMinMvar||clamped===machine.qMaxMvar)limitedMachines++;}
     machine.qFixedMvar=clamped;
    }
   }
   if(!movedAny){remoteSummary={rounds,groups:groups.length,settled:worst<=1e-4?groups.length:0,maxVoltageErrorPu:worst,limitedMachines};if(worst>1e-4)findings.push({severity:'WARNING',code:'REMOTE_REGULATION_OUTER_LOOP_UNSETTLED',message:`Remote voltage regulation stopped with ${groups.length} group(s) at limits or ineffective; maximum residual setpoint error ${worst.toFixed(6)} pu.`});break;}
   ybus=buildPsseYbus(solveNetwork);
   const run=runNewtonIslandSystem(input,solveNetwork,state,ybus,refs,settings,iterations);
   iterations+=run.iteration;lineSearchReductions+=run.lineSearchReductions;
   if(run.status!=='CONVERGED'){
    failedRounds++;
    for(const machine of solveNetwork.generators)if(previousQ.has(machine.id))machine.qFixedMvar=previousQ.get(machine.id)!;
    state.vm.set(previousVm);state.va.set(previousVa);
    for(const group of groups)group.gain=Math.max(group.gain/2,.02);
    ybus=buildPsseYbus(solveNetwork);
    const restored=runNewtonIslandSystem(input,solveNetwork,state,ybus,refs,settings,iterations);
    iterations+=restored.iteration;lineSearchReductions+=restored.lineSearchReductions;power=restored.power;
    if(restored.status!=='CONVERGED'||failedRounds>=3){remoteSummary={rounds:rounds+1,groups:groups.length,settled:0,maxVoltageErrorPu:worst,limitedMachines};findings.push({severity:'WARNING',code:'REMOTE_REGULATION_OUTER_LOOP_UNSETTLED',message:'Remote voltage regulation round broke convergence; the last converged Q state is reported.'});findings.push({severity:'ERROR',code:'REMOTE_REGULATION_RESTORE_NOT_CONVERGED',message:'The in-loop rollback re-solve failed; the calculation cannot be published as converged.'});break;}
    continue;
   }
   power=run.power;
   let residual=0;for(const group of groups)residual=Math.max(residual,Math.abs(group.vsPu-state.vm[group.node]!));
   if(residual<=1e-4){remoteSummary={rounds:rounds+1,groups:groups.length,settled:groups.length,maxVoltageErrorPu:residual,limitedMachines};break;}
   if(rounds===maxRounds-1){remoteSummary={rounds:rounds+1,groups:groups.length,settled:0,maxVoltageErrorPu:residual,limitedMachines};findings.push({severity:'WARNING',code:'REMOTE_REGULATION_OUTER_LOOP_UNSETTLED',message:`Remote voltage regulation did not settle within ${maxRounds} outer rounds; maximum residual setpoint error ${residual.toFixed(6)} pu.`});}
  }
  if(!remoteSummary)remoteSummary={rounds,groups:groups.length,settled:groups.length,maxVoltageErrorPu:0,limitedMachines};
  // Safety: if any group ends worse than its starting error, revert the whole loop to the known-solvable
  // loop-start state (source Q plus enforced local setpoints). The loop never publishes a worse solution.
  let reverted=0;
  for(const group of groups){
   const finalError=Math.abs(group.vsPu-state.vm[group.node]!);
   if(finalError>Math.max(Math.abs(group.initialError),1e-3))reverted++;
  }
  if(reverted){
   for(const group of groups)for(const id of group.machines){
    const machine=machineById.get(id);if(!machine)continue;
    machine.qControl='REGULATING';machine.qFixedMvar=null;
    if(machine.vsPu!==null&&state.busType[machine.bus]===1){state.busType[machine.bus]=2;state.vm[machine.bus]=machine.vsPu;}
   }
   ybus=buildPsseYbus(solveNetwork);
   const restored=runNewtonIslandSystem(input,solveNetwork,state,ybus,refs,settings,iterations);
   iterations+=restored.iteration;lineSearchReductions+=restored.lineSearchReductions;power=restored.power;
   if(restored.status!=='CONVERGED'){
    for(const machine of solveNetwork.generators)if(baselineQ.has(machine.id))machine.qFixedMvar=baselineQ.get(machine.id)!;
    for(const group of groups)for(const id of group.machines){const machine=machineById.get(id);if(machine)machine.qControl='FIXED_Q';}
    state.vm.set(baselineVm);state.va.set(baselineVa);
    for(const group of groups)for(const id of group.machines){const machine=machineById.get(id);if(machine&&state.busType[machine.bus]===2)state.busType[machine.bus]=1;}
    ybus=buildPsseYbus(solveNetwork);
    const fallback=runNewtonIslandSystem(input,solveNetwork,state,ybus,refs,settings,iterations);
    iterations+=fallback.iteration;lineSearchReductions+=fallback.lineSearchReductions;power=fallback.power;
    if(fallback.status!=='CONVERGED')return {...emptyResult(identity,network,findings,'NON_CONVERGED',performance.now()-start),iterations,outerRounds,maxPMismatchPu:fallback.power.maxP,maxQMismatchPu:fallback.power.maxQ,diagnostics:{remoteRegulation:remoteSummary}};
   }
   remoteSummary={...remoteSummary,revertedGroups:reverted};
   findings.push({severity:'WARNING',code:'REMOTE_REGULATION_TERMINAL_PV_FALLBACK',message:`${reverted} of ${groups.length} remote regulation group(s) diverged in the outer loop; those machines fall back to terminal-bus PV regulation at the remote setpoint value, which is an approximation of IREG control.`});
   findings.push({severity:'WARNING',code:'REMOTE_REGULATION_OUTER_LOOP_UNSETTLED',message:'Remote setpoints are not enforced for the reverted groups; treat this result as approximate for IREG control.'});
  }
 }
 if(findings.some(f=>f.code==='REMOTE_REGULATION_RESTORE_NOT_CONVERGED'))return {...emptyResult(identity,network,findings,'NON_CONVERGED',performance.now()-start),iterations,outerRounds,maxPMismatchPu:power?.maxP??null,maxQMismatchPu:power?.maxQ??null,diagnostics:{remoteRegulation:remoteSummary}};
 let adjustmentSummary:PsseAdjustmentSummary={rounds:0,tapMoves:0,shuntMoves:0,tapAtLimit:0,shuntAtLimit:0,continuousShunts:0,rolledBack:false};
 if(settings.automaticAdjustments){
  const keyToNode=new Map<string,number>();
  for(let i=0;i<input.network.buses.length;i++){const key=input.network.buses[i].connectionKey,node=reduction.busToNode[i]!;if(!keyToNode.has(key))keyToNode.set(key,node);}
  const applied=new Map<string,number[]>(),maxRounds=settings.maxAdjustmentRounds??10,totals={tapMoves:0,shuntMoves:0,tapAtLimit:0,shuntAtLimit:0,continuousShunts:0};
  for(let round=0;round<maxRounds;round++){
   const branchSnapshot=solveNetwork.branches.map(b=>({tapFrom:b.tapFrom,yff:{...b.yff},yft:{...b.yft},ytf:{...b.ytf},ytt:{...b.ytt}})),shuntSnapshot=solveNetwork.shunts.map(s=>s.bMvar);
   const summary=applyPsseAdjustments(solveNetwork,state,keyToNode,applied);
   totals.tapMoves+=summary.tapMoves;totals.shuntMoves+=summary.shuntMoves;totals.tapAtLimit=Math.max(totals.tapAtLimit,summary.tapAtLimit);totals.shuntAtLimit=Math.max(totals.shuntAtLimit,summary.shuntAtLimit);totals.continuousShunts+=summary.continuousShunts;
   if(!summary.tapMoves&&!summary.shuntMoves){adjustmentSummary={...summary,...totals,rounds:round};break;}
   ybus=buildPsseYbus(solveNetwork);
   const run=runNewtonIslandSystem(input,solveNetwork,state,ybus,refs,settings,iterations);
   iterations+=run.iteration;lineSearchReductions+=run.lineSearchReductions;
   if(run.status!=='CONVERGED'){
    solveNetwork.branches.forEach((b,i)=>{const s=branchSnapshot[i]!;b.tapFrom=s.tapFrom;b.yff={...s.yff};b.yft={...s.yft};b.ytf={...s.ytf};b.ytt={...s.ytt};});
    solveNetwork.shunts.forEach((s,i)=>{s.bMvar=shuntSnapshot[i]!;});
    ybus=buildPsseYbus(solveNetwork);
    const restored=runNewtonIslandSystem(input,solveNetwork,state,ybus,refs,settings,iterations);iterations+=restored.iteration;power=restored.power;
    findings.push({severity:'WARNING',code:'AUTO_ADJUSTMENT_NON_CONVERGED_ROLLBACK',message:'An automatic tap/switched-shunt pass broke convergence; the pass was rolled back and the last converged state is reported.'});
    adjustmentSummary={...summary,...totals,rounds:round+1,rolledBack:true};break;
   }
   power=run.power;
   if(round===maxRounds-1){adjustmentSummary={...summary,...totals,rounds:round+1};findings.push({severity:'WARNING',code:'AUTO_ADJUSTMENT_ROUND_LIMIT',message:'Automatic adjustments did not settle within the configured round limit; the current tap/shunt state is reported.'});}
  }
 }
 if(remoteSummary?.rounds)findings.push({severity:'INFO',code:'REMOTE_REGULATION_OUTER_LOOP_APPLIED',message:`Remote voltage regulation converged for ${remoteSummary.settled}/${remoteSummary.groups} group(s) in ${remoteSummary.rounds} outer round(s); ${remoteSummary.limitedMachines} machine(s) clamped at Q limits.`});
 if(adjustmentSummary.tapMoves)findings.push({severity:'INFO',code:'AUTO_TAP_ADJUSTMENT_APPLIED',message:`${adjustmentSummary.tapMoves} automatic tap step(s) across ${adjustmentSummary.rounds} adjustment round(s).`});
 if(adjustmentSummary.tapAtLimit)findings.push({severity:'INFO',code:'AUTO_TAP_AT_LIMIT',message:`${adjustmentSummary.tapAtLimit} regulating tap(s) reached a ratio limit.`});
 if(adjustmentSummary.shuntMoves)findings.push({severity:'INFO',code:'AUTO_SWITCHED_SHUNT_ADJUSTMENT_APPLIED',message:`${adjustmentSummary.shuntMoves} switched-shunt block step(s) across ${adjustmentSummary.rounds} adjustment round(s).`});
 if(adjustmentSummary.continuousShunts)findings.push({severity:'WARNING',code:'SWITCHED_SHUNT_CONTINUOUS_MODE_NOT_ADJUSTED',message:`${adjustmentSummary.continuousShunts} continuous-mode switched shunt(s) kept their initial susceptance; continuous adjustment is not implemented.`});
 const finalPower=power??mismatchAt(solveNetwork,ybus,state,refs),lowVoltage=lowVoltageLoadFindings(solveNetwork,state,settings.loadModelProfile!);findings.push(...lowVoltage);if(lowVoltage.some(f=>f.severity==='ERROR'))return {...emptyResult(identity,network,findings,'BLOCKED',performance.now()-start),iterations,outerRounds,maxPMismatchPu:finalPower.maxP,maxQMismatchPu:finalPower.maxQ};
 const generatorResults=psseGeneratorResults(solveNetwork,state,finalPower,settings.reactiveLimitsEnabled!,findings),sourceState:PsseState={...state,vm:new Float64Array(network.buses.length),va:new Float64Array(network.buses.length),busType:new Int8Array(network.buses.length)};for(let i=0;i<network.buses.length;i++){const node=reduction.busToNode[i];sourceState.vm[i]=state.vm[node]!;sourceState.va[i]=state.va[node]!;sourceState.busType[i]=network.buses[i].status?network.buses[i].type:4;}
 const ordinaryBranchResults=psseBranchResults(network,sourceState),expansion=recoverPsseAcExpansion(reduction,network,sourceState,finalPower,generatorResults,ordinaryBranchResults);if(expansion.maxIdealKclResidualMva>Math.max(settings.tolerancePu!*network.baseMva*10,1e-5)){findings.push({severity:'ERROR',code:'AC_IDEAL_LINK_KCL_RESIDUAL',message:`Recovered ideal-link terminal balance residual ${expansion.maxIdealKclResidualMva.toExponential(3)} MVA exceeds the selected solver tolerance.`});return {...emptyResult(identity,network,findings,'NON_CONVERGED',performance.now()-start),iterations,outerRounds,maxPMismatchPu:finalPower.maxP,maxQMismatchPu:finalPower.maxQ,diagnostics:{idealLinkRecoveryResidualMva:expansion.maxIdealKclResidualMva}};}
 const busResults:PsseBusResult[]=network.buses.flatMap((b,i)=>b.source?[{id:b.id,connectionKey:b.connectionKey,vmPu:b.status===1?sourceState.vm[i]:null,vaDeg:b.status===1?sourceState.va[i]*180/Math.PI:null,pGenerationMw:b.status===1?(expansion.machineByBus.get(i)?.p??0):null,qGenerationMvar:b.status===1?(expansion.machineByBus.get(i)?.q??0):null,sourceEquipmentId:b.sourceEquipmentId}]:[]);
 const idealById=new Map(reduction.idealBranches.map(b=>[b.id,b])),ordinaryById=new Map(ordinaryBranchResults.map(b=>[b.id,b]));const branchResults=network.branches.map(branch=>{const ideal=idealById.get(branch.id),flow=expansion.idealFlows.get(branch.id);if(!ideal||!flow)return ordinaryById.get(branch.id)!;const base=ordinaryById.get(branch.id)!,from={p:flow.p+(base.pFromMw??0),q:flow.q+(base.qFromMvar??0)},to={p:-flow.p+(base.pToMw??0),q:-flow.q+(base.qToMvar??0)};return psseBranchResultFromTerminalPowers(network,sourceState,branch,from,to);});
 const approximateCodes=['REMOTE_REGULATION_OUTER_LOOP_UNSETTLED','REMOTE_REGULATION_TERMINAL_PV_APPROXIMATION','REMOTE_REGULATION_TERMINAL_PV_FALLBACK','REMOTE_REGULATION_FIXED_Q_SOURCE_SAVED','GENERATOR_DROOP_FIXED_Q_SOURCE_SAVED','GENERATOR_DROOP_FIXED_Q_APPROXIMATION','VOLTAGE_DROOP_Q_FIXED_APPROXIMATION','LOCAL_REGULATION_SOURCE_SAVED_VOLTAGE_HELD','PV_WITHOUT_ACTIVE_GENERATOR_FIXED_PQ','AC_IDEAL_LINK_SOURCE_VOLTAGE_DISAGREEMENT'];if(expansion.allocationApproximationCount)findings.push({severity:'WARNING',code:'PER_MACHINE_DISPATCH_UNAVAILABLE',message:`${expansion.allocationApproximationCount} unobservable machine dispatch(es) were allocated by RMPCT only for bus-level ideal-link KCL recovery.`});if(reduction.counts.cycleRank)findings.push({severity:'INFO',code:'AC_IDEAL_LINK_CYCLE_FLOW_ALLOCATION',message:`Ideal-link cyclic components have non-unique terminal flows; a deterministic source-|X|-weighted solution was used.`});const approximate=expansion.allocationApproximationCount>0||reduction.counts.cycleRank>0||findings.some(f=>approximateCodes.includes(f.code));
 const physicsCoverage=approximate||findings.some(f=>f.code==='GENERIC_ZIP_BELOW_PSSE_BREAKPOINT'||f.code==='BASE_KV_UNAVAILABLE_PER_UNIT_PROFILE'||f.code==='PER_MACHINE_DISPATCH_UNAVAILABLE')?'PARTIAL':'SUPPORTED',status='CONVERGED' as const,result:PsseCalculationResult={schema:'ga.psse.calculation.v1',id:identity.id,identity,method:'NR_POLAR',status,classification:psseCalculationClassification({status,physicsCoverage,findings}),physicsCoverage,referenceComparisonStatus:'NOT_COMPARED',source:'GA_PSSE_CALCULATED',baseMva:network.baseMva,iterations,outerRounds,elapsedMs:performance.now()-start,maxPMismatchPu:finalPower.maxP,maxQMismatchPu:finalPower.maxQ,busResults,branchResults,generatorResults,unsolvedIslands:[],diagnostics:{sparse:{dimension:linearDiagnostics&&typeof linearDiagnostics==='object'?(linearDiagnostics as {dimension?:number}).dimension??null:solveNetwork.buses.length,nnz:linearDiagnostics&&typeof linearDiagnostics==='object'?(linearDiagnostics as {nnz?:number}).nnz??null:null,backend:'KLU_WASM',linearDiagnostics},initialMismatchPu:{p:initialPower.maxP,q:initialPower.maxQ,max:Math.max(initialPower.maxP,initialPower.maxQ)},lineSearchReductions,adjustments:adjustmentSummary,remoteRegulation:remoteSummary,activeQLimitBuses:conversions.map(i=>solveNetwork.buses[i].id),busCount:network.buses.length,branchCount:network.branches.length,numericalNodeCount:solveNetwork.buses.length,ybusNnz:ybus.nnz,initialVoltagePolicy:settings.initialVoltagePolicy,controlApproximation:fixed.counts,idealLinkContraction:reduction.counts,idealLinkRecovery:{method:reduction.counts.cycleRank?'TREE_KCL_OR_MINIMUM_SOURCE_ABS_X':'TREE_KCL',cycleRank:expansion.idealCycleRank,maxKclResidualMva:expansion.maxIdealKclResidualMva},sourceSavedVoltageMismatchPreserved:settings.initialVoltagePolicy==='SOURCE_SAVED'},findings};return result;
}
type mismatchReturn=ReturnType<typeof calculatePssePower>;
