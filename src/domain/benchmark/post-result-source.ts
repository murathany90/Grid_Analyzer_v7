import type {MetricOptions} from './calculated-comparison';
import {scenarioSignature} from '../scenario/overlay';
import {activeAnalysisSettings,analysisSettingsHash,defaultAnalysisSettings,type AnalysisSettings} from '../calculation/analysis-settings';
import type {CalculationResult} from '../results/types';
import type {CanonicalNetwork} from '../model/network';
import type {ScenarioOverlay} from '../scenario/overlay';
import {stableJson} from '../calculation/identity';
import {postResultAssembler,type PostMapResults} from '../../analysis/contingency-ac/post-results';
/** Manual result takes priority only for the identical snapshot/case. */
export function resolveN1Post(o:MetricOptions,caseId:string):{post:PostMapResults;status:string;source:string;outage:import('../../analysis/contingency-ac').AcOutage}|null {
  const n=o.network,s=o.scenario;if(!n||!s)return null;
  const ac=o.ac?.find(c=>c.outage.caseId===caseId&&['CONVERGED','PARTIAL_SOLUTION'].includes(c.status)&&c.identity.modelHash===n.modelHash&&c.identity.baseScenarioHash===scenarioSignature(s)&&(!o.settings||c.identity.settingsHash===stableJson(o.settings)));
  if(ac?.result)return {post:postResultAssembler(n,ac.result,'nominal'),status:ac.status,source:'MANUAL_FULL_AC',outage:ac.outage};
  const h=o.hybrid;if(!h||h.identity.modelHash!==n.modelHash||h.identity.scenarioHash!==scenarioSignature(s)||o.settings&&h.identity.settingsHash!==stableJson(o.settings))return null;
  const c=h.cases.find(c=>c.outage.caseId===caseId&&['AC_CONVERGED_WITHIN_LIMIT','AC_CONVERGED_VIOLATION','PARTIAL_SOLUTION'].includes(c.status));
  return c?.mapResults?{post:c.mapResults,status:c.status,source:'HYBRID_FULL_AC',outage:c.outage}:null;
}

export function lfSnapshotIsCurrent(r:CalculationResult|null,n:CanonicalNetwork|null,s:ScenarioOverlay,settings?:AnalysisSettings):boolean{
  if(!r?.converged||!r.identity||r.identity.modelHash!==n?.modelHash||r.identity.scenarioHash!==scenarioSignature(s))return false;
  if(!settings)return true;
  try{const opts=JSON.parse(r.identity.optionsHash);return opts.analysisSettingsHash?opts.analysisSettingsHash===analysisSettingsHash(settings,'powerFlow'):stableJson(activeAnalysisSettings(opts.analysisSettings??defaultAnalysisSettings(),'powerFlow'))===stableJson(activeAnalysisSettings(settings,'powerFlow'));}catch{return false;}
}
