import test from 'node:test';
import assert from 'node:assert/strict';
import { buildN1CandidateCatalog, filterN1CatalogCandidates } from '../../src/domain/n1/catalog';
import { emptyScenario } from '../../src/domain/scenario/overlay';
import type { CanonicalNetwork } from '../../src/domain/model/network';

function sampleNetwork(): CanonicalNetwork {
  const site = (id: string, areaId: string) => ({ id, name: id, sourceClass: 'ElmSubstat', sourceId: id, inService: true, siteIds: [id], sourceRefs: {}, lat: null, lon: null, areaId, areaName: areaId, voltages: [110] });
  const buses = [['a', 'tm-a'], ['b', 'tm-b'], ['c', 'tm-c']].map(([id, siteId]) => ({ id, name: id, sourceClass: 'ElmTerm', sourceId: id, inService: true, siteIds: [siteId], sourceRefs: {}, vnKv: 110, parentId: id }));
  const lines = [['ab', 'a', 'b'], ['bc', 'b', 'c'], ['ca', 'c', 'a']].map(([id, from, to]) => ({ id, name: id, sourceClass: 'ElmLne', sourceId: id, inService: true, siteIds: [], sourceRefs: {}, from, to, vnKv: 110, lengthKm: 1, rOhm: 0.1, xOhm: 10, bSiemens: 0, ratingMva: null, coordinates: [], sections: 0 }));
  const load = { id: 'load', name: 'load', sourceClass: 'ElmLod', sourceId: 'load', inService: true, siteIds: [], sourceRefs: {}, bus: 'c', pMw: 10, qMvar: 0 };
  const grid = { ...load, id: 'grid', sourceClass: 'ElmXnet', sourceId: 'grid', bus: 'a', vmSet: 1 };
  return {
    schemaVersion: 1, modelHash: 'catalog-model', name: 'catalog', size: 3, baseMva: 100,
    buses, lines, transformers: [], generators: [], loads: [load], shunts: [], seriesCompensators: [], externalGrids: [grid],
    internationalConnections: [], switches: [], stationControllers: [], secondaryControllers: [], boundaries: [], sites: [site('tm-a', 'ytm-1'), site('tm-b', 'ytm-1'), site('tm-c', 'ytm-2')],
    classCounts: {}, records: 3, warnings: [], capabilities: { powerFlow: { state: 'READY', reasons: [] }, shortCircuit3Phase: { state: 'BLOCKED', reasons: [] }, shortCircuitGround: { state: 'BLOCKED', reasons: [] }, n1: { state: 'READY', reasons: [] } },
  } as CanonicalNetwork;
}

test('N-1 catalog maps endpoint sites and applies explicit at-least-one-endpoint YTM/TM scope', () => {
  const catalog = buildN1CandidateCatalog(sampleNetwork(), emptyScenario());
  assert.equal(catalog.counts.total, 3);
  const ab = catalog.candidates.find((candidate) => candidate.equipmentId === 'ab')!;
  assert.deepEqual(ab.fromSiteIds, ['tm-a']);
  assert.deepEqual(ab.toSiteIds, ['tm-b']);
  assert.deepEqual(ab.fromYtmIds, ['ytm-1']);
  assert.deepEqual(filterN1CatalogCandidates(catalog.candidates, { ytmId: 'ytm-2', tmId: 'tm-a' }), []);
  assert.deepEqual(filterN1CatalogCandidates(catalog.candidates, { ytmId: 'ytm-1', tmId: 'tm-a' }).map((candidate) => candidate.equipmentId), ['ab', 'ca']);
});
