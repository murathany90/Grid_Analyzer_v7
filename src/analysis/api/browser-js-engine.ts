import type { AnalysisEngine, AnalysisRequest, Progress } from './engine';
import type { CanonicalNetwork } from '../../domain/model/network';
import { effectiveNetwork } from '../../domain/scenario/overlay';
import { prepareModel } from '../power-flow/preparation';
import { solveNR } from '../power-flow/js/index';
import { mapResults } from '../power-flow/results';
import { runReduced } from '../fast-ac/reduced-engine';
export class BrowserJsPowerFlowEngine implements AnalysisEngine {
  readonly name='BrowserJsEngine';readonly version='7.0.0';
  capabilities(network:CanonicalNetwork){return network.capabilities;}
  async runPowerFlow(request:AnalysisRequest,onProgress:Progress=()=>{}){
    onProgress('MODEL');const start=performance.now(),effective=effectiveNetwork(request.network,request.scenario);onProgress('TOPOLOGY');
    const built=prepareModel(effective),preparedMs=performance.now()-start;onProgress('INIT');
    const r=solveNR(built.model,(stage,detail)=>onProgress(stage==='YBUS_READY'?'YBUS':stage==='Q_LIMIT_UPDATE'?'Q_LIMIT':'INNER_NR',detail));
    onProgress('RESULT');const result=mapResults(built,r,request.identity);result.diagnostics.preparationMs=preparedMs;return result;
  }
  async runDcPowerFlow(request:AnalysisRequest,onProgress:Progress=()=>{}){return runReduced(request,'dc',onProgress);}
  async runFastAc(request:AnalysisRequest,onProgress:Progress=()=>{}){return runReduced(request,'fastAc',onProgress);}
}
