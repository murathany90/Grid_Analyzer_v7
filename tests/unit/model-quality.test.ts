import assert from 'node:assert/strict';
import test from 'node:test';
import { auditModelQuality } from '../../src/domain/model-quality';
import type { CanonicalNetwork } from '../../src/domain/model/network';

test('model quality audit is deterministic, read-only, and retains source references', () => {
  const bus = { id: 'B1', name: 'Bus 1', sourceClass: 'ElmTerm', sourceId: 'B1', inService: true, siteIds: [], sourceRefs: { vnKv: [{ sourceClass: 'ElmTerm', sourceId: 'B1', field: 'uknom', unit: 'kV' }] }, vnKv: 0, parentId: 'grid' };
  const generator = { id: 'G1', name: 'Generator 1', sourceClass: 'ElmSym', sourceId: 'G1', inService: true, siteIds: [], sourceRefs: {}, qMin: null, qMax: null, vmSet: 0 };
  const network = { modelHash: 'audit-fixture', buses: [bus], lines: [], transformers: [], generators: [generator], externalGrids: [], stationControllers: [] } as unknown as CanonicalNetwork;
  const before = JSON.stringify(network);
  const first = auditModelQuality(network);
  const second = auditModelQuality(network);
  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(network), before);
  const finding = first.findings.find(item => item.code === 'BUS_VN_INVALID');
  assert.ok(finding);
  assert.equal(finding.severity, 'BLOCKER');
  assert.equal(finding.sourceRefs[0]?.field, 'uknom');
  assert.equal(first.summary.counts.BLOCKER, 1);
  assert.deepEqual(first.findings.map(item => item.severity), ['BLOCKER', 'ERROR', 'WARNING']);
});

test('model quality reuses preparation and reduced-model diagnostics', () => {
  const network = { modelHash: 'diagnostic-fixture', buses: [], lines: [], transformers: [], generators: [], externalGrids: [], stationControllers: [] } as unknown as CanonicalNetwork;
  const result = auditModelQuality(network, {
    preparationDiagnostics: { islands: [{ islandId: 'island-1', status: 'NO_REFERENCE' }] },
    reducedModelDiagnostics: { excludedInputs: 2, seriesUnresolved: 1 },
  });
  assert.deepEqual(result.findings.map(item => item.code).sort(), ['ISLAND_WITHOUT_REFERENCE', 'REDUCED_MODEL_INPUTS_EXCLUDED', 'SERIES_COMPENSATION_UNRESOLVED']);
  assert.equal(result.summary.counts.BLOCKER, 1);
  assert.equal(result.summary.categoryCounts.REDUCED_MODEL, 2);
});
