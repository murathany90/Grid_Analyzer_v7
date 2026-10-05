/**
 * Golden-fixture Full AC parity run.
 *
 * Reproduces the browser pipeline exactly: ZIP inspection -> DGS import -> canonical
 * mapping -> PowerFactory ControlContext application -> BrowserJsPowerFlowEngine
 * Full AC with the active analysis settings. The CalculationResult is written to a
 * gitignored path so that tools/pf-kpi.ts can score it without re-solving.
 *
 * Usage:
 *   node --max-old-space-size=6144 --import tsx tools/sn4-parity.ts [model.zip] [control-context.csv] [out.json] [--station-control-mode=zeroDroop|droop] [--model-equation-tolerance-percent=0.2]
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
const stationModeArg = process.argv.find(arg => arg.startsWith('--station-control-mode='))?.split('=')[1] as 'zeroDroop'|'droop'|undefined;
const implementationArg=process.argv.find(arg=>arg.startsWith('--implementation='))?.split('=')[1] as 'SENSITIVITY'|'INTEGRATED'|undefined;
if(stationModeArg && stationModeArg !== 'zeroDroop' && stationModeArg !== 'droop') throw new Error(`Unsupported station-control mode: ${stationModeArg}`);
const toleranceArg=process.argv.find(arg=>arg.startsWith('--model-equation-tolerance-percent='))?.split('=')[1];
const tolerancePercent=toleranceArg==null?undefined:Number(toleranceArg);
if(toleranceArg!=null&&(tolerancePercent==null||!Number.isFinite(tolerancePercent)||tolerancePercent<=0))throw new Error(`Invalid controller equation tolerance: ${toleranceArg}`);

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
if(stationModeArg) settings.powerFlow.stationControlMode=stationModeArg;
if(tolerancePercent!=null)settings.powerFlow.modelEquationTolerancePercent=tolerancePercent;
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
    stationControlImplementation: implementationArg,
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
      stationControlMode: settings.powerFlow.stationControlMode,
      modelEquationTolerancePercent: settings.powerFlow.modelEquationTolerancePercent,
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
const finalControl = diagnostics.finalControlRevalidation as {perIsland?:Array<{before?:unknown;after?:unknown;causeCounts?:unknown}|null>}|undefined;
const controlRounds = (diagnostics.stationTrialAttempts as Array<Record<string,unknown>>|undefined)?.map(row=>({round:row.round,active:row.activeControllerCount,zeroDroopActive:row.zeroDroopActive,droopActive:row.droopActive,proposalKind:row.proposalKind,oldNorm:row.oldNorm,predictedNorm:row.predictedNorm,newNorm:row.newNorm,rho:row.rho,accepted:row.accepted,rejectedReason:row.rejectedReason,stagnationReason:row.stagnationReason,trustFraction:row.trustFraction,newlySatisfied:row.newlySatisfied,newlySaturated:row.newlySaturated,stagnatedSubsetCount:row.stagnatedSubsetCount}))??[];
const bounded = ((summaryBlock.coupledSolveDiagnostics as Array<Record<string,unknown>>|undefined)??[]).filter(row=>row.solveStatus==='BOUNDED_ITERATIVE');
const boundedSweeps=bounded.map(row=>Number(row.boundedSweeps??0));
const boundedSolver={calls:bounded.length,averageSweeps:bounded.length?boundedSweeps.reduce((sum,value)=>sum+value,0)/bounded.length:0,maxSweeps:Math.max(0,...boundedSweeps),averageObjectiveRatio:bounded.length?bounded.reduce((sum,row)=>sum+Number(row.objectiveRatio??0),0)/bounded.length:0,maxObjectiveRatio:Math.max(0,...bounded.map(row=>Number(row.objectiveRatio??0))),kktConverged:bounded.filter(row=>row.converged===true).length,maxProjectedGradientNorm:Math.max(0,...bounded.map(row=>Number(row.projectedGradientNorm??0))),maxRelativeProjectedGradient:Math.max(0,...bounded.map(row=>Number(row.relativeProjectedGradient??0))),maxColumnNormRatio:Math.max(0,...bounded.map(row=>Number(row.columnNormRatio??0))),maxPolishConditionEstimate:Math.max(0,...bounded.map(row=>Number(row.activeSetPolishConditionEstimate??0))),activeSetPolishIterations:bounded.reduce((sum,row)=>sum+Number(row.activeSetPolishIterations??0),0),activeSetPolishConverged:bounded.filter(row=>row.activeSetPolishConverged===true).length,activeSetPolishRejectedObjectiveIncrease:bounded.filter(row=>row.activeSetPolishRejectedObjectiveIncrease===true).length,directionRebuilds:bounded.reduce((sum,row)=>sum+Number(row.directionRebuilds??0),0),inconsistentDirections:bounded.filter(row=>row.directionConsistent===false).length,stagnatedSubsetCount:controlRounds.reduce((sum,row)=>sum+Number(row.stagnatedSubsetCount??0),0),callsDetail:bounded.map((row,index)=>({callIndex:index+1,activeControllerCount:row.activeControllerCount,zeroDroopCount:row.zeroDroopCount,droopCount:row.droopCount,objectiveStart:row.objectiveStart,objectiveAtSweeps:row.objectiveAtSweeps,objectiveEnd:row.objectiveEnd,objectiveRatio:row.objectiveRatio,projectedGradientNorm:row.projectedGradientNorm,relativeProjectedGradient:row.relativeProjectedGradient,maxControllerAllowedMove:row.maxControllerAllowedMove,interiorVariableCount:row.interiorVariableCount,atLowerBoundCount:row.atLowerBoundCount,atUpperBoundCount:row.atUpperBoundCount,zeroMoveCount:row.zeroMoveCount,columnNormRatio:row.columnNormRatio,activeSetPolishIterations:row.activeSetPolishIterations,activeSetPolishConverged:row.activeSetPolishConverged,activeSetPolishFreeVariables:row.activeSetPolishFreeVariables,activeSetPolishDeferredVariables:row.activeSetPolishDeferredVariables,activeSetPolishConditionEstimate:row.activeSetPolishConditionEstimate,activeSetPolishRegularization:row.activeSetPolishRegularization,activeSetPolishRejectedObjectiveIncrease:row.activeSetPolishRejectedObjectiveIncrease,directionRebuilds:row.directionRebuilds,directionConsistent:row.directionConsistent,matrixValid:row.matrixValid}))};
process.stdout.write(
  `${JSON.stringify(
    {
      out: outArg,
      status: result.status,
      converged: result.converged,
      engineElapsedMs: result.elapsedMs,
      wallMs: Math.round(wallMs),
      fullNrSolves: diagnostics.fullNrSolves,
      totalNewtonIterations: diagnostics.totalNewtonIterations,
      kluNewtonFactorizations: diagnostics.kluNewtonFactorizations,
      outerControlRounds: diagnostics.outerControlRounds,
      controllerSummary: {mode:summaryBlock.mode,supported:summaryBlock.supported,zeroDroopCount:summaryBlock.zeroDroopActive,droopCount:summaryBlock.droopActive,statusCounts:summaryBlock.statusCounts},
      finalControl: finalControl?.perIsland?.map(row=>row?{before:row.before,after:row.after,causeCounts:row.causeCounts}:null),
      boundedSolver,
      controlRounds,
      activeBalanceFidelity: activeBalance?.activeBalanceFidelity,
      activeBalanceIterations: activeBalance?.iterations,
      externalGridResults: diagnostics.externalGridResults,
      qLimitState: diagnostics.qLimitActiveSet,
    },
    null,
    1,
  )}\n`,
);
