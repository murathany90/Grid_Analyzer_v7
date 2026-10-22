import type {AppContext} from '../../app/contracts';
import {ytmStudyIsCurrent} from '../../analysis/ytm-study';
import {selectN1Result,lfSnapshotIsCurrent} from '../../domain/benchmark/post-result-source';
import {emptyScenario} from '../../domain/scenario/overlay';
import {stableJson} from '../../domain/calculation/identity';
import type {ScResult} from '../../analysis/short-circuit';

/** Read-only selection; a stale workspace must never fall back to its own old family. */
export function currentStudy(ctx:AppContext){
 const r=ctx.ytmStudy,n=ctx.network;
 return r&&n&&(!ctx.filters.areaId||r.options.ytmId===ctx.filters.areaId)&&(!ctx.filters.siteId||r.options.tmId===ctx.filters.siteId)&&ytmStudyIsCurrent(r,n,ctx.scenario.current,ctx.analysisSettings.value,ctx.studyOptions)?r:null;
}
export function currentHybrid(ctx:AppContext){
 if(ctx.ytmStudy?.n1&&ctx.hybridResult&&stableJson(ctx.ytmStudy.n1.identity)===stableJson(ctx.hybridResult.identity))return currentStudy(ctx)?ctx.hybridResult:null;
 const s=selectN1Result({network:ctx.network,scenario:ctx.scenario.current,settings:ctx.analysisSettings.value,hybrid:ctx.hybridResult});
 const h=s.current?s.hybrid:null;
 return h&&(!ctx.filters.areaId||h.filter.ytmIds?.includes(ctx.filters.areaId))?h:null;
}
/** Restored JSON may contain distinct objects for the same immutable source identity. */
export function studyOwnsSc(ctx:AppContext,r:ScResult|null){return !!r&&!!ctx.ytmStudy&&[ctx.ytmStudy.scMax,ctx.ytmStudy.scMin].some(s=>s&&stableJson(s.identity)===stableJson(r.identity));}
export function currentLf(ctx:AppContext){
 const r=ctx.resultStore.active;
 return lfSnapshotIsCurrent(r,ctx.network,ctx.resultStore.role==='base'?emptyScenario():ctx.scenario.current,ctx.analysisSettings.value)?r:null;
}
