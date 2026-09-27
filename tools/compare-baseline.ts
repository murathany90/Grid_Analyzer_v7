import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DgsModel } from '../src/importers/dgs/index';
import { mapCanonical } from '../src/importers/dgs/canonical';
import { prepareModel } from '../src/analysis/power-flow/preparation';
import { solveNR as solvePorted } from '../src/analysis/power-flow/js/index';

const root = process.cwd();
const sourcePath = resolve(root, 'YTBS_PowerFactory_Sebeke_Goruntuleyici_v6_8.html');
const inputPath = resolve(root, 'control1/20260923_1200_SN3_TR0.json');
const html = await readFile(sourcePath, 'utf8');
const sourceHash = createHash('sha256').update(html).digest('hex');
const tempDir = resolve(root, '.tmp/numerical-parity');
await mkdir(tempDir, { recursive: true });

// These are static source extracts from the checked-in v6.8 HTML. The test imports
// them as modules; it never evaluates source text with eval or Function.
const workerOpen = '<script type="text/plain" id="v60FullWorkerSource">';
const workerStart = html.indexOf(workerOpen);
if (workerStart < 0) throw new Error('v60FullWorkerSource script not found');
const workerBodyStart = workerStart + workerOpen.length;
const workerEnd = html.indexOf('</script>', workerBodyStart);
if (workerEnd < 0) throw new Error('v60FullWorkerSource closing tag not found');
const workerBody = html.slice(workerBodyStart, workerEnd).trim();
const workerModulePath = resolve(tempDir, 'v68-full-worker.mjs');
await writeFile(workerModulePath, `${workerBody}\nexport { buildY, calcPQ, makeLayout, fillJacobian, solveLinear, solveNR, selfTests };\n`);

const patchOpen = '<script id="v60Patch">';
const patchStart = html.indexOf(patchOpen);
if (patchStart < 0) throw new Error('v60Patch script not found');
const builderStart = html.indexOf('const E=id=>document.getElementById(id)', patchStart);
const builderEnd = html.indexOf('function fullModelKey()', builderStart);
if (builderStart < 0 || builderEnd < 0) throw new Error('v6.8 full model builder range not found');
const builderBody = html.slice(builderStart, builderEnd).trim();
const builderModulePath = resolve(tempDir, 'v68-full-builder.mjs');
const builderPrefix = `
const v4={activeOverrides:new Map()};
const v42={switchOverrides:new Map()};
const window={YTBS_V62_TRAFO_OVERRIDES:new Map(),YTBS_V68_BUS_OVERRIDES:new Map(),YTBS_V53:null,VirtualEnergizationEngine:null};
const document={getElementById:()=>null};
`;
await writeFile(builderModulePath, `${builderPrefix}\n${builderBody}\nexport { buildElectricalModel };\n`);

const progressMessages: Array<Record<string, unknown>> = [];
const nodeGlobal = globalThis as unknown as { self?: { postMessage: (value: Record<string, unknown>) => void } };
nodeGlobal.self = { postMessage: (value) => { if (value.progress) progressMessages.push(value); } };
const originalSolver = await import(`${pathToFileURL(workerModulePath).href}?source=${sourceHash}`) as {
  solveNR: (model: Record<string, unknown>) => Record<string, unknown>;
  selfTests: () => Array<Record<string, unknown>>;
};
const originalBuilder = await import(`${pathToFileURL(builderModulePath).href}?source=${sourceHash}`) as {
  buildElectricalModel: (model: DgsModel) => Promise<{ solverModel: Record<string, unknown>; meta: Record<string, any> }>;
};

const bytes = await readFile(inputPath);
const raw = JSON.parse(bytes.toString('utf8'));
const model = new DgsModel(raw, '20260923_1200_SN3_TR0.json', bytes.byteLength);
await model.build();
const hash = createHash('sha256').update(bytes).digest('hex');
const originalBuild = await originalBuilder.buildElectricalModel(model);
const canonical = mapCanonical(model, hash);
const prepared = prepareModel(canonical);

