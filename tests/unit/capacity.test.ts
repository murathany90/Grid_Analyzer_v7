import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildLineCapacityMetadata, capacityLimit, capacitySession, loadingFromResult,
  removeManualCapacity, selectedCapacity, selectedLineLoading, setCapacitySeason, setManualCapacity,
} from '../../src/domain/model/capacity.ts';
import type { CalculationResult } from '../../src/domain/results/types.ts';
import { DgsModel, type DgsRawData } from '../../src/importers/dgs/index.ts';
import { mapCanonical } from '../../src/importers/dgs/canonical.ts';

const currentForMva = (mva: number, kv: number): number => mva / (Math.sqrt(3) * kv);

test('DGS section factors select the minimum section and validate the seasonal reference', () => {
  const capacity = buildLineCapacityMetadata({
    id: 'H6432', voltageKv: 154, lineFactor: 1, mainType: { id: 'MAIN', name: 'Ana tip', sline: 2 },
    sections: [
      { id: 'SEC-B', type: { id: 'TB', name: 'Kesit B', sline: currentForMva(270, 154) }, factor: 1, index: 2, factorSourceClass: 'ElmLnesec', factorSourceId: 'SEC-B' },
      { id: 'SEC-A', type: { id: 'TA', name: 'Kesit A', sline: 1.5 }, factor: 0.8, index: 1, factorSourceClass: 'ElmLnesec', factorSourceId: 'SEC-A' },
    ],
  });

  assert.equal(capacity.quality, 'SECTION_LIMITED');
  assert.equal(capacity.limitingSectionId, 'SEC-B');
  assert.ok(Math.abs((capacity.nominalMVA ?? 0) - 270) < 1e-10);
  assert.deepEqual(capacity.sections.map((section) => section.id), ['SEC-A', 'SEC-B']);
  assert.equal(capacity.seasonalReference?.matched, true);
  assert.equal(capacityLimit(capacity, 154, 'summer')?.mva, 270);
  assert.equal(capacityLimit(capacity, 154, 'winter')?.mva, 340);
  assert.equal(capacityLimit(capacity, 154, 'operational'), null);
  assert.equal(capacity.seasonalReference?.operationalCandidateMVA, null);
});

test('seasonal matching rejects voltage and nominal-capacity mismatches', () => {
  const build = (voltageKv: number, currentKA: number) => buildLineCapacityMetadata({
    id: 'H6432', voltageKv, lineFactor: 1, mainType: { id: 'T', sline: currentKA }, sections: [],
  });
  assert.equal(build(400, currentForMva(270, 400)).seasonalReference?.matched, false);
  assert.equal(build(154, currentForMva(272, 154)).seasonalReference?.matched, false);
  assert.equal(build(154, currentForMva(271, 154)).seasonalReference?.matched, true);
});

test('manual seasonal MVA overrides Excel, and result loading uses the greater endpoint current', () => {
  const capacity = buildLineCapacityMetadata({
    id: 'H6432', voltageKv: 154, lineFactor: 1, mainType: { id: 'T', sline: currentForMva(270, 154) }, sections: [],
  });
  const result: CalculationResult = {
    identity: { modelHash: 'model-a', scenarioHash: 'base', analysisType: 'powerFlow', engine: 'test', engineVersion: '1', optionsHash: '{}' },
    status: 'CONVERGED', converged: true, iterations: 5, rounds: 1, maxMismatchMw: 0, elapsedMs: 2,
    buses: [], branches: [{ id: 'H6432', name: 'line', sourceClass: 'ElmLne', from: 'a', to: 'b', siteIds: [], vnKv: 154,
      pf: 100, qf: 10, pt: -99, qt: -10, ifA: 700, itA: 900, loading: 777, pLoss: 1, qLoss: 0 }],
    generators: [], diagnostics: {}, warnings: [],
    quality: { numericalStatus: 'CONVERGED', controlFidelity: 'PARTIAL', referenceValidation: 'NOT_AVAILABLE' },
  };

  const manual = { summer: 300, winter: 400 };
  assert.equal(capacityLimit(capacity, 154, 'summer', manual)?.mva, 300);
  const summerLoading = loadingFromResult('H6432', capacity, 154, 'model-a', result, 'summer', manual);
  assert.ok(summerLoading);
  assert.equal(summerLoading.terminal, 'to');
  assert.equal(summerLoading.currentKA, 0.9);
  assert.ok(Math.abs(summerLoading.percent - 100 * 0.9 / (300 / (Math.sqrt(3) * 154))) < 1e-10);
  assert.notEqual(summerLoading.percent, 777); // snapshot solver rating is not the selected capacity limit.
  assert.equal(loadingFromResult('H6432', capacity, 154, 'another-model', result, 'summer', manual), null);
  assert.equal(loadingFromResult('H6432', capacity, 154, 'model-a', { ...result, converged: false }, 'summer', manual), null);
});

