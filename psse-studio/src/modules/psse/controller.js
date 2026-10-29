import { unpackModel } from './importers/archive.js';
import { inspectAttachments } from './importers/attachments.js';
import { ScenarioStore, deepFreeze } from './scenarios/store.js';
import { resultStatus } from './calculations/status.js';
import { ratePresentation } from './calculations/rating.js';
import {normalizeSolverOptions} from './calculations/solver-options.js';
export class PsseController {
  modelMode='NONE';psseInspection=null;psseNetwork=null;psseScenario=null;_calculation=null;_baseCalculation=null;psseAttachments=null;psseWorkerError=null;
  network=null;view='model';busy=false;status='SAV / RAW / ZIP modeli seçin';job=0;listeners=new Set();psseRequestOptions=new Map();metrics=[];
  get psseCalculation(){return ratePresentation(this._calculation,this.psseScenario&&this.psseNetwork?this.engine.fs(this.psseNetwork,this.psseScenario):this.psseNetwork,this.settings?.value.rateIndex??0);}
  set psseCalculation(value){this._calculation=value;}
  get psseBaseCalculation(){return ratePresentation(this._baseCalculation,this.psseNetwork,this.settings?.value.rateIndex??0);}
  set psseBaseCalculation(value){this._baseCalculation=value;}
  constructor(engine,host={}){
    this.engine=engine;this.host=host;this.psseSource=new engine.fo();this.psseCalculationWorker=new engine._o();this.settings=new engine.no();
    this.settings.value.rateIndex=Number(engine.window.localStorage.getItem('rate-index')??0);
    const update=this.settings.update.bind(this.settings);this.settings.update=(patch,...rest)=>{update(patch,...rest);if('rateIndex'in patch){this.settings.value.rateIndex=Math.max(0,Math.min(11,Math.trunc(Number(patch.rateIndex)||0)));engine.window.localStorage.setItem('rate-index',String(this.settings.value.rateIndex));}this.notify();};
    Object.defineProperty(engine.window,'__GA_PSSE_RATE_INDEX__',{configurable:true,get:()=>this.settings.value.rateIndex,set:value=>this.settings.update({rateIndex:value})});
    const apply=engine.fs;let cachedNetwork,cachedScenario,cached;
    engine.fs=(network,scenario)=>{if(cachedNetwork!==network||cachedScenario!==scenario){cachedNetwork=network;cachedScenario=scenario;cached=scenario.operations.length?deepFreeze(apply(network,scenario)):network;}return cached;};
  }
  subscribe(fn){this.listeners.add(fn);return ()=>this.listeners.delete(fn);}
  notify(){for(const fn of this.listeners)fn();this.host.onStateChange?.(this.snapshot());}
  snapshot(){return {mode:this.modelMode,view:this.view,busy:this.busy,status:this.status,modelHash:this.psseNetwork?.modelHash,scenarioHash:this.psseScenario?.hash,resultId:this.psseCalculation?.id,resultStatus:resultStatus(this.psseCalculation),rateIndex:this.settings.value.rateIndex};}
  setMessage(text){this.status=text;this.notify();}
  setView(view){this.view=view;this.notify();}
  cancel(silent=false){this.job++;this.psseSource.cancel();this.psseCalculationWorker.cancel();this.busy=false;if(!silent)this.setMessage('İşlem iptal edildi');}
  async loadFiles(files,sidecars=[]){
    if(!files[0])return;this.cancel(true);const job=++this.job,start=performance.now();this.busy=true;this.status='Model okunuyor';this.notify();
    try{
      const archive=await unpackModel(files[0]);if(job!==this.job)return;
      const inspection=await this.psseSource.request(archive.model);if(job!==this.job)return;
      const normalized=this.engine.No(inspection);
      const attached=[...archive.sidecars,...sidecars],attachments=attached.length?await inspectAttachments(inspection.source.sha256,attached,this.engine.z):null;
      if(job!==this.job)return;
      // Base case stays a sealed reference; scenarios are overlays over these values.
      this.psseInspection=deepFreeze(inspection);this.psseNetwork=deepFreeze(normalized);this.modelMode='PSSE';
      this.scenarios=new ScenarioStore(normalized,this.engine.Fo,inspection.source.sha256);this.psseScenario=this.scenarios.current;
      this.psseCalculation=this.psseBaseCalculation=null;this.psseWorkerError=null;
      this.psseAttachments=attachments;
      this.status=`${inspection.source.name} · ${inspection.equipment.filter(e=>e.kind==='bus').length} bara · ${inspection.equipment.filter(e=>e.kind==='line').length} AC hat · ${inspection.equipment.filter(e=>e.kind==='transformer').length} trafo`;
      this.metrics.push({action:'load',name:files[0].name,ms:performance.now()-start});this.host.onModelLoaded?.(this.snapshot());
    }catch(error){if(job===this.job){this.status=error.message;this.host.onError?.(error);throw error;}}
    finally{if(job===this.job){this.busy=false;this.notify();}}
  }
  syncScenario(){
    this.cancel(true);this.psseBaseCalculation=this.engine.Go(this.psseBaseCalculation,this.psseCalculation,this.psseNetwork,this.psseInspection.source.sha256);
    this.psseScenario=this.scenarios.current;this.psseCalculation=null;this.psseWorkerError=null;this.status='Senaryo değişti · NOT_RUN';this.notify();
  }
  setPsseScenario(operations){if(!this.scenarios)return;if(this.scenarios.replace(operations))this.syncScenario();}
  apply(operation){this.scenarios.apply(operation);this.syncScenario();}
  undoScenario(){if(this.scenarios?.undo())this.syncScenario();}
  redoScenario(){if(this.scenarios?.redo())this.syncScenario();}
  resetScenario(){if(this.scenarios?.reset())this.syncScenario();}
  selectScenario(id){this.scenarios.select(id);this.syncScenario();}
  async runPsseCalculation(method,options={}){
    if(!this.psseNetwork||this.busy)return;
    if(!['NR_POLAR','FDNS_XB','LOSSLESS_DC'].includes(method))throw Error('METHOD_UNSUPPORTED');
    const previous=this.psseRequestOptions.get(method);if(!Object.keys(options).length&&previous?.sourceSha256===this.psseInspection.source.sha256)options={...previous.options};
    options=normalizeSolverOptions(method,options);
    this.psseRequestOptions.set(method,{sourceSha256:this.psseInspection.source.sha256,options:{...options}});
    const model=this.psseInspection,network=this.psseNetwork,scenario=this.psseScenario,job=++this.job;
    this.psseBaseCalculation=this.engine.Go(this.psseBaseCalculation,this.psseCalculation,network,model.source.sha256);this.psseCalculation=null;this.busy=true;this.status=`${method} · hesaplanıyor`;this.notify();
    try{
      const result=await this.psseCalculationWorker.request({model,network,scenario,method,options,progress:p=>{if(job===this.job){this.status=`${method} · ${p.phase} · ${p.iteration+1}`;this.notify();}}});
      if(job!==this.job||scenario.hash!==this.psseScenario.hash||network!==this.psseNetwork)return;
      if(!this.engine.Wo(result,{sourceSha256:model.source.sha256,network,effectiveNetwork:this.engine.fs(network,scenario),scenario,method,optionsHash:this.engine.Ro({...method==='LOSSLESS_DC'?this.engine.ps:this.engine.ds,...options})}))throw Error('PSSE_RESULT_IDENTITY_MISMATCH');
      this.psseCalculation=deepFreeze(result);this.psseBaseCalculation=this.engine.Go(this.psseBaseCalculation,result,network,model.source.sha256);
      this.status=`${method} · ${resultStatus(result)} · ${result.iterations} adım · ${result.elapsedMs.toFixed(0)} ms`;
      this.metrics.push({action:'calculate',method,status:resultStatus(result),ms:result.elapsedMs,id:result.id});
    }catch(error){if(job===this.job){this.psseWorkerError={method,phase:'CALCULATION',message:error.message};this.status=`${method} · ${error.message}`;this.host.onError?.(error);}}
    finally{if(job===this.job){this.busy=false;this.notify();}}
  }
  clearModel(){this.cancel(true);this.psseInspection=this.psseNetwork=this.psseScenario=this.psseCalculation=this.psseBaseCalculation=null;this.scenarios=null;this.modelMode='NONE';this.status='Model temizlendi';this.notify();}
  dispose(){this.cancel(true);this.listeners.clear();this.psseRequestOptions.clear();this._calculation=this._baseCalculation=null;this.psseInspection=this.psseNetwork=this.psseScenario=this.psseAttachments=this.scenarios=null;this.engine.fs=()=>null;}
}
