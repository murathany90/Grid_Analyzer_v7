import type {CanonicalNetwork} from '../../domain/model/network';
import type {ScenarioOverlay} from '../../domain/scenario/overlay';
import {effectiveNetwork,scenarioSignature} from '../../domain/scenario/overlay';
import {stableJson} from '../../domain/calculation/identity';
import {defaultAnalysisSettings,type AnalysisSettings} from '../../domain/calculation/analysis-settings';
import {buildN1CandidateCatalog,filterN1CatalogCandidates,type N1CatalogCandidate} from '../../domain/n1/catalog';
import {selectFaultTerminals} from '../../domain/benchmark/study-scope';
import {buildTopology} from '../../topology/electrical-topology';
import {runHybridN1,type HybridResult,type HybridOptions} from '../contingency-hybrid';
import {calculateThreePhase,scSourceContextHash,type ScResult,type ScFaultResult} from '../short-circuit';
import {engineeringScProfile,SC_ENGINEERING_ASSUMPTIONS} from '../short-circuit/engineering-profile';
import type {ScSourceContext} from '../short-circuit/source-adapter';
import type {ResultQuality} from '../../domain/results/quality';
export type YtmStudyProfile='FAST'|'BALANCED'|'DETAILED'|'STRICT';
export const YTM_STAGES=['MODEL_PREPARATION','CATALOG','DC_SCREEN','AC_APPROX','AC_FULL','SC_SOURCE_PREP','SC_FACTORIZATION','SC_BATCH','REPORT'] as const;
export type YtmStage=typeof YTM_STAGES[number];
export interface YtmStudyOptions {ytmId:string;profile?:YtmStudyProfile;timeBudgetMs?:number;voltageMinPu?:number;voltageMaxPu?:number;loadingLimitPercent?:number;voltageBands?:number[];analysisSettings?:AnalysisSettings}
export interface YtmStudyResult {
 schemaVersion:1;identity:{modelHash:string;scenarioHash:string;optionsHash:string;sourceHashMAX?:string;sourceHashMIN?:string};options:YtmStudyOptions;status:'RUNNING'|'COMPLETE'|'BUDGET_EXHAUSTED'|'CANCELLED'|'FAILED';
 catalog:N1CatalogCandidate[];n1:HybridResult|null;scMax:ScResult|null;scMin:ScResult|null;faultTargets:string[];electricalTargets:number;
 stageMs:Record<YtmStage,number>;elapsedMs:number;qualityCounts:Record<ResultQuality,number>;assumptions:typeof SC_ENGINEERING_ASSUMPTIONS;messages:string[];
 pendingCounts?:{N1:number;SC_MAX:number;SC_MIN:number};
}
export interface YtmCallbacks {resume?:YtmStudyResult;signal?:AbortSignal;onProgress?:(stage:string,detail?:Record<string,unknown>)=>void;onCheckpoint?:(result:YtmStudyResult)=>void;hybrid?:Pick<HybridOptions,'solveBase'|'solveOutage'|'screen'|'onCaseDetail'>}
const emptyQualities=():Record<ResultQuality,number>=>({REFERENCE_VALIDATED:0,NATIVE_COMPUTED:0,ENGINEERING_APPROX:0,DC_SCREEN_ONLY:0,NOT_COMPUTABLE:0,REFERENCE_ONLY:0});
export function ytmStudyIsCurrent(r:YtmStudyResult,n:CanonicalNetwork,s:ScenarioOverlay,settings?:AnalysisSettings){return r.identity.modelHash===n.modelHash&&r.identity.scenarioHash===scenarioSignature(s)&&(!settings||!r.options.analysisSettings||stableJson(settings)===stableJson(r.options.analysisSettings));}
export function finishYtmStudy(r:YtmStudyResult,status:YtmStudyResult['status']=r.status){
 r.status=status;const q=emptyQualities(),pending={N1:0,SC_MAX:0,SC_MIN:0};for(const c of r.n1?.cases??[])if(c.quality)q[c.quality]++;else pending.N1++;if(!r.n1)pending.N1+=r.catalog.length;
 for(const [key,sc] of [['SC_MAX',r.scMax],['SC_MIN',r.scMin]] as const){for(const f of sc?.faults??[])if(f.quality)q[f.quality]++;else pending[key]++;if(!sc)pending[key]+=r.faultTargets.length;}
 r.qualityCounts=q;r.pendingCounts=pending;return r;
}
/** REPORT includes result marshalling/checkpoints and unassigned orchestration time. */
export function reconcileYtmTimings(r:YtmStudyResult){r.stageMs.REPORT=Math.max(r.stageMs.REPORT,r.elapsedMs-YTM_STAGES.filter(s=>s!=='REPORT').reduce((sum,s)=>sum+r.stageMs[s],0));}
const absentFault=(fid:string,reason:string):ScFaultResult=>({physicalTerminalFid:fid,electricalBusId:null,physicalTerminalFids:[],nominalKv:null,componentId:null,status:'BLOCKED',quality:'NOT_COMPUTABLE',reasons:[reason],zkkOhm:null,ikssKa:null,skssMva:null,ipKa:null,ibKa:null,ithKa:null,residual:null});
/** Full source graph, scoped targets; one RHS per electrical bus, all physical aliases retained. */
export async function runYtmStudy(network:CanonicalNetwork,scenario:ScenarioOverlay,contexts:{MAX:ScSourceContext;MIN:ScSourceContext},input:YtmStudyOptions,callbacks:YtmCallbacks={}):Promise<YtmStudyResult>{
 const start=performance.now(),options={profile:'BALANCED' as YtmStudyProfile,timeBudgetMs:178000,...input};
 if(!network.sites.some(s=>s.areaId===options.ytmId)||!['FAST','BALANCED','DETAILED','STRICT'].includes(options.profile)||!Number.isFinite(options.timeBudgetMs)||options.timeBudgetMs<=0||options.timeBudgetMs>180000)throw Error('INVALID_YTM_STUDY_OPTIONS');
 const r:YtmStudyResult={schemaVersion:1,identity:{modelHash:network.modelHash,scenarioHash:scenarioSignature(scenario),optionsHash:stableJson(options)},options,status:'RUNNING',catalog:[],n1:null,scMax:null,scMin:null,faultTargets:[],electricalTargets:0,stageMs:Object.fromEntries(YTM_STAGES.map(s=>[s,0])) as Record<YtmStage,number>,elapsedMs:0,qualityCounts:emptyQualities(),assumptions:options.profile==='STRICT'?[]:SC_ENGINEERING_ASSUMPTIONS,messages:['No PF result used as a calculation input. MAX/MIN engineering scenarios are not certified extrema.']};
 r.identity.optionsHash=stableJson({...options,timeBudgetMs:undefined});r.identity.sourceHashMAX=scSourceContextHash(contexts.MAX);r.identity.sourceHashMIN=scSourceContextHash(contexts.MIN);
 if(callbacks.resume){if(stableJson(r.identity)!==stableJson(callbacks.resume.identity))throw Error('YTM_STALE_RESUME');r.n1=callbacks.resume.n1;r.scMax=callbacks.resume.scMax;r.scMin=callbacks.resume.scMin;r.messages.push('Resumed: completed DC and SC modes retained; unfinished modes evaluated again. Timings describe this attempt.');}
 const remaining=()=>Math.max(0,options.timeBudgetMs-(performance.now()-start)),checkpoint=()=>{r.elapsedMs=performance.now()-start;finishYtmStudy(r);callbacks.onCheckpoint?.(r);};
 const stage=async<T>(name:YtmStage,fn:()=>T|Promise<T>)=>{callbacks.onProgress?.(name,{message:name});const t=performance.now();try{return await fn();}finally{r.stageMs[name]+=performance.now()-t;checkpoint();await new Promise<void>(resolve=>setTimeout(resolve,0));}};
 const active=effectiveNetwork(network,scenario),topology=await stage('MODEL_PREPARATION',()=>buildTopology(active));
 r.catalog=await stage('CATALOG',()=>filterN1CatalogCandidates(buildN1CandidateCatalog(network,scenario,{includeAllVoltages:true}).candidates,{ytmIds:[options.ytmId],endpointScope:'BOTH',voltageBands:options.voltageBands}));
 r.faultTargets=selectFaultTerminals(active,{ytmIds:[options.ytmId],voltageBands:options.voltageBands});
 const aliases=new Map<number,string[]>(),unmapped:string[]=[];
 for(const fid of r.faultTargets){const b=topology.terminalToBus.get(fid);if(b===undefined)unmapped.push(fid);else{const ids=aliases.get(b)??[];ids.push(fid);aliases.set(b,ids);}}
 const targets=[...aliases.values()].map(ids=>ids[0]);r.electricalTargets=targets.length;checkpoint();
 const settings=structuredClone(options.analysisSettings??defaultAnalysisSettings()),strict=options.profile==='STRICT';
 const hybridOptions:HybridOptions={...callbacks.hybrid,preferDirectAcSample:true,allowSuppliedIslandResults:!strict,preserveDcOnAcFailure:!strict,analysisSettings:settings,studyProfile:strict?'CURRENT_SETTINGS':'NATIVE_PARTIAL_CONTROLS',filter:{ytmIds:[options.ytmId],endpointScope:'BOTH',voltageBands:options.voltageBands},policy:{acBudgetCases:0,globalTimeLimitMs:Math.max(1,remaining()),operationalLoadingLimitPercent:options.loadingLimitPercent??100,voltageMinPu:options.voltageMinPu??.9,voltageMaxPu:options.voltageMaxPu??1.1,limitsProvenance:'EDITABLE_USER_ENGINEERING_LIMITS; NOT_TEIAS_APPROVED'},signal:callbacks.signal,onProgress:callbacks.onProgress};
 if(!r.n1?.cases.length)r.n1=await stage('DC_SCREEN',()=>runHybridN1(network,scenario,{...hybridOptions,screenOnly:true}));
 for(const mode of ['MAX','MIN'] as const){
  const old=mode==='MAX'?r.scMax:r.scMin;if(old&&old.faults.length===r.faultTargets.length&&old.faults.every(f=>f.status!=='CANCELLED'))continue;
  if(callbacks.signal?.aborted||remaining()<1)break;
  const sc=await stage('SC_BATCH',()=>calculateThreePhase(network,scenario,contexts[mode],targets,engineeringScProfile(mode,strict?'IEC_REFERENCE_VERIFIED':'ENGINEERING_EXTENDED',Math.max(1,Math.min(remaining(),60000))),{signal:callbacks.signal,onProgress:callbacks.onProgress}));
  r.stageMs.SC_FACTORIZATION+=sc.timings?.factorizationMs??0;r.stageMs.SC_SOURCE_PREP+=sc.timings?.sourcePreparationMs??0;r.stageMs.SC_BATCH-=Math.min(r.stageMs.SC_BATCH,(sc.timings?.factorizationMs??0)+(sc.timings?.sourcePreparationMs??0));
  const byBus=new Map(sc.faults.map(f=>[f.electricalBusId,f]));
  sc.faults=r.faultTargets.map(fid=>{const index=topology.terminalToBus.get(fid),f=index===undefined?undefined:byBus.get(topology.buses[index].id);return f?{...f,physicalTerminalFid:fid}:absentFault(fid,'NO_ACTIVE_ELECTRICAL_BUS');});
  sc.counts={};for(const f of sc.faults)sc.counts[f.status]=(sc.counts[f.status]??0)+1;
  if(mode==='MAX')r.scMax=sc;else r.scMin=sc;checkpoint();
 }
 // Full NR with real Q limits first. Detailed can spend more of the common budget.
 if(options.profile!=='FAST'&&!callbacks.signal?.aborted&&remaining()>100){
  const dc=r.n1,oldScreen=hybridOptions.screen;
  hybridOptions.screen=oldScreen??undefined;
  const previousN1=callbacks.resume?.n1,resume=previousN1?.studyProfile===hybridOptions.studyProfile?previousN1??undefined:undefined;
  await stage('AC_FULL',async()=>{r.n1=await runHybridN1(network,scenario,{...hybridOptions,resume,policy:{...hybridOptions.policy,acBudgetCases:options.profile==='DETAILED'?12:3,perCaseTimeLimitMs:Math.max(1,Math.min(remaining(),20000)),globalTimeLimitMs:Math.max(1,remaining())},onCheckpoint:n1=>{if(n1.cases.length===r.catalog.length){r.n1=n1;checkpoint();}}});});
  // Keep the numerical DC ledger even when advanced controls cannot be solved.
  if(!r.n1?.cases.length)r.n1=dc;
  if(!strict&&remaining()>500&&r.n1?.base?.controlEvidence?.numericalSolved!==true){
   const approx=structuredClone(settings);approx.powerFlow={...approx.powerFlow,profile:'CUSTOM',stationControlMode:'off'};
   await stage('AC_APPROX',async()=>{const result=await runHybridN1(network,scenario,{...hybridOptions,analysisSettings:approx,studyProfile:'GA_APPROX_STATION_OFF',policy:{...hybridOptions.policy,acBudgetCases:2,globalTimeLimitMs:Math.max(1,remaining()),perCaseTimeLimitMs:Math.max(1,Math.min(remaining(),15000))}});if(result.cases.some(c=>c.acSolved))r.n1=result;});
  }
 }
 await stage('REPORT',()=>{if(!r.scMax||!r.scMin)r.messages.push('SC mode unfinished: time budget or cancellation; no zero currents substituted.');r.status=callbacks.signal?.aborted?'CANCELLED':remaining()<=0?'BUDGET_EXHAUSTED':'COMPLETE';});checkpoint();reconcileYtmTimings(r);return r;
}
