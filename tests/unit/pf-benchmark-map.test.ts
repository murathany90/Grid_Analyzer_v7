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
test('site Vpu preserves undervoltage, extrema, representative and nominal-voltage groups',()=>{
  const base=acNetwork(),n={...base,buses:base.buses.map((b,i)=>({...b,siteIds:['S'],vnKv:i===2?10:100})),sites:[{...base.buses[0],id:'S',sourceId:'S',sourceClass:'ElmSubstat',areaId:'A',areaName:'A',lat:39,lon:32,voltages:[100,10]}]};
  const result={converged:true,buses:n.buses.map((b,i)=>({...b,terms:[b.id],vmPu:[.9,1.05,1.02][i],angleRad:0})),branches:[]},ctx={network:n,resultStore:{get:()=>result},n1AcResults:[],scenario:new ScenarioStore()} as never;
  const site=buildBenchmarkMapData(ctx,{analysis:'LF',source:'GA',metric:'voltagePu',table:'GA_Reference_Raw'}).sites.get('S')!;
  assert.equal(site.value,.9);assert.equal(site.minVpu,.9);assert.equal(site.maxVpu,1.05);assert.equal(site.representativeFid,'B0');assert.equal(site.voltageLevels!['100'].minVpu,.9);assert.equal(site.voltageLevels!['10'].minVpu,1.02);
});
