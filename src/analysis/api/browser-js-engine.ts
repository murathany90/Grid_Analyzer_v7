import type { AnalysisEngine, AnalysisRequest, Progress } from './engine';
import type { CanonicalNetwork } from '../../domain/model/network';
import { effectiveNetwork } from '../../domain/scenario/overlay';
import { prepareModel } from '../power-flow/preparation';
import { solveNR } from '../power-flow/js/index';
import { mapResults } from '../power-flow/results';
import { runReduced } from '../fast-ac/reduced-engine';
export class BrowserJsPowerFlowEngine implements AnalysisEngine {
  readonly name='BrowserJsEngine';readonly version='7.1.0';
  capabilities(network:CanonicalNetwork){return network.capabilities;}
  async runPowerFlow(request:AnalysisRequest,onProgress:Progress=()=>{}){
    onProgress('MODEL');const start=performance.now(),effective=effectiveNetwork(request.network,request.scenario);onProgress('TOPOLOGY');
    const built=prepareModel(effective),preparedMs=performance.now()-start;onProgress('INIT');
    const islandModels=[built,...(built.additionalIslands||[])],outputs=islandModels.map(part=>{
      const numerical=solveNR(part.model,(stage,detail)=>onProgress(stage==='YBUS_READY'?'YBUS':stage==='Q_LIMIT_UPDATE'?'Q_LIMIT':'INNER_NR',{...detail,islandId:part.islandId}));
      return{part,numerical,mapped:mapResults(part,numerical,request.identity)};
    });
    onProgress('RESULT');const first=outputs[0].mapped,allConverged=outputs.every(o=>o.numerical.converged);
    for(const o of outputs.slice(1)){first.buses.push(...o.mapped.buses);first.branches.push(...o.mapped.branches);first.generators.push(...o.mapped.generators);first.warnings.push(...o.mapped.warnings);}
    first.converged=allConverged;first.status=allConverged?'CONVERGED_FULL_NR':outputs.length>1?'PARTIAL_ISLAND_FAILURE':first.status;
    first.iterations=outputs.reduce((sum,o)=>sum+o.numerical.iterations,0);first.rounds=Math.max(...outputs.map(o=>o.numerical.rounds));first.elapsedMs=performance.now()-start;
    first.maxMismatchMw=outputs.reduce<number|null>((max,o)=>o.numerical.maxMismatchMW==null?max:max==null?o.numerical.maxMismatchMW:Math.max(max,o.numerical.maxMismatchMW),null);
    first.quality.numericalStatus=allConverged?'CONVERGED':'NOT_CONVERGED';
    const islandDiagnostics=first.diagnostics.islands;if(Array.isArray(islandDiagnostics))for(const diagnostic of islandDiagnostics){if(!diagnostic||typeof diagnostic!=='object')continue;const row=diagnostic as {islandId:string;status:string;iterations:number|null};const found=outputs.find(o=>o.part.islandId===row.islandId);if(found){row.status=found.numerical.converged?(row.status==='MULTIPLE_REFERENCE_PARTIAL'?row.status:'CONVERGED'):found.numerical.status;row.iterations=found.numerical.iterations;}}
    first.diagnostics.preparationMs=preparedMs;first.diagnostics.outerControlRounds=0;return first;
  }
  async runDcPowerFlow(request:AnalysisRequest,onProgress:Progress=()=>{}){return runReduced(request,'dc',onProgress);}
  async runFastAc(request:AnalysisRequest,onProgress:Progress=()=>{}){return runReduced(request,'fastAc',onProgress);}
}
