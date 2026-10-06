import test from 'node:test';
import assert from 'node:assert/strict';
import { genericQLimitReleaseAccepts, solveNR } from '../../src/analysis/power-flow/js/newton';
import type { NumericalModel } from '../../src/analysis/power-flow/js/types';

/**
 * Generic PV <-> PQ active set.
 *
 * A Q limit on a generic PV bus is a variable bound. It is active exactly when the
 * unconstrained PV solution violates it, so the transition is reversible. The release
 * decision is made on the solved operating point after a release trial (a
 * complementarity / KKT test), never from the sign of the previous Q dispatch, and a
 * bus whose limit re-applies is retired by cycle detection rather than by a fixed
 * attempt counter.
 */

const twoBus = (qMin: number, qMax: number, vmPu: number): NumericalModel => ({
  n: 2,
  baseMVA: 100,
  slack: 0,
  slackVm: 1,
  pSpec: Float64Array.from([0, -20]),
  qSpec: Float64Array.from([0, 0]),
  busType: Int8Array.from([2, 1]),
  vmSet: Float64Array.from([1, vmPu]),
  shuntG: new Float64Array(2),
  shuntB: new Float64Array(2),
  qMinNet: [null, qMin],
  qMaxNet: [null, qMax],
  branches: [{ i: 0, j: 1, r: 0.01, x: 0.1, bch: 0, tap: 1, phase: 0 }],
});

const loose = { maxInnerIterations: 100, maxOuterIterations: 50, nodalToleranceKva: 5 };
const seededLimit = [{ bus: 1, qRequired: 0, qLimit: 0, state: 'QMAX_LIMITED' as const }];

test('the complementarity test accepts only a strictly interior operating point', () => {
  const band = { qMin: -50, qMax: 50 };
  assert.equal(genericQLimitReleaseAccepts(band, 0, 0.02), true);
  assert.equal(genericQLimitReleaseAccepts(band, 49.9, 0.02), true);
  // Boundary points mean the bound is still active.
  assert.equal(genericQLimitReleaseAccepts(band, 50, 0.02), false);
  assert.equal(genericQLimitReleaseAccepts(band, -50, 0.02), false);
  assert.equal(genericQLimitReleaseAccepts(band, 50.02, 0.02), false);
  assert.equal(genericQLimitReleaseAccepts(band, -50.02, 0.02), false);
  assert.equal(genericQLimitReleaseAccepts(band, Number.NaN, 0.02), false);
  assert.equal(genericQLimitReleaseAccepts({ qMin: 50, qMax: -50 }, 0, 0.02), false);
});

test('a seeded Q limit is released when the PV solution settles inside the band', () => {
  const result = solveNR(twoBus(-50, 50, 0.9), undefined, {
    settings: loose,
    initialLimitedBuses: seededLimit,
  });
  assert.equal(result.status, 'CONVERGED_FULL_NR');
  assert.equal(result.genericQLimitActiveSet?.releaseTrialsAccepted, 1);
  assert.equal(result.genericQLimitActiveSet?.releasedUnits, 1);
  assert.deepEqual(result.pvToPq, []);
  assert.ok((result.warnings ?? []).some(line => line.includes('GENERIC_Q_LIMIT_RELEASE_ACCEPTED')));
});

test('a seeded Q limit whose band is violated again stays limited and is retired', () => {
  const result = solveNR(twoBus(-5, -3, 0.9), undefined, {
    settings: loose,
    initialLimitedBuses: seededLimit,
  });
  assert.equal(result.status, 'CONVERGED_FULL_NR');
  assert.equal(result.genericQLimitActiveSet?.releasedUnits, 0);
  assert.equal(result.genericQLimitActiveSet?.releaseTrialsRejected, 1);
  // Retired by cycle detection, not by an attempt counter: exactly one trial is spent.
  assert.deepEqual(result.genericQLimitActiveSet?.retiredAfterReappliedLimit, ['1']);
  assert.equal(result.pvToPq?.length, 1);
  assert.equal(result.pvToPq?.[0].qLimit, -3);
  // A retired bus is not re-tested, so the round budget is not consumed by cycling.
  assert.ok((result.rounds ?? 0) <= loose.maxOuterIterations);
});

test('re-entry after a rejected release reports a single current limit per bus', () => {
  const result = solveNR(twoBus(-5, -3, 0.9), undefined, {
    settings: loose,
    initialLimitedBuses: seededLimit,
  });
  const buses = result.pvToPq?.map(row => row.bus) ?? [];
  assert.deepEqual(buses, [...new Set(buses)]);
});

test('an unviolated band does not consume a Q-limit round', () => {
  const result = solveNR(twoBus(-500, 500, 0.9));
  assert.equal(result.status, 'CONVERGED_FULL_NR');
  assert.deepEqual(result.pvToPq, []);
  assert.equal(result.qLimitRounds?.length, 1);
  assert.equal(result.genericQLimitActiveSet?.releasedUnits, 0);
  assert.equal(result.genericQLimitActiveSet?.releaseTrialsAccepted, 0);
});

test('reactive-limit release diagnostics are absent when limits are disabled', () => {
  const limited = solveNR(twoBus(-5, 0, 0.9), undefined, { settings: loose });
  assert.equal(limited.pvToPq?.length, 1);
  const disabled = solveNR(twoBus(-5, 0, 0.9), undefined, {
    settings: { ...loose, reactiveLimitsEnabled: false },
  });
  assert.equal(disabled.pvToPq?.length, 0);
});