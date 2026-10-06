import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BUS_ANGLE_DEG_CONSISTENCY_TOLERANCE,
  computePowerFactoryKpis,
  kpiImprovementPercent,
  PF_KPI_IDS,
  scoreKpi,
  scoreKpiSecondary,
  type PowerFactoryNumericRow,
} from '../../src/analysis/validation/pf-kpi';
import { parsePowerFactoryNumericCsv } from '../../src/analysis/validation/pf-kpi-csv';
import type { CalculationResult } from '../../src/domain/results/types';

function result(overrides: Partial<CalculationResult> = {}): CalculationResult {
  return {
    identity: { modelHash: 'h', scenarioHash: '[]', analysisType: 'powerFlow', engine: 'BrowserJsEngine', engineVersion: 'test', optionsHash: '{}' },
    status: 'CONVERGED_FULL_NR',
    converged: true,
    iterations: 1,
    rounds: 1,
    maxMismatchMw: 0,
    elapsedMs: 1,
    buses: [],
    branches: [],
    generators: [],
    diagnostics: {},
    warnings: [],
    quality: { numericalStatus: 'NR_CONVERGED', controlFidelity: 'PARTIAL', referenceValidation: 'NOT_AVAILABLE' },
    ...overrides,
  };
}

test('absolute average uses abs(abs(GA)-abs(PF)) and normalises by sum(abs(PF))', () => {
  const scored = scoreKpi('lineActivePowerMw', [
    { gaValue: 10, pfValue: 8 },
    { gaValue: -5, pfValue: 5 },
    { gaValue: 3, pfValue: -1 },
  ]);
  // errors: |10-8|=2, |-5-5|=0, |3-1|=2 -> sum 4, N 3
  assert.equal(scored.n, 3);
  assert.equal(scored.sumAbsoluteError, 4);
  assert.equal(scored.sumAbsoluteReference, 14);
  assert.equal(scored.absoluteAverage, 4 / 3);
  assert.equal(scored.normalizedPercent, (100 * 4) / 14);
});

test('a pure sign flip is not penalised by the primary KPI but is reported as sign disagreement', () => {
  const observations = [
    { gaValue: -10, pfValue: 10 },
    { gaValue: -4, pfValue: 4 },
  ];
  assert.equal(scoreKpi('busAlignedAngleDeg', observations).sumAbsoluteError, 0);
  const secondary = scoreKpiSecondary('busAlignedAngleDeg', observations);
  assert.equal(secondary.signDisagreementCount, 2);
  assert.equal(secondary.signComparableCount, 2);
  assert.equal(secondary.signedMeanError, -14);
});

test('abs(GA-PF) is not used: same-sign and flipped pairs score identically', () => {
  const sameSign = scoreKpi('transformerActivePowerMw', [{ gaValue: 10, pfValue: 8 }]);
  const flipped = scoreKpi('transformerActivePowerMw', [{ gaValue: -10, pfValue: 8 }]);
  assert.equal(sameSign.sumAbsoluteError, flipped.sumAbsoluteError);
  assert.equal(sameSign.normalizedPercent, flipped.normalizedPercent);
});

test('kpiImprovementPercent is negative for improvement', () => {
  const before = scoreKpi('lineReactivePowerMvar', [{ gaValue: 12, pfValue: 10 }]);
  const after = scoreKpi('lineReactivePowerMvar', [{ gaValue: 9, pfValue: 10 }]);
  assert.equal(before.normalizedPercent, 20);
  assert.equal(after.normalizedPercent, 10);
  assert.equal(kpiImprovementPercent(before, after), -50);
});

test('a zero-error baseline has no defined relative improvement', () => {
  const perfect = scoreKpi('lineReactivePowerMvar', [{ gaValue: 10, pfValue: 10 }]);
  const worse = scoreKpi('lineReactivePowerMvar', [{ gaValue: 12, pfValue: 10 }]);
  assert.equal(kpiImprovementPercent(perfect, worse), null);
});

