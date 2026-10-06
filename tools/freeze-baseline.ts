/**
 * Frozen-baseline measurement for the opencode_fix hardening round.
 *
 * Produces every figure the round must preserve or improve, in one JSON document, so a
 * before/after comparison is mechanical rather than read off console output:
 *
 *   P / Q / V / aligned angle: MAE, p95, max and the largest offenders over the >= 66 kV
 *   population, plus sign disagreement counts
 *   generator Q: MAE by group, opposite-bound count, the largest Q outliers
 *   station control: state counts, missing-source-Q-limit count, movable residual
 *   solver: Newton iterations, KLU factorizations, full NR solves, active-set restarts,
 *   runtime
 *
 * It reads only a captured solve and the PowerFactory CSV. It never feeds a PowerFactory
 * value back into the solver.
 *
 * Usage:
 *   node --max-old-space-size=6144 --import tsx tools/freeze-baseline.ts <model.zip> <control-context.csv> <pf.csv> <captured.json> <out.json> <label>
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { inspectModelFile } from '../src/importers/model-file';
import { DgsModel } from '../src/importers/dgs/index';
import { mapCanonical } from '../src/importers/dgs/canonical';
import { parsePowerFactoryNumericCsv } from '../src/analysis/validation/pf-kpi-csv';
import { computePowerFactoryKpis, PF_KPI_IDS } from '../src/analysis/validation/pf-kpi';
import { Q_LIMITS_MISSING_CODE } from '../src/analysis/power-flow/station-participation';
import type { CalculationResult } from '../src/domain/results/types';

const [modelArg, contextArg, pfArg, captureArg, outArg, label] = process.argv.slice(2);
if (!modelArg || !contextArg || !pfArg || !captureArg || !outArg) {
  throw new Error('Usage: freeze-baseline.ts <model.zip> <control-context.csv> <pf.csv> <captured.json> <out.json> [label]');
}

const MIN_KV = 66;
const quantile = (values: readonly number[], p: number): number => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const at = (sorted.length - 1) * p;
  const low = Math.floor(at);
  const high = Math.ceil(at);
  return sorted[low] + (sorted[high] - sorted[low]) * (at - low);
};
interface Distribution { n: number; mae: number; signedMae: number; p95: number; max: number }
const distribution = (errors: readonly number[]): Distribution => ({
  n: errors.length,
  mae: errors.length ? errors.reduce((sum, value) => sum + Math.abs(value), 0) / errors.length : 0,
  signedMae: errors.length ? errors.reduce((sum, value) => sum + value, 0) / errors.length : 0,
  p95: quantile(errors, 0.95),
  max: errors.length ? Math.max(...errors.map(Math.abs)) : 0,
});

const capture = JSON.parse(await readFile(resolve(captureArg), 'utf8')) as { result: CalculationResult; engineElapsedMs?: number };
const result = capture.result;
const { rows } = parsePowerFactoryNumericCsv(await readFile(resolve(pfArg), 'utf8'));

// Canonical model, for source-side inventories only.
const archiveBytes = await readFile(resolve(modelArg));
const archive = await inspectModelFile(new File([new Uint8Array(archiveBytes)], modelArg.split(/[\\/]/).pop()!));
const entry = archive.entries[0];
const extracted = await archive.extract(entry);
const source = new DgsModel(JSON.parse(new TextDecoder().decode(await extracted.arrayBuffer()).replace(/^\uFEFF/, '')), entry.name, extracted.size);
await source.build();
const network = mapCanonical(source, 'freeze-baseline');
await readFile(resolve(contextArg)); // present so a missing input fails loudly

// --- canonical KPI on the shared population -------------------------------------------
const report = computePowerFactoryKpis({ rows, result });

// --- P / Q / V / angle distributions over the >= 66 kV population ------------------------
const gaBranchByFid = new Map(result.branches.map(branch => [branch.id, branch]));
const gaBusByAlias = new Map<string, (typeof result.buses)[number]>();
for (const bus of result.buses) {
  if (!gaBusByAlias.has(bus.id)) gaBusByAlias.set(bus.id, bus);
  for (const term of bus.terms ?? []) if (!gaBusByAlias.has(term)) gaBusByAlias.set(term, bus);
}
interface Sample { id: string; ga: number; pf: number; error: number }
const samples = { p: [] as Sample[], q: [] as Sample[], v: [] as Sample[], angle: [] as Sample[] };
const busGroups = new Map<string, typeof rows>();
for (const row of rows) {
  if (row.resultAvailable !== '1') continue;
  if (row.kind === 'line' || row.kind === 'transformer') {
    if (row.fromVoltageKv === undefined || row.fromVoltageKv < MIN_KV) continue;
    const branch = gaBranchByFid.get(row.fid);
    if (!branch) continue;
    const pairs: Array<[number | undefined, number | undefined, string]> = row.kind === 'line'
      ? [[branch.pf, row.pFromMw, 'pFrom'], [branch.pt, row.pToMw, 'pTo'], [branch.qf, row.qFromMvar, 'qFrom'], [branch.qt, row.qToMvar, 'qTo']]
      : [[branch.pf, row.pHvMw, 'pHv'], [branch.pt, row.pLvMw, 'pLv'], [branch.qf, row.qHvMvar, 'qHv'], [branch.qt, row.qLvMvar, 'qLv']];
    for (const [ga, pf, field] of pairs) {
      if (ga === undefined || pf === undefined) continue;
      (field.startsWith('p') ? samples.p : samples.q).push({ id: `${row.kind}:${row.fid}:${field}`, ga, pf, error: ga - pf });
    }
  } else if (row.kind === 'bus') {
    if (row.nominalKv === undefined || row.nominalKv < MIN_KV) continue;
    const key = row.electricalBusKey;
    if (!key) continue;
    const group = busGroups.get(key);
    if (group) group.push(row);
    else busGroups.set(key, [row]);
  }
}
// Per-island reference alignment, exactly as the canonical KPI does it.
const angleCandidates: Array<{ islandId: string; gaAngleDeg: number; pfAngleDeg: number; isPfReference: boolean }> = [];
for (const [, group] of busGroups) {
  const gaBus = gaBusByAlias.get(group[0]!.electricalBusKey!);
  if (!gaBus) continue;
  const voltage = group.map(row => row.voltageKv).find(value => value !== undefined);
  if (voltage !== undefined) samples.v.push({ id: `bus:${group[0]!.electricalBusKey}:kv`, ga: gaBus.vmPu * gaBus.vnKv, pf: voltage, error: gaBus.vmPu * gaBus.vnKv - voltage });
  const angle = group.map(row => row.angleDeg).find(value => value !== undefined);
  if (angle !== undefined) angleCandidates.push({ islandId: gaBus.islandId ?? 'unknown', gaAngleDeg: (gaBus.angleRad * 180) / Math.PI, pfAngleDeg: angle, isPfReference: group.some(row => row.isReferenceBus === '1') });
}
const offsets = new Map<string, number>();
for (const [islandId, candidates] of [...angleCandidates.reduce((map, c) => map.set(c.islandId, [...(map.get(c.islandId) ?? []), c]), new Map<string, typeof angleCandidates>())]) {
  const reference = candidates.find(candidate => candidate.isPfReference);
  if (reference) offsets.set(islandId, reference.pfAngleDeg - reference.gaAngleDeg);
  else {
    const residuals = candidates.map(candidate => candidate.pfAngleDeg - candidate.gaAngleDeg).sort((a, b) => a - b);
    offsets.set(islandId, residuals[Math.floor(residuals.length / 2)] ?? 0);
  }
}
for (const candidate of angleCandidates) {
  const aligned = candidate.gaAngleDeg + (offsets.get(candidate.islandId) ?? 0);
  samples.angle.push({ id: `bus:${candidate.islandId}:angle`, ga: aligned, pf: candidate.pfAngleDeg, error: aligned - candidate.pfAngleDeg });
}
const summarise = (list: Sample[]) => ({
  ...distribution(list.map(sample => sample.error)),
  signDisagreementCount: list.filter(sample => Math.abs(sample.ga) > 1e-6 && Math.abs(sample.pf) > 1e-6 && Math.sign(sample.ga) !== Math.sign(sample.pf)).length,
  signComparableCount: list.filter(sample => Math.abs(sample.ga) > 1e-6 && Math.abs(sample.pf) > 1e-6).length,
  top: [...list].sort((a, b) => Math.abs(b.error) - Math.abs(a.error)).slice(0, 15).map(sample => ({ id: sample.id, ga: sample.ga, pf: sample.pf, error: sample.error })),
});

// --- generator Q -----------------------------------------------------------------------
const pfGeneratorQ = new Map(rows.filter(row => row.kind === 'generator' && row.qResultMvar != null).map(row => [row.fid, row.qResultMvar!]));
const stationGroup = new Map<string, 'zeroDroop' | 'droop'>();
for (const controller of network.stationControllers.filter(row => row.inService)) for (const id of controller.unitIds) stationGroup.set(id, controller.droopModeRaw === 1 ? 'droop' : 'zeroDroop');
const generatorSource = new Map(network.generators.map(row => [row.id, row]));
const controllerByUnit = new Map(network.stationControllers.flatMap(controller => controller.unitIds.map(id => [id, controller.id] as const)));
const generatorErrors: Record<'all' | 'zeroDroop' | 'droop' | 'nonStation', number[]> = { all: [], zeroDroop: [], droop: [], nonStation: [] };
const generatorRows: Array<{ id: string; group: string; ga: number; pf: number; error: number }> = [];
const oppositeBounds: Array<{ id: string; controller: string; localBound: string; referenceBound: string }> = [];
for (const generator of result.generators) {
  const reference = pfGeneratorQ.get(generator.id);
  if (reference == null || generator.qMvar == null) continue;
  const group = stationGroup.get(generator.id) ?? 'nonStation';
  const error = generator.qMvar - reference;
  generatorErrors.all.push(error);
  generatorErrors[group].push(error);
  generatorRows.push({ id: generator.id, group, ga: generator.qMvar, pf: reference, error });
  const unit = generatorSource.get(generator.id);
  if (group === 'nonStation' || unit?.qMin == null || unit?.qMax == null || unit.qMax - unit.qMin < 0.1) continue;
  const tolerance = 0.05;
  const localMin = Math.abs(generator.qMvar - unit.qMin) <= tolerance;
  const localMax = Math.abs(generator.qMvar - unit.qMax) <= tolerance;
  const pfMin = Math.abs(reference - unit.qMin) <= tolerance;
  const pfMax = Math.abs(reference - unit.qMax) <= tolerance;
  if (localMin && pfMax) oppositeBounds.push({ id: generator.id, controller: controllerByUnit.get(generator.id) ?? '', localBound: 'QMIN', referenceBound: 'QMAX' });
  if (localMax && pfMin) oppositeBounds.push({ id: generator.id, controller: controllerByUnit.get(generator.id) ?? '', localBound: 'QMAX', referenceBound: 'QMIN' });
}

// --- station control and solver counters -----------------------------------------------
const diagnostics = result.diagnostics as Record<string, any>;
const controllers = (diagnostics.stationControllerResults ?? []) as Array<{ id: string; status: string; supported: boolean; voltageResidualPu: number | null; qLimitAvailability?: string; qMin: number | null; qMax: number | null }>;
const statusCounts = Object.fromEntries([...new Set(controllers.map(row => row.status))].sort().map(status => [status, controllers.filter(row => row.status === status).length]));
const stationSummary = diagnostics.stationControllerSummary as Record<string, any> | undefined;
const qLimitAvailability = stationSummary?.qLimitAvailability as Record<string, number> | undefined
  ?? Object.fromEntries([...new Set(controllers.map(row => row.qLimitAvailability ?? 'UNREPORTED'))].map(key => [key, controllers.filter(row => (row.qLimitAvailability ?? 'UNREPORTED') === key).length]));

const baseline: Record<string, any> = {
  label: label ?? null,
  model: modelArg,
  capturedFrom: captureArg,
  status: result.status,
  converged: result.converged,
  runtimeMs: { engine: capture.engineElapsedMs ?? null, calculation: result.elapsedMs },
  canonicalKpi: Object.fromEntries(report.kpis.map(kpi => [kpi.id, { normalizedPercent: kpi.normalizedPercent, n: kpi.n, sumAbsoluteError: kpi.sumAbsoluteError }])),
  populationSignature: report.population.populationSignature,
  signedSummary: report.signedSummary,
  distributions: {
    p: summarise(samples.p),
    q: summarise(samples.q),
    v: summarise(samples.v),
    angle: summarise(samples.angle),
  },
  generatorQ: {
    all: distribution(generatorErrors.all),
    zeroDroop: distribution(generatorErrors.zeroDroop),
    droop: distribution(generatorErrors.droop),
    nonStation: distribution(generatorErrors.nonStation),
    oppositeBoundCount: oppositeBounds.length,
    oppositeBounds,
    topOutliers: [...generatorRows].sort((a, b) => Math.abs(b.error) - Math.abs(a.error)).slice(0, 15),
  },
  stationControl: {
    controllerCount: controllers.length,
    statusCounts,
    qLimitAvailability,
    missingQLimitControllerCount: controllers.filter(row => row.qLimitAvailability === 'MISSING').length,
    missingQLimitControllerIds: controllers.filter(row => row.qLimitAvailability === 'MISSING').map(row => row.id).sort(),
    missingQLimitUnits: stationSummary?.qLimitAvailability?.MISSING ?? null,
    movableResidual: controllers.filter(row => row.supported && !['SATISFIED', 'SATURATED_QMIN', 'SATURATED_QMAX', 'NO_REACTIVE_HEADROOM'].includes(row.status) && Math.abs(row.voltageResidualPu ?? 0) > 0.002).length,
    saturatedResidual: controllers.filter(row => ['SATURATED_QMIN', 'SATURATED_QMAX'].includes(row.status) && Math.abs(row.voltageResidualPu ?? 0) > 0.002).length,
    resultProvenance: diagnostics.resultProvenance ?? null,
    stationSourceFidelity: stationSummary?.stationSourceFidelity ?? null,
    // Solved-vs-unsolved split of the missing-Q-limit controllers. Only a controller the
    // station solve actually used may make comparability PARTIAL, so the report must keep
    // the two lists apart instead of recording a single count.
    missingSourceQLimit: stationSummary?.missingSourceQLimit ?? null,
    missingQLimitSolvedCount: (stationSummary?.missingSourceQLimit as { controllerCount?: number } | undefined)?.controllerCount ?? null,
    missingQLimitUnsolvedIds: (stationSummary?.missingSourceQLimit as { unsolvedControllerIds?: string[] } | undefined)?.unsolvedControllerIds ?? null,
    missingQLimitControllers: controllers.filter(row => row.qLimitAvailability === 'MISSING').map(row => row.id).sort(),
    controlLimitRestarts: stationSummary?.controlLimitRestarts ?? null,
    qginiClamp: stationSummary?.qginiClamp ?? null,
    effectiveActiveSetLimits: stationSummary?.effectiveActiveSetLimits ?? null,
  },
  solver: {
    fullNrSolves: diagnostics.fullNrSolves ?? null,
    totalNewtonIterations: diagnostics.totalNewtonIterations ?? null,
    kluNewtonFactorizations: diagnostics.kluNewtonFactorizations ?? null,
    outerControlRounds: diagnostics.outerControlRounds ?? null,
    qLimitRounds: diagnostics.qLimitActiveSet?.rounds?.length ?? null,
    qLimitActiveSet: diagnostics.qLimitActiveSet?.generic ?? null,
  },
  convergence: diagnostics.convergence ?? null,
  sourceFidelity: diagnostics.sourceFidelity ?? null,
};

await mkdir(dirname(resolve(outArg)), { recursive: true });
await writeFile(resolve(outArg), `${JSON.stringify(baseline, null, 1)}\n`);
process.stdout.write(`${JSON.stringify({
  label: baseline.label,
  runtimeMs: baseline.runtimeMs,
  kpi: Object.fromEntries(PF_KPI_IDS.map(id => [id, Number(report.kpis.find(kpi => kpi.id === id)!.normalizedPercent.toFixed(6))])),
  generatorQ: { maeMvar: baseline.generatorQ.all.mae, oppositeBoundCount: baseline.generatorQ.oppositeBoundCount, nonStationMae: baseline.generatorQ.nonStation.mae },
  q: { mae: baseline.distributions.q.mae, p95: baseline.distributions.q.p95, max: baseline.distributions.q.max, signDisagreement: baseline.distributions.q.signDisagreementCount },
  station: {
    movableResidual: baseline.stationControl.movableResidual,
    missingQLimitControllers: baseline.stationControl.missingQLimitControllerCount,
    sourceFidelity: baseline.stationControl.stationSourceFidelity,
    missingQLimitDiagnosticCode: Q_LIMITS_MISSING_CODE,
    statusCounts,
  },
  solver: baseline.solver,
}, null, 1)}\n`);