import {SC_ENGINE_REVISION} from '../../src/analysis/short-circuit';
import test from 'node:test';import assert from 'node:assert/strict';
import type {AppContext} from '../../src/app/contracts';
import type {ScResult} from '../../src/analysis/short-circuit';
import {acNetwork} from '../helpers/ac-network';
import {ScenarioStore,scenarioSignature} from '../../src/domain/scenario/overlay';
import {selectedScPresentation} from '../../src/map/layer-policy';
import {pfFaultReference} from '../../src/domain/benchmark/pf-fault-reference';
import {syntheticBenchmarkPair} from '../helpers/benchmark-model';
import {loadBenchmarkModel} from '../../src/importers/powerfactory-benchmark/model';
import {loadBenchmark} from '../../src/importers/powerfactory-benchmark';
import {ResultStore} from '../../src/domain/results/store';

test('SC absent or uncomputed selection is NOT_RUN; only its own fault evidence can be BLOCKED; ambiguous aliases stay distinct',()=>{
  const network=acNetwork(),scenario=new ScenarioStore(network.modelHash),ctx={network,scenario,resultView:{faultId:'B1'},scResult:{engineRevision:SC_ENGINE_REVISION,method:'GA_POSITIVE_SEQUENCE_3PH_MAX',profile:{faultType:'3PH',calculateMode:'MAX'},identity:{modelHash:network.modelHash,scenarioHash:scenarioSignature(scenario.current)},faults:[{physicalTerminalFid:'B0',physicalTerminalFids:['B0'],status:'BLOCKED',reasons:['MISSING_SOURCE_MODEL']}]}} as unknown as AppContext;
  assert.equal(selectedScPresentation(ctx).status,'NOT_RUN');ctx.resultView.faultId='B0';assert.equal(selectedScPresentation(ctx).status,'BLOCKED');
  ctx.scResult={...ctx.scResult!,faults:[{...ctx.scResult!.faults[0],physicalTerminalFids:['B0','ALIAS']},{...ctx.scResult!.faults[0],physicalTerminalFid:'B2',physicalTerminalFids:['B2','ALIAS']}]};ctx.resultView.faultId='ALIAS';assert.equal(selectedScPresentation(ctx).status,'PARTITION_AMBIGUOUS');assert.equal(selectedScPresentation(ctx).fault,null);
  ctx.scResult={...ctx.scResult!,identity:{...ctx.scResult!.identity,scenarioHash:'other'}};assert.equal(selectedScPresentation(ctx).status,'NOT_RUN');
});

test('current SC batch has its own aggregate state without inventing a selected fault or normative acceptance',()=>{
  const network=acNetwork(),scenario=new ScenarioStore(network.modelHash),ctx={network,scenario,resultView:{},scResult:{engineRevision:SC_ENGINE_REVISION,method:'GA_POSITIVE_SEQUENCE_3PH_MAX',profile:{faultType:'3PH',calculateMode:'MAX'},identity:{modelHash:network.modelHash,scenarioHash:scenarioSignature(scenario.current)},faults:[{physicalTerminalFid:'B0',physicalTerminalFids:['B0'],status:'CALCULATED_NETWORK_APPROXIMATION',reasons:[],ikssKa:0}]}} as unknown as AppContext;
  assert.equal(selectedScPresentation(ctx).status,'SC_BATCH_NETWORK_APPROXIMATION');assert.equal(selectedScPresentation(ctx).fault,null);
  ctx.resultView.faultId='B2';assert.equal(selectedScPresentation(ctx).status,'NOT_RUN');ctx.resultView.faultId=undefined;
  ctx.scResult!.faults[0].status='BLOCKED';ctx.scResult!.faults[0].ikssKa=null;assert.equal(selectedScPresentation(ctx).status,'SC_BATCH_BLOCKED');ctx.scResult!.faults[0].status='CANCELLED';assert.equal(selectedScPresentation(ctx).status,'SC_BATCH_PARTIAL');
  ctx.scResult!.identity.scenarioHash='stale';assert.equal(selectedScPresentation(ctx).status,'NOT_RUN');
});
test('independent PF MAX kA remains visible with GA BLOCKED, while stale scenario, nominal mismatch, duplicate and sentinel are rejected',async()=>{
  const pair=syntheticBenchmarkPair(true),network=(await loadBenchmarkModel(pair.model)).network,benchmark=await loadBenchmark(pair.benchmark),scenario=new ScenarioStore(network.modelHash),ctx={network,benchmark,scenario,resultStore:new ResultStore()} as unknown as AppContext;
  ctx.scResult={engineRevision:SC_ENGINE_REVISION,method:'GA_POSITIVE_SEQUENCE_3PH_MAX',identity:{modelHash:network.modelHash,scenarioHash:scenarioSignature(scenario.current)},profile:{calculateMode:'MAX',faultType:'3PH'},faults:[{physicalTerminalFid:'SYN-B0',physicalTerminalFids:['SYN-B0'],nominalKv:100,status:'BLOCKED',reasons:['MISSING_IEC_FACTOR'],ikssKa:null,skssMva:null}]} as unknown as ScResult;
  assert.equal(pfFaultReference(ctx,'SYN-B0',100).ikss,6);assert.equal(ctx.scResult.faults[0].ikssKa,null);assert.equal(pfFaultReference(ctx,'SYN-B0',154).ikss,null);
  scenario.setStatus('lineStatus','SYN-LINE',false,true);assert.equal(pfFaultReference(ctx,'SYN-B0',100).reason,'PF_SCENARIO_IDENTITY_UNVERIFIED');scenario.reset();
  const table=benchmark.groups.SC.tables.SC_BusResults_Raw,copy={...table,rows:[...table.rows,table.rows[0]],rowNumbers:[...table.rowNumbers,999]};ctx.benchmark={...benchmark,groups:{...benchmark.groups,SC:{...benchmark.groups.SC,tables:{...benchmark.groups.SC.tables,SC_BusResults_Raw:copy}}}};assert.equal(pfFaultReference(ctx,'SYN-B0',100).reason,'PF_DUPLICATE_FAULT');
  const sentinel={...table,rows:table.rows.map((row,i)=>i===0?row.map((v,j)=>table.headers[j]==='ikssKa'?99999:v):row)};ctx.benchmark={...benchmark,groups:{...benchmark.groups,SC:{...benchmark.groups.SC,tables:{...benchmark.groups.SC.tables,SC_BusResults_Raw:sentinel}}}};assert.equal(pfFaultReference(ctx,'SYN-B0',100).ikss,null);
});
