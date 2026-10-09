import type { AppContext,CatalogQuery,CatalogPage } from './contracts';
import type { CanonicalNetwork } from '../domain/model/network';
import { ScenarioStore,calculationScenario,scenarioChanged,emptyScenario,type StatusKey } from '../domain/scenario/overlay';
import { ResultStore } from '../domain/results/store';
import { identity,stableJson,type AnalysisType } from '../domain/calculation/identity';
import { AnalysisSettingsStore, activeAnalysisSettings, analysisSettingsHash } from '../domain/calculation/analysis-settings';
import { SettingsStore } from '../persistence/settings';
import { BrowserDatabase } from '../persistence/database';
import { WorkerTransport } from '../workers/transport';
import { unpackResult,type PackedResult } from '../workers/result-codec';
import { logger } from '../analysis/diagnostics/logger';
import { planEnergization,applyEnergization } from '../topology/energization';
import { effectiveNetwork } from '../domain/scenario/overlay';
import { allVoltageBands } from '../domain/model/voltage-band';
import type { ModelQualityAuditResult } from '../domain/model-quality';
import type { N1ScreenOptions, N1ScreenResult, N1SelectedDetail } from '../domain/n1';
import { scenarioSignature } from '../domain/scenario/overlay';
import type { CapacitySeason } from '../domain/model/capacity';
import type { N1Progress } from '../domain/n1';
import type { N1CandidateCatalog } from '../domain/n1/catalog';
import { applyPowerFactoryControlContext, importPowerFactoryControlContext } from '../analysis/validation/powerfactory-control-context';
import { calculationConvergenceLabel,fullAcDiagnostics } from '../domain/results/diagnostics';
import {seedBenchmarkPreflight,type BenchmarkPreflight} from '../domain/benchmark/comparison';
import {runHybridN1} from '../analysis/contingency-hybrid';

