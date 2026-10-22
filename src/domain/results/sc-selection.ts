import type {AppContext} from '../../app/contracts';
import {scenarioSignature} from '../scenario/overlay';
import {stableJson} from '../calculation/identity';
import {studyScopeKey,ytmStudyIsCurrent} from '../../analysis/ytm-study';
/** The selected mode is a pointer to the existing immutable result, never a copy. */
export function currentScResult(ctx:AppContext){
 const r=ctx.scResult;if(!r||r.identity.modelHash!==ctx.network?.modelHash||r.identity.scenarioHash!==scenarioSignature(ctx.scenario.current))return null;
 const w=r.workspaceScope;if(w&&(w.ytmId!==ctx.filters.areaId||w.settingsHash!==stableJson(ctx.analysisSettings.value)||ctx.studyOptions&&w.optionsKey!==studyScopeKey(ctx.studyOptions)))return null;
 return r;
}
export function selectScMode(ctx:AppContext,mode:'MAX'|'MIN'){
 const study=ctx.ytmStudy;if(!study||!ctx.network||!ytmStudyIsCurrent(study,ctx.network,ctx.scenario.current,ctx.analysisSettings.value,ctx.studyOptions)||study.options.ytmId!==ctx.filters.areaId)return false;
 const r=mode==='MAX'?study.scMax:study.scMin;if(!r||r.identity.modelHash!==study.identity.modelHash||r.identity.scenarioHash!==study.identity.scenarioHash||r.profile.calculateMode!==mode)return false;
 // A legacy standalone result cannot be mistaken for the workspace pair.
 if(ctx.scResult&&ctx.scResult!==study.scMax&&ctx.scResult!==study.scMin)return false;
 ctx.scResult=r;ctx.benchmarkMap=null;return true;
}
