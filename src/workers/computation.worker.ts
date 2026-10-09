/// <reference lib="webworker" />
import { DgsModel } from '../importers/dgs/index';
import { mapCanonical } from '../importers/dgs/canonical';
import { catalogPage } from '../importers/dgs/catalog';
import type { CanonicalNetwork } from '../domain/model/network';
import { BrowserJsPowerFlowEngine } from '../analysis/api/browser-js-engine';
import { selfTests } from '../analysis/power-flow/js/index';
import type { WorkerRequest,WorkerResponse } from './protocol';
import { packResult } from './result-codec';
import { auditModelQuality } from '../domain/model-quality';
import { getN1SelectedDetail, runN1Screen } from '../domain/n1';
import { effectiveNetwork } from '../domain/scenario/overlay';
import { prepareModel } from '../analysis/power-flow/preparation';
import { prepareReduced } from '../analysis/fast-ac/reduced-model';
import { buildN1CandidateCatalog } from '../domain/n1/catalog';
import { loadBenchmark } from '../importers/powerfactory-benchmark';
import { loadBenchmarkModel } from '../importers/powerfactory-benchmark/model';
import { auditShortCircuitReadiness } from '../importers/powerfactory-benchmark/readiness';
import { benchmarkControlContext,benchmarkLfReference } from '../domain/benchmark/reference';
import { applyPowerFactoryControlContext } from '../analysis/validation/powerfactory-control-context';
import { preflightPowerFactoryReference } from '../analysis/validation/powerfactory-preflight';
import { validateAcOutages } from '../analysis/contingency-ac';

const scope=self as unknown as DedicatedWorkerGlobalScope;
let source:DgsModel|null=null,network:CanonicalNetwork|null=null;
const engine=new BrowserJsPowerFlowEngine();
scope.onmessage=async({data}:MessageEvent<WorkerRequest>)=>{
  const send=(response:Omit<WorkerResponse,'id'>,transfer:Transferable[]=[])=>scope.postMessage({...response,id:data.id},transfer);
  const progress=(stage:string,detail?:Record<string,unknown>)=>send({type:'PROGRESS',stage,detail});
  try{
    if(data.type==='LOAD_BENCHMARK_PAIR'){
      const benchmark=await loadBenchmark(data.benchmark,progress),loaded=await loadBenchmarkModel(data.model,progress);
      if(loaded.network.studyCase!==benchmark.groups.LF.identity.studyCase)throw Error('BENCHMARK_IDENTITY_MISMATCH: model Study Case');
      const context=benchmarkControlContext(benchmark),updated=applyPowerFactoryControlContext(loaded.network,context),preflight=preflightPowerFactoryReference(benchmarkLfReference(benchmark),updated,null);
      if(preflight.reasons.some(r=>!r.includes('Yakınsamış Tam AC')))throw Error(`BENCHMARK_TOPOLOGY_MISMATCH: ${preflight.reasons.join('; ')}`);
      const readiness=auditShortCircuitReadiness(loaded.raw);source=loaded.source;network=updated;
      send({type:'RESULT',value:{network,benchmark,readiness,controlContextHash:context.sourceHash,numericFile:benchmark.groups.LF.workbook.file}});
    }else if(data.type==='RUN_N1_AC_VALIDATE'){
      if(!network)throw Error('Model yüklenmedi.');
      send({type:'RESULT',value:await validateAcOutages(network,data.scenario,data.outages,{maxCases:3,timeBudgetMs:120000,analysisSettings:data.analysisSettings,onProgress:progress})});
    }else if(data.type==='LOAD_MODEL'){
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
    else if(data.type==='RUN_MODEL_QUALITY'){
      if(!network)throw Error('Model yüklenmedi.');
      progress('QUALITY',{message:'Model kalitesi denetleniyor'});
      const effective=effectiveNetwork(network,data.scenario);let preparationDiagnostics:Record<string,unknown>|undefined,reducedModelDiagnostics:Record<string,unknown>|undefined;
      try{preparationDiagnostics=prepareModel(effective).diagnostics;}catch(error){progress('QUALITY',{message:`Tam ağ tanıları alınamadı: ${error instanceof Error?error.message:String(error)}`});}
      try{reducedModelDiagnostics=prepareReduced(effective).diagnostics;}catch(error){progress('QUALITY',{message:`İndirgenmiş ağ tanıları alınamadı: ${error instanceof Error?error.message:String(error)}`});}
      send({type:'RESULT',value:auditModelQuality(effective,{preparationDiagnostics,reducedModelDiagnostics})});
    }
    else if(data.type==='BUILD_N1_CATALOG'){
      if(!network)throw Error('Model yüklenmedi.');
      progress('N1_CATALOG',{message:'N-1 aday kataloğu hazırlanıyor'});
      const effective=effectiveNetwork(network,data.scenario),reduced=prepareReduced(effective);
      const catalog=buildN1CandidateCatalog(network,data.scenario,{capacitySeason:data.capacitySeason,reduced});
      send({type:'RESULT',value:catalog});
    }
    else if(data.type==='RUN_N1_SCREEN'){
      if(!network)throw Error('Model yüklenmedi.');
      const result=await runN1Screen(network,data.scenario,data.options,{onProgress:p=>progress(p.stage,{completed:p.completed,total:p.total,percent:p.percent,elapsedMs:p.elapsedMs,screenedSoFar:p.screenedSoFar,violationCountSoFar:p.violationCountSoFar,islandingCount:p.islandingCount,unsupportedCount:p.unsupportedCount})});
      progress('N1_RESULT',{message:'N-1 sonuçları hazırlanıyor'});
      send({type:'RESULT',value:result});
    }
    else if(data.type==='RUN_N1_DETAIL'){
      if(!network)throw Error('Model yüklenmedi.');
      send({type:'RESULT',value:getN1SelectedDetail(network,data.scenario,data.candidateId,data.options)});
    }
    else{
      if(!network)throw Error('Model yüklenmedi.');const request={network,scenario:data.scenario,identity:data.identity,analysisSettings:data.analysisSettings};
      const result=await (data.type==='RUN_DC'?engine.runDcPowerFlow(request,progress):data.type==='RUN_FAST'?engine.runFastAc(request,progress):engine.runPowerFlow(request,progress));
      const packed=packResult(result);send({type:'RESULT',value:packed},[packed.busValues.buffer,packed.branchValues.buffer]);
    }
  }catch(error){send({type:'ERROR',error:error instanceof Error?error.message:String(error)});}
};
