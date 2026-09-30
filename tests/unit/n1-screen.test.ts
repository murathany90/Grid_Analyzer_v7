import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyN1Topology, n1OptionsIdentity, runN1Screen, type N1Candidate } from '../../src/domain/n1';
import { emptyScenario } from '../../src/domain/scenario/overlay';
import type { CanonicalNetwork } from '../../src/domain/model/network';
import type { ReducedNetwork } from '../../src/analysis/fast-ac/reduced-model';

function candidate(id: string): N1Candidate {
  return { candidateId: `ElmLne:${id}`, equipmentId: id, sourceClass: 'ElmLne', name: id, vnKv: 110, from: 'a', to: 'b', siteIds: [], screenable: true, ratingAvailable: true, representedInReducedModel: true, exclusionReason: null, topology: 'NON_ISLANDING' };
}

function network(withRatings = true): CanonicalNetwork {
  const buses = ['a', 'b', 'c'].map((id) => ({ id, name: id, sourceClass: 'ElmTerm', sourceId: id, inService: true, siteIds: [], sourceRefs: {}, vnKv: 110, parentId: id }));
  const endpoints = [['a', 'b'], ['b', 'c'], ['a', 'c']] as const;
  const lines = endpoints.map(([from, to], i) => ({ id: `l${i + 1}`, name: `l${i + 1}`, sourceClass: 'ElmLne', sourceId: `l${i + 1}`, inService: true, siteIds: [], sourceRefs: {}, from, to, vnKv: 110, lengthKm: 10, rOhm: 0.1, xOhm: 12.1, bSiemens: 0, ratingMva: withRatings ? 100 : null, ...(withRatings ? { capacity: { quality: 'DGS_MAIN_TYPE' as const, typeId: null, typeName: null, nominalCurrentKA: 0.525, nominalMVA: 100, limitingSectionId: null, sections: [], seasonalReference: null } } : {}), coordinates: [], sections: 0 }));
  const generator = { id: 'g1', name: 'g1', sourceClass: 'ElmSym', sourceId: 'g1', inService: true, siteIds: [], sourceRefs: {}, bus: 'b', pMw: 100, qMvar: 0, vmSet: 1, voltageControl: false, qMin: null, qMax: null };
  const load = { id: 'load1', name: 'load1', sourceClass: 'ElmLod', sourceId: 'load1', inService: true, siteIds: [], sourceRefs: {}, bus: 'c', pMw: 100, qMvar: 0 };
  const grid = { ...load, id: 'grid', sourceClass: 'ElmXnet', sourceId: 'grid', bus: 'a', pMw: 0, vmSet: 1 };
  return { schemaVersion: 1, modelHash: 'model-1', name: 'test', size: 3, baseMva: 100, buses, lines, transformers: [], generators: [generator], loads: [load], shunts: [], seriesCompensators: [], externalGrids: [grid], internationalConnections: [], switches: [], stationControllers: [], secondaryControllers: [], boundaries: [], sites: [], classCounts: {}, records: 3, warnings: [], capabilities: { powerFlow: { state: 'READY', reasons: [] }, shortCircuit3Phase: { state: 'BLOCKED', reasons: [] }, shortCircuitGround: { state: 'BLOCKED', reasons: [] }, n1: { state: 'READY', reasons: [] } } } as CanonicalNetwork;
}

test('N-1 topology treats parallel branches as non-bridges and marks a cut edge islanding', () => {
  const reduced = { islands: [{ busIds: ['a', 'b', 'c', 'd'], edges: [{ id: 'p1', cls: 'ElmLne', a: 0, b: 1, x: 1, r: 0, bc: 0, tap: 1 }, { id: 'p2', cls: 'ElmLne', a: 0, b: 1, x: 1, r: 0, bc: 0, tap: 1 }, { id: 'cut', cls: 'ElmLne', a: 1, b: 2, x: 1, r: 0, bc: 0, tap: 1 }], injections: [], shunts: [], slack: 0, pv: [], slackSetpoint: 1, baseMVA: 100, iterations: 1, threshold: 1, pvLimits: [] }], buses: new Map(), warnings: [], diagnostics: {} } as unknown as ReducedNetwork;
  const classified = classifyN1Topology(reduced, [candidate('p1'), candidate('cut')]);
  assert.equal(classified[0].topology, 'NON_ISLANDING');
  assert.equal(classified[1].topology, 'ISLANDING');
});

test('triangle DC outage uses LODF redistribution consistent with the reduced DC model', () => {
  const result = runN1Screen(network(), emptyScenario(), { candidateTypes: ['ElmLne'] });
  const ab = result.candidates.find(c => c.equipmentId === 'l1')!;
  const bc = ab.topImpacts.find(i => i.equipmentId === 'l2')!;
  assert.equal(result.baseDcStatus, 'CONVERGED_DC');
  assert.ok(Math.abs(Math.abs(bc.deltaPMw) - 33.333333) < 0.01);
  assert.equal(result.dcDiagnostics.factorizationCount, 1);
  assert.equal(result.dcDiagnostics.rhsCount, 3);
});

test('unrated reduced branches report CAPACITY_UNAVAILABLE instead of a no-violation result', () => {
  const result = runN1Screen(network(false), emptyScenario(), { candidateTypes: ['ElmLne'] });
  assert.ok(result.candidates.every(c => c.status === 'CAPACITY_UNAVAILABLE'));
  assert.ok(result.candidates.every(c => c.ratingCoverage.percent === 0));
  assert.equal(result.candidates[0].estimatedOverloadCount, 0);
});

test('N-1 identity changes with effective scenario and screening options', () => {
  const n = network(), empty = emptyScenario(), switched = { ...empty, lineStatus: { l1: false } };
  const original = n1OptionsIdentity(n, empty, { candidateTypes: ['ElmLne'] });
  assert.notEqual(original.scenarioHash, n1OptionsIdentity(n, switched, { candidateTypes: ['ElmLne'] }).scenarioHash);
  assert.notEqual(original.optionsHash, n1OptionsIdentity(n, empty, { candidateTypes: ['ElmTr2'] }).optionsHash);
});
