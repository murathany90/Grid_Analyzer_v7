/**
 * Builds docs/validation/<version>-release.json from the artifacts that were actually
 * measured. Every number is read from a captured result, a KPI report or a hashed file;
 * nothing is typed in by hand.
 *
 * Usage:
 *   node --import tsx tools/release-manifest.ts --version=8.2.5 --result=.tmp/sn4-v825-result.json --kpi=.tmp/kpi-v825.json --kpi-baseline=.tmp/kpi-v823.json --portable-benchmark=.tmp/portable-v825-benchmark.json --portable=dist-portable/GridAnalyzer_v7.html --model=kontrol1/20261001_1500_SN4_TR0.zip --powerfactory=kontrol1/PowerFactory_LoadFlow_20261001_1500_SN4_TR0_20261003_224310.csv --control-context=kontrol1/PowerFactory_ControlContext_20261001_1500_SN4_TR0_20261003_224310.csv --validation-passed=true
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { analysisSettingsHash, defaultAnalysisSettings, effectiveFullAcLimits, profileFidelity, unsupportedFullAcSettings, unsupportedSharedSettings } from '../src/domain/calculation/analysis-settings';
import type { CalculationResult } from '../src/domain/results/types';
import type { PfKpiReport } from '../src/analysis/validation/pf-kpi';
import { evaluateBaselinePreservationGates, evaluateSignedDiagnosticsGate, evaluateSignedKpiGates, isFullGitSha, type ReleaseGateSignedInput } from './release-gates';

function flag(name: string): string {
  const prefix = `--${name}=`;
  const value = process.argv.find(argument => argument.startsWith(prefix));
  if (!value) throw new Error(`Missing required flag ${name}`);
  return value.slice(prefix.length);
}

/**
 * Signed-diagnostic gate input, derived from the two signed summaries.
 *
 * Both are required. `signedMeanError` is the mean over the six canonical metrics, so a
 * systematic bias a magnitude sum cannot express is part of the gate.
 */
