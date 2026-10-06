import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_VOLTAGE_DOMAIN_PU,
  isAdmissibleVoltage,
  loopMax,
  loopMin,
  resolveVoltageDomainPu,
  solveNR,
} from '../../src/analysis/power-flow/js/newton';
import type { NumericalModel } from '../../src/analysis/power-flow/js/types';

/**
 * The voltage domain is a numerical safety bound, not a physical solution limit.
 *
 * The retired `0.35 <= Vm <= 1.85` window excluded physically valid low-voltage
 * operating points: a bus whose voltage setpoint is below 0.35 pu is a legitimate
 * voltage-control target, and the previous window made such a case unsolvable
 * because the very first line-search candidate was rejected.
 */

const lowVoltageModel = (vmSetPu: number): NumericalModel => ({
  n: 2,
  baseMVA: 100,
  slack: 0,
  slackVm: 1,
  pSpec: Float64Array.from([0, -20]),
  qSpec: Float64Array.from([0, -5]),
  busType: Int8Array.from([2, 1]),
  vmSet: Float64Array.from([1, vmSetPu]),
  shuntG: new Float64Array(2),
  shuntB: new Float64Array(2),
  qMinNet: [null, null],
  qMaxNet: [null, null],
  branches: [{ i: 0, j: 1, r: 0.01, x: 0.1, bch: 0, tap: 1, phase: 0 }],
});

test('a PV setpoint below 0.35 pu is a physical operating point, not a numerical violation', () => {
  const result = solveNR(lowVoltageModel(0.25));
  assert.equal(result.status, 'CONVERGED_FULL_NR');
  assert.equal(result.converged, true);
  assert.ok(Math.abs((result.Vm?.[1] ?? 1) - 0.25) < 1e-6, `V=${result.Vm?.[1]}`);
  assert.ok((result.maxMismatchMW ?? Infinity) < 1e-6);
});

test('the retired 0.35 pu window rejected exactly the physical branch it must not reject', () => {
  const guarded = solveNR(lowVoltageModel(0.25), undefined, {
    settings: { minVoltagePu: 0.35, maxVoltagePu: 1.85 },
  });
  assert.equal(guarded.status, 'NR_LINE_SEARCH_FAILED');
  const physical = solveNR(lowVoltageModel(0.25));
  assert.equal(physical.status, 'CONVERGED_FULL_NR');
});

/** A low-voltage setpoint on the mid bus pulls the downstream PQ bus far below 0.35 pu. */
const lowVoltagePqModel = (): NumericalModel => ({
  n: 3,
  baseMVA: 100,
  slack: 0,
  slackVm: 1,
  pSpec: Float64Array.from([0, -30, -10]),
  qSpec: Float64Array.from([0, -10, -10]),
  busType: Int8Array.from([2, 1, 0]),
  vmSet: Float64Array.from([1, 0.25, 1]),
  shuntG: new Float64Array(3),
  shuntB: new Float64Array(3),
  qMinNet: [null, null, null],
  qMaxNet: [null, null, null],
  branches: [
    { i: 0, j: 1, r: 0.01, x: 0.1, bch: 0, tap: 1, phase: 0 },
    { i: 1, j: 2, r: 0.01, x: 0.1, bch: 0, tap: 1, phase: 0 },
  ],
});

test('a low-voltage PQ operating point is admitted by the numerical domain', () => {
  const result = solveNR(lowVoltagePqModel());
  assert.equal(result.status, 'CONVERGED_FULL_NR');
  assert.ok((result.minV ?? 1) < 0.35, `minV=${result.minV}`);
  const guarded = solveNR(lowVoltagePqModel(), undefined, {
    settings: { minVoltagePu: 0.35, maxVoltagePu: 1.85 },
  });
  assert.equal(guarded.status, 'NR_LINE_SEARCH_FAILED');
});

test('the voltage domain rejects non-finite, zero and negative magnitudes', () => {
  const domain = resolveVoltageDomainPu(undefined);
  assert.equal(isAdmissibleVoltage(Number.NaN, domain), false);
  assert.equal(isAdmissibleVoltage(Number.POSITIVE_INFINITY, domain), false);
  assert.equal(isAdmissibleVoltage(0, domain), false);
  assert.equal(isAdmissibleVoltage(-1, domain), false);
  assert.equal(isAdmissibleVoltage(1, domain), true);
  assert.equal(isAdmissibleVoltage(0.2, domain), true);
});

test('a warm start below the numerical domain is reset rather than trusted', () => {
  const model = lowVoltageModel(1);
  const fromInvalid = solveNR(model, undefined, {
    settings: { minVoltagePu: 0.35, maxVoltagePu: 1.85 },
    initialVm: [1, 0.2],
    initialVa: [0, 0],
  });
  assert.equal(fromInvalid.status, 'CONVERGED_FULL_NR');
  assert.ok(Math.abs((fromInvalid.Vm?.[1] ?? 0) - 1) < 1e-6);
});

test('voltage-domain bounds are configurable and provenance-visible', () => {
  assert.deepEqual(resolveVoltageDomainPu(undefined), DEFAULT_VOLTAGE_DOMAIN_PU);
  assert.deepEqual(resolveVoltageDomainPu({ minVoltagePu: 0.2, maxVoltagePu: 2.5 }), {
    minPu: 0.2,
    maxPu: 2.5,
  });
  // A non-positive or non-finite configured bound falls back to the default.
  assert.deepEqual(resolveVoltageDomainPu({ minVoltagePu: 0, maxVoltagePu: Number.NaN }), DEFAULT_VOLTAGE_DOMAIN_PU);
  assert.ok(DEFAULT_VOLTAGE_DOMAIN_PU.minPu < 0.35);
});

test('loop min/max match array min/max and survive a population that overflows the argument limit', () => {
  const values = Float64Array.from({ length: 200000 }, (_, index) => Math.sin(index) * 2);
  // Spread first: `Math.min(...values)` itself throws on this population, which is
  // the reason the production min/max are loop based.
  assert.throws(() => Math.min(...(values as unknown as number[])));
  let expectedMin = Infinity;
  let expectedMax = -Infinity;
  for (const value of values) {
    if (value < expectedMin) expectedMin = value;
    if (value > expectedMax) expectedMax = value;
  }
  assert.equal(loopMin(values), expectedMin);
  assert.equal(loopMax(values), expectedMax);
});