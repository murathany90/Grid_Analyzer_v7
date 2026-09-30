import type { CanonicalNetwork } from '../model/network';
import type { CapacitySeason } from '../model/capacity';
import { capacityLimit } from '../model/capacity';
import { effectiveNetwork, type ScenarioOverlay, scenarioSignature } from '../scenario/overlay';
import { stableJson } from '../calculation/identity';
import { APP_VERSION } from '../../version';
import { prepareReduced, type ReducedEdge, type ReducedIsland, type ReducedNetwork } from '../../analysis/fast-ac/reduced-model';
import { KluSparseDirectFactorization } from '../../analysis/power-flow/js/sparse-direct';
import type { SparseMatrix } from '../../analysis/power-flow/js/types';

export type N1SourceClass = 'ElmLne' | 'ElmTr2';
export type N1Topology = 'NON_ISLANDING' | 'ISLANDING' | 'UNSUPPORTED';
export type N1CandidateStatus = 'ISLANDING' | 'UNSCREENABLE' | 'SCREENED_VIOLATION' | 'SCREENED_NO_VIOLATION' | 'CAPACITY_UNAVAILABLE';
export type N1ProgressStage = 'N1_TOPOLOGY' | 'N1_FACTOR' | 'N1_SCREEN' | 'N1_RESULT';
export interface N1ScreenOptions {
  candidateTypes?: readonly N1SourceClass[];
  minVoltageKv?: number;
  maxVoltageKv?: number;
  capacitySeason?: CapacitySeason;
}
export interface N1Candidate {
  candidateId: string; equipmentId: string; sourceClass: N1SourceClass; name: string; vnKv: number;
  from: string; to: string; siteIds: readonly string[]; screenable: boolean; ratingAvailable: boolean;
  representedInReducedModel: boolean; exclusionReason: string | null; topology: N1Topology;
}
export interface N1Impact { equipmentId: string; sourceClass: string; from: string; to: string; baseFlowMw: number; postFlowMw: number; deltaPMw: number; estimatedLoadingPct: number | null }
export interface N1ScreenCandidate extends N1Candidate {
  status: N1CandidateStatus; islanding: boolean; baseFlowMw: number | null;
  maxEstimatedLoadingPct: number | null; estimatedOverloadCount: number; maxDeltaPMw: number | null;
  ratingCoverage: { ratedBranches: number; totalBranches: number; percent: number };
  topImpacts: readonly N1Impact[];
}
export interface N1ScreenResult {
  identity: { modelHash: string; scenarioHash: string; optionsHash: string; engineVersion: string };
  scope: 'REDUCED_GE66_DC_P_ONLY'; candidateTypes: readonly N1SourceClass[]; voltageBands: { minKv: number; maxKv: number | null };
  capacitySeason: CapacitySeason; baseDcStatus: string; elapsedMs: number;
  candidateCount: number; screenedCount: number; islandingCount: number; unratedCount: number; unsupportedCount: number;
  candidates: readonly N1ScreenCandidate[]; remarks: readonly string[];
  dcDiagnostics: { factorizationCount: number; rhsCount: number; maxTrueResidual: number | null; matrices: readonly { dimension: number; nnz: number }[] };
}
export interface N1Progress { stage: N1ProgressStage; completed: number; total: number; percent: number }
export interface N1Callbacks { signal?: AbortSignal; onProgress?: (progress: N1Progress) => void }

const CANCELLED = 'N1_SCREEN_CANCELLED';
const BATCH_SIZE = 64;
const IMPACT_LIMIT = 10;
const optionsOf = (o: N1ScreenOptions = {}) => ({ candidateTypes: [...(o.candidateTypes ?? ['ElmLne', 'ElmTr2'])].sort(), minVoltageKv: o.minVoltageKv ?? 66, maxVoltageKv: o.maxVoltageKv ?? null, capacitySeason: o.capacitySeason ?? 'nominal' });
export function n1OptionsIdentity(network: CanonicalNetwork, scenario: ScenarioOverlay, options: N1ScreenOptions = {}) {
  return { modelHash: network.modelHash, scenarioHash: scenarioSignature(scenario), optionsHash: stableJson(optionsOf(options)), engineVersion: APP_VERSION };
}

