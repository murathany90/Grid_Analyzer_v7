import type {CanonicalNetwork} from '../../domain/model/network';
import type {ScenarioOverlay} from '../../domain/scenario/overlay';
import {effectiveNetwork,scenarioSignature} from '../../domain/scenario/overlay';
import {identity,stableJson} from '../../domain/calculation/identity';
import {comparePostConstraints,constraintCounts,type ConstraintChange} from './constraints';
import {hybridStudyIsCurrent,type HybridStudyProfile} from './profile';
import {lfSnapshotIsCurrent} from '../../domain/benchmark/post-result-source';
import type {AnalysisSettings} from '../../domain/calculation/analysis-settings';
import type {CalculationResult} from '../../domain/results/types';
import {buildN1CandidateCatalog,filterN1CatalogCandidates,type N1CatalogFilter} from '../../domain/n1/catalog';
import {runN1Screen,type N1ScreenCandidate,type N1ScreenOptions,type N1ScreenResult} from '../../domain/n1';
import {BrowserJsPowerFlowEngine} from '../api/browser-js-engine';
import {prepareModel} from '../power-flow/preparation';
import {validateAcOutages,type AcOutage,type AcContingency} from '../contingency-ac';
import type {CapacitySeason} from '../../domain/model/capacity';
import {postResultAssembler,postBranchMetric,type PostMapResults} from '../contingency-ac/post-results';

