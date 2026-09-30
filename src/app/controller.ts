import type { AppContext,CatalogQuery,CatalogPage } from './contracts';
import type { CanonicalNetwork } from '../domain/model/network';
import { ScenarioStore,calculationScenario,scenarioChanged,emptyScenario,type StatusKey } from '../domain/scenario/overlay';
import { ResultStore } from '../domain/results/store';
import { identity,type AnalysisType } from '../domain/calculation/identity';
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

export class Application implements AppContext {
  network:CanonicalNetwork|null=null;modelQualityResult:ModelQualityAuditResult|null=null;modelQualityScenarioHash:string|null=null;modelQualityAnalysisScope:AppContext['modelQualityAnalysisScope']=null;n1Result:N1ScreenResult|null=null;n1Progress:N1Progress|null=null;n1CatalogResult:N1CandidateCatalog|null=null;n1CatalogIdentity:AppContext['n1CatalogIdentity']=null;selectedN1CandidateId:string|null=null;selectedN1IslandId:string|null=null;n1Detail:N1SelectedDetail|null=null;n1DetailLoading=false;resultStore=new ResultStore();scenario=new ScenarioStore();settings=new SettingsStore();
  selection:AppContext['selection']=null;filters={areaId:'',siteId:'',voltages:allVoltageBands(),search:''};busy=false;status='Hazır · JSON modeli seçin';view='model';
  private listeners=new Set<()=>void>();private database=new BrowserDatabase();private job=0;private n1DetailJob=0;private loadingModel=false;private calcLoadedHash='';
  private source=new WorkerTransport((stage,detail)=>this.progress(stage,detail));
  private calculation=new WorkerTransport((stage,detail)=>this.progress(stage,detail));
  subscribe(fn:()=>void){this.listeners.add(fn);return()=>this.listeners.delete(fn);}
  notify(){for(const f of this.listeners){try{f();}catch(e){logger.log('ERROR','render','Görünüm yenilenemedi',e);}}}
  setView(view:string){this.view=view;this.notify();}
  setMessage(message:string){this.status=message;this.notify();}
  private progress(stage:string,detail?:Record<string,unknown>){const labels:Record<string,string>={MODEL:'Model hazırlanıyor',TOPOLOGY:'Elektriksel topoloji',YBUS:'Ybus hazır',INIT:'Başlangıç değerleri',INNER_NR:'Newton adımı',Q_LIMIT:'Q limiti / PV→PQ',RESULT:'Sonuç hazırlanıyor',QUALITY:'Model kalitesi denetleniyor',N1_CATALOG:'N-1 adayları hazırlanıyor',N1_TOPOLOGY:'N-1 topolojisi sınıflandırılıyor',N1_FACTOR:'N-1 DC matrisi çarpanlara ayrılıyor',N1_SCREEN:'N-1 adayları taranıyor',N1_RESULT:'N-1 sonuçları hazırlanıyor'};
    const percent=typeof detail?.percent==='number'?` · %${Math.round(detail.percent)}`:'';
    if(stage.startsWith('N1_')&&stage!=='N1_CATALOG'&&typeof detail?.completed==='number'&&typeof detail.total==='number')this.n1Progress={stage:stage as N1Progress['stage'],completed:detail.completed,total:detail.total,percent:Number(detail.percent)||0,elapsedMs:Number(detail.elapsedMs)||0,screenedSoFar:Number(detail.screenedSoFar)||0,violationCountSoFar:Number(detail.violationCountSoFar)||0,islandingCount:Number(detail.islandingCount)||0,unsupportedCount:Number(detail.unsupportedCount)||0};
    this.status=String(detail?.message||labels[stage]||stage)+(detail?.iteration?` ${detail.iteration}`:'')+(typeof detail?.maxMismatchMW==='number'?` · Δ ${detail.maxMismatchMW.toPrecision(4)} MW`:'')+percent;this.notify();}
  async loadFiles(files:FileList|File[]){const file=files[0];if(!file)return;this.cancel();const job=++this.job;this.loadingModel=true;this.busy=true;this.network=null;this.source.cancel();this.resultStore.clear();this.scenario=new ScenarioStore();this.selection=null;this.setMessage(`${file.name} · Yükleniyor`);
    try{const loaded=await this.source.request<{network:CanonicalNetwork;timing:Record<string,number>}>({type:'LOAD_MODEL',file});if(job!==this.job)return;
      this.network=loaded.network;this.modelQualityResult=null;this.modelQualityScenarioHash=null;this.modelQualityAnalysisScope=null;this.n1Result=null;this.n1Progress=null;this.n1CatalogResult=null;this.n1CatalogIdentity=null;this.selectedN1CandidateId=null;this.selectedN1IslandId=null;this.n1Detail=null;this.n1DetailLoading=false;this.filters={areaId:'',siteId:'',voltages:allVoltageBands(),search:''};this.calcLoadedHash='';
      this.status=`${loaded.network.name} · ${loaded.network.records.toLocaleString('tr-TR')} kayıt · ${(loaded.timing.totalMs/1000).toFixed(2)} s`;
      void this.database.put('model-metadata',{hash:loaded.network.modelHash,name:file.name,size:file.size,timing:loaded.timing}).catch(()=>{});
      const saved=await this.database.get<import('../domain/scenario/overlay').ScenarioOverlay>(`scenario:${loaded.network.modelHash}`).catch(()=>undefined);
      if(job===this.job&&saved){this.scenario.replace(saved);if(scenarioChanged(saved)){this.resultStore.role='scenario';this.status+=' · Kaydedilmiş senaryo geri yüklendi; hesap bekleniyor';}}
    }catch(e){if(job===this.job){this.status=`Model yüklenemedi: ${e instanceof Error?e.message:String(e)}`;logger.log('ERROR','import',this.status,e);}}
    finally{if(job===this.job){this.loadingModel=false;this.busy=false;this.notify();}}
  }
  async run(type:AnalysisType, requestedRole:'base'|'scenario'=this.resultStore.role==='base'?'base':'scenario'){if(!this.network||this.busy)return;const network=this.network,job=++this.job,role=requestedRole,scenario=calculationScenario(this.scenario.current,role);
    const id=identity(network.modelHash,scenario,type);this.resultStore.analysisType=type;this.resultStore.expect(role,id);this.busy=true;this.setMessage('Hesap hazırlanıyor');
    try{if(this.calcLoadedHash!==network.modelHash){await this.calculation.request({type:'PREPARE',network});if(job!==this.job)return;this.calcLoadedHash=network.modelHash;}
      const packed=await this.calculation.request<PackedResult>({type:type==='dc'?'RUN_DC':type==='fastAc'?'RUN_FAST':'RUN_AC',scenario,identity:id});if(job!==this.job)return;
      const result=unpackResult(packed);if(!this.resultStore.accept(role,result)){this.status='Senaryo/model değişti; eski hesap reddedildi.';return;}
      const label=type==='powerFlow'?'Tam AC':type==='fastAc'?'Hızlı Yaklaşık AC':'DC';
      this.status=`${label} · ${role==='base'?'Baz':'Senaryo'} · ${result.converged?'Yakınsadı':result.status} · ${result.iterations} adım · ${(result.elapsedMs/1000).toFixed(2)} s`;
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
  async loadN1Catalog(scope:'base'|'scenario',season:CapacitySeason){if(!this.network||this.busy)return;const network=this.network,scenario=this.scenarioForScope(scope),scenarioHash=scenarioSignature(scenario),identity={modelHash:network.modelHash,scenarioHash,analysisScope:scope,capacitySeason:season};if(this.n1CatalogResult&&this.n1CatalogIdentity&&JSON.stringify(this.n1CatalogIdentity)===JSON.stringify(identity))return;const job=++this.job;this.busy=true;this.n1Progress=null;this.setMessage('N-1 aday kataloğu hazırlanıyor');
    try{if(this.calcLoadedHash!==network.modelHash){await this.calculation.request({type:'PREPARE',network});if(job!==this.job)return;this.calcLoadedHash=network.modelHash;}const result=await this.calculation.request<N1CandidateCatalog>({type:'BUILD_N1_CATALOG',scenario,capacitySeason:season});if(job!==this.job||this.network?.modelHash!==network.modelHash||scenarioSignature(this.scenarioForScope(scope))!==scenarioHash)return;this.n1CatalogResult=result;this.n1CatalogIdentity=identity;this.status=`N-1 kataloğu · ${result.counts.total} aday`;
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
  cancel(silent=false){++this.job;++this.n1DetailJob;this.n1DetailLoading=false;if(this.loadingModel){this.source.cancel();this.loadingModel=false;}this.calculation.cancel();this.calcLoadedHash='';this.busy=false;this.n1Progress=null;this.status='Hesap iptal edildi.';if(!silent)this.notify();}
  catalog(query:CatalogQuery):Promise<CatalogPage>{return this.source.request({type:'CATALOG',query});}
  select(id:string,sourceClass:string,view?:string){this.selection={id,sourceClass};if(view)this.view=view;this.notify();}
  private scenarioUpdated(){this.cancel(true);this.selectedN1CandidateId=null;this.selectedN1IslandId=null;this.n1Detail=null;this.resultStore.invalidateScenario();this.resultStore.role=scenarioChanged(this.scenario.current)?'scenario':'base';this.status=scenarioChanged(this.scenario.current)?'Senaryo değişti · Güncel hesap bekleniyor':'Baz model etkin';if(this.network)void this.database.put(`scenario:${this.network.modelHash}`,this.scenario.current).catch(()=>{});this.notify();}
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
  clearModel(){this.cancel();this.source.cancel();this.network=null;this.modelQualityResult=null;this.modelQualityScenarioHash=null;this.modelQualityAnalysisScope=null;this.n1Result=null;this.n1CatalogResult=null;this.n1CatalogIdentity=null;this.selectedN1CandidateId=null;this.selectedN1IslandId=null;this.n1Detail=null;this.selection=null;this.scenario=new ScenarioStore();this.resultStore.clear();this.filters={areaId:'',siteId:'',voltages:allVoltageBands(),search:''};this.status='Model bellekten temizlendi.';this.notify();}
  resetScenario(){this.scenario.reset();this.scenarioUpdated();}
  undoScenario(){this.scenario.undo();this.scenarioUpdated();}
}