function signedGateInput(summary:PfKpiReport['signedSummary'],baselineSummary:PfKpiReport['signedSummary']|undefined){
  const finite=(value:unknown):number|null=>typeof value==='number'&&Number.isFinite(value)?value:null;
  return{
    signDisagreementCount:finite(summary.signDisagreementCount),
    signDisagreementBaselineCount:finite(baselineSummary?.signDisagreementCount),
    signedMeanError:finite(summary.signedMeanError),
    maxP95AbsoluteError:finite(summary.maxP95AbsoluteError),
    maxP95Baseline:finite(baselineSummary?.maxP95AbsoluteError),
    maxAbsoluteError:finite(summary.maxAbsoluteError),
    maxBaseline:finite(baselineSummary?.maxAbsoluteError),
  } as Partial<ReleaseGateSignedInput>;
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
const kpi = (await readJson(kpiPath)) as PfKpiReport & { kpis: PfKpiReport['kpis']; powerFactory: Record<string, string | null>;modelHash:string;controlContextHash:string };
const baseline = (await readJson(kpiBaselinePath)) as PfKpiReport & { kpis: PfKpiReport['kpis'];modelHash:string;controlContextHash:string };
const validatedBaseline = (await readJson('docs/validation/v8.2.3-release.json')) as {
  gitCommitSha:string;
  artifacts:{modelZip:{sha256:string};modelJsonEntry:{sha256:string};powerFactoryNumericCsv:{sha256:string};powerFactoryControlContextCsv:{sha256:string;sourceHash:string}};
  powerFactoryComparison:{populationSignature:string;kpis:Array<{id:string;n:number;normalizedPercent:number}>};
};
const portableBenchmark = (await readJson(portableBenchmarkPath)) as {
  portableSha256: string;
  committedPortableSha256: string | null;
  gitSha: string;
  status: string;
  browser: string;
  engineElapsedMs: number | null;
  wallClockMs: number | null;
  modelFile: string;
  modelSha256: string;
  controlContextFile: string;
  controlContextSha256: string;
  gitTreeSha: string;
  sourceDirtyAtMeasurement: boolean;
  observed: { statusLine: string; newtonIterations: number; finalNewtonIterations: number; fullNrSolves: number; workCounters?:{kluFactorizations:number|null;stationControlRounds:number|null;activeBalanceRounds:number|null;qLimitRounds:number|null} } | null;
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
const requestedGitSha=process.argv.find(a=>a.startsWith('--git-sha='))?.slice('--git-sha='.length);
const manifestGitSha=requestedGitSha??portableBenchmark.gitSha;
if(!isFullGitSha(manifestGitSha))throw new Error(`Invalid measured git commit SHA: ${manifestGitSha}`);
let commitExists=false;
try{commitExists=execFileSync('git',['cat-file','-t',manifestGitSha],{cwd:process.cwd(),encoding:'utf8'}).trim()==='commit';}catch{commitExists=false;}
const measuredPortableSha256=await sha256(portablePath);
const modelSha256=await sha256(modelPath),powerFactorySha256=await sha256(powerFactoryPath),controlContextSha256=await sha256(controlContextPath);
const canonical=['lineActivePowerMw','lineReactivePowerMvar','transformerActivePowerMw','transformerReactivePowerMvar','busVoltageKv','busAlignedAngleDeg'];
const validKpis=(rows:PfKpiReport['kpis'])=>rows.length===canonical.length&&new Set(rows.map(row=>row.id)).size===canonical.length&&canonical.every(id=>rows.some(row=>row.id===id&&row.n>0&&Number.isFinite(row.normalizedPercent)));
const baselineByIdValidated=new Map(validatedBaseline.powerFactoryComparison.kpis.map(row=>[row.id,row]));
const baselineValidated=validatedBaseline.gitCommitSha==='0c5fe53453d513fdc0bd2e32d0a5784ddd57303c'&&validKpis(baseline.kpis)&&validatedBaseline.powerFactoryComparison.kpis.length===canonical.length&&new Set(validatedBaseline.powerFactoryComparison.kpis.map(row=>row.id)).size===canonical.length&&baseline.population.populationSignature===validatedBaseline.powerFactoryComparison.populationSignature&&baseline.modelHash===validatedBaseline.artifacts.modelJsonEntry.sha256&&baseline.controlContextHash===validatedBaseline.artifacts.powerFactoryControlContextCsv.sourceHash&&baseline.kpis.every(row=>{const source=baselineByIdValidated.get(row.id);return source?.n===row.n&&Math.abs(source.normalizedPercent-row.normalizedPercent)<1e-12;});
const goldenInputsMatch=modelSha256==='7c6ab46df28408f6ff4c9be675bd32924cceab7dbaeff45579bdcdedca0388bb'&&powerFactorySha256==='ac53521de1b83c6dc391de4107b02fb774c8bd7e78fad8ecdca7a6d7c64d50db'&&controlContextSha256==='be0c7f5b4662de989c3ad4364bcd2dfe0dff4f8533dae90fbcfe6f3f5305c347'&&captured.modelHash==='31b9a53f4a8fa29627d53064fd079b1fc4bb141e019c4285db3752bca8319663'&&modelSha256===validatedBaseline.artifacts.modelZip.sha256&&powerFactorySha256===validatedBaseline.artifacts.powerFactoryNumericCsv.sha256&&controlContextSha256===validatedBaseline.artifacts.powerFactoryControlContextCsv.sha256;
const convergence=diagnostics.convergence as {activeBalance?:string;stationControl?:string;pendingControllerStatuses?:Record<string,number>}|undefined;
const unresolvedControllerCount=Object.values(convergence?.pendingControllerStatuses??{}).reduce((sum,count)=>sum+count,0);
if(revalidation&&revalidation.controlResidualCount!==(convergence?.pendingControllerStatuses?.CONTROL_RESIDUAL_AFTER_FINAL_BALANCE??0))throw new Error('Final controller revalidation disagrees with pending status counts.');
const sourcePaths=['src','tools','package.json','package-lock.json','index.html','vite.config.ts','tsconfig.json'];
const git=(...args:string[])=>execFileSync('git',args,{cwd:process.cwd(),encoding:'utf8'}).trim();
const gitQuiet=(...args:string[])=>{try{execFileSync('git',args,{cwd:process.cwd(),stdio:'ignore'});return true;}catch{return false;}};
const measuredTreeSha=commitExists?git('rev-parse',`${manifestGitSha}^{tree}`):null;
const measuredSourceMatchesCurrent=commitExists&&!portableBenchmark.sourceDirtyAtMeasurement&&measuredTreeSha===portableBenchmark.gitTreeSha&&gitQuiet('diff','--quiet',manifestGitSha,'HEAD','--',...sourcePaths)&&git('status','--porcelain','--',...sourcePaths)==='';
const measuredInputsMatch=portableBenchmark.modelFile===modelPath&&portableBenchmark.controlContextFile===controlContextPath&&portableBenchmark.modelSha256===modelSha256&&portableBenchmark.controlContextSha256===controlContextSha256&&captured.modelHash===kpi.modelHash&&captured.controlContextHash===kpi.controlContextHash&&captured.controlContextHash===validatedBaseline.artifacts.powerFactoryControlContextCsv.sourceHash&&captured.appVersion===version&&captured.engineVersion===version;
const sl1=externalGrid.find(row=>row.id==='SL1'&&row.isReference) as (typeof externalGrid)[number]&{qMin?:number|null}|undefined;
const releaseGates=evaluateBaselinePreservationGates({
  baselineValidated,goldenInputsMatch,
  populationMatches:Boolean(kpi.population.populationSignature)&&kpi.population.populationSignature===baseline.population.populationSignature,
  kpis:kpiRows.map(row=>({id:row.id,n:row.n,baselineN:row.baseline?.n??null,improvementPercent:row.improvementPercent})),
  activeBalanceConverged:convergence?.activeBalance==='ACTIVE_BALANCE_CONVERGED',
  stationControlConverged:convergence?.stationControl==='STATION_CONTROL_CONVERGED',
  unresolvedControllerCount,
  portableElapsedMs:portableBenchmark.engineElapsedMs,
  portableStatus:portableBenchmark.status,
  portableSha256:portableBenchmark.portableSha256,
  committedPortableSha256:portableBenchmark.committedPortableSha256,
  measuredPortableSha256,
  measuredGitSha:portableBenchmark.gitSha,
  manifestGitSha,
  commitExists,
  measuredSourceMatchesCurrent,
  measuredInputsMatch,
  sl1PMw:sl1?.pMw??null,sl1QMvar:sl1?.qMvar??null,sl1QMinMvar:sl1?.qMin??null,sl1QLimitState:sl1?.qLimitState??null,
  activeBalanceToleranceMw:settings.powerFlow.nodalToleranceKva/1000,qLimitToleranceMvar:settings.powerFlow.qLimitToleranceMvar,
  stationControlStatus:convergence?.stationControl??null,
  stationPartialDisclosed:convergence?.stationControl!=='STATION_CONTROL_PARTIAL'||(unresolvedControllerCount>0&&controllerCounts.CONTROL_RESIDUAL_AFTER_FINAL_BALANCE===revalidation?.controlResidualCount&&controllerCounts.UNSUPPORTED_DROOP>0&&profileFidelity(settings.powerFlow.profile).fidelity==='PARTIAL'),
  requiredValidationPassed:process.argv.includes('--validation-passed=true'),
  // Signed diagnostics are mandatory input for this path. They are computed here rather
  // than trusted from the captured KPI document, so a manifest cannot be produced without
  // them.
  signed:signedGateInput(kpi.signedSummary,baseline.signedSummary),
});
const signedGateResult=evaluateSignedDiagnosticsGate(signedGateInput(kpi.signedSummary,baseline.signedSummary));

const manifest = {
  schema: 'grid-analyzer-release-manifest-1',
  version,
  gitCommitSha: manifestGitSha,
  sourceProvenance:{gitTreeSha:measuredTreeSha,measuredSourceMatchesCurrent,measuredInputsMatch},
  engine: {
    name: 'BrowserJsEngine',
    appVersion: captured.appVersion,
    engineVersion: captured.engineVersion,
    calculationIdentityVersion: 'src/domain/calculation/identity.ts',
  },
  artifacts: {
    modelZip: { file: modelPath, sha256: modelSha256 },
    modelJsonEntry: { sha256: captured.modelHash },
    powerFactoryNumericCsv: { file: powerFactoryPath, sha256: powerFactorySha256 },
    powerFactoryControlContextCsv: { file: controlContextPath, sha256: controlContextSha256, sourceHash: captured.controlContextHash },
    portable: { file: portablePath, sha256: measuredPortableSha256, bytes: (await readFile(resolve(process.cwd(), portablePath))).length },
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
    finalNewtonIterations: portableBenchmark.observed?.finalNewtonIterations ?? null,
    fullNrSolves: portableBenchmark.observed?.fullNrSolves ?? null,
    kluFactorizations: portableBenchmark.observed?.workCounters?.kluFactorizations ?? null,
    stationControlRounds: portableBenchmark.observed?.workCounters?.stationControlRounds ?? null,
    activeBalanceRounds: portableBenchmark.observed?.workCounters?.activeBalanceRounds ?? null,
    qLimitRounds: portableBenchmark.observed?.workCounters?.qLimitRounds ?? null,
    nodeKluFactorizations: diagnostics.kluNewtonFactorizations ?? null,
    nodeStationControlRounds: diagnostics.outerControlRounds ?? null,
    nodeActiveBalanceRounds: (diagnostics.activeBalancing as {iterations?:number}|undefined)?.iterations ?? null,
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
      developmentPolicyWouldRequireFiveOfSixImproved: improvedCount >= 5,
      lineReactivePowerRegressed: kpiRows.find(row => row.id === 'lineReactivePowerMvar')?.regressed ?? false,
      transformerReactivePowerRegressed: kpiRows.find(row => row.id === 'transformerReactivePowerMvar')?.regressed ?? false,
      ...releaseGates,
    },
    signDisagreement: Object.fromEntries(
      [...secondaryById].map(([id, entry]) => [id, { count: entry.signDisagreementCount, comparable: entry.signComparableCount }]),
    ),
    // Signed diagnostics are additional gate input, never a replacement for the primary
    // magnitude KPI: a wrong-sign error contributes only the smaller magnitude to that KPI.
    signedGate: evaluateSignedKpiGates({
      signedSummary: kpi.signedSummary,
      baselineSignedSummary: baseline.signedSummary,
    }),
    // Mandatory for this path: the release is not merge-ready without complete signed
    // diagnostics, because the magnitude-only primary KPI cannot see a wrong-sign error.
    signedGateRequired: signedGateResult,
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
  verdict: releaseGates,
};

const outPath = resolve(process.cwd(), `docs/validation/v${version}-release.json`);
await writeFile(outPath, `${JSON.stringify(manifest, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ outPath, verdict: manifest.verdict, performance: manifest.performance }, null, 2)}\n`);
