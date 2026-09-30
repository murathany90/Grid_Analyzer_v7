import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyN1Topology, getN1SelectedDetail, n1OptionsIdentity, runN1Screen, type N1Candidate } from '../../src/domain/n1';
import { emptyScenario } from '../../src/domain/scenario/overlay';
import { defaultN1CandidateIds } from '../../src/features/quality-n1/quality-n1-view';
import type { CanonicalNetwork } from '../../src/domain/model/network';
import type { ReducedNetwork } from '../../src/analysis/fast-ac/reduced-model';
import type { N1CatalogCandidate } from '../../src/domain/n1/catalog';

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
  assert.ok(result.candidates.every(c => c.ratingCoverage.evaluated && c.ratingCoverage.percent === 0));
  assert.equal(result.candidates[0].estimatedOverloadCount, 0);
});

test('N-1 identity changes with effective scenario and screening options', () => {
  const n = network(), empty = emptyScenario(), switched = { ...empty, lineStatus: { l1: false } };
  const original = n1OptionsIdentity(n, empty, { candidateTypes: ['ElmLne'] });
  assert.notEqual(original.scenarioHash, n1OptionsIdentity(n, switched, { candidateTypes: ['ElmLne'] }).scenarioHash);
  assert.notEqual(original.optionsHash, n1OptionsIdentity(n, empty, { candidateTypes: ['ElmTr2'] }).optionsHash);
  assert.notEqual(original.optionsHash, n1OptionsIdentity(n, empty, { candidateTypes: ['ElmLne'], selectedCandidateIds: ['ElmLne:l1'] }).optionsHash);
  assert.notEqual(n1OptionsIdentity(n, empty, { candidateTypes: ['ElmLne'], analysisScope: 'base' }).optionsHash, n1OptionsIdentity(n, empty, { candidateTypes: ['ElmLne'], analysisScope: 'scenario' }).optionsHash);
});

test('outage rating does not invalidate complete surviving-branch monitoring', () => {
  const base = network();
  const lines = base.lines.map(line => line.id === 'l1' ? { ...line, capacity: undefined, ratingMva: null } : { ...line, capacity: { ...line.capacity!, nominalMVA: 200 } });
  const result = runN1Screen({ ...base, lines } as CanonicalNetwork, emptyScenario(), { selectedCandidateIds: ['ElmLne:l1'] });
  const outage = result.candidates[0];
  assert.equal(outage.outageRatingAvailable, false);
  assert.equal(outage.ratingCoverage.evaluated, true);
  assert.equal(outage.ratingCoverage.ratedBranches, outage.ratingCoverage.totalBranches);
  assert.equal(outage.status, 'SCREENED_NO_VIOLATION');
  assert.equal(result.unratedCount, 1);
});

test('selected candidate IDs scope N-1 results and progress reaches 100 monotonically', () => {
  const progress: number[] = [];
  const result = runN1Screen(network(), emptyScenario(), { candidateTypes: ['ElmLne'], selectedCandidateIds: ['ElmLne:l2'] }, { onProgress: p => progress.push(p.percent) });
  assert.deepEqual(result.candidates.map(c => c.equipmentId), ['l2']);
  assert.ok(progress.every((percent, index) => index === 0 || percent >= progress[index - 1]));
  assert.equal(progress.at(-1), 100);
});

test('N-1 impact output keeps only the deterministic top ten', () => {
  const base = network(), parallels = Array.from({ length: 12 }, (_, i) => ({ ...base.lines[0], id: `parallel-${i + 1}`, name: `parallel-${i + 1}`, sourceId: `parallel-${i + 1}` }));
  const result = runN1Screen({ ...base, lines: [...base.lines, ...parallels] } as CanonicalNetwork, emptyScenario(), { candidateTypes: ['ElmLne'] });
  const impacts = result.candidates.find(c => c.equipmentId === 'l1')!.topImpacts;
  assert.equal(impacts.length, 10);
  assert.equal(new Set(impacts.map(impact => impact.equipmentId)).size, 10);
  for (let i = 1; i < impacts.length; i++) {
    const prior = impacts[i - 1], current = impacts[i];
    assert.ok((prior.estimatedLoadingPct ?? -1) > (current.estimatedLoadingPct ?? -1) || ((prior.estimatedLoadingPct ?? -1) === (current.estimatedLoadingPct ?? -1) && (Math.abs(prior.deltaPMw) > Math.abs(current.deltaPMw) || (Math.abs(prior.deltaPMw) === Math.abs(current.deltaPMw) && prior.equipmentId.localeCompare(current.equipmentId) <= 0))));
  }
});