test('capacity sessions isolate model hashes and revision tracks shared UI state', () => {
  const first = capacitySession('capacity-test-model-a');
  const second = capacitySession('capacity-test-model-b');
  const initial = first.revision;
  setCapacitySeason(first.modelHash, 'winter');
  setManualCapacity(first.modelHash, 'L1', { summer: 120, winter: 160 });
  assert.equal(first.revision, initial + 2);
  assert.equal(first.season, 'winter');
  assert.deepEqual(first.manual.get('L1'), { summer: 120, winter: 160 });
  assert.equal(second.manual.has('L1'), false);
  removeManualCapacity(first.modelHash, 'L1');
  assert.equal(first.revision, initial + 3);
});

test('shared selection helpers expose the same manual seasonal limit for map and analysis views', () => {
  const modelHash = 'capacity-helper-model';
  const line = {
    id: 'H6432', vnKv: 154,
    capacity: buildLineCapacityMetadata({ id: 'H6432', voltageKv: 154, lineFactor: 1, mainType: { id: 'T', sline: currentForMva(270, 154) }, sections: [] }),
  };
  setCapacitySeason(modelHash, 'winter');
  setManualCapacity(modelHash, line.id, { summer: 300, winter: 400 });
  assert.equal(selectedCapacity(line, modelHash)?.mva, 400);
  const result: CalculationResult = {
    identity: { modelHash, scenarioHash: 'base', analysisType: 'powerFlow', engine: 'test', engineVersion: '1', optionsHash: '{}' },
    status: 'CONVERGED', converged: true, iterations: 1, rounds: 1, maxMismatchMw: 0, elapsedMs: 0,
    buses: [], branches: [{ id: line.id, name: 'line', sourceClass: 'ElmLne', from: 'a', to: 'b', siteIds: [], vnKv: 154,
      pf: 1, qf: 0, pt: -1, qt: 0, ifA: 1000, itA: 1000, loading: 1, pLoss: 0, qLoss: 0 }],
    generators: [], diagnostics: {}, warnings: [],
    quality: { numericalStatus: 'CONVERGED', controlFidelity: 'PARTIAL', referenceValidation: 'NOT_AVAILABLE' },
  };
  assert.equal(selectedLineLoading(line, modelHash, result)?.capacityMVA, 400);
});

test('missing factors and missing types are surfaced as unsupported capacity provenance', () => {
  const capacity = buildLineCapacityMetadata({
    id: 'L2', voltageKv: 154, lineFactor: null, mainType: null,
    sections: [{ id: 'S2', type: null, factor: null, index: 0, factorSourceClass: 'ElmLnesec', factorSourceId: 'S2' }],
  });
  assert.equal(capacity.quality, 'CAPACITY_UNAVAILABLE');
  assert.equal(capacity.nominalMVA, null);
  assert.ok(capacity.sections[0].unsupportedReasons.length >= 3);
  assert.equal(capacity.sections[0].sourceRefs[0]?.sourceClass, 'ElmLnesec');
});

test('canonical model retains DGS validation issues as user-facing warnings', async () => {
  const raw: DgsRawData = {
    General: { Attributes: ['FID', 'Val'], Values: [['G', 'PowerFactory']] },
    ElmTerm: { Attributes: ['FID', 'loc_name', 'uknom'], Values: [['T1', 'Bara', 154]] },
  };
  const model = await new DgsModel(raw, 'capacity-warning-fixture').build();
  model.addIssue('Kontrollü fixture sorunu', 'ElmTerm', 'T1', 'kaynak satır incelenmeli', 'Uyarı');

  const network = mapCanonical(model, 'warning-model-hash');
  assert.ok(network.warnings.includes('[Uyarı] ElmTerm T1: Kontrollü fixture sorunu — kaynak satır incelenmeli'));
});