function checkCancelled(callbacks?: N1Callbacks): void { if (callbacks?.signal?.aborted) throw new Error(CANCELLED); }
function progress(callbacks: N1Callbacks | undefined, stage: N1ProgressStage, completed: number, total: number): void {
  callbacks?.onProgress?.({ stage, completed, total, percent: total ? Math.round(completed * 100 / total) : 100 });
}
function ratingAvailable(network: CanonicalNetwork, sourceClass: N1SourceClass, id: string, vnKv: number, season: CapacitySeason): boolean {
  if (sourceClass === 'ElmTr2') return Number.isFinite(network.transformers.find(e => e.id === id)?.ratingMva) && (network.transformers.find(e => e.id === id)?.ratingMva ?? 0) > 0;
  const line = network.lines.find(e => e.id === id);
  return !!line?.capacity && capacityLimit(line.capacity, vnKv, season) != null;
}
export function generateN1Candidates(network: CanonicalNetwork, scenario: ScenarioOverlay, options: N1ScreenOptions = {}, reduced = prepareReduced(effectiveNetwork(network, scenario))): N1Candidate[] {
  const opts = optionsOf(options), active = effectiveNetwork(network, scenario), represented = new Set(reduced.islands.flatMap(i => i.edges.map(e => e.id)));
  const candidates: N1Candidate[] = [];
  const add = (e: CanonicalNetwork['lines'][number] | CanonicalNetwork['transformers'][number], cls: N1SourceClass, vnKv: number) => {
    if (!e.inService || !opts.candidateTypes.includes(cls) || !(Number.isFinite(vnKv) && vnKv >= opts.minVoltageKv && (opts.maxVoltageKv == null || vnKv <= opts.maxVoltageKv))) return;
    const isRepresented = represented.has(e.id), reason = !isRepresented ? 'Equipment is not represented by an in-service >=66 kV reduced branch.' : null;
    candidates.push({ candidateId: `${cls}:${e.id}`, equipmentId: e.id, sourceClass: cls, name: e.name, vnKv, from: e.from, to: e.to, siteIds: e.siteIds, screenable: isRepresented, ratingAvailable: ratingAvailable(active, cls, e.id, vnKv, opts.capacitySeason), representedInReducedModel: isRepresented, exclusionReason: reason, topology: isRepresented ? 'NON_ISLANDING' : 'UNSUPPORTED' });
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
function emptyMetrics(candidate: N1Candidate, status: N1CandidateStatus, branches = 0): N1ScreenCandidate {
  return { ...candidate, status, islanding: candidate.topology === 'ISLANDING', baseFlowMw: null, maxEstimatedLoadingPct: null, estimatedOverloadCount: 0, maxDeltaPMw: null, ratingCoverage: { ratedBranches: 0, totalBranches: branches, percent: 0 }, topImpacts: [] };
}

export function runN1Screen(network: CanonicalNetwork, scenario: ScenarioOverlay, options: N1ScreenOptions = {}, callbacks?: N1Callbacks): N1ScreenResult {
  const started = performance.now(), opts = optionsOf(options), effective = effectiveNetwork(network, scenario), reduced = prepareReduced(effective), identity = n1OptionsIdentity(network, scenario, options);
  checkCancelled(callbacks);
  const generated = generateN1Candidates(network, scenario, options, reduced), classified = classifyN1Topology(reduced, generated);
  progress(callbacks, 'N1_TOPOLOGY', classified.length, classified.length);
  const resultMap = new Map<string, N1ScreenCandidate>(), candidateEdge = new Map<string, ReducedEdge>();
  const edgeMap = new Map(reduced.islands.flatMap(i => i.edges.map(e => [e.id, e] as const)));
  const branchCount = reduced.islands.reduce((n, i) => n + i.edges.length, 0);
  for (const c of classified) {
    if (c.topology === 'ISLANDING') resultMap.set(c.candidateId, emptyMetrics(c, 'ISLANDING', branchCount));
    else if (c.topology === 'UNSUPPORTED') resultMap.set(c.candidateId, emptyMetrics(c, 'UNSCREENABLE', branchCount));
    else candidateEdge.set(c.candidateId, edgeMap.get(c.equipmentId)!);
  }
  const byEdge = new Map<string, string>(); for (const [id, e] of candidateEdge) byEdge.set(e.id, id);
  let factorCount = 0, rhsCount = 0, maxTrueResidual: number | null = null, factorCompleted = 0, baseDcOk = reduced.islands.length > 0;
  const matrices: { dimension: number; nnz: number }[] = [], factorTotal = reduced.islands.filter(i => i.edges.length && i.busIds.length > 1).length;
  progress(callbacks, 'N1_FACTOR', 0, factorTotal);
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
      if (!baseSolution.success || !baseSolution.x) { baseDcOk = false; for (const e of island.edges) { const id = byEdge.get(e.id); if (id) resultMap.set(id, emptyMetrics(classified.find(c => c.candidateId === id)!, 'UNSCREENABLE', branchCount)); } continue; }
      built.nodeMap.forEach((bus, i) => baseAngles[bus] = baseSolution.x![i]);
      const flows = island.edges.map(e => ({ e, flow: (baseAngles[e.a] - baseAngles[e.b]) / e.x * island.baseMVA }));
      const pending = island.edges.map(e => ({ e, id: byEdge.get(e.id) })).filter((row): row is { e: ReducedEdge; id: string } => !!row.id);
      for (let offset = 0; offset < pending.length; offset += BATCH_SIZE) {
        checkCancelled(callbacks);
        const batch = pending.slice(offset, offset + BATCH_SIZE), rhsList = batch.map(({ e }) => {
          const rhs = new Float64Array(built.matrix.N), a = built.nodeMap.indexOf(e.a), b = built.nodeMap.indexOf(e.b), perUnit = 1 / island.baseMVA;
          if (a >= 0) rhs[a] += perUnit; if (b >= 0) rhs[b] -= perUnit; return rhs;
        });
        const solved = factor.solveMany(rhsList); rhsCount += solved.length;
        for (let ix = 0; ix < batch.length; ix++) {
          const { e, id } = batch[ix], candidate = classified.find(c => c.candidateId === id)!; const solution = solved[ix];
          if (solution.trueResidual != null) maxTrueResidual = Math.max(maxTrueResidual ?? 0, solution.trueResidual);
          if (!solution.success || !solution.x) { resultMap.set(id, emptyMetrics(candidate, 'UNSCREENABLE', flows.length)); continue; }
          const theta = new Float64Array(n); built.nodeMap.forEach((bus, i) => theta[bus] = solution.x![i]);
          // RHS is a 1 MW transfer in per-unit coordinates; convert solved branch flow back to MW.
          const ptdf = flows.map(row => (theta[row.e.a] - theta[row.e.b]) / row.e.x * island.baseMVA);
          const cIndex = flows.findIndex(row => row.e.id === e.id), denominator = 1 - ptdf[cIndex];
          if (!(Math.abs(denominator) > 1e-8)) { resultMap.set(id, emptyMetrics(candidate, 'UNSCREENABLE', flows.length)); continue; }
          const outageFlow = flows[cIndex].flow, impacts: N1Impact[] = []; let maxLoading: number | null = null, overloads = 0, rated = 0, maxDelta = 0;
          for (let k = 0; k < flows.length; k++) {
            if (k === cIndex) continue;
            const flow = flows[k], delta = ptdf[k] / denominator * outageFlow, post = flow.flow + delta;
            const limit = flow.e.cls === 'ElmLne' ? (() => { const line = effective.lines.find(v => v.id === flow.e.id); return line?.capacity ? capacityLimit(line.capacity, line.fastParameters?.vnKv ?? line.vnKv, opts.capacitySeason) : null; })() : (() => { const tr = effective.transformers.find(v => v.id === flow.e.id); return tr && tr.ratingMva > 0 ? { mva: tr.ratingMva } : null; })();
            const pct = limit?.mva && limit.mva > 0 ? Math.abs(post) / limit.mva * 100 : null;
            if (pct != null) { rated++; maxLoading = Math.max(maxLoading ?? 0, pct); if (pct > 100) overloads++; }
            maxDelta = Math.max(maxDelta, Math.abs(delta)); impacts.push({ equipmentId: flow.e.id, sourceClass: flow.e.cls, from: island.busIds[flow.e.a], to: island.busIds[flow.e.b], baseFlowMw: flow.flow, postFlowMw: post, deltaPMw: delta, estimatedLoadingPct: pct });
          }
          impacts.sort((a, b) => (b.estimatedLoadingPct ?? -1) - (a.estimatedLoadingPct ?? -1) || Math.abs(b.deltaPMw) - Math.abs(a.deltaPMw) || a.equipmentId.localeCompare(b.equipmentId));
          const coverage = { ratedBranches: rated, totalBranches: Math.max(0, flows.length - 1), percent: flows.length > 1 ? rated / (flows.length - 1) * 100 : 100 };
          const status: N1CandidateStatus = overloads ? 'SCREENED_VIOLATION' : !candidate.ratingAvailable || rated < coverage.totalBranches ? 'CAPACITY_UNAVAILABLE' : 'SCREENED_NO_VIOLATION';
          resultMap.set(id, { ...candidate, status, islanding: false, baseFlowMw: outageFlow, maxEstimatedLoadingPct: maxLoading, estimatedOverloadCount: overloads, maxDeltaPMw: maxDelta, ratingCoverage: coverage, topImpacts: impacts.slice(0, IMPACT_LIMIT) });
        }
      }
    } catch (e) {
      if (e instanceof Error && e.message === CANCELLED) throw e;
      baseDcOk = false;
      for (const { id } of island.edges.map(e => ({ id: byEdge.get(e.id) })).filter((v): v is { id: string } => !!v.id)) { const c = classified.find(v => v.candidateId === id)!; resultMap.set(id, emptyMetrics(c, 'UNSCREENABLE', island.edges.length)); }
    } finally { factor.dispose(); }
    progress(callbacks, 'N1_FACTOR', ++factorCompleted, factorTotal);
    const processed = [...resultMap.values()].filter(c => c.status !== 'ISLANDING' && c.status !== 'UNSCREENABLE').length;
    progress(callbacks, 'N1_SCREEN', processed, candidateEdge.size);
  }
  checkCancelled(callbacks);
  const candidates = classified.map(c => resultMap.get(c.candidateId) ?? emptyMetrics(c, 'UNSCREENABLE', branchCount)).sort((a, b) => {
    const rank = (x: N1ScreenCandidate) => x.status === 'ISLANDING' ? 0 : x.status === 'SCREENED_VIOLATION' ? 1 : 2;
    return rank(a) - rank(b) || b.estimatedOverloadCount - a.estimatedOverloadCount || (b.maxEstimatedLoadingPct ?? -1) - (a.maxEstimatedLoadingPct ?? -1) || (b.maxDeltaPMw ?? -1) - (a.maxDeltaPMw ?? -1) || a.candidateId.localeCompare(b.candidateId);
  });
  const islandingCount = candidates.filter(c => c.status === 'ISLANDING').length, unsupportedCount = candidates.filter(c => c.status === 'UNSCREENABLE').length;
  const unratedCount = candidates.filter(c => !c.ratingAvailable || (c.screenable && c.ratingCoverage.ratedBranches < c.ratingCoverage.totalBranches)).length;
  const screenedCount = candidates.filter(c => c.status === 'SCREENED_VIOLATION' || c.status === 'SCREENED_NO_VIOLATION' || c.status === 'CAPACITY_UNAVAILABLE').length;
  progress(callbacks, 'N1_RESULT', candidates.length, candidates.length);
  return { identity, scope: 'REDUCED_GE66_DC_P_ONLY', candidateTypes: opts.candidateTypes, voltageBands: { minKv: opts.minVoltageKv, maxKv: opts.maxVoltageKv }, capacitySeason: opts.capacitySeason, baseDcStatus: baseDcOk ? 'CONVERGED_DC' : 'UNSCREENABLE', elapsedMs: performance.now() - started, candidateCount: candidates.length, screenedCount, islandingCount, unratedCount, unsupportedCount, candidates, remarks: ['P-only DC screening estimate; AC verification was not performed.', 'Losses, Q, voltage magnitude, and phase-shift effects are omitted.'], dcDiagnostics: { factorizationCount: factorCount, rhsCount, maxTrueResidual, matrices } };
}