export interface HybridPolicy {
  operationalLoadingLimitPercent:number;voltageMinPu:number;voltageMaxPu:number;dcPromotionLoadingPercent:number;
  includeDCViolation:boolean;includeCapacityUnavailable:boolean;includeUnscreenable:boolean;classifyIslanding:boolean;includeExplicitUserSelection:boolean;
  acBudgetCases:number;perCaseTimeLimitMs:number;globalTimeLimitMs:number;concurrency:1;
  limitsProvenance:string;promotionProvenance:string;
}
export const DEFAULT_HYBRID_POLICY:HybridPolicy={operationalLoadingLimitPercent:100,voltageMinPu:.9,voltageMaxPu:1.1,dcPromotionLoadingPercent:90,includeDCViolation:true,includeCapacityUnavailable:true,includeUnscreenable:true,classifyIslanding:true,includeExplicitUserSelection:true,acBudgetCases:10,perCaseTimeLimitMs:120000,globalTimeLimitMs:300000,concurrency:1,limitsProvenance:'USER_OPERATIONAL_PROFILE (use PF manifest only when explicitly supplied)',promotionProvenance:'USER_POLICY; NOT_INFERRED_FROM_PF'};
export type HybridStatus='DC_CLEAR_NOT_AC_VERIFIED'|'AC_CONVERGED_WITHIN_LIMIT'|'AC_CONVERGED_VIOLATION'|'AC_DIVERGED'|'ISLAND_UNSUPPLIED'|'PARTIAL_SOLUTION'|'BLOCKED'|'NOT_RUN_BUDGET'|'CANCELLED';
export interface HybridCase {
  outage:AcOutage;candidateId:string;promotionReasons:string[];dcStatus:string;status:HybridStatus;reason:string;
  iterations:number|null;maxMismatchMw:number|null;minVpu:number|null;maxVpu:number|null;maxLoadingPercent:number|null;unknownRatings:number;
  voltageViolations:number;thermalViolations:number;components:AcContingency['components'];elapsedMs:number;
  // Requested extrema observations plus compact map snapshots; full solver diagnostics are not retained.
  mapResults?:PostMapResults;constraintChanges?:ConstraintChange[];constraintCounts?:Record<string,number>;violationKeys?:string[];acSolved?:boolean;
  metadata?:{name:string;voltageKv:number;fromYtmIds:readonly string[];toYtmIds:readonly string[];topology:string};
  unsuppliedLoadMw?:number;constraints?:{sourceClass:string;fid:string;metric:string;value:number;limit:number}[];
  observations:{sourceClass:string;fid:string;metric:string;side?:string;caseId?:string;value:number|null;loading?:import('../contingency-ac/post-results').PostLoading}[];
}
export interface HybridResult {
  method:'GA_DC_TO_FULL_AC';identity:{modelHash:string;scenarioHash:string;settingsHash:string;optionsHash:string};
  policy:HybridPolicy;filter:N1CatalogFilter;season:CapacitySeason;phase:string;status:'COMPLETE'|'PARTIAL'|'BLOCKED'|'CANCELLED';reason:string;
  studyProfile?:HybridStudyProfile;basePost?:PostMapResults;baseConstraintCounts?:Record<string,number>;
  base:{status:string;converged:boolean;iterations:number;maxMismatchMw:number|null;settingsHash?:string;stationControlMode?:string;activeBalancingMode?:string;controlSupport?:unknown;fidelity?:string}|null;catalogCount:number;excludedCatalogCount:number;
  cases:HybridCase[];counts:Record<string,number>;dcDiagnostics:N1ScreenResult['dcDiagnostics']|null;elapsedMs:number;
}
export interface HybridOptions {
  studyProfile?:HybridStudyProfile;maxRetainedCaseDetails?:number;onCaseDetail?:(caseId:string,detail:{post:PostMapResults;changes:ConstraintChange[]})=>void|Promise<void>;
  policy?:Partial<HybridPolicy>;filter?:N1CatalogFilter;season?:CapacitySeason;analysisSettings?:AnalysisSettings;
  selectedCandidateIds?:string[];catalogCandidateIds?:string[];resume?:HybridResult;signal?:AbortSignal;
  solveAllSelected?:boolean;dcClearValidationCases?:number;
  observations?:{sourceClass:string;fid:string;metric:string;side?:string;caseId?:string}[];
  onCheckpoint?:(result:HybridResult)=>void;onProgress?:(stage:string,detail?:Record<string,unknown>)=>void;
  // Browser supplies terminating WorkerTransport calls with hard wall-clock limits.
  solveBase?:(budgetMs:number)=>Promise<CalculationResult>;
  screen?:(options:N1ScreenOptions,budgetMs:number)=>Promise<N1ScreenResult>;
  solveOutage?:(outage:AcOutage,budgetMs:number)=>Promise<AcContingency>;
}
export function parsePfCaseId(caseId:string):AcOutage|null {
  const m=/^N1:(ElmLne|ElmTr2):(.+)$/.exec(caseId);
  return m?{caseId,sourceClass:m[1] as AcOutage['sourceClass'],fid:m[2]}:null;
}
export function promotionReasons(c:N1ScreenCandidate,p:HybridPolicy,explicit=false):string[]{
  const r:string[]=[];
  if(p.includeDCViolation&&c.status==='SCREENED_VIOLATION')r.push('DC_VIOLATION');
  if(c.maxEstimatedLoadingPct!==null&&c.maxEstimatedLoadingPct>=p.dcPromotionLoadingPercent)r.push('DC_PROMOTION_THRESHOLD');
  if(p.includeCapacityUnavailable&&(c.status==='CAPACITY_UNAVAILABLE'||!c.outageRatingAvailable||c.ratingCoverage.percent!==100))r.push('CAPACITY_UNAVAILABLE');
  if(p.includeUnscreenable&&c.status==='UNSCREENABLE')r.push('UNSCREENABLE');
  if(p.classifyIslanding&&c.status==='ISLANDING')r.push('ISLANDING');
  if(p.includeExplicitUserSelection&&explicit)r.push('EXPLICIT_SELECTION');
  return r;
}
const snapshot=(n:CanonicalNetwork,s:ScenarioOverlay,o:HybridOptions,p:HybridPolicy)=>({modelHash:n.modelHash,scenarioHash:scenarioSignature(s),settingsHash:stableJson(o.analysisSettings??{}),optionsHash:stableJson({policy:{...p,acBudgetCases:undefined,perCaseTimeLimitMs:undefined,globalTimeLimitMs:undefined},filter:o.filter??{},season:o.season??'nominal',catalogCandidateIds:o.catalogCandidateIds??null,selectedCandidateIds:[...(o.selectedCandidateIds??[])].sort(),observations:o.observations??[],solveAllSelected:o.solveAllSelected??false,dcClearValidationCases:o.dcClearValidationCases??1,studyProfile:o.studyProfile??'CURRENT_SETTINGS'})});
export function hybridIsCurrent(r:HybridResult,n:CanonicalNetwork,s:ScenarioOverlay,settings:AnalysisSettings):boolean{return r.identity.modelHash===n.modelHash&&r.identity.scenarioHash===scenarioSignature(s)&&hybridStudyIsCurrent(r.identity.settingsHash,settings,r.studyProfile);}
/** Sequential budgeted orchestration; the original >=66kV DC algorithm is untouched. */
export async function runHybridN1(network:CanonicalNetwork,scenario:ScenarioOverlay,options:HybridOptions={}):Promise<HybridResult>{
  const start=performance.now(),policy={...DEFAULT_HYBRID_POLICY,...options.policy},filter=options.filter??{},season=options.season??'nominal';
  if(!Number.isInteger(policy.acBudgetCases)||policy.acBudgetCases<0||policy.acBudgetCases>100||policy.concurrency!==1||!Number.isFinite(policy.dcPromotionLoadingPercent)||policy.dcPromotionLoadingPercent<0||!(policy.operationalLoadingLimitPercent>0)||!(policy.voltageMinPu>0&&policy.voltageMinPu<policy.voltageMaxPu)||!(policy.perCaseTimeLimitMs>0&&policy.perCaseTimeLimitMs<=300000)||!(policy.globalTimeLimitMs>0&&policy.globalTimeLimitMs<=1800000))throw Error('HYBRID_INVALID_POLICY');
  if(!Number.isInteger(options.dcClearValidationCases??1)||(options.dcClearValidationCases??1)<0||(options.dcClearValidationCases??1)>100)throw Error('HYBRID_INVALID_CLEAR_SAMPLE');
  const id=snapshot(network,scenario,options,policy);
  if(options.resume&&stableJson(options.resume.identity)!==stableJson(id))throw Error('HYBRID_STALE_RESUME');
  const resume=options.resume?.cases.length?options.resume:undefined;
  const result:HybridResult=resume?structuredClone(resume):{method:'GA_DC_TO_FULL_AC',identity:id,policy,filter,season,phase:'MODEL_SCENARIO_OPTIONS_SNAPSHOT',status:'PARTIAL',reason:'',base:null,catalogCount:0,excludedCatalogCount:0,cases:[],counts:{},dcDiagnostics:null,elapsedMs:0};
  result.policy=policy;result.studyProfile=options.studyProfile??'CURRENT_SETTINGS';
  const retain=options.maxRetainedCaseDetails??2;if(!Number.isInteger(retain)||retain<1||retain>5)throw Error('HYBRID_DETAIL_MEMORY_BUDGET');
  const checkpoint=()=>{result.elapsedMs=performance.now()-start;result.counts={total:result.cases.length,catalog:result.catalogCount,excludedCatalog:result.excludedCatalogCount,promoted:result.cases.filter(c=>c.promotionReasons.length).length,AC_CALCULATED:result.cases.filter(c=>c.acSolved===true).length,NOT_RUN:result.cases.filter(c=>c.status==='NOT_RUN_BUDGET'||c.status==='CANCELLED').length,UNKNOWN:result.cases.filter(c=>c.unknownRatings>0||['PARTIAL_SOLUTION','BLOCKED','ISLAND_UNSUPPLIED'].includes(c.status)).length,dcRiskConfirmedAc:result.cases.filter(c=>c.dcStatus==='SCREENED_VIOLATION'&&c.status==='AC_CONVERGED_VIOLATION').length,dcViolationsNotConfirmedAc:result.cases.filter(c=>c.dcStatus==='SCREENED_VIOLATION'&&c.status==='AC_CONVERGED_WITHIN_LIMIT').length,dcClearAcVerified:result.cases.filter(c=>c.dcStatus==='SCREENED_NO_VIOLATION'&&c.acSolved===true).length,dcClearVoltageRisk:result.cases.filter(c=>c.dcStatus==='SCREENED_NO_VIOLATION'&&c.voltageViolations>0).length,dcClearViolatedAc:result.cases.filter(c=>c.dcStatus==='SCREENED_NO_VIOLATION'&&c.status==='AC_CONVERGED_VIOLATION').length};for(const c of result.cases)result.counts[c.status]=(result.counts[c.status]??0)+1;result.counts.uniqueViolatedElements=new Set(result.cases.flatMap(c=>c.violationKeys??[])).size;for(const c of result.cases)for(const [state,count]of Object.entries(c.constraintCounts??{}))result.counts[state]=(result.counts[state]??0)+count;options.onCheckpoint?.({...result,base:result.base?{...result.base}:null,cases:result.cases.map(c=>({...c})),counts:{...result.counts}});};
  const phase=(value:string)=>{result.phase=value;options.onProgress?.('HYBRID_PHASE',{message:value});checkpoint();};
  const remaining=()=>Math.max(0,policy.globalTimeLimitMs-(performance.now()-start));
  const aborted=()=>options.signal?.aborted===true;
  if(aborted()){result.status='CANCELLED';result.reason='CANCELLED';checkpoint();return result;}
  if(!resume){
    phase('BASE_FULL_AC_CHECK');
    const prepared=prepareModel(effectiveNetwork(network,scenario)),islands=prepared.diagnostics.islands as {status:string}[];
    if(prepared.topology.buses.length>20000){result.status='BLOCKED';result.reason='MEMORY_BUS_BUDGET';checkpoint();return result;}
    if(!islands?.length||islands.some(i=>i.status!=='READY')){result.status='BLOCKED';result.reason='BASE_UNSUPPLIED_OR_MULTIPLE_REFERENCE';checkpoint();return result;}
    try{
      const base=options.solveBase?await options.solveBase(Math.min(remaining(),policy.perCaseTimeLimitMs)):await new BrowserJsPowerFlowEngine().runPowerFlow({network,scenario,analysisSettings:options.analysisSettings,identity:identity(network.modelHash,scenario,'powerFlow',{analysisSettings:options.analysisSettings})},options.onProgress);
      if(options.analysisSettings&&!lfSnapshotIsCurrent(base,network,scenario,options.analysisSettings))throw Error('HYBRID_BASE_SETTINGS_IDENTITY_MISMATCH');
      result.base={status:base.status,converged:base.converged,iterations:base.iterations,maxMismatchMw:base.maxMismatchMw,settingsHash:id.settingsHash,stationControlMode:options.analysisSettings?.powerFlow.stationControlMode??'off',activeBalancingMode:options.analysisSettings?.powerFlow.activeBalancingMode??'LEGACY_ENGINE_DEFAULT',controlSupport:base.diagnostics.stationControllerSummary,fidelity:(options.analysisSettings?.powerFlow.stationControlMode??'off')==='off'?'CONTROL_FIDELITY_PARTIAL / NOT_PF_PARITY':'CONTROL_SUPPORT_REQUIRES_VERIFICATION'};
      const controls=base.diagnostics.stationControllerSummary as {unsupported?:number;unsupportedProfile?:number}|undefined;
      if(!base.buses.length||!base.converged||base.maxMismatchMw===null||!Number.isFinite(base.maxMismatchMw)||(options.analysisSettings?.powerFlow.stationControlMode??'off')!=='off'&&((controls?.unsupported??0)>0||(controls?.unsupportedProfile??0)>0)){result.status='BLOCKED';result.reason=`BASE_FULL_AC_NOT_VERIFIED; stationControlMode=${result.base.stationControlMode}; activeBalancing=${result.base.activeBalancingMode}; support=${stableJson(controls??{})}; ${base.status}`;checkpoint();return result;}
      result.basePost=postResultAssembler(network,base,season);result.baseConstraintCounts=constraintCounts(comparePostConstraints(result.basePost,result.basePost,policy).map(r=>({...r,state:r.state==='PERSISTENT'?'BASE_VIOLATION':r.state})));
      if((options.analysisSettings?.powerFlow.stationControlMode??'off')==='off'&&network.stationControllers.some(c=>c.inService))result.reason='STATION_CONTROL_OFF_LOCAL_PV_PROFILE; CONTROL_FIDELITY_PARTIAL; NOT_PF_METHOD_PARITY';
    }catch(e){result.status=aborted()?'CANCELLED':'BLOCKED';result.reason=String(e);checkpoint();return result;}
    if(aborted()||remaining()<=0){result.status=aborted()?'CANCELLED':'PARTIAL';result.reason='BASE_CANCELLED_OR_GLOBAL_BUDGET';checkpoint();return result;}
    phase('BUILD_CATALOG');
    const catalog=filterN1CatalogCandidates(buildN1CandidateCatalog(network,scenario,{capacitySeason:season,includeAllVoltages:true}).candidates,filter),fullAllowed=new Set(catalog.map(c=>c.candidateId));
    if(options.catalogCandidateIds?.some(c=>!fullAllowed.has(c)))throw Error('HYBRID_CATALOG_SELECTION_OUTSIDE_SCOPE');
    const allowed=new Set(options.catalogCandidateIds??fullAllowed);
    result.catalogCount=catalog.length;result.excludedCatalogCount=catalog.length-allowed.size;
    if(options.selectedCandidateIds?.some(c=>!allowed.has(c)))throw Error('HYBRID_SELECTION_OUTSIDE_SCOPE_OR_UNKNOWN_FID');
    phase('RUN_DC_SCREEN');
    const screenOptions:N1ScreenOptions={candidateTypes:[...(filter.sourceClasses??['ElmLne','ElmTr2'])],minVoltageKv:Math.max(66,filter.minVoltageKv??66),maxVoltageKv:filter.maxVoltageKv,capacitySeason:season,selectedCandidateIds:[...allowed],analysisScope:'scenario'};
    let dc:N1ScreenResult;
    try{dc=!catalog.some(c=>allowed.has(c.candidateId)&&c.vnKv>=66&&c.representedInReducedModel)?{identity:{modelHash:network.modelHash,scenarioHash:scenarioSignature(scenario),optionsHash:stableJson(screenOptions),engineVersion:'NO_DC_SCOPE'},scope:'REDUCED_GE66_DC_P_ONLY',candidateTypes:['ElmLne','ElmTr2'],voltageBands:{minKv:66,maxKv:null},capacitySeason:season,analysisScope:'scenario',baseDcStatus:'NO_SELECTED_DC_SCOPE; DIRECT_AC',elapsedMs:0,candidateCount:0,screenedCount:0,islandingCount:0,unratedCount:0,unsupportedCount:0,candidates:[],remarks:['LOW_VOLTAGE_DIRECT_AC'],dcDiagnostics:{factorizationCount:0,rhsCount:0,maxTrueResidual:null,matrices:[]}}:options.screen?await options.screen(screenOptions,remaining()):await runN1Screen(network,scenario,screenOptions,{signal:options.signal,onProgress:p=>options.onProgress?.(p.stage,{...p})});}
    catch(e){result.status=aborted()?'CANCELLED':'BLOCKED';result.reason=String(e);checkpoint();return result;}
    result.dcDiagnostics=dc.dcDiagnostics;phase('ASSESS_PROMOTION');
    const equipment=new Map([...network.lines,...network.transformers].map(e=>[`${e.sourceClass}:${e.id}`,e.sourceId]));
    const nativeById=new Map(catalog.map(c=>[c.candidateId,c]));
    const screened=new Map(dc.candidates.map(c=>[c.candidateId,c]));
    const clearSample=new Set(dc.candidates.filter(c=>allowed.has(c.candidateId)&&c.status==='SCREENED_NO_VIOLATION').sort((a,b)=>a.candidateId.localeCompare(b.candidateId)).slice(0,options.dcClearValidationCases??1).map(c=>c.candidateId));
    const allCandidates=[...allowed].map(id=>{const dc=screened.get(id),c=nativeById.get(id)!;return dc??{...c,status:'UNSCREENABLE' as const,baseFlowMw:null,islanding:c.topology==='ISLANDING',outageRatingAvailable:c.ratingAvailable,maxEstimatedLoadingPct:null,ratingCoverage:{evaluated:false,ratedBranches:0,totalBranches:0,percent:null},exclusionReason:c.vnKv<66?'LOW_VOLTAGE_DIRECT_AC':'OUTSIDE_REDUCED_DC_SCOPE',topImpacts:[],violationImpacts:[],estimatedOverloadCount:0,maxDeltaPMw:null};});
    result.cases=allCandidates.map(c=>{const reasons=promotionReasons(c,policy,options.solveAllSelected||options.selectedCandidateIds?.includes(c.candidateId));if(clearSample.has(c.candidateId))reasons.push('DC_CLEAR_VALIDATION');const meta=nativeById.get(c.candidateId)!,fid=equipment.get(c.candidateId)??c.equipmentId,clear=c.status==='SCREENED_NO_VIOLATION'&&c.outageRatingAvailable&&c.ratingCoverage.percent===100;return {outage:{sourceClass:c.sourceClass,fid,caseId:`N1:${c.sourceClass}:${fid}`},candidateId:c.candidateId,promotionReasons:reasons,dcStatus:c.status,metadata:{name:meta.name,voltageKv:meta.vnKv,fromYtmIds:meta.fromYtmIds,toYtmIds:meta.toYtmIds,topology:meta.topology},status:reasons.length?'NOT_RUN_BUDGET':clear?'DC_CLEAR_NOT_AC_VERIFIED':'BLOCKED',reason:reasons.length?(c.vnKv<66?'LOW_VOLTAGE_DIRECT_AC; AC_QUEUE_PENDING':'AC_QUEUE_PENDING'):clear?'DC_P_ONLY; AC_NOT_VERIFIED':'UNCERTAIN_DC_CASE_EXCLUDED_BY_USER_POLICY',iterations:null,maxMismatchMw:null,minVpu:null,maxVpu:null,maxLoadingPercent:null,unknownRatings:0,voltageViolations:0,thermalViolations:0,components:[],elapsedMs:0,observations:[]};});
  }
  phase('BUDGETED_AC_QUEUE');let completed=0;
  // Explicit cases first, then DC violations. Stable ID tie-breaker makes runs reproducible.
  const queue=result.cases.filter(c=>c.promotionReasons.length&&['NOT_RUN_BUDGET','CANCELLED'].includes(c.status)).sort((a,b)=>Number(b.promotionReasons.includes('EXPLICIT_SELECTION'))-Number(a.promotionReasons.includes('EXPLICIT_SELECTION'))||Number(b.promotionReasons.includes('DC_VIOLATION'))-Number(a.promotionReasons.includes('DC_VIOLATION'))||a.candidateId.localeCompare(b.candidateId));
  for(const c of queue){
    if(aborted()){c.status='CANCELLED';c.reason='CANCELLED';continue;}
    if(completed>=policy.acBudgetCases||remaining()<=0){c.status='NOT_RUN_BUDGET';c.reason=remaining()<=0?'GLOBAL_TIME_BUDGET':'AC_CASE_BUDGET';continue;}
    completed++;options.onProgress?.('HYBRID_AC_CASE',{message:`AC ${completed}/${policy.acBudgetCases}`,caseId:c.outage.caseId});
    try{
      const budget=Math.min(remaining(),policy.perCaseTimeLimitMs);
      const ac=options.solveOutage?await options.solveOutage(c.outage,budget):(await validateAcOutages(network,scenario,[c.outage],{analysisSettings:options.analysisSettings,maxCases:1,timeBudgetMs:budget,signal:options.signal}))[0];
      c.reason=ac.reason;c.components=ac.components;c.elapsedMs=ac.elapsedMs;c.unsuppliedLoadMw=ac.unsuppliedLoadMw;
      if(options.analysisSettings&&ac.identity.settingsHash!==id.settingsHash)throw Error('HYBRID_CASE_SETTINGS_IDENTITY_MISMATCH');
      const solved=ac.result;c.acSolved=['CONVERGED','PARTIAL_SOLUTION'].includes(ac.status)&&!!solved&&solved.converged&&solved.buses.length>0&&Number.isFinite(solved.maxMismatchMw);
      if(solved&&!solved.buses.length){c.status='BLOCKED';c.reason='EMPTY_POST_SOLUTION';checkpoint();continue;}
      if(solved){c.iterations=solved.iterations;c.maxMismatchMw=solved.maxMismatchMw;c.minVpu=Math.min(...solved.buses.map(b=>b.vmPu));c.maxVpu=Math.max(...solved.buses.map(b=>b.vmPu));c.voltageViolations=solved.buses.filter(b=>b.vmPu<policy.voltageMinPu||b.vmPu>policy.voltageMaxPu).length;
        const post=postResultAssembler(network,solved,season);c.mapResults=post;
        const changes=result.basePost?comparePostConstraints(result.basePost,post,policy,c.outage):[];c.constraintChanges=changes;c.constraintCounts=constraintCounts(changes);c.violationKeys=changes.filter(r=>r.postSeverity!==null&&r.postSeverity>0).map(r=>`${r.sourceClass}:${r.fid}:${r.metric}`);
        try{await options.onCaseDetail?.(c.outage.caseId,{post,changes});}catch{c.reason+='; DETAIL_STORAGE_UNAVAILABLE';}
        const detailed=result.cases.filter(row=>row.mapResults&&row!==c);for(const old of detailed.slice(0,Math.max(0,detailed.length-retain+1))){delete old.mapResults;delete old.constraintChanges;delete old.constraints;}
        c.constraints=[...post.buses.filter(b=>b.vmPu<policy.voltageMinPu||b.vmPu>policy.voltageMaxPu).map(b=>({sourceClass:'ElmTerm',fid:b.terms[0],metric:'voltagePu',value:b.vmPu,limit:b.vmPu<policy.voltageMinPu?policy.voltageMinPu:policy.voltageMaxPu})),...post.branches.filter(b=>b.loading.operationalPercent!==null&&b.loading.operationalPercent>policy.operationalLoadingLimitPercent).map(b=>({sourceClass:b.sourceClass,fid:b.fid,metric:'postLoadingPercent',value:b.loading.operationalPercent!,limit:policy.operationalLoadingLimitPercent}))];
        const rated=post.branches.map(b=>b.loading.operationalPercent).filter((v):v is number=>v!==null&&Number.isFinite(v));c.unknownRatings=post.branches.length-rated.length;c.maxLoadingPercent=rated.length?Math.max(...rated):null;c.thermalViolations=rated.filter(v=>v>policy.operationalLoadingLimitPercent).length;
        const byKey=new Map(post.branches.map(b=>[`${b.sourceClass}:${b.fid}`,b]));const observed=new Map((options.observations??[]).filter(o=>!o.caseId||o.caseId===c.outage.caseId).map(o=>[stableJson(o),o]));
        c.observations=[...observed.values()].map(o=>{const b=byKey.get(`${o.sourceClass}:${o.fid}`),voltage=o.metric==='postVoltagePu'?post.buses.find(b=>b.terms.includes(o.fid))?.vmPu:null;return {...o,value:o.metric==='postVoltagePu'?voltage??null:b?postBranchMetric(b,o.metric,o.side):null,...(b&&o.metric.includes('Loading')?{loading:b.loading}:{})};});
      }
      c.status=ac.status==='CONVERGED'?(c.thermalViolations||c.voltageViolations?'AC_CONVERGED_VIOLATION':'AC_CONVERGED_WITHIN_LIMIT'):ac.status==='PARTIAL_SOLUTION'?'PARTIAL_SOLUTION':ac.status==='DIVERGED'?'AC_DIVERGED':ac.status==='ISLAND_UNSUPPLIED'?'ISLAND_UNSUPPLIED':ac.status==='CANCELLED'?'CANCELLED':'BLOCKED';
      if(c.unknownRatings)c.reason+='; UNKNOWN_RATINGS; NO_ALL_CLEAR';
    }catch(e){c.status=aborted()?'CANCELLED':'BLOCKED';c.reason=String(e);}
    checkpoint();
  }
  result.status=aborted()?'CANCELLED':result.excludedCatalogCount>0||result.cases.some(c=>c.unknownRatings>0||!['AC_CONVERGED_WITHIN_LIMIT','AC_CONVERGED_VIOLATION'].includes(c.status))?'PARTIAL':'COMPLETE';phase('REPORT');checkpoint();return result;
}
