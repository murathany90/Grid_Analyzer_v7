import { abs, finite } from './math';
import { buildY } from './ybus';
import { calcPQ, fillJacobian, makeLayout, makeExplicitLayout } from './jacobian';
import { solveLinear,solveLinearFill1 } from './linear-solver';
import { KluSparseDirectFactorization } from './sparse-direct';
import type { AdmittanceMatrix, IntegratedStationControl, JacobianLayout, LinearSolution, NumericalFailureDiagnostic, NumericalModel, PowerFlowResult, ProgressCallback } from './types';
export type { NumericalModel } from './types';

export interface FullAcSolverSettings {
  maxInnerIterations:number; maxOuterIterations:number; nodalToleranceKva:number;
  modelEquationTolerancePercent:number; maxNoImprovementIterations:number;
  repeatedReactiveLimitDetection:number; reactiveLimitsEnabled:boolean; qLimitToleranceMvar:number;
  /** Effective bound of the reactive active-set (Q-limit) round loop. */
  maxQLimitRounds?:number;
  /** Numerical voltage-domain safety bound in pu. Not a physical solution limit. */
  minVoltagePu?:number; maxVoltagePu?:number;
}
/**
 * Numerical voltage-domain safety bound.
 *
 * These are numerical guards only: they reject non-finite, zero and negative
 * magnitudes that would make the branch-power and Jacobian expressions undefined,
 * and they cap runaway steps. They are deliberately far wider than any physical
 * operating point so that a genuine low-voltage solution branch is not excluded.
 *
 * The previous fixed `0.35 <= Vm <= 1.85` window rejected converged low-voltage
 * solutions whose voltage fell below 0.35 pu while satisfying every nodal power
 * equation. That window was a numerical guard being used as a physical limit.
 */
export const DEFAULT_VOLTAGE_DOMAIN_PU:{minPu:number;maxPu:number}={minPu:1e-3,maxPu:8};
export function resolveVoltageDomainPu(settings:{minVoltagePu?:number;maxVoltagePu?:number}|undefined):{minPu:number;maxPu:number}{
  const minPu=settings?.minVoltagePu, maxPu=settings?.maxVoltagePu;
  return{minPu:typeof minPu==='number'&&Number.isFinite(minPu)&&minPu>0?minPu:DEFAULT_VOLTAGE_DOMAIN_PU.minPu,maxPu:typeof maxPu==='number'&&Number.isFinite(maxPu)&&maxPu>1?maxPu:DEFAULT_VOLTAGE_DOMAIN_PU.maxPu};
}
/** A voltage magnitude the solver may accept. Non-finite and non-positive values are never admissible. */
export function isAdmissibleVoltage(vm:number,domain:{minPu:number;maxPu:number}):boolean{
  return Number.isFinite(vm)&&vm>=domain.minPu&&vm<=domain.maxPu;
}
const DEFAULT_SOLVER_SETTINGS:FullAcSolverSettings={maxInnerIterations:30,maxOuterIterations:8,nodalToleranceKva:.1,modelEquationTolerancePercent:.01,maxNoImprovementIterations:20,repeatedReactiveLimitDetection:3,reactiveLimitsEnabled:true,qLimitToleranceMvar:.02,maxQLimitRounds:8,...DEFAULT_VOLTAGE_DOMAIN_PU&&{minVoltagePu:DEFAULT_VOLTAGE_DOMAIN_PU.minPu,maxVoltagePu:DEFAULT_VOLTAGE_DOMAIN_PU.maxPu}};
export function nodalToleranceKvaToPu(toleranceKva:number,baseMva:number):number{return toleranceKva/1000/baseMva;}

/** One generic PV bus held at its own reactive limit. */
export interface GenericQLimitUnit {
  bus:number;
  /** MVAr limit the bus is currently held at. */
  qLimit:number;
  /** Q the unconstrained PV solution demanded, MVAr. */
  qRequired:number;
  state:'QMIN_LIMITED'|'QMAX_LIMITED';
  qMin:number;
  qMax:number;
  /** Q specification to restore when the bus returns to PV, pu on the model base. */
  qSpecBeforePu:number;
}
interface SolverState {
  Vm:Float64Array; Va:Float64Array; P:Float64Array; Q:Float64Array;
  qSpec:Float64Array; busType:Int8Array; controlDq:Float64Array; alphaMw:number;
}

/**
 * Complementarity test for releasing a Q-limited PV bus.
 *
 * The Q limit of a generic PV bus is a variable bound, so it is active exactly when the
 * unconstrained PV solution violates it. After a release trial the bus is solved as PV
 * again, and this test asks whether the resulting operating point sits strictly inside
 * the bounds. A boundary point means the bound is still active and the release is
 * rejected. This is a KKT/complementarity decision on the solved solution; it never
 * looks at the direction of the previous Q dispatch.
 */
