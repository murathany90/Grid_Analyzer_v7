import type { CanonicalNetwork } from '../../domain/model/network';
import type { ScenarioOverlay } from '../../domain/scenario/overlay';
import type { AnalysisSettings } from '../../domain/calculation/analysis-settings';
import type { CalculationResult } from '../../domain/results/types';
import { effectiveNetwork, scenarioSignature } from '../../domain/scenario/overlay';
import { identity, stableJson } from '../../domain/calculation/identity';
import { BrowserJsPowerFlowEngine } from '../api/browser-js-engine';
import { prepareModel } from '../power-flow/preparation';
import { buildTopology } from '../../topology/electrical-topology';
import { sha256 } from '@noble/hashes/sha2.js';

export type AcContingencyStatus='CONVERGED'|'PARTIAL_SOLUTION'|'DIVERGED'|'ISLAND_UNSUPPLIED'|'UNSUPPORTED_CONTROL_CONFIGURATION'|'CANCELLED'|'NOT_COMPUTABLE';
export interface AcOutage {caseId:string;sourceClass:'ElmLne'|'ElmTr2';fid:string}
export interface AcContingency {
  outage:AcOutage;method:'GA_AC_POST_CONTINGENCY';status:AcContingencyStatus;reason:string;
  identity:{modelHash:string;baseScenarioHash:string;scenarioHash:string;settingsHash:string;topologyIdentity:string;key:string};
  components?:{islandId:string;status:'SUPPLIED_COMPONENT'|'UNSUPPLIED_COMPONENT'|'UNSUPPORTED_COMPONENT';busCount:number}[];
  result:CalculationResult|null;unsuppliedLoadMw?:number;elapsedMs:number;branchApparentPower:{sourceClass:string;fid:string;sfMva:number;stMva:number;loadingPercent:number|null}[];
}
export interface AcValidationOptions {maxCases?:number;timeBudgetMs?:number;maxBuses?:number;analysisSettings?:AnalysisSettings;signal?:AbortSignal;onProgress?:(stage:string,detail?:Record<string,unknown>)=>void}
/** Opt-in service only. A copied overlay is the sole solver input change. */
export async function validateAcOutages(network:CanonicalNetwork,scenario:ScenarioOverlay,outages:readonly AcOutage[],options:AcValidationOptions={}):Promise<AcContingency[]>{
  const max=options.maxCases??3,budget=options.timeBudgetMs??120000,start=performance.now();
  if(!Number.isInteger(max)||max<1||max>5||outages.length>max)throw Error('N1_AC_CASE_BUDGET: select at most 5 cases');
  if(!(budget>0&&budget<=300000))throw Error('N1_AC_TIME_BUDGET');
  const seen=new Set<string>(),results:AcContingency[]=[];
  for(const outage of outages){
    const started=performance.now(),copy=structuredClone(scenario),baseScenarioHash=scenarioSignature(scenario),settingsHash=stableJson(options.analysisSettings??{}),key=stableJson({modelHash:network.modelHash,baseScenarioHash,settingsHash,outage});
    if(seen.has(key))throw Error('N1_AC_DUPLICATE_CASE');seen.add(key);
    const row:AcContingency={outage:{...outage},method:'GA_AC_POST_CONTINGENCY',status:'NOT_COMPUTABLE',reason:'',identity:{modelHash:network.modelHash,baseScenarioHash,scenarioHash:'',settingsHash,topologyIdentity:'',key},result:null,elapsedMs:0,branchApparentPower:[]};
    const finish=()=>{row.elapsedMs=performance.now()-started;results.push(row);};
    if(outage.caseId.startsWith('N1:')&&outage.caseId!==`N1:${outage.sourceClass}:${outage.fid}`){row.reason='N1_CASE_ID_OUTAGE_IDENTITY_MISMATCH';finish();continue;}
    if(options.signal?.aborted||performance.now()-start>budget){row.status='CANCELLED';row.reason=options.signal?.aborted?'CANCELLED':'TIME_BUDGET';finish();continue;}
    const collection=outage.sourceClass==='ElmLne'?network.lines:network.transformers,candidates=collection.filter(e=>e.sourceId===outage.fid&&e.sourceClass===outage.sourceClass);
    if(candidates.length!==1){row.reason='UNMATCHED_OR_AMBIGUOUS_FID';finish();continue;}
    const target=candidates[0],base=effectiveNetwork(network,scenario),topology=buildTopology(base);
    const effective=(outage.sourceClass==='ElmLne'?base.lines:base.transformers).find(e=>e.id===target.id);
    if(!effective?.inService||topology.blockedEquipment.has(target.id)||!topology.terminalToBus.has(target.from)||!topology.terminalToBus.has(target.to)){row.reason='OUTAGE_NOT_IN_SERVICE_OR_DISCONNECTED';finish();continue;}
    const overlay:ScenarioOverlay=outage.sourceClass==='ElmLne'?{...copy,lineStatus:{...copy.lineStatus,[target.id]:false}}:{...copy,transformerStatus:{...copy.transformerStatus,[target.id]:false}};
    row.identity.scenarioHash=scenarioSignature(overlay);
    const post=effectiveNetwork(network,overlay),prepared=prepareModel(post),postTopology=prepared.topology;
    row.identity.topologyIdentity=Array.from(sha256(new TextEncoder().encode(stableJson({buses:postTopology.buses.map(b=>[b.id,...b.terms]),branches:prepared.branches.map(b=>[b.id,b.i,b.j])}))),v=>v.toString(16).padStart(2,'0')).join('');
    if(postTopology.buses.length>(options.maxBuses??20000)){row.reason='MEMORY_BUS_BUDGET';finish();continue;}
    const islands=prepared.diagnostics.islands as {status:string;islandId:string;busCount:number}[]|undefined;
    const missing=topology.buses.filter(bus=>bus.terms.some(fid=>!postTopology.terminalToBus.has(fid))).length;
    row.components=(islands??[]).map(i=>({islandId:i.islandId,busCount:i.busCount,status:i.status==='NO_REFERENCE'?'UNSUPPLIED_COMPONENT':i.status==='MULTIPLE_REFERENCE_PARTIAL'?'UNSUPPORTED_COMPONENT':'SUPPLIED_COMPONENT'}));
    if(missing)row.components.push({islandId:'detached-terminal-groups',busCount:missing,status:'UNSUPPLIED_COMPONENT'});
    const suppliedTerminals=new Set([prepared,...prepared.additionalIslands??[]].flatMap(m=>m.buses.flatMap(b=>b.terms)));
    row.unsuppliedLoadMw=post.loads.filter(l=>l.inService&&!suppliedTerminals.has(l.bus)).reduce((sum,l)=>sum+Math.max(0,l.pMw),0);
    const partial=row.components.some(i=>i.status==='UNSUPPLIED_COMPONENT');
    if(islands?.some(i=>i.status==='MULTIPLE_REFERENCE_PARTIAL')){row.status='UNSUPPORTED_CONTROL_CONFIGURATION';row.reason='MULTIPLE_REFERENCE_PARTIAL';finish();continue;}
    if(!row.components.some(i=>i.status==='SUPPLIED_COMPONENT')){row.status='ISLAND_UNSUPPLIED';row.reason='NO_SOURCE_SLACK_IN_POST_OUTAGE_ISLAND';finish();continue;}
    options.onProgress?.('N1_AC_VALIDATE',{message:`AC kesinti doğrulaması: ${outage.caseId}`});
    const result=await new BrowserJsPowerFlowEngine().runPowerFlow({network,scenario:overlay,identity:identity(network.modelHash,overlay,'powerFlow',{analysisSettings:options.analysisSettings,contingency:key}),analysisSettings:options.analysisSettings},options.onProgress);
    if(options.signal?.aborted||performance.now()-start>budget){row.status='CANCELLED';row.reason='CANCELLED_OR_TIME_BUDGET';finish();continue;}
    const controls=result.diagnostics.stationControllerSummary as {unsupported?:number;unsupportedProfile?:number}|undefined;
    if((options.analysisSettings?.powerFlow.stationControlMode??'off')!=='off'&&((controls?.unsupported??0)>0||(controls?.unsupportedProfile??0)>0)){row.status='UNSUPPORTED_CONTROL_CONFIGURATION';row.reason='UNSUPPORTED_STATION_CONTROL';}
    else if(!result.converged){row.status='DIVERGED';row.reason=result.status;}
    else if(result.maxMismatchMw===null||!Number.isFinite(result.maxMismatchMw)){row.status='NOT_COMPUTABLE';row.reason='MISSING_PHYSICAL_RESIDUAL';}
    else{row.status=partial?'PARTIAL_SOLUTION':'CONVERGED';row.reason=partial?'UNSUPPLIED_COMPONENTS_EXCLUDED_FROM_NUMERICAL_SOLUTION':'';if((options.analysisSettings?.powerFlow.stationControlMode??'off')==='off'&&post.stationControllers.some(c=>c.inService))row.reason+='; STATION_CONTROL_OFF_LOCAL_PV_PROFILE; CONTROL_FIDELITY_PARTIAL';row.result=result;row.branchApparentPower=result.branches.map(b=>({sourceClass:b.sourceClass,fid:b.id,sfMva:Math.hypot(b.pf,b.qf),stMva:Math.hypot(b.pt,b.qt),loadingPercent:b.loading}));}
    finish();
  }
  return results;
}