test('lines and transformers below the nominal-voltage threshold are excluded', () => {
  const rows: PowerFactoryNumericRow[] = [
    { kind: 'line', fid: 'L66', resultAvailable: '1', fromVoltageKv: 66, pFromMw: 10, pToMw: -10, qFromMvar: 1, qToMvar: -1 },
    { kind: 'line', fid: 'L34', resultAvailable: '1', fromVoltageKv: 34.5, pFromMw: 10, pToMw: -10, qFromMvar: 1, qToMvar: -1 },
    { kind: 'transformer', fid: 'T154', resultAvailable: '1', fromVoltageKv: 154, pHvMw: 5, pLvMw: -5, qHvMvar: 2, qLvMvar: -2 },
    { kind: 'transformer', fid: 'T31', resultAvailable: '1', fromVoltageKv: 31.5, pHvMw: 5, pLvMw: -5, qHvMvar: 2, qLvMvar: -2 },
  ];
  const branches = [
    { id: 'L66', name: 'l66', sourceClass: 'ElmLne', from: 'A', to: 'B', siteIds: [], vnKv: 66, pf: 10, qf: 1, pt: -10, qt: -1, ifA: 0, itA: 0, loading: null, pLoss: 0, qLoss: 0 },
    { id: 'L34', name: 'l34', sourceClass: 'ElmLne', from: 'A', to: 'C', siteIds: [], vnKv: 34.5, pf: 10, qf: 1, pt: -10, qt: -1, ifA: 0, itA: 0, loading: null, pLoss: 0, qLoss: 0 },
    { id: 'T154', name: 't154', sourceClass: 'ElmTr2', from: 'A', to: 'D', siteIds: [], vnKv: 154, pf: 5, qf: 2, pt: -5, qt: -2, ifA: 0, itA: 0, loading: null, pLoss: 0, qLoss: 0 },
    { id: 'T31', name: 't31', sourceClass: 'ElmTr2', from: 'A', to: 'E', siteIds: [], vnKv: 31.5, pf: 5, qf: 2, pt: -5, qt: -2, ifA: 0, itA: 0, loading: null, pLoss: 0, qLoss: 0 },
  ];
  const report = computePowerFactoryKpis({ rows, result: result({ branches: branches as CalculationResult['branches'] }) });
  const byId = new Map(report.kpis.map(kpi => [kpi.id, kpi]));
  assert.equal(byId.get('lineActivePowerMw')?.n, 2, 'only the >=66 kV line contributes two terminal observations');
  assert.equal(byId.get('transformerActivePowerMw')?.n, 2, 'only the >=66 kV transformer contributes HV and LV observations');
  assert.equal(report.population.linesBelowThreshold, 1);
  assert.equal(report.population.transformersBelowThreshold, 1);
});

test('bus KPI uses distinct electrical buses at or above the threshold and compares kV', () => {
  const rows: PowerFactoryNumericRow[] = [
    { kind: 'bus', fid: 'B1', resultAvailable: '1', electricalBusKey: 'K1', nominalKv: 154, voltageKv: 153.5, angleDeg: 10 },
    { kind: 'bus', fid: 'B1b', resultAvailable: '1', electricalBusKey: 'K1', nominalKv: 154, voltageKv: 153.5, angleDeg: 10 },
    { kind: 'bus', fid: 'B2', resultAvailable: '1', electricalBusKey: 'K2', nominalKv: 33, voltageKv: 33.1, angleDeg: 5 },
  ];
  const buses = [
    { id: 'K1', name: 'b1', terms: ['K1'], siteIds: [], vnKv: 154, vmPu: 1.0, angleRad: 0, pMw: 0, qMvar: 0, islandId: 'i1' },
  ];
  const report = computePowerFactoryKpis({ rows, result: result({ buses: buses as CalculationResult['buses'] }) });
  const voltage = report.kpis.find(kpi => kpi.id === 'busVoltageKv');
  assert.equal(voltage?.n, 1, 'two physical terminals of one electrical bus are one observation');
  assert.ok(Math.abs((voltage?.sumAbsoluteError ?? 0) - 0.5) < 1e-9);
  assert.equal(report.population.busesBelowThreshold, 1);
});

