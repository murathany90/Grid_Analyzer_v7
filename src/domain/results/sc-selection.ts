import {scResultIsAdmissible} from '../../analysis/short-circuit/result-validity';
import type {AppContext} from '../../app/contracts';
import {scenarioSignature} from '../scenario/overlay';
import {stableJson} from '../calculation/identity';
import {studyScopeKey,ytmStudyIsCurrent} from '../../analysis/ytm-study';
/** The selected mode is a pointer to the existing immutable result, never a copy. */
export function currentScResult(ctx:AppContext){
 const r=ctx.scResult;if(!r?.profile||!r.identity||!ctx.network)return null;
 if(ctx.resultView?.scMode&&ctx.resultView.scMode!==r.profile.calculateMode)return null;
 const study=ctx.ytmStudy,mode=r.profile.calculateMode,studySource=study&&(r===study.scMax||r===study.scMin)?(mode==='MAX'?study.identity.sourceHashMAX:study.identity.sourceHashMIN):undefined;
 if(!scResultIsAdmissible(r,{modelHash:ctx.network.modelHash,scenarioHash:scenarioSignature(ctx.scenario.current),mode,faultType:'3PH',sourceHash:studySource,context:ctx.scContext?.calculateMode===mode?ctx.scContext:studySource?undefined:ctx.scContext}))return null;
 const w=r.workspaceScope;if(w&&(w.ytmId!==ctx.filters.areaId||w.settingsHash!==stableJson(ctx.analysisSettings.value)||ctx.studyOptions&&w.optionsKey!==studyScopeKey(ctx.studyOptions)))return null;
 return r;
}
export function selectScMode(ctx:AppContext,mode:'MAX'|'MIN'){
 const study=ctx.ytmStudy;if(!study||!ctx.network||!ytmStudyIsCurrent(study,ctx.network,ctx.scenario.current,ctx.analysisSettings.value,ctx.studyOptions)||study.options.ytmId!==ctx.filters.areaId)return false;
 const r=mode==='MAX'?study.scMax:study.scMin;if(!scResultIsAdmissible(r,{...study.identity,mode,faultType:'3PH',sourceHash:mode==='MAX'?study.identity.sourceHashMAX:study.identity.sourceHashMIN}))return false;
 // A legacy standalone result cannot be mistaken for the workspace pair.
 if(ctx.scResult&&ctx.scResult!==study.scMax&&ctx.scResult!==study.scMin)return false;
 ctx.scResult=r;ctx.resultView.scMode=mode;
 if(ctx.benchmarkMap?.analysis==='SC'){
  ctx.benchmarkMap={...ctx.benchmarkMap,scMode:mode};
 }else{
  ctx.benchmarkMap=null;
 }
 return true;
}
