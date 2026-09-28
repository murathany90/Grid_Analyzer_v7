import type {CanonicalNetwork,StationController} from '../../domain/model/network';
import type {PreparedModel,NumericModel} from './preparation';
import type {PowerFlowResult} from './js/types';
import {solveNR} from './js/newton';
import {remoteVoltageSensitivities} from './js/sensitivity';

export type StationStatus='SATISFIED'|'SATURATED_QMIN'|'SATURATED_QMAX'|'NO_REACTIVE_HEADROOM'|'SENSITIVITY_UNAVAILABLE'|'UNSUPPORTED_DROOP'|'UNSUPPORTED_DISTRIBUTION'|'REMOTE_BUS_UNRESOLVED'|'NO_REFERENCE_ISLAND'|'Q_LIMITS_UNAVAILABLE'|'LOCAL_PV_CONFLICT'|'REMOTE_VOLTAGE_FIXED'|'CONTROL_SOLVE_FAILED'|'OSCILLATION_STOPPED'|'MAX_OUTER_ROUNDS'|'PENDING';
export interface StationControlDiagnostic {
  id:string;remoteBus:string;islandId:string|null;targetVpu:number;initialVpu:number|null;finalVpu:number|null;voltageResidualPu:number|null;
  initialQ:number|null;finalQ:number|null;qMin:number|null;qMax:number|null;outerRounds:number;status:StationStatus;supported:boolean;unitIds:string[];actuatorBus:number|null;remoteBusIndex:number|null;
}
interface ControlState {source:StationController;row:StationControlDiagnostic;actuatorBus:number;remoteBus:number;q:number;qMin:number;qMax:number}
interface UnitOverride {qMvar:number|null;qState:string}
export interface ControlledIslandRun {prepared:PreparedModel;result:PowerFlowResult;controllers:StationControlDiagnostic[];outerRounds:number;unitOverrides:Map<string,UnitOverride>}
const TOLERANCE_PU=1e-4;
const finite=(x:unknown):x is number=>typeof x==='number'&&Number.isFinite(x);
const clamp=(x:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,x));

