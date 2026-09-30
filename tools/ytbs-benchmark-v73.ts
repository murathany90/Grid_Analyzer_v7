/** Local, opt-in A/B/C/D benchmark. Reads ignored source files once and writes aggregate metrics only. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { unzipSync, strFromU8 } from 'fflate';
import { DgsModel } from '../src/importers/dgs/index';
import { mapCanonical } from '../src/importers/dgs/canonical';
import { BrowserJsPowerFlowEngine } from '../src/analysis/api/browser-js-engine';
import {prepareModel} from '../src/analysis/power-flow/preparation';
import type { AnalysisRequest, StationControlMode } from '../src/analysis/api/engine';
import { emptyScenario } from '../src/domain/scenario/overlay';
import { identity } from '../src/domain/calculation/identity';
import type { CanonicalNetwork } from '../src/domain/model/network';
import type { BranchResult, BusResult, CalculationResult } from '../src/domain/results/types';

type Row = Record<string, string | number | null>;
type Metric = { count: number; bias: number | null; mae: number | null; p95: number | null };
type MetricSet = ReturnType<typeof after>;
type Diagnostics = Record<string, unknown>;

const root = 'kontrol1/';
const modelName = '20260928_0900_SN1_TR0.zip';
const referenceName = 'GridAnalyzer_YTBS_FullNR_Karsilastirma_Raporu_20260928 (1).xlsx';
const outputDefault = 'docs/validation/20260928-abcd-benchmark-v73.json';
const timingNames = [
  'prepareMs', 'baseNrMs', 'controllerClassificationMs', 'jacobianBuildMs',
  'rcmReorderMs', 'ilu1FactorMs', 'ilu2FactorMs', 'iluFactorMs',
  'sensitivityIterativeSolveMs', 'cscConversionMs', 'symbolicFactorMs',
  'numericFactorMs', 'directRhsSolveMs', 'sensitivitySolveMs', 'classificationNrMs',
  'outerTrialNrMs', 'finalNrMs',
  'resultMapMs', 'totalMs',
] as const;

function cells(xml: string): Row[] {
  const rows: Row[] = [];
  for (const match of xml.matchAll(/<x:row\b[^>]*>([\s\S]*?)<\/x:row>/g)) {
    const row: Row = {};
    for (const cell of match[1].matchAll(/<x:c\b([^>]*?)(?:\/\s*>|>([\s\S]*?)<\/x:c>)/g)) {
      const address = /\br="([A-Z]+)\d+"/.exec(cell[1])?.[1];
      if (!address) continue;
      const text = /<x:v>([\s\S]*?)<\/x:v>/.exec(cell[2] || '')?.[1];
      if (text == null) { row[address] = null; continue; }
      const decoded = text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
      row[address] = /\bt="n"/.test(cell[1]) ? Number(decoded) : decoded;
    }
    rows.push(row);
  }
  return rows.slice(1);
}

const number = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;

function stats(differences: number[]): Metric {
  if (!differences.length) return { count: 0, bias: null, mae: null, p95: null };
  const sorted = differences.map(Math.abs).sort((a, b) => a - b);
  const k = (sorted.length - 1) * 0.95, lo = Math.floor(k), hi = Math.ceil(k);
  return {
    count: differences.length,
    bias: differences.reduce((a, b) => a + b, 0) / differences.length,
    mae: sorted.reduce((a, b) => a + b, 0) / sorted.length,
    p95: sorted[lo] + (sorted[hi] - sorted[lo]) * (k - lo),
  };
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b), i = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[i] : (sorted[i - 1] + sorted[i]) / 2;
}

// Kept byte-for-byte equivalent in metric logic to tools/ytbs-benchmark.ts.
function baseline(lines: Row[], trafos: Row[], buses: Row[]) {
  const line = lines.filter(r => r.R === 'Eşleşti' && number(r.E) != null && number(r.I) != null);
  const trafo = trafos.filter(r => r.U === 'Eşleşti' && number(r.G) != null && number(r.K) != null);
  const bus = buses.filter(r => r.P === 'Eşleşti' && number(r.F) != null && number(r.I) != null);
  const signed = (rows: Row[], actual: string, reference: string) => stats(rows.map(r => number(r[actual])! - number(r[reference])!));
  const q = (rows: Row[], p: string, s: string, actual: string) => stats(rows.filter(r => number(r[p]) != null && number(r[s]) != null && number(r[actual]) != null).map(r => Math.abs(number(r[actual])!) - Math.sqrt(Math.max(0, number(r[s])! ** 2 - number(r[p])! ** 2))));
  const rawAngles = bus.filter(r => number(r.G) != null && number(r.J) != null).map(r => number(r.J)! - number(r.G)!);
  const offset = median(rawAngles) || 0;
  return {
    lineP: signed(line, 'I', 'E'), line154P: signed(line.filter(r => r.C === 154), 'I', 'E'),
    line400P: signed(line.filter(r => r.C === 400), 'I', 'E'), transformerP: signed(trafo, 'K', 'G'),
    lineQMagnitude: q(line, 'E', 'F', 'J'), transformerQMagnitude: q(trafo, 'G', 'H', 'L'),
    busVpu: signed(bus, 'I', 'F'), angle: { offsetDeg: offset, ...stats(rawAngles.map(v => v - offset)) },
  };
}

function after(lines: Row[], trafos: Row[], buses: Row[], branchRows: BranchResult[], busRows: BusResult[], referenceBusId: unknown) {
  const lineById = new Map(branchRows.filter(r => r.sourceClass === 'ElmLne').map(r => [r.id, r]));
  const trafoById = new Map(branchRows.filter(r => r.sourceClass === 'ElmTr2').map(r => [r.id, r]));
  const busByTerm = new Map<string, BusResult>();
  for (const b of busRows) for (const id of [b.id, ...b.terms]) busByTerm.set(id, b);
  const branchMetric = (rows: Row[], prefix: string, p: string, s: string, map: Map<string, BranchResult>) => {
    const compared = rows.map(r => ({ reference: r, actual: map.get(prefix + String(r.A)) })).filter((r): r is { reference: Row; actual: BranchResult } => !!r.actual && number(r.reference[p]) != null);
    return {
      p: stats(compared.map(({ reference, actual }) => actual.pf - number(reference[p])!)),
      qMagnitude: stats(compared.filter(({ reference }) => number(reference[s]) != null).map(({ reference, actual }) => Math.abs(actual.qf) - Math.sqrt(Math.max(0, number(reference[s])! ** 2 - number(reference[p])! ** 2)))),
    };
  };
  const line = branchMetric(lines, 'H', 'E', 'F', lineById), tr = branchMetric(trafos, 'T', 'G', 'H', trafoById);
  const subset = (kv: number) => branchMetric(lines.filter(r => r.C === kv), 'H', 'E', 'F', lineById).p;
  const matchedBuses = buses.map(r => ({ reference: r, actual: busByTerm.get('B' + String(r.A)) })).filter((r): r is { reference: Row; actual: BusResult } => !!r.actual && number(r.reference.F) != null);
  const anglePairs = matchedBuses.filter(r => number(r.reference.G) != null).map(r => ({ id: 'B' + String(r.reference.A), raw: r.actual.angleRad * 180 / Math.PI - number(r.reference.G)! }));
  const slackPair = anglePairs.find(r => r.id === referenceBusId), offset = slackPair?.raw ?? median(anglePairs.map(r => r.raw)) ?? 0;
  return {
    lineP: line.p, line154P: subset(154), line400P: subset(400), transformerP: tr.p,
    lineQMagnitude: line.qMagnitude, transformerQMagnitude: tr.qMagnitude,
    busVpu: stats(matchedBuses.map(r => r.actual.vmPu - number(r.reference.F)!)),
    angle: { method: slackPair ? 'REFERENCE_BUS' : 'MEDIAN', offsetDeg: offset, ...stats(anglePairs.map(r => r.raw - offset)) },
  };
}

const targets = {
  line154P: { mae: 2, p95: 8 }, line400P: { mae: 10, p95: 30 },
  busVpu: { mae: 0.005, p95: 0.015 }, angle: { mae: 0.5, p95: 1.5 },
};

function targetResults(metrics: MetricSet | null) {
  return metrics ? Object.fromEntries(Object.entries(targets).map(([key, limit]) => {
    const metric = metrics[key as keyof typeof targets];
    return [key, metric.mae != null && metric.p95 != null && metric.mae < limit.mae && metric.p95 < limit.p95];
  })) : null;
}

function record(value: unknown): Diagnostics {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Diagnostics : {};
}

function countBy<T>(items: T[], key: (item: T) => string | null | undefined): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const value = key(item);
    if (value) counts[value] = (counts[value] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

function safeDiagnostics(result: CalculationResult) {
  const diagnostics = record(result.diagnostics), summary = record(diagnostics.stationControllerSummary);
  const controllerRows = Array.isArray(diagnostics.stationControllerResults) ? diagnostics.stationControllerResults : [];
  const controllers = controllerRows.map(record);
  const rawTimings = record(diagnostics.timings ?? diagnostics.timing ?? diagnostics.performance);
  const timings = Object.fromEntries(timingNames.map(name => [name,
    number(rawTimings[name]) ?? number(diagnostics[name]) ?? (name === 'totalMs' ? number(result.elapsedMs) : null),
  ]));
  const statusCounts = Object.keys(record(summary.statusCounts)).length
    ? record(summary.statusCounts)
    : countBy(controllers, row => typeof row.status === 'string' ? row.status : null);
  const failureReasonCounts = Object.keys(record(diagnostics.failureReasonCounts)).length
    ? record(diagnostics.failureReasonCounts)
    : countBy(controllers, row => typeof row.failureReason === 'string' ? row.failureReason : null);
  const islands = Array.isArray(diagnostics.islands) ? diagnostics.islands.map(record) : [];
  const numericalFailure = record(diagnostics.numericalFailure);
  const safeNumericalFailure = Object.fromEntries([
    'failureStage', 'iteration', 'controlRound', 'maxMismatchMw', 'minPivot',
    'islandCount', 'unsuppliedBusCount', 'linearStage', 'pivotSource', 'lineSearchAccepted',
    'lineSearchStepCap', 'lineSearchBestNormRatio', 'maxDxVm', 'maxDxVmBusId',
    'maxDxTheta', 'maxDxThetaBusId', 'maxDxControlDq', 'maxDxControlId',
    'oldMinVm', 'oldMaxVm', 'firstInvalidCandidate',
  ].filter(key => numericalFailure[key] !== undefined).map(key => [key, numericalFailure[key]]));
  return {
    timings,
    preparationMs: number(diagnostics.preparationMs),
    stationControllerSummary: Object.keys(summary).length ? summary : null,
    resultProvenance: diagnostics.resultProvenance ?? null,
    sourceProfileAccounting: diagnostics.sourceProfileAccounting ?? null,
    sensitivitySolver: diagnostics.sensitivitySolver ?? null,
    integratedFailure: diagnostics.integratedFailure ?? null,
    controllerSensitivityDiagnostics: controllers.map(row => Object.fromEntries([
      'controllerId','status','remoteBus','actuatorBuses','participationKi','jacobianDimension','linearMethod',
      'linearIterations','linearResidual','iluMinimumPivot','effectiveSlope','individualDvDqi','elapsedSensitivityMs','failureReason',
    ].filter(key => row[key] !== undefined).map(key => [key,row[key]]))),
    stationTrialAttempts: Array.isArray(diagnostics.stationTrialAttempts) ? diagnostics.stationTrialAttempts : [],
    controllerStatusCounts: statusCounts,
    failureReasonCounts,
    pvToPqCount: Array.isArray(diagnostics.pvToPq) ? diagnostics.pvToPq.length : 0,
    islandCount: islands.length,
    islandStatusCounts: countBy(islands, island => typeof island.status === 'string' ? island.status : null),
    linear: diagnostics.linear ?? null,
    numericalFailure: Object.keys(safeNumericalFailure).length ? safeNumericalFailure : null,
  };
}

async function runCase(
  engine: BrowserJsPowerFlowEngine,
  mode: StationControlMode,
  label: string,
  network: CanonicalNetwork,
  scenario: ReturnType<typeof emptyScenario>,
  calculationIdentity: ReturnType<typeof identity>,
  lines: Row[], trafos: Row[], buses: Row[],
) {
  const started = performance.now();
  const request: AnalysisRequest = { network, scenario, identity: calculationIdentity, stationControlMode: mode };
  const result = await engine.runPowerFlow(request);
  const elapsedWallMs = performance.now() - started;
  const resultDiagnostics = record(result.diagnostics);
  const metrics = result.converged ? after(lines, trafos, buses, result.branches, result.buses, resultDiagnostics.referenceBusId) : null;
  return {
    label, stationControlMode: mode,
    run: {
      status: result.status, converged: result.converged, iterations: result.iterations,
      qLimitRounds: result.rounds, elapsedMs: result.elapsedMs, elapsedWallMs,
      maxMismatchMw: result.maxMismatchMw,
    },
    metrics: metrics ? { after: metrics, targetMet: targetResults(metrics) } : { after: null, targetMet: null },
    diagnostics: safeDiagnostics(result),
  };
}

const outputArg = process.argv.find(arg => arg.startsWith('--output='))?.slice('--output='.length);
const output = outputArg || outputDefault;
if (!/^docs\/validation\/[a-zA-Z0-9._-]+\.json$/.test(output)) throw new Error('Output must be a JSON file in docs/validation.');
const includeDroop = process.argv.includes('--include-droop');
const baselineOnly = process.argv.includes('--baseline-only');
const onlyCase = process.argv.find(arg=>arg.startsWith('--only='))?.slice('--only='.length);
if(onlyCase&&!['A','B','C','D'].includes(onlyCase))throw new Error('Only A, B, C or D can be selected.');

const inputStarted = performance.now();
const referenceBytes = await readFile(root + referenceName);
const referenceSha256 = createHash('sha256').update(referenceBytes).digest('hex');
const workbook = unzipSync(referenceBytes);
const summaryRows = cells(strFromU8(workbook['xl/worksheets/sheet1.xml']));
const lineRows = cells(strFromU8(workbook['xl/worksheets/sheet2.xml']));
const transformerRows = cells(strFromU8(workbook['xl/worksheets/sheet3.xml']));
const busRows = cells(strFromU8(workbook['xl/worksheets/sheet4.xml']));
const before = baseline(lineRows, transformerRows, busRows);
const referenceWorkbookCommit = summaryRows.find(row => row.A === 'GitHub commit')?.B ?? null;
const inputMs = performance.now() - inputStarted;

const baseReport = {
  schemaVersion: 1,
  source: {
    model: modelName, reference: referenceName, referenceSha256, referenceWorkbookCommit,
    note: 'Workbook baseline may have been produced at another commit; row-level reference metrics are recomputed from this workbook.',
  },
  execution: {
    commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    branch: execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim(),
    command: process.argv.map((arg, index) => index === 0 ? 'node' : arg),
    startedAtUtc: new Date().toISOString(),
  },
  rows: { lines: lineRows.length, transformers: transformerRows.length, buses: busRows.length },
  inputMs,
  before,
  qComparison: 'magnitude-only: |Grid Q_from| - sqrt(max(0,YTBS S²-YTBS P²))',
  targets,
  caseDefinitions: {
    A: 'stationControlMode=off; local PV behavior retained (v7.1-style baseline)',
    B: 'stationControlMode=ownership; controller PV ownership removed without outer Q adjustment',
    C: 'stationControlMode=zeroDroop; corrected zero-droop station control',
    D: 'stationControlMode=droop; experimental safe-droop gate (only with --include-droop)',
  },
};

if (baselineOnly) {
  const report = { ...baseReport, modelSha256: null, setup: null, cases: {}, validationQuality: 'REFERENCE_ONLY' };
  await mkdir('docs/validation', { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ rows: report.rows, before, output }, null, 2));
  process.exit(0);
}

const setupStarted = performance.now();
const zipBytes=await readFile(root + modelName),modelZipSha256=createHash('sha256').update(zipBytes).digest('hex'),archive = unzipSync(zipBytes);
const jsonEntries = Object.keys(archive).filter(name => name.toLowerCase().endsWith('.json'));
if (jsonEntries.length !== 1) throw new Error(`Expected one DGS JSON in ZIP; got ${jsonEntries.length}`);
const bytes = archive[jsonEntries[0]], hash = createHash('sha256').update(bytes).digest('hex');
const dgs = new DgsModel(JSON.parse(strFromU8(bytes)), modelName, bytes.length);
await dgs.build();
const network = mapCanonical(dgs, hash), scenario = emptyScenario();
const preparedProfile=prepareModel(network),profileMappings=preparedProfile.diagnostics.stationControllerMappings as {id:string;islandId:string|null;solverBusIndex:number|null}[],mappingById=new Map(profileMappings.map(row=>[row.id,row]));
const droopRows=network.stationControllers.filter(c=>c.inService&&c.droopModeRaw===1),generatorById=new Map(network.generators.map(g=>[g.id,g]));
const remoteKey=(id:string)=>{const row=mappingById.get(id);return row?.solverBusIndex==null?null:`${row.islandId}:${row.solverBusIndex}`;};
const remoteCounts=new Map<string,number>();for(const c of droopRows){const key=remoteKey(c.id);if(key)remoteCounts.set(key,(remoteCounts.get(key)||0)+1);}
const remoteConflict=droopRows.filter(c=>{const key=remoteKey(c.id);return key!=null&&(remoteCounts.get(key)||0)>1;});
const qLimitMissing=droopRows.filter(c=>c.unitIds.some(id=>{const g=generatorById.get(id);return g?.inService&&(g.qMin==null||g.qMax==null);}));
const droopSafeCandidates=droopRows.filter(c=>{const key=remoteKey(c.id),units=c.unitIds.map(id=>generatorById.get(id)).filter(g=>g?.inService);return key!=null&&(remoteCounts.get(key)||0)===1&&units.length===1&&units[0]?.sourceClass==='ElmGenStat'&&units[0].qMin!=null&&units[0].qMax!=null&&c.measurementSelfCubicle===true&&typeof c.ratedPowerRaw==='number'&&c.ratedPowerRaw>0&&typeof c.droopValueRaw==='number'&&Number.isFinite(c.droopValueRaw)&&Math.abs(c.droopValueRaw)>1e-8;});
const zeroRows=network.stationControllers.filter(c=>c.inService&&c.droopModeRaw===0),totalInService=network.stationControllers.filter(c=>c.inService).length;
const sourceProfile={totalInService,zeroDroop:{count:zeroRows.length,reasonCounts:{ZERO_DROOP:zeroRows.length}},droop:{count:droopRows.length,reasonCounts:{REMOTE_CONFLICT:remoteConflict.length,Q_LIMIT_MISSING:qLimitMissing.length,SAFE_CANDIDATE:droopSafeCandidates.length},overlapCounts:{REMOTE_CONFLICT_AND_Q_LIMIT_MISSING:remoteConflict.filter(c=>qLimitMissing.includes(c)).length}},note:'The zeroDroop/droop counts are disjoint. Droop inventory reasons can overlap for the same controller.'};
const calculationIdentity = identity(hash, scenario, 'powerFlow');
const setupMs = performance.now() - setupStarted;

const totalStarted = performance.now();
const engine = new BrowserJsPowerFlowEngine();
const allModes: Array<{ label: 'A' | 'B' | 'C'; mode: StationControlMode }> = [
  { label: 'A', mode: 'off' }, { label: 'B', mode: 'ownership' }, { label: 'C', mode: 'zeroDroop' },
];
const modes=onlyCase?allModes.filter(item=>item.label===onlyCase):allModes;
if(!modes.length&&onlyCase!=='D')throw new Error('Unknown case.');
const cases: Record<string, Awaited<ReturnType<typeof runCase>>|{label:'D';stationControlMode:'droop';run:{status:string;converged:false;elapsedMs:null};metrics:{after:null;targetMet:null};diagnostics:null}> = {};
for (const item of modes) {
  cases[item.label] = await runCase(engine, item.mode, item.label, network, scenario, calculationIdentity,
    lineRows, transformerRows, busRows);
}
const c=cases.C,summary=c?.diagnostics?.stationControllerSummary as Record<string,unknown>|undefined;
const droopGate={cConverged:c?.run.converged===true,cStationResult:c?.diagnostics?.resultProvenance==='SENSITIVITY_STATION_CONTROL',cWithinThreeTimesV71:typeof c?.run.elapsedMs==='number'&&c.run.elapsedMs<=3*17700,cAllZeroDroopSupported:summary?.zeroDroopSemanticallySupported===158,cNoRolledBack:summary?.rolledBack===0,cNoMaxRounds:!(summary?.statusCounts as Record<string,number>|undefined)?.MAX_OUTER_ROUNDS};
const gatePass=Object.values(droopGate).every(Boolean),runDroop=includeDroop&&gatePass;
if(runDroop){cases.D=await runCase(engine,'droop','D',network,scenario,calculationIdentity,lineRows,transformerRows,busRows);}
else cases.D={label:'D',stationControlMode:'droop',run:{status:onlyCase==='D'?'C_GATE_REQUIRED':'NOT_RUN_C_GATE',converged:false,elapsedMs:null},metrics:{after:null,targetMet:null},diagnostics:null};
const totalMs = performance.now() - totalStarted;
const sourceHash = hash;
const report = {
  ...baseReport,
  modelSha256: sourceHash,
  modelZipSha256,
  setup: { modelBuildAndCanonicalMapMs: setupMs },
  sourceProfile,
  droopGate,
  cases,
  run: { caseOrder: [...modes.map(item => item.label),...(runDroop?['D']:[])], totalCaseWallMs: totalMs, totalMs: inputMs + setupMs + totalMs },
  validationQuality: 'BENCHMARKED_PARTIAL' as const,
};

await mkdir('docs/validation', { recursive: true });
await writeFile(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ output, run: report.run, cases: Object.fromEntries(Object.entries(cases).map(([label, value]) => [label, value.run])) }, null, 2));
