import type { AnalysisEngine, AnalysisRequest, Progress } from './engine';
import type { CanonicalNetwork } from '../../domain/model/network';
import { effectiveNetwork } from '../../domain/scenario/overlay';
import { prepareModel } from '../power-flow/preparation';
import { mapResults } from '../power-flow/results';
import {runStationControlledIslandV73,type ControlDiagnostic,type ControlTimings} from '../power-flow/station-controls-v73';
import { runReduced } from '../fast-ac/reduced-engine';
import {APP_VERSION} from '../../version';
export class BrowserJsPowerFlowEngine implements AnalysisEngine {
  readonly name='BrowserJsEngine';readonly version=APP_VERSION;
  capabilities(network:CanonicalNetwork){return network.capabilities;}
  async runPowerFlow(request:AnalysisRequest,onProgress:Progress=()=>{}){
    onProgress('MODEL');const start=performance.now(),effective=effectiveNetwork(request.network,request.scenario);onProgress('TOPOLOGY');
    const built=prepareModel(effective),preparedMs=performance.now()-start;onProgress('INIT');
    const mappings=built.diagnostics.stationControllerMappings as {id:string;islandId:string|null;solverBusIndex:number|null}[],islandModels=[built,...(built.additionalIslands||[])],outputs=islandModels.map(part=>{
      const controlled=runStationControlledIslandV73(effective,part,mappings,request.stationControlMode??'zeroDroop',(stage,detail)=>onProgress(stage==='YBUS_READY'?'YBUS':stage==='Q_LIMIT_UPDATE'?'Q_LIMIT':stage==='STATION_CONTROL'?'OUTER_CONTROL':'INNER_NR',{...detail,islandId:part.islandId}));
      const numerical=controlled.result,mapStart=performance.now(),mapped=mapResults(controlled.prepared,numerical,request.identity);return{part:controlled.prepared,numerical,mapped,controlled,resultMapMs:performance.now()-mapStart};
    });
    onProgress('RESULT');const first=outputs[0].mapped,allConverged=outputs.every(o=>o.numerical.converged);
    for(const o of outputs.slice(1)){first.buses.push(...o.mapped.buses);first.branches.push(...o.mapped.branches);first.generators.push(...o.mapped.generators);first.warnings.push(...o.mapped.warnings);}
    first.converged=allConverged;first.status=allConverged?'CONVERGED_FULL_NR':outputs.length>1?'PARTIAL_ISLAND_FAILURE':first.status;
    first.iterations=outputs.reduce((sum,o)=>sum+o.numerical.iterations,0);first.rounds=Math.max(...outputs.map(o=>o.numerical.rounds));first.elapsedMs=performance.now()-start;
    first.maxMismatchMw=outputs.reduce<number|null>((max,o)=>o.numerical.maxMismatchMW==null?max:max==null?o.numerical.maxMismatchMW:Math.max(max,o.numerical.maxMismatchMW),null);
    first.quality.numericalStatus=allConverged?'CONVERGED':'NOT_CONVERGED';
    const islandDiagnostics=first.diagnostics.islands;if(Array.isArray(islandDiagnostics))for(const diagnostic of islandDiagnostics){if(!diagnostic||typeof diagnostic!=='object')continue;const row=diagnostic as {islandId:string;status:string;iterations:number|null};const found=outputs.find(o=>o.part.islandId===row.islandId);if(found){row.status=found.numerical.converged?(row.status==='MULTIPLE_REFERENCE_PARTIAL'?row.status:'CONVERGED'):found.numerical.status;row.iterations=found.numerical.iterations;}}
    const handled=new Set(outputs.flatMap(o=>o.controlled.controllers.map(c=>c.id))),controllerRows:ControlDiagnostic[]=outputs.flatMap(o=>o.controlled.controllers);
    for(const c of effective.stationControllers.filter(c=>c.inService&&!handled.has(c.id))){const mapping=mappings.find(m=>m.id===c.id);controllerRows.push({id:c.id,controllerId:c.id,remoteBus:c.remoteBus,islandId:mapping?.islandId??null,targetVpu:c.vmSet,initialVpu:null,finalVpu:null,voltageResidualPu:null,initialQ:null,finalQ:null,qMin:null,qMax:null,outerRounds:0,status:mapping?.islandId?'NO_REFERENCE_ISLAND':'REMOTE_BUS_UNRESOLVED',supported:false,unitIds:[...c.unitIds],actuatorBus:null,actuatorBuses:[],remoteBusIndex:null,participationKi:{},jacobianDimension:null,linearMethod:null,linearIterations:null,linearResidual:null,iluMinimumPivot:null,effectiveSlope:null,individualDvDqi:{},elapsedSensitivityMs:null,failureReason:null});}
    const supported=controllerRows.filter(c=>c.supported),residuals=supported.map(c=>Math.abs(c.voltageResidualPu??NaN)).filter(Number.isFinite),saturated=supported.filter(c=>c.status==='SATURATED_QMIN'||c.status==='SATURATED_QMAX').length,outerRounds=outputs.reduce((sum,o)=>sum+o.controlled.outerRounds,0);
    first.diagnostics.stationControllerResults=controllerRows;
    const statusCounts=Object.fromEntries([...new Set(controllerRows.map(c=>c.status))].sort().map(status=>[status,controllerRows.filter(c=>c.status===status).length]));
    const failureReasonCounts=Object.fromEntries([...new Set(controllerRows.map(c=>c.failureReason).filter(Boolean))].map(reason=>[reason,controllerRows.filter(c=>c.failureReason===reason).length]));
    const sourceById=new Map(effective.stationControllers.map(c=>[c.id,c])),droopRows=controllerRows.filter(c=>sourceById.get(c.id)?.droopModeRaw===1);
    first.diagnostics.stationControllerSummary={...(first.diagnostics.stationControllerSummary as object),active:controllerRows.length,zeroDroopActive:controllerRows.filter(c=>sourceById.get(c.id)?.droopModeRaw===0).length,zeroDroopSemanticallySupported:controllerRows.filter(c=>sourceById.get(c.id)?.droopModeRaw===0&&c.supported).length,numericallyControllable:supported.filter(c=>!['ROLLED_BACK_TO_LOCAL_PV','CONTROL_SOLVE_FAILED'].includes(c.status)).length,supported:supported.length,satisfied:supported.filter(c=>c.status==='SATISFIED').length,saturated,qLimitSaturated:saturated,rolledBack:controllerRows.filter(c=>c.status==='ROLLED_BACK_TO_LOCAL_PV').length,unsupported:controllerRows.length-supported.length,droopActive:droopRows.length,droopSafeCandidates:droopRows.filter(c=>c.supported).length,droopControlled:droopRows.filter(c=>['SATISFIED','SATURATED_QMIN','SATURATED_QMAX','MAX_OUTER_ROUNDS'].includes(c.status)).length,remoteConflict:droopRows.filter(c=>c.status==='REMOTE_CONTROL_CONFLICT').length,qLimitMissing:droopRows.filter(c=>{const source=sourceById.get(c.id);return source?.unitIds.some(id=>{const unit=effective.generators.find(g=>g.id===id);return unit?.inService&&(unit.qMin==null||unit.qMax==null);});}).length,outerControlRounds:outerRounds,maxVoltageResidualPu:residuals.length?Math.max(...residuals):null,meanVoltageResidualPu:residuals.length?residuals.reduce((a,b)=>a+b,0)/residuals.length:null,statusCounts,failureReasonCounts,controlSolveFailure:controllerRows.find(c=>c.controlSolveFailure)?.controlSolveFailure??null,ownershipUnallocatedMvar:supported.reduce((sum,c)=>sum+(c.ownershipUnallocatedMvar||0),0),coupledSolveDiagnostics:outputs.flatMap(o=>o.controlled.coupledSystems||[]),mode:request.stationControlMode??'zeroDroop',droop:'SAFE_EXPERIMENTAL_ONLY',qDistribution:'DISPATCHED_ACTIVE_POWER'};
    const keys:(keyof ControlTimings)[]=['baseNrMs','controllerClassificationMs','jacobianBuildMs','iluFactorMs','sensitivitySolveMs','outerTrialNrMs','finalNrMs'];const timings=Object.fromEntries(keys.map(key=>[key,outputs.reduce((sum,o)=>sum+o.controlled.timings[key],0)]));Object.assign(timings,{prepareMs:preparedMs,resultMapMs:outputs.reduce((sum,o)=>sum+o.resultMapMs,0),totalMs:first.elapsedMs});
    first.diagnostics.timings=timings;first.diagnostics.stationTrialAttempts=outputs.flatMap(o=>o.controlled.trialAttempts||[]);first.diagnostics.preparationMs=preparedMs;first.diagnostics.outerControlRounds=outerRounds;return first;
  }
  async runDcPowerFlow(request:AnalysisRequest,onProgress:Progress=()=>{}){return runReduced(request,'dc',onProgress);}
  async runFastAc(request:AnalysisRequest,onProgress:Progress=()=>{}){return runReduced(request,'fastAc',onProgress);}
}
