import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateThreePhase, type ScProfile } from '../../src/analysis/short-circuit';
import { adaptShortCircuitSources } from '../../src/importers/powerfactory-benchmark/short-circuit-source';
import { loadBenchmarkModel } from '../../src/importers/powerfactory-benchmark/model';
import { emptyScenario } from '../../src/domain/scenario/overlay';
import { syntheticBenchmarkPair } from '../helpers/benchmark-model';
import { zipSync, strToU8 } from 'fflate';

const near = (a: number | null, b: number, eps = 1e-4) => {
  assert.ok(a !== null && Math.abs(a - b) < eps * Math.max(1, Math.abs(b)), `${a} vs ${b}`);
};

const profile1LG: ScProfile = {
  faultType: '1LG',
  calculateMode: 'MAX',
  voltageFactor: 1.1,
  factorProvenance: 'ANALYTICAL_1LG_VERIFICATION_TEST',
  edition: null,
  rfOhm: 0,
  xfOhm: 0,
  maxFaults: 10,
  timeBudgetMs: 30000,
};

const table = (Attributes: string[], Values: unknown[][]) => ({ Attributes, Values });

test('Synthetic Circuit 1: Grounded YN/d transformer yields analytical 1LG current on HV, blocks ungrounded LV', async () => {
  // 110 kV B0 <--- T1 (YN/d) ---> 10 kV B1
  // ElmVac source at B0: R1=0, X1=10, R2=0, X2=10, R0=0, X0=10
  // Trafo: 110/10 kV, 100 MVA, uk=10%, uk0=10%, YN/d
  const raw = {
    ...syntheticBenchmarkPair().raw,
    ElmTerm: table(
      ['FID', 'loc_name', 'fold_id', 'uknom', 'outserv', 'iUsage'],
      [
        ['SYN-B0', 'Bara 0 (110kV)', 'G0', 110, 0, 0],
        ['SYN-B1', 'Bara 1 (10kV)', 'G1', 10, 0, 0],
      ]
    ),
    StaCubic: table(
      ['FID', 'fold_id', 'obj_id'],
      [
        ['C0', 'SYN-B0', 'TR1'],
        ['C1', 'SYN-B1', 'TR1'],
        ['CX', 'SYN-B0', 'VAC'],
      ]
    ),
    TypLne: table(['FID'], []),
    ElmLne: table(['FID'], []),
    ElmXnet: table(['FID'], []),
    ElmVac: table(
      ['FID', 'loc_name', 'bus1', 'outserv', 'r1', 'x1', 'R0', 'X0', 'R2', 'X2', 'usetp'],
      [['VAC', 'Source 110kV', 'CX', 0, 0, 10, 0, 10, 0, 10, 1]]
    ),
    TypTr2: table(
      ['FID', 'loc_name', 'utrn_h', 'utrn_l', 'strn', 'uktr', 'uk0tr', 'pcutr', 'tr2cn_h', 'tr2cn_l', 'itapch', 'tap_side', 'pfe', 'curmg'],
      [['TYP-YND', 'Trafo YNd', 110, 10, 100, 10, 10, 0, 'YN', 'D', 0, 0, 0, 0]]
    ),
    ElmTr2: table(
      ['FID', 'loc_name', 'fold_id', 'typ_id', 'bushv', 'buslv', 'nntap', 'outserv', 'cneutcon', 're0tr_h', 're0tr_l'],
      [['TR1', 'YNd Trafo', 'G0', 'TYP-YND', 'C0', 'C1', 0, 0, 0, 0, 0]]
    ),
  };

  const loaded = await loadBenchmarkModel(
    new File([zipSync({ 'circuit1.json': strToU8(JSON.stringify(raw)) })], 'circuit1.zip')
  );
  const network = { ...loaded.network, externalGrids: [] };
  const context = adaptShortCircuitSources(raw, network);

  // 1. Fault at B0 (HV, 110 kV)
  const r0 = await calculateThreePhase(network, emptyScenario(), context, ['SYN-B0'], profile1LG);
  assert.equal(r0.faults[0].status, 'CALCULATED_NETWORK_APPROXIMATION');

  // Analytical expectations:
  // Z1 = j10, Z2 = j10
  // Z0 = (j10 * j12.1) / (j10 + j12.1) = j5.475113
  // Ztot = j(10 + 10 + 5.475113) = j25.475113
  // Ik1 = sqrt(3)*1.1*110 / 25.475113 = 8.22678 kA
  near(r0.faults[0].z1Ohm!.im, 10.0);
  near(r0.faults[0].z2Ohm!.im, 10.0);
  near(r0.faults[0].z0Ohm!.im, 5.475113);
  near(r0.faults[0].zkkOhm!.im, 25.475113);
  near(r0.faults[0].ikssKa, 8.226778);
  near(r0.faults[0].skssMva, 1567.43);

  // 2. Fault at B1 (LV, 10 kV, Delta side)
  // Delta winding blocks zero-sequence path to ground -> B1 is ungrounded
  const r1 = await calculateThreePhase(network, emptyScenario(), context, ['SYN-B1'], profile1LG);
  assert.equal(r1.faults[0].status, 'BLOCKED');
  assert.equal(r1.faults[0].ikssKa, null);
  assert.ok(r1.faults[0].reasons.some((r) => r.includes('ISOLATED_ZERO_SEQUENCE_NETWORK')));
});

