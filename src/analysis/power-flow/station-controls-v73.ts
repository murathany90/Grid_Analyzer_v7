import type {CanonicalNetwork,StationController} from '../../domain/model/network';
import type {StationControlMode} from '../api/engine';
import type {PreparedModel,NumericModel} from './preparation';
import type {PowerFlowResult,AdmittanceMatrix,JacobianLayout} from './js/types';
import {buildY} from './js/ybus';
import {solveNR} from './js/newton';
import {type SensitivityFailure,type SensitivityProbe} from './js/sensitivity';
import {probeAdjointSensitivities} from './js/sensitivity-interleaved';
import {allocateReactiveDelta,activeParticipation,dispatchedPWeights,type ReactiveUnitState} from './station-participation';

type Mapping={id:string;islandId:string|null;solverBusIndex:number|null};
export type ControlStatus='PENDING'|'SATISFIED'|'SATURATED_QMIN'|'SATURATED_QMAX'|'NO_REACTIVE_HEADROOM'|'ROLLED_BACK_TO_LOCAL_PV'|'REMOTE_CONTROL_CONFLICT'|'Q_LIMITS_UNAVAILABLE'|'UNSUPPORTED_PROFILE'|'UNSUPPORTED_DISTRIBUTION'|'UNSUPPORTED_DROOP'|'REMOTE_BUS_UNRESOLVED'|'NO_REFERENCE_ISLAND'|'LOCAL_PV_CONFLICT'|'CONTROL_SOLVE_FAILED'|'MAX_OUTER_ROUNDS'|'BASELINE_LOCAL_PV'|'OWNERSHIP_ONLY';
export interface ControlDiagnostic {
  id:string;controllerId:string;remoteBus:string;islandId:string|null;targetVpu:number;initialVpu:number|null;finalVpu:number|null;voltageResidualPu:number|null;
  initialQ:number|null;finalQ:number|null;qMin:number|null;qMax:number|null;outerRounds:number;status:ControlStatus;supported:boolean;unitIds:string[];actuatorBus:number|null;actuatorBuses:number[];remoteBusIndex:number|null;
  participationKi:Record<string,number>;jacobianDimension:number|null;linearMethod:string|null;linearIterations:number|null;linearResidual:number|null;iluMinimumPivot:number|null;effectiveSlope:number|null;individualDvDqi:Record<string,number|null>;elapsedSensitivityMs:number|null;failureReason:SensitivityFailure|null;controlSolveFailure?:string|null;ownershipUnallocatedMvar?:number;
}
export interface ControlTimings {baseNrMs:number;controllerClassificationMs:number;jacobianBuildMs:number;iluFactorMs:number;sensitivitySolveMs:number;outerTrialNrMs:number;finalNrMs:number}
interface Control {source:StationController;row:ControlDiagnostic;units:ReactiveUnitState[];remote:number;droopQ:number|null}
export interface ControlledIslandV73 {prepared:PreparedModel;result:PowerFlowResult;controllers:ControlDiagnostic[];outerRounds:number;unitOverrides:Map<string,{qMvar:number|null;qState:string}>;timings:ControlTimings;trialAttempts?:{damping:number;status:string;normRatio:number|null;failureIteration:number|null;failureMismatchMw:number|null;linearResidual:number|null}[]}
const now=()=>performance.now(),finite=(x:unknown):x is number=>typeof x==='number'&&Number.isFinite(x),EPS=1e-8,TOL=1e-4;
export function droopTarget(usetp:number,qMeas:number,srated:number,ddroop:number):number {return usetp+qMeas/(srated*100/ddroop);}
export function activeControlRms(rows:readonly {status:ControlStatus;residual:number}[]):number|null {const active=rows.filter(row=>row.status==='PENDING'&&Number.isFinite(row.residual));return active.length?Math.sqrt(active.reduce((sum,row)=>sum+row.residual*row.residual,0)/active.length):null;}
const cloneModel=(base:NumericModel):NumericModel=>({...base,pSpec:Float64Array.from(base.pSpec),qSpec:Float64Array.from(base.qSpec),busType:Int8Array.from(base.busType),vmSet:Float64Array.from(base.vmSet),qMinNet:[...base.qMinNet],qMaxNet:[...base.qMaxNet]});

