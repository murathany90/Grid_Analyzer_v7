import type {CanonicalNetwork} from '../../domain/model/network';
import type {ScenarioOverlay} from '../../domain/scenario/overlay';
import {effectiveNetwork,scenarioSignature} from '../../domain/scenario/overlay';
import {identity,stableJson} from '../../domain/calculation/identity';
import {comparePostConstraints,constraintCounts,type ConstraintChange} from './constraints';
import {validateLimitProfiles,operationalLimits,assertOperationalLimits,type OperationalLimitProfile} from './limits';
import {hybridStudyIsCurrent,type HybridStudyProfile} from './profile';
import {n1CaseCounts} from './case-summary';
import {lfSnapshotIsCurrent} from '../../domain/benchmark/post-result-source';
import type {AnalysisSettings} from '../../domain/calculation/analysis-settings';
import type {CalculationResult} from '../../domain/results/types';
import {buildN1CandidateCatalog,filterN1CatalogCandidates,type N1CatalogFilter} from '../../domain/n1/catalog';
import {runN1Screen,type N1ScreenCandidate,type N1ScreenOptions,type N1ScreenResult} from '../../domain/n1';
import {BrowserJsPowerFlowEngine} from '../api/browser-js-engine';
import {prepareModel} from '../power-flow/preparation';
import {n1ControlEvidence,type ControlEvidence} from '../contingency-ac/control-evidence';
import {validateAcOutages,type AcOutage,type AcContingency} from '../contingency-ac';
import type {CapacitySeason} from '../../domain/model/capacity';
import {postResultAssembler,postBranchMetric,type PostMapResults} from '../contingency-ac/post-results';

