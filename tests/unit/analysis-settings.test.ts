import test from 'node:test';
import assert from 'node:assert/strict';
import { AnalysisSettingsStore, activeAnalysisSettings, analysisSettingsHash, defaultAnalysisSettings } from '../../src/domain/calculation/analysis-settings';
import { emptyScenario } from '../../src/domain/scenario/overlay';
import { identity } from '../../src/domain/calculation/identity';
import { solveIslandDC } from '../../src/analysis/dc/js';
import { solveIslandV52, type FastAcIsland } from '../../src/analysis/fast-ac/js';

test('analysis settings default to the documented PowerFactory parity profile and keep DC free of Q settings', () => {
  const settings = defaultAnalysisSettings();
  assert.equal(settings.powerFlow.profile, 'POWERFACTORY_TEIAS_PARITY');
  assert.equal(settings.powerFlow.maxInnerIterations, 100);
  assert.equal(settings.powerFlow.maxOuterIterations, 50);
  assert.equal(settings.powerFlow.nodalToleranceKva, 5);
  assert.equal(settings.powerFlow.modelEquationTolerancePercent, .2);
  assert.equal(settings.powerFlow.stationControlMode, 'droop');
  assert.equal(settings.dc.maxLinearIterations, 20000);
  assert.equal('qTolerance' in settings.dc, false);
});

test('analysis settings store validates values and persists under the dedicated key', () => {
  const oldStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) } });
  try {
    const store = new AnalysisSettingsStore(); store.value.dc.maxLinearIterations = 0; store.update(store.value);
    assert.equal(store.value.dc.maxLinearIterations, 1);
    assert.ok(data.has('grid-analyzer-v7-analysis-settings'));
    const restored = new AnalysisSettingsStore(); assert.equal(restored.value.dc.maxLinearIterations, 1);
  } finally {
    if (oldStorage) Object.defineProperty(globalThis, 'localStorage', oldStorage); else delete (globalThis as { localStorage?: unknown }).localStorage;
  }
});

test('calculation identity changes when active analysis settings change', () => {
  const settings = defaultAnalysisSettings(), initial = activeAnalysisSettings(settings, 'dc');
  const first = identity('model', emptyScenario(), 'dc', { analysisSettings: initial, analysisSettingsHash: analysisSettingsHash(settings, 'dc') });
  settings.dc.maxLinearIterations++;
  const second = identity('model', emptyScenario(), 'dc', { analysisSettings: activeAnalysisSettings(settings, 'dc'), analysisSettingsHash: analysisSettingsHash(settings, 'dc') });
  assert.notEqual(first.optionsHash, second.optionsHash);
});

test('DC iteration limit and residual tolerance are applied by the solver', () => {
  const model = { busIds: ['s', 'a', 'b', 'c'], slack: 0, baseMVA: 100, injections: [[0, 0], [-20, 0], [-30, 0], [50, 0]], edges: [
    { id: 'L1', cls: 'ElmLne', a: 0, b: 1, x: .1 }, { id: 'L2', cls: 'ElmLne', a: 1, b: 2, x: .2 }, { id: 'L3', cls: 'ElmLne', a: 2, b: 3, x: .15 }, { id: 'L4', cls: 'ElmLne', a: 0, b: 3, x: .3 }
  ] };
  const oneStep = solveIslandDC(model, { maxLinearIterations: 1, relativeResidualTolerance: 1e-14 });
  const converged = solveIslandDC(model, { maxLinearIterations: 100, relativeResidualTolerance: 1e-10 });
  assert.equal(oneStep.iterations, 1);
  assert.equal(oneStep.status, 'NOT_CONVERGED');
  assert.equal(converged.status, 'CONVERGED_DC');
});

test('Fast AC iteration limit and Newton refinement switch are applied', () => {
  const model: FastAcIsland = { busIds: ['s', 'l'], injections: [[0, 0], [-50, -20]], edges: [{ id: 'L1', cls: 'ElmLne', a: 0, b: 1, r: .01, x: .1, bc: 0, tap: 1 }], shunts: [0, 0], slack: 0, baseMVA: 100 };
  const limited = solveIslandV52(model, { nrRefinementEnabled: false, maxIterations: 1, mismatchTolerance: 1e-14 });
  assert.equal(limited.status, 'NO_CONVERGENCE');
  assert.equal(limited.iterations, 1);
  const withoutRefinement = solveIslandV52(model, { nrRefinementEnabled: false });
  assert.equal(withoutRefinement.status, 'CONVERGED_PQ_APPROX');
  assert.equal(withoutRefinement.nrIterations, undefined);
});