export function runStationControlledIslandV73(network:CanonicalNetwork,part:PreparedModel,mappings:readonly Mapping[],mode:StationControlMode='zeroDroop',progress?:(stage:string,detail?:Record<string,number>)=>void):ControlledIslandV73 {
  const times:ControlTimings={baseNrMs:0,controllerClassificationMs:0,jacobianBuildMs:0,iluFactorMs:0,sensitivitySolveMs:0,outerTrialNrMs:0,finalNrMs:0};
  const started=now(),byId=new Map(mappings.map(row=>[row.id,row])),generators=new Map(part.generators.map(g=>[g.id,g]));
  const all=network.stationControllers.filter(c=>c.inService),island=all.filter(c=>byId.get(c.id)?.islandId===part.islandId),zeroUnitOwners=new Map<string,number>(),allUnitOwners=new Map<string,number>(),zeroBusOwners=new Map<number,number>(),allBusOwners=new Map<number,number>();
  for(const c of all)for(const id of c.unitIds){allUnitOwners.set(id,(allUnitOwners.get(id)||0)+1);if(c.droopModeRaw===0)zeroUnitOwners.set(id,(zeroUnitOwners.get(id)||0)+1);}
  for(const c of island){const buses=new Set(c.unitIds.map(id=>generators.get(id)?.index).filter((i):i is number=>i!=null));for(const bus of buses){allBusOwners.set(bus,(allBusOwners.get(bus)||0)+1);if(c.droopModeRaw===0)zeroBusOwners.set(bus,(zeroBusOwners.get(bus)||0)+1);}}
  const remoteOwners=new Map<number,number>();for(const c of all.filter(c=>c.droopModeRaw===1)){const idx=byId.get(c.id)?.solverBusIndex;if(idx!=null)remoteOwners.set(idx,(remoteOwners.get(idx)||0)+1);}
  const rows:ControlDiagnostic[]=[],controls:Control[]=[];
  for(const c of island){const remote=byId.get(c.id)?.solverBusIndex??null,active=c.unitIds.map(id=>generators.get(id)).filter((g):g is NonNullable<typeof g>=>!!g&&g.inService),buses=[...new Set(active.map(g=>g.index))],units=active.map(g=>({id:g.id,bus:g.index,pMw:g.pMw,qMvar:g.qMvar,qMin:g.qMin!,qMax:g.qMax!})),weights=dispatchedPWeights(units),droop=c.droopModeRaw===1;
    const qMin=active.length&&active.every(g=>finite(g.qMin))?active.reduce((s,g)=>s+g.qMin!,0):null,qMax=active.length&&active.every(g=>finite(g.qMax))?active.reduce((s,g)=>s+g.qMax!,0):null,qInitial=active.length?active.reduce((s,g)=>s+g.qMvar,0):null;
    let status:ControlStatus='PENDING';
    if(mode==='off')status='BASELINE_LOCAL_PV';
    else if(remote==null)status='REMOTE_BUS_UNRESOLVED';
    else if(c.modeSemantics==='UNSUPPORTED'||(c.controlModeRaw!=null&&c.controlModeRaw!==0)||(c.selectedBusModeRaw!=null&&c.selectedBusModeRaw!==0)||(c.distributionModeRaw!=null&&c.distributionModeRaw!==0)||(c.qOrientationRaw!=null&&c.qOrientationRaw!==0)||(c.qSetpointRaw!=null&&c.qSetpointRaw!==0))status='UNSUPPORTED_PROFILE';
    else if(c.droopModeRaw!==0&&c.droopModeRaw!==1)status='UNSUPPORTED_PROFILE';
    else if(droop&&mode!=='droop')status='UNSUPPORTED_DROOP';
    else if(!active.length)status='NO_REACTIVE_HEADROOM';
    else if(droop&&(remoteOwners.get(remote)||0)>1)status='REMOTE_CONTROL_CONFLICT';
    else if(new Set(c.unitIds).size!==c.unitIds.length||active.some(g=>((droop?allUnitOwners:zeroUnitOwners).get(g.id)||0)>1||((droop?allBusOwners:zeroBusOwners).get(g.index)||0)>1))status='UNSUPPORTED_DISTRIBUTION';
    else if(!finite(c.vmSet)||c.vmSet<.5||c.vmSet>1.5)status='UNSUPPORTED_PROFILE';
    else if(qMin==null||qMax==null||qMin>qMax)status='Q_LIMITS_UNAVAILABLE';
    else if(droop&&(!c.measurementSelfCubicle||active.length!==1||active[0].sourceClass!=='ElmGenStat'||!finite(c.ratedPowerRaw)||c.ratedPowerRaw<=0||!finite(c.droopValueRaw)||Math.abs(c.droopValueRaw)<EPS))status='UNSUPPORTED_DROOP';
    else if(!weights)status='UNSUPPORTED_DISTRIBUTION';
    else if(buses.some(bus=>bus===part.model.slack||part.generators.some(g=>g.index===bus&&g.voltageControl&&!c.unitIds.includes(g.id))))status='LOCAL_PV_CONFLICT';
    else if(qMax-qMin<EPS)status='NO_REACTIVE_HEADROOM';
    const row:ControlDiagnostic={id:c.id,controllerId:c.id,remoteBus:c.remoteBus,islandId:part.islandId??null,targetVpu:c.vmSet,initialVpu:null,finalVpu:null,voltageResidualPu:null,initialQ:qInitial,finalQ:qInitial,qMin,qMax,outerRounds:0,status,supported:status==='PENDING',unitIds:active.map(g=>g.id),actuatorBus:buses.length===1?buses[0]:null,actuatorBuses:buses,remoteBusIndex:remote,participationKi:Object.fromEntries(weights||[]),jacobianDimension:null,linearMethod:null,linearIterations:null,linearResidual:null,iluMinimumPivot:null,effectiveSlope:null,individualDvDqi:{},elapsedSensitivityMs:null,failureReason:null};rows.push(row);
    if(status==='PENDING'&&remote!=null)controls.push({source:c,row,units,remote,droopQ:droop?c.ratedPowerRaw!*100/c.droopValueRaw!:null});
  }
  times.controllerClassificationMs=now()-started;
  const solve=(model:NumericModel,warm?:PowerFlowResult,Y?:AdmittanceMatrix,layouts?:Map<string,JacobianLayout>)=>solveNR(model,progress,{initialVm:warm?.Vm,initialVa:warm?.Va,admittance:Y,layoutCache:layouts,linearFill:model===part.model?0:1});
  if(mode==='off'||!controls.length){const t=now(),result=solve(part.model);times.baseNrMs=now()-t;return{prepared:part,result,controllers:rows,outerRounds:0,unitOverrides:new Map(),timings:times};}
  const model=cloneModel(part.model),Y=buildY(model),layouts=new Map<string,JacobianLayout>();
  const applyOwnership=(c:Control)=>{for(const bus of c.row.actuatorBuses){model.busType[bus]=0;model.qMinNet[bus]=null;model.qMaxNet[bus]=null;}};
  const restoreOwnership=(c:Control)=>{for(const bus of c.row.actuatorBuses){model.busType[bus]=part.model.busType[bus];model.qMinNet[bus]=part.model.qMinNet[bus];model.qMaxNet[bus]=part.model.qMaxNet[bus];}for(const unit of c.units){model.qSpec[unit.bus]+=part.generators.find(g=>g.id===unit.id)!.qMvar-unit.qMvar;unit.qMvar=part.generators.find(g=>g.id===unit.id)!.qMvar;}};
  for(const c of controls)applyOwnership(c);
  const baseStart=now(),baseline=solve(part.model,undefined,Y,layouts);times.baseNrMs=now()-baseStart;
  if(baseline.converged)for(const limited of baseline.pvToPq||[])if(model.busType[limited.bus]===1){model.busType[limited.bus]=0;model.qSpec[limited.bus]=limited.qLimit;model.qMinNet[limited.bus]=null;model.qMaxNet[limited.bus]=null;}
  // Transfer ownership at the solved local-PV operating point. This leaves the first
  // PQ solve at the same physical Q state instead of resetting 158 buses to raw Q.
  if(mode!=='ownership'&&baseline.converged&&baseline.Q)for(const c of controls){let unmet=0;for(const bus of c.row.actuatorBuses){const local=c.units.filter(u=>u.bus===bus),delta=baseline.Q[bus]-model.qSpec[bus],allocation=allocateReactiveDelta(local,delta);for(const unit of local)unit.qMvar=allocation.qByUnit.get(unit.id)!;unmet+=Math.abs(allocation.remainingDelta);model.qSpec[bus]=baseline.Q[bus];}c.row.initialQ=c.units.reduce((sum,u)=>sum+u.qMvar,0);c.row.ownershipUnallocatedMvar=unmet;}
  const firstStart=now();let solved=solve(model,baseline.converged?baseline:undefined,Y,layouts);times.finalNrMs=now()-firstStart;
  if(!solved.converged){for(const c of controls){c.row.status='CONTROL_SOLVE_FAILED';c.row.controlSolveFailure=`${solved.status}: ${solved.failure?.message||''}`;}const result=baseline.converged?baseline:solve(part.model);return{prepared:part,result,controllers:rows,outerRounds:0,unitOverrides:new Map(),timings:times};}
  for(const c of controls)c.row.initialVpu=solved.Vm![c.remote];
  if(mode==='ownership'){for(const c of controls)c.row.status='OWNERSHIP_ONLY';return{prepared:{...part,model},result:solved,controllers:rows,outerRounds:0,unitOverrides:new Map(),timings:times};}
  const target=(c:Control)=>c.droopQ==null?c.source.vmSet:droopTarget(c.source.vmSet,c.units[0].qMvar,c.source.ratedPowerRaw!,c.source.droopValueRaw!);
  const residual=(c:Control,r:PowerFlowResult)=>target(c)-r.Vm![c.remote];
  const pending=()=>controls.filter(c=>c.row.status==='PENDING');
  const probe=(active:Control[])=>{const batch=probeAdjointSensitivities(model,solved,active.map(c=>({remoteBus:c.remote,actuators:c.units.map(u=>({bus:u.bus,weight:c.row.participationKi[u.id]||0}))})),Y);times.jacobianBuildMs+=batch.jacobianBuildMs;times.iluFactorMs+=batch.iluFactorMs;times.sensitivitySolveMs+=batch.sensitivitySolveMs;
    active.forEach((c,i)=>{const p:SensitivityProbe=batch.probes[i];Object.assign(c.row,{jacobianDimension:p.jacobianDimension,linearMethod:p.linearMethod,linearIterations:p.linearIterations,linearResidual:p.linearResidual,iluMinimumPivot:p.iluMinPivot,effectiveSlope:p.slope,individualDvDqi:Object.fromEntries(c.units.map((u,j)=>[u.id,p.individualSlopes[j]])),elapsedSensitivityMs:p.elapsedMs,failureReason:p.reason});});return batch.probes;};
  // Reclassify once after restoring failed provisional owners; never loop indefinitely.
  for(let pass=0;pass<2;pass++){const active=pending();if(!active.length)break;let probes:SensitivityProbe[];
    try{probes=probe(active);}catch{probes=active.map(()=>({reason:'SENSITIVITY_LINEAR_SOLVE_FAILED' as const,slope:null,individualSlopes:[],jacobianDimension:0,linearMethod:null,linearIterations:null,linearResidual:null,iluMinPivot:null,elapsedMs:0}));}
    let failed=false;active.forEach((c,i)=>{if(!probes[i].reason)return;c.row.failureReason=probes[i].reason;c.row.status='ROLLED_BACK_TO_LOCAL_PV';restoreOwnership(c);failed=true;});
    if(!failed)break;const t=now();solved=solve(model,solved,Y,layouts);times.finalNrMs+=now()-t;if(!solved.converged)break;
    if(pass===1){for(const c of pending()){c.row.failureReason='SENSITIVITY_LINEAR_SOLVE_FAILED';c.row.status='ROLLED_BACK_TO_LOCAL_PV';restoreOwnership(c);}const t2=now();solved=solve(model,solved,Y,layouts);times.finalNrMs+=now()-t2;}
  }
  if(!solved.converged){const t=now(),result=solve(part.model);times.finalNrMs+=now()-t;for(const c of pending()){c.row.status='ROLLED_BACK_TO_LOCAL_PV';c.row.failureReason='SENSITIVITY_LINEAR_SOLVE_FAILED';}return{prepared:part,result,controllers:rows,outerRounds:0,unitOverrides:new Map(),timings:times};}
  let rounds=0;const trialAttempts:{damping:number;status:string;normRatio:number|null;failureIteration:number|null;failureMismatchMw:number|null;linearResidual:number|null}[]=[];
  for(let round=0;round<4;round++){
    const active=pending();if(!active.some(c=>Math.abs(residual(c,solved))>TOL))break;
    const trialMoves=new Map<Control,ReturnType<typeof allocateReactiveDelta>>();
    for(const c of active){const slope=c.row.effectiveSlope;if(slope==null||Math.abs(slope)<1e-9)continue;const derivative=slope-(c.droopQ==null?0:1/c.droopQ),needed=residual(c,solved)/derivative;
      const weights=activeParticipation(c.units,needed>=0?1:-1);if(!weights){c.row.status=needed>=0?'SATURATED_QMAX':'SATURATED_QMIN';continue;}
      const room=c.row.qMax!-c.row.qMin!,step=Math.max(-.25*room,Math.min(.25*room,needed));trialMoves.set(c,allocateReactiveDelta(c.units,step));}
    if(!trialMoves.size)break;
    const acceptance=pending().filter(c=>trialMoves.has(c)),norm=(r:PowerFlowResult)=>Math.sqrt(acceptance.reduce((s,c)=>s+residual(c,r)**2,0)/Math.max(1,acceptance.length)),oldNorm=norm(solved);let accepted=false;
    for(let damping=.5;damping>=1/64;damping/=2){const trial=cloneModel(model),moves=new Map<Control,ReturnType<typeof allocateReactiveDelta>>();
      for(const [c,move] of trialMoves){const allocated=allocateReactiveDelta(c.units,move.appliedDelta*damping);moves.set(c,allocated);for(const u of c.units)trial.qSpec[u.bus]+=allocated.qByUnit.get(u.id)!-u.qMvar;}
      const t=now(),result=solve(trial,solved,Y,layouts);times.outerTrialNrMs+=now()-t;
      const ratio=result.converged&&result.Vm?norm(result)/oldNorm:null;
      trialAttempts.push({damping,status:result.status,normRatio:ratio,failureIteration:result.failure?.iteration??null,failureMismatchMw:result.failure?.maxMismatchMw??null,linearResidual:result.linear?.residual??null});
      if(!result.converged||!result.Vm||!(norm(result)<oldNorm-1e-8))continue;
      model.qSpec=trial.qSpec;solved=result;for(const [c,move]of moves){for(const u of c.units)u.qMvar=move.qByUnit.get(u.id)!;c.row.outerRounds++;}rounds++;accepted=true;progress?.('STATION_CONTROL',{round:rounds,maxResidualPu:Math.max(...pending().map(c=>Math.abs(residual(c,solved))))});break;
    }
    if(!accepted)break;
  }
  const overrides=new Map<string,{qMvar:number|null;qState:string}>();
  for(const c of controls){if(c.row.status==='ROLLED_BACK_TO_LOCAL_PV')continue;const error=residual(c,solved);if(c.row.status==='PENDING')c.row.status=Math.abs(error)<=TOL?'SATISFIED':c.units.every(u=>u.qMvar>=u.qMax-EPS)?'SATURATED_QMAX':c.units.every(u=>u.qMvar<=u.qMin+EPS)?'SATURATED_QMIN':'MAX_OUTER_ROUNDS';
    c.row.finalVpu=solved.Vm![c.remote];c.row.voltageResidualPu=error;c.row.finalQ=c.units.reduce((s,u)=>s+u.qMvar,0);for(const u of c.units)overrides.set(u.id,{qMvar:u.qMvar,qState:c.row.status});}
  return{prepared:{...part,model,stationControlUnitResults:overrides},result:solved,controllers:rows,outerRounds:rounds,unitOverrides:overrides,timings:times,trialAttempts};
}
