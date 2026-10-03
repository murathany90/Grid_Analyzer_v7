import assert from 'node:assert/strict';
import test from 'node:test';
import type { CanonicalNetwork } from '../../src/domain/model/network';
import { buildSplitBusTopology } from '../../src/topology/split-bus';

const entity = (id: string, sourceClass: string, siteIds = ['S']) => ({ id, name: id, sourceClass, sourceId: id, inService: true, siteIds, sourceRefs: {} });
const bus = (id: string) => ({ ...entity(id, 'ElmTerm'), vnKv: 154, parentId: 'S' });
const line = (id: string, from: string, to: string) => ({ ...entity(id, 'ElmLne'), from, to, vnKv: 154, lengthKm: 1, rOhm: 1, xOhm: 10, bSiemens: 0, ratingMva: 100, coordinates: [], sections: 0 });
const grid = (id: string, at: string) => ({ ...entity(id, 'ElmXnet'), bus: at, pMw: 0, qMvar: 0, vmSet: 1 });
const generator = (id: string, at: string) => ({ ...entity(id, 'ElmSym'), bus: at, pMw: 10, qMvar: 0, vmSet: 1, voltageControl: true, qMin: -20, qMax: 20 });
function network(options: { lines?: ReturnType<typeof line>[]; couplerClosed?: boolean; busIds?: string[]; grids?: ReturnType<typeof grid>[]; generators?: ReturnType<typeof generator>[] } = {}): CanonicalNetwork {
  const buses = (options.busIds || ['A1', 'A2', 'B1', 'B2']).map(bus);
  const coupler = { ...entity('C1', 'ElmCoup'), from: 'A1', to: 'B1', closed: options.couplerClosed ?? false };
  const site = { ...entity('S', 'ElmSite'), lat: 39, lon: 32, areaId: 'A', areaName: 'Area', voltages: [154] };
  return { schemaVersion: 1, modelHash: 'split', name: 'split', size: 0, baseMva: 100, buses,
    lines: options.lines || [line('L1', 'A1', 'A2'), line('L2', 'B1', 'B2')], transformers: [], generators: options.generators || [], loads: [], shunts: [],
    seriesCompensators: [], externalGrids: options.grids ?? [grid('X1', 'A1')], internationalConnections: [], switches: [coupler],
    stationControllers: [], secondaryControllers: [], boundaries: [], sites: [site], classCounts: {}, records: 0, warnings: [],
    capabilities: { powerFlow: { state: 'READY', reasons: [] } } } as unknown as CanonicalNetwork;
}

test('open 154 kV coupler between bus groups is a split bus while each real component remains independently classified', () => {
  const result = buildSplitBusTopology(network());
  assert.equal(result.splitStations.length, 1);
  assert.equal(result.splitStations[0].classification, 'SPLIT_BUS');
  assert.equal(result.splitStations[0].sameConnectedComponent, false);
  assert.equal(result.splitStations[0].topologyRelation, 'SEPARATE_COMPONENTS');
  assert.equal(result.splitStations[0].bus1.feederCount, 1);
  assert.equal(result.splitStations[0].bus2.feederCount, 1);
  assert.equal(result.islands.length, 2);
  assert.deepEqual(result.islands.map(island => island.classification), ['TRUE_ISLAND', 'UNSUPPLIED_ISLAND']);
});

test('open bus coupler remains SPLIT_BUS when both sides reconnect through another network path', () => {
  const result = buildSplitBusTopology(network({ lines: [line('L1', 'A1', 'A2'), line('L2', 'B1', 'B2'), line('TIE', 'A2', 'B2')] }));
  assert.equal(result.splitStations.length, 1);
  assert.equal(result.splitStations[0].sameConnectedComponent, true);
  assert.equal(result.splitStations[0].topologyRelation, 'SAME_COMPONENT_VIA_ALTERNATE_PATH');
  assert.equal(result.islands.length, 1);
  assert.equal(result.islands[0].classification, 'NORMAL');
});

test('closed ElmCoup merges electrical buses and does not produce split-bus classification', () => {
  const result = buildSplitBusTopology(network({ couplerClosed: true }));
  assert.equal(result.splitStations.length, 0);
  assert.equal(result.terminalToElectricalBus.get('A1'), result.terminalToElectricalBus.get('B1'));
});

test('open coupler without valid 154 kV bus endpoints is not classified as a 154 kV split', () => {
  const n = network();
  const changed = { ...n, buses: n.buses.map(item => item.id === 'B1' ? { ...item, vnKv: 110 } : item) } as CanonicalNetwork;
  assert.equal(buildSplitBusTopology(changed).splitStations.length, 0);
});

test('generator-only disconnected component stays unreferenced and unsupplied for topology classification', () => {
  const result = buildSplitBusTopology(network({ grids: [], generators: [generator('G1', 'B1')] }));
  const island = result.islands.find(row => row.busIds.some(id => id.includes('B1')))!;
  assert.equal(island.classification, 'UNSUPPLIED_ISLAND');
  assert.equal(island.referencePresent, false);
  assert.equal(island.supplied, false);
  assert.equal(island.generatorCount, 1);
  assert.equal(island.sourceCount, 1);
});