export interface HybridPolicy {
  operationalLoadingLimitPercent:number;voltageMinPu:number;voltageMaxPu:number;dcPromotionLoadingPercent:number;
  includeDCViolation:boolean;includeCapacityUnavailable:boolean;includeUnscreenable:boolean;classifyIslanding:boolean;includeExplicitUserSelection:boolean;
  acBudgetCases:number;perCaseTimeLimitMs:number;globalTimeLimitMs:number;concurrency:1;
  limitsProvenance:string;promotionProvenance:string;
  limitProfiles?:readonly OperationalLimitProfile[];
}
export const DEFAULT_HYBRID_POLICY:HybridPolicy={operationalLoadingLimitPercent:100,voltageMinPu:.9,voltageMaxPu:1.1,dcPromotionLoadingPercent:90,includeDCViolation:true,includeCapacityUnavailable:true,includeUnscreenable:true,classifyIslanding:true,includeExplicitUserSelection:true,acBudgetCases:10,perCaseTimeLimitMs:120000,globalTimeLimitMs:300000,concurrency:1,limitsProvenance:'USER_OPERATIONAL_PROFILE (use PF manifest only when explicitly supplied)',promotionProvenance:'USER_POLICY; NOT_INFERRED_FROM_PF'};
export type HybridStatus='DC_SCREEN_ONLY'|'DC_CLEAR_NOT_AC_VERIFIED'|'AC_CONVERGED_WITHIN_LIMIT'|'AC_CONVERGED_VIOLATION'|'AC_DIVERGED'|'ISLAND_UNSUPPLIED'|'PARTIAL_SOLUTION'|'BLOCKED'|'NOT_RUN_BUDGET'|'NOT_EVALUATED_BUDGET'|'DC_UNSCREENABLE'|'TOPOLOGY_ISLANDING'|'CANCELLED';
export interface HybridCase {
  retainedFromPrior?:boolean;
  quality?:import('../../domain/results/quality').ResultQuality;
  dcResult?:N1ScreenCandidate;
  outage:AcOutage;candidateId:string;promotionReasons:string[];dcStatus:string;status:HybridStatus;reason:string;
  iterations:number|null;maxMismatchMw:number|null;minVpu:number|null;maxVpu:number|null;maxLoadingPercent:number|null;unknownRatings:number;
  voltageViolations:number;thermalViolations:number;components:AcContingency['components'];elapsedMs:number;
  // Requested extrema observations plus compact map snapshots; full solver diagnostics are not retained.
  mapResults?:PostMapResults;constraintChanges?:ConstraintChange[];constraintCounts?:Record<string,number>;violationKeys?:string[];affectedKeys?:string[];acSolved?:boolean;
  acAttempted?:boolean;controlEvidence?:ControlEvidence;
  metadata?:{name:string;voltageKv:number;fromYtmIds:readonly string[];toYtmIds:readonly string[];topology:string};
  unsuppliedLoadMw?:number;constraints?:{sourceClass:string;fid:string;metric:string;value:number;limit:number}[];
  observations:{sourceClass:string;fid:string;metric:string;side?:string;caseId?:string;value:number|null;loading?:import('../contingency-ac/post-results').PostLoading}[];
}
export interface HybridResult {
  method:'GA_DC_TO_FULL_AC';identity:{modelHash:string;scenarioHash:string;settingsHash:string;optionsHash:string};
  policy:HybridPolicy;filter:N1CatalogFilter;season:CapacitySeason;phase:string;status:'COMPLETE'|'PARTIAL'|'BLOCKED'|'CANCELLED';reason:string;
  retainedBasePost?:boolean;studyProfile?:HybridStudyProfile;basePost?:PostMapResults;baseConstraintCounts?:Record<string,number>;
  base:{status:string;converged:boolean;iterations:number;maxMismatchMw:number|null;settingsHash?:string;stationControlMode?:string;activeBalancingMode?:string;controlSupport?:unknown;fidelity?:string;controlEvidence?:ControlEvidence}|null;catalogCount:number;excludedCatalogCount:number;
  cases:HybridCase[];counts:Record<string,number>;dcDiagnostics:N1ScreenResult['dcDiagnostics']|null;elapsedMs:number;
}
export interface HybridOptions {
  /** Evaluate the whole catalog and retain DC results without requiring base Full AC. */
  screenOnly?:boolean;
  preserveDcOnAcFailure?:boolean;
  preferDirectAcSample?:boolean;
  allowSuppliedIslandResults?:boolean;
  /** Spend wall time with an empirical reserve; case count remains a safety cap. */
  adaptiveAcTimeBudget?:boolean;
  interleaveDirectAc?:boolean;
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
const snapshot=(n:CanonicalNetwork,s:ScenarioOverlay,o:HybridOptions,p:HybridPolicy)=>({modelHash:n.modelHash,scenarioHash:scenarioSignature(s),settingsHash:stableJson(o.analysisSettings??{}),optionsHash:stableJson({policy:{...p,acBudgetCases:undefined,perCaseTimeLimitMs:undefined,globalTimeLimitMs:undefined},filter:o.filter??{},season:o.season??'nominal',catalogCandidateIds:o.catalogCandidateIds??null,selectedCandidateIds:[...(o.selectedCandidateIds??[])].sort(),observations:o.observations??[],solveAllSelected:o.solveAllSelected??false,dcClearValidationCases:o.dcClearValidationCases??1,studyProfile:o.studyProfile??'CURRENT_SETTINGS',...(o.interleaveDirectAc===false?{interleaveDirectAc:false}:{}),...(o.adaptiveAcTimeBudget?{adaptiveAcTimeBudget:true}:{}),...(o.allowSuppliedIslandResults?{allowSuppliedIslandResults:true}:{}),...(o.preferDirectAcSample?{preferDirectAcSample:true}:{}),...(o.preserveDcOnAcFailure?{preserveDcOnAcFailure:true}:{})})});
export function hybridIsCurrent(r:HybridResult,n:CanonicalNetwork,s:ScenarioOverlay,settings:AnalysisSettings):boolean{return r.identity.modelHash===n.modelHash&&r.identity.scenarioHash===scenarioSignature(s)&&hybridStudyIsCurrent(r.identity.settingsHash,settings,r.studyProfile);}
/** Sequential budgeted orchestration; the original >=66kV DC algorithm is untouched. */
export async function runHybridN1(network:CanonicalNetwork,scenario:ScenarioOverlay,options:HybridOptions={}):Promise<HybridResult>{
  const start=performance.now(),policy={...DEFAULT_HYBRID_POLICY,...options.policy},filter=options.filter??{},season=options.season??'nominal';
  validateLimitProfiles(policy.limitProfiles);
  assertOperationalLimits(network,scenario,policy);
  if(!Number.isInteger(policy.acBudgetCases)||policy.acBudgetCases<0||policy.acBudgetCases>100||policy.concurrency!==1||!Number.isFinite(policy.dcPromotionLoadingPercent)||policy.dcPromotionLoadingPercent<0||!(policy.operationalLoadingLimitPercent>0)||!(policy.voltageMinPu>0&&policy.voltageMinPu<policy.voltageMaxPu)||!(policy.perCaseTimeLimitMs>0&&policy.perCaseTimeLimitMs<=300000)||!(policy.globalTimeLimitMs>0&&policy.globalTimeLimitMs<=1800000))throw Error('HYBRID_INVALID_POLICY');
  if(!Number.isInteger(options.dcClearValidationCases??1)||(options.dcClearValidationCases??1)<0||(options.dcClearValidationCases??1)>100)throw Error('HYBRID_INVALID_CLEAR_SAMPLE');
  const id=snapshot(network,scenario,options,policy);
  if(options.resume&&stableJson(options.resume.identity)!==stableJson(id))throw Error('HYBRID_STALE_RESUME');
  const resume=options.resume?.cases.length&&options.resume.basePost&&options.resume.status!=='BLOCKED'?options.resume:undefined;
  const result:HybridResult=resume?structuredClone(resume):{method:'GA_DC_TO_FULL_AC',identity:id,policy,filter,season,phase:'MODEL_SCENARIO_OPTIONS_SNAPSHOT',status:'PARTIAL',reason:'',base:null,catalogCount:0,excludedCatalogCount:0,cases:[],counts:{},dcDiagnostics:null,elapsedMs:0};
  result.policy=policy;result.studyProfile=options.studyProfile??'CURRENT_SETTINGS';
  const retain=options.maxRetainedCaseDetails??2;if(!Number.isInteger(retain)||retain<1||retain>5)throw Error('HYBRID_DETAIL_MEMORY_BUDGET');
  const checkpoint=()=>{result.elapsedMs=performance.now()-start;result.counts={total:result.cases.length,catalog:result.catalogCount,excludedCatalog:result.excludedCatalogCount,promoted:result.cases.filter(c=>c.promotionReasons.length).length,AC_CALCULATED:result.cases.filter(c=>c.acSolved===true).length,NOT_RUN:result.cases.filter(c=>c.status==='NOT_RUN_BUDGET'||c.status==='NOT_EVALUATED_BUDGET'||c.status==='CANCELLED').length,UNKNOWN:result.cases.filter(c=>c.unknownRatings>0||['PARTIAL_SOLUTION','BLOCKED','ISLAND_UNSUPPLIED'].includes(c.status)).length,dcRiskConfirmedAc:result.cases.filter(c=>c.dcStatus==='SCREENED_VIOLATION'&&c.status==='AC_CONVERGED_VIOLATION').length,dcViolationsNotConfirmedAc:result.cases.filter(c=>c.dcStatus==='SCREENED_VIOLATION'&&c.status==='AC_CONVERGED_WITHIN_LIMIT').length,dcClearAcVerified:result.cases.filter(c=>c.dcStatus==='SCREENED_NO_VIOLATION'&&c.acSolved===true&&c.controlEvidence?.fidelity==='CONTROL_VERIFIED'&&result.base?.fidelity==='CONTROL_VERIFIED').length,dcClearVoltageRisk:result.cases.filter(c=>c.dcStatus==='SCREENED_NO_VIOLATION'&&c.voltageViolations>0).length,dcClearViolatedAc:result.cases.filter(c=>c.dcStatus==='SCREENED_NO_VIOLATION'&&c.status==='AC_CONVERGED_VIOLATION').length};for(const c of result.cases)result.counts[c.status]=(result.counts[c.status]??0)+1;Object.assign(result.counts,{DC_SCREENED:result.cases.filter(c=>['SCREENED_NO_VIOLATION','SCREENED_VIOLATION'].includes(c.dcStatus)).length,N1_NUMERICALLY_COMPUTABLE:result.cases.filter(c=>c.dcResult||c.acSolved).length,AC_DIRECT_OUTSIDE_DC:result.cases.filter(c=>c.acSolved&&!c.dcResult).length,ISLAND_UNSUPPLIED_COMPONENT_CASES:result.cases.filter(c=>c.status==='ISLAND_UNSUPPLIED'||c.components?.some(i=>i.status==='UNSUPPLIED_COMPONENT')).length,AC_ATTEMPTED:result.cases.filter(c=>c.acAttempted).length,AC_NUMERICALLY_SOLVED:result.cases.filter(c=>c.controlEvidence?.numericalSolved).length,AC_VERIFIED:result.cases.filter(c=>result.base?.fidelity==='CONTROL_VERIFIED'&&c.acSolved&&c.controlEvidence?.fidelity==='CONTROL_VERIFIED'&&['AC_CONVERGED_WITHIN_LIMIT','AC_CONVERGED_VIOLATION'].includes(c.status)).length});const outcomes=n1CaseCounts(result.cases);Object.assign(result.counts,{AC_SUCCESSFUL:outcomes.success,AC_PARTIAL:outcomes.partial,AC_SKIPPED:outcomes.skipped});result.counts.AC_UNVERIFIED=Math.max(0,result.catalogCount-result.counts.AC_VERIFIED);result.counts.uniqueViolatedElements=new Set(result.cases.flatMap(c=>c.violationKeys??[])).size;for(const c of result.cases)for(const [state,count]of Object.entries(c.constraintCounts??{}))result.counts[state]=(result.counts[state]??0)+count;options.onCheckpoint?.({...result,base:result.base?{...result.base}:null,cases:result.cases.map(c=>({...c})),counts:{...result.counts}});};
  const phase=(value:string)=>{result.phase=value;options.onProgress?.('HYBRID_PHASE',{message:value});checkpoint();};
  const remaining=()=>Math.max(0,policy.globalTimeLimitMs-(performance.now()-start));
  const budgetedProgress=(deadline:number)=>(stage:string,detail?:Record<string,unknown>)=>{if(performance.now()>=deadline)throw Error('AC_TIME_BUDGET; PREVIOUS_RESULTS_RETAINED');options.onProgress?.(stage,detail);};
  const aborted=()=>options.signal?.aborted===true;
  const blockBase=(reason:string)=>{const retain=options.preserveDcOnAcFailure&&result.base?.controlEvidence?.numericalSolved===true;result.status=aborted()?'CANCELLED':retain?'PARTIAL':'BLOCKED';result.reason=reason;for(const c of result.cases)if(c.status==='NOT_RUN_BUDGET'){c.status=aborted()?'CANCELLED':'BLOCKED';c.reason=reason+'; DC_RESULT_RETAINED_IF_AVAILABLE';}checkpoint();return result;};
  if(aborted()){result.status='CANCELLED';result.reason='CANCELLED';checkpoint();return result;}
  if(!resume){
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
    for(const c of result.cases){const screened=allCandidates.find(d=>d.candidateId===c.candidateId);if(screened&&screened.baseFlowMw!==null){c.dcResult=screened;c.quality='DC_SCREEN_ONLY';}}
    if(options.screenOnly){result.status='PARTIAL';result.reason='DC_SCREEN_ONLY; AC_NOT_REQUESTED';for(const c of result.cases){c.status=c.dcResult?'DC_SCREEN_ONLY':c.metadata?.topology==='ISLANDING'?'TOPOLOGY_ISLANDING':'DC_UNSCREENABLE';c.reason=c.dcResult?'DC_P_ONLY; AC_NOT_REQUESTED':c.metadata?.topology==='ISLANDING'?'ISLANDING; AC_BALANCE_NOT_EVALUATED':'OUTSIDE_DC_MODEL; AC_NOT_REQUESTED';}checkpoint();return result;}
    if(aborted()||remaining()<=0){result.status=aborted()?'CANCELLED':'PARTIAL';result.reason='CATALOG_CANCELLED_OR_GLOBAL_BUDGET';checkpoint();return result;}
    phase('BASE_FULL_AC_CHECK');
    const prepared=prepareModel(effectiveNetwork(network,scenario)),islands=prepared.diagnostics.islands as {status:string}[];
    if(prepared.topology.buses.length>20000)return blockBase('MEMORY_BUS_BUDGET');
    if(!islands?.length||islands.some(i=>i.status!=='READY'))return blockBase('BASE_UNSUPPLIED_OR_MULTIPLE_REFERENCE');
    try{
      const baseBudget=Math.min(remaining(),policy.perCaseTimeLimitMs),base=options.solveBase?await options.solveBase(baseBudget):await new BrowserJsPowerFlowEngine().runPowerFlow({network,scenario,analysisSettings:options.analysisSettings,identity:identity(network.modelHash,scenario,'powerFlow',{analysisSettings:options.analysisSettings})},budgetedProgress(performance.now()+baseBudget));
      if(options.analysisSettings&&!lfSnapshotIsCurrent(base,network,scenario,options.analysisSettings))throw Error('HYBRID_BASE_SETTINGS_IDENTITY_MISMATCH');
      result.base={status:base.status,converged:base.converged,iterations:base.iterations,maxMismatchMw:base.maxMismatchMw,settingsHash:id.settingsHash,stationControlMode:options.analysisSettings?.powerFlow.stationControlMode??'off',activeBalancingMode:options.analysisSettings?.powerFlow.activeBalancingMode??'LEGACY_ENGINE_DEFAULT',controlSupport:base.diagnostics.stationControllerSummary,fidelity:(options.analysisSettings?.powerFlow.stationControlMode??'off')==='off'?'CONTROL_FIDELITY_PARTIAL / NOT_PF_PARITY':'CONTROL_SUPPORT_REQUIRES_VERIFICATION'};
      const controls=n1ControlEvidence(effectiveNetwork(network,scenario),base,options.analysisSettings);result.base.controlEvidence=controls;result.base.fidelity=controls.fidelity;
      const allowPartial=options.studyProfile==='NATIVE_PARTIAL_CONTROLS'||options.studyProfile==='GA_APPROX_STATION_OFF';
      if(!controls.numericalSolved||controls.fidelity!=='CONTROL_VERIFIED'&&!allowPartial)return blockBase(`BASE_FULL_AC_NOT_VERIFIED; ${controls.reasons.join('; ')}; stationControlMode=${result.base.stationControlMode}; activeBalancing=${result.base.activeBalancingMode}; support=${stableJson(controls.stationSupport)}; ${base.status}`);
      if(controls.fidelity!=='CONTROL_VERIFIED')result.reason=`${controls.reasons.join('; ')}; CONTROL_FIDELITY_PARTIAL; NOT_PF_METHOD_PARITY`;
      result.basePost=postResultAssembler(network,base,season);result.baseConstraintCounts=constraintCounts(comparePostConstraints(result.basePost,result.basePost,policy).map(r=>({...r,state:r.state==='PERSISTENT'?'BASE_VIOLATION':r.state})));
      if((options.analysisSettings?.powerFlow.stationControlMode??'off')==='off'&&network.stationControllers.some(c=>c.inService))result.reason='STATION_CONTROL_OFF_LOCAL_PV_PROFILE; CONTROL_FIDELITY_PARTIAL; NOT_PF_METHOD_PARITY';
    }catch(e){return blockBase(String(e));}
    if(aborted()||remaining()<=0){result.status=aborted()?'CANCELLED':'PARTIAL';result.reason='BASE_CANCELLED_OR_GLOBAL_BUDGET';checkpoint();return result;}
  }
  phase('BUDGETED_AC_QUEUE');let completed=0,observedCaseMs=0;
  // Explicit cases first, then DC violations. Stable ID tie-breaker makes runs reproducible.
  const queue=result.cases.filter(c=>c.promotionReasons.length&&['NOT_RUN_BUDGET','NOT_EVALUATED_BUDGET','DC_UNSCREENABLE','TOPOLOGY_ISLANDING','CANCELLED'].includes(c.status)).sort((a,b)=>Number(b.promotionReasons.includes('EXPLICIT_SELECTION'))-Number(a.promotionReasons.includes('EXPLICIT_SELECTION'))||Number(b.promotionReasons.includes('DC_VIOLATION'))-Number(a.promotionReasons.includes('DC_VIOLATION'))||(options.adaptiveAcTimeBudget?Number(a.metadata?.topology==='ISLANDING')-Number(b.metadata?.topology==='ISLANDING')||(b.dcResult?.maxEstimatedLoadingPct??0)-(a.dcResult?.maxEstimatedLoadingPct??0):0)||a.candidateId.localeCompare(b.candidateId));
  // Reserve an early slot for a real full-network outage absent from the reduced DC model.
  if(options.preferDirectAcSample){const slot=Math.max(1,queue.filter(c=>c.promotionReasons.includes('EXPLICIT_SELECTION')).length),direct=queue.findIndex(c=>c.dcStatus==='UNSCREENABLE'&&c.metadata?.topology==='NON_ISLANDING');if(direct>slot){const [sample]=queue.splice(direct,1);queue.splice(slot,0,sample);}}
  if(options.adaptiveAcTimeBudget&&options.preferDirectAcSample&&options.interleaveDirectAc!==false){
    const explicit=queue.filter(c=>c.promotionReasons.includes('EXPLICIT_SELECTION')),other=queue.filter(c=>!explicit.includes(c)),direct=other.filter(c=>c.dcStatus==='UNSCREENABLE'&&c.metadata?.topology==='NON_ISLANDING'),risk=other.filter(c=>!direct.includes(c)&&c.dcResult),deferred=other.filter(c=>!direct.includes(c)&&!risk.includes(c)),ordered=[...explicit];
    // Alternate a DC risk with a distinct direct-AC opportunity. Never promote
    // a topological island as if its source/load balance had been established.
    while(direct.length){if(risk.length)ordered.push(risk.shift()!);ordered.push(direct.shift()!);}queue.splice(0,queue.length,...ordered,...risk,...deferred);
  }
  for(const c of queue){
    if(aborted()){c.status='CANCELLED';c.reason='CANCELLED';continue;}
    const reserve=options.adaptiveAcTimeBudget?Math.max(1500,observedCaseMs*1.3):0;
    if(completed>=policy.acBudgetCases||remaining()<=reserve){c.status=options.adaptiveAcTimeBudget?'NOT_EVALUATED_BUDGET':'NOT_RUN_BUDGET';c.reason=remaining()<=reserve?'GLOBAL_TIME_BUDGET; NEXT_CASE_RESERVE':'AC_CASE_BUDGET';continue;}
    completed++;c.acAttempted=true;const caseStarted=performance.now();options.onProgress?.('HYBRID_AC_CASE',{message:options.adaptiveAcTimeBudget?`AC ${completed} · kalan ${queue.length-completed} · ${(remaining()/1000).toFixed(1)} s bütçe`:`AC ${completed}/${policy.acBudgetCases}`,caseId:c.outage.caseId});
    try{
      const budget=Math.min(remaining(),policy.perCaseTimeLimitMs);
      const ac=options.solveOutage?await options.solveOutage(c.outage,budget):(await validateAcOutages(network,scenario,[c.outage],{analysisSettings:options.analysisSettings,controlPolicy:options.studyProfile==='NATIVE_PARTIAL_CONTROLS'||options.studyProfile==='GA_APPROX_STATION_OFF'?'ALLOW_PARTIAL':'STRICT',maxCases:1,timeBudgetMs:budget,signal:options.signal,onProgress:budgetedProgress(performance.now()+budget)}))[0];
      c.reason=ac.reason;c.components=ac.components;c.elapsedMs=ac.elapsedMs;c.unsuppliedLoadMw=ac.unsuppliedLoadMw;c.controlEvidence=ac.controlEvidence??(ac.result?n1ControlEvidence(network,ac.result,options.analysisSettings):undefined);if(c.components?.some(i=>i.status==='UNSUPPLIED_COMPONENT'))c.reason+='; ISLAND_UNSUPPLIED; SUPPLIED_COMPONENT_NUMBERS_ONLY';
      if(options.analysisSettings&&ac.identity.settingsHash!==id.settingsHash)throw Error('HYBRID_CASE_SETTINGS_IDENTITY_MISMATCH');
      if((ac.status==='ISLAND_UNSUPPLIED'||ac.components?.some(i=>i.status==='UNSUPPLIED_COMPONENT'))&&(!options.allowSuppliedIslandResults||!ac.result?.converged)){c.status='ISLAND_UNSUPPLIED';c.reason+='; OUTAGE_CREATED_UNSUPPLIED_ISLAND';checkpoint();continue;}
      const solved=ac.result;c.acSolved=['CONVERGED','PARTIAL_SOLUTION'].includes(ac.status)&&!!solved&&solved.converged&&solved.buses.length>0&&typeof solved.maxMismatchMw==='number'&&Number.isFinite(solved.maxMismatchMw)&&solved.maxMismatchMw>=0&&solved.maxMismatchMw<=(options.analysisSettings?.powerFlow.nodalToleranceKva??5)/1000&&c.controlEvidence?.numericalSolved===true;
      if(['CONVERGED','PARTIAL_SOLUTION'].includes(ac.status)&&!c.acSolved){c.status='BLOCKED';c.reason='INVALID_POST_NUMERICAL_EVIDENCE; DC_RESULT_RETAINED_IF_AVAILABLE';if(c.controlEvidence)c.controlEvidence={...c.controlEvidence,numericalSolved:false,maxMismatchMw:solved?.maxMismatchMw??null,fidelity:'NUMERICAL_UNVERIFIED',reasons:[...c.controlEvidence.reasons,'INVALID_POST_NUMERICAL_EVIDENCE']};checkpoint();continue;}
      if(solved&&!solved.buses.length){c.status='BLOCKED';c.reason='EMPTY_POST_SOLUTION';checkpoint();continue;}
      if(solved){c.iterations=solved.iterations;c.maxMismatchMw=solved.maxMismatchMw;c.minVpu=Math.min(...solved.buses.map(b=>b.vmPu));c.maxVpu=Math.max(...solved.buses.map(b=>b.vmPu));c.voltageViolations=solved.buses.filter(b=>b.vmPu<policy.voltageMinPu||b.vmPu>policy.voltageMaxPu).length;
        const post=postResultAssembler(network,solved,season);c.mapResults=post;
        const changes=result.basePost?comparePostConstraints(result.basePost,post,policy,c.outage):[];c.constraintChanges=changes;c.constraintCounts=constraintCounts(changes);c.violationKeys=changes.filter(r=>r.postSeverity!==null&&r.postSeverity>0).map(r=>`${r.sourceClass}:${r.fid}:${r.metric}`);
        const before=new Map(result.basePost?.branches.map(b=>[b.sourceClass+':'+b.fid,b])??[]);
        c.affectedKeys=[...new Set([...changes.filter(r=>r.delta!==null&&Math.abs(r.delta)>1e-7).map(r=>`${r.sourceClass}:${r.fid}:${r.metric}`),...post.branches.filter(b=>{const a=before.get(b.sourceClass+':'+b.fid);return a&&['pf','pt','qf','qt'].some(k=>{const x=a[k as 'pf'],y=b[k as 'pf'];return typeof x==='number'&&typeof y==='number'&&Number.isFinite(x)&&Number.isFinite(y)&&Math.abs(y-x)>1e-7;});}).map(b=>`${b.sourceClass}:${b.fid}:postLoadingPercent`)])];
        try{await options.onCaseDetail?.(c.outage.caseId,{post,changes});}catch{c.reason+='; DETAIL_STORAGE_UNAVAILABLE';}
        const detailed=result.cases.filter(row=>row.mapResults&&row!==c);for(const old of detailed.slice(0,Math.max(0,detailed.length-retain+1))){delete old.mapResults;delete old.constraintChanges;delete old.constraints;}
        c.constraints=changes.filter(r=>r.postSeverity!==null&&r.postSeverity>0&&r.post!==null&&r.limit!==null).map(r=>({sourceClass:r.sourceClass,fid:r.fid,metric:r.metric,value:r.post!,limit:r.limit!}));
        c.voltageViolations=changes.filter(r=>r.metric==='voltagePu'&&r.postSeverity!==null&&r.postSeverity>0).length;
        const rated=post.branches.filter(b=>b.loading.operationalPercent!==null&&Number.isFinite(b.loading.operationalPercent));c.unknownRatings=post.branches.length-rated.length;c.maxLoadingPercent=rated.length?Math.max(...rated.map(b=>b.loading.operationalPercent!)):null;c.thermalViolations=rated.filter(b=>b.loading.operationalPercent!>operationalLimits(policy,policy.limitProfiles,b.voltageKv??NaN,b.ytmIds).operationalLoadingLimitPercent).length;
        const byKey=new Map(post.branches.map(b=>[`${b.sourceClass}:${b.fid}`,b]));const observed=new Map((options.observations??[]).filter(o=>!o.caseId||o.caseId===c.outage.caseId).map(o=>[stableJson(o),o]));
        c.observations=[...observed.values()].map(o=>{const b=byKey.get(`${o.sourceClass}:${o.fid}`),voltage=o.metric==='postVoltagePu'?post.buses.find(b=>b.terms.includes(o.fid))?.vmPu:null;return {...o,value:o.metric==='postVoltagePu'?voltage??null:b?postBranchMetric(b,o.metric,o.side):null,...(b&&o.metric.includes('Loading')?{loading:b.loading}:{})};});
      }
      c.status=ac.status==='CONVERGED'?(c.thermalViolations||c.voltageViolations?'AC_CONVERGED_VIOLATION':'AC_CONVERGED_WITHIN_LIMIT'):ac.status==='PARTIAL_SOLUTION'?'PARTIAL_SOLUTION':ac.status==='DIVERGED'?'AC_DIVERGED':ac.status==='CANCELLED'?(aborted()?'CANCELLED':options.adaptiveAcTimeBudget?'NOT_EVALUATED_BUDGET':'BLOCKED'):'BLOCKED';
      if(c.acSolved)c.quality=ac.status==='CONVERGED'&&result.base?.fidelity==='CONTROL_VERIFIED'?'NATIVE_COMPUTED':'ENGINEERING_APPROX';
      if(c.acSolved&&ac.status==='CONVERGED'&&result.base?.fidelity!=='CONTROL_VERIFIED'){c.status='PARTIAL_SOLUTION';c.reason+='; BASE_CONTROL_FIDELITY_PARTIAL; NOT_PF_PARITY';}
      if(c.unknownRatings)c.reason+='; UNKNOWN_RATINGS; NO_ALL_CLEAR';
    }catch(e){c.status=aborted()?'CANCELLED':/TIME_BUDGET/.test(String(e))&&options.adaptiveAcTimeBudget?'NOT_EVALUATED_BUDGET':'BLOCKED';c.reason=String(e);c.elapsedMs=performance.now()-caseStarted;}
    observedCaseMs=Math.max(observedCaseMs*.7,(performance.now()-caseStarted));checkpoint();
  }
  result.status=aborted()?'CANCELLED':result.base?.fidelity!=='CONTROL_VERIFIED'||result.excludedCatalogCount>0||result.cases.some(c=>c.unknownRatings>0||!['AC_CONVERGED_WITHIN_LIMIT','AC_CONVERGED_VIOLATION'].includes(c.status))?'PARTIAL':'COMPLETE';phase('REPORT');checkpoint();return result;
}
