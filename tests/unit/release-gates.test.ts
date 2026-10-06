import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateBaselinePreservationGates, evaluateReleaseGates, evaluateSignedDiagnosticsGate, evaluateSignedKpiGates, isFullGitSha, signedDiagnosticsComplete, type BaselinePreservationGateInput, type ReleaseGateInput, type ReleaseGateSignedInput } from '../../tools/release-gates';

const ids=['lineActivePowerMw','lineReactivePowerMvar','transformerActivePowerMw','transformerReactivePowerMvar','busVoltageKv','busAlignedAngleDeg'];
/** Complete signed diagnostics equal to their own baseline: no regression. */
const goodSigned=():ReleaseGateSignedInput=>({signDisagreementCount:92,signDisagreementBaselineCount:92,signedMeanError:-0.0087,maxP95AbsoluteError:1.494191,maxP95Baseline:1.494191,maxAbsoluteError:261.007199,maxBaseline:261.007199});
const good=():ReleaseGateInput=>({
  populationMatches:true,
  kpis:ids.map((id,index)=>({id,n:index<4?100:50,baselineN:index<4?100:50,improvementPercent:index===2?-.05:index===1?-2.5:-.2})),
  activeBalanceConverged:true,stationControlConverged:true,unresolvedControllerCount:0,
  portableElapsedMs:14999,portableStatus:'OK',portableSha256:'a'.repeat(64),committedPortableSha256:'a'.repeat(64),measuredPortableSha256:'a'.repeat(64),
  measuredGitSha:'b'.repeat(40),manifestGitSha:'b'.repeat(40),commitExists:true,
  measuredSourceMatchesCurrent:true,measuredInputsMatch:true,
  // Signed diagnostics are mandatory: a passing run supplies complete values.
  signed:goodSigned(),
});

const preserved=():BaselinePreservationGateInput=>({
  ...good(),
  kpis:ids.map(id=>({id,n:100,baselineN:100,improvementPercent:0})),
  stationControlConverged:false,unresolvedControllerCount:101,
  baselineValidated:true,goldenInputsMatch:true,
  sl1PMw:-0.000187,sl1QMvar:-500,sl1QMinMvar:-500,sl1QLimitState:'QMIN_LIMITED',
  activeBalanceToleranceMw:0.005,qLimitToleranceMvar:0.02,
  stationControlStatus:'STATION_CONTROL_PARTIAL',stationPartialDisclosed:true,
  requiredValidationPassed:true,
});

test('validated baseline with disclosed partial station control is merge ready',()=>{
  assert.deepEqual(evaluateBaselinePreservationGates(preserved()),{policy:'PRESERVE_VALIDATED_BASELINE',mergeReady:true,failedGates:[]});
});

test('baseline preservation rejects one KPI above 0.5 percent relative regression',()=>{
  const input=preserved();input.kpis=input.kpis.map((row,i)=>i===0?{...row,improvementPercent:0.50001}:row);
  assert.ok(evaluateBaselinePreservationGates(input).failedGates.includes('SIX_KPI_RELATIVE_REGRESSION_0_5_PERCENT'));
});

test('baseline preservation rejects slow portable',()=>{
  const input=preserved();input.portableElapsedMs=15001;
  assert.ok(evaluateBaselinePreservationGates(input).failedGates.includes('PORTABLE_ELAPSED_15000_MS'));
});

test('baseline preservation rejects artifact, source and input provenance mismatches',()=>{
  for(const [field,gate] of [['committedPortableSha256','COMMITTED_PORTABLE_BYTES'],['measuredSourceMatchesCurrent','MEASURED_SOURCE_TREE'],['measuredInputsMatch','MEASURED_INPUT_BYTES'],['goldenInputsMatch','GOLDEN_INPUT_HASHES']] as const){
    const input=preserved();(input as unknown as Record<string,unknown>)[field]=field==='committedPortableSha256'?'c'.repeat(64):false;
    assert.ok(evaluateBaselinePreservationGates(input).failedGates.includes(gate));
  }
});

