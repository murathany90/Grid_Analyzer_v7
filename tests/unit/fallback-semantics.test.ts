import test from 'node:test';
import assert from 'node:assert/strict';
import { calculationConvergenceLabel, solutionCompleteness } from '../../src/domain/results/diagnostics';
import type { CalculationResult } from '../../src/domain/results/types';

/**
 * Fallback semantics.
 *
 * A station-control fallback keeps a converged local-PV operating point, so the
 * NR-level `converged` flag is true while the station voltage requirement is
 * unresolved. The existing three-level distinction is preserved exactly:
 *
 *   NR_CONVERGED / STATION_CONTROL_PARTIAL / NOT_FULLY_COMPARABLE
 *
 * `result.converged` is deliberately NOT forced to false, because convergence is
 * reported per concern. What must be guaranteed is that a fallback can never be
 * read as a complete solution.
 */

const build = (over: Partial<CalculationResult> & { diagnostics: Record<string, unknown> }): CalculationResult =>
  ({ identity: {} as never, status: 'CONVERGED_FULL_NR', converged: true, iterations: 1, rounds: 1, maxMismatchMw: 0, elapsedMs: 1, buses: [], branches: [], generators: [], warnings: [], quality: { numericalStatus: 'NR_CONVERGED', controlFidelity: 'PARTIAL', referenceValidation: 'NOT_AVAILABLE' }, ...over }) as CalculationResult;

const convergedStation = {
  resultProvenance: 'INTEGRATED_STATION_CONTROL',
  convergence: { newtonRaphson: 'NR_CONVERGED', activeBalance: 'ACTIVE_BALANCE_CONVERGED', stationControl: 'STATION_CONTROL_CONVERGED', powerFactoryComparability: 'COMPARABLE' },
};

test('a converged station-control result is a full solution', () => {
  const result = build({ diagnostics: convergedStation });
  const completeness = solutionCompleteness(result);
  assert.equal(completeness.newtonConverged, true);
  assert.equal(completeness.stationControlApplied, true);
  assert.equal(completeness.fullSolution, true);
  assert.equal(completeness.reason, 'NONE');
  assert.equal(calculationConvergenceLabel(result), 'NR yakınsadı · P dengesi yakınsadı · istasyon kontrolü yakınsadı');
});

test('a BASELINE_FALLBACK keeps converged=true but is never a full solution', () => {
  const result = build({
    diagnostics: {
      resultProvenance: 'BASELINE_FALLBACK',
      stationControlFallback: { occurred: true, reason: 'STATION_CONTROL_NOT_APPLIED', interpretation: 'not comparable' },
      convergence: { newtonRaphson: 'NR_CONVERGED', activeBalance: 'ACTIVE_BALANCE_CONVERGED', stationControl: 'STATION_CONTROL_PARTIAL', powerFactoryComparability: 'NOT_FULLY_COMPARABLE' },
    },
  });
  // The NR-level flag is preserved; convergence stays per concern.
  assert.equal(result.converged, true);
  assert.equal(solutionCompleteness(result).fullSolution, false);
  assert.equal(solutionCompleteness(result).reason, 'STATION_CONTROL_FALLBACK');
  assert.equal(solutionCompleteness(result).stationControlApplied, false);
  const label = calculationConvergenceLabel(result);
  assert.ok(label.includes('tam çözüm değil'), label);
  assert.ok(label.includes('yerel PV geri düşüşü'), label);
  // The three-level distinction is unchanged.
  const convergence = result.diagnostics.convergence as Record<string, string>;
  assert.equal(convergence.newtonRaphson, 'NR_CONVERGED');
  assert.equal(convergence.stationControl, 'STATION_CONTROL_PARTIAL');
  assert.equal(convergence.powerFactoryComparability, 'NOT_FULLY_COMPARABLE');
});

test('a partial station requirement without a fallback is also not a full solution', () => {
  const result = build({
    diagnostics: {
      resultProvenance: 'SENSITIVITY_STATION_CONTROL',
      convergence: { newtonRaphson: 'NR_CONVERGED', activeBalance: 'ACTIVE_BALANCE_CONVERGED', stationControl: 'STATION_CONTROL_PARTIAL', powerFactoryComparability: 'NOT_FULLY_COMPARABLE' },
    },
  });
  assert.equal(solutionCompleteness(result).fullSolution, false);
  assert.equal(solutionCompleteness(result).reason, 'STATION_CONTROL_FALLBACK');
  const label = calculationConvergenceLabel(result);
  assert.ok(label.includes('tam çözüm değil'), label);
  assert.ok(!label.includes('yerel PV geri düşüşü'), label);
});

test('a non-converged Newton solve reports NEWTON_NOT_CONVERGED and keeps the status', () => {
  const result = build({
    status: 'NR_MAX_ITERATION',
    converged: false,
    diagnostics: { resultProvenance: 'LOCAL_PV', convergence: { newtonRaphson: 'NR_NOT_CONVERGED' } },
  });
  assert.equal(solutionCompleteness(result).reason, 'NEWTON_NOT_CONVERGED');
  assert.equal(calculationConvergenceLabel(result), 'NR_MAX_ITERATION');
});

test('an unresolved active balance is reported separately from a station fallback', () => {
  const result = build({
    diagnostics: {
      resultProvenance: 'INTEGRATED_STATION_CONTROL',
      convergence: { newtonRaphson: 'NR_CONVERGED', activeBalance: 'ACTIVE_BALANCE_PARTIAL', stationControl: 'STATION_CONTROL_CONVERGED', powerFactoryComparability: 'NOT_FULLY_COMPARABLE' },
    },
  });
  const completeness = solutionCompleteness(result);
  assert.equal(completeness.stationControlApplied, true);
  assert.equal(completeness.activeBalanceConverged, false);
  assert.equal(completeness.reason, 'ACTIVE_BALANCE_PARTIAL');
  assert.equal(completeness.fullSolution, false);
  assert.ok(calculationConvergenceLabel(result).includes('P dengesi kısmi'));
});

test('no result is not a full solution', () => {
  assert.equal(solutionCompleteness(null).fullSolution, false);
  assert.equal(calculationConvergenceLabel(null), 'Hesap bekleniyor');
});