export function runStationControlledIsland(network:CanonicalNetwork,part:PreparedModel,mappings:readonly {id:string;islandId:string|null;solverBusIndex:number|null}[],progress?:(stage:string,detail?:Record<string,number>)=>void):ControlledIslandRun{
  const byId=new Map(mappings.map(m=>[m.id,m])),units=new Map(part.generators.map(g=>[g.id,g])),owners=new Map<string,number>();
  for(const c of network.stationControllers.filter(c=>c.inService))for(const id of c.unitIds)owners.set(id,(owners.get(id)||0)+1);
  const controllers=network.stationControllers.filter(c=>c.inService&&byId.get(c.id)?.islandId===part.islandId),rows:StationControlDiagnostic[]=[],candidates:ControlState[]=[];
  for(const c of controllers){
    const mapping=byId.get(c.id),remote=mapping?.solverBusIndex??null,gs=c.unitIds.map(id=>units.get(id)).filter((g):g is NonNullable<typeof g>=>!!g),active=gs.filter(g=>g.inService),activeOutsideIsland=network.generators.some(g=>g.inService&&c.unitIds.includes(g.id)&&!units.has(g.id));
    const buses=[...new Set(active.map(g=>g.index))],actuator=buses.length===1?buses[0]:null,qMin=active.length&&active.every(g=>finite(g.qMin))?active.reduce((sum,g)=>sum+g.qMin!,0):null,qMax=active.length&&active.every(g=>finite(g.qMax))?active.reduce((sum,g)=>sum+g.qMax!,0):null;
    let status:StationStatus='PENDING';
    if(remote==null)status='REMOTE_BUS_UNRESOLVED';
    else if(c.droopModeRaw!==0)status='UNSUPPORTED_DROOP';
    else if(!active.length)status='NO_REACTIVE_HEADROOM';
    else if(activeOutsideIsland||new Set(c.unitIds).size!==c.unitIds.length||actuator==null||active.some(g=>(owners.get(g.id)||0)>1))status='UNSUPPORTED_DISTRIBUTION';
    else if(!finite(c.vmSet)||c.vmSet<.5||c.vmSet>1.5)status='REMOTE_VOLTAGE_FIXED';
    else if(qMin==null||qMax==null||qMin>qMax)status='Q_LIMITS_UNAVAILABLE';
    else if(qMax-qMin<1e-8)status='NO_REACTIVE_HEADROOM';
    else if(actuator===part.model.slack||part.generators.some(g=>g.index===actuator&&g.voltageControl&&!active.some(unit=>unit.id===g.id)))status='LOCAL_PV_CONFLICT';
    else if(remote!==actuator&&part.model.busType[remote]!==0)status='REMOTE_VOLTAGE_FIXED';
    const initialQ=active.length?active.reduce((sum,g)=>sum+g.qMvar,0):null;
    const row:StationControlDiagnostic={id:c.id,remoteBus:c.remoteBus,islandId:part.islandId??null,targetVpu:c.vmSet,initialVpu:null,finalVpu:null,voltageResidualPu:null,initialQ,finalQ:initialQ,qMin,qMax,outerRounds:0,status,supported:false,unitIds:active.map(g=>g.id),actuatorBus:actuator,remoteBusIndex:remote};rows.push(row);
    if(status==='PENDING'&&actuator!=null&&remote!=null&&qMin!=null&&qMax!=null&&initialQ!=null)candidates.push({source:c,row,actuatorBus:actuator,remoteBus:remote,q:clamp(initialQ,qMin,qMax),qMin,qMax});
  }
  const repeated=new Set<number>(),seen=new Set<number>();for(const control of candidates){if(seen.has(control.actuatorBus))repeated.add(control.actuatorBus);seen.add(control.actuatorBus);}
  const supported=candidates.filter(c=>{if(!repeated.has(c.actuatorBus))return true;c.row.status='UNSUPPORTED_DISTRIBUTION';return false;});
  for(const c of supported)c.row.supported=true;
  if(!supported.length)return{prepared:part,result:solveNR(part.model,progress),controllers:rows,outerRounds:0,unitOverrides:new Map()};
  const base=part.model,model:NumericModel={...base,pSpec:Float64Array.from(base.pSpec),qSpec:Float64Array.from(base.qSpec),busType:Int8Array.from(base.busType),vmSet:Float64Array.from(base.vmSet),qMinNet:[...base.qMinNet],qMaxNet:[...base.qMaxNet]};
  for(const c of supported){model.busType[c.actuatorBus]=0;model.qMinNet[c.actuatorBus]=null;model.qMaxNet[c.actuatorBus]=null;model.qSpec[c.actuatorBus]+=c.q-c.row.initialQ!;}
  const fallback=()=>{for(const c of supported)c.row.status='CONTROL_SOLVE_FAILED';return{prepared:part,result:solveNR(base,progress),controllers:rows,outerRounds:0,unitOverrides:new Map<string,UnitOverride>()};};
  let solved=solveNR(model,progress);if(!solved.converged||!solved.Vm)return fallback();
  for(const c of supported)c.row.initialVpu=solved.Vm[c.remoteBus];
  const residual=(r:PowerFlowResult,c:ControlState)=>c.source.vmSet-r.Vm![c.remoteBus];
  const norm=(r:PowerFlowResult)=>Math.sqrt(supported.reduce((sum,c)=>sum+residual(r,c)**2,0)/supported.length);
  const advisory=network.loadFlowOptionsRaw?.ictrlx,maxRounds=Math.min(16,finite(advisory)&&advisory>0?Math.floor(advisory):12);let rounds=0;
  for(let round=0;round<maxRounds;round++){
    const active=supported.filter(c=>Math.abs(residual(solved,c))>TOLERANCE_PU&&c.row.status==='PENDING');if(!active.length)break;
    const sensitivities=remoteVoltageSensitivities(model,solved,active),steps=new Map<ControlState,number>();
    active.forEach((c,i)=>{const slope=sensitivities[i],difference=residual(solved,c);
      if(slope==null||Math.abs(slope)<1e-9){c.row.status='SENSITIVITY_UNAVAILABLE';return;}
      const needed=difference/slope;if(needed>0&&c.q>=c.qMax-1e-7){c.row.status='SATURATED_QMAX';return;}
      if(needed<0&&c.q<=c.qMin+1e-7){c.row.status='SATURATED_QMIN';return;}
      steps.set(c,clamp(needed,-.25*(c.qMax-c.qMin),.25*(c.qMax-c.qMin)));
    });
    if(!steps.size)break;
    const oldNorm=norm(solved);let accepted=false;
    for(let damping=.5;damping>=1/64;damping/=2){const trial:NumericModel={...model,qSpec:Float64Array.from(model.qSpec)};const qTrial=new Map<ControlState,number>();
      for(const[c,step]of steps){const next=clamp(c.q+step*damping,c.qMin,c.qMax);trial.qSpec[c.actuatorBus]+=next-c.q;qTrial.set(c,next);}
      const output=solveNR(trial,progress,{initialVm:solved.Vm,initialVa:solved.Va});
      if(!output.converged||!output.Vm||!(norm(output)<oldNorm-1e-8))continue;
      model.qSpec=trial.qSpec;solved=output;for(const[c,next]of qTrial){if(Math.abs(next-c.q)>1e-10)c.row.outerRounds++;c.q=next;}rounds++;accepted=true;progress?.('STATION_CONTROL',{round:rounds,maxResidualPu:Math.max(...supported.map(c=>Math.abs(residual(solved,c))))});break;
    }
    if(!accepted){for(const c of active)if(c.row.status==='PENDING')c.row.status='OSCILLATION_STOPPED';break;}
  }
  const overrides=new Map<string,UnitOverride>();for(const c of supported){const error=residual(solved,c),slopeSign=error;let status=c.row.status;
    if(status==='PENDING')status=Math.abs(error)<=TOLERANCE_PU?'SATISFIED':c.q>=c.qMax-1e-7&&slopeSign>0?'SATURATED_QMAX':c.q<=c.qMin+1e-7&&slopeSign<0?'SATURATED_QMIN':'MAX_OUTER_ROUNDS';
    Object.assign(c.row,{status,finalVpu:solved.Vm![c.remoteBus],voltageResidualPu:error,finalQ:c.q});
    for(const id of c.row.unitIds)overrides.set(id,{qMvar:c.row.unitIds.length===1?c.q:null,qState:c.row.unitIds.length===1?status:'GROUP_Q_UNALLOCATED'});
  }
  return{prepared:{...part,model,stationControlUnitResults:overrides},result:solved,controllers:rows,outerRounds:rounds,unitOverrides:overrides};
}