export function genericQLimitReleaseAccepts(unit:Pick<GenericQLimitUnit,'qMin'|'qMax'>,qSolvedMvar:number,toleranceMvar:number):boolean{
  if(!Number.isFinite(qSolvedMvar)||!Number.isFinite(unit.qMin)||!Number.isFinite(unit.qMax))return false;
  if(!(unit.qMax>=unit.qMin))return false;
  return qSolvedMvar>unit.qMin+toleranceMvar&&qSolvedMvar<unit.qMax-toleranceMvar;
}

/**
 * Armijo decrease is proportional to the step actually applied after capping.
 *
 * `convergenceTolerancePu` is the nodal convergence tolerance in pu. The previous
 * fixed `1e-6` mismatch acceptance contradicted the configured `nodalToleranceKva`
 * (default 5 kVA => 5e-5 pu), so a step could be accepted as "converged enough"
 * while the nodal criterion was still violated. The default keeps the historical
 * behaviour for direct callers that pass no tolerance.
 */
export function acceptsNewtonStep(baseNorm:number,nextNorm:number,stepFraction:number,maxMismatch:number,convergenceTolerancePu=1e-6):boolean {
  return nextNorm<baseNorm*(1-1e-5*stepFraction)||maxMismatch<convergenceTolerancePu;
}

/**
 * One-sided fraction to boundary for the distributed-P unknown.
 *
 * A positive alpha reduces participating load (`Pload_new = Pload - alpha*w_i/base`), so it
 * may push an eligible load past zero consumption, where it would behave as a generator.
 * The physical boundary in that direction is `min(L_i / w_i)` over participating buses.
 * `L_i` and `alphaMw` are both MW and the injection change is `alphaMw*w_i/base`, so the
 * base cancels against the pu load and the bound carries no base factor.
 *
 * The bound is deliberately NOT symmetric. A negative alpha raises load, and the only limit
 * in that direction would be a sourced maximum load, which this model does not carry. An
 * artificial `-alphaBound` would invent a capability the source does not state, so the
 * load-increasing direction stays unbounded.
 */
export function alphaLoadReductionBound(weights:ArrayLike<number>|undefined,eligibleLoadMw:ArrayLike<number>|undefined,busCount:number):number{
  if(!weights||!eligibleLoadMw)return Infinity;
  let bound=Infinity;
  for(let i=0;i<busCount;i++){const w=weights[i]??0;if(!(w>0))continue;const headroom=eligibleLoadMw[i]??0;if(!(headroom>0))continue;bound=Math.min(bound,headroom/w);}
  return Number.isFinite(bound)?bound:Infinity;
}

/** Array min/max by loop: `Math.min(...values)` overflows the argument limit on large islands. */
export function loopMin(values:ArrayLike<number>):number{let result=Infinity;for(let i=0;i<values.length;i++)if(values[i]<result)result=values[i];return result;}
export function loopMax(values:ArrayLike<number>):number{let result=-Infinity;for(let i=0;i<values.length;i++)if(values[i]>result)result=values[i];return result;}

function topologyCounts(model:NumericalModel):{islandCount:number;unsuppliedBusCount:number}{
 const adjacency:number[][]=Array.from({length:model.n},()=>[]);for(const e of model.branches){if(e.i<0||e.j<0||e.i>=model.n||e.j>=model.n)continue;adjacency[e.i].push(e.j);adjacency[e.j].push(e.i);}
 const seen=new Uint8Array(model.n);let islandCount=0;for(let i=0;i<model.n;i++)if(!seen[i]){islandCount++;seen[i]=1;const q=[i];while(q.length){for(const j of adjacency[q.pop()!]||[])if(!seen[j]){seen[j]=1;q.push(j);}}}
 const supplied=new Uint8Array(model.n);if(Number.isInteger(model.slack)&&model.slack>=0&&model.slack<model.n){supplied[model.slack]=1;const q=[model.slack];while(q.length){for(const j of adjacency[q.pop()!]||[])if(!supplied[j]){supplied[j]=1;q.push(j);}}}
 return{islandCount,unsuppliedBusCount:model.n-supplied.reduce((a,b)=>a+b,0)};
}

