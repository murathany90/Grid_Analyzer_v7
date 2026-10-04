/**
 * Builds docs/validation/<version>-release.json from the artifacts that were actually
 * measured. Every number is read from a captured result, a KPI report or a hashed file;
 * nothing is typed in by hand.
 *
 * Usage:
 *   node --import tsx tools/release-manifest.ts --version=8.2.2 --result=.tmp/sn4-final-result.json --kpi=.tmp/kpi-final.json --kpi-baseline=.tmp/kpi-baseline-8.2.1.json --portable-benchmark=.tmp/portable-full-ac-benchmark.json
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { analysisSettingsHash, defaultAnalysisSettings, effectiveFullAcLimits, profileFidelity, unsupportedFullAcSettings, unsupportedSharedSettings } from '../src/domain/calculation/analysis-settings';
import type { CalculationResult } from '../src/domain/results/types';
import type { PfKpiReport } from '../src/analysis/validation/pf-kpi';

function flag(name: string): string {
  const prefix = `--${name}=`;
  const value = process.argv.find(argument => argument.startsWith(prefix));
  if (!value) throw new Error(`Missing required flag ${name}`);
  return value.slice(prefix.length);
}

const version = flag('version');
const resultPath = flag('result');
const kpiPath = flag('kpi');
const kpiBaselinePath = flag('kpi-baseline');
const portableBenchmarkPath = flag('portable-benchmark');
const portablePath = flag('portable');
const modelPath = flag('model');
const powerFactoryPath = flag('powerfactory');
const controlContextPath = flag('control-context');

const sha256 = async (file: string) => createHash('sha256').update(await readFile(resolve(process.cwd(), file))).digest('hex');
const readJson = async (file: string) => JSON.parse(await readFile(resolve(process.cwd(), file), 'utf8')) as never;

const captured = (await readJson(resultPath)) as {
  result: CalculationResult;
  appVersion: string;
  engineVersion: string;
  modelHash: string;
  controlContextHash: string;
  engineElapsedMs: number;
  wallMs: number;
};
const kpi = (await readJson(kpiPath)) as PfKpiReport & { kpis: PfKpiReport['kpis']; powerFactory: Record<string, string | null> };
const baseline = (await readJson(kpiBaselinePath)) as PfKpiReport & { kpis: PfKpiReport['kpis'] };
const portableBenchmark = (await readJson(portableBenchmarkPath)) as {
  portableSha256: string;
  gitSha: string;
  browser: string;
  engineElapsedMs: number | null;
  wallClockMs: number | null;
  observed: { statusLine: string; newtonIterations: number; fullNrSolves: number } | null;
};

const settings = defaultAnalysisSettings();
const baselineById = new Map(baseline.kpis.map(entry => [entry.id, entry]));
const kpiRows = kpi.kpis.map(entry => {
  const before = baselineById.get(entry.id);
  const improvement = before && before.normalizedPercent > 0
    ? (100 * (entry.normalizedPercent - before.normalizedPercent)) / before.normalizedPercent
    : null;
  return {
    id: entry.id,
    label: entry.label,
    unit: entry.unit,
    n: entry.n,
    sumAbsoluteError: entry.sumAbsoluteError,
    sumAbsoluteReference: entry.sumAbsoluteReference,
    absoluteAverage: entry.absoluteAverage,
    normalizedPercent: entry.normalizedPercent,
    baseline: before
      ? {
          n: before.n,
          sumAbsoluteError: before.sumAbsoluteError,
          sumAbsoluteReference: before.sumAbsoluteReference,
          absoluteAverage: before.absoluteAverage,
          normalizedPercent: before.normalizedPercent,
        }
      : null,
    improvementPercent: improvement,
    improved: improvement != null && improvement <= -0.1,
    regressed: improvement != null && improvement >= 0.5,
  };
});

const improvedCount = kpiRows.filter(row => row.improved).length;
const regressedCount = kpiRows.filter(row => row.regressed).length;
const secondaryById = new Map(kpi.secondary.map(entry => [entry.id, entry]));

const diagnostics = captured.result.diagnostics as Record<string, never>;
const controllers = (diagnostics.stationControllerResults ?? []) as Array<{ status: string; voltageResidualPu: number | null }>;
const controllerCounts = Object.fromEntries(
  [...new Set(controllers.map(row => row.status))].sort().map(status => [status, controllers.filter(row => row.status === status).length]),
);
const revalidation = diagnostics.finalControlRevalidation as { revalidatedControllerCount: number; controlResidualCount: number } | undefined;
const externalGrid = (diagnostics.externalGridResults ?? []) as Array<{ id: string; pMw: number; qMvar: number; voltagePu: number; qLimitState: string; isReference: boolean }>;

const manifest = {
  schema: 'grid-analyzer-release-manifest-1',
  version,
  gitCommitSha: process.argv.find(a => a.startsWith('--git-sha='))?.slice(11) ?? portableBenchmark.gitSha,
  engine: {
    name: 'BrowserJsEngine',
    appVersion: captured.appVersion,
    engineVersion: captured.engineVersion,
    calculationIdentityVersion: 'src/domain/calculation/identity.ts',
  },
  artifacts: {
    modelZip: { file: modelPath, sha256: await sha256(modelPath) },
    modelJsonEntry: { sha256: captured.modelHash },
    powerFactoryNumericCsv: { file: powerFactoryPath, sha256: await sha256(powerFactoryPath) },
    powerFactoryControlContextCsv: { file: controlContextPath, sha256: await sha256(controlContextPath), sourceHash: captured.controlContextHash },
    portable: { file: portablePath, sha256: await sha256(portablePath), bytes: (await readFile(resolve(process.cwd(), portablePath))).length },
  },
  calculationSettings: {
    hash: analysisSettingsHash(settings, 'powerFlow'),
    hashAlgorithm: 'FNV-1a over stableJson (src/domain/calculation/analysis-settings.ts)',
    effectiveLimits: effectiveFullAcLimits(settings.powerFlow),
    profile: settings.powerFlow.profile,
    profileFidelity: profileFidelity(settings.powerFlow.profile).fidelity,
    unsupportedSharedSettings: unsupportedSharedSettings(),
    unsupportedPowerFlowSettings: unsupportedFullAcSettings(),
  },
  performance: {
    portableEngineElapsedMs: portableBenchmark.engineElapsedMs,
    portableWallClockMs: portableBenchmark.wallClockMs,
    portableStatusLine: portableBenchmark.observed?.statusLine ?? null,
    newtonIterations: portableBenchmark.observed?.newtonIterations ?? null,
    fullNrSolves: portableBenchmark.observed?.fullNrSolves ?? null,
    nodeEngineElapsedMs: captured.engineElapsedMs,
    nodeWallMs: captured.wallMs,
    budgetMs: 15000,
    withinBudget: portableBenchmark.engineElapsedMs != null && portableBenchmark.engineElapsedMs <= 15000,
    browser: portableBenchmark.browser,
    note: 'Portable/browser and Node are different environments and are reported separately. Repeated portable runs on one host varied between roughly 10 s and 21 s.',
  },
  powerFactoryComparison: {
    modelId: kpi.powerFactory.modelId ?? null,
    studyTimeLocal: kpi.powerFactory.studyTimeLocal ?? null,
    powerFactoryVersion: kpi.powerFactory.version ?? null,
    minimumNominalKv: kpi.minimumNominalKv,
    populationSignature: kpi.population.populationSignature,
    populationMatchesBaseline: kpi.population.populationSignature === baseline.population.populationSignature,
    unmatched: kpi.unmatched,
    kpis: kpiRows,
    secondaryDiagnostics: kpi.secondary,
    mergeGates: {
      improvedByAtLeast0_1Percent: improvedCount,
      regressedByAtLeast0_5Percent: regressedCount,
      requiresFiveOfSixImproved: improvedCount >= 5,
      lineReactivePowerRegressed: kpiRows.find(row => row.id === 'lineReactivePowerMvar')?.regressed ?? false,
      transformerReactivePowerRegressed: kpiRows.find(row => row.id === 'transformerReactivePowerMvar')?.regressed ?? false,
    },
    signDisagreement: Object.fromEntries(
      [...secondaryById].map(([id, entry]) => [id, { count: entry.signDisagreementCount, comparable: entry.signComparableCount }]),
    ),
  },
  convergence: diagnostics.convergence ?? null,
  stationControllers: {
    total: controllers.length,
    statusCounts: controllerCounts,
    finalRevalidation: revalidation ?? null,
  },
  externalGrid: externalGrid.map(row => ({
    id: row.id,
    isReference: row.isReference,
    pMw: row.pMw,
    qMvar: row.qMvar,
    voltagePu: row.voltagePu,
    qLimitState: row.qLimitState,
  })),
  verdict: {
    mergeReady:
      improvedCount >= 5 &&
      regressedCount === 0 &&
      (portableBenchmark.engineElapsedMs != null ? portableBenchmark.engineElapsedMs <= 15000 : false) &&
      kpi.population.populationSignature === baseline.population.populationSignature,
    failedGates: [
      ...(improvedCount >= 5 ? [] : [`PRIMARY_KPI_IMPROVEMENT ${improvedCount}/6 improved by >=0.1 % (requires 5)`]),
      ...(portableBenchmark.engineElapsedMs != null && portableBenchmark.engineElapsedMs <= 15000
        ? []
        : ['FULL_AC_ELAPSED_MS_ABOVE_15000']),
    ],
  },
};

const outPath = resolve(process.cwd(), `docs/validation/v${version}-release.json`);
await writeFile(outPath, `${JSON.stringify(manifest, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ outPath, verdict: manifest.verdict, performance: manifest.performance }, null, 2)}\n`);