test('baseline preservation rejects duplicate or missing canonical KPI',()=>{
  for(const rows of [preserved().kpis.slice(0,5),[...preserved().kpis.slice(0,5),preserved().kpis[0]]]){
    const input=preserved();input.kpis=rows;
    assert.ok(evaluateBaselinePreservationGates(input).failedGates.includes('CANONICAL_KPI_POPULATION'));
  }
});

test('release gate truth table requires all numerical, convergence, timing and provenance facts',()=>{
  assert.deepEqual(evaluateReleaseGates(good()),{mergeReady:true,failedGates:[],improvedCount:5});
  const cases:Array<[string,(input:ReleaseGateInput)=>void]>=[
    ['POPULATION_SIGNATURE',x=>{x.populationMatches=false;}],
    ['CANONICAL_KPI_POPULATION',x=>{x.kpis=[...x.kpis.slice(0,5)];}],
    ['FIVE_OF_SIX_KPI_IMPROVEMENT',x=>{x.kpis=x.kpis.map(row=>({...row,improvementPercent:-.05}));}],
    ['NO_KPI_REGRESSION_0_5_PERCENT',x=>{x.kpis=x.kpis.map((row,i)=>i===2?{...row,improvementPercent:.5}:row);}],
    ['LINE_AND_TRANSFORMER_Q_NO_WORSE',x=>{x.kpis=x.kpis.map(row=>row.id==='lineReactivePowerMvar'?{...row,improvementPercent:.01}:row);}],
    ['Q_KPI_IMPROVEMENT_2_PERCENT',x=>{x.kpis=x.kpis.map(row=>row.id==='lineReactivePowerMvar'?{...row,improvementPercent:-1}:row);}],
    ['ACTIVE_BALANCE_CONVERGED',x=>{x.activeBalanceConverged=false;}],
    ['STATION_CONTROL_CONVERGED',x=>{x.unresolvedControllerCount=1;}],
    ['PORTABLE_ELAPSED_15000_MS',x=>{x.portableElapsedMs=15001;}],
    ['COMMITTED_PORTABLE_BYTES',x=>{x.committedPortableSha256='c'.repeat(64);}],
    ['MEASURED_COMMIT_SHA',x=>{x.manifestGitSha='c'.repeat(40);}],
  ];
  for(const [name,mutate] of cases){const input=good();mutate(input);const actual=evaluateReleaseGates(input);assert.equal(actual.mergeReady,false,name);assert.ok(actual.failedGates.includes(name),name);}
});

const completeSigned=goodSigned;

test('the signed-diagnostics gate fails on a wrong-sign or large-outlier regression',()=>{
  const base={...good(),signed:undefined};
  assert.deepEqual(evaluateReleaseGates({...base,signed:completeSigned()}).failedGates,[]);
  const cases:Array<[string,(value:ReleaseGateSignedInput)=>void]>=[
    ['sign disagreement increased',v=>{v.signDisagreementCount=93;}],
    ['p95 regression',v=>{v.maxP95AbsoluteError=v.maxP95Baseline!*1.11;}],
    ['max regression',v=>{v.maxAbsoluteError=v.maxBaseline!*1.11;}],
    ['non-finite max',v=>{v.maxAbsoluteError=Number.NaN;}],
  ];
  for(const [name,mutate] of cases){const value=completeSigned();mutate(value);const actual=evaluateReleaseGates({...base,signed:value});assert.equal(actual.mergeReady,false,name);assert.ok(actual.failedGates.includes('SIGNED_DIAGNOSTICS'),name);}
  // A candidate that improves is never failed by this gate.
  const improved=completeSigned();improved.signDisagreementCount=0;improved.maxAbsoluteError=10;
  assert.deepEqual(evaluateReleaseGates({...base,signed:improved}).failedGates,[]);
});