test('bus groups whose reference values disagree beyond tolerance are not compared', () => {
  const rows: PowerFactoryNumericRow[] = [
    { kind: 'bus', fid: 'B1', resultAvailable: '1', electricalBusKey: 'K1', nominalKv: 154, voltageKv: 153.5, angleDeg: 10 },
    { kind: 'bus', fid: 'B1b', resultAvailable: '1', electricalBusKey: 'K1', nominalKv: 154, voltageKv: 140, angleDeg: 12 },
  ];
  const buses = [{ id: 'K1', name: 'b1', terms: ['K1'], siteIds: [], vnKv: 154, vmPu: 1, angleRad: 0, pMw: 0, qMvar: 0, islandId: 'i1' }];
  const report = computePowerFactoryKpis({ rows, result: result({ buses: buses as CalculationResult['buses'] }) });
  assert.equal(report.kpis.find(kpi => kpi.id === 'busVoltageKv')?.n, 0);
  assert.equal(report.kpis.find(kpi => kpi.id === 'busAlignedAngleDeg')?.n, 0);
  assert.ok(BUS_ANGLE_DEG_CONSISTENCY_TOLERANCE < 1);
});

test('angle alignment rotates each island onto its PowerFactory reference bus', () => {
  const rows: PowerFactoryNumericRow[] = [
    { kind: 'bus', fid: 'R', resultAvailable: '1', electricalBusKey: 'KR', nominalKv: 400, voltageKv: 400, angleDeg: 0, isReferenceBus: '1' },
    { kind: 'bus', fid: 'X', resultAvailable: '1', electricalBusKey: 'KX', nominalKv: 400, voltageKv: 400, angleDeg: 3 },
  ];
  // GA is rotated by +30 deg against the reference bus and by +100 deg elsewhere.
  const buses = [
    { id: 'KR', name: 'ref', terms: ['KR'], siteIds: [], vnKv: 400, vmPu: 1, angleRad: (30 * Math.PI) / 180, pMw: 0, qMvar: 0, islandId: 'i1' },
    { id: 'KX', name: 'x', terms: ['KX'], siteIds: [], vnKv: 400, vmPu: 1, angleRad: (-70 * Math.PI) / 180, pMw: 0, qMvar: 0, islandId: 'i1' },
  ];
  const report = computePowerFactoryKpis({ rows, result: result({ buses: buses as CalculationResult['buses'] }) });
  assert.equal(report.alignment.islandsWithPowerFactoryReferenceBus, 1);
  assert.equal(report.alignment.islandsWithoutPowerFactoryReferenceBus, 0);
  const offset = report.alignment.offsetDeg.find(row => row.islandId === 'i1');
  assert.equal(offset?.source, 'POWERFACTORY_REFERENCE_BUS');
  assert.ok(Math.abs((offset?.offsetDeg ?? 0) + 30) < 1e-9);
  const angle = report.kpis.find(kpi => kpi.id === 'busAlignedAngleDeg');
  assert.equal(angle?.n, 2);
  // Alignment removes only the island reference offset (-30 deg). The reference bus then
  // matches exactly (0) while the other bus keeps its real deviation: |100 - 3| = 97.
  assert.ok(Math.abs((angle?.sumAbsoluteError ?? 0) - 97) < 1e-9);
});

test('islands without a PowerFactory reference bus report the median fallback', () => {
  const rows: PowerFactoryNumericRow[] = [
    { kind: 'bus', fid: 'A', resultAvailable: '1', electricalBusKey: 'KA', nominalKv: 400, voltageKv: 400, angleDeg: 0 },
    { kind: 'bus', fid: 'B', resultAvailable: '1', electricalBusKey: 'KB', nominalKv: 400, voltageKv: 400, angleDeg: 4 },
  ];
  const buses = [
    { id: 'KA', name: 'a', terms: ['KA'], siteIds: [], vnKv: 400, vmPu: 1, angleRad: 0, pMw: 0, qMvar: 0, islandId: 'i1' },
    { id: 'KB', name: 'b', terms: ['KB'], siteIds: [], vnKv: 400, vmPu: 1, angleRad: 0, pMw: 0, qMvar: 0, islandId: 'i1' },
  ];
  const report = computePowerFactoryKpis({ rows, result: result({ buses: buses as CalculationResult['buses'] }) });
  assert.equal(report.alignment.islandsWithoutPowerFactoryReferenceBus, 1);
  assert.equal(report.alignment.offsetDeg[0]?.source, 'MEDIAN_FALLBACK');
});

