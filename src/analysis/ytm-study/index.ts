import {n1CaseCounts} from '../contingency-hybrid/case-summary';
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
export type StudyFamily='N1'|'SC';
export const studyFamilies=(o:YtmStudyOptions):StudyFamily[]=>o.families??['N1','SC'];
export const studyScModes=(o:YtmStudyOptions):('MAX'|'MIN')[]=>o.scModes??['MAX','MIN'];
export const studyScopeKey=(o:YtmStudyOptions)=>stableJson({...o,families:undefined,scModes:undefined,timeBudgetMs:undefined,analysisSettings:undefined,profile:o.profile??'BALANCED'});
export interface YtmStudyOptions {ytmId:string;tmId?:string;families?:StudyFamily[];scModes?:('MAX'|'MIN')[];profile?:YtmStudyProfile;timeBudgetMs?:number;voltageMinPu?:number;voltageMaxPu?:number;loadingLimitPercent?:number;voltageBands?:number[];analysisSettings?:AnalysisSettings}
export interface YtmStudyResult {
 schemaVersion:1;identity:{studyCase?:string;modelHash:string;scenarioHash:string;optionsHash:string;sourceHashMAX?:string;sourceHashMIN?:string};options:YtmStudyOptions;status:'RUNNING'|'COMPLETE'|'BUDGET_EXHAUSTED'|'CANCELLED'|'FAILED';
 catalog:N1CatalogCandidate[];n1:HybridResult|null;scMax:ScResult|null;scMin:ScResult|null;sc1LgMax?:ScResult|null;sc1LgMin?:ScResult|null;faultTargets:string[];electricalTargets:number;
 stageMs:Record<YtmStage,number>;elapsedMs:number;qualityCounts:Record<ResultQuality,number>;assumptions:typeof SC_ENGINEERING_ASSUMPTIONS;messages:string[];
 pendingCounts?:{N1:number;SC_MAX:number;SC_MIN:number;SC1_MAX?:number;SC1_MIN?:number};
}
export interface YtmCallbacks {resume?:YtmStudyResult;signal?:AbortSignal;onProgress?:(stage:string,detail?:Record<string,unknown>)=>void;onCheckpoint?:(result:YtmStudyResult)=>void;hybrid?:Pick<HybridOptions,'solveBase'|'solveOutage'|'screen'|'onCaseDetail'>}
const emptyQualities=():Record<ResultQuality,number>=>({REFERENCE_VALIDATED:0,NATIVE_COMPUTED:0,ENGINEERING_APPROX:0,DC_SCREEN_ONLY:0,NOT_COMPUTABLE:0,REFERENCE_ONLY:0});
export function ytmStudyIsCurrent(r:YtmStudyResult,n:CanonicalNetwork,s:ScenarioOverlay,settings?:AnalysisSettings,options?:YtmStudyOptions){return (!r.identity.studyCase||r.identity.studyCase===n.studyCase)&&(!options||studyScopeKey(options)===studyScopeKey(r.options))&& r.identity.modelHash===n.modelHash&&r.identity.scenarioHash===scenarioSignature(s)&&(!settings||!r.options.analysisSettings||stableJson(settings)===stableJson(r.options.analysisSettings));}
export function finishYtmStudy(r:YtmStudyResult,status:YtmStudyResult['status']=r.status){
 r.status=status;const q=emptyQualities(),pending={N1:0,SC_MAX:0,SC_MIN:0,SC1_MAX:0,SC1_MIN:0};for(const c of r.n1?.cases??[])if(c.quality)q[c.quality]++;else pending.N1++;if(!r.n1&&studyFamilies(r.options).includes('N1'))pending.N1+=r.catalog.length;
 const scFamilies=studyFamilies(r.options).includes('SC'),scModes=studyScModes(r.options);
 for(const [key,sc,mode] of [['SC_MAX',r.scMax,'MAX'],['SC_MIN',r.scMin,'MIN']] as const){
  if(sc){
   const seen=new Set<string>();
   for(const f of sc.faults){
    if(f.physicalTerminalFid)seen.add(f.physicalTerminalFid);
    if(Array.isArray(f.physicalTerminalFids))for(const id of f.physicalTerminalFids)seen.add(id);
    if(f.status==='CANCELLED')pending[key]++;else if(f.quality)q[f.quality]++;else pending[key]++;
   }
   if(scFamilies&&scModes.includes(mode)){
    const missing=r.faultTargets.filter(t=>!seen.has(t)).length;
    pending[key]+=missing;
   }
  }else if(scFamilies&&scModes.includes(mode)){pending[key]+=r.faultTargets.length;}
 }
 for(const [key,sc1,mode] of [['SC1_MAX',r.sc1LgMax,'MAX'],['SC1_MIN',r.sc1LgMin,'MIN']] as const){
  if(sc1){
   const seen=new Set<string>();
   for(const f of sc1.faults){
    if(f.physicalTerminalFid)seen.add(f.physicalTerminalFid);
    if(Array.isArray(f.physicalTerminalFids))for(const id of f.physicalTerminalFids)seen.add(id);
    if(f.status==='CANCELLED')pending[key]++;else if(f.quality)q[f.quality]++;else pending[key]++;
   }
   if(scFamilies&&scModes.includes(mode)){
    const missing=r.faultTargets.filter(t=>!seen.has(t)).length;
    pending[key]+=missing;
   }
  }else if(scFamilies&&scModes.includes(mode)){pending[key]+=r.faultTargets.length;}
 }
 const hasPending=(studyFamilies(r.options).includes('N1')&&pending.N1>0)||(scFamilies&&scModes.some(m=>m==='MAX'?(pending.SC_MAX>0||pending.SC1_MAX>0):(pending.SC_MIN>0||pending.SC1_MIN>0)));
 if(r.status==='COMPLETE'&&hasPending)r.status='BUDGET_EXHAUSTED';
 r.qualityCounts=q;r.pendingCounts=pending;return r;
}
/** REPORT includes result marshalling/checkpoints and unassigned orchestration time. */
export function reconcileYtmTimings(r:YtmStudyResult){r.stageMs.REPORT=Math.max(r.stageMs.REPORT,r.elapsedMs-YTM_STAGES.filter(s=>s!=='REPORT').reduce((sum,s)=>sum+r.stageMs[s],0));}
/** One workspace record; independent family runs retain only compatible results. */
export function retainStudyFamilies(r:YtmStudyResult,old:YtmStudyResult|null){
 if(!old||old.identity.studyCase!==r.identity.studyCase||old.identity.modelHash!==r.identity.modelHash||old.identity.scenarioHash!==r.identity.scenarioHash||studyScopeKey(old.options)!==studyScopeKey(r.options)||stableJson(old.options.analysisSettings)!==stableJson(r.options.analysisSettings))return r;
 const families=studyFamilies(r.options);if(!families.includes('N1')){r.n1=old.n1;r.catalog=old.catalog;}if(!families.includes('SC')){r.faultTargets=old.faultTargets;r.electricalTargets=old.electricalTargets;}
 if(families.includes('N1')&&r.n1&&old.n1&&r.n1.identity.settingsHash===old.n1.identity.settingsHash&&r.n1.studyProfile===old.n1.studyProfile){
  const previousStatuses=r.n1.cases.map(c=>c.status),prior=new Map(old.n1.cases.filter(c=>c.acSolved).map(c=>[c.candidateId,c]));
  r.n1.cases=r.n1.cases.map(c=>{const p=prior.get(c.candidateId);return p&&!c.acSolved&&['NOT_RUN_BUDGET','NOT_EVALUATED_BUDGET','CANCELLED','DC_SCREEN_ONLY','DC_CLEAR_NOT_AC_VERIFIED','DC_UNSCREENABLE','TOPOLOGY_ISLANDING'].includes(c.status)?{...p,retainedFromPrior:true,acAttempted:c.acAttempted,reason:'RETAINED_SAME_CONTEXT_NUMERICAL_CASE; '+c.reason+'; '+p.reason}:c;});
  if(r.n1.cases.some(c=>c.retainedFromPrior)&&!r.n1.basePost&&old.n1.basePost){r.n1.basePost=old.n1.basePost;r.n1.retainedBasePost=true;}
  const cases=r.n1.cases,counts=r.n1.counts,outcomes=n1CaseCounts(cases);Object.assign(counts,{AC_SUCCESSFUL:outcomes.success,AC_SKIPPED:outcomes.skipped,UNKNOWN:cases.filter(c=>c.unknownRatings>0||['PARTIAL_SOLUTION','BLOCKED','ISLAND_UNSUPPLIED'].includes(c.status)).length});
  for(const status of new Set([...previousStatuses,...old.n1.cases.map(c=>c.status),...cases.map(c=>c.status)]))counts[status]=cases.filter(c=>c.status===status).length;
  Object.assign(counts,{AC_RETAINED:cases.filter(c=>c.retainedFromPrior).length,AC_CALCULATED_THIS_ATTEMPT:cases.filter(c=>c.acSolved&&!c.retainedFromPrior).length,AC_CALCULATED:cases.filter(c=>c.acSolved).length,AC_NUMERICALLY_SOLVED:cases.filter(c=>c.controlEvidence?.numericalSolved).length,N1_NUMERICALLY_COMPUTABLE:cases.filter(c=>c.dcResult||c.acSolved).length,AC_DIRECT_OUTSIDE_DC:cases.filter(c=>c.acSolved&&!c.dcResult).length,AC_PARTIAL:cases.filter(c=>c.status==='PARTIAL_SOLUTION').length,AC_VERIFIED:cases.filter(c=>r.n1!.base?.fidelity==='CONTROL_VERIFIED'&&c.acSolved&&c.controlEvidence?.fidelity==='CONTROL_VERIFIED'&&['AC_CONVERGED_WITHIN_LIMIT','AC_CONVERGED_VIOLATION'].includes(c.status)).length,NOT_RUN:cases.filter(c=>['NOT_RUN_BUDGET','NOT_EVALUATED_BUDGET','CANCELLED'].includes(c.status)).length});
  counts.AC_UNVERIFIED=Math.max(0,r.n1.catalogCount-counts.AC_VERIFIED);counts.uniqueViolatedElements=new Set(cases.flatMap(c=>c.violationKeys??[])).size;
  for(const key of new Set([...cases,...old.n1.cases].flatMap(c=>Object.keys(c.constraintCounts??{}))))counts[key]=cases.reduce((sum,c)=>sum+(c.constraintCounts?.[key]??0),0);
 }
 const anchorSafe=!families.includes('SC')||(!r.scMax||!old.scMin||!!old.scMax)&&(!r.scMin||!old.scMax||!!old.scMin);
  const sameSources=anchorSafe&&(!r.scMax||!old.scMax||r.scMax.identity.sourceHash===old.scMax.identity.sourceHash)&&(!r.scMin||!old.scMin||r.scMin.identity.sourceHash===old.scMin.identity.sourceHash);
  if(sameSources){
    if(!families.includes('SC')||!studyScModes(r.options).includes('MAX')){r.scMax=old.scMax;r.sc1LgMax=old.sc1LgMax;}
    if(!families.includes('SC')||!studyScModes(r.options).includes('MIN')){r.scMin=old.scMin;r.sc1LgMin=old.sc1LgMin;}
  }
  return finishYtmStudy(r);
}
const absentFault=(fid:string,reason:string):ScFaultResult=>({physicalTerminalFid:fid,electricalBusId:null,physicalTerminalFids:[],nominalKv:null,componentId:null,status:'BLOCKED',quality:'NOT_COMPUTABLE',reasons:[reason],zkkOhm:null,ikssKa:null,skssMva:null,ipKa:null,ibKa:null,ithKa:null,residual:null});
/** Full source graph, scoped targets; one RHS per electrical bus, all physical aliases retained. */
export async function runYtmStudy(network:CanonicalNetwork,scenario:ScenarioOverlay,contexts:Partial<Record<'MAX'|'MIN',ScSourceContext>>,input:YtmStudyOptions,callbacks:YtmCallbacks={}):Promise<YtmStudyResult>{
 const start=performance.now(),options={profile:'BALANCED' as YtmStudyProfile,timeBudgetMs:178000,...input};
 if(!network.sites.some(s=>s.areaId===options.ytmId)||!['FAST','BALANCED','DETAILED','STRICT'].includes(options.profile)||!Number.isFinite(options.timeBudgetMs)||options.timeBudgetMs<=0||options.timeBudgetMs>180000)throw Error('INVALID_YTM_STUDY_OPTIONS');
 const families=studyFamilies(options),modes=studyScModes(options),n1=families.includes('N1'),scFamily=families.includes('SC');
 if(!families.length||new Set(families).size!==families.length||families.some(f=>!['N1','SC'].includes(f))||!modes.length||new Set(modes).size!==modes.length||modes.some(m=>!['MAX','MIN'].includes(m))||options.tmId&&!network.sites.some(s=>s.id===options.tmId&&s.areaId===options.ytmId))throw Error('INVALID_YTM_FAMILY_OR_SCOPE');
 if(scFamily&&modes.some(m=>!contexts[m]))throw Error('SC_CONTEXT_REQUIRED');
 const r:YtmStudyResult={schemaVersion:1,identity:{studyCase:network.studyCase,modelHash:network.modelHash,scenarioHash:scenarioSignature(scenario),optionsHash:stableJson(options)},options,status:'RUNNING',catalog:[],n1:null,scMax:null,scMin:null,faultTargets:[],electricalTargets:0,stageMs:Object.fromEntries(YTM_STAGES.map(s=>[s,0])) as Record<YtmStage,number>,elapsedMs:0,qualityCounts:emptyQualities(),assumptions:!scFamily||options.profile==='STRICT'?[]:options.profile==='FAST'?SC_ENGINEERING_ASSUMPTIONS.filter(a=>['FAULT_VOLTAGE','SOURCE_OMISSION'].includes(a.id)):SC_ENGINEERING_ASSUMPTIONS,messages:['No PF result used as a calculation input. MAX/MIN engineering scenarios are not certified extrema.']};
 r.identity.optionsHash=stableJson({...options,timeBudgetMs:undefined});if(scFamily)for(const mode of modes){const hash=scSourceContextHash(contexts[mode]!);if(mode==='MAX')r.identity.sourceHashMAX=hash;else r.identity.sourceHashMIN=hash;}
 if(callbacks.resume){if(stableJson(r.identity)!==stableJson(callbacks.resume.identity))throw Error('YTM_STALE_RESUME');r.n1=callbacks.resume.n1;r.scMax=callbacks.resume.scMax;r.scMin=callbacks.resume.scMin;r.sc1LgMax=callbacks.resume.sc1LgMax;r.sc1LgMin=callbacks.resume.sc1LgMin;r.messages.push('Resumed: completed DC and SC modes retained; unfinished modes evaluated again. Timings describe this attempt.');}
 const remaining=()=>Math.max(0,options.timeBudgetMs-(performance.now()-start)),checkpoint=()=>{r.elapsedMs=performance.now()-start;finishYtmStudy(r);callbacks.onCheckpoint?.(r);};
 const stage=async<T>(name:YtmStage,fn:()=>T|Promise<T>)=>{callbacks.onProgress?.(name,{message:name});const t=performance.now();try{return await fn();}finally{r.stageMs[name]+=performance.now()-t;checkpoint();await new Promise<void>(resolve=>setTimeout(resolve,0));}};
 const active=effectiveNetwork(network,scenario),topology=await stage('MODEL_PREPARATION',()=>buildTopology(active));
 if(n1)r.catalog=await stage('CATALOG',()=>filterN1CatalogCandidates(buildN1CandidateCatalog(network,scenario,{includeAllVoltages:true}).candidates,{ytmIds:[options.ytmId],tmId:options.tmId,endpointScope:'BOTH',voltageBands:options.voltageBands}));
 if(scFamily)r.faultTargets=selectFaultTerminals(active,{ytmIds:[options.ytmId],tmId:options.tmId,voltageBands:options.voltageBands});
 const aliases=new Map<number,string[]>(),unmapped:string[]=[];
 for(const fid of r.faultTargets){const b=topology.terminalToBus.get(fid);if(b===undefined)unmapped.push(fid);else{const ids=aliases.get(b)??[];ids.push(fid);aliases.set(b,ids);}}
 const targets=[...aliases.values()].map(ids=>ids[0]);r.electricalTargets=targets.length;checkpoint();
 const settings=structuredClone(options.analysisSettings??defaultAnalysisSettings()),strict=options.profile==='STRICT';
 const hybridOptions:HybridOptions={...callbacks.hybrid,preferDirectAcSample:true,allowSuppliedIslandResults:!strict,preserveDcOnAcFailure:!strict,analysisSettings:settings,studyProfile:strict?'CURRENT_SETTINGS':'NATIVE_PARTIAL_CONTROLS',filter:{ytmIds:[options.ytmId],tmId:options.tmId,endpointScope:'BOTH',voltageBands:options.voltageBands},policy:{acBudgetCases:0,globalTimeLimitMs:Math.max(1,remaining()),operationalLoadingLimitPercent:options.loadingLimitPercent??100,voltageMinPu:options.voltageMinPu??.9,voltageMaxPu:options.voltageMaxPu??1.1,limitsProvenance:'EDITABLE_USER_ENGINEERING_LIMITS; NOT_TEIAS_APPROVED'},signal:callbacks.signal,onProgress:callbacks.onProgress};
 if(n1&&!r.n1?.cases.length)r.n1=await stage('DC_SCREEN',()=>runHybridN1(network,scenario,{...hybridOptions,screenOnly:true}));
 for(const mode of scFamily?modes:[]){
  const old3F=mode==='MAX'?r.scMax:r.scMin;
  const need3F=!old3F||old3F.faults.length<r.faultTargets.length||old3F.faults.some(f=>f.status==='CANCELLED');
  if(need3F){
   if(callbacks.signal?.aborted||remaining()<1)break;
   const sc=await stage('SC_BATCH',()=>calculateThreePhase(network,scenario,contexts[mode]!,targets,engineeringScProfile(mode,strict?'IEC_REFERENCE_VERIFIED':'ENGINEERING_EXTENDED',Math.max(1,Math.min(remaining(),60000))),{signal:callbacks.signal,onProgress:callbacks.onProgress}));
   r.stageMs.SC_FACTORIZATION+=sc.timings?.factorizationMs??0;r.stageMs.SC_SOURCE_PREP+=sc.timings?.sourcePreparationMs??0;r.stageMs.SC_BATCH-=Math.min(r.stageMs.SC_BATCH,(sc.timings?.factorizationMs??0)+(sc.timings?.sourcePreparationMs??0));
   const byBus=new Map(sc.faults.map(f=>[f.electricalBusId,f]));
   sc.faults=r.faultTargets.map(fid=>{const index=topology.terminalToBus.get(fid),f=index===undefined?undefined:byBus.get(topology.buses[index].id);return f?{...f,physicalTerminalFid:fid}:absentFault(fid,'NO_ACTIVE_ELECTRICAL_BUS');});
   sc.workspaceScope={ytmId:options.ytmId,optionsKey:studyScopeKey(options),settingsHash:stableJson(settings)};
   sc.counts={};for(const f of sc.faults)sc.counts[f.status]=(sc.counts[f.status]??0)+1;
   if(mode==='MAX')r.scMax=sc;else r.scMin=sc;checkpoint();
  }
  const old1F=mode==='MAX'?r.sc1LgMax:r.sc1LgMin;
  const need1F=!old1F||old1F.faults.length<r.faultTargets.length||old1F.faults.some(f=>f.status==='CANCELLED');
  if(need1F){
   if(callbacks.signal?.aborted||remaining()<1)break;
   const p1Lg:import('../short-circuit').ScProfile={...engineeringScProfile(mode,strict?'IEC_REFERENCE_VERIFIED':'ENGINEERING_EXTENDED',Math.max(1,Math.min(remaining(),60000))),faultType:'1LG'};
   const sc1=await stage('SC_BATCH',()=>calculateThreePhase(network,scenario,contexts[mode]!,targets,p1Lg,{signal:callbacks.signal,onProgress:callbacks.onProgress}));
   const byBus1=new Map(sc1.faults.map(f=>[f.electricalBusId,f]));
   sc1.faults=r.faultTargets.map(fid=>{const index=topology.terminalToBus.get(fid),f=index===undefined?undefined:byBus1.get(topology.buses[index].id);return f?{...f,physicalTerminalFid:fid}:absentFault(fid,'NO_ACTIVE_ELECTRICAL_BUS');});
   sc1.workspaceScope={ytmId:options.ytmId,optionsKey:studyScopeKey(options),settingsHash:stableJson(settings)};
   sc1.counts={};for(const f of sc1.faults)sc1.counts[f.status]=(sc1.counts[f.status]??0)+1;
   if(mode==='MAX')r.sc1LgMax=sc1;else r.sc1LgMin=sc1;checkpoint();
  }
 }
 // Full NR with real Q limits first. Detailed can spend more of the common budget.
 if(n1&&options.profile!=='FAST'&&!callbacks.signal?.aborted&&remaining()>100){
  const dc=r.n1,oldScreen=hybridOptions.screen;
  hybridOptions.screen=oldScreen??undefined;
  const previousN1=callbacks.resume?.n1,resume=previousN1?.studyProfile===hybridOptions.studyProfile?previousN1??undefined:undefined;
  await stage('AC_FULL',async()=>{r.n1=await runHybridN1(network,scenario,{...hybridOptions,resume,adaptiveAcTimeBudget:!strict,policy:{...hybridOptions.policy,acBudgetCases:strict?3:100,perCaseTimeLimitMs:Math.max(1,Math.min(remaining(),20000)),globalTimeLimitMs:Math.max(1,remaining()-1500)},onCheckpoint:n1=>{if(n1.cases.length===r.catalog.length){r.n1=n1;checkpoint();}}});});
  // Keep the numerical DC ledger even when advanced controls cannot be solved.
  if(n1&&!r.n1?.cases.length)r.n1=dc;
  if(!strict&&remaining()>500&&r.n1?.base?.controlEvidence?.numericalSolved!==true){
   const approx=structuredClone(settings);approx.powerFlow={...approx.powerFlow,profile:'CUSTOM',stationControlMode:'off'};
   await stage('AC_APPROX',async()=>{const result=await runHybridN1(network,scenario,{...hybridOptions,analysisSettings:approx,studyProfile:'GA_APPROX_STATION_OFF',policy:{...hybridOptions.policy,acBudgetCases:2,globalTimeLimitMs:Math.max(1,remaining()),perCaseTimeLimitMs:Math.max(1,Math.min(remaining(),15000))}});if(result.cases.some(c=>c.acSolved))r.n1=result;});
  }
 }
 await stage('REPORT',()=>{
  const scUnfinished=scFamily&&modes.some(m=>{
   const sc=m==='MAX'?r.scMax:r.scMin,sc1=m==='MAX'?r.sc1LgMax:r.sc1LgMin;
    if(!sc||!sc1)return true;
    const currentSc=sc,currentSc1=sc1;
    const seenSc=new Set<string>(),seenSc1=new Set<string>();
    for(const f of currentSc.faults){if(f.physicalTerminalFid)seenSc.add(f.physicalTerminalFid);if(Array.isArray(f.physicalTerminalFids))for(const id of f.physicalTerminalFids)seenSc.add(id);}
    for(const f of currentSc1.faults){if(f.physicalTerminalFid)seenSc1.add(f.physicalTerminalFid);if(Array.isArray(f.physicalTerminalFids))for(const id of f.physicalTerminalFids)seenSc1.add(id);}
    return r.faultTargets.some(t=>!seenSc.has(t))||r.faultTargets.some(t=>!seenSc1.has(t))||currentSc.faults.some(f=>f.status==='CANCELLED')||currentSc1.faults.some(f=>f.status==='CANCELLED');
  });
  if(scUnfinished)r.messages.push('SC mode unfinished: time budget or cancellation; no zero currents substituted.');
  r.status=callbacks.signal?.aborted?'CANCELLED':(remaining()<=0||scUnfinished)?'BUDGET_EXHAUSTED':'COMPLETE';
 });checkpoint();reconcileYtmTimings(r);return r;
}
