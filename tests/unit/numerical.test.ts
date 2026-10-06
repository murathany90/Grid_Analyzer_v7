import assert from 'node:assert/strict';
import test from 'node:test';
import { selfTests } from '../../src/analysis/power-flow/js/selftests';
import { solveNR, type NumericalModel } from '../../src/analysis/power-flow/js/newton';
import {acceptsNewtonStep,nodalToleranceKvaToPu} from '../../src/analysis/power-flow/js/newton';

test('Newton sufficient decrease uses the capped step actually applied',()=>{
  const cap=1e-7,base=1;
  assert.equal(acceptsNewtonStep(base,base-0.5*cap,cap,0.1),true);
  assert.equal(acceptsNewtonStep(base,base+0.5*cap,cap,0.1),false);
});
test('5 kVA nodal tolerance converts to 0.00005 pu on a 100 MVA base',()=>{
 assert.equal(nodalToleranceKvaToPu(5,100),.00005);
});
import { solveIsland, solveIslandV52, type FastAcIsland } from '../../src/analysis/fast-ac/js';
import { solveIslandDC, type DcIsland } from '../../src/analysis/dc/js';
import { mapResults } from '../../src/analysis/power-flow/results';

test('Full NR numerical self-tests preserve all seven legacy cases', () => {
  const results = selfTests();
  assert.equal(results.length, 7);
  assert.deepEqual(results.map((result) => result.name), [
    '2-bus slack-load',
    '3-bus slack-PV-PQ',
    'PV Q-limit to PQ',
    'transformer off-nominal tap',
    'series capacitor negative X',
    'branch active loss invariant',
    'island without slack',
  ]);
  assert.ok(results.every((result) => result.pass), JSON.stringify(results));
});

test('Full NR rejects a Q-limit change on its final allowed control round', () => {
  const model: NumericalModel = {
    n: 3,
    baseMVA: 100,
    slack: 0,
    slackVm: 1,
    pSpec: new Float64Array([0, 40, -80]),
    qSpec: new Float64Array([0, 0, -25]),
    busType: new Int8Array([2, 1, 0]),
    vmSet: new Float64Array([1, 1.02, 1]),
    shuntG: new Float64Array(3),
    shuntB: new Float64Array(3),
    qMinNet: [null, -5, null],
    qMaxNet: [null, 5, null],
    branches: [
      { i: 0, j: 1, r: 0.01, x: 0.12, bch: 0.02, tap: 1, phase: 0 },
      { i: 1, j: 2, r: 0.015, x: 0.1, bch: 0.02, tap: 1, phase: 0 },
      { i: 0, j: 2, r: 0.02, x: 0.15, bch: 0.01, tap: 1, phase: 0 },
    ],
  };

  const result = solveNR(model, undefined, { maxQLimitRounds: 1 });
  assert.equal(result.status, 'Q_LIMIT_MAX_ROUNDS');
  assert.equal(result.converged, false);
  assert.equal(result.rounds, 1);
});

test('Full NR keeps the reference angle when the external-grid Q limit releases its voltage target',()=>{
 const base:NumericalModel={n:2,baseMVA:100,slack:0,slackVm:1,pSpec:Float64Array.from([0,-20]),qSpec:Float64Array.from([0,-8]),busType:Int8Array.from([2,0]),vmSet:Float64Array.from([1,1]),shuntG:new Float64Array(2),shuntB:new Float64Array(2),qMinNet:[null,null],qMaxNet:[null,null],branches:[{i:0,j:1,r:.01,x:.1,bch:0,tap:1,phase:0}]};
 const unconstrained=solveNR(base);assert.equal(unconstrained.converged,true);
 const q=unconstrained.Q![0],limited:NumericalModel={...base,referenceQMinNet:[q-.1,null],referenceQMaxNet:[q-.05,null]};
 const result=solveNR(limited,undefined,{settings:{maxInnerIterations:100,maxOuterIterations:50,nodalToleranceKva:5}});
 assert.equal(result.converged,true,result.failure?.message??result.status);assert.ok((result.pvToPq||[]).some(item=>item.bus===0));
 assert.equal(result.Va?.[0],0);assert.ok(Math.abs((result.Q?.[0]??Infinity)-(q-.05))<.03);assert.notEqual(result.Vm?.[0],1);
});
test('Full NR can release reference voltage at Qmin while keeping its angle reference',()=>{
 const base:NumericalModel={n:2,baseMVA:100,slack:0,slackVm:1,pSpec:Float64Array.from([0,-20]),qSpec:Float64Array.from([0,-8]),busType:Int8Array.from([2,0]),vmSet:Float64Array.from([1,1]),shuntG:new Float64Array(2),shuntB:new Float64Array(2),qMinNet:[null,null],qMaxNet:[null,null],branches:[{i:0,j:1,r:.01,x:.1,bch:0,tap:1,phase:0}]};
 const unconstrained=solveNR(base),q=unconstrained.Q![0],result=solveNR({...base,referenceQMinNet:[q+.05,null],referenceQMaxNet:[q+.1,null]},undefined,{settings:{maxInnerIterations:100,maxOuterIterations:50,nodalToleranceKva:5}});
 assert.equal(result.converged,true,result.failure?.message??result.status);assert.ok((result.pvToPq||[]).some(item=>item.bus===0));assert.equal(result.Va?.[0],0);assert.ok(Math.abs((result.Q?.[0]??Infinity)-(q+.05))<.03);
});