export class Application implements AppContext {
  hybridResult:AppContext['hybridResult']=null;scContext:AppContext['scContext']=null;scResult:AppContext['scResult']=null;
  private hybridAbort:AbortController|null=null;
  benchmark:AppContext['benchmark']=null;benchmarkReadiness:AppContext['benchmarkReadiness']=null;n1AcResults:AppContext['n1AcResults']=[];benchmarkMap:AppContext['benchmarkMap']=null;
  network:CanonicalNetwork|null=null;modelQualityResult:ModelQualityAuditResult|null=null;modelQualityScenarioHash:string|null=null;modelQualityAnalysisScope:AppContext['modelQualityAnalysisScope']=null;n1Result:N1ScreenResult|null=null;n1Progress:N1Progress|null=null;n1CatalogResult:N1CandidateCatalog|null=null;n1CatalogIdentity:AppContext['n1CatalogIdentity']=null;selectedN1CandidateId:string|null=null;selectedN1IslandId:string|null=null;n1Detail:N1SelectedDetail|null=null;n1DetailLoading=false;resultStore=new ResultStore();scenario=new ScenarioStore();settings=new SettingsStore();analysisSettings=new AnalysisSettingsStore();powerFactoryControlContextHash:string|null=null;powerFactoryControlContextNumericFile:string|null=null;
  selection:AppContext['selection']=null;filters={areaId:'',siteId:'',voltages:allVoltageBands(),search:''};busy=false;status='Hazır · JSON modeli seçin';view='model';
  private loadHeartbeat:ReturnType<typeof setInterval>|null=null;
  private startLoadHeartbeat(bytes:number){this.stopLoadHeartbeat();const started=performance.now();this.loadHeartbeat=setInterval(()=>{if(!this.loadingModel)return;this.status=this.status.replace(/ · süre .*$/,'')+` · süre ${((performance.now()-started)/1000).toFixed(1)} s · giriş ${(bytes/1024**2).toFixed(1)} MiB · yükleniyor`;this.notify();},1000);}
  private stopLoadHeartbeat(){if(this.loadHeartbeat!==null)clearInterval(this.loadHeartbeat);this.loadHeartbeat=null;}
  private listeners=new Set<()=>void>();private database=new BrowserDatabase();private job=0;private n1DetailJob=0;private loadingModel=false;private calcLoadedHash='';
  private source=new WorkerTransport((stage,detail)=>this.progress(stage,detail));
  private comparison=new WorkerTransport();
  private calculation=new WorkerTransport((stage,detail)=>this.progress(stage,detail));
  subscribe(fn:()=>void){this.listeners.add(fn);return()=>this.listeners.delete(fn);}
  notify(){for(const f of this.listeners){try{f();}catch(e){logger.log('ERROR','render','Görünüm yenilenemedi',e);}}}
  setView(view:string){this.view=view;this.notify();}
  setMessage(message:string){this.status=message;this.notify();}
  async loadBenchmarkPair(model:File,benchmark:File):Promise<void>{
    this.cancel(true);this.source.cancel();const job=++this.job;this.loadingModel=true;this.busy=true;this.network=null;this.benchmark=null;this.benchmarkReadiness=null;this.benchmarkMap=null;this.n1AcResults=[];this.hybridResult=null;this.scResult=null;this.scContext=null;this.resultStore.clear();this.scenario=new ScenarioStore();this.selection=null;this.calcLoadedHash='';this.powerFactoryControlContextHash=null;this.powerFactoryControlContextNumericFile=null;this.setMessage('Model ve benchmark doğrulanıyor');this.startLoadHeartbeat(model.size+benchmark.size);
    try{
      const loaded=await this.source.request<{network:CanonicalNetwork;benchmark:NonNullable<AppContext['benchmark']>;readiness:NonNullable<AppContext['benchmarkReadiness']>;scContext:AppContext['scContext'];controlContextHash:string;numericFile:string;benchmarkPreflight:BenchmarkPreflight}>({type:'LOAD_BENCHMARK_PAIR',model,benchmark});if(job!==this.job)return;
      this.hybridResult=null;this.scResult=null;this.scContext=loaded.scContext;
      this.network=loaded.network;this.benchmark=loaded.benchmark;this.benchmarkReadiness=loaded.readiness;this.powerFactoryControlContextHash=loaded.controlContextHash;this.powerFactoryControlContextNumericFile=loaded.numericFile;this.modelQualityResult=null;this.n1Result=null;this.n1CatalogResult=null;this.n1Detail=null;this.selectedN1CandidateId=null;this.selectedN1IslandId=null;
      seedBenchmarkPreflight(this.benchmark,this.network,null,this.powerFactoryControlContextNumericFile,loaded.benchmarkPreflight);
      this.status=`Benchmark hazır · ${loaded.benchmark.groups.LF.identity.studyCase} · LF / N-1 / SC · sayısal PF referansı`;
    }catch(error){if(job===this.job)this.status=`Benchmark yüklenemedi: ${error instanceof Error?error.message:String(error)}`;}
    finally{if(job===this.job){this.stopLoadHeartbeat();this.loadingModel=false;this.busy=false;this.notify();}}
  }
  async runN1AcValidation(outages:import('../analysis/contingency-ac').AcOutage[]):Promise<void>{
    if(!this.network||this.busy)return;const network=this.network,job=++this.job,scenario=structuredClone(this.scenario.current),signature=scenarioSignature(scenario),settings=structuredClone(this.analysisSettings.value),settingsSignature=stableJson(settings);this.busy=true;this.n1AcResults=[];this.setMessage('Seçili kesintiler Full AC ile doğrulanıyor');
    const timeout=setTimeout(()=>{if(job===this.job){this.cancel();this.setMessage('N-1 AC zaman bütçesi doldu · CANCELLED');}},120000);
    try{if(!await this.prepareCalculationWorker(network,job))return;
      const results=await this.calculation.request<AppContext['n1AcResults']>({type:'RUN_N1_AC_VALIDATE',scenario,outages,analysisSettings:settings});
      if(job!==this.job||this.network!==network||scenarioSignature(this.scenario.current)!==signature||stableJson(this.analysisSettings.value)!==settingsSignature)return;
      this.n1AcResults=results;this.status=`N-1 AC · ${results.filter(r=>r.status==='CONVERGED').length}/${results.length} yakınsamış · PF ayrıntılı paritesi yok`;
    }catch(error){if(job===this.job)this.status=`N-1 AC: ${error instanceof Error?error.message:String(error)}`;}
    finally{clearTimeout(timeout);if(job===this.job){this.busy=false;this.notify();}}
  }
  private async boundedWorker<T>(work:()=>Promise<T>,budgetMs:number):Promise<T>{
    let timer:ReturnType<typeof setTimeout>|undefined;
    try{return await Promise.race([work(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>{this.calculation.cancel('WORKER_TIME_BUDGET');this.calcLoadedHash='';reject(Error('WORKER_TIME_BUDGET'));},Math.max(1,budgetMs));})]);}
    finally{if(timer)clearTimeout(timer);}
  }
  async runHybrid(options:import('../analysis/contingency-hybrid').HybridOptions,resume=false):Promise<void>{
    if(!this.network||this.busy)return;
    const network=this.network,scenario=structuredClone(this.scenario.current),settings=structuredClone(this.analysisSettings.value),job=++this.job,signature=scenarioSignature(scenario),settingsSignature=stableJson(settings),abort=new AbortController();
    this.hybridAbort=abort;this.busy=true;
    const current=()=>job===this.job&&this.network===network&&scenarioSignature(this.scenario.current)===signature&&stableJson(this.analysisSettings.value)===settingsSignature;
    const work=async<T>(request:()=>Promise<T>,budget:number)=>this.boundedWorker(async()=>{if(!current())throw Error('HYBRID_STALE');if(!await this.prepareCalculationWorker(network,job))throw Error('HYBRID_STALE');return request();},budget);
    this.setMessage('N-1 otomatik hibrit hazırlanıyor');
    try{
      const result=await runHybridN1(network,scenario,{...options,analysisSettings:settings,signal:abort.signal,resume:resume?this.hybridResult??undefined:undefined,
        onProgress:(stage,detail)=>{if(current())this.progress(stage,detail);},
        onCheckpoint:r=>{if(current()){this.hybridResult=r;this.notify();}},
        solveBase:budget=>work(async()=>unpackResult(await this.calculation.request<PackedResult>({type:'RUN_AC',scenario,identity:identity(network.modelHash,scenario,'powerFlow',{analysisSettings:settings}),analysisSettings:settings})),budget),
        screen:(opts,budget)=>work(()=>this.calculation.request<N1ScreenResult>({type:'RUN_N1_SCREEN',scenario,options:opts}),budget),
        solveOutage:(outage,budget)=>work(async()=>{const rows=await this.calculation.request<AppContext['n1AcResults']>({type:'RUN_N1_AC_VALIDATE',scenario,outages:[outage],analysisSettings:settings});return rows[0];},budget),
      });
      if(current()){this.hybridResult=result;this.status=`N-1 hibrit · ${result.status} · ${JSON.stringify(result.counts)} · ${result.reason}`;}
    }catch(e){if(current())this.status=`N-1 hibrit: ${e instanceof Error?e.message:String(e)}`;}
    finally{if(current()){this.hybridAbort=null;this.busy=false;this.notify();}}
  }
  async runSc(terminals:string[],profile:import('../analysis/short-circuit').ScProfile,adapterOptions?:import('../analysis/short-circuit/source-adapter').ScAdapterOptions):Promise<void>{
    if(!this.network||!this.scContext||this.busy)return;
    const network=this.network,scenario=structuredClone(this.scenario.current),signature=scenarioSignature(scenario),job=++this.job;this.busy=true;this.scResult=null;this.setMessage(`GA bağımsız 3PH ${profile.calculateMode} hesaplanıyor`);
    try{const context=adapterOptions?await this.source.request<NonNullable<AppContext['scContext']>>({type:'ADAPT_SC_CONTEXT',network,options:{...adapterOptions,mode:profile.calculateMode}}):this.scContext!;if(job!==this.job)return;const result=await this.boundedWorker(async()=>{if(!await this.prepareCalculationWorker(network,job))throw Error('SC_STALE');return this.calculation.request<NonNullable<AppContext['scResult']>>({type:'RUN_SC_3PH',context,scenario,terminals,profile});},profile.timeBudgetMs);
      if(job===this.job&&this.network===network&&scenarioSignature(this.scenario.current)===signature){this.scContext=context;this.scResult=result;this.status=`GA 3PH ${profile.calculateMode} · ${JSON.stringify(result.counts)} · IEC paritesi doğrulanmadı`;}
    }catch(e){if(job===this.job)this.status=`GA SC: ${e instanceof Error?e.message:String(e)}`;}
    finally{if(job===this.job){this.busy=false;this.notify();}}
  }
  private progress(stage:string,detail?:Record<string,unknown>){const labels:Record<string,string>={MODEL:'Model hazırlanıyor',TOPOLOGY:'Elektriksel topoloji',YBUS:'Ybus hazır',INIT:'Başlangıç değerleri',INNER_NR:'Newton adımı',Q_LIMIT:'Q limiti / PV→PQ',RESULT:'Sonuç hazırlanıyor',QUALITY:'Model kalitesi denetleniyor',N1_CATALOG:'N-1 adayları hazırlanıyor',N1_TOPOLOGY:'N-1 topolojisi sınıflandırılıyor',N1_FACTOR:'N-1 DC matrisi çarpanlara ayrılıyor',N1_SCREEN:'N-1 adayları taranıyor',N1_RESULT:'N-1 sonuçları hazırlanıyor'};
    const percent=typeof detail?.percent==='number'?` · %${Math.round(detail.percent)}`:'';
    if(stage.startsWith('N1_')&&stage!=='N1_CATALOG'&&typeof detail?.completed==='number'&&typeof detail.total==='number')this.n1Progress={stage:stage as N1Progress['stage'],completed:detail.completed,total:detail.total,percent:Number(detail.percent)||0,elapsedMs:Number(detail.elapsedMs)||0,screenedSoFar:Number(detail.screenedSoFar)||0,violationCountSoFar:Number(detail.violationCountSoFar)||0,islandingCount:Number(detail.islandingCount)||0,unsupportedCount:Number(detail.unsupportedCount)||0};
    this.status=String(detail?.message||labels[stage]||stage)+(detail?.iteration?` ${detail.iteration}`:'')+(typeof detail?.maxMismatchMW==='number'?` · Δ ${detail.maxMismatchMW.toPrecision(4)} MW`:'')+percent;this.notify();}
  async loadFiles(files:FileList|File[]){const file=files[0];if(!file)return;this.benchmark=null;this.benchmarkReadiness=null;this.benchmarkMap=null;this.n1AcResults=[];this.hybridResult=null;this.scResult=null;this.scContext=null;this.cancel();const job=++this.job;this.loadingModel=true;this.busy=true;this.network=null;this.powerFactoryControlContextHash=null;this.powerFactoryControlContextNumericFile=null;this.source.cancel();this.resultStore.clear();this.scenario=new ScenarioStore();this.selection=null;this.setMessage(`${file.name} · Yükleniyor`);this.startLoadHeartbeat(file.size);
    try{const loaded=await this.source.request<{network:CanonicalNetwork;scContext:AppContext['scContext'];timing:Record<string,number>}>({type:'LOAD_MODEL',file});if(job!==this.job)return;
      this.hybridResult=null;this.scResult=null;this.scContext=loaded.scContext;
      this.network=loaded.network;this.modelQualityResult=null;this.modelQualityScenarioHash=null;this.modelQualityAnalysisScope=null;this.n1Result=null;this.n1Progress=null;this.n1CatalogResult=null;this.n1CatalogIdentity=null;this.selectedN1CandidateId=null;this.selectedN1IslandId=null;this.n1Detail=null;this.n1DetailLoading=false;this.filters={areaId:'',siteId:'',voltages:allVoltageBands(),search:''};this.calcLoadedHash='';
      this.status=`${loaded.network.name} · ${loaded.network.records.toLocaleString('tr-TR')} kayıt · ${(loaded.timing.totalMs/1000).toFixed(2)} s`;
      void this.database.put('model-metadata',{hash:loaded.network.modelHash,name:file.name,size:file.size,timing:loaded.timing}).catch(()=>{});
      const saved=await this.database.get<import('../domain/scenario/overlay').ScenarioOverlay>(`scenario:${loaded.network.modelHash}`).catch(()=>undefined);
      if(job===this.job&&saved){this.scenario.replace(saved);if(scenarioChanged(saved)){this.resultStore.role='scenario';this.status+=' · Kaydedilmiş senaryo geri yüklendi; hesap bekleniyor';}}
    }catch(e){if(job===this.job){this.status=`Model yüklenemedi: ${e instanceof Error?e.message:String(e)}`;logger.log('ERROR','import',this.status,e);}}
    finally{if(job===this.job){this.stopLoadHeartbeat();this.loadingModel=false;this.busy=false;this.notify();}}
  }
  async loadPowerFactoryControlContext(file:File):Promise<void>{
    if(!this.network||this.busy)throw new Error('Önce DGS modelini yükleyin ve etkin hesaplamayı bitirin.');
    const parsed=importPowerFactoryControlContext(await file.text()),updated=applyPowerFactoryControlContext(this.network,parsed);
    this.cancel(true);this.network=updated;this.powerFactoryControlContextHash=parsed.sourceHash;this.powerFactoryControlContextNumericFile=parsed.metadata.numericBenchmarkFile?.split(/[\\/]+/).at(-1)??null;this.resultStore.clear();this.modelQualityResult=null;this.modelQualityScenarioHash=null;
    this.status=`${file.name} · ${parsed.loads.length} etkin yükün i_scale uygunluğu FID ile doğrulandı · hesap bekleniyor`;this.notify();
  }
  async run(type:AnalysisType, requestedRole:'base'|'scenario'=this.resultStore.role==='base'?'base':'scenario'){if(!this.network||this.busy)return;const network=this.network,job=++this.job,role=requestedRole,scenario=calculationScenario(this.scenario.current,role);
    const snapshot=structuredClone(this.analysisSettings.value),activeSettings=activeAnalysisSettings(snapshot,type),id=identity(network.modelHash,scenario,type,{analysisSettings:activeSettings,analysisSettingsHash:analysisSettingsHash(snapshot,type),controlContextHash:this.powerFactoryControlContextHash});this.resultStore.analysisType=type;this.resultStore.expect(role,id);this.busy=true;this.setMessage('Hesap hazırlanıyor');
    try{if(this.calcLoadedHash!==network.modelHash){await this.calculation.request({type:'PREPARE',network});if(job!==this.job)return;this.calcLoadedHash=network.modelHash;}
      const packed=await this.calculation.request<PackedResult>({type:type==='dc'?'RUN_DC':type==='fastAc'?'RUN_FAST':'RUN_AC',scenario,identity:id,analysisSettings:snapshot});if(job!==this.job)return;
      const result=unpackResult(packed);
      if(type==='powerFlow'&&role==='base'&&this.benchmark){const benchmark=this.benchmark;this.setMessage('Tanısal kimlikler worker içinde karşılaştırılıyor');const timeout=setTimeout(()=>this.comparison.cancel('BENCHMARK_COMPARE_TIME_BUDGET'),120000);try{const gate=await this.comparison.request<BenchmarkPreflight>({type:'BENCHMARK_PREFLIGHT',network,benchmark,result,controlFile:this.powerFactoryControlContextNumericFile});if(job!==this.job||this.network!==network||this.benchmark!==benchmark)return;seedBenchmarkPreflight(benchmark,network,result,this.powerFactoryControlContextNumericFile,gate);}finally{clearTimeout(timeout);}}
      if(!this.resultStore.accept(role,result)){this.status='Senaryo/model değişti; eski hesap reddedildi.';return;}
      const label=type==='powerFlow'?'Tam AC':type==='fastAc'?'Hızlı Yaklaşık AC':'DC';
    const work=fullAcDiagnostics(result),workDetail=work.fullNrSolves==null?'':` · ${work.fullNrSolves} NR çözümü`;
    this.status=`${label} · ${role==='base'?'Baz':'Senaryo'} · ${calculationConvergenceLabel(result)}${type==='powerFlow'?` · ${work.newtonIterations??0} toplam Newton iterasyonu · ${work.finalNewtonIterations??0} son NR Newton iterasyonu${workDetail}`:` · ${result.iterations} ${type==='dc'?'doğrusal çözüm':'yaklaşık AC adımı'}`} · ${(result.elapsedMs/1000).toFixed(2)} s`;
    }catch(e){if(job===this.job){this.status=e instanceof Error&&e.message==='CANCELLED'?'Hesap iptal edildi.':`Hesap hatası: ${e instanceof Error?e.message:String(e)}`;logger.log('ERROR','analysis',this.status,e);}}
    finally{if(job===this.job){this.busy=false;this.notify();}}
  }
  private async prepareCalculationWorker(network:CanonicalNetwork,job:number){if(this.calcLoadedHash!==network.modelHash){await this.calculation.request({type:'PREPARE',network});if(job!==this.job)return false;this.calcLoadedHash=network.modelHash;}return true;}
  private scenarioForScope(scope:'base'|'scenario'){return calculationScenario(this.scenario.current,scope);}
  async runModelQuality(scope:'base'|'scenario'='scenario'){if(!this.network||this.busy)return;const network=this.network,scenario=this.scenarioForScope(scope),scenarioHash=scenarioSignature(scenario),job=++this.job;this.busy=true;this.setMessage('Model kalitesi denetleniyor');
    try{if(!await this.prepareCalculationWorker(network,job)||job!==this.job)return;const result=await this.calculation.request<ModelQualityAuditResult>({type:'RUN_MODEL_QUALITY',scenario});if(job!==this.job||this.network?.modelHash!==network.modelHash||scenarioSignature(this.scenarioForScope(scope))!==scenarioHash)return;this.modelQualityResult=result;this.modelQualityScenarioHash=scenarioHash;this.modelQualityAnalysisScope=scope;this.status=`Model kalitesi · ${result.summary.total} bulgu · ${result.summary.counts.BLOCKER} engelleyici`;
    }catch(e){if(job===this.job){this.status=`Model kalite denetimi başarısız: ${e instanceof Error?e.message:String(e)}`;logger.log('ERROR','quality',this.status,e);}}
    finally{if(job===this.job){this.busy=false;this.notify();}}
  }
  async loadN1Catalog(scope:'base'|'scenario',season:CapacitySeason,includeAllVoltages=false){if(!this.network||this.busy)return;const network=this.network,scenario=this.scenarioForScope(scope),scenarioHash=scenarioSignature(scenario),identity={modelHash:network.modelHash,scenarioHash,analysisScope:scope,capacitySeason:season,includeAllVoltages};if(this.n1CatalogResult&&this.n1CatalogIdentity&&JSON.stringify(this.n1CatalogIdentity)===JSON.stringify(identity))return;const job=++this.job;this.busy=true;this.n1Progress=null;this.setMessage('N-1 aday kataloğu hazırlanıyor');
    try{if(this.calcLoadedHash!==network.modelHash){await this.calculation.request({type:'PREPARE',network});if(job!==this.job)return;this.calcLoadedHash=network.modelHash;}const result=await this.calculation.request<N1CandidateCatalog>({type:'BUILD_N1_CATALOG',scenario,capacitySeason:season,includeAllVoltages});if(job!==this.job||this.network?.modelHash!==network.modelHash||scenarioSignature(this.scenarioForScope(scope))!==scenarioHash)return;this.n1CatalogResult=result;this.n1CatalogIdentity=identity;this.status=`N-1 kataloğu · ${result.counts.total} aday`;
    }catch(e){if(job===this.job){this.status=`N-1 aday kataloğu hazırlanamadı: ${e instanceof Error?e.message:String(e)}`;logger.log('ERROR','n1-catalog',this.status,e);}}
    finally{if(job===this.job){this.busy=false;this.notify();}}
  }
  async runN1Screen(options:N1ScreenOptions){if(!this.network||this.busy)return;const network=this.network,scope=options.analysisScope||'scenario',scenario=this.scenarioForScope(scope),job=++this.job,scenarioHash=scenarioSignature(scenario);++this.n1DetailJob;this.selectedN1CandidateId=null;this.selectedN1IslandId=null;this.n1Detail=null;this.n1DetailLoading=false;this.busy=true;this.n1Progress=null;this.setMessage('N-1 taraması başlatılıyor');
    try{if(!await this.prepareCalculationWorker(network,job)||job!==this.job)return;const result=await this.calculation.request<N1ScreenResult>({type:'RUN_N1_SCREEN',scenario,options});if(job!==this.job||this.network?.modelHash!==network.modelHash||scenarioSignature(this.scenarioForScope(scope))!==scenarioHash)return;this.n1Result=result;this.status=`N-1 taraması · ${result.screenedCount}/${result.candidateCount} tarandı · ${result.islandingCount} ada ayıran · ${(result.elapsedMs/1000).toFixed(2)} sn`;
    }catch(e){if(job===this.job){this.status=e instanceof Error&&e.message==='CANCELLED'?'N-1 taraması iptal edildi.':`N-1 taraması başarısız: ${e instanceof Error?e.message:String(e)}`;logger.log('ERROR','n1',this.status,e);}}
    finally{if(job===this.job){this.busy=false;this.notify();}}
  }
  async selectN1Candidate(candidateId:string|null):Promise<void>{
    const token=++this.n1DetailJob,network=this.network,result=this.n1Result;
    this.selectedN1CandidateId=candidateId;this.selectedN1IslandId=null;this.n1Detail=null;this.n1DetailLoading=false;
    const candidate=result?.candidates.find(row=>row.candidateId===candidateId);
    if(candidate)this.selection={id:candidate.equipmentId,sourceClass:candidate.sourceClass};
    if(!candidateId||!candidate||!network||!result||this.busy){this.notify();return;}
    const scope=result.analysisScope,scenario=this.scenarioForScope(scope),scenarioHash=scenarioSignature(scenario);
    if(result.identity.modelHash!==network.modelHash||result.identity.scenarioHash!==scenarioHash){this.notify();return;}
    this.n1DetailLoading=true;this.notify();
    try{
      if(this.calcLoadedHash!==network.modelHash){await this.calculation.request({type:'PREPARE',network});if(token!==this.n1DetailJob)return;this.calcLoadedHash=network.modelHash;}
      const detail=await this.calculation.request<N1SelectedDetail|null>({type:'RUN_N1_DETAIL',scenario,candidateId,options:{analysisScope:scope,capacitySeason:result.capacitySeason}});
      if(token===this.n1DetailJob&&this.network?.modelHash===network.modelHash&&this.n1Result===result&&scenarioSignature(this.scenarioForScope(scope))===scenarioHash&&detail?.candidate.candidateId===candidateId)this.n1Detail=detail;
    }catch(error){if(token===this.n1DetailJob){this.status=`N-1 detay sonucu hazırlanamadı: ${error instanceof Error?error.message:String(error)}`;logger.log('ERROR','n1-detail',this.status,error);}}
    finally{if(token===this.n1DetailJob){this.n1DetailLoading=false;this.notify();}}
  }
  selectN1Island(islandId:string|null):void{this.selectedN1IslandId=islandId&&this.n1Detail?.outageIslands.some(island=>island.islandId===islandId)?islandId:null;this.notify();}
  cancel(silent=false){this.stopLoadHeartbeat();this.hybridAbort?.abort();this.hybridAbort=null;if(this.hybridResult&&this.busy){this.hybridResult.status='CANCELLED';for(const c of this.hybridResult.cases)if(c.status==='NOT_RUN_BUDGET'){c.status='CANCELLED';c.reason='USER_CANCELLED';}}++this.job;++this.n1DetailJob;this.n1DetailLoading=false;if(this.loadingModel){this.source.cancel();this.loadingModel=false;}this.calculation.cancel();this.comparison.cancel();this.calcLoadedHash='';this.busy=false;this.n1Progress=null;this.status='Hesap iptal edildi.';if(!silent)this.notify();}
  catalog(query:CatalogQuery):Promise<CatalogPage>{return this.source.request({type:'CATALOG',query});}
  select(id:string,sourceClass:string,view?:string){this.selection={id,sourceClass};if(view)this.view=view;this.notify();}
  private scenarioUpdated(){this.n1AcResults=[];this.cancel(true);this.hybridResult=null;this.scResult=null;this.selectedN1CandidateId=null;this.selectedN1IslandId=null;this.n1Detail=null;this.resultStore.invalidateScenario();this.resultStore.role=scenarioChanged(this.scenario.current)?'scenario':'base';this.status=scenarioChanged(this.scenario.current)?'Senaryo değişti · Güncel hesap bekleniyor':'Baz model etkin';if(this.network&&!this.benchmark)void this.database.put(`scenario:${this.network.modelHash}`,this.scenario.current).catch(()=>{});this.notify();}
  async setBusStatus(termIds: readonly string[], value: boolean | 'source', calculate=false){
    if(!this.network)return;
    const requested=new Set(termIds),members=this.network.buses.filter(b=>requested.has(b.id)).map(b=>({id:b.id,source:b.inService}));
    if(!members.length)return;
    this.scenario.setBusStatus(members,value);this.scenarioUpdated();
    if(calculate)await this.run(this.resultStore.analysisType,'scenario');
  }
  async setStatus(key:StatusKey,id:string,value:boolean,source:boolean,calculate=false){
    if(!this.network)return;
    if(key==='lineStatus'&&value&&!source){const effective=effectiveNetwork(this.network,this.scenario.current),plan=planEnergization(effective,id);if(!plan.ready){this.setMessage(`Devreye alma engeli: ${plan.blockers.join(' ')}`);return;}this.scenario.replace(applyEnergization(this.scenario.current,plan));}
    else this.scenario.setStatus(key,id,value,source);
    this.scenarioUpdated();if(calculate)await this.run(this.resultStore.analysisType,'scenario');
  }
  clearModel(){this.benchmark=null;this.benchmarkReadiness=null;this.benchmarkMap=null;this.n1AcResults=[];this.hybridResult=null;this.scResult=null;this.scContext=null;this.cancel();this.source.cancel();this.network=null;this.powerFactoryControlContextHash=null;this.powerFactoryControlContextNumericFile=null;this.modelQualityResult=null;this.modelQualityScenarioHash=null;this.modelQualityAnalysisScope=null;this.n1Result=null;this.n1CatalogResult=null;this.n1CatalogIdentity=null;this.selectedN1CandidateId=null;this.selectedN1IslandId=null;this.n1Detail=null;this.selection=null;this.scenario=new ScenarioStore();this.resultStore.clear();this.filters={areaId:'',siteId:'',voltages:allVoltageBands(),search:''};this.status='Model bellekten temizlendi.';this.notify();}
  resetScenario(){this.scenario.reset();this.scenarioUpdated();}
  undoScenario(){this.scenario.undo();this.scenarioUpdated();}
}
