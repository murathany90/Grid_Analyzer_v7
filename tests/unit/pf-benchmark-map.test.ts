import test from 'node:test';
import assert from 'node:assert/strict';
import { syntheticBenchmark } from '../helpers/benchmark';
import { acNetwork } from '../helpers/ac-network';
import { loadBenchmark } from '../../src/importers/powerfactory-benchmark';
import { benchmarkMapGate,buildBenchmarkMapData,benchmarkLayerColor } from '../../src/domain/benchmark/map-layer';
import { ResultStore } from '../../src/domain/results/store';
import { ScenarioStore } from '../../src/domain/scenario/overlay';

test('SC GA and difference, N1 difference and uncalculated LF are disabled with reasons',async()=>{
  const ctx={network:acNetwork(),benchmark:await loadBenchmark(syntheticBenchmark()),resultStore:new ResultStore(),n1AcResults:[],n1Result:null,scenario:new ScenarioStore()} as never;
  assert.equal(benchmarkMapGate(ctx,{analysis:'SC',source:'GA',metric:'ikssKa',table:'SC_BusResults_Raw'}).reason,'GA_IEC60909_NOT_COMPUTABLE');
  assert.equal(benchmarkMapGate(ctx,{analysis:'N1',source:'DELTA',metric:'postPmw',table:'N1_RecordedExtrema_Raw'}).reason,'NOT_COMPARABLE_PF_MISSING');
  assert.equal(benchmarkMapGate(ctx,{analysis:'LF',source:'GA',metric:'voltagePu',table:'GA_Reference_Raw'}).reason,'GA_LF_NOT_CALCULATED');
  const data=buildBenchmarkMapData(ctx,{analysis:'SC',source:'PF',metric:'ikssKa',table:'SC_BusResults_Raw'});assert.equal(data.enabled,true);assert.equal(data.noGeometry,1);
});
test('null and missing map values are gray; recorded zero has its own color',()=>{
  assert.equal(benchmarkLayerColor(undefined),'#708596');assert.equal(benchmarkLayerColor({value:null,unit:'kA',status:'NOT_RECORDED',details:[]}),'#708596');assert.notEqual(benchmarkLayerColor({value:0,unit:'kA',status:'RECORDED_NUMERIC_ZERO',details:[]}),'#708596');
});
