import test from 'node:test';
import assert from 'node:assert/strict';
import {externalGridEquivalent} from '../../src/importers/powerfactory-benchmark/external-grid-equivalent';
import {syntheticBenchmarkPair} from '../helpers/benchmark-model';
import {loadBenchmarkModel} from '../../src/importers/powerfactory-benchmark/model';
import {adaptShortCircuitSources} from '../../src/importers/powerfactory-benchmark/short-circuit-source';
import {calculateThreePhase} from '../../src/analysis/short-circuit';
import {emptyScenario} from '../../src/domain/scenario/overlay';
test('native external-grid input needs explicit independent source factor, ratio and input-mode agreement',()=>{
  const i={nominalKv:100,ikss:10,snss:null,rntxn:.1},f={value:1.05,provenance:'EXPLICIT_ANALYTICAL_ASSUMPTION'};
  assert.match(externalGridEquivalent(i).reason,/SOURCE_C_NOT_SUPPLIED/);
  const z=externalGridEquivalent(i,f);assert.ok(Math.abs(Math.hypot(z.rOhm!,z.xOhm!)-1.05*100/(Math.sqrt(3)*10))<1e-12);
  assert.match(externalGridEquivalent({...i,snss:20},f).reason,/AMBIGUOUS/);assert.match(externalGridEquivalent({...i,rntxn:-.1},f).reason,/INVALID_UNIT/);
});
test('small native ElmXnet network calculates with supplied input factor and never consumes solved workbook',async()=>{
  const pair=syntheticBenchmarkPair();pair.raw.ElmXnet.Attributes.push('ikss','rntxn');pair.raw.ElmXnet.Values[0].push(10,.1);
  const n=(await loadBenchmarkModel(pair.model)).network,c=adaptShortCircuitSources(pair.raw,n,{value:1.05,provenance:'ANALYTIC_SOURCE_PROFILE'});
  assert.equal(c.sources[0].reason,'');const r=await calculateThreePhase(n,emptyScenario(),c,['SYN-B0'],{faultType:'3PH',calculateMode:'MAX',voltageFactor:1.05,factorProvenance:'ANALYTICAL_INPUT',edition:null,rfOhm:0,xfOhm:0,maxFaults:1,timeBudgetMs:30000});
  assert.equal(r.faults[0].status,'CALCULATED_NETWORK_APPROXIMATION');assert.ok(Math.abs(r.faults[0].ikssKa!-10)<1e-9);
});