test('Full NR persists a structured missing-reference diagnostic without changing status',()=>{
 const result=solveNR({n:2,baseMVA:100,slack:-1,pSpec:new Float64Array(2),qSpec:new Float64Array(2),busType:new Int8Array(2),branches:[]});
 assert.equal(result.status,'NO_SLACK');assert.equal(result.failure?.failureStage,'NO_SLACK');
 assert.equal(result.failure?.iteration,null);assert.equal(result.failure?.maxMismatchMw,null);assert.equal(result.failure?.islandCount,2);assert.equal(result.failure?.unsuppliedBusCount,2);
 assert.equal(result.failure?.referenceBus,null);assert.ok(result.failure?.message);
 const prepared={model:{slack:-1},diagnostics:{islandCount:2,unsuppliedBuses:2},buses:[],warnings:[]} as never;
 const mapped=mapResults(prepared,result,{} as never);assert.equal((mapped.diagnostics.numericalFailure as {failureStage:string}).failureStage,'NO_SLACK');
});
test('line-search failure identifies an invalid fixed-voltage bus before residual evaluation',()=>{
  // The slack setpoint is below the numerical voltage-domain floor, so every
  // line-search candidate is inadmissible. This exercises the line-search
  // diagnostic path; it no longer relies on the retired 1.85 pu upper guard.
  const model:NumericalModel={n:2,baseMVA:100,slack:0,slackVm:1e-4,pSpec:Float64Array.from([0,-40]),qSpec:Float64Array.from([0,-20]),busType:Int8Array.from([2,0]),vmSet:Float64Array.from([1,1]),shuntG:new Float64Array(2),shuntB:new Float64Array(2),qMinNet:[null,null],qMaxNet:[null,null],branches:[{i:0,j:1,r:.01,x:.1,bch:0,tap:1,phase:0}]};
 const result=solveNR(model,undefined,{busIds:['SLACK','LOAD']});
 assert.equal(result.status,'NR_LINE_SEARCH_FAILED');assert.equal(result.failure?.firstInvalidCandidate?.busId,'SLACK');
 assert.equal(result.failure?.firstInvalidCandidate?.stateUpdated,false);assert.equal(result.failure?.lineSearchBestNormRatio,Infinity);
 assert.ok(result.failure?.maxDxVm!=null&&result.failure.maxDxTheta!=null);
});

test('Fast AC two-bus legacy baseline keeps its approximate operating point', () => {
  const model: FastAcIsland = {
    busIds: ['s', 'l'],
    injections: [[0, 0], [-50, -20]],
    edges: [{ id: 'L1', cls: 'ElmLne', a: 0, b: 1, r: 0.01, x: 0.1, bc: 0, tap: 1 }],
    shunts: [0, 0],
    slack: 0,
    baseMVA: 100,
  };

  const result = solveIsland(model);
  assert.equal(result.status, 'CONVERGED_PQ_APPROX');
  assert.equal(result.slackBus, 's');
  assert.ok(Math.abs((result.voltages?.[1].pu ?? 0) - 0.97336) < 0.0001);
  assert.ok(Math.abs((result.voltages?.[1].angle ?? 0) - -0.04924) < 0.0001);
  assert.ok(Math.abs((result.branches?.[0].pf ?? 0) - 50.188) < 0.02);
});

test('Fast AC Newton refinement preserves the two-bus load balance', () => {
  const model: FastAcIsland = {
    busIds: ['s', 'l'],
    injections: [[0, 0], [-50, -20]],
    edges: [{ id: 'L1', cls: 'ElmLne', a: 0, b: 1, r: 0.01, x: 0.1, bc: 0, tap: 1 }],
    shunts: [0, 0],
    slack: 0,
    baseMVA: 100,
  };

  const result = solveIslandV52(model);
  assert.equal(result.status, 'CONVERGED_NR_EXPERIMENTAL');
  assert.ok((result.misMW ?? Infinity) < 0.001);
  assert.ok(Math.abs((result.branches?.[0].pt ?? 0) - -50) < 0.001);
  assert.ok(Math.abs((result.branches?.[0].qt ?? 0) - -20) < 0.001);
});

test('DC two-bus baseline returns the expected angle and transfer', () => {
  const model: DcIsland = {
    busIds: ['s', 'l'],
    slack: 0,
    baseMVA: 100,
    injections: [[0, 0], [-50, 0]],
    edges: [{ id: 'L1', cls: 'ElmLne', a: 0, b: 1, x: 0.1 }],
  };

  const result = solveIslandDC(model);
  assert.equal(result.status, 'CONVERGED_DC');
  assert.equal(result.slackBus, 's');
  assert.ok(Math.abs((result.angles?.[1].angleRad ?? 0) - -0.05) < 1e-12);
  assert.ok(Math.abs((result.branches?.[0].pMW ?? 0) - 50) < 1e-10);
});
