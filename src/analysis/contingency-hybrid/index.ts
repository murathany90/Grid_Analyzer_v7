import type {CanonicalNetwork} from '../../domain/model/network';
import type {ScenarioOverlay} from '../../domain/scenario/overlay';
import {effectiveNetwork,scenarioSignature} from '../../domain/scenario/overlay';
import {identity,stableJson} from '../../domain/calculation/identity';
import type {AnalysisSettings} from '../../domain/calculation/analysis-settings';
import type {CalculationResult} from '../../domain/results/types';
import {buildN1CandidateCatalog,filterN1CatalogCandidates,type N1CatalogFilter} from '../../domain/n1/catalog';
import {runN1Screen,type N1ScreenCandidate,type N1ScreenOptions,type N1ScreenResult} from '../../domain/n1';
import {BrowserJsPowerFlowEngine} from '../api/browser-js-engine';
import {prepareModel} from '../power-flow/preparation';
import {validateAcOutages,type AcOutage,type AcContingency} from '../contingency-ac';
import type {CapacitySeason} from '../../domain/model/capacity';
import {capacityLimit} from '../../domain/model/capacity';

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
  // Only requested affected elements; complete result arrays are not retained by default.
  observations:{sourceClass:string;fid:string;metric:string;side?:string;caseId?:string;value:number|null}[];
}
export interface HybridResult {
  method:'GA_DC_TO_FULL_AC';identity:{modelHash:string;scenarioHash:string;settingsHash:string;optionsHash:string};
  policy:HybridPolicy;filter:N1CatalogFilter;season:CapacitySeason;phase:string;status:'COMPLETE'|'PARTIAL'|'BLOCKED'|'CANCELLED';reason:string;
  base:{status:string;converged:boolean;iterations:number;maxMismatchMw:number|null}|null;catalogCount:number;excludedCatalogCount:number;
  cases:HybridCase[];counts:Record<string,number>;dcDiagnostics:N1ScreenResult['dcDiagnostics']|null;elapsedMs:number;
}
export interface HybridOptions {
  policy?:Partial<HybridPolicy>;filter?:N1CatalogFilter;season?:CapacitySeason;analysisSettings?:AnalysisSettings;
  selectedCandidateIds?:string[];catalogCandidateIds?:string[];resume?:HybridResult;signal?:AbortSignal;
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
const snapshot=(n:CanonicalNetwork,s:ScenarioOverlay,o:HybridOptions,p:HybridPolicy)=>({modelHash:n.modelHash,scenarioHash:scenarioSignature(s),settingsHash:stableJson(o.analysisSettings??{}),optionsHash:stableJson({policy:p,filter:o.filter??{},season:o.season??'nominal',catalogCandidateIds:o.catalogCandidateIds??null,selectedCandidateIds:[...(o.selectedCandidateIds??[])].sort(),observations:o.observations??[]})});
export function hybridIsCurrent(r:HybridResult,n:CanonicalNetwork,s:ScenarioOverlay,settings:AnalysisSettings):boolean{return r.identity.modelHash===n.modelHash&&r.identity.scenarioHash===scenarioSignature(s)&&r.identity.settingsHash===stableJson(settings);}
/** Sequential budgeted orchestration; the original >=66kV DC algorithm is untouched. */
export async function runHybridN1(network:CanonicalNetwork,scenario:ScenarioOverlay,options:HybridOptions={}):Promise<HybridResult>{
  const start=performance.now(),policy={...DEFAULT_HYBRID_POLICY,...options.policy},filter=options.filter??{},season=options.season??'nominal';
  if(!Number.isInteger(policy.acBudgetCases)||policy.acBudgetCases<0||policy.acBudgetCases>100||policy.concurrency!==1||!Number.isFinite(policy.dcPromotionLoadingPercent)||policy.dcPromotionLoadingPercent<0||!(policy.operationalLoadingLimitPercent>0)||!(policy.voltageMinPu>0&&policy.voltageMinPu<policy.voltageMaxPu)||!(policy.perCaseTimeLimitMs>0&&policy.perCaseTimeLimitMs<=300000)||!(policy.globalTimeLimitMs>0&&policy.globalTimeLimitMs<=1800000))throw Error('HYBRID_INVALID_POLICY');
  const id=snapshot(network,scenario,options,policy);
  if(options.resume&&stableJson(options.resume.identity)!==stableJson(id))throw Error('HYBRID_STALE_RESUME');
  const resume=options.resume?.cases.length?options.resume:undefined;
  const result:HybridResult=resume?structuredClone(resume):{method:'GA_DC_TO_FULL_AC',identity:id,policy,filter,season,phase:'MODEL_SCENARIO_OPTIONS_SNAPSHOT',status:'PARTIAL',reason:'',base:null,catalogCount:0,excludedCatalogCount:0,cases:[],counts:{},dcDiagnostics:null,elapsedMs:0};
  const checkpoint=()=>{result.elapsedMs=performance.now()-start;result.counts={total:result.cases.length,catalog:result.catalogCount,excludedCatalog:result.excludedCatalogCount,promoted:result.cases.filter(c=>c.promotionReasons.length).length,AC_CALCULATED:result.cases.filter(c=>c.iterations!==null).length,NOT_RUN:result.cases.filter(c=>c.status==='NOT_RUN_BUDGET'||c.status==='CANCELLED').length,UNKNOWN:result.cases.filter(c=>c.unknownRatings>0||['PARTIAL_SOLUTION','BLOCKED','ISLAND_UNSUPPLIED'].includes(c.status)).length,dcRiskConfirmedAc:result.cases.filter(c=>c.dcStatus==='SCREENED_VIOLATION'&&c.status==='AC_CONVERGED_VIOLATION').length,dcViolationsNotConfirmedAc:result.cases.filter(c=>c.dcStatus==='SCREENED_VIOLATION'&&c.status==='AC_CONVERGED_WITHIN_LIMIT').length,dcClearViolatedAc:result.cases.filter(c=>c.dcStatus==='SCREENED_NO_VIOLATION'&&c.status==='AC_CONVERGED_VIOLATION').length};for(const c of result.cases)result.counts[c.status]=(result.counts[c.status]??0)+1;options.onCheckpoint?.(structuredClone(result));};
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
      result.base={status:base.status,converged:base.converged,iterations:base.iterations,maxMismatchMw:base.maxMismatchMw};
      const controls=base.diagnostics.stationControllerSummary as {unsupported?:number;unsupportedProfile?:number}|undefined;
      if(!base.converged||base.maxMismatchMw===null||!Number.isFinite(base.maxMismatchMw)||(options.analysisSettings?.powerFlow.stationControlMode??'off')!=='off'&&((controls?.unsupported??0)>0||(controls?.unsupportedProfile??0)>0)){result.status='BLOCKED';result.reason='BASE_FULL_AC_NOT_VERIFIED';checkpoint();return result;}
      if((options.analysisSettings?.powerFlow.stationControlMode??'off')==='off'&&network.stationControllers.some(c=>c.inService))result.reason='STATION_CONTROL_OFF_LOCAL_PV_PROFILE; CONTROL_FIDELITY_PARTIAL; NOT_PF_METHOD_PARITY';
    }catch(e){result.status=aborted()?'CANCELLED':'BLOCKED';result.reason=String(e);checkpoint();return result;}
    if(aborted()||remaining()<=0){result.status=aborted()?'CANCELLED':'PARTIAL';result.reason='BASE_CANCELLED_OR_GLOBAL_BUDGET';checkpoint();return result;}
    phase('BUILD_CATALOG');
    const catalog=filterN1CatalogCandidates(buildN1CandidateCatalog(network,scenario,{capacitySeason:season}).candidates,filter),fullAllowed=new Set(catalog.map(c=>c.candidateId));
    if(options.catalogCandidateIds?.some(c=>!fullAllowed.has(c)))throw Error('HYBRID_CATALOG_SELECTION_OUTSIDE_SCOPE');
    const allowed=new Set(options.catalogCandidateIds??fullAllowed);
    result.catalogCount=catalog.length;result.excludedCatalogCount=catalog.length-allowed.size;
    if(options.selectedCandidateIds?.some(c=>!allowed.has(c)))throw Error('HYBRID_SELECTION_OUTSIDE_SCOPE_OR_UNKNOWN_FID');
    phase('RUN_DC_SCREEN');
    const screenOptions:N1ScreenOptions={candidateTypes:[...(filter.sourceClasses??['ElmLne','ElmTr2'])],minVoltageKv:filter.minVoltageKv,maxVoltageKv:filter.maxVoltageKv,capacitySeason:season,selectedCandidateIds:[...allowed],analysisScope:'scenario'};
    let dc:N1ScreenResult;
    try{dc=options.screen?await options.screen(screenOptions,remaining()):await runN1Screen(network,scenario,screenOptions,{signal:options.signal,onProgress:p=>options.onProgress?.(p.stage,{...p})});}
    catch(e){result.status=aborted()?'CANCELLED':'BLOCKED';result.reason=String(e);checkpoint();return result;}
    result.dcDiagnostics=dc.dcDiagnostics;phase('ASSESS_PROMOTION');
    const equipment=new Map([...network.lines,...network.transformers].map(e=>[`${e.sourceClass}:${e.id}`,e.sourceId]));
    result.cases=dc.candidates.map(c=>{const reasons=promotionReasons(c,policy,options.selectedCandidateIds?.includes(c.candidateId)),fid=equipment.get(c.candidateId)??c.equipmentId,clear=c.status==='SCREENED_NO_VIOLATION'&&c.outageRatingAvailable&&c.ratingCoverage.percent===100;return {outage:{sourceClass:c.sourceClass,fid,caseId:`N1:${c.sourceClass}:${fid}`},candidateId:c.candidateId,promotionReasons:reasons,dcStatus:c.status,status:reasons.length?'NOT_RUN_BUDGET':clear?'DC_CLEAR_NOT_AC_VERIFIED':'BLOCKED',reason:reasons.length?'AC_QUEUE_PENDING':clear?'DC_P_ONLY; AC_NOT_VERIFIED':'UNCERTAIN_DC_CASE_EXCLUDED_BY_USER_POLICY',iterations:null,maxMismatchMw:null,minVpu:null,maxVpu:null,maxLoadingPercent:null,unknownRatings:0,voltageViolations:0,thermalViolations:0,components:[],elapsedMs:0,observations:[]};});
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
      c.reason=ac.reason;c.components=ac.components;c.elapsedMs=ac.elapsedMs;
      const solved=ac.result;
      if(solved){c.iterations=solved.iterations;c.maxMismatchMw=solved.maxMismatchMw;c.minVpu=Math.min(...solved.buses.map(b=>b.vmPu));c.maxVpu=Math.max(...solved.buses.map(b=>b.vmPu));c.voltageViolations=solved.buses.filter(b=>b.vmPu<policy.voltageMinPu||b.vmPu>policy.voltageMaxPu).length;
        const lineById=new Map(network.lines.map(l=>[l.id,l])),transformerById=new Map(network.transformers.map(t=>[t.id,t])),postLoading=new Map(solved.branches.map(b=>{const line=lineById.get(b.id),limit=line?.capacity?capacityLimit(line.capacity,line.vnKv,season):null;const loading=b.sourceClass==='ElmLne'?limit&&Number.isFinite(limit.currentKA)&&limit.currentKA>0?100*Math.max(b.ifA,b.itA)/(1000*limit.currentKA):null:b.sourceClass==='ElmTr2'&&(!(transformerById.get(b.id)?.ratingMva!>0)||!Number.isFinite(transformerById.get(b.id)?.ratingMva)||transformerById.get(b.id)!.ratingMva>=99999)?null:b.loading;return [b.id,loading] as const;}));
        const rated=[...postLoading.values()].filter((v):v is number=>v!==null&&Number.isFinite(v));c.unknownRatings=solved.branches.length-rated.length;c.maxLoadingPercent=rated.length?Math.max(...rated):null;c.thermalViolations=rated.filter(v=>v>policy.operationalLoadingLimitPercent).length;
        const nativeIds=new Map([...network.lines,...network.transformers].map(e=>[`${e.sourceClass}:${e.sourceId}`,e.id]));const observed=new Map((options.observations??[]).filter(o=>!o.caseId||o.caseId===c.outage.caseId).map(o=>[stableJson(o),o]));c.observations=[...observed.values()].map(o=>{const b=solved.branches.find(b=>b.sourceClass===o.sourceClass&&b.id===nativeIds.get(`${o.sourceClass}:${o.fid}`));const side=o.side?.toUpperCase(),to=side==='TO'||side==='BUS2',known=!side||['FROM','BUS1','TO','BUS2'].includes(side);const values=b&&known?{postLoadingPercent:b.loading,postPmw:to?b.pt:b.pf,postQmvar:to?b.qt:b.qf,postMva:to?Math.hypot(b.pt,b.qt):Math.hypot(b.pf,b.qf)} as Record<string,number|null>:{};const voltage=o.metric==='postVoltagePu'?solved.buses.find(b=>b.terms.includes(o.fid))?.vmPu:null;const value=o.metric==='postVoltagePu'?voltage??null:values[o.metric]??null;return {...o,value:value!==null&&Number.isFinite(value)?value:null};});
      }
      c.status=ac.status==='CONVERGED'?(c.thermalViolations||c.voltageViolations?'AC_CONVERGED_VIOLATION':'AC_CONVERGED_WITHIN_LIMIT'):ac.status==='PARTIAL_SOLUTION'?'PARTIAL_SOLUTION':ac.status==='DIVERGED'?'AC_DIVERGED':ac.status==='ISLAND_UNSUPPLIED'?'ISLAND_UNSUPPLIED':ac.status==='CANCELLED'?'CANCELLED':'BLOCKED';
      if(c.unknownRatings)c.reason+='; UNKNOWN_RATINGS; NO_ALL_CLEAR';
    }catch(e){c.status=aborted()?'CANCELLED':'BLOCKED';c.reason=String(e);}
    checkpoint();
  }
  result.status=aborted()?'CANCELLED':result.excludedCatalogCount>0||result.cases.some(c=>c.unknownRatings>0||!['AC_CONVERGED_WITHIN_LIMIT','AC_CONVERGED_VIOLATION'].includes(c.status))?'PARTIAL':'COMPLETE';phase('REPORT');checkpoint();return result;
}