test('N-1 result retains every rated overload while the ranked display remains capped at ten', () => {
  const base = network(), parallels = Array.from({ length: 12 }, (_, i) => ({ ...base.lines[0], id: `low-capacity-${i + 1}`, name: `low-capacity-${i + 1}`, sourceId: `low-capacity-${i + 1}`, capacity: { ...base.lines[0].capacity!, nominalMVA: 0.001 } }));
  const lines = [...base.lines.map(line => ({ ...line, capacity: { ...line.capacity!, nominalMVA: 0.001 } })), ...parallels];
  const result = runN1Screen({ ...base, lines } as CanonicalNetwork, emptyScenario(), { candidateTypes: ['ElmLne'] });
  const outage = result.candidates.find(candidate => candidate.equipmentId === 'l1')!;
  assert.equal(outage.topImpacts.length, 10);
  assert.ok(outage.violationImpacts.length > outage.topImpacts.length, JSON.stringify({ count: outage.violationImpacts.length, top: outage.topImpacts.length, max: outage.maxEstimatedLoadingPct, limits: outage.topImpacts.map(x => x.capacityMva), loadings: outage.topImpacts.map(x => x.postEstimatedLoadingPct) }));
  assert.equal(outage.violationImpacts.length, outage.estimatedOverloadCount);
  assert.ok(outage.violationImpacts.every(impact => impact.postEstimatedLoadingPct! > 100 && impact.capacityMva === 0.001));
});

test('selected bridge detail reports deterministic referenced and unreferenced components', () => {
  const base = network(), detailNetwork = { ...base, lines: base.lines.filter(line => line.id !== 'l3') } as CanonicalNetwork;
  const detail = getN1SelectedDetail(detailNetwork, emptyScenario(), 'ElmLne:l2', { candidateTypes: ['ElmLne'] })!;
  assert.equal(detail.candidate.status, 'ISLANDING');
  assert.equal(detail.outage.equipmentId, 'l2');
  assert.equal(detail.outageIslands.length, 2);
  const referenced = detail.outageIslands.find(component => component.busIds.includes('a'))!;
  const unreferenced = detail.outageIslands.find(component => component.busIds.includes('c'))!;
  assert.equal(referenced.hasReference, true);
  assert.equal(referenced.referenceCount, 1);
  assert.deepEqual(referenced.references.map(reference => reference.id), ['grid']);
  assert.equal(referenced.hasLocalGeneration, true);
  assert.equal(referenced.generationMw, 100);
  assert.equal(unreferenced.hasReference, false);
  assert.equal(unreferenced.loadMw, 100);
  assert.equal(unreferenced.generationMw, 0);
  assert.equal(unreferenced.netInjectionMw, -100);
  assert.equal(unreferenced.separatedLoadMw, 100);
  assert.equal(unreferenced.separatedGenerationMw, 0);
  assert.equal(unreferenced.topologicallySeparatedLoadMw, 100);
  assert.deepEqual(unreferenced.branchIds, []);
  assert.ok(detail.outageIslands.every(component => component.componentId.startsWith('n1:ElmLne:l2:')));
  const referencedBranch = detail.branchImpacts.find(impact => impact.equipmentId === 'l1')!;
  assert.ok(referencedBranch.postFlowMw != null && Math.abs(Math.abs(referencedBranch.postFlowMw) - 100) < 0.01);
  assert.equal(referencedBranch.islandId, referenced.componentId);
});

test('generator-only components stay unreferenced while preserving separated generation', () => {
  const base = network(), generatorOnly = { ...base, lines: base.lines.filter(line => line.id !== 'l3'), externalGrids: [] } as unknown as CanonicalNetwork;
  const detail = getN1SelectedDetail(generatorOnly, emptyScenario(), 'ElmLne:l2', { candidateTypes: ['ElmLne'] })!;
  const generationIsland = detail.outageIslands.find(component => component.busIds.includes('b'))!;
  const loadIsland = detail.outageIslands.find(component => component.busIds.includes('c'))!;
  assert.equal(generationIsland.status, 'UNREFERENCED');
  assert.equal(generationIsland.hasReference, false);
  assert.equal(generationIsland.hasGridReference, false);
  assert.deepEqual(generationIsland.references, []);
  assert.equal(generationIsland.referenceCount, 0);
  assert.equal(generationIsland.hasLocalGeneration, true);
  assert.equal(generationIsland.generatorCount, 1);
  assert.equal(generationIsland.generationMw, 100);
  assert.equal(generationIsland.separatedGenerationMw, 100);
  assert.equal(generationIsland.topologicallySeparatedGenerationMw, 100);
  assert.equal(loadIsland.status, 'UNREFERENCED');
  assert.equal(loadIsland.separatedLoadMw, 100);
});

