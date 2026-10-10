import assert from 'node:assert/strict';
import test from 'node:test';
import {mapMetricTarget,resultLayerColor,mapFlowMetric,mapMetricLabel} from '../../src/map/layer-policy';
import {METRICS} from '../../src/domain/benchmark/comparison';
import type {BenchmarkMapSelection,BenchmarkMapValue} from '../../src/domain/benchmark/map-layer';
import type {CalculationResult} from '../../src/domain/results/types';
import {identity} from '../../src/domain/calculation/identity';
import {emptyScenario} from '../../src/domain/scenario/overlay';

const lf:BenchmarkMapSelection={analysis:'LF',source:'GA',metric:'voltagePu',table:'GA_Reference_Raw'};
const value=(n:number|null):BenchmarkMapValue=>({value:n,unit:'pu',status:n===null?'NOT_RUN':'CALCULATED',details:[]});
const result={identity:identity('test',emptyScenario(),'powerFlow'),converged:true} as CalculationResult;

test('bus and fault metrics preserve nominal branches; missing or blocked numbers preserve topology',()=>{
  for(const metric of ['voltagePu','voltageKv','angleDeg','postVoltagePu','ikssKa','skssMva']){assert.equal(mapMetricTarget(metric),'site');assert.equal(resultLayerColor('#ff0000','branch',{...lf,metric},value(1),true),'#ff0000');}
  for(const n of [null,NaN,Infinity])assert.equal(resultLayerColor('#b8e1e3','site',lf,value(n),true),'#b8e1e3');
  assert.equal(resultLayerColor('#b8e1e3','site',lf,value(1),false),'#b8e1e3');
  assert.equal(resultLayerColor('#ff0000','branch',{...lf,metric:'postPmw'},undefined,true),'#ff0000');
  assert.notEqual(resultLayerColor('#b8e1e3','site',lf,value(0),true),'#b8e1e3');
});
test('GA LF P/Q retain voltage-family colors while actual branch and diagnostic layers stay scoped',()=>{
  for(const metric of ['pFromMw','pToMw','qFromMvar','qToMvar'])assert.equal(resultLayerColor('#e22','branch',{...lf,metric},value(42),true),'#e22');
  assert.equal(resultLayerColor('#b8e1e3','site',{...lf,metric:'loadingPercent'},value(42),true),'#b8e1e3');
  assert.notEqual(resultLayerColor('#e22','branch',{...lf,source:'EXPLORATORY_DELTA',metric:'pFromMw'},value(42),true,42),'#e22');
});
test('flow with a result layer requires current GA Full AC; PF, delta, N1, SC, DC and stale have no borrowed arrows',()=>{
  assert.equal(mapFlowMetric({...lf,metric:'pFromMw'},'nominal',result,true),'p');
  assert.equal(mapFlowMetric({...lf,metric:'qToMvar'},'nominal',result,true),'q');
  for(const source of ['PF','DELTA','EXPLORATORY_DELTA','SCENARIO_DELTA'] as const)assert.equal(mapFlowMetric({...lf,source,metric:'pFromMw'},'nominal',result,true),null);
  for(const analysis of ['N1','SC'] as const)assert.equal(mapFlowMetric({...lf,analysis,metric:'pFromMw'},'nominal',result,true),null);
  assert.equal(mapFlowMetric(lf,'nominal',result,true),null);
  assert.equal(mapFlowMetric({...lf,metric:'pFromMw'},'nominal',result,false),null);
  assert.equal(mapFlowMetric(null,'q',{...result,identity:{...result.identity,analysisType:'dc'}},true),null);
});
test('every retained LF/SC metric has a readable label instead of a raw source field',()=>{
  for(const metric of [...Object.keys(METRICS.GA_Reference_Raw),...Object.keys(METRICS.SC_BusResults_Raw)])assert.notEqual(mapMetricLabel(metric),metric);
});
