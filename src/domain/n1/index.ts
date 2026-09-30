import type { CanonicalNetwork } from '../model/network';
import type { CapacitySeason } from '../model/capacity';
import { capacityLimit } from '../model/capacity';
import { effectiveNetwork, type ScenarioOverlay, scenarioSignature } from '../scenario/overlay';
import { stableJson } from '../calculation/identity';
import { APP_VERSION } from '../../version';
import { prepareReduced, type ReducedEdge, type ReducedIsland, type ReducedNetwork } from '../../analysis/fast-ac/reduced-model';
import { KluSparseDirectFactorization } from '../../analysis/power-flow/js/sparse-direct';
import type { SparseMatrix } from '../../analysis/power-flow/js/types';
import { buildTopology, UnionFind } from '../../topology/electrical-topology';

export type N1SourceClass = 'ElmLne' | 'ElmTr2';
export type N1Topology = 'NON_ISLANDING' | 'ISLANDING' | 'UNSUPPORTED';
export type N1CandidateStatus = 'ISLANDING' | 'UNSCREENABLE' | 'SCREENED_VIOLATION' | 'SCREENED_NO_VIOLATION' | 'CAPACITY_UNAVAILABLE';
export type N1ProgressStage = 'N1_TOPOLOGY' | 'N1_FACTOR' | 'N1_SCREEN' | 'N1_RESULT';
export interface N1ScreenOptions {
  candidateTypes?: readonly N1SourceClass[];
  minVoltageKv?: number;
  maxVoltageKv?: number;
  capacitySeason?: CapacitySeason;
  selectedCandidateIds?: readonly string[];
  analysisScope?: 'base' | 'scenario';
}
export interface N1Candidate {
  candidateId: string; equipmentId: string; sourceClass: N1SourceClass; name: string; vnKv: number;
  from: string; to: string; siteIds: readonly string[]; screenable: boolean; ratingAvailable: boolean;
  representedInReducedModel: boolean; exclusionReason: string | null; topology: N1Topology;
}
export interface N1Impact {
  equipmentId: string; sourceClass: string; from: string; to: string;
  baseFlowMw: number; postFlowMw: number; deltaPMw: number;
  capacityMva: number | null; baseEstimatedLoadingPct: number | null; postEstimatedLoadingPct: number | null;
  /** Kept as a display-compatible alias for postEstimatedLoadingPct. */
  estimatedLoadingPct: number | null;
}
export interface N1Reference { id: string; name: string; sourceClass: string }
export interface N1IslandComponent {
  componentId: string; islandId: string; status: 'REFERENCED' | 'UNREFERENCED'; busIds: readonly string[]; branchIds: readonly string[]; siteIds: readonly string[];
  references: readonly N1Reference[]; referenceCount: number; loadMw: number; generationMw: number; generatorCount: number; netInjectionMw: number;
  hasReference: boolean; hasGridReference: boolean; hasLocalGeneration: boolean;
  separatedLoadMw: number | null; separatedGenerationMw: number | null;
  topologicallySeparatedLoadMw: number | null; topologicallySeparatedGenerationMw: number | null;
}
export interface N1DetailBranchImpact extends Omit<N1Impact, 'postFlowMw' | 'deltaPMw' | 'postEstimatedLoadingPct' | 'estimatedLoadingPct'> {
  postFlowMw: number | null; deltaPMw: number | null; postEstimatedLoadingPct: number | null; estimatedLoadingPct: number | null;
  name: string; siteIds: readonly string[]; islandId: string;
}
export interface N1SelectedDetail {
  candidateId: string; candidate: N1ScreenCandidate;
  outage: { equipmentId: string; sourceClass: N1SourceClass }; outageEquipment: { equipmentId: string; sourceClass: N1SourceClass };
  branchImpacts: readonly N1DetailBranchImpact[]; outageIslands: readonly N1IslandComponent[]; elapsedMs: number;
}
export interface N1ScreenCandidate extends N1Candidate {
  status: N1CandidateStatus; islanding: boolean; baseFlowMw: number | null;
  outageRatingAvailable: boolean;
  maxEstimatedLoadingPct: number | null; estimatedOverloadCount: number; maxDeltaPMw: number | null;
  ratingCoverage: { evaluated: boolean; ratedBranches: number; totalBranches: number; percent: number | null };
  topImpacts: readonly N1Impact[]; violationImpacts: readonly N1Impact[];
}
export interface N1ScreenResult {
  identity: { modelHash: string; scenarioHash: string; optionsHash: string; engineVersion: string };
  scope: 'REDUCED_GE66_DC_P_ONLY'; candidateTypes: readonly N1SourceClass[]; voltageBands: { minKv: number; maxKv: number | null };
  capacitySeason: CapacitySeason; analysisScope: 'base' | 'scenario'; baseDcStatus: string; elapsedMs: number;
  candidateCount: number; screenedCount: number; islandingCount: number; unratedCount: number; unsupportedCount: number;
  candidates: readonly N1ScreenCandidate[]; remarks: readonly string[];
  dcDiagnostics: { factorizationCount: number; rhsCount: number; maxTrueResidual: number | null; matrices: readonly { dimension: number; nnz: number }[] };
}
export interface N1Progress { stage: N1ProgressStage; completed: number; total: number; percent: number; elapsedMs: number; screenedSoFar: number; violationCountSoFar: number; islandingCount: number; unsupportedCount: number }
export interface N1Callbacks { signal?: AbortSignal; onProgress?: (progress: N1Progress) => void }