test('selected detail includes all surviving branch flows and capacity metrics', () => {
  const base = network(), scenario = emptyScenario(), options = { candidateTypes: ['ElmLne'] as const };
  const detail = getN1SelectedDetail(base, scenario, 'ElmLne:l1', options)!;
  const screenCandidate = runN1Screen(base, scenario, { ...options, selectedCandidateIds: ['ElmLne:l1'] }).candidates[0];
  assert.deepEqual(detail.branchImpacts.map(impact => impact.equipmentId), ['l2', 'l3']);
  assert.ok(detail.branchImpacts.every(impact => impact.postFlowMw != null && impact.deltaPMw != null && impact.capacityMva === 100));
  assert.ok(detail.branchImpacts.every(impact => detail.outageIslands.some(component => component.componentId === impact.islandId && component.branchIds.includes(impact.equipmentId))));
  for (const branch of detail.branchImpacts) {
    const screened = screenCandidate.topImpacts.find(impact => impact.equipmentId === branch.equipmentId)!;
    assert.ok(Math.abs(branch.postFlowMw! - screened.postFlowMw) < 1e-8);
    assert.ok(Math.abs(branch.deltaPMw! - screened.deltaPMw) < 1e-8);
  }
});

test('selected detail includes unaffected referenced reduced islands with unchanged flows', () => {
  const base = network(), extraBuses = ['d', 'e', 'f'].map(id => ({ ...base.buses[0], id, name: id, sourceId: id, parentId: id }));
  const extraLines = [['d', 'e'], ['e', 'f'], ['d', 'f']].map(([from, to], index) => ({ ...base.lines[0], id: `remote-${index + 1}`, name: `remote-${index + 1}`, sourceId: `remote-${index + 1}`, from, to }));
  const generator = { ...base.generators[0], id: 'g2', name: 'g2', sourceId: 'g2', bus: 'd', pMw: 20 };
  const load = { ...base.loads[0], id: 'load2', name: 'load2', sourceId: 'load2', bus: 'f', pMw: 20 };
  const grid = { ...base.externalGrids[0], id: 'grid2', name: 'grid2', sourceId: 'grid2', bus: 'e' };
  const networkWithRemoteIsland = { ...base, buses: [...base.buses, ...extraBuses], lines: [...base.lines, ...extraLines], generators: [...base.generators, generator], loads: [...base.loads, load], externalGrids: [...base.externalGrids, grid] } as CanonicalNetwork;
  const detail = getN1SelectedDetail(networkWithRemoteIsland, emptyScenario(), 'ElmLne:l1', { candidateTypes: ['ElmLne'] })!;
  assert.equal(detail.outageIslands.length, 2);
  const remoteIsland = detail.outageIslands.find(component => component.busIds.includes('d'))!;
  assert.equal(remoteIsland.hasReference, true);
  assert.equal(remoteIsland.referenceCount, 1);
  assert.deepEqual(remoteIsland.references.map(reference => reference.id), ['grid2']);
  assert.deepEqual(remoteIsland.branchIds, ['remote-1', 'remote-2', 'remote-3']);
  const remoteFlows = detail.branchImpacts.filter(impact => impact.equipmentId.startsWith('remote-'));
  assert.equal(remoteFlows.length, 3);
  assert.ok(remoteFlows.every(impact => impact.postFlowMw === impact.baseFlowMw && impact.deltaPMw === 0));
  assert.ok(remoteFlows.every(impact => impact.islandId === remoteIsland.componentId));
});

test('default N-1 selection includes screenable and islanding candidates but excludes unsupported ones', () => {
  const base = { candidateId: 'ElmLne:x', equipmentId: 'x', sourceClass: 'ElmLne', name: 'x', vnKv: 110, from: 'a', to: 'b', siteIds: [], fromSiteIds: [], toSiteIds: [], fromYtmIds: [], toYtmIds: [], representedInReducedModel: true, screenable: true, topology: 'NON_ISLANDING', ratingAvailable: true, exclusionReason: null };
  const candidates = [
    { ...base, candidateId: 'ElmLne:z', topology: 'UNSUPPORTED', screenable: false },
    { ...base, candidateId: 'ElmLne:b', topology: 'ISLANDING', screenable: false },
    { ...base, candidateId: 'ElmLne:a' },
  ] as unknown as N1CatalogCandidate[];
  assert.deepEqual(defaultN1CandidateIds(candidates), ['ElmLne:a', 'ElmLne:b']);
});
