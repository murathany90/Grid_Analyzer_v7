import type {AppContext} from '../../app/contracts';
import type {BenchmarkMapSelection} from '../../domain/benchmark/map-layer';
import {selectN1Result} from '../../domain/benchmark/post-result-source';
import {stableJson} from '../../domain/calculation/identity';
import {scenarioSignature} from '../../domain/scenario/overlay';
import {capacitySession} from '../../domain/model/capacity';
import {scStudyState} from './sc-study-state';
import {studyResultRows} from './study-result-rows';

/** One immutable input snapshot per view. Query/sort/precision never rebuild source rows.
 * Identity, settings, scope, capacity revision and hydrated case details invalidate it. */
export function createStudyRowsCache(ctx:AppContext){
  let cache:{key:string;refs:unknown[];value:ReturnType<typeof studyResultRows>}|undefined;
  return (selection:BenchmarkMapSelection)=>{
    const state=scStudyState(ctx),chosen=selectN1Result({network:ctx.network,scenario:ctx.scenario.current,settings:ctx.analysisSettings.value,ac:ctx.n1AcResults,hybrid:ctx.hybridResult,dc:ctx.n1Result},ctx.resultView.caseId);
    const key=stableJson([selection,ctx.resultView,ctx.analysisSettings.value,ctx.powerFactoryControlContextHash,ctx.powerFactoryControlContextNumericFile,scenarioSignature(ctx.scenario.current),ctx.filters.areaId,ctx.filters.siteId,[...ctx.filters.voltages].sort(),state.scope,ctx.settings.value.riskWarningPercent,ctx.network?capacitySession(ctx.network.modelHash).revision:null,
      ctx.resultStore.role,ctx.resultStore.analysisType,ctx.resultStore.comparisonScenarioId,ctx.scResult?.identity,ctx.scResult?.profile,ctx.scResult?.faults.length,ctx.scCatalog?.identity,ctx.hybridResult?.identity,ctx.hybridResult?.studyProfile,chosen.ac?.identity,chosen.ac?.status,chosen.hybridCase?.status,chosen.candidate?.status,ctx.n1Result?.identity]);
    const refs=[ctx.network,ctx.benchmark,ctx.scResult,ctx.scResult?.faults,ctx.scCatalog,state.targets,ctx.hybridResult,ctx.hybridResult?.basePost,chosen.hybridCase?.mapResults,chosen.hybridCase?.constraintChanges,ctx.n1AcResults,chosen.ac?.result,chosen.ac?.controlEvidence,ctx.n1Result,chosen.candidate?.topImpacts,ctx.resultStore.active,ctx.resultStore.get('base','powerFlow'),ctx.resultStore.get('scenario','powerFlow'),ctx.resultStore.getSnapshot(ctx.resultStore.comparisonScenarioId,'powerFlow')];
    if(cache?.key===key&&cache.refs.every((r,i)=>r===refs[i]))return cache.value;
    const value=studyResultRows(ctx,selection);cache={key,refs,value};return value;
  };
}
