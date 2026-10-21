import {n1CaseRows,n1OperatorRows,n1InventoryRows,groupN1Cases,n1OperatorDiagnosis} from './study-operator';
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

/** Combined metrics have a separate cache; display modes/query/precision never rebuild the pair. */
export function createOperatorRowsCache(ctx:AppContext){
  let aggregate:{key:string;refs:unknown[];value:{cases:ReturnType<typeof n1CaseRows>;groups:ReturnType<typeof groupN1Cases>;inventory:ReturnType<typeof n1InventoryRows>;diagnosis:ReturnType<typeof n1OperatorDiagnosis>}}|undefined;
  let inventoryNetwork:typeof ctx.network=null,inventory:ReturnType<typeof n1InventoryRows>=[];
  let cached:{key:string;refs:unknown[];value:{cases:import('./study-result-rows').StudyRow[];rows:import('./study-operator').OperatorRow[];groups:ReturnType<typeof groupN1Cases>;inventory:ReturnType<typeof n1InventoryRows>;diagnosis:ReturnType<typeof n1OperatorDiagnosis>}}|undefined;
  return ()=>{
    const chosen=selectN1Result({network:ctx.network,scenario:ctx.scenario.current,settings:ctx.analysisSettings.value,ac:ctx.n1AcResults,hybrid:ctx.hybridResult,dc:ctx.n1Result},ctx.resultView.caseId),key=stableJson([ctx.network?.modelHash,scenarioSignature(ctx.scenario.current),ctx.analysisSettings.value,ctx.powerFactoryControlContextHash,ctx.resultView.caseId,ctx.resultView.side,ctx.network?capacitySession(ctx.network.modelHash).revision:null,ctx.n1CatalogIdentity,chosen.ac?.status,chosen.hybridCase?.status]);
    const refs=[ctx.network,ctx.benchmark,ctx.n1CatalogResult,ctx.n1AcResults,chosen.ac?.result,ctx.hybridResult,ctx.hybridResult?.basePost,chosen.hybridCase?.mapResults,ctx.n1Result,chosen.candidate?.topImpacts,ctx.resultStore.get('base','powerFlow'),ctx.resultStore.get('scenario','powerFlow'),...(ctx.hybridResult?.cases.flatMap(c=>[c.mapResults,c.status])??[])];
    if(cached?.key===key&&cached.refs.length===refs.length&&cached.refs.every((r,i)=>r===refs[i]))return cached.value;
    const groupKey=stableJson([ctx.network?.modelHash,scenarioSignature(ctx.scenario.current),ctx.analysisSettings.value,ctx.powerFactoryControlContextHash,ctx.resultView.side,ctx.n1CatalogIdentity,ctx.network?capacitySession(ctx.network.modelHash).revision:null]);
    const groupRefs=[ctx.network,ctx.n1CatalogResult,ctx.n1AcResults,ctx.hybridResult,ctx.hybridResult?.basePost,ctx.n1Result,ctx.benchmark,ctx.resultStore.get('base','powerFlow'),ctx.resultStore.get('scenario','powerFlow'),...(ctx.hybridResult?.cases.flatMap(c=>[c.mapResults,c.status])??[])];
    if(!aggregate||aggregate.key!==groupKey||!aggregate.refs.every((r,i)=>r===groupRefs[i])||aggregate.refs.length!==groupRefs.length){
      if(inventoryNetwork!==ctx.network){inventoryNetwork=ctx.network;inventory=n1InventoryRows(ctx);}
      const cases=n1CaseRows(ctx);aggregate={key:groupKey,refs:groupRefs,value:{cases,groups:groupN1Cases(ctx,cases),inventory,diagnosis:n1OperatorDiagnosis(ctx)}};
    }
    const value={...aggregate.value,rows:n1OperatorRows(ctx)};cached={key,refs,value};return value;
  };
}