test('signed diagnostics are mandatory: a new run without them is not merge-ready',()=>{
  // `good()` now carries complete signed data; the absence cases start from a run without it.
  const base={...good(),signed:undefined};
  // Absent entirely.
  const absent=evaluateReleaseGates(base);
  assert.equal(absent.mergeReady,false);
  assert.ok(absent.failedGates.includes('SIGNED_DIAGNOSTICS'));
  // Explicitly null.
  assert.ok(evaluateReleaseGates({...base,signed:null}).failedGates.includes('SIGNED_DIAGNOSTICS'));
  // Incomplete: each mandatory field missing in turn must fail.
  for(const field of ['signDisagreementCount','signedMeanError','maxP95AbsoluteError','maxAbsoluteError'] as const){
    const partial:Partial<ReleaseGateSignedInput>={...completeSigned()};
    delete partial[field];
    assert.ok(evaluateReleaseGates({...base,signed:partial}).failedGates.includes('SIGNED_DIAGNOSTICS'),field);
  }
  // Non-finite values are treated as absent, not as passing zero.
  for(const value of [Number.NaN,Number.POSITIVE_INFINITY]){
    const bad={...completeSigned(),maxAbsoluteError:value};
    assert.ok(evaluateReleaseGates({...base,signed:bad}).failedGates.includes('SIGNED_DIAGNOSTICS'),String(value));
  }
  assert.equal(signedDiagnosticsComplete(completeSigned()),true);
  assert.equal(signedDiagnosticsComplete({}),false);
  assert.equal(signedDiagnosticsComplete(null),false);
});

test('the legacy policy tolerates absent signed data for historical re-verification only',()=>{
  const base=good();
  // Under the legacy policy an already published manifest without signed data can still be
  // re-verified, so the gate passes on absence.
  assert.deepEqual(evaluateReleaseGates({...base,signedPolicy:'LEGACY_OPTIONAL'}).failedGates,[]);
  assert.deepEqual(evaluateReleaseGates({...base,signed:null,signedPolicy:'LEGACY_OPTIONAL'}).failedGates,[]);
  // It still fails a real regression: the policy relaxes presence, not correctness.
  const regressed=evaluateReleaseGates({...base,signed:{...completeSigned(),maxAbsoluteError:9999},signedPolicy:'LEGACY_OPTIONAL'});
  assert.ok(regressed.failedGates.includes('SIGNED_DIAGNOSTICS'));
  const incomplete=evaluateSignedDiagnosticsGate({signDisagreementCount:1},'LEGACY_OPTIONAL');
  assert.equal(incomplete.pass,true);
  assert.equal(incomplete.complete,false);
  assert.deepEqual(incomplete.missing.sort(),['maxAbsoluteError','maxP95AbsoluteError','signedMeanError']);
});

test('the signed gate reports its measured values for the manifest',()=>{
  const result=evaluateSignedDiagnosticsGate(completeSigned());
  assert.equal(result.policy,'REQUIRED');assert.equal(result.complete,true);assert.equal(result.pass,true);
  assert.equal(result.signedMeanError,-0.0087);
  assert.equal(result.signDisagreementNotIncreased,true);
  assert.equal(evaluateSignedKpiGates({signedSummary:{signDisagreementCount:92,signComparableCount:22970,signedMeanError:-0.0087,maxP95AbsoluteError:1.842867,maxAbsoluteError:258.593428},baselineSignedSummary:{signDisagreementCount:107,maxP95AbsoluteError:1.842867,maxAbsoluteError:258.593428}}).signedMeanError,-0.0087);
});

test('measured SHA requires all forty hex characters and an existing matching commit',()=>{
  assert.equal(isFullGitSha('a'.repeat(40)),true);
  assert.equal(isFullGitSha('a'.repeat(39)),false);
  assert.equal(isFullGitSha('g'.repeat(40)),false);
  for(const change of [(x:ReleaseGateInput)=>{x.measuredGitSha='a'.repeat(39);},(x:ReleaseGateInput)=>{x.commitExists=false;}]){
    const input=good();change(input);assert.ok(evaluateReleaseGates(input).failedGates.includes('MEASURED_COMMIT_SHA'));
  }
});
