import test from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultAnalysisSettings,
  effectiveFullAcLimits,
  mergeExposedAnalysisSettings,
  profileFidelity,
  unsupportedFullAcSettings,
  unsupportedSharedSettings,
} from '../../src/domain/calculation/analysis-settings';
import { acceptsNewtonStep } from '../../src/analysis/power-flow/js/newton';
import { calculationConvergenceLabel, fullAcDiagnostics } from '../../src/domain/results/diagnostics';

test('effective loop bounds are typed settings, not internal constants', () => {
  const settings = defaultAnalysisSettings().powerFlow;
  const limits = effectiveFullAcLimits(settings);
  assert.ok(limits);
  assert.equal(limits?.maxNewtonIterations, settings.maxInnerIterations);
  assert.equal(limits?.maxActiveBalanceCorrections, settings.maxActiveBalanceCorrections);
  assert.equal(limits?.maxFinalActiveBalanceCorrections, settings.maxFinalActiveBalanceCorrections);
  assert.equal(limits?.maxQLimitRounds, settings.maxQLimitRounds);
  assert.equal(limits?.maxStationControlCorrections, settings.maxStationControlCorrections);
});

test('defaults reproduce the previously hardcoded internal caps', () => {
  const settings = defaultAnalysisSettings().powerFlow;
  assert.equal(settings.maxActiveBalanceCorrections, 8);
  assert.equal(settings.maxFinalActiveBalanceCorrections, 8);
  assert.equal(settings.maxQLimitRounds, 8);
  assert.equal(settings.maxStationControlCorrections, 16);
  // The UI-exposed outer bound stays separate and larger, as before.
  assert.equal(settings.maxOuterIterations, 50);
});

test('exposed loop bounds survive settings merge and are bounded', () => {
  const merged = mergeExposedAnalysisSettings({ powerFlow: { maxQLimitRounds: 3, maxActiveBalanceCorrections: 2, maxFinalActiveBalanceCorrections: 7, maxStationControlCorrections: 4 } });
  assert.equal(merged.powerFlow.maxQLimitRounds, 3);
  assert.equal(merged.powerFlow.maxActiveBalanceCorrections, 2);
  assert.equal(merged.powerFlow.maxFinalActiveBalanceCorrections, 7);
  assert.equal(merged.powerFlow.maxStationControlCorrections, 4);
  const clamped = mergeExposedAnalysisSettings({ powerFlow: { maxQLimitRounds: 0, maxActiveBalanceCorrections: -5, maxFinalActiveBalanceCorrections: 0 } });
  assert.equal(clamped.powerFlow.maxQLimitRounds, 1, 'out-of-range loop bounds clamp to the minimum');
  assert.equal(clamped.powerFlow.maxActiveBalanceCorrections, 1);
  assert.equal(clamped.powerFlow.maxFinalActiveBalanceCorrections, 1);
  const nonNumeric = mergeExposedAnalysisSettings({ powerFlow: { maxStationControlCorrections: 'many' } });
  assert.equal(nonNumeric.powerFlow.maxStationControlCorrections, 16, 'invalid values fall back to the default');
});

test('no profile claims verified PowerFactory parity', () => {
  for (const profile of ['POWERFACTORY_TEIAS_PARITY', 'GA_ROBUST', 'CUSTOM'] as const) {
    const claim = profileFidelity(profile);
    assert.notEqual(claim.fidelity, 'VERIFIED');
    assert.ok(claim.limits.length > 0);
  }
  assert.match(profileFidelity('POWERFACTORY_TEIAS_PARITY').label, /not verified/i);
});