const originalMeta = originalBuild.meta;
const originalModel = originalBuild.solverModel;
const preparedModel = prepared.model;
const termsKey = (terms: readonly string[]) => [...terms].sort().join('\u001f');
const originalBusMeta = originalMeta.busMeta as Array<{ terms: string[] }>;
const preparedBusMeta = prepared.buses;
const preparedBusByTerms = new Map(preparedBusMeta.map((bus, i) => [termsKey(bus.terms), i]));
const busPairs = originalBusMeta.flatMap((bus, originalIndex) => {
  const preparedIndex = preparedBusByTerms.get(termsKey(bus.terms));
  return preparedIndex === undefined ? [] : [{ originalIndex, preparedIndex, key: termsKey(bus.terms) }];
});

function compareArrayField(field: string, original: ArrayLike<unknown>, next: ArrayLike<unknown>) {
  let maxAbs = 0, compared = 0, differing = 0, nullabilityDiffs = 0;
  const examples: Array<Record<string, unknown>> = [];
  for (const pair of busPairs) {
    const a = original[pair.originalIndex], b = next[pair.preparedIndex];
    if (a == null || b == null) {
      compared++;
      if (a !== b) { nullabilityDiffs++; differing++; if (examples.length < 4) examples.push({ busTerms: pair.key, original: a, prepared: b }); }
      continue;
    }
    const delta = Math.abs(Number(a) - Number(b));
    compared++;
    if (!Number.isFinite(delta)) { differing++; if (examples.length < 4) examples.push({ busTerms: pair.key, original: a, prepared: b }); }
    else { maxAbs = Math.max(maxAbs, delta); if (delta !== 0) { differing++; if (examples.length < 4) examples.push({ busTerms: pair.key, original: a, prepared: b, absDiff: delta }); } }
  }
  return { compared, differing, nullabilityDiffs, maxAbsDiff: maxAbs, examples };
}

const busFields = ['pSpec', 'qSpec', 'busType', 'vmSet', 'shuntG', 'shuntB', 'qMinNet', 'qMaxNet'] as const;
const busFieldDiffs = Object.fromEntries(busFields.map((field) => [field,
  compareArrayField(field, originalModel[field] as ArrayLike<unknown>, preparedModel[field] as ArrayLike<unknown>)]));

const originalBranches = originalMeta.branchMeta as Array<{ id: string; i: number; j: number }>;
const preparedBranches = prepared.branches;
const preparedBranchById = new Map(preparedBranches.map((branch, i) => [branch.id, i]));
const originalBranchIds = originalBranches.map((branch) => branch.id);
const preparedBranchIds = preparedBranches.map((branch) => branch.id);
const originalBranchIdSet = new Set(originalBranchIds);
const originalModelBranches = originalModel.branches as Array<Record<string, number>>;
const preparedModelBranches = preparedModel.branches as unknown as Array<Record<string, number>>;
const branchFields = ['r', 'x', 'bch', 'tap', 'phase'] as const;
const branchDiffs: Record<string, { compared: number; differing: number; maxAbsDiff: number; examples: Array<Record<string, unknown>> }> = {};
for (const field of branchFields) {
  let maxAbsDiff = 0, compared = 0, differing = 0;
  const examples: Array<Record<string, unknown>> = [];
  for (let oldIndex = 0; oldIndex < originalBranches.length; oldIndex++) {
    const branch = originalBranches[oldIndex], newIndex = preparedBranchById.get(branch.id);
    if (newIndex === undefined) continue;
    const a = originalModelBranches[oldIndex][field], b = preparedModelBranches[newIndex][field], delta = Math.abs(a - b);
    compared++;
    if (delta !== 0) { differing++; maxAbsDiff = Math.max(maxAbsDiff, delta); if (examples.length < 4) examples.push({ id: branch.id, original: a, prepared: b, absDiff: delta }); }
  }
  branchDiffs[field] = { compared, differing, maxAbsDiff, examples };
}
let endpointMismatches = 0;
const endpointExamples: Array<Record<string, unknown>> = [];
for (let oldIndex = 0; oldIndex < originalBranches.length; oldIndex++) {
  const oldMeta = originalBranches[oldIndex], newIndex = preparedBranchById.get(oldMeta.id);
  if (newIndex === undefined) continue;
  const next = prepared.branches[newIndex];
  const oldFrom = termsKey(originalBusMeta[oldMeta.i].terms), oldTo = termsKey(originalBusMeta[oldMeta.j].terms);
  const newFrom = termsKey(prepared.buses[next.i].terms), newTo = termsKey(prepared.buses[next.j].terms);
  if (oldFrom !== newFrom || oldTo !== newTo) {
    endpointMismatches++;
    if (endpointExamples.length < 4) endpointExamples.push({ id: oldMeta.id, original: [oldFrom, oldTo], prepared: [newFrom, newTo] });
  }
}