const CANCELLED = 'N1_SCREEN_CANCELLED';
const BATCH_SIZE = 64;
const IMPACT_LIMIT = 10;
const optionsOf = (o: N1ScreenOptions = {}) => ({ candidateTypes: [...(o.candidateTypes ?? ['ElmLne', 'ElmTr2'])].sort(), minVoltageKv: o.minVoltageKv ?? 66, maxVoltageKv: o.maxVoltageKv ?? null, capacitySeason: o.capacitySeason ?? 'nominal', selectedCandidateIds: o.selectedCandidateIds == null ? null : [...new Set(o.selectedCandidateIds)].sort(), analysisScope: o.analysisScope ?? null });
export function n1OptionsIdentity(network: CanonicalNetwork, scenario: ScenarioOverlay, options: N1ScreenOptions = {}) {
  return { modelHash: network.modelHash, scenarioHash: scenarioSignature(scenario), optionsHash: stableJson(optionsOf(options)), engineVersion: APP_VERSION };
}

function checkCancelled(callbacks?: N1Callbacks): void { if (callbacks?.signal?.aborted) throw new Error(CANCELLED); }
function progress(callbacks: N1Callbacks | undefined, stage: N1ProgressStage, completed: number, total: number, started: number, counts: { screened: number; violations: number; islanding: number; unsupported: number }, floorPercent: number): number {
  const fraction = total ? Math.max(0, Math.min(1, completed / total)) : 1;
  const percent = Math.max(floorPercent, stage === 'N1_TOPOLOGY' ? 15 : stage === 'N1_FACTOR' ? Math.round(15 + 9 * fraction) : stage === 'N1_SCREEN' ? Math.round(25 + 70 * fraction) : 100);
  callbacks?.onProgress?.({ stage, completed, total, percent, elapsedMs: performance.now() - started, screenedSoFar: counts.screened, violationCountSoFar: counts.violations, islandingCount: counts.islanding, unsupportedCount: counts.unsupported });
  return percent;
}
function ratingAvailable(network: CanonicalNetwork, lineById: Map<string, CanonicalNetwork['lines'][number]>, transformerById: Map<string, CanonicalNetwork['transformers'][number]>, sourceClass: N1SourceClass, id: string, vnKv: number, season: CapacitySeason): boolean {
  if (sourceClass === 'ElmTr2') return (transformerById.get(id)?.ratingMva ?? 0) > 0;
  const line = lineById.get(id);
  return !!line?.capacity && capacityLimit(line.capacity, vnKv, season) != null;
}
export function generateN1Candidates(network: CanonicalNetwork, scenario: ScenarioOverlay, options: N1ScreenOptions = {}, reduced = prepareReduced(effectiveNetwork(network, scenario))): N1Candidate[] {
  return generateN1CandidatesFromEffective(effectiveNetwork(network, scenario), options, reduced);
}
function generateN1CandidatesFromEffective(active: CanonicalNetwork, options: N1ScreenOptions, reduced: ReducedNetwork): N1Candidate[] {
  const opts = optionsOf(options), represented = new Set(reduced.islands.flatMap(i => i.edges.map(e => e.id)));
  const lineById = new Map(active.lines.map(e => [e.id, e])), transformerById = new Map(active.transformers.map(e => [e.id, e]));
  const candidates: N1Candidate[] = [];
  const add = (e: CanonicalNetwork['lines'][number] | CanonicalNetwork['transformers'][number], cls: N1SourceClass, vnKv: number) => {
    if (!e.inService || !opts.candidateTypes.includes(cls) || !(Number.isFinite(vnKv) && vnKv >= opts.minVoltageKv && (opts.maxVoltageKv == null || vnKv <= opts.maxVoltageKv))) return;
    const isRepresented = represented.has(e.id), reason = !isRepresented ? 'Equipment is not represented by an in-service >=66 kV reduced branch.' : null;
    candidates.push({ candidateId: `${cls}:${e.id}`, equipmentId: e.id, sourceClass: cls, name: e.name, vnKv, from: e.from, to: e.to, siteIds: e.siteIds, screenable: isRepresented, ratingAvailable: ratingAvailable(active, lineById, transformerById, cls, e.id, vnKv, opts.capacitySeason), representedInReducedModel: isRepresented, exclusionReason: reason, topology: isRepresented ? 'NON_ISLANDING' : 'UNSUPPORTED' });
  };
  active.lines.forEach(e => add(e, 'ElmLne', e.fastParameters?.vnKv ?? e.vnKv));
  active.transformers.forEach(e => add(e, 'ElmTr2', Math.max(e.vnKv, e.lvKv)));
  return candidates.sort((a, b) => a.candidateId.localeCompare(b.candidateId));
}

/** Tarjan bridges are computed per multigraph. Parent edge IDs, not parent vertices, preserve parallel branches. */
export function classifyN1Topology(reduced: ReducedNetwork, candidates: readonly N1Candidate[]): N1Candidate[] {
  const bridges = new Set<string>(), edgeById = new Map<string, ReducedEdge>();
  for (const island of reduced.islands) {
    const adj: { to: number; edge: ReducedEdge }[][] = island.busIds.map(() => []);
    for (const e of island.edges) { edgeById.set(e.id, e); adj[e.a].push({ to: e.b, edge: e }); adj[e.b].push({ to: e.a, edge: e }); }
    const tin = new Int32Array(adj.length).fill(-1), low = new Int32Array(adj.length); let timer = 0;
    const visit = (v: number, parentEdge: string | null) => {
      tin[v] = low[v] = timer++;
      for (const item of adj[v]) {
        if (item.edge.id === parentEdge) continue;
        if (tin[item.to] !== -1) low[v] = Math.min(low[v], tin[item.to]);
        else { visit(item.to, item.edge.id); low[v] = Math.min(low[v], low[item.to]); if (low[item.to] > tin[v]) bridges.add(item.edge.id); }
      }
    };
    for (let v = 0; v < adj.length; v++) if (tin[v] === -1) visit(v, null);
  }
  return candidates.map(c => {
    const edge = edgeById.get(c.equipmentId);
    const topology: N1Topology = !c.representedInReducedModel || !edge ? 'UNSUPPORTED' : bridges.has(edge.id) ? 'ISLANDING' : 'NON_ISLANDING';
    return { ...c, topology, screenable: topology === 'NON_ISLANDING', exclusionReason: topology === 'ISLANDING' ? 'Outage disconnects a reduced-network island.' : topology === 'UNSUPPORTED' ? c.exclusionReason ?? 'Candidate branch is absent from the reduced network.' : null };
  });
}

