import test from 'node:test';
import assert from 'node:assert/strict';
import {syntheticBenchmarkPair} from '../helpers/benchmark-model';
import {loadBenchmark} from '../../src/importers/powerfactory-benchmark';
import {loadBenchmarkModel} from '../../src/importers/powerfactory-benchmark/model';
import {adaptShortCircuitSources} from '../../src/importers/powerfactory-benchmark/short-circuit-source';
import {calculateThreePhase} from '../../src/analysis/short-circuit';
import {BrowserJsPowerFlowEngine} from '../../src/analysis/api/browser-js-engine';
import {emptyScenario} from '../../src/domain/scenario/overlay';
import {identity} from '../../src/domain/calculation/identity';
import {metricRows,metricStatistics,preflightBenchmark} from '../../src/domain/benchmark/comparison';
test('LF opt-in diagnostic delta uses native cell identity; certified statistics stay null',async()=>{
  const pair=syntheticBenchmarkPair(),b=await loadBenchmark(pair.benchmark),n=(await loadBenchmarkModel(pair.model)).network,s=emptyScenario(),ac=await new BrowserJsPowerFlowEngine().runPowerFlow({network:n,scenario:s,identity:identity(n.modelHash,s,'powerFlow')}),gate=preflightBenchmark(b,n,ac),table=b.groups.LF.tables.GA_Reference_Raw;
  assert.equal(gate.status,'EXPLORATORY_ONLY');const rows=metricRows(table,gate,'voltagePu',{diagnostic:true});assert.ok(rows.some(r=>r.diagnosticDelta===0));assert.ok(rows.every(r=>r.delta===null));assert.ok(metricStatistics(rows).every(s=>s.mae===null&&s.rmse===null));
  const noOpt=metricRows(table,gate,'voltagePu');assert.ok(noOpt.every(r=>r.diagnosticDelta===null));assert.ok(rows.every(r=>r.sourceCellKey));
  table.rows[0][table.headers.indexOf('fid')]='WRONG_FID';assert.equal(metricRows(table,gate,'voltagePu',{diagnostic:true})[0].diagnosticDelta,null);
});
test('SC fault/nominal-kV/partition identity allows approximation diagnostics, never IEC parity',async()=>{
  const pair=syntheticBenchmarkPair(true),b=await loadBenchmark(pair.benchmark),n=(await loadBenchmarkModel(pair.model)).network,s=emptyScenario(),context=adaptShortCircuitSources(pair.raw,n),sc=await calculateThreePhase(n,s,context,['SYN-B1'],{faultType:'3PH',calculateMode:'MAX',voltageFactor:1.1,factorProvenance:'EXPLICIT_TEST',edition:null,rfOhm:0,xfOhm:0,maxFaults:1,timeBudgetMs:30000}),table=b.groups.SC.tables.SC_BusResults_Raw,gate=preflightBenchmark(b,n,null);
  const options={network:n,scenario:s,benchmark:b,sc,diagnostic:true},rows=metricRows(table,gate,'ikssKa',options);assert.equal(rows[1].ga,sc.faults[0].ikssKa);assert.ok(rows[1].diagnosticDelta!==null);assert.equal(rows[1].delta,null);assert.equal(metricStatistics(rows)[0].nIECSubset,0);assert.equal(metricStatistics(rows)[0].mae,null);
  const min=await calculateThreePhase(n,s,adaptShortCircuitSources(pair.raw,n,undefined,{mode:'MIN'}),['SYN-B1'],{...sc.profile,calculateMode:'MIN'});assert.equal(metricRows(table,gate,'ikssKa',{...options,sc:min})[1].ga,null);
  table.rows[1][table.headers.indexOf('nominalKv')]=200;assert.equal(metricRows(table,gate,'ikssKa',options)[1].ga,null);
  table.rows[1][table.headers.indexOf('nominalKv')]=100;assert.equal(metricRows(table,gate,'ikssKa',{...options,sc:{...sc,identity:{...sc.identity,modelHash:'wrong'}}})[1].ga,null);
});