test('every canonical KPI is produced and the population signature pins comparability', () => {
  const report = computePowerFactoryKpis({ rows: [], result: result() });
  assert.deepEqual(report.kpis.map(kpi => kpi.id), [...PF_KPI_IDS]);
  assert.equal(report.minimumNominalKv, 66);
  assert.ok(report.population.populationSignature.includes('minKv=66'));
});

test('the signed summary exposes what the magnitude-only primary KPI cannot', () => {
  const rows: PowerFactoryNumericRow[] = [
    // A pure sign flip: the primary magnitude KPI scores it as perfect.
    { kind: 'line', fid: 'LFLIP', resultAvailable: '1', fromVoltageKv: 154, pFromMw: 50, qFromMvar: 10, pToMw: -50, qToMvar: -10 },
    // A small magnitude error on the same metric.
    { kind: 'line', fid: 'LOK', resultAvailable: '1', fromVoltageKv: 154, pFromMw: 50, pToMw: -50, qFromMvar: 10, qToMvar: -10 },
  ];
  const branches = [
    // GA has the wrong sign on the flipped line.
    { id: 'LFLIP', name: 'flip', sourceClass: 'ElmLne', from: 'a', to: 'b', siteIds: [], vnKv: 154, pf: -50, qf: 10, pt: 50, qt: -10, ifA: 0, itA: 0, loading: null, pLoss: 0, qLoss: 0 },
    { id: 'LOK', name: 'ok', sourceClass: 'ElmLne', from: 'a', to: 'b', siteIds: [], vnKv: 154, pf: 50, qf: 10, pt: -50, qt: -10, ifA: 0, itA: 0, loading: null, pLoss: 0, qLoss: 0 },
  ];
  const report = computePowerFactoryKpis({ rows, result: result({ branches: branches as CalculationResult['branches'] }) });
  const lineP = report.kpis.find(kpi => kpi.id === 'lineActivePowerMw')!;
  // Primary KPI is unchanged: the sign flip contributes 0.
  assert.equal(lineP.sumAbsoluteError, 0);
  // Signed diagnostics expose it.
  assert.ok(report.signedSummary.signDisagreementCount > 0);
  assert.ok(report.signedSummary.signComparableCount > 0);
  assert.ok(report.signedSummary.maxAbsoluteError > 0);
  assert.equal(report.signedSummary.worstObservation?.observationId, 'line:LFLIP:pFrom');
  assert.ok(Math.abs(report.signedSummary.worstObservation!.signedError) > 0);
});

test('the signed summary reports p95 and max per KPI alongside the primary KPI', () => {
  const report = computePowerFactoryKpis({ rows: [], result: result() });
  assert.equal(report.signedSummary.signDisagreementCount, 0);
  assert.equal(report.signedSummary.maxAbsoluteError, 0);
  assert.equal(report.signedSummary.maxP95AbsoluteError, 0);
  assert.equal(report.signedSummary.worstObservation, null);
  // The secondary per-KPI rows are present for every canonical metric.
  assert.deepEqual(report.secondary.map(entry => entry.id), [...PF_KPI_IDS]);
});

test('the CSV reader handles sep marker, decimal commas and meta rows', () => {
  const csv = ['sep=;', 'kind;fid;nominalKv;voltageKv;resultAvailable;metaKey;metaValue', 'meta;;;;;schemaVersion;PF-GA-BENCHMARK-2.1', 'bus;B1;154,00000000;153,5;1;;', 'line;L1;66,0;;0;;'].join('\n');
  const { rows, meta } = parsePowerFactoryNumericCsv(csv);
  assert.equal(meta.schemaVersion, 'PF-GA-BENCHMARK-2.1');
  assert.equal(rows.length, 2);
  assert.equal(rows[0]?.kind, 'bus');
  assert.equal(rows[0]?.nominalKv, 154);
  assert.equal(rows[0]?.voltageKv, 153.5);
  assert.equal(rows[1]?.resultAvailable, '0');
});