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

test('multi-YTM internal/boundary and native voltage bands preserve full network scope',()=>{
  const n=sampleNetwork(),all=buildN1CandidateCatalog(n,emptyScenario()).candidates;
  assert.deepEqual(filterN1CatalogCandidates(all,{ytmIds:['ytm-1'],endpointScope:'INTERNAL'}).map(c=>c.equipmentId),['ab']);
  assert.deepEqual(filterN1CatalogCandidates(all,{ytmIds:['ytm-1'],endpointScope:'CONNECTED'}).map(c=>c.equipmentId),['bc','ca']);
  assert.equal(filterN1CatalogCandidates(all,{ytmIds:['ytm-1','ytm-2'],endpointScope:'BOTH'}).length,3);
  const low={...n,buses:n.buses.map(b=>({...b,vnKv:34.5})),lines:n.lines.map(l=>({...l,vnKv:34.5}))};
  assert.equal(buildN1CandidateCatalog(low,emptyScenario()).candidates.length,0);
  const catalog=buildN1CandidateCatalog(low,emptyScenario(),{includeAllVoltages:true});assert.equal(catalog.candidates.length,3);assert.ok(catalog.candidates.every(c=>!c.screenable&&c.topology==='NON_ISLANDING'));assert.equal(catalog.counts.screenable,0);assert.equal(catalog.counts.unscreenable,3);
  const tr={...n,transformers:[{...n.lines[0],id:'TR',sourceId:'TR',sourceClass:'ElmTr2',lvKv:34.5,ratingMva:10,rPu:.01,xPu:.1,tap:1,phase:0,tapPosition:0,gPu:0,bPu:0}] } as CanonicalNetwork;assert.equal(filterN1CatalogCandidates(buildN1CandidateCatalog(tr,emptyScenario(),{includeAllVoltages:true}).candidates,{voltageBands:[33]}).length,1);
  assert.equal(filterN1CatalogCandidates(catalog.candidates,{voltageBands:[33]}).length,3);assert.equal(filterN1CatalogCandidates(catalog.candidates,{voltageBands:[154]}).length,0);assert.equal(n.externalGrids.length,1);
});