function matrixFor(island: ReducedIsland, slack: number): { matrix: SparseMatrix; nodeMap: number[] } {
  const nodeMap = island.busIds.map((_, i) => i).filter(i => i !== slack), local = new Map(nodeMap.map((v, i) => [v, i]));
  const rows = nodeMap.map(() => new Map<number, number>());
  for (const e of island.edges) {
    const b = 1 / e.x, a = local.get(e.a), z = local.get(e.b);
    if (a != null) rows[a].set(a, (rows[a].get(a) ?? 0) + b);
    if (z != null) rows[z].set(z, (rows[z].get(z) ?? 0) + b);
    if (a != null && z != null) { rows[a].set(z, (rows[a].get(z) ?? 0) - b); rows[z].set(a, (rows[z].get(a) ?? 0) - b); }
  }
  const rowPtr = new Int32Array(rows.length + 1), colIdx: number[] = [], values: number[] = [], pos = rows.map(() => new Map<number, number>()), diagPos = new Int32Array(rows.length);
  rows.forEach((row, r) => { for (const [c, val] of [...row].sort(([a], [b]) => a - b)) { pos[r].set(c, values.length); if (c === r) diagPos[r] = values.length; colIdx.push(c); values.push(val); } rowPtr[r + 1] = values.length; });
  return { matrix: { N: rows.length, rowPtr, colIdx: Int32Array.from(colIdx), values: Float64Array.from(values), pos, diagPos }, nodeMap };
}
function emptyMetrics(candidate: N1Candidate, status: N1CandidateStatus, _branches = 0): N1ScreenCandidate {
  return { ...candidate, outageRatingAvailable: candidate.ratingAvailable, status, islanding: candidate.topology === 'ISLANDING', baseFlowMw: null, maxEstimatedLoadingPct: null, estimatedOverloadCount: 0, maxDeltaPMw: null, ratingCoverage: { evaluated: false, ratedBranches: 0, totalBranches: 0, percent: null }, topImpacts: [], violationImpacts: [] };
}

function compareImpactValues(pct: number | null, delta: number, equipmentId: string, b: N1Impact): number {
  return (b.estimatedLoadingPct ?? -1) - (pct ?? -1) || Math.abs(b.deltaPMw) - Math.abs(delta) || equipmentId.localeCompare(b.equipmentId);
}

function terminalToReducedBus(network: CanonicalNetwork, topology = buildTopology(network)): (terminalId: string) => string | null {
  const high = new Set<number>(), low = new Set<number>();
  topology.buses.forEach((bus, index) => (bus.vnKv >= 66 ? high : low).add(index));
  const transformerRows = network.transformers.filter(t => t.inService && !topology.blockedEquipment.has(t.id)).map(t => ({ t, a: topology.terminalToBus.get(t.from), b: topology.terminalToBus.get(t.to) })).filter((x): x is typeof x & { a: number; b: number } => x.a != null && x.b != null);
  const lowUf = new UnionFind([...low].map(String));
  for (const { a, b } of transformerRows) if (low.has(a) && low.has(b)) lowUf.union(String(a), String(b));
  const boundaries = new Map<string, Set<number>>();
  const addBoundary = (l: number, h: number) => { const key = lowUf.find(String(l)); if (key == null) return; if (!boundaries.has(key)) boundaries.set(key, new Set()); boundaries.get(key)!.add(h); };
  for (const { a, b } of transformerRows) { if (low.has(a) && high.has(b)) addBoundary(a, b); if (low.has(b) && high.has(a)) addBoundary(b, a); }
  return terminalId => {
    const index = topology.terminalToBus.get(terminalId);
    if (index == null) return null;
    if (high.has(index)) return topology.buses[index].id;
    const targets = boundaries.get(lowUf.find(String(index)) ?? '')
    return targets?.size === 1 ? topology.buses[[...targets][0]].id : null;
  };
}

