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
export function currentScResult1Lg(ctx:AppContext){
 const study=ctx.ytmStudy,mode=ctx.scResult?.profile.calculateMode??'MAX';
 let r=ctx.scResult1Lg;
 if(!r&&study&&ctx.network&&ytmStudyIsCurrent(study,ctx.network,ctx.scenario.current,ctx.analysisSettings.value,ctx.studyOptions)&&study.options.ytmId===ctx.filters.areaId){
  r=mode==='MIN'?study.sc1LgMin??null:study.sc1LgMax??null;
 }
 if(!r||r.identity.modelHash!==ctx.network?.modelHash||r.identity.scenarioHash!==scenarioSignature(ctx.scenario.current))return null;
 const w=r.workspaceScope;if(w&&(w.ytmId!==ctx.filters.areaId||w.settingsHash!==stableJson(ctx.analysisSettings.value)||ctx.studyOptions&&w.optionsKey!==studyScopeKey(ctx.studyOptions)))return null;
 return r;
}
export function selectScMode(ctx:AppContext,mode:'MAX'|'MIN'){
 const study=ctx.ytmStudy;if(!study||!ctx.network||!ytmStudyIsCurrent(study,ctx.network,ctx.scenario.current,ctx.analysisSettings.value,ctx.studyOptions)||study.options.ytmId!==ctx.filters.areaId)return false;
 const r=mode==='MAX'?study.scMax:study.scMin;if(!r||r.identity.modelHash!==study.identity.modelHash||r.identity.scenarioHash!==study.identity.scenarioHash||r.profile.calculateMode!==mode)return false;
 // A legacy standalone result cannot be mistaken for the workspace pair.
 if(ctx.scResult&&ctx.scResult!==study.scMax&&ctx.scResult!==study.scMin)return false;
 ctx.scResult=r;
 ctx.scResult1Lg=mode==='MAX'?study.sc1LgMax??null:study.sc1LgMin??null;
 ctx.benchmarkMap=null;return true;
}