test('Synthetic Circuit 2: Ungrounded star Y/d transformer is fully ungrounded and blocks 1LG calculation', async () => {
  // 110 kV B0 <--- T1 (Y/d) ---> 10 kV B1
  // Trafo has ungrounded star 'Y' on HV, delta 'D' on LV
  // No neutral grounding anywhere
  const raw = {
    ...syntheticBenchmarkPair().raw,
    ElmTerm: table(
      ['FID', 'loc_name', 'fold_id', 'uknom', 'outserv', 'iUsage'],
      [
        ['SYN-B0', 'Bara 0 (110kV)', 'G0', 110, 0, 0],
        ['SYN-B1', 'Bara 1 (10kV)', 'G1', 10, 0, 0],
      ]
    ),
    StaCubic: table(
      ['FID', 'fold_id', 'obj_id'],
      [
        ['C0', 'SYN-B0', 'TR1'],
        ['C1', 'SYN-B1', 'TR1'],
        ['CX', 'SYN-B0', 'VAC'],
      ]
    ),
    TypLne: table(['FID'], []),
    ElmLne: table(['FID'], []),
    ElmXnet: table(['FID'], []),
    ElmVac: table(
      ['FID', 'loc_name', 'bus1', 'outserv', 'r1', 'x1', 'usetp'],
      [['VAC', 'Source 110kV', 'CX', 0, 0, 10, 1]]
    ),
    TypTr2: table(
      ['FID', 'loc_name', 'utrn_h', 'utrn_l', 'strn', 'uktr', 'uk0tr', 'pcutr', 'tr2cn_h', 'tr2cn_l', 'itapch', 'tap_side', 'pfe', 'curmg'],
      [['TYP-YD', 'Trafo Yd', 110, 10, 100, 10, 10, 0, 'Y', 'D', 0, 0, 0, 0]]
    ),
    ElmTr2: table(
      ['FID', 'loc_name', 'fold_id', 'typ_id', 'bushv', 'buslv', 'nntap', 'outserv', 'cneutcon', 're0tr_h', 're0tr_l'],
      [['TR1', 'Yd Trafo', 'G0', 'TYP-YD', 'C0', 'C1', 0, 0, 0, 0, 0]]
    ),
  };

  const loaded = await loadBenchmarkModel(
    new File([zipSync({ 'circuit2.json': strToU8(JSON.stringify(raw)) })], 'circuit2.zip')
  );
  const network = { ...loaded.network, externalGrids: [] };
  const context = adaptShortCircuitSources(raw, network);

  const r0 = await calculateThreePhase(network, emptyScenario(), context, ['SYN-B0'], profile1LG);
  assert.equal(r0.faults[0].status, 'BLOCKED');
  assert.equal(r0.faults[0].ikssKa, null);
  assert.ok(r0.faults[0].reasons.some((r) => r.includes('ISOLATED_ZERO_SEQUENCE_NETWORK')));

  const r1 = await calculateThreePhase(network, emptyScenario(), context, ['SYN-B1'], profile1LG);
  assert.equal(r1.faults[0].status, 'BLOCKED');
  assert.equal(r1.faults[0].ikssKa, null);
});

