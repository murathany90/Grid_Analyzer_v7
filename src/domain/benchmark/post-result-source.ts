import type {MetricOptions} from './calculated-comparison';
import {scenarioSignature} from '../scenario/overlay';
import {activeAnalysisSettings,analysisSettingsHash,defaultAnalysisSettings,type AnalysisSettings} from '../calculation/analysis-settings';
import type {CalculationResult} from '../results/types';
import type {CanonicalNetwork} from '../model/network';
import type {ScenarioOverlay} from '../scenario/overlay';
import {hybridStudyIsCurrent} from '../../analysis/contingency-hybrid/profile';
import {loadingEquipment} from '../results/loading-presentation';
import {stableJson} from '../calculation/identity';
import {postResultAssembler,type PostMapResults} from '../../analysis/contingency-ac/post-results';
import type {AcContingency} from '../../analysis/contingency-ac';
import type {HybridResult,HybridCase} from '../../analysis/contingency-hybrid';
import type {N1ScreenResult} from '../n1';
export interface N1ResultSelection {
  source:'MANUAL_FULL_AC'|'HYBRID_FULL_AC'|'HYBRID_RUN'|'GA_DC_SCREEN'|'NOT_RUN';current:boolean;
  ac?:AcContingency;hybrid?:HybridResult;hybridCase?:HybridCase;dc?:N1ScreenResult;candidate?:N1ScreenResult['candidates'][number];
}
/** One selected case/snapshot governs the table, map, result ID and evidence cards.
 * A current manual rejection shadows older hybrid/DC results for that same case.
 * A stale manual record never shadows a current matching result. */
export function selectN1Result(o:MetricOptions&{dc?:N1ScreenResult|null},caseId?:string):N1ResultSelection {
  const n=o.network,s=o.scenario;if(!n||!s)return {source:'NOT_RUN',current:true};
  const hash=scenarioSignature(s),matches:N1ResultSelection[]=[];
  if(caseId)for(const ac of [...o.ac??[]].reverse().filter(c=>c.outage.caseId===caseId))matches.push({source:'MANUAL_FULL_AC',ac,current:ac.identity.modelHash===n.modelHash&&ac.identity.baseScenarioHash===hash&&(!o.settings||ac.identity.settingsHash===stableJson(o.settings))});
  const h=o.hybrid,hc=h?.cases.find(c=>c.outage.caseId===caseId);
  if(h&&(!caseId||hc))matches.push({source:hc?'HYBRID_FULL_AC':'HYBRID_RUN',hybrid:h,hybridCase:hc,current:h.identity.modelHash===n.modelHash&&h.identity.scenarioHash===hash&&(!o.settings||hybridStudyIsCurrent(h.identity.settingsHash,o.settings,h.studyProfile))});
  const dc=o.dc,c=caseId?dc?.candidates.find(c=>{const e=loadingEquipment(n).get(c.sourceClass+':'+c.equipmentId);return caseId===`N1:${c.sourceClass}:${e?.sourceId??c.equipmentId}`;}):undefined;
  if(dc&&(!caseId||c))matches.push({source:'GA_DC_SCREEN',dc,candidate:c,current:dc.identity.modelHash===n.modelHash&&dc.identity.scenarioHash===hash});
  return matches.find(r=>r.current)??matches[0]??{source:'NOT_RUN',current:true};
}
/** Manual result takes priority only for the identical snapshot/case. */
export function resolveN1Post(o:MetricOptions,caseId:string):{post:PostMapResults;status:string;source:string;outage:import('../../analysis/contingency-ac').AcOutage}|null {
  const n=o.network,selection=selectN1Result(o,caseId);if(!n||!selection.current)return null;
  const ac=selection.ac;
  if(ac)return ac.result&&['CONVERGED','PARTIAL_SOLUTION'].includes(ac.status)?{post:postResultAssembler(n,ac.result,'nominal'),status:ac.status,source:'MANUAL_FULL_AC',outage:ac.outage}:null;
  const c=selection.hybridCase;if(!c||!['AC_CONVERGED_WITHIN_LIMIT','AC_CONVERGED_VIOLATION','PARTIAL_SOLUTION'].includes(c.status))return null;
  return c?.mapResults?{post:c.mapResults,status:c.status,source:'HYBRID_FULL_AC',outage:c.outage}:null;
}

export function lfSnapshotIsCurrent(r:CalculationResult|null,n:CanonicalNetwork|null,s:ScenarioOverlay,settings?:AnalysisSettings):boolean{
  if(!r?.converged||!r.identity||r.identity.modelHash!==n?.modelHash||r.identity.scenarioHash!==scenarioSignature(s))return false;
  if(!settings)return true;
  try{const opts=JSON.parse(r.identity.optionsHash);return opts.analysisSettingsHash?opts.analysisSettingsHash===analysisSettingsHash(settings,'powerFlow'):stableJson(activeAnalysisSettings(opts.analysisSettings??defaultAnalysisSettings(),'powerFlow'))===stableJson(activeAnalysisSettings(settings,'powerFlow'));}catch{return false;}
}