export function solveNR(model: NumericalModel, progress?: ProgressCallback, options: { settings?:Partial<FullAcSolverSettings>; maxQLimitRounds?: number;initialVm?:ArrayLike<number>;initialVa?:ArrayLike<number>;initialLimitedBuses?:PowerFlowResult['pvToPq'];initialControlDqPu?:ArrayLike<number>;initialAlphaMw?:number;stationControls?:readonly IntegratedStationControl[];integratedEquations?:boolean;integratedActiveBalance?:boolean;admittance?:AdmittanceMatrix;layoutCache?:Map<string,JacobianLayout>;linearFill?:0|1;busIds?:readonly string[];controlIds?:readonly string[];workCounters?:{fullNrSolves:number;kluNewtonFactorizations:number;totalNewtonIterations?:number} } = {}): PowerFlowResult {
 const t0=performance.now?.()||Date.now(),n=model.n,base=model.baseMVA||100,slack=model.slack,counts=topologyCounts(model),elapsed=()=>((performance.now?.()||Date.now())-t0);
 if(options.workCounters)options.workCounters.fullNrSolves++;
 const settings={...DEFAULT_SOLVER_SETTINGS,...options.settings},tolerancePu=nodalToleranceKvaToPu(settings.nodalToleranceKva,base),voltageDomain=resolveVoltageDomainPu(settings);
 const failure=(failureStage:NumericalFailureDiagnostic['failureStage'],message:string,iteration:number|null,controlRound:number,maxMismatchMw:number|null,extra:Partial<NumericalFailureDiagnostic>={})=>({failureStage,iteration,controlRound,maxMismatchMw,minPivot:null,islandCount:counts.islandCount,unsuppliedBusCount:counts.unsuppliedBusCount,referenceBus:Number.isInteger(slack)&&slack>=0&&slack<n?slack:null,message,...extra});
 if(!(Number.isInteger(slack)&&slack>=0&&slack<n)){const diagnostic=failure('NO_SLACK','Geçerli referans bara bulunamadı.',null,0,null);return{status:'NO_SLACK',converged:false,iterations:0,rounds:0,maxMismatchMW:null,failure:diagnostic,elapsedMs:elapsed()};}
 let Y:AdmittanceMatrix;try{Y=options.admittance??buildY(model);}catch(e){const message=e instanceof Error?e.message:String(e),diagnostic=failure('YBUS_BUILD',message,null,0,null);return{status:'MODEL_INVALID',converged:false,iterations:0,rounds:0,maxMismatchMW:null,failure:diagnostic,elapsedMs:elapsed()};}progress?.('YBUS_READY',{buses:n,nnz:Y.colIdx.length});
 const pSpec=Float64Array.from(model.pSpec,v=>v/base),qSpec=Float64Array.from(model.qSpec,v=>v/base),busType=Int8Array.from(model.busType),Vm=options.initialVm?.length===n?Float64Array.from(options.initialVm,v=>isAdmissibleVoltage(v,voltageDomain)?v:1):new Float64Array(n).fill(1),Va=options.initialVa?.length===n?Float64Array.from(options.initialVa,v=>finite(v)?v:0):new Float64Array(n),P=new Float64Array(n),Q=new Float64Array(n);
 const controls=options.stationControls??[],explicit=options.integratedEquations===true,activeBalance=explicit&&options.integratedActiveBalance===true&&model.activeBalanceEligibilityComplete===true&&!!model.activeBalanceParticipation?.length&&Array.from(model.activeBalanceParticipation).some(value=>value>0),
  weights=activeBalance?model.activeBalanceParticipation:undefined,controlDq=options.initialControlDqPu?.length===controls.length?Float64Array.from(options.initialControlDqPu,v=>finite(v)?v:0):new Float64Array(controls.length),effectiveQ=new Float64Array(n);
 let alphaMw:number=options.initialAlphaMw!=null&&finite(options.initialAlphaMw)?options.initialAlphaMw:0;
 const refreshEffectiveQ=()=>{effectiveQ.set(qSpec);controls.forEach((control,index)=>{for(const actuator of control.actuators)effectiveQ[actuator.bus]+=actuator.participation*controlDq[index];});};
const seededLimits:Array<{bus:number;qRequired:number;qLimit:number;state?:'QMIN_LIMITED'|'QMAX_LIMITED'}>=[],pvQSpecBefore=Float64Array.from(qSpec),genericSeeded=new Set<number>(),genericLimited:GenericQLimitUnit[]=[];
  for(const limited of options.initialLimitedBuses??[]){const bus=limited.bus;if(!Number.isInteger(bus)||bus<0||bus>=n||!finite(limited.qLimit)||!(busType[bus]===1||bus===slack&&busType[bus]===2))continue;
   busType[bus]=0;qSpec[bus]=limited.qLimit/base;seededLimits.push({...limited});
   // A seeded limit came from an earlier solve. The pre-limit PV specification is still
   // recoverable from the incoming model, so the bus stays a release candidate instead
   // of being permanently monotonic.
   const seedLo=bus===slack?(model.referenceQMinNet||[])[bus]:(model.qMinNet||[])[bus],seedHi=bus===slack?(model.referenceQMaxNet||[])[bus]:(model.qMaxNet||[])[bus];
   if(seedLo!=null&&seedHi!=null&&finite(seedLo)&&finite(seedHi)){
    genericLimited.push({bus,qLimit:limited.qLimit,qRequired:limited.qRequired,state:limited.state??(limited.qLimit<=seedLo?'QMIN_LIMITED':'QMAX_LIMITED'),qMin:seedLo,qMax:seedHi,qSpecBeforePu:pvQSpecBefore[bus]});
    genericSeeded.add(bus);}}
 if(busType[slack]===2)Vm[slack]=model.slackVm||1;
 for(let i=0;i<n;i++)if(busType[i]===1)Vm[i]=model.vmSet?.[i]||1;
 if(!explicit||!options.initialVm)for(const control of controls)Vm[control.remoteBus]=control.targetVmPu;
 const qMin=model.qMinNet||[],qMax=model.qMaxNet||[],refQMin=model.referenceQMinNet||[],refQMax=model.referenceQMaxNet||[],pvToPq:Array<{bus:number;qRequired:number;qLimit:number;state?:'QMIN_LIMITED'|'QMAX_LIMITED'}>=seededLimits,qLimitRounds:NonNullable<PowerFlowResult['qLimitRounds']>=[],warnings:string[]=[];let totalIter=0,lastLinear:LinearSolution|null=null,maxMismatch=Infinity,round=0;
// Generic PV <-> PQ active set for buses whose own reactive limit is active.
//
// Station actuator and remote buses are excluded: the station-control path nulls their
// net Q limits and owns the bidirectional station-member logic, so the two mechanisms
// must not drive the same membership decision.
let releaseSnapshot:SolverState|null=null;
  const captureState=():SolverState=>({Vm:Float64Array.from(Vm),Va:Float64Array.from(Va),P:Float64Array.from(P),Q:Float64Array.from(Q),qSpec:Float64Array.from(qSpec),busType:Int8Array.from(busType),controlDq:Float64Array.from(controlDq),alphaMw});
  const restoreState=(state:SolverState)=>{Vm.set(state.Vm);Va.set(state.Va);P.set(state.P);Q.set(state.Q);qSpec.set(state.qSpec);busType.set(state.busType);controlDq.set(state.controlDq);alphaMw=state.alphaMw;};
// Release is attempted at most once per bus. A bus whose limit is re-applied after its
// own release trial has an active complementarity condition; re-testing it would only
// alternate between the same two active sets, so it is retired by cycle detection
// rather than by an arbitrary attempt counter.
const releaseRetired=new Set<number>();let releaseTrialBus=-1,releaseAccepted=0,releaseRejected=0,releasedUnitsTotal=0,alphaBoundApplied=false;
const genericActiveSet={accepted:0,rejected:0,retiredBusCount:()=>releaseRetired.size};
// Reactive active-set rounds are independent of station-controller outer rounds.
  // The bound is a typed setting so provenance can report the value actually used.
  const qLimitRoundLimit=Math.max(1,Math.floor(options.maxQLimitRounds??settings.maxQLimitRounds??8));
  const alphaBoundPu=alphaLoadReductionBound(activeBalance?weights:undefined,model.activeBalanceEligibleLoadMw,n);
for(round=0;round<qLimitRoundLimit;round++){
   const layoutCache=controls.length?undefined:options.layoutCache,layoutKey=layoutCache?Array.from(busType).join('')+'|'+slack+'|'+Number(activeBalance):'';let L:JacobianLayout;
  try{L=layoutCache?.get(layoutKey)??(explicit?makeExplicitLayout(Y,busType,slack,controls,activeBalance,weights):makeLayout(Y,busType,slack,controls));if(layoutCache&&!layoutCache.has(layoutKey))layoutCache.set(layoutKey,L);}
  catch(error){const message=error instanceof Error?error.message:String(error),diagnostic=failure('LINEAR_SOLVE',message,null,round+1,null);return{status:'INTEGRATED_LAYOUT_FAILED',converged:false,iterations:totalIter,rounds:round+1,maxMismatchMW:null,failure:diagnostic,elapsedMs:elapsed()};}
  const Jvals=new Float64Array(L.colIdx.length),rhs=new Float64Array(L.N);let converged=false,nrReason='',nrFailure:NumericalFailureDiagnostic|undefined,lastMinPivot:number|null=null,lastLinearStage:string|undefined,bestMismatch=Infinity,noImprovement=0;
   // Direct-solve acceptance is a linear-accuracy criterion, not the nodal convergence
   // criterion. It must stay at least three orders of magnitude tighter than the nodal
   // tolerance so an accepted Newton direction cannot carry a residual that the nodal
   // test would then treat as progress. Previously a fixed 1e-8 with no stated relation
   // to `nodalToleranceKva`.
   const directResidualLimitPu=Math.min(1e-8,tolerancePu*1e-3);
  for(let it=0;it<settings.maxInnerIterations;it++){
   calcPQ(Y,Vm,Va,P,Q);refreshEffectiveQ();let mx=0,ss=0;
   for(let k=0;k<L.ang.length;k++){const i=L.ang[k],d=pSpec[i]+alphaMw*(weights?.[i]??0)/base-P[i];rhs[k]=d;mx=Math.max(mx,abs(d));ss+=d*d;}
   for(let k=0;k<L.pq.length;k++){const i=L.pq[k],d=effectiveQ[i]-Q[i];rhs[L.nang+k]=d;mx=Math.max(mx,abs(d));ss+=d*d;}
   if(explicit)controls.forEach((control,index)=>{const q=(control.measurementQmvar??0)+(control.measurementParticipation??1)*controlDq[index]*base,d=control.targetVmPu+(control.droopQmvar?q/control.droopQmvar:0)-Vm[control.remoteBus];rhs[L.controlRow![index]]=d;mx=Math.max(mx,abs(d));ss+=d*d;});
   if(activeBalance){const d=pSpec[slack]+alphaMw*(weights?.[slack]??0)/base-P[slack];rhs[L.alphaRow!]=d;mx=Math.max(mx,abs(d));ss+=d*d;}
   maxMismatch=mx;progress?.('INNER_ITERATION',{round:round+1,iteration:it+1,maxMismatchMW:mx*base});
   if(mx<tolerancePu){converged=true;break;}
   if(mx<bestMismatch*(1-1e-10)){bestMismatch=mx;noImprovement=0;}else noImprovement++;
   if(noImprovement>=settings.maxNoImprovementIterations){nrReason='NR_STAGNATION';break;}
   fillJacobian(Y,L,Vm,Va,P,Q,Jvals,controls,base,weights);const A={N:L.N,rowPtr:L.rowPtr,colIdx:L.colIdx,values:Jvals,pos:L.pos,diagPos:L.diagPos};let lin:LinearSolution|null=null;
   const linearDiagnostics={minPivot:null as number|null,stage:'START',pivotSource:undefined as NumericalFailureDiagnostic['pivotSource']};
    // The direct backend is allowed to fail over to the iterative solver, but the stage at
    // which it gave up must reach the failure diagnostic instead of being swallowed.
    let directFailureStage:string|null=null,directFailureMessage:string|null=null;
const tryDirect=()=>{const direct=new KluSparseDirectFactorization();
     try{direct.factorize(A);if(options.workCounters)options.workCounters.kluNewtonFactorizations++;const solved=direct.solve(rhs);if(solved.success&&solved.x&&solved.trueResidual!=null&&solved.trueResidual<=directResidualLimitPu){lin={x:solved.x,iterations:0,residual:solved.trueResidual,method:'KLU_DIRECT'};linearDiagnostics.stage='KLU_DIRECT';}else directFailureStage=direct.diagnostics.failureStage!=='NONE'?direct.diagnostics.failureStage:'REJECTED_RESIDUAL';}
     catch(e){directFailureStage=direct.diagnostics.failureStage!=='NONE'?direct.diagnostics.failureStage:'FACTORIZE_THREW';directFailureMessage=e instanceof Error?e.message:String(e);}
     finally{direct.dispose();}};
   // ILU is inexpensive on small matrices; direct factorization avoids long Krylov tails on large grids.
   if(A.N>=512)tryDirect();
   if(!lin)try{lin=(options.linearFill===1?solveLinearFill1:solveLinear)(A,rhs,linearDiagnostics);}catch(e){nrReason='LINEAR_SOLVER_FAILED';nrFailure=failure('LINEAR_SOLVE',e instanceof Error?e.message:String(e),it+1,round+1,mx*base,{minPivot:linearDiagnostics.minPivot,linearStage:linearDiagnostics.stage,pivotSource:linearDiagnostics.pivotSource});}lastMinPivot=linearDiagnostics.minPivot;lastLinearStage=linearDiagnostics.stage;
   if(!lin&&A.N<512)tryDirect();
   if(!lin){nrReason='LINEAR_SOLVER_FAILED';nrFailure??=failure('LINEAR_SOLVE',`Lineer çözücü yakınsamadı (${linearDiagnostics.stage}).`,it+1,round+1,mx*base,{minPivot:linearDiagnostics.minPivot,linearStage:linearDiagnostics.stage,pivotSource:linearDiagnostics.pivotSource,kluFailureStage:directFailureStage,kluFailureMessage:directFailureMessage});break;}lastLinear=lin;const dx=lin.x,oldVm=Float64Array.from(Vm),oldVa=Float64Array.from(Va),oldDq=Float64Array.from(controlDq),oldAlpha=alphaMw,baseNorm=Math.sqrt(ss);let accepted=false;
   let stepCap=1,boundIndex=-1;for(let k=0;k<L.nang;k++)stepCap=Math.min(stepCap,.35/Math.max(Math.abs(dx[k]),1e-15));for(const bus of L.vm)stepCap=Math.min(stepCap,.16/Math.max(Math.abs(dx[L.vIndex[bus]]),1e-15));
    // One-sided fraction to boundary for the distributed-P unknown. Without it a Newton step
    // can push an eligible load past zero consumption, reversing its flow direction.
    // Only a load-reducing step (delta > 0) is clipped: raising load has no sourced upper
    // limit, and an artificial symmetric bound would invent one.
    if(activeBalance&&L.alphaIndex!=null&&Number.isFinite(alphaBoundPu)){const delta=dx[L.alphaIndex];if(delta>1e-15&&oldAlpha<alphaBoundPu){const toBound=(alphaBoundPu-oldAlpha)/delta;if(toBound>=0&&toBound<stepCap){stepCap=Math.max(0,toBound);alphaBoundApplied=true;}}}
   if(explicit)for(let k=0;k<controls.length;k++){const delta=dx[L.controlIndex[k]],limit=delta>0?controls[k].maxDqPu:controls[k].minDqPu;
    if(limit==null||!finite(limit)||Math.abs(delta)<1e-15)continue;const fraction=(limit-oldDq[k])/delta;
    if(fraction>=-1e-9&&fraction<stepCap){stepCap=Math.max(0,fraction);boundIndex=k;}
   }
   const boundaryResult=(index:number):PowerFlowResult=>({status:'CONTROL_BOUND_HIT',converged:false,iterations:totalIter,rounds:round+1,maxMismatchMW:maxMismatch*base,linear:lastLinear,elapsedMs:elapsed(),pvToPq,Vm:Array.from(Vm),Va:Array.from(Va),P:Array.from(P,v=>v*base),Q:Array.from(Q,v=>v*base),controlDqPu:Array.from(controlDq),alphaMw,boundControlIndex:index});
   if(boundIndex>=0&&stepCap<1e-9)return boundaryResult(boundIndex);
    let bestNorm=Infinity,acceptedScale=0,firstInvalidCandidate:NumericalFailureDiagnostic['firstInvalidCandidate'];
    for(let scale=1;scale>=1/256;scale/=2){
    Vm.set(oldVm);Va.set(oldVa);controlDq.set(oldDq);alphaMw=oldAlpha;
    for(let k=0;k<L.ang.length;k++){const i=L.ang[k];Va[i]+=dx[k]*stepCap*scale;}
    for(const i of L.vm)Vm[i]+=dx[L.vIndex[i]]*stepCap*scale;
    for(let k=0;k<controls.length;k++)controlDq[k]+=dx[L.controlIndex[k]]*stepCap*scale;
    if(activeBalance)alphaMw+=dx[L.alphaIndex!]*stepCap*scale;
    let bad=false;for(let i=0;i<n;i++)if(!isAdmissibleVoltage(Vm[i],voltageDomain)){bad=true;firstInvalidCandidate??={bus:i,busId:options.busIds?.[i]??null,oldVm:oldVm[i],candidateVm:Vm[i],scale,stateUpdated:L.vIndex[i]>=0};break;}if(bad)continue;
    calcPQ(Y,Vm,Va,P,Q);refreshEffectiveQ();let ss2=0,mx2=0;
    for(let k=0;k<L.ang.length;k++){const i=L.ang[k],d=pSpec[i]+alphaMw*(weights?.[i]??0)/base-P[i];ss2+=d*d;mx2=Math.max(mx2,abs(d));}
    for(let k=0;k<L.pq.length;k++){const i=L.pq[k],d=effectiveQ[i]-Q[i];ss2+=d*d;mx2=Math.max(mx2,abs(d));}
    if(explicit)controls.forEach((control,index)=>{const q=(control.measurementQmvar??0)+(control.measurementParticipation??1)*controlDq[index]*base,d=control.targetVmPu+(control.droopQmvar?q/control.droopQmvar:0)-Vm[control.remoteBus];ss2+=d*d;mx2=Math.max(mx2,abs(d));});
    if(activeBalance){const d=pSpec[slack]+alphaMw*(weights?.[slack]??0)/base-P[slack];ss2+=d*d;mx2=Math.max(mx2,abs(d));}
     const nextNorm=Math.sqrt(ss2);bestNorm=Math.min(bestNorm,nextNorm);
     if(acceptsNewtonStep(baseNorm,nextNorm,stepCap*scale,mx2,tolerancePu)){accepted=true;acceptedScale=scale;break;}
    }
   if(!accepted){Vm.set(oldVm);Va.set(oldVa);controlDq.set(oldDq);alphaMw=oldAlpha;nrReason='NR_LINE_SEARCH_FAILED';
    let maxDxVm=0,maxDxVmBus=-1,maxDxTheta=0,maxDxThetaBus=-1,maxDxControlDq=0,maxDxControlIndex=-1;
    for(const bus of L.vm){const value=Math.abs(dx[L.vIndex[bus]]);if(value>maxDxVm){maxDxVm=value;maxDxVmBus=bus;}}
    for(const bus of L.ang){const value=Math.abs(dx[L.angIndex[bus]]);if(value>maxDxTheta){maxDxTheta=value;maxDxThetaBus=bus;}}
    for(let k=0;k<controls.length;k++){const value=Math.abs(dx[L.controlIndex[k]]);if(value>maxDxControlDq){maxDxControlDq=value;maxDxControlIndex=k;}}
    nrFailure=failure('LINE_SEARCH',firstInvalidCandidate&&bestNorm===Infinity?'All line-search candidates violated voltage bounds.':'Newton adımının hiçbir azaltılmış ölçeği mismatch değerini düşürmedi.',it+1,round+1,mx*base,{minPivot:linearDiagnostics.minPivot,linearStage:lin.method||linearDiagnostics.stage,pivotSource:linearDiagnostics.pivotSource,lineSearchAccepted:false,lineSearchStepCap:stepCap,lineSearchBestNormRatio:bestNorm/baseNorm,maxDxVm,maxDxVmBus,maxDxVmBusId:options.busIds?.[maxDxVmBus]??null,maxDxTheta,maxDxThetaBus,maxDxThetaBusId:options.busIds?.[maxDxThetaBus]??null,maxDxControlDq,maxDxControlIndex,maxDxControlId:options.controlIds?.[maxDxControlIndex]??null,oldMinVm:loopMin(oldVm),oldMaxVm:loopMax(oldVm),voltageDomainPu:voltageDomain,firstInvalidCandidate});break;}totalIter++;if(options.workCounters)options.workCounters.totalNewtonIterations=(options.workCounters.totalNewtonIterations??0)+1;
   if(boundIndex>=0&&acceptedScale===1&&Math.abs(controlDq[boundIndex]-(dx[L.controlIndex[boundIndex]]>0?controls[boundIndex].maxDqPu!:controls[boundIndex].minDqPu!))<1e-7)return boundaryResult(boundIndex);
  }
  if(!converged){nrFailure??=failure('NEWTON_ITERATION',nrReason||'Newton iteration limit reached.',settings.maxInnerIterations,round+1,maxMismatch*base,{minPivot:lastMinPivot,linearStage:lastLinear?.method||lastLinearStage});return {status:nrReason||'NR_MAX_ITERATION',converged:false,iterations:totalIter,rounds:round+1,maxMismatchMW:maxMismatch*base,linear:lastLinear,failure:nrFailure,elapsedMs:elapsed(),Vm:Array.from(Vm),Va:Array.from(Va),controlDqPu:Array.from(controlDq),alphaMw};}
  calcPQ(Y,Vm,Va,P,Q);let changed=false,limitedThisRound=0,limitedBuses:number[]=[];
  const qTolerance=settings.qLimitToleranceMvar??.02;
  if(settings.reactiveLimitsEnabled){
   for(let i=0;i<n;i++)if(busType[i]===1||(i===slack&&busType[i]===2)){const lo=i===slack?refQMin[i]:qMin[i],hi=i===slack?refQMax[i]:qMax[i];if(lo==null||hi==null||!finite(lo)||!finite(hi))continue;const q=Q[i]*base;let lim:number|null=null,state:'QMIN_LIMITED'|'QMAX_LIMITED'|undefined;if(q<lo-qTolerance){lim=lo;state='QMIN_LIMITED';}else if(q>hi+qTolerance){lim=hi;state='QMAX_LIMITED';}if(lim!==null){const qSpecBeforePu=genericSeeded.has(i)?pvQSpecBefore[i]:qSpec[i],entry={bus:i,qRequired:q,qLimit:lim,state},existing=pvToPq.findIndex(row=>row.bus===i);if(existing>=0)pvToPq[existing]=entry;else pvToPq.push(entry);qSpec[i]=lim/base;busType[i]=0;if(!genericSeeded.has(i))genericLimited.push({bus:i,qLimit:lim,qRequired:q,state:state!,qMin:lo,qMax:hi,qSpecBeforePu});changed=true;limitedThisRound++;limitedBuses.push(i);progress?.('Q_LIMIT_UPDATE',{bus:i,qRequired:q,qLimit:lim,referenceBus:i===slack?1:0});}}
  }
  // Resolve the pending generic release trial on its own converged operating point.
  // A release is accepted only when the unconstrained PV solution settles strictly
  // inside the limits: that is the complementarity condition for an inactive Q limit.
  if(releaseTrialBus>=0){
   const unit=genericLimited.find(row=>row.bus===releaseTrialBus);
   if(unit&&!limitedBuses.includes(releaseTrialBus)&&genericQLimitReleaseAccepts(unit,Q[releaseTrialBus]*base,qTolerance)){
    const index=pvToPq.findIndex(row=>row.bus===releaseTrialBus);
    if(index>=0)pvToPq.splice(index,1);
    genericLimited.splice(genericLimited.indexOf(unit),1);
    releasedUnitsTotal++;releaseAccepted++;
    warnings.push(`GENERIC_Q_LIMIT_RELEASE_ACCEPTED bus=${options.busIds?.[releaseTrialBus]??releaseTrialBus} qMvar=${(Q[releaseTrialBus]*base).toFixed(6)}`);
   }else{releaseRejected++;releaseRetired.add(releaseTrialBus);}
   releaseTrialBus=-1;releaseSnapshot=null;
  }
  if(!changed&&settings.reactiveLimitsEnabled&&round<qLimitRoundLimit-1){
   const candidate=genericLimited.find(unit=>!releaseRetired.has(unit.bus));
   if(candidate){
    // Return the bus to its PV specification and re-solve. The next round decides from
    // the solved operating point whether the limit is still binding; it never uses the
    // sign of the previous Q dispatch.
    releaseSnapshot=captureState();
    busType[candidate.bus]=candidate.bus===slack?2:1;
    qSpec[candidate.bus]=candidate.qSpecBeforePu;
    releaseTrialBus=candidate.bus;
    changed=true;
    warnings.push(`GENERIC_Q_LIMIT_RELEASE_TRIAL bus=${options.busIds?.[candidate.bus]??candidate.bus} limitMvar=${candidate.qLimit}`);
   }
  }
  const modelErrorPercent=controls.length?Math.max(...controls.map(control=>Math.abs(Vm[control.remoteBus]-control.targetVmPu)/Math.max(1e-9,Math.abs(control.targetVmPu))*100)):null;
  qLimitRounds.push({round:round+1,changedUnits:limitedThisRound,limitedUnits:pvToPq.length,releasedUnits:releasedUnitsTotal,maxBusMismatchKva:Number.isFinite(maxMismatch)?maxMismatch*base*1000:null,maxModelEquationErrorPercent:modelErrorPercent});
  if(!changed)break;
  if(round===qLimitRoundLimit-1){const diagnostic=failure('Q_LIMIT','Reactive power limits continued to change at the control-round limit.',null,qLimitRoundLimit,maxMismatch*base);return {status:'Q_LIMIT_MAX_ROUNDS',converged:false,iterations:totalIter,rounds:qLimitRoundLimit,maxMismatchMW:maxMismatch*base,linear:lastLinear,failure:diagnostic,elapsedMs:elapsed(),warnings};}
 }
 calcPQ(Y,Vm,Va,P,Q);
 const branchResults=model.branches.map((e,idx)=>{
  const i=e.i,j=e.j,r=+e.r,x=+e.x,bch=+e.bch||0,tap=+e.tap||1,ph=+e.phase||0,den=r*r+x*x,g=r/den,b=-x/den,c=Math.cos(Va[i]-Va[j]-ph),s=Math.sin(Va[i]-Va[j]-ph),vi=Vm[i],vj=Vm[j];
  // Equivalent branch powers using same off-nominal tap convention, phase included in angle difference.
  // Transformer magnetizing admittance is placed at the from/HV bus in Ybus.
  // Include that same shunt in the reported from-terminal power so branch flows
  // reconcile with the solved bus injection and transformer losses.
  const pf=(vi*vi*g/(tap*tap)-vi*vj/tap*(g*c+b*s)+vi*vi*(e.gMagPu||0))*base;
  const qf=(-vi*vi*(b+bch/2)/(tap*tap)-vi*vj/tap*(g*s-b*c)-vi*vi*(e.bMagPu||0))*base;
  const pt=(vj*vj*g-vi*vj/tap*(g*c-b*s))*base;
  const qt=(-vj*vj*(b+bch/2)+vi*vj/tap*(g*s+b*c))*base;
  return {index:idx,pf,qf,pt,qt};
 });
 const minV=loopMin(Vm),maxV=loopMax(Vm);
 return {status:'CONVERGED_FULL_NR',converged:true,iterations:totalIter,rounds:round+1,maxMismatchMW:maxMismatch*base,linear:lastLinear,pvToPq,qLimitRounds,genericQLimitActiveSet:{stateModel:'GENERIC_PV_BIDIRECTIONAL',releaseSupport:'GENERIC_PV_AND_STATION_MEMBER',releaseTrialsAccepted:releaseAccepted,releaseTrialsRejected:releaseRejected,releasedUnits:releasedUnitsTotal,retiredAfterReappliedLimit:[...releaseRetired].map(bus=>options.busIds?.[bus]??String(bus)),alphaBoundPu:Number.isFinite(alphaBoundPu)?alphaBoundPu:null,alphaBoundApplied:alphaBoundApplied},Vm:Array.from(Vm),Va:Array.from(Va),P:Array.from(P,v=>v*base),Q:Array.from(Q,v=>v*base),controlDqPu:Array.from(controlDq),alphaMw,activeBalanceIterations:activeBalance?1:undefined,activeBalanceMismatchMw:activeBalance?(P[slack]-pSpec[slack]-alphaMw*(weights?.[slack]??0)/base)*base:undefined,activeBalanceLoadAdjustmentsMw:activeBalance?Array.from({length:n},(_,i)=>-alphaMw*(weights?.[i]??0)):undefined,branches:branchResults,minV,maxV,elapsedMs:elapsed(),warnings};
}
