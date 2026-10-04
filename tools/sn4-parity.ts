/**
 * Golden-fixture Full AC parity run.
 *
 * Reproduces the browser pipeline exactly: ZIP inspection -> DGS import -> canonical
 * mapping -> PowerFactory ControlContext application -> BrowserJsPowerFlowEngine
 * Full AC with the active analysis settings. The CalculationResult is written to a
 * gitignored path so that tools/pf-kpi.ts can score it without re-solving.
 *
 * Usage:
 *   node --max-old-space-size=6144 --import tsx tools/sn4-parity.ts [model.zip] [control-context.csv] [out.json]
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { inspectModelFile } from '../src/importers/model-file';
import { DgsModel } from '../src/importers/dgs/index';
import { mapCanonical } from '../src/importers/dgs/canonical';
import { applyPowerFactoryControlContext, importPowerFactoryControlContext } from '../src/analysis/validation/powerfactory-control-context';
import { BrowserJsPowerFlowEngine } from '../src/analysis/api/browser-js-engine';
import { emptyScenario } from '../src/domain/scenario/overlay';
import { defaultAnalysisSettings } from '../src/domain/calculation/analysis-settings';
import { identity } from '../src/domain/calculation/identity';
import { APP_VERSION } from '../src/version';
import type { CalculationResult } from '../src/domain/results/types';

const root = process.cwd();
const modelArg = process.argv[2] ?? 'kontrol1/20261001_1500_SN4_TR0.zip';
const contextArg = process.argv[3] ?? 'kontrol1/PowerFactory_ControlContext_20261001_1500_SN4_TR0_20261003_224310.csv';
const outArg = process.argv[4] ?? '.tmp/sn4-full-ac-result.json';

const modelPath = resolve(root, modelArg);
const contextPath = resolve(root, contextArg);
const outPath = resolve(root, outArg);

const archiveBytes = await readFile(modelPath);
const archiveFile = new File([new Uint8Array(archiveBytes)], modelArg.split(/[\\/]/).pop()!);
const archive = await inspectModelFile(archiveFile);
if (archive.entries.length !== 1) throw new Error(`Expected exactly one JSON entry, found ${archive.entries.length}.`);
const entry = archive.entries[0];
const extracted = await archive.extract(entry);
const modelBuffer = new Uint8Array(await extracted.arrayBuffer());
const modelHash = createHash('sha256').update(modelBuffer).digest('hex');

const importStart = performance.now();
const source = new DgsModel(JSON.parse(new TextDecoder().decode(modelBuffer).replace(/^\uFEFF/, '')), entry.name.split(/[\\/]/).pop()!, extracted.size);
await source.build();
const network = mapCanonical(source, modelHash);
const importMs = performance.now() - importStart;

const contextText = await readFile(contextPath, 'utf8');
const parsedContext = importPowerFactoryControlContext(contextText);
const withContext = applyPowerFactoryControlContext(network, parsedContext);

const settings = defaultAnalysisSettings();
const scenario = emptyScenario();
const id = identity(network.modelHash, scenario, 'powerFlow', {
  analysisSettings: { shared: settings.shared, powerFlow: settings.powerFlow },
  controlContextHash: parsedContext.sourceHash,
});

const engine = new BrowserJsPowerFlowEngine();
const wallStart = performance.now();
let lastStage = '';
const progressLog: Array<{ stage: string; atMs: number }> = [];
const result: CalculationResult = await engine.runPowerFlow(
  {
    network: withContext,
    scenario,
    identity: id,
    analysisSettings: settings,
    stationControlMode: settings.powerFlow.stationControlMode,
    stationControlImplementation: 'SENSITIVITY',
  },
  stage => {
    if (stage === lastStage) return;
    lastStage = stage;
    progressLog.push({ stage, atMs: Math.round(performance.now() - wallStart) });
  },
);
const wallMs = performance.now() - wallStart;

await mkdir(resolve(outPath, '..'), { recursive: true });
await writeFile(
  outPath,
  JSON.stringify(
    {
      capturedBy: 'tools/sn4-parity.ts',
      appVersion: APP_VERSION,
      engineVersion: engine.version,
      modelFile: modelArg,
      controlContextFile: contextArg,
      controlContextHash: parsedContext.sourceHash,
      modelHash,
      importMs,
      engineElapsedMs: result.elapsedMs,
      wallMs,
      progressLog,
      result,
    },
    null,
    1,
  ),
);

const diagnostics = result.diagnostics as Record<string, unknown>;
const summaryBlock = (diagnostics.stationControllerSummary ?? {}) as Record<string, unknown>;
const activeBalance = diagnostics.activeBalancing as Record<string, unknown> | undefined;
process.stdout.write(
  `${JSON.stringify(
    {
      out: outArg,
      status: result.status,
      converged: result.converged,
      engineElapsedMs: result.elapsedMs,
      wallMs: Math.round(wallMs),
      fullNrSolves: diagnostics.fullNrSolves,
      kluNewtonFactorizations: diagnostics.kluNewtonFactorizations,
      outerControlRounds: diagnostics.outerControlRounds,
      controllerSummary: summaryBlock,
      activeBalanceFidelity: activeBalance?.activeBalanceFidelity,
      activeBalanceIterations: activeBalance?.iterations,
      externalGridResults: diagnostics.externalGridResults,
      qLimitState: diagnostics.qLimitActiveSet,
    },
    null,
    1,
  )}\n`,
);