test('unconsumed settings are declared unsupported', () => {
  assert.ok(unsupportedSharedSettings().includes('loadScalePercent'));
  assert.ok(unsupportedSharedSettings().includes('storageHeaterScalePercent'));
  assert.ok(unsupportedFullAcSettings().includes('repeatedReactiveLimitDetection'));
  assert.ok(unsupportedFullAcSettings().includes('automaticTransformerTap'));
  // Settings the solver genuinely consumes must not be listed as unsupported.
  const defaults = defaultAnalysisSettings().powerFlow;
  for (const consumed of ['maxInnerIterations', 'nodalToleranceKva', 'qLimitToleranceMvar', 'reactiveLimitsEnabled', 'maxNoImprovementIterations'] as const) {
    assert.equal(unsupportedFullAcSettings().includes(consumed as never), false, `${consumed} is consumed`);
    assert.ok((defaults as unknown as Record<string, unknown>)[consumed] !== undefined);
  }
});

test('Newton line-search acceptance follows the nodal tolerance instead of a fixed 1e-6', () => {
  // No Armijo decrease, so acceptance depends only on the nodal mismatch test. The fixed
  // 1e-6 threshold previously accepted this step even though it violated a 5 kVA tolerance.
  assert.equal(acceptsNewtonStep(1, 1, 1, 4.9e-5, 5e-5), true, 'mismatch inside the configured tolerance is accepted');
  assert.equal(acceptsNewtonStep(1, 1, 1, 5e-5, 1e-8), false, 'the same mismatch is rejected under a tighter tolerance');
  // Default keeps the historical threshold for direct callers.
  assert.equal(acceptsNewtonStep(1, 2, 1, 1e-7), true);
  assert.equal(acceptsNewtonStep(1, 2, 1, 1e-5), false);
});

test('full AC work counters are reported separately from the Newton iteration count', () => {
  const diagnostics = fullAcDiagnostics({
    iterations: 7,
    diagnostics: {
      fullNrSolves: 30,
      kluNewtonFactorizations: 176,
      outerControlRounds: 8,
      activeBalancing: { iterations: 5 },
      qLimitActiveSet: { rounds: [{}, {}] },
    },
  } as never);
  assert.equal(diagnostics.newtonIterations, 7);
  assert.equal(diagnostics.fullNrSolves, 30);
  assert.equal(diagnostics.kluFactorizations, 176);
  assert.equal(diagnostics.stationControlRounds, 8);
  assert.equal(diagnostics.activeBalanceCorrections, 5);
  assert.equal(diagnostics.qLimitRounds, 2);
  const empty = fullAcDiagnostics(null);
  assert.equal(empty.fullNrSolves, null);
  assert.equal(empty.newtonIterations, null);
});

test('Full AC diagnostics distinguish total and final Newton counts and disclose partial controls',()=>{
  const result={converged:true,status:'CONVERGED',iterations:1,diagnostics:{totalNewtonIterations:61,resultProvenance:'SENSITIVITY_STATION_CONTROL',convergence:{activeBalance:'ACTIVE_BALANCE_CONVERGED',stationControl:'STATION_CONTROL_PARTIAL',pendingControllerStatuses:{CONTROL_RESIDUAL_AFTER_FINAL_BALANCE:101}}}} as never;
  const work=fullAcDiagnostics(result);
  assert.equal(work.newtonIterations,61);
  assert.equal(work.finalNewtonIterations,1);
  // A converged Newton solve with a partial station requirement is never labelled as a
  // full solution, and the unresolved controller count is preserved.
  const label=calculationConvergenceLabel(result);
  assert.ok(label.includes('tam çözüm değil'),label);
  assert.ok(label.includes('istasyon kontrolü kısmi'),label);
  assert.ok(!label.includes('Yakınsadı · P dengesi yakınsadı · istasyon kontrolü yakınsadı'));
  assert.equal(calculationConvergenceLabel({converged:true,status:'CONVERGED',identity:{analysisType:'dc'}} as never),'DC doğrusal çözüm tamamlandı · P-only');
  assert.equal(calculationConvergenceLabel({converged:true,status:'CONVERGED',identity:{analysisType:'fastAc'}} as never),'Hızlı yaklaşık AC · CONVERGED');
});
