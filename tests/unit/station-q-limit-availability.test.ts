import test from 'node:test';
import assert from 'node:assert/strict';
import {
  effectiveStationActiveSetLimits,
  modelEquationTolerancePu,
  stationActiveSetRestartLimit,
} from '../../src/analysis/power-flow/station-controls-v73';
import {
  DEFAULT_MODEL_EQUATION_TOLERANCE_PERCENT,
  defaultAnalysisSettings,
  effectiveFullAcLimits,
  modelEquationTolerancePercent,
} from '../../src/domain/calculation/analysis-settings';
import {
  UNKNOWN_Q_LIMIT_HIGH,
  UNKNOWN_Q_LIMIT_LOW,
  qLimitAvailabilityOf,
} from '../../src/analysis/power-flow/station-participation';

/**
 * Station Q limits and the previously hidden active-set bounds.
 *
 * A source that supplies no reactive limit states an unknown capability. Treating that
 * as an unlimited reactive source asserts a capability the data does not contain, so the
 * band is carried as an explicitly-labelled sentinel and reported as MISSING.
 */

test('a missing source limit is unknown, not an unlimited reactive source', () => {
  assert.equal(qLimitAvailabilityOf({ sourceQMin: -10, sourceQMax: 10 }), 'SOURCE_BOUNDED');
  assert.equal(qLimitAvailabilityOf({ sourceQMin: null, sourceQMax: 10 }), 'MISSING');
  assert.equal(qLimitAvailabilityOf({ sourceQMin: -10, sourceQMax: null }), 'MISSING');
  assert.equal(qLimitAvailabilityOf({ sourceQMin: null, sourceQMax: null }), 'MISSING');
  // A non-finite source value is also unknown, not a bound.
  assert.equal(qLimitAvailabilityOf({ sourceQMin: -Infinity, sourceQMax: 10 }), 'MISSING');
  assert.equal(qLimitAvailabilityOf({ sourceQMin: Number.NaN, sourceQMax: 10 }), 'MISSING');
});

test('unknown-limit sentinels are finite so participation arithmetic cannot overflow', () => {
  assert.ok(Number.isFinite(UNKNOWN_Q_LIMIT_LOW));
  assert.ok(Number.isFinite(UNKNOWN_Q_LIMIT_HIGH));
  assert.ok(UNKNOWN_Q_LIMIT_LOW < -1e300);
  assert.ok(UNKNOWN_Q_LIMIT_HIGH > 1e300);
  // A real dispatch must sit strictly inside the sentinel band.
  assert.ok(0 > UNKNOWN_Q_LIMIT_LOW && 0 < UNKNOWN_Q_LIMIT_HIGH);
});

test('the active-set restart bound is a typed setting, not a hidden constant', () => {
  const settings = defaultAnalysisSettings().powerFlow;
  assert.equal(stationActiveSetRestartLimit(undefined), 128);
  assert.equal(stationActiveSetRestartLimit(settings), settings.maxStationActiveSetRestarts);
  assert.equal(stationActiveSetRestartLimit({ ...settings, maxStationActiveSetRestarts: 7 }), 7);
  // Effective limits are reported and agree with the settings object.
  const limits = effectiveStationActiveSetLimits(settings);
  assert.equal(limits.maxStationActiveSetRestarts, settings.maxStationActiveSetRestarts);
  assert.equal(limits.maxStationUnitReleases, settings.maxStationUnitReleases);
  const effective = effectiveFullAcLimits(settings);
  assert.equal(effective?.maxStationActiveSetRestarts, settings.maxStationActiveSetRestarts);
  assert.equal(effective?.maxStationUnitReleases, settings.maxStationUnitReleases);
});

test('the validated station restart budget is preserved rather than lowered blindly', () => {
  // The parity models use 90 (SN4) and 63 (SN7) station active-set restarts, so the
  // effective default must stay at or above the observed usage.
  const defaultRestarts = stationActiveSetRestartLimit(defaultAnalysisSettings().powerFlow);
  assert.ok(defaultRestarts >= 90, `default ${defaultRestarts} is below the validated 90`);
});

test('the model-equation tolerance has one typed source and keeps the validated 0.2 %', () => {
  assert.equal(DEFAULT_MODEL_EQUATION_TOLERANCE_PERCENT, 0.2);
  assert.equal(modelEquationTolerancePercent(undefined), 0.2);
  assert.equal(modelEquationTolerancePercent(defaultAnalysisSettings().powerFlow), 0.2);
  assert.equal(modelEquationTolerancePu(undefined), 0.002);
  assert.equal(modelEquationTolerancePu({ ...defaultAnalysisSettings().powerFlow, modelEquationTolerancePercent: 0.5 }), 0.005);
  // A non-positive or non-finite configured value falls back to the single default
  // instead of to an undeclared per-call-site literal.
  assert.equal(modelEquationTolerancePercent({ ...defaultAnalysisSettings().powerFlow, modelEquationTolerancePercent: 0 }), 0.2);
  assert.equal(modelEquationTolerancePercent({ ...defaultAnalysisSettings().powerFlow, modelEquationTolerancePercent: Number.NaN }), 0.2);
});

test('station settings round-trip through merge with the new bounds intact', () => {
  const merged = defaultAnalysisSettings().powerFlow;
  assert.equal(merged.maxStationActiveSetRestarts, 128);
  assert.equal(merged.maxStationUnitReleases, 2);
});