interface OutageComponentData { component: N1IslandComponent; busIndexes: number[]; edges: ReducedEdge[]; slack: number | null }
function componentIdentity(candidateId: string, busIds: readonly string[]): string {
  const source = `${candidateId}\u0000${busIds.join('\u0000')}`;
  let hash = 2166136261;
  for (let i = 0; i < source.length; i++) { hash ^= source.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return `n1:${candidateId}:${(hash >>> 0).toString(36)}`;
}
function outageComponents(active: CanonicalNetwork, reduced: ReducedNetwork, island: ReducedIsland, outageId: string | null, candidateId: string, route = terminalToReducedBus(active), blockedEquipment = buildTopology(active).blockedEquipment): OutageComponentData[] {
  const adjacency = island.busIds.map(() => [] as number[]);
  for (const e of island.edges) if (e.id !== outageId) { adjacency[e.a].push(e.b); adjacency[e.b].push(e.a); }
  const groups: number[][] = [], seen = new Uint8Array(island.busIds.length);
  for (let start = 0; start < seen.length; start++) {
    if (seen[start]) continue;
    const stack = [start], group: number[] = []; seen[start] = 1;
    while (stack.length) { const bus = stack.pop()!; group.push(bus); for (const next of adjacency[bus]) if (!seen[next]) { seen[next] = 1; stack.push(next); } }
    groups.push(group.sort((a, b) => island.busIds[a].localeCompare(island.busIds[b])));
  }
  const groupByBus = new Map<string, number>();
  groups.forEach((group, index) => group.forEach(bus => groupByBus.set(island.busIds[bus], index)));
  const loadByGroup = groups.map(() => 0), generationByGroup = groups.map(() => 0), generatorCountByGroup = groups.map(() => 0), refsByGroup = groups.map(() => [] as N1Reference[]), slackReferenceIdByGroup = groups.map(() => new Map<string, string>());
  const enabled = (item: { id: string; inService: boolean }) => item.inService && !blockedEquipment.has(item.id);
  for (const item of active.loads) if (enabled(item)) { const bus = route(item.bus), group = bus == null ? undefined : groupByBus.get(bus); if (group != null) loadByGroup[group] += item.pMw; }
  for (const item of active.generators) if (enabled(item)) {
    const bus = route(item.bus), group = bus == null ? undefined : groupByBus.get(bus);
    if (group != null) { generationByGroup[group] += item.pMw; generatorCountByGroup[group]++; }
  }
  for (const item of active.externalGrids) if (enabled(item)) {
    const bus = route(item.bus), group = bus == null ? undefined : groupByBus.get(bus);
    if (group != null) { refsByGroup[group].push({ id: item.id, name: item.name, sourceClass: item.sourceClass }); const prior = slackReferenceIdByGroup[group].get(bus!); if (!prior || item.id.localeCompare(prior) < 0) slackReferenceIdByGroup[group].set(bus!, item.id); }
  }
  return groups.map((busIndexes, groupIndex) => {
    const busIds = busIndexes.map(i => island.busIds[i]).sort((a, b) => a.localeCompare(b)), busSet = new Set(busIndexes);
    const edges = island.edges.filter(e => e.id !== outageId && busSet.has(e.a) && busSet.has(e.b));
    const branchIds = edges.map(e => e.id).sort((a, b) => a.localeCompare(b));
    const siteIds = [...new Set(busIds.flatMap(id => reduced.buses.get(id)?.siteIds ?? []))].sort((a, b) => a.localeCompare(b));
    const references = refsByGroup[groupIndex].sort((a, b) => a.sourceClass.localeCompare(b.sourceClass) || a.id.localeCompare(b.id));
    const hasReference = references.length > 0, hasLocalGeneration = generatorCountByGroup[groupIndex] > 0, componentId = componentIdentity(candidateId, busIds), componentStatus: N1IslandComponent['status'] = hasReference ? 'REFERENCED' : 'UNREFERENCED';
    const netInjectionMw = busIndexes.reduce((sum, index) => sum + (island.injections[index]?.[0] ?? 0), 0);
    const rank = slackReferenceIdByGroup[groupIndex], slackBusId = [...rank].sort((a, b) => a[1].localeCompare(b[1]) || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
    const localSlack = slackBusId == null ? null : busIndexes.find(index => island.busIds[index] === slackBusId) ?? null;
    return {
      component: { componentId, islandId: componentId, status: componentStatus, busIds, branchIds, siteIds, references, referenceCount: references.length, loadMw: loadByGroup[groupIndex], generationMw: generationByGroup[groupIndex], generatorCount: generatorCountByGroup[groupIndex], netInjectionMw, hasReference, hasGridReference: hasReference, hasLocalGeneration, separatedLoadMw: hasReference ? null : loadByGroup[groupIndex], separatedGenerationMw: hasReference ? null : generationByGroup[groupIndex], topologicallySeparatedLoadMw: hasReference ? null : loadByGroup[groupIndex], topologicallySeparatedGenerationMw: hasReference ? null : generationByGroup[groupIndex] },
      busIndexes, edges, slack: localSlack,
    };
  }).sort((a, b) => a.component.busIds[0]?.localeCompare(b.component.busIds[0] ?? '') ?? 0);
}

function detailCapacityLimit(edge: ReducedEdge, season: CapacitySeason, lineById: ReadonlyMap<string, CanonicalNetwork['lines'][number]>, transformerById: ReadonlyMap<string, CanonicalNetwork['transformers'][number]>): number | null {
  if (edge.cls === 'ElmLne') { const line = lineById.get(edge.id); return line?.capacity ? capacityLimit(line.capacity, line.fastParameters?.vnKv ?? line.vnKv, season)?.mva ?? null : null; }
  const transformer = transformerById.get(edge.id); return transformer && transformer.ratingMva > 0 ? transformer.ratingMva : null;
}

function detailBranchMetadata(edge: ReducedEdge, lineById: ReadonlyMap<string, CanonicalNetwork['lines'][number]>, transformerById: ReadonlyMap<string, CanonicalNetwork['transformers'][number]>): { name: string; siteIds: readonly string[] } {
  const item = edge.cls === 'ElmLne' ? lineById.get(edge.id) : transformerById.get(edge.id);
  return { name: item?.name ?? edge.id, siteIds: item?.siteIds ?? [] };
}

export function runN1Screen(network: CanonicalNetwork, scenario: ScenarioOverlay, options: N1ScreenOptions = {}, callbacks?: N1Callbacks): N1ScreenResult {
  const started = performance.now(), opts = optionsOf(options), effective = effectiveNetwork(network, scenario), reduced = prepareReduced(effective), identity = n1OptionsIdentity(network, scenario, options);
  checkCancelled(callbacks);
  const generated = generateN1CandidatesFromEffective(effective, options, reduced), selected = opts.selectedCandidateIds == null ? null : new Set(opts.selectedCandidateIds), scoped = selected == null ? generated : generated.filter(c => selected.has(c.candidateId)), classified = classifyN1Topology(reduced, scoped);
  const counts = { screened: 0, violations: 0, islanding: 0, unsupported: 0 };
  let lastProgressPercent = 0;
  const emitProgress = (stage: N1ProgressStage, completed: number, total: number) => { lastProgressPercent = progress(callbacks, stage, completed, total, started, counts, lastProgressPercent); };
  emitProgress('N1_TOPOLOGY', classified.length, classified.length);
  const resultMap = new Map<string, N1ScreenCandidate>(), candidateEdge = new Map<string, ReducedEdge>();
  const edgeMap = new Map(reduced.islands.flatMap(i => i.edges.map(e => [e.id, e] as const)));
  const candidateById = new Map(classified.map(c => [c.candidateId, c] as const));
  const lineById = new Map(effective.lines.map(e => [e.id, e])), transformerById = new Map(effective.transformers.map(e => [e.id, e]));
  const capacityLimitByEdge = new Map<string, number | null>();
  for (const [id, edge] of edgeMap) {
    const limit = edge.cls === 'ElmLne' ? (() => { const line = lineById.get(id); return line?.capacity ? capacityLimit(line.capacity, line.fastParameters?.vnKv ?? line.vnKv, opts.capacitySeason)?.mva ?? null : null; })() : (transformerById.get(id)?.ratingMva ?? 0) > 0 ? transformerById.get(id)!.ratingMva : null;
    capacityLimitByEdge.set(id, limit);
  }
  const branchCount = reduced.islands.reduce((n, i) => n + i.edges.length, 0);
  for (const c of classified) {
    if (c.topology === 'ISLANDING') { resultMap.set(c.candidateId, emptyMetrics(c, 'ISLANDING', branchCount)); counts.islanding++; }
    else if (c.topology === 'UNSUPPORTED') { resultMap.set(c.candidateId, emptyMetrics(c, 'UNSCREENABLE', branchCount)); counts.unsupported++; }
    else candidateEdge.set(c.candidateId, edgeMap.get(c.equipmentId)!);
  }
  const byEdge = new Map<string, string>(); for (const [id, e] of candidateEdge) byEdge.set(e.id, id);
  let factorCount = 0, rhsCount = 0, maxTrueResidual: number | null = null, factorCompleted = 0, baseDcOk = reduced.islands.length > 0;
  let screenCompleted = 0;
  const matrices: { dimension: number; nnz: number }[] = [], factorTotal = reduced.islands.filter(i => i.edges.length && i.busIds.length > 1).length;
  emitProgress('N1_FACTOR', 0, factorTotal);
  for (const island of reduced.islands) {
    checkCancelled(callbacks);
    if (!island.edges.length || island.busIds.length < 2) continue;
    const slack = island.slack, built = matrixFor(island, slack), n = island.busIds.length, base = new Float64Array(n); for (let i = 0; i < n; i++) base[i] = island.injections[i][0] / island.baseMVA;
    matrices.push({ dimension: built.matrix.N, nnz: built.matrix.values.length });
    const baseRhs = Float64Array.from(built.nodeMap, i => base[i]);
    const factor = new KluSparseDirectFactorization(); let baseAngles = new Float64Array(n);
    try {
      factor.factorize(built.matrix); factorCount++;
      const baseSolution = factor.solve(baseRhs);
      if (baseSolution.trueResidual != null) maxTrueResidual = Math.max(maxTrueResidual ?? 0, baseSolution.trueResidual);
      if (!baseSolution.success || !baseSolution.x) { baseDcOk = false; for (const e of island.edges) { const id = byEdge.get(e.id); if (id) { resultMap.set(id, emptyMetrics(candidateById.get(id)!, 'UNSCREENABLE', branchCount)); counts.unsupported++; } } continue; }
      built.nodeMap.forEach((bus, i) => baseAngles[bus] = baseSolution.x![i]);
      const flows = island.edges.map(e => ({ e, flow: (baseAngles[e.a] - baseAngles[e.b]) / e.x * island.baseMVA }));
      const pending = island.edges.map(e => ({ e, id: byEdge.get(e.id) })).filter((row): row is { e: ReducedEdge; id: string } => !!row.id);
      const localIndex = new Int32Array(n).fill(-1); built.nodeMap.forEach((bus, i) => { localIndex[bus] = i; });
      const flowIndexById = new Map(flows.map((row, i) => [row.e.id, i] as const));
      for (let offset = 0; offset < pending.length; offset += BATCH_SIZE) {
        checkCancelled(callbacks);
        const batch = pending.slice(offset, offset + BATCH_SIZE), rhsList = batch.map(({ e }) => {
          const rhs = new Float64Array(built.matrix.N), a = localIndex[e.a], b = localIndex[e.b], perUnit = 1 / island.baseMVA;
          if (a >= 0) rhs[a] += perUnit; if (b >= 0) rhs[b] -= perUnit; return rhs;
        });
        const solved = factor.solveMany(rhsList); rhsCount += solved.length;
        for (let ix = 0; ix < batch.length; ix++) {
          const { e, id } = batch[ix], candidate = candidateById.get(id)!; const solution = solved[ix];
          if (solution.trueResidual != null) maxTrueResidual = Math.max(maxTrueResidual ?? 0, solution.trueResidual);
          if (!solution.success || !solution.x) { resultMap.set(id, emptyMetrics(candidate, 'UNSCREENABLE', flows.length)); counts.unsupported++; continue; }
          const theta = new Float64Array(n); built.nodeMap.forEach((bus, i) => theta[bus] = solution.x![i]);
          // RHS is a 1 MW transfer in per-unit coordinates; convert solved branch flow back to MW.
          const ptdf = new Float64Array(flows.length);
          for (let k = 0; k < flows.length; k++) { const row = flows[k]; ptdf[k] = (theta[row.e.a] - theta[row.e.b]) / row.e.x * island.baseMVA; }
          const cIndex = flowIndexById.get(e.id)!, denominator = 1 - ptdf[cIndex];
          if (!(Math.abs(denominator) > 1e-8)) { resultMap.set(id, emptyMetrics(candidate, 'UNSCREENABLE', flows.length)); counts.unsupported++; continue; }
          const outageFlow = flows[cIndex].flow, impacts: N1Impact[] = [], violationImpacts: N1Impact[] = []; let maxLoading: number | null = null, overloads = 0, rated = 0, maxDelta = 0;
          for (let k = 0; k < flows.length; k++) {
            if (k === cIndex) continue;
            const flow = flows[k], delta = ptdf[k] / denominator * outageFlow, post = flow.flow + delta;
            const limit = capacityLimitByEdge.get(flow.e.id) ?? null;
            const pct = limit != null && limit > 0 ? Math.abs(post) / limit * 100 : null;
            const basePct = limit != null && limit > 0 ? Math.abs(flow.flow) / limit * 100 : null;
            if (pct != null) { rated++; maxLoading = Math.max(maxLoading ?? 0, pct); if (pct > 100) overloads++; }
            maxDelta = Math.max(maxDelta, Math.abs(delta));
          if (impacts.length < IMPACT_LIMIT || compareImpactValues(pct, delta, flow.e.id, impacts[impacts.length - 1]) < 0) {
              const impact: N1Impact = { equipmentId: flow.e.id, sourceClass: flow.e.cls, from: island.busIds[flow.e.a], to: island.busIds[flow.e.b], baseFlowMw: flow.flow, postFlowMw: post, deltaPMw: delta, capacityMva: limit, baseEstimatedLoadingPct: basePct, postEstimatedLoadingPct: pct, estimatedLoadingPct: pct };
              let at = 0; while (at < impacts.length && compareImpactValues(impact.estimatedLoadingPct, impact.deltaPMw, impact.equipmentId, impacts[at]) >= 0) at++;
              impacts.splice(at, 0, impact); if (impacts.length > IMPACT_LIMIT) impacts.pop();
            }
            if (pct != null && pct > 100) {
              const impact: N1Impact = { equipmentId: flow.e.id, sourceClass: flow.e.cls, from: island.busIds[flow.e.a], to: island.busIds[flow.e.b], baseFlowMw: flow.flow, postFlowMw: post, deltaPMw: delta, capacityMva: limit, baseEstimatedLoadingPct: basePct, postEstimatedLoadingPct: pct, estimatedLoadingPct: pct };
              let at = 0; while (at < violationImpacts.length && compareImpactValues(impact.estimatedLoadingPct, impact.deltaPMw, impact.equipmentId, violationImpacts[at]) >= 0) at++;
              violationImpacts.splice(at, 0, impact);
            }
          }
          const totalMonitored = Math.max(0, flows.length - 1), coverage = { evaluated: true, ratedBranches: rated, totalBranches: totalMonitored, percent: totalMonitored ? rated / totalMonitored * 100 : 100 };
          const status: N1CandidateStatus = overloads ? 'SCREENED_VIOLATION' : rated < totalMonitored ? 'CAPACITY_UNAVAILABLE' : 'SCREENED_NO_VIOLATION';
          resultMap.set(id, { ...candidate, outageRatingAvailable: candidate.ratingAvailable, status, islanding: false, baseFlowMw: outageFlow, maxEstimatedLoadingPct: maxLoading, estimatedOverloadCount: overloads, maxDeltaPMw: maxDelta, ratingCoverage: coverage, topImpacts: impacts, violationImpacts });
          counts.screened++; if (status === 'SCREENED_VIOLATION') counts.violations++;
        }
        screenCompleted += batch.length;
        emitProgress('N1_SCREEN', screenCompleted, candidateEdge.size);
      }
    } catch (e) {
      if (e instanceof Error && e.message === CANCELLED) throw e;
      baseDcOk = false;
      for (const { id } of island.edges.map(e => ({ id: byEdge.get(e.id) })).filter((v): v is { id: string } => !!v.id)) { const c = candidateById.get(id)!; resultMap.set(id, emptyMetrics(c, 'UNSCREENABLE', island.edges.length)); counts.unsupported++; }
    } finally { factor.dispose(); }
    emitProgress('N1_FACTOR', ++factorCompleted, factorTotal);
  }
  checkCancelled(callbacks);
  const candidates = classified.map(c => resultMap.get(c.candidateId) ?? emptyMetrics(c, 'UNSCREENABLE', branchCount)).sort((a, b) => {
    const rank = (x: N1ScreenCandidate) => x.status === 'ISLANDING' ? 0 : x.status === 'SCREENED_VIOLATION' ? 1 : 2;
    return rank(a) - rank(b) || b.estimatedOverloadCount - a.estimatedOverloadCount || (b.maxEstimatedLoadingPct ?? -1) - (a.maxEstimatedLoadingPct ?? -1) || (b.maxDeltaPMw ?? -1) - (a.maxDeltaPMw ?? -1) || a.candidateId.localeCompare(b.candidateId);
  });
  const islandingCount = candidates.filter(c => c.status === 'ISLANDING').length, unsupportedCount = candidates.filter(c => c.status === 'UNSCREENABLE').length;
  const unratedCount = candidates.filter(c => c.ratingCoverage.evaluated && (!c.outageRatingAvailable || c.ratingCoverage.ratedBranches < c.ratingCoverage.totalBranches)).length;
  const screenedCount = candidates.filter(c => c.status === 'SCREENED_VIOLATION' || c.status === 'SCREENED_NO_VIOLATION' || c.status === 'CAPACITY_UNAVAILABLE').length;
  emitProgress('N1_RESULT', candidates.length, candidates.length);
  return { identity, scope: 'REDUCED_GE66_DC_P_ONLY', candidateTypes: opts.candidateTypes, voltageBands: { minKv: opts.minVoltageKv, maxKv: opts.maxVoltageKv }, capacitySeason: opts.capacitySeason, analysisScope: opts.analysisScope ?? 'scenario', baseDcStatus: baseDcOk ? 'CONVERGED_DC' : 'UNSCREENABLE', elapsedMs: performance.now() - started, candidateCount: candidates.length, screenedCount, islandingCount, unratedCount, unsupportedCount, candidates, remarks: ['P-only DC screening estimate; AC verification was not performed.', 'Losses, Q, voltage magnitude, and phase-shift effects are omitted.'], dcDiagnostics: { factorizationCount: factorCount, rhsCount, maxTrueResidual, matrices } };
}

/** Computes expanded DC results for one selected contingency without storing candidate-by-branch results. */
export function getN1SelectedDetail(network: CanonicalNetwork, scenario: ScenarioOverlay, candidateId: string, options: N1ScreenOptions = {}): N1SelectedDetail | null {
  const started = performance.now(), active = effectiveNetwork(network, scenario), opts = optionsOf(options), reduced = prepareReduced(active);
  const lineById = new Map(active.lines.map(item => [item.id, item])), transformerById = new Map(active.transformers.map(item => [item.id, item]));
  const generated = generateN1CandidatesFromEffective(active, options, reduced), generatedCandidate = generated.find(c => c.candidateId === candidateId);
  if (!generatedCandidate) return null;
  const candidate = classifyN1Topology(reduced, [generatedCandidate])[0];
  const outage = { equipmentId: candidate.equipmentId, sourceClass: candidate.sourceClass };
  const edge = reduced.islands.flatMap(i => i.edges).find(e => e.id === candidate.equipmentId);
  const island = edge ? reduced.islands.find(i => i.edges.some(e => e.id === edge.id)) : undefined;
  if (!edge || !island || candidate.topology === 'UNSUPPORTED') {
    return { candidateId, candidate: emptyMetrics(candidate, 'UNSCREENABLE'), outage, outageEquipment: outage, branchImpacts: [], outageIslands: [], elapsedMs: performance.now() - started };
  }
  const topology = buildTopology(active), route = terminalToReducedBus(active, topology), componentSets = reduced.islands.map(sourceIsland => ({
    sourceIsland,
    components: outageComponents(active, reduced, sourceIsland, sourceIsland === island ? edge.id : null, candidateId, route, topology.blockedEquipment),
  }));
  const components = componentSets.flatMap(item => item.components), targetComponents = componentSets.find(item => item.sourceIsland === island)!.components;
  const outageIslands = components.map(item => item.component), islandByBus = new Map<string, string>();
  for (const component of outageIslands) for (const busId of component.busIds) islandByBus.set(busId, component.componentId);
  const flowById = new Map<string, number>(), postFlowById = new Map<string, number>();
  let outageBaseSolved = false, outageBaseFlow: number | null = null;
  for (const set of componentSets) {
    const sourceIsland = set.sourceIsland, isOutageIsland = sourceIsland === island;
    const built = matrixFor(sourceIsland, sourceIsland.slack), n = sourceIsland.busIds.length, base = new Float64Array(n);
    for (let i = 0; i < n; i++) base[i] = sourceIsland.injections[i][0] / sourceIsland.baseMVA;
    const factor = new KluSparseDirectFactorization();
    try {
      factor.factorize(built.matrix);
      const baseRhs = Float64Array.from(built.nodeMap, i => base[i]), baseSolution = factor.solve(baseRhs);
      if (!baseSolution.success || !baseSolution.x) continue;
      const baseAngles = new Float64Array(n); built.nodeMap.forEach((bus, i) => baseAngles[bus] = baseSolution.x![i]);
      for (const branch of sourceIsland.edges) flowById.set(branch.id, (baseAngles[branch.a] - baseAngles[branch.b]) / branch.x * sourceIsland.baseMVA);
      if (!isOutageIsland) {
        for (const branch of sourceIsland.edges) postFlowById.set(branch.id, flowById.get(branch.id)!);
        continue;
      }
      outageBaseSolved = true;
      outageBaseFlow = flowById.get(edge.id) ?? null;
      if (candidate.topology === 'NON_ISLANDING' && outageBaseFlow != null) {
        const localIndex = new Int32Array(n).fill(-1); built.nodeMap.forEach((bus, i) => { localIndex[bus] = i; });
        const rhs = new Float64Array(built.matrix.N), a = localIndex[edge.a], b = localIndex[edge.b], perUnit = 1 / sourceIsland.baseMVA;
        if (a >= 0) rhs[a] += perUnit; if (b >= 0) rhs[b] -= perUnit;
        const solution = factor.solve(rhs);
        if (solution.success && solution.x) {
          const theta = new Float64Array(n); built.nodeMap.forEach((bus, i) => theta[bus] = solution.x![i]);
          const ptdf = new Map<string, number>();
          for (const branch of sourceIsland.edges) ptdf.set(branch.id, (theta[branch.a] - theta[branch.b]) / branch.x * sourceIsland.baseMVA);
          const denominator = 1 - (ptdf.get(edge.id) ?? 0);
          if (Math.abs(denominator) > 1e-8) for (const branch of sourceIsland.edges) if (branch.id !== edge.id) {
            const delta = (ptdf.get(branch.id) ?? 0) / denominator * outageBaseFlow;
            postFlowById.set(branch.id, (flowById.get(branch.id) ?? 0) + delta);
          }
        }
      } else if (candidate.topology === 'ISLANDING') {
        for (const item of targetComponents) {
          if (item.slack == null || !item.edges.length) continue;
          const localIndex = new Map(item.busIndexes.map((global, local) => [global, local] as const));
          const localIsland: ReducedIsland = { ...sourceIsland, busIds: item.busIndexes.map(global => sourceIsland.busIds[global]), injections: item.busIndexes.map(global => sourceIsland.injections[global]), shunts: item.busIndexes.map(global => sourceIsland.shunts[global]), edges: item.edges.map(branch => ({ ...branch, a: localIndex.get(branch.a)!, b: localIndex.get(branch.b)! })), slack: localIndex.get(item.slack)! };
          const componentMatrix = matrixFor(localIsland, localIsland.slack), componentFactor = new KluSparseDirectFactorization();
          try {
            componentFactor.factorize(componentMatrix.matrix);
            const componentBase = Float64Array.from(componentMatrix.nodeMap, i => localIsland.injections[i][0] / localIsland.baseMVA), solved = componentFactor.solve(componentBase);
            if (!solved.success || !solved.x) continue;
            const angles = new Float64Array(localIsland.busIds.length); componentMatrix.nodeMap.forEach((bus, i) => angles[bus] = solved.x![i]);
            for (const branch of localIsland.edges) postFlowById.set(branch.id, (angles[branch.a] - angles[branch.b]) / branch.x * localIsland.baseMVA);
          } finally { componentFactor.dispose(); }
        }
      }
    } catch {
      if (isOutageIsland) outageBaseSolved = false;
    } finally { factor.dispose(); }
  }

  const branchImpacts: N1DetailBranchImpact[] = [];
  for (const sourceIsland of reduced.islands) for (const branch of sourceIsland.edges) {
    if (branch.id === edge.id) continue;
    const baseFlowMw = flowById.get(branch.id);
    if (baseFlowMw == null) continue;
    const postFlowMw = postFlowById.get(branch.id) ?? null;
    const deltaPMw = postFlowMw == null ? null : postFlowMw - baseFlowMw;
    const capacityMva = detailCapacityLimit(branch, opts.capacitySeason, lineById, transformerById);
    const baseEstimatedLoadingPct = capacityMva != null && capacityMva > 0 ? Math.abs(baseFlowMw) / capacityMva * 100 : null;
    const postEstimatedLoadingPct = capacityMva != null && capacityMva > 0 && postFlowMw != null ? Math.abs(postFlowMw) / capacityMva * 100 : null;
    branchImpacts.push({ equipmentId: branch.id, sourceClass: branch.cls, from: sourceIsland.busIds[branch.a], to: sourceIsland.busIds[branch.b], baseFlowMw, postFlowMw, deltaPMw, capacityMva, baseEstimatedLoadingPct, postEstimatedLoadingPct, estimatedLoadingPct: postEstimatedLoadingPct, ...detailBranchMetadata(branch, lineById, transformerById), islandId: islandByBus.get(sourceIsland.busIds[branch.a]) ?? '' });
  }
  branchImpacts.sort((a, b) => a.equipmentId.localeCompare(b.equipmentId));
  const targetBranchIds = new Set(island.edges.filter(branch => branch.id !== edge.id).map(branch => branch.id));
  const candidateBranchImpacts = branchImpacts.filter(impact => targetBranchIds.has(impact.equipmentId));
  const ranked = [...candidateBranchImpacts].sort((a, b) => (b.postEstimatedLoadingPct ?? -1) - (a.postEstimatedLoadingPct ?? -1) || Math.abs(b.deltaPMw ?? 0) - Math.abs(a.deltaPMw ?? 0) || a.equipmentId.localeCompare(b.equipmentId));
  const asImpact = (impact: N1DetailBranchImpact): N1Impact => ({ equipmentId: impact.equipmentId, sourceClass: impact.sourceClass, from: impact.from, to: impact.to, baseFlowMw: impact.baseFlowMw, postFlowMw: impact.postFlowMw!, deltaPMw: impact.deltaPMw!, capacityMva: impact.capacityMva, baseEstimatedLoadingPct: impact.baseEstimatedLoadingPct, postEstimatedLoadingPct: impact.postEstimatedLoadingPct!, estimatedLoadingPct: impact.estimatedLoadingPct! });
  const violationImpacts = ranked.filter(impact => impact.postFlowMw != null && impact.deltaPMw != null && (impact.postEstimatedLoadingPct ?? 0) > 100).map(asImpact);
  const ratedBranches = candidateBranchImpacts.filter(impact => impact.postEstimatedLoadingPct != null).length, totalBranches = candidateBranchImpacts.length;
  const maxEstimatedLoadingPct = candidateBranchImpacts.reduce<number | null>((max, impact) => impact.postEstimatedLoadingPct == null ? max : Math.max(max ?? 0, impact.postEstimatedLoadingPct), null);
  const maxDeltaPMw = candidateBranchImpacts.reduce<number | null>((max, impact) => impact.deltaPMw == null ? max : Math.max(max ?? 0, Math.abs(impact.deltaPMw)), null);
  let screenCandidate: N1ScreenCandidate;
  if (!outageBaseSolved) screenCandidate = emptyMetrics(candidate, candidate.topology === 'ISLANDING' ? 'ISLANDING' : 'UNSCREENABLE');
  else {
    const status: N1CandidateStatus = candidate.topology === 'ISLANDING' ? 'ISLANDING' : violationImpacts.length ? 'SCREENED_VIOLATION' : ratedBranches < totalBranches ? 'CAPACITY_UNAVAILABLE' : 'SCREENED_NO_VIOLATION';
    screenCandidate = { ...candidate, status, islanding: candidate.topology === 'ISLANDING', outageRatingAvailable: candidate.ratingAvailable, baseFlowMw: outageBaseFlow, maxEstimatedLoadingPct, estimatedOverloadCount: violationImpacts.length, maxDeltaPMw, ratingCoverage: { evaluated: true, ratedBranches, totalBranches, percent: totalBranches ? ratedBranches / totalBranches * 100 : 100 }, topImpacts: ranked.filter(impact => impact.postFlowMw != null && impact.deltaPMw != null).slice(0, IMPACT_LIMIT).map(asImpact), violationImpacts };
  }
  return { candidateId, candidate: screenCandidate, outage, outageEquipment: outage, branchImpacts, outageIslands, elapsedMs: performance.now() - started };
}
