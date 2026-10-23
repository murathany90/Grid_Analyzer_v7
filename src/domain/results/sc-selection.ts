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
 const sc3F=currentScResult(ctx);
 const study=ctx.ytmStudy,mode=sc3F?.profile.calculateMode??'MAX';
 let r=ctx.scResult1Lg;
 if(!r&&study&&ctx.network&&ytmStudyIsCurrent(study,ctx.network,ctx.scenario.current,ctx.analysisSettings.value,ctx.studyOptions)&&study.options.ytmId===ctx.filters.areaId){
  r=mode==='MIN'?study.sc1LgMin??null:study.sc1LgMax??null;
 }
 if(!r||r.identity.modelHash!==ctx.network?.modelHash||r.identity.scenarioHash!==scenarioSignature(ctx.scenario.current))return null;
 const w=r.workspaceScope;if(w&&(w.ytmId!==ctx.filters.areaId||w.settingsHash!==stableJson(ctx.analysisSettings.value)||ctx.studyOptions&&w.optionsKey!==studyScopeKey(ctx.studyOptions)))return null;
 if(sc3F){
  const validMethod = r.profile.faultType === '1LG' && (sc3F.profile.calculateMode === 'MAX' ? (r.method === 'GA_SEQUENCE_1LG_MAX' || !r.method) : (r.method === 'GA_SEQUENCE_1LG_MIN' || !r.method));
  if(r.identity.modelHash!==sc3F.identity.modelHash||r.identity.scenarioHash!==sc3F.identity.scenarioHash||r.identity.sourceHash!==sc3F.identity.sourceHash||r.profile.calculateMode!==sc3F.profile.calculateMode||!validMethod){
   return null;
  }
 }
 return r;
}
export function selectScMode(ctx:AppContext,mode:'MAX'|'MIN'){
 const study=ctx.ytmStudy;if(!study||!ctx.network||!ytmStudyIsCurrent(study,ctx.network,ctx.scenario.current,ctx.analysisSettings.value,ctx.studyOptions)||study.options.ytmId!==ctx.filters.areaId)return false;
 const r=mode==='MAX'?study.scMax:study.scMin;if(!r||r.identity.modelHash!==study.identity.modelHash||r.identity.scenarioHash!==study.identity.scenarioHash||r.profile.calculateMode!==mode)return false;
 // A legacy standalone result cannot be mistaken for the workspace pair.
 if(ctx.scResult&&ctx.scResult!==study.scMax&&ctx.scResult!==study.scMin)return false;
 ctx.scResult=r;
 const r1=mode==='MAX'?study.sc1LgMax??null:study.sc1LgMin??null;
 if(r1&&r1.identity.modelHash===r.identity.modelHash&&r1.identity.scenarioHash===r.identity.scenarioHash&&r1.identity.sourceHash===r.identity.sourceHash&&r1.profile.calculateMode===mode&&(mode==='MAX'?r1.method==='GA_SEQUENCE_1LG_MAX':r1.method==='GA_SEQUENCE_1LG_MIN')){
  ctx.scResult1Lg=r1;
 }else{
  ctx.scResult1Lg=null;
 }
 if(ctx.benchmarkMap?.analysis==='SC'){
  ctx.benchmarkMap={...ctx.benchmarkMap,scMode:mode};
 }else{
  ctx.benchmarkMap=null;
 }
 return true;
}