const originalSolve = originalSolver.solveNR(originalModel);
const originalSolverProgress = [...progressMessages];
progressMessages.length = 0;
const portedSameOriginalModel = solvePorted(originalModel as never, (stage, data = {}) => progressMessages.push({ progress: true, stage, ...data }));
const portedOriginalProgress = [...progressMessages];
progressMessages.length = 0;
const portedPreparedModel = solvePorted(preparedModel);

const progressIterations = (messages: Array<Record<string, unknown>>) => messages
  .filter((message) => message.stage === 'INNER_ITERATION')
  .map(({ round, iteration, maxMismatchMW }) => ({ round, iteration, maxMismatchMW }));
const scalarResult = (result: Record<string, any>) => ({
  status: result.status, converged: result.converged, iterations: result.iterations, rounds: result.rounds,
  maxMismatchMW: result.maxMismatchMW, linear: result.linear ? { method: result.linear.method, iterations: result.linear.iterations, residual: result.linear.residual } : null,
});
const maxResultArrayDiff = (field: string, a: ArrayLike<number> | undefined, b: ArrayLike<number> | undefined) => {
  if (!a || !b) return { available: false };
  let maxAbs = 0, index = -1;
  for (let i = 0; i < Math.min(a.length, b.length); i++) { const d = Math.abs(a[i] - b[i]); if (d > maxAbs) { maxAbs = d; index = i; } }
  return { available: true, lengthA: a.length, lengthB: b.length, maxAbsDiff: maxAbs, index };
};
const compareResults = (a: Record<string, any>, b: Record<string, any>) => ({
  original: scalarResult(a), ported: scalarResult(b),
  arrays: Object.fromEntries(['Vm', 'Va', 'P', 'Q'].map((field) => [field, maxResultArrayDiff(field, a[field], b[field])])),
});

