/// <reference lib="webworker" />
import { DgsModel } from '../importers/dgs/index';
import { mapCanonical } from '../importers/dgs/canonical';
import { catalogPage } from '../importers/dgs/catalog';
import type { CanonicalNetwork } from '../domain/model/network';
import { BrowserJsPowerFlowEngine } from '../analysis/api/browser-js-engine';
import { selfTests } from '../analysis/power-flow/js/index';
import type { WorkerRequest,WorkerResponse } from './protocol';
import { packResult } from './result-codec';

const scope=self as unknown as DedicatedWorkerGlobalScope;
let source:DgsModel|null=null,network:CanonicalNetwork|null=null;
const engine=new BrowserJsPowerFlowEngine();
scope.onmessage=async({data}:MessageEvent<WorkerRequest>)=>{
  const send=(response:Omit<WorkerResponse,'id'>,transfer:Transferable[]=[])=>scope.postMessage({...response,id:data.id},transfer);
  const progress=(stage:string,detail?:Record<string,unknown>)=>send({type:'PROGRESS',stage,detail});
  try{
    if(data.type==='LOAD_MODEL'){
      progress('MODEL',{message:'Dosya okunuyor'});const started=performance.now(),buffer=await data.file.arrayBuffer();
      const digest=await crypto.subtle.digest('SHA-256',buffer),modelHash=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
      const text=new TextDecoder().decode(buffer),parseStart=performance.now(),raw=JSON.parse(text.replace(/^\uFEFF/,'')),parseMs=performance.now()-parseStart;
      source=new DgsModel(raw,data.file.name,data.file.size);await source.build(message=>progress('MODEL',{message}));
      const mapStart=performance.now();network=mapCanonical(source,modelHash);const canonicalMs=performance.now()-mapStart;
      send({type:'RESULT',value:{network,timing:{parseMs,canonicalMs,totalMs:performance.now()-started}}});
    }else if(data.type==='PREPARE'){network=data.network;send({type:'RESULT',value:true});}
    else if(data.type==='CATALOG'){if(!source)throw Error('Model yüklenmedi.');send({type:'RESULT',value:catalogPage(source,data.query)});}
    else if(data.type==='SELF_TEST'){send({type:'RESULT',value:selfTests()});}
    else if(data.type==='CANCEL'){scope.close();}
    else{
      if(!network)throw Error('Model yüklenmedi.');const request={network,scenario:data.scenario,identity:data.identity};
      const result=await (data.type==='RUN_DC'?engine.runDcPowerFlow(request,progress):data.type==='RUN_FAST'?engine.runFastAc(request,progress):engine.runPowerFlow(request,progress));
      const packed=packResult(result);send({type:'RESULT',value:packed},[packed.busValues.buffer,packed.branchValues.buffer]);
    }
  }catch(error){send({type:'ERROR',error:error instanceof Error?error.message:String(error)});}
};
