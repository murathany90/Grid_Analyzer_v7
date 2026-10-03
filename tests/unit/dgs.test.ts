import assert from 'node:assert/strict';
import test from 'node:test';

import { DgsModel, parseDgs, type DgsRawData } from '../../src/importers/dgs/index.ts';

function table(attributes: string[], values: unknown[][]) {
  return { Attributes: attributes, Values: values };
}

function fixture(): DgsRawData {
  return {
    General: table(['FID', 'Val'], [['GENERAL', 'PowerFactory 2026']]),
    SetTime: table(['FID', 'cDate', 'cTime'], [['TIME', '20260923', '120000']]),
    IntCase: table(['FID', 'loc_name'], [['CASE', 'Örnek Senaryo']]),
    ElmNet: table(['FID', 'loc_name'], [['N1', 'Ulusal Şebeke']]),
    ElmSite: table(['FID', 'loc_name', 'fold_id', 'sType'], [['S1', 'Ankara TM', 'N1', 'GERCEK']]),
    ElmSubstat: table(['FID', 'loc_name', 'fold_id', 'GPSlat', 'GPSlon'], [['G1', '154 kV Bara', 'S1', 39.9, 32.8]]),
    ElmBay: table(['FID', 'loc_name', 'fold_id', 'details'], [['B1', 'Fider 1', 'G1', { nested: ['source'] }]]),
    ElmTerm: table(['FID', 'loc_name', 'fold_id', 'uknom'], [['T1', 'Bara 1', 'G1', 154]]),
    StaCubic: table(['FID', 'loc_name', 'fold_id', 'obj_id'], [
      ['C1', 'Hücre 1', 'B1', 'L1'],
      ['C2', 'Hücre 2', 'B1', 'L1'],
    ]),
    TypLne: table(['FID', 'uline'], [['TL1', 154]]),
    ElmLne: table(
      ['FID', 'loc_name', 'typ_id', 'bus1', 'bus2', 'GPScoords:MATRIX'],
      [['L1', 'Ankara bağlantısı', 'TL1', 'C1', 'C2', 'Matrix_route']]),
    Matrix: table(['FID', 'MatRow', 'MatColumn', 'Val'], [
      ['Matrix_route', 0, 0, 39.91],
      ['Matrix_route', 0, 1, 32.81],
      ['Matrix_route', 1, 0, 40.02],
      ['Matrix_route', 1, 1, 32.92],
    ]),
    ElmTr2: table(['FID', 'loc_name', 'fold_id'], [['TR1', 'Trafo 1', 'G1']]),
    ComLdf: table(['FID'], [['LDF']]),
  };
}

test('build indexes source tables and derives station, line, and Matrix data', async () => {
  const model = await new DgsModel(fixture(), 'fixture.dgs', 512).build();

  assert.equal(model.name, 'fixture.dgs');
  assert.equal(model.size, 512);
  assert.equal(model.version, 'PowerFactory 2026');
  assert.equal(model.date, '23.09.2026');
  assert.equal(model.time, '12:00');
  assert.equal(model.scenario, 'Örnek Senaryo');
  assert.equal(model.attrAt('ElmSite', 'loc_name'), 1);
  assert.equal(model.value('ElmTerm', 0, 'uknom'), 154);
  assert.equal(model.get('ElmSite', 'S1')?.loc_name, 'Ankara TM');

  const site = model.siteById('S1');
  assert.ok(site);
  assert.equal(site.ytm, 'Ulusal Şebeke');
  assert.equal(site.lat, 39.9);
  assert.equal(site.lon, 32.8);
  assert.equal(site.bayCount, 1);
  assert.equal(site.transformerCount, 1);
  assert.equal(site.voltageList, '154');
  assert.equal(model.siteFromParent('T1'), 'S1');
  assert.equal(model.siteFromCub('C1'), 'S1');
  assert.equal(model.resolveSiteByClass('ElmBay', 'B1'), 'S1');

  const line = model.lineById('L1');
  assert.ok(line);
  assert.equal(line.stationA, 'S1');
  assert.equal(line.stationB, 'S1');
  assert.equal(line.voltage, 154);
  assert.equal(line.geoStatus, 'Model güzergâhı');
  assert.deepEqual(line.coords, [[39.91, 32.81], [40.02, 32.92]]);
  assert.equal(model.getEquipmentForSite('S1', 'ElmTr2')[0]?.FID, 'TR1');
  assert.equal(model.getEquipmentForSite('S1', 'ElmLne').length, 1);

  assert.deepEqual(model.stats, {
    sites: 1,
    real: 1,
    virtual: 0,
    lines: 1,
    geo: 1,
    fallback: 0,
    tr: 1,
    bay: 1,
    unit: 0,
    load: 0,
    rows: 18,
  });
});

