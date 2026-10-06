/**
 * Canonical PowerFactory KPI scorer.
 *
 * Reads a captured Grid Analyzer Full AC result and the PowerFactory numeric benchmark
 * CSV, then emits the six canonical merge KPIs, the secondary diagnostics and the
 * population signature. README tables, the release manifest and the merge decision all
 * consume this output, so no document can quote a differently computed number.
 *
 * Usage:
 *   node --import tsx tools/pf-kpi.ts <result.json> <pf.csv> [--out=path.json] [--baseline=path.json]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  computePowerFactoryKpis,
  kpiImprovementPercent,
  PF_KPI_IDS,
  type PfKpiReport,
} from '../src/analysis/validation/pf-kpi';
import { parsePowerFactoryNumericCsv } from '../src/analysis/validation/pf-kpi-csv';
import type { CalculationResult } from '../src/domain/results/types';

function readFlag(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find(argument => argument.startsWith(prefix))?.slice(prefix.length);
}

async function main(): Promise<void> {
  const positional = process.argv.slice(2).filter(argument => !argument.startsWith('--'));
  const [resultArg, pfArg] = positional;
  if (!resultArg || !pfArg) {
    process.stderr.write(
      'Usage: node --import tsx tools/pf-kpi.ts <result.json> <pf.csv> [--out=path.json] [--baseline=path.json]\n',
    );
    process.exitCode = 2;
    return;
  }

  const captured = JSON.parse(await readFile(resolve(process.cwd(), resultArg), 'utf8')) as {
    result: CalculationResult;
    modelHash?: string;
    appVersion?: string;
    engineElapsedMs?: number;
    wallMs?: number;
    controlContextHash?: string;
  };
  const { rows, meta } = parsePowerFactoryNumericCsv(await readFile(resolve(process.cwd(), pfArg), 'utf8'));

  const report: PfKpiReport = computePowerFactoryKpis({ rows, result: captured.result });
  const baselinePath = readFlag('baseline');
  let comparison: unknown = null;
  if (baselinePath) {
    const baseline = JSON.parse(await readFile(resolve(process.cwd(), baselinePath), 'utf8')) as {
      kpis: PfKpiReport['kpis'];
      populationSignature?: string;
    };
    if(baseline.kpis.length!==PF_KPI_IDS.length||new Set(baseline.kpis.map(row=>row.id)).size!==PF_KPI_IDS.length||PF_KPI_IDS.some(id=>!baseline.kpis.some(row=>row.id===id&&row.n>0&&Number.isFinite(row.normalizedPercent))))throw new Error('Baseline has duplicate, missing or invalid canonical KPI rows.');
    if(!baseline.populationSignature||baseline.populationSignature!==report.population.populationSignature)throw new Error('Baseline population signature is missing or differs from candidate.');
    const baselineById = new Map(baseline.kpis.map(kpi => [kpi.id, kpi]));
    comparison = {
      baselineFile: baselinePath,
      populationSignatureMatches: true,
      baselinePopulationSignature: baseline.populationSignature ?? null,
      candidatePopulationSignature: report.population.populationSignature,
      kpis: report.kpis.map(kpi => {
        const before = baselineById.get(kpi.id);
        return {
          id: kpi.id,
          unit: kpi.unit,
          baselineN: before?.n ?? null,
          candidateN: kpi.n,
          baselineNormalizedPercent: before?.normalizedPercent ?? null,
          candidateNormalizedPercent: kpi.normalizedPercent,
          improvementPercent: before ? kpiImprovementPercent(before, kpi) : null,
          baselineAbsoluteAverage: before?.absoluteAverage ?? null,
          candidateAbsoluteAverage: kpi.absoluteAverage,
        };
      }),
    };
  }

  const output = {
    tool: 'tools/pf-kpi.ts',
    calculator: 'src/analysis/validation/pf-kpi.ts',
    modelHash: captured.modelHash ?? null,
    appVersion: captured.appVersion ?? null,
    controlContextHash: captured.controlContextHash ?? null,
    powerFactory: {
      modelId: meta.modelId ?? null,
      studyCase: meta.studyCase ?? null,
      studyTimeLocal: meta.studyTimeLocal ?? null,
      version: meta.powerFactoryVersion ?? null,
      schemaVersion: meta.schemaVersion ?? null,
    },
    engineElapsedMs: captured.engineElapsedMs ?? null,
    wallMs: captured.wallMs ?? null,
    status: captured.result.status,
    converged: captured.result.converged,
    minimumNominalKv: report.minimumNominalKv,
    kpis: report.kpis,
    secondary: report.secondary,
    signedSummary: report.signedSummary,
    population: report.population,
    populationSignature: report.population.populationSignature,
    alignment: report.alignment,
    unmatched: report.unmatched,
    comparison,
    missingKpis: PF_KPI_IDS.filter(id => !report.kpis.some(kpi => kpi.id === id && kpi.n > 0)),
  };

  const outFlag = readFlag('out');
  if (outFlag) await writeFile(resolve(process.cwd(), outFlag), `${JSON.stringify(output, null, 2)}\n`);

  process.stdout.write(
    [
      `population: ${report.population.populationSignature}`,
      ...report.kpis.map(
        kpi =>
          `${kpi.id.padEnd(28)} N=${String(kpi.n).padStart(5)}  avg=${kpi.absoluteAverage.toFixed(9)} ${kpi.unit.padEnd(5)}  norm=${kpi.normalizedPercent.toFixed(9)} %`,
      ),
      ...report.secondary.map(
        entry =>
          `  secondary ${entry.id.padEnd(24)} signedMean=${entry.signedMeanError.toFixed(6)}  signMismatch=${entry.signDisagreementCount}/${entry.signComparableCount}  p95=${entry.p95AbsoluteError.toFixed(6)}  max=${entry.maxAbsoluteError.toFixed(6)}`,
      ),
      `  signed     signMismatch=${report.signedSummary.signDisagreementCount}/${report.signedSummary.signComparableCount}  maxP95=${report.signedSummary.maxP95AbsoluteError.toFixed(6)}  max=${report.signedSummary.maxAbsoluteError.toFixed(6)}  worst=${report.signedSummary.worstObservation ? `${report.signedSummary.worstObservation.observationId} ${report.signedSummary.worstObservation.signedError.toFixed(6)}` : 'none'}`,
      comparison ? JSON.stringify(comparison, null, 2) : '',
    ]
      .filter(Boolean)
      .join('\n') + '\n',
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
