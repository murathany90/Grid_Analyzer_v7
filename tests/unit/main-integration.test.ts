import test from 'node:test';
import assert from 'node:assert/strict';
import type {AppContext} from '../../src/app/contracts';
import {ScenarioStore,scenarioSignature} from '../../src/domain/scenario/overlay';
import {ResultStore} from '../../src/domain/results/store';
import {identity} from '../../src/domain/calculation/identity';
import {AnalysisSettingsStore} from '../../src/domain/calculation/analysis-settings';
import {activeResultId,initialResultView} from '../../src/domain/results/workspace';
import {scorecardEvidence} from '../../src/features/comparison/scorecard-view';
import {BrowserJsPowerFlowEngine} from '../../src/analysis/api/browser-js-engine';
import {runHybridN1} from '../../src/analysis/contingency-hybrid';
import {loadBenchmark} from '../../src/importers/powerfactory-benchmark';
import {loadBenchmarkModel} from '../../src/importers/powerfactory-benchmark/model';
import {syntheticBenchmarkPair} from '../helpers/benchmark-model';
import {acNetwork} from '../helpers/ac-network';

test('The B0 PF scorecard stays numerically identical through B0 S1 S2 B0 selection',async()=>{
  const pair=syntheticBenchmarkPair(),network=(await loadBenchmarkModel(pair.model)).network,benchmark=await loadBenchmark(pair.benchmark),scenario=new ScenarioStore(network.modelHash),analysisSettings=new AnalysisSettingsStore();
  const result=await new BrowserJsPowerFlowEngine().runPowerFlow({network,scenario:scenario.current,identity:identity(network.modelHash,scenario.current,'powerFlow',{analysisSettings:analysisSettings.value}),analysisSettings:analysisSettings.value});
  const ctx={network,benchmark,scenario,analysisSettings,resultStore:{get:()=>result},powerFactoryControlContextHash:null,powerFactoryControlContextNumericFile:null} as unknown as AppContext;
  const base=scorecardEvidence(ctx);assert.ok(base.rows.some(r=>r.matched>0));
  scenario.setStatus('lineStatus','SYN-LINE',false,true);const s1=scenario.selectedId;scenario.setStatus('transformerStatus','TR',false,true);const s2=scenario.selectedId;
  for(const id of [s1,s2,'B0']){scenario.select(id);assert.strictEqual(scorecardEvidence(ctx),base);assert.deepEqual(scorecardEvidence({...ctx} as AppContext).rows,base.rows);}
});

test('An N1 run cannot mark a different or unrecorded case phase metric READY',async()=>{
  const network=acNetwork(),scenario=new ScenarioStore(network.modelHash),analysisSettings=new AnalysisSettingsStore(),hybridResult=await runHybridN1(network,scenario.current,{analysisSettings:analysisSettings.value,selectedCandidateIds:['ElmLne:BYPASS'],policy:{acBudgetCases:1}});
  const ctx={network,scenario,analysisSettings,hybridResult,n1AcResults:[],n1Result:null,resultStore:new ResultStore(),benchmark:null,benchmarkMap:null,powerFactoryControlContextHash:null,resultView:{...initialResultView(),analysis:'N1',caseId:'N1:ElmLne:BYPASS',metric:'postVoltagePu',phase:'POST'}} as unknown as AppContext;
  for(const phase of ['PRE','POST','CHANGE'] as const){ctx.resultView.phase=phase;assert.match(activeResultId(ctx)??'',/^N1-/);}
  ctx.resultView.caseId='N1:ElmLne:L0';assert.equal(activeResultId(ctx),null);
  ctx.resultView.caseId='N1:ElmLne:BYPASS';ctx.resultView.metric='notRecorded';assert.equal(activeResultId(ctx),null);
  ctx.resultView.metric='postVoltagePu';ctx.hybridResult={...hybridResult,identity:{...hybridResult.identity,settingsHash:'STALE'}};assert.equal(activeResultId(ctx),null);
  ctx.hybridResult=hybridResult;scenario.setStatus('lineStatus','L0',false,true);assert.equal(activeResultId(ctx),null);
});

test('A selected DC case exposes P and estimated loading only, with no generic run fallback',()=>{
  const network=acNetwork(),scenario=new ScenarioStore(network.modelHash),analysisSettings=new AnalysisSettingsStore(),n1Result={identity:{modelHash:network.modelHash,scenarioHash:scenarioSignature(scenario.current)},candidates:[{equipmentId:'BYPASS',sourceClass:'ElmLne',topImpacts:[{equipmentId:'L0',sourceClass:'ElmLne',baseFlowMw:10,postFlowMw:13,deltaPMw:3,baseEstimatedLoadingPct:20,postEstimatedLoadingPct:26}]}]};
  const ctx={network,scenario,analysisSettings,n1Result,n1AcResults:[],hybridResult:null,resultStore:new ResultStore(),benchmark:null,benchmarkMap:null,powerFactoryControlContextHash:null,resultView:{...initialResultView(),analysis:'N1',caseId:'N1:ElmLne:BYPASS',metric:'postPmw',phase:'POST'}} as unknown as AppContext;
  for(const metric of ['postPmw','postLoadingPercent'])for(const phase of ['PRE','POST','CHANGE'] as const){Object.assign(ctx.resultView,{metric,phase});assert.match(activeResultId(ctx)??'',/^N1-/);}
  for(const metric of ['postQmvar','postMva','postVoltagePu','postCurrentA']){ctx.resultView.metric=metric;assert.equal(activeResultId(ctx),null);}
  ctx.resultView.metric='postPmw';ctx.resultView.caseId='N1:ElmLne:L0';assert.equal(activeResultId(ctx),null);
  ctx.resultView.caseId='N1:ElmLne:BYPASS';ctx.n1Result={...n1Result,identity:{...n1Result.identity,modelHash:'OTHER'}} as unknown as AppContext['n1Result'];assert.equal(activeResultId(ctx),null);
});
