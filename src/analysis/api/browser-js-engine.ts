import type { AnalysisEngine, AnalysisRequest, Progress } from './engine';
import type { CanonicalNetwork } from '../../domain/model/network';
import { effectiveNetwork } from '../../domain/scenario/overlay';
import { prepareModel } from '../power-flow/preparation';
import { mapResults } from '../power-flow/results';
import {runStationControlledIsland,type StationControlDiagnostic} from '../power-flow/station-controls';
import { runReduced } from '../fast-ac/reduced-engine';
export class BrowserJsPowerFlowEngine implements AnalysisEngine {
  readonly name='BrowserJsEngine';readonly version='7.2.0';
  capabilities(network:CanonicalNetwork){return network.capabilities;}
  async runPowerFlow(request:AnalysisRequest,onProgress:Progress=()=>{}){
    onProgress('MODEL');const start=performance.now(),effective=effectiveNetwork(request.network,request.scenario);onProgress('TOPOLOGY');
    const built=prepareModel(effective),preparedMs=performance.now()-start;onProgress('INIT');
    const mappings=built.diagnostics.stationControllerMappings as {id:string;islandId:string|null;solverBusIndex:number|null}[],islandModels=[built,...(built.additionalIslands||[])],outputs=islandModels.map(part=>{
      const controlled=runStationControlledIsland(effective,part,mappings,(stage,detail)=>onProgress(stage==='YBUS_READY'?'YBUS':stage==='Q_LIMIT_UPDATE'?'Q_LIMIT':stage==='STATION_CONTROL'?'OUTER_CONTROL':'INNER_NR',{...detail,islandId:part.islandId}));
      const numerical=controlled.result;return{part:controlled.prepared,numerical,mapped:mapResults(controlled.prepared,numerical,request.identity),controlled};
    });
    onProgress('RESULT');const first=outputs[0].mapped,allConverged=outputs.every(o=>o.numerical.converged);
    for(const o of outputs.slice(1)){first.buses.push(...o.mapped.buses);first.branches.push(...o.mapped.branches);first.generators.push(...o.mapped.generators);first.warnings.push(...o.mapped.warnings);}
    first.converged=allConverged;first.status=allConverged?'CONVERGED_FULL_NR':outputs.length>1?'PARTIAL_ISLAND_FAILURE':first.status;
    first.iterations=outputs.reduce((sum,o)=>sum+o.numerical.iterations,0);first.rounds=Math.max(...outputs.map(o=>o.numerical.rounds));first.elapsedMs=performance.now()-start;
    first.maxMismatchMw=outputs.reduce<number|null>((max,o)=>o.numerical.maxMismatchMW==null?max:max==null?o.numerical.maxMismatchMW:Math.max(max,o.numerical.maxMismatchMW),null);
    first.quality.numericalStatus=allConverged?'CONVERGED':'NOT_CONVERGED';
    const islandDiagnostics=first.diagnostics.islands;if(Array.isArray(islandDiagnostics))for(const diagnostic of islandDiagnostics){if(!diagnostic||typeof diagnostic!=='object')continue;const row=diagnostic as {islandId:string;status:string;iterations:number|null};const found=outputs.find(o=>o.part.islandId===row.islandId);if(found){row.status=found.numerical.converged?(row.status==='MULTIPLE_REFERENCE_PARTIAL'?row.status:'CONVERGED'):found.numerical.status;row.iterations=found.numerical.iterations;}}
    const handled=new Set(outputs.flatMap(o=>o.controlled.controllers.map(c=>c.id))),controllerRows:StationControlDiagnostic[]=outputs.flatMap(o=>o.controlled.controllers);
    for(const c of effective.stationControllers.filter(c=>c.inService&&!handled.has(c.id))){const mapping=mappings.find(m=>m.id===c.id);controllerRows.push({id:c.id,remoteBus:c.remoteBus,islandId:mapping?.islandId??null,targetVpu:c.vmSet,initialVpu:null,finalVpu:null,voltageResidualPu:null,initialQ:null,finalQ:null,qMin:null,qMax:null,outerRounds:0,status:mapping?.islandId?'NO_REFERENCE_ISLAND':'REMOTE_BUS_UNRESOLVED',supported:false,unitIds:[...c.unitIds],actuatorBus:null,remoteBusIndex:null});}
    const supported=controllerRows.filter(c=>c.supported),residuals=supported.map(c=>Math.abs(c.voltageResidualPu??NaN)).filter(Number.isFinite),saturated=supported.filter(c=>c.status==='SATURATED_QMIN'||c.status==='SATURATED_QMAX').length,outerRounds=outputs.reduce((sum,o)=>sum+o.controlled.outerRounds,0);
    first.diagnostics.stationControllerResults=controllerRows;
    const statusCounts=Object.fromEntries([...new Set(controllerRows.map(c=>c.status))].sort().map(status=>[status,controllerRows.filter(c=>c.status===status).length]));
    first.diagnostics.stationControllerSummary={...(first.diagnostics.stationControllerSummary as object),active:controllerRows.length,supported:supported.length,satisfied:supported.filter(c=>c.status==='SATISFIED').length,saturated,qLimitSaturated:saturated,unsupported:controllerRows.length-supported.length,outerControlRounds:outerRounds,maxVoltageResidualPu:residuals.length?Math.max(...residuals):null,meanVoltageResidualPu:residuals.length?residuals.reduce((a,b)=>a+b,0)/residuals.length:null,statusCounts,mode:'SAFE_REMOTE_VOLTAGE_SUBSET',droop:'ZERO_DROOP_ONLY',qDistribution:'ONE_ELECTRICAL_BUS_ONLY'};
    first.diagnostics.preparationMs=preparedMs;first.diagnostics.outerControlRounds=outerRounds;return first;
  }
  async runDcPowerFlow(request:AnalysisRequest,onProgress:Progress=()=>{}){return runReduced(request,'dc',onProgress);}
  async runFastAc(request:AnalysisRequest,onProgress:Progress=()=>{}){return runReduced(request,'fastAc',onProgress);}
}