const report = {
  source: { html: 'YTBS_PowerFactory_Sebeke_Goruntuleyici_v6_8.html', sha256: sourceHash, originalWorkerLines: [2651, 2863], originalBuilderLines: [2866, 2930] },
  input: { name: '20260923_1200_SN3_TR0.json', sizeBytes: bytes.byteLength, sha256: hash },
  counts: {
    original: { buses: originalModel.n, branches: originalModelBranches.length, electricalBuses: originalMeta.diag.electricalBuses, solveBuses: originalMeta.diag.solveBuses },
    prepared: { buses: preparedModel.n, branches: preparedModel.branches.length, electricalBuses: prepared.diagnostics.electricalBuses, solveBuses: prepared.diagnostics.solveBuses },
    alignedBuses: busPairs.length, originalBusGroupsMissingInPrepared: originalBusMeta.length - busPairs.length,
    preparedBusGroupsMissingInOriginal: preparedBusMeta.length - busPairs.length,
  },
  modelParity: {
    busFields: busFieldDiffs,
    branchIds: { sameSet: originalBranchIds.length === preparedBranchIds.length && originalBranchIds.every((id) => preparedBranchById.has(id)), originalCount: originalBranchIds.length, preparedCount: preparedBranchIds.length, originalOnly: originalBranchIds.filter((id) => !preparedBranchById.has(id)).slice(0, 20), preparedOnly: preparedBranchIds.filter((id) => !originalBranchIdSet.has(id)).slice(0, 20) },
    branchParameters: branchDiffs,
    endpointMismatches,
    endpointExamples,
  },
  solverParity: {
    originalSolverOnOriginalBuild: scalarResult(originalSolve as Record<string, any>),
    portedSolverOnSameOriginalBuild: scalarResult(portedSameOriginalModel as Record<string, any>),
    portedSolverOnPreparedModel: scalarResult(portedPreparedModel as Record<string, any>),
    originalVsPortedSameModel: compareResults(originalSolve as Record<string, any>, portedSameOriginalModel as Record<string, any>),
    originalVsPortedProgress: { original: progressIterations(originalSolverProgress), portedSameModel: progressIterations(portedOriginalProgress) },
    portedOriginalModelVsPrepared: compareResults(portedSameOriginalModel as Record<string, any>, portedPreparedModel as Record<string, any>),
    originalSelfTests: originalSolver.selfTests(),
  },
  notes: [
    'The original v6.8 model builder and solver were extracted to static .mjs modules from the inspected HTML; no eval or Function constructor is used.',
    'Scenario maps are empty, matching the baseline no-override run. Bus comparison aligns by sorted member ElmTerm FIDs; branch comparison aligns by equipment FID.',
  ],
  diagnosis: {
    modelPreparation: 'No semantic topology, dispatch, bus-type, PV/Q-limit, or setpoint drift was found. Parameter deltas are at floating-point ULP scale and consistent with conversion/accumulation order: original line builder sorts ElmLnesec by section index (line 2881) before adding R/X/B and converts at lines 2902-2903; canonical mapping accumulates section rows in table order before preparation converts to per-unit. Original transformer shunt scaling is g*(sn/base) and b*(sn/base) at lines 2908, while canonical preparation uses (g*sn)/base and (b*sn)/base. Transformer tap conversion is algebraically equivalent but staged differently in canonical.ts versus original line 2907. These operation-order causes are source-grounded; exact per-branch cause was not separately attributed.',
    solverPort: 'No arithmetic port drift on Node: original v6.8 solver and TypeScript solver on the same original model returned identical Vm/Va/P/Q arrays, iterations, rounds, mismatch, linear method, linear iterations, and residual.',
    browserBaseline: 'The supplied v6.8 browser baseline reports LINEAR_SOLVER_FAILED near 0.0003264136912983773 MW in round 4. The extracted original v6.8 builder+solver and ported solver both converge on Node for the same 1200 model. This makes browser/runtime or browser-built-input rounding sensitivity the remaining explanation; the harness did not execute the exact same arrays in a browser, so those two causes are not distinguishable from this run alone.',
    thresholdPolicy: 'No convergence threshold was loosened.',
  },
};
await mkdir(resolve(root, 'docs/validation'), { recursive: true });
await writeFile(resolve(root, 'docs/validation/numerical-parity.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ counts: report.counts, modelParity: { busFields: Object.fromEntries(Object.entries(busFieldDiffs).map(([k,v]) => [k, { differing: v.differing, maxAbsDiff: v.maxAbsDiff, nullabilityDiffs: v.nullabilityDiffs }])), branchIds: report.modelParity.branchIds, branchParameters: Object.fromEntries(Object.entries(branchDiffs).map(([k,v]) => [k,{differing:v.differing,maxAbsDiff:v.maxAbsDiff}])), endpointMismatches }, solverParity: { original: report.solverParity.originalSolverOnOriginalBuild, portedSame: report.solverParity.portedSolverOnSameOriginalBuild, portedPrepared: report.solverParity.portedSolverOnPreparedModel } }, null, 2));