test('Synthetic Circuit 3: Through-grounded YN/yn transformer with transmission line matches analytical 1LG', async () => {
  // 110 kV B0 <--- T1 (YN/yn) ---> 35 kV B1 <--- L1 ---> 35 kV B2
  // Source at B0: R1=0.5, X1=5, R2=0.5, X2=5, R0=1.0, X0=10.0
  // Trafo T1 (YNyn): 110/35 kV, 100 MVA, uk=10%, uk0=10%, pcutr=0
  // Line L1: R1=1.0, X1=3.0, R0=3.0, X0=9.0
  const raw = {
    ...syntheticBenchmarkPair().raw,
    ElmTerm: table(
      ['FID', 'loc_name', 'fold_id', 'uknom', 'outserv', 'iUsage'],
      [
        ['SYN-B0', 'Bara 0 (110kV)', 'G0', 110, 0, 0],
        ['SYN-B1', 'Bara 1 (35kV)', 'G1', 35, 0, 0],
        ['SYN-B2', 'Bara 2 (35kV)', 'G1', 35, 0, 0],
      ]
    ),
    StaCubic: table(
      ['FID', 'fold_id', 'obj_id'],
      [
        ['C0', 'SYN-B0', 'TR1'],
        ['C1', 'SYN-B1', 'TR1'],
        ['C_L1A', 'SYN-B1', 'LINE1'],
        ['C_L1B', 'SYN-B2', 'LINE1'],
        ['CX', 'SYN-B0', 'VAC'],
      ]
    ),
    TypLne: table(
      ['FID', 'loc_name', 'rline', 'xline', 'rline0', 'xline0'],
      [['TYP-LINE', '35kV Hat Tipi', 0.1, 0.3, 0.3, 0.9]]
    ),
    ElmLne: table(
      ['FID', 'loc_name', 'fold_id', 'typ_id', 'bus1', 'bus2', 'dline', 'outserv'],
      [['LINE1', '35kV Hat', 'G1', 'TYP-LINE', 'C_L1A', 'C_L1B', 10, 0]]
    ),
    ElmXnet: table(['FID'], []),
    ElmVac: table(
      ['FID', 'loc_name', 'bus1', 'outserv', 'r1', 'x1', 'R0', 'X0', 'R2', 'X2', 'usetp'],
      [['VAC', 'Source 110kV', 'CX', 0, 0.5, 5.0, 1.0, 10.0, 0.5, 5.0, 1]]
    ),
    TypTr2: table(
      ['FID', 'loc_name', 'utrn_h', 'utrn_l', 'strn', 'uktr', 'uk0tr', 'pcutr', 'tr2cn_h', 'tr2cn_l', 'itapch', 'tap_side', 'pfe', 'curmg'],
      [['TYP-YNYN', 'Trafo YNyn', 110, 35, 100, 10, 10, 0, 'YN', 'YN', 0, 0, 0, 0]]
    ),
    ElmTr2: table(
      ['FID', 'loc_name', 'fold_id', 'typ_id', 'bushv', 'buslv', 'nntap', 'outserv', 'cneutcon', 're0tr_h', 're0tr_l'],
      [['TR1', 'YNyn Trafo', 'G0', 'TYP-YNYN', 'C0', 'C1', 0, 0, 0, 0, 0]]
    ),
  };

  const loaded = await loadBenchmarkModel(
    new File([zipSync({ 'circuit3.json': strToU8(JSON.stringify(raw)) })], 'circuit3.zip')
  );
  const network = { ...loaded.network, externalGrids: [] };
  const context = adaptShortCircuitSources(raw, network);

  const r2 = await calculateThreePhase(network, emptyScenario(), context, ['SYN-B2'], profile1LG);
  assert.equal(r2.faults[0].status, 'CALCULATED_NETWORK_APPROXIMATION');

  // Analytical derivations on 35 kV:
  // Z1 = 1.05062 + j4.73120 Ohm
  // Z2 = 1.05062 + j4.73120 Ohm
  // Z0 = 3.10124 + j11.23740 Ohm
  // Ztot = 5.20248 + j20.69979 Ohm -> |Ztot| = 21.34355 Ohm
  // Ik1 = sqrt(3)*1.1*35 / 21.34355 = 3.12431 kA
  // Sk1 = sqrt(3)*35*3.12431 = 189.395 MVA
  near(r2.faults[0].z1Ohm!.re, 1.05062, 1e-3);
  near(r2.faults[0].z1Ohm!.im, 4.73120, 1e-3);
  near(r2.faults[0].z2Ohm!.re, 1.05062, 1e-3);
  near(r2.faults[0].z2Ohm!.im, 4.73120, 1e-3);
  near(r2.faults[0].z0Ohm!.re, 3.10124, 1e-3);
  near(r2.faults[0].z0Ohm!.im, 11.23740, 1e-3);
  near(r2.faults[0].zkkOhm!.re, 5.20248, 1e-3);
  near(r2.faults[0].zkkOhm!.im, 20.69979, 1e-3);
  near(r2.faults[0].ikssKa, 3.124314, 1e-3);
  near(r2.faults[0].skssMva, 189.395, 1e-3);
});
