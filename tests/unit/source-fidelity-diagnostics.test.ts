import test from 'node:test';
import assert from 'node:assert/strict';
import { MIN_BRANCH_IMPEDANCE_PU, isValidBranchImpedance, prepareModel } from '../../src/analysis/power-flow/preparation';
import { buildY } from '../../src/analysis/power-flow/js/ybus';
import type { CanonicalNetwork } from '../../src/domain/model/network';

/**
 * Silent data overrides and the near-zero-impedance policy.
 *
 * A substituted or excluded branch is not source-exact physics, so it must be visible.
 * The preparation threshold and the admittance threshold are one policy: a branch that
 * passes preparation must not fail admittance formation for the same reason.
 */

const entity = (id: string, sourceClass = 'ElmTerm') => ({ id, name: id, sourceClass, sourceId: id, inService: true, siteIds: ['S'], sourceRefs: {} });

const network = (lines: CanonicalNetwork['lines']): CanonicalNetwork => {
  const buses = ['B0', 'B1', 'B2'].map(id => ({ ...entity(id), vnKv: 154, parentId: 'S' }));
  return {
    schemaVersion: 1, modelHash: 'x', name: 'x', size: 0, baseMva: 100, buses, lines, transformers: [],
    generators: [{ ...entity('G1', 'ElmSym'), bus: 'B1', pMw: 0, qMvar: 0, vmSet: 1, voltageControl: true, qMin: -10, qMax: 10 }],
    loads: [{ ...entity('D2', 'ElmLod'), bus: 'B2', pMw: 10, qMvar: 2 }], shunts: [], seriesCompensators: [],
    externalGrids: [{ ...entity('X0', 'ElmXnet'), bus: 'B0', pMw: 0, qMvar: 0, vmSet: 1 }],
    internationalConnections: [], switches: [], stationControllers: [], secondaryControllers: [], boundaries: [], sites: [],
    classCounts: {}, records: 0, warnings: [],
    capabilities: { powerFlow: { state: 'READY', reasons: [] }, shortCircuit3Phase: { state: 'BLOCKED', reasons: [] }, shortCircuitGround: { state: 'BLOCKED', reasons: [] }, n1: { state: 'BLOCKED', reasons: [] } },
  };
};

const healthyLine = { ...entity('L1', 'ElmLne'), from: 'B0', to: 'B1', vnKv: 154, lengthKm: 1, rOhm: 1, xOhm: 12, bSiemens: 0, ratingMva: 100, coordinates: [], sections: 1 } as const;
const nearZeroLine = { ...entity('LN', 'ElmLne'), from: 'B1', to: 'B2', vnKv: 154, lengthKm: 1, rOhm: 0, xOhm: 1e-9, bSiemens: 0, ratingMva: 100, coordinates: [], sections: 1 } as const;

test('preparation and admittance formation share one near-zero-impedance threshold', () => {
  assert.ok(MIN_BRANCH_IMPEDANCE_PU > 0);
  // The previous admittance test was `r*r+x*x > 1e-18`, i.e. hypot > 1e-9, which was
  // tighter than the preparation bound. Both must now accept and reject the same branch.
  assert.equal(isValidBranchImpedance(0, 1e-9, 1), false);
  assert.equal(isValidBranchImpedance(0, MIN_BRANCH_IMPEDANCE_PU * 2, 1), true);
  assert.equal(isValidBranchImpedance(MIN_BRANCH_IMPEDANCE_PU * 2, 0, 1), true);
  assert.equal(isValidBranchImpedance(Number.NaN, 1, 1), false);
  assert.equal(isValidBranchImpedance(1, 1, 0), false);
});

test('a branch excluded by the shared policy is reported and never becomes INVALID_BRANCH', () => {
  const prepared = prepareModel(network([healthyLine, nearZeroLine]));
  const fidelity = prepared.diagnostics.sourceFidelity as { droppedBranchCount: number; droppedBranchIds: string[]; fidelity: string };
  assert.equal(fidelity.droppedBranchCount, 1);
  assert.deepEqual(fidelity.droppedBranchIds, ['LN']);
  assert.equal(fidelity.fidelity, 'PARTIAL');
  const nearZero = prepared.diagnostics.nearZeroImpedance as { thresholdPu: number; excludedBranchCount: number };
  assert.equal(nearZero.thresholdPu, MIN_BRANCH_IMPEDANCE_PU);
  assert.equal(nearZero.excludedBranchCount, 1);
  // The exclusion happens once, in preparation, so admittance formation does not reject it.
  assert.doesNotThrow(() => buildY(prepared.model));
});

test('a model with no substituted or excluded data reports SOURCE_EXACT', () => {
  const prepared = prepareModel(network([healthyLine]));
  const fidelity = prepared.diagnostics.sourceFidelity as { droppedBranchCount: number; fidelity: string };
  assert.equal(fidelity.droppedBranchCount, 0);
  assert.equal(fidelity.fidelity, 'SOURCE_EXACT');
  assert.equal((prepared.diagnostics.nearZeroImpedance as { excludedBranchCount: number }).excludedBranchCount, 0);
});

test('a branch exactly at the threshold is kept, not dropped', () => {
  // The line threshold is compared on the per-unit model base: xOhm / ((vnKv^2)/baseMVA).
  const baseOhm = (154 * 154) / 100;
  const atThreshold = { ...entity('LB', 'ElmLne'), from: 'B1', to: 'B2', vnKv: 154, lengthKm: 1, rOhm: 0, xOhm: MIN_BRANCH_IMPEDANCE_PU * baseOhm, bSiemens: 0, ratingMva: 100, coordinates: [], sections: 1 } as const;
  const prepared = prepareModel(network([healthyLine, atThreshold]));
  assert.equal((prepared.diagnostics.sourceFidelity as { droppedBranchCount: number }).droppedBranchCount, 0);
  assert.doesNotThrow(() => buildY(prepared.model));
});