test('row and get return detached records while tables keep columnar source values', async () => {
  const raw = fixture();
  const model = await new DgsModel(raw, 'fixture').build();

  const row = model.row('ElmSite', 0);
  assert.ok(row);
  row.loc_name = 'UI edit';
  assert.equal(model.get('ElmSite', 'S1')?.loc_name, 'Ankara TM');
  assert.equal(model.value('ElmSite', 0, 'loc_name'), 'Ankara TM');
  assert.equal(model.t('ElmSite')?.Values[0][1], 'Ankara TM');

  const found = model.get('ElmSite', 'S1');
  assert.ok(found);
  found.loc_name = 'another edit';
  assert.equal(model.row('ElmSite', 0)?.loc_name, 'Ankara TM');

  const nestedRow = model.row('ElmBay', 0);
  assert.ok(nestedRow);
  (nestedRow.details as { nested: string[] }).nested[0] = 'changed in view';
  assert.deepEqual(model.value('ElmBay', 0, 'details'), { nested: ['source'] });
  const nestedValue = model.value('ElmBay', 0, 'details') as { nested: string[] };
  nestedValue.nested.push('detached');
  assert.deepEqual(model.t('ElmBay')?.Values[0][3], { nested: ['source'] });
});

test('validated raw DGS source tables and nested cells are frozen in place', async () => {
  const raw = fixture();
  const model = await new DgsModel(raw, 'fixture').build();
  const sourceTable = model.t('ElmBay');
  const sourceRow = sourceTable?.Values[0];
  const nested = sourceRow?.[3] as { nested: readonly string[] };

  assert.equal(Object.isFrozen(model.raw), true);
  assert.equal(Object.isFrozen(sourceTable), true);
  assert.equal(Object.isFrozen(sourceTable?.Attributes), true);
  assert.equal(Object.isFrozen(sourceTable?.Values), true);
  assert.equal(Object.isFrozen(sourceRow), true);
  assert.equal(Object.isFrozen(nested), true);
  assert.equal(Object.isFrozen(nested.nested), true);
  assert.equal(Reflect.set(sourceRow as unknown as object, '1', 'mutated'), false);
  assert.equal(Reflect.set(nested, 'nested', []), false);
  assert.equal(model.value('ElmBay', 0, 'details') && (model.value('ElmBay', 0, 'details') as { nested: string[] }).nested[0], 'source');
});

test('parseDgs parses and builds a model, rejecting a non-object root', async () => {
  const model = await parseDgs(JSON.stringify(fixture()), 'parsed.dgs');
  assert.ok(model instanceof DgsModel);
  assert.equal(model.siteById('S1')?.loc_name, 'Ankara TM');
  assert.equal(model.lineById('L1')?.coords?.length, 2);

  await assert.rejects(() => parseDgs('[]'), /kök değeri bir nesne/);
  await assert.rejects(() => parseDgs('{'), SyntaxError);
});

test('duplicate FIDs are diagnosed directly while duplicate loc_name values remain presentation-only',async()=>{
 const raw={...JSON.parse(JSON.stringify(fixture())) as DgsRawData,ElmTerm:table(['FID','loc_name','fold_id','uknom'],[['T1','Same bus name','G1',154],['T2','Same bus name','G1',154],['T1','Another name','G1',154]])};
 const model=await new DgsModel(raw,'duplicate-fixture').build();
 assert.ok(model.issues.some(issue=>issue.kind==='Tekrarlı FID'&&issue.cls==='ElmTerm'&&issue.fid==='T1'));
 assert.ok(!model.issues.some(issue=>issue.kind==='Tekrarlı FID'&&issue.fid==='T2'));
});
