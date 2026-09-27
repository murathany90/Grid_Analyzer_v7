import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';

import { catalogPage } from '../../src/importers/dgs/catalog.ts';
import { DgsModel, type DgsRawData } from '../../src/importers/dgs/index.ts';

function fixture(): DgsRawData {
  const rows = Array.from({ length: 15 }, (_, index) => [
    `B${String(index + 1).padStart(2, '0')}`,
    `Fider ${String(index + 1).padStart(2, '0')}`,
    'G1',
    { marker: `raw-${index + 1}` },
  ]);
  return {
    ElmNet: { Attributes: ['FID', 'loc_name'], Values: [['N1', 'Şebeke']] },
    ElmSite: { Attributes: ['FID', 'loc_name', 'fold_id', 'sType'], Values: [['S1', 'Ankara TM', 'N1', 'GERCEK']] },
    ElmSubstat: { Attributes: ['FID', 'loc_name', 'fold_id', 'GPSlat', 'GPSlon'], Values: [['G1', '154 kV', 'S1', 39.9, 32.8]] },
    ElmBay: { Attributes: ['FID', 'loc_name', 'fold_id', 'details'], Values: rows },
  };
}

test('catalog pagination reuses one filtered and sorted index across page sizes', async () => {
  const model = await new DgsModel(fixture(), 'catalog fixture').build();
  const originalResolve = model.resolveSiteByClass.bind(model);
  let siteLookups = 0;
  model.resolveSiteByClass = (...args) => {
    siteLookups += 1;
    return originalResolve(...args);
  };

  const first = catalogPage(model, {
    className: 'ElmBay', siteId: 'S1', areaId: 'N1', search: 'fider', sort: 'name', page: 0, pageSize: 2,
  });
  const afterFirstPage = siteLookups;
  const second = catalogPage(model, {
    className: 'ElmBay', siteId: 'S1', areaId: 'N1', search: ' FİDER ', sort: 'name', page: 1, pageSize: 3,
  });

  assert.equal(first.total, 15);
  assert.equal(first.rows.length, 2);
  assert.deepEqual(first.rows.map(row => row.name), ['Fider 01', 'Fider 02']);
  assert.deepEqual(second.rows.map(row => row.name), ['Fider 04', 'Fider 05', 'Fider 06']);
  // The changed page and page size do not trigger a second full-table scan.
  assert.equal(siteLookups - afterFirstPage, second.rows.length);
  assert.deepEqual(first.rows[0].siteIds, ['S1']);
  assert.equal(first.attributes.includes('details'), true);
});

test('catalog rows detach nested DGS attribute values from immutable source tables', async () => {
  const model = await new DgsModel(fixture(), 'catalog fixture').build();
  const page = catalogPage(model, { className: 'ElmBay', pageSize: 1 });
  const details = page.rows[0].attributes.details as { marker: string };

  details.marker = 'changed by a view';
  assert.equal(model.value('ElmBay', 0, 'details') && (model.value('ElmBay', 0, 'details') as { marker: string }).marker, 'raw-1');
  assert.equal((catalogPage(model, { className: 'ElmBay', pageSize: 1 }).rows[0].attributes.details as { marker: string }).marker, 'raw-1');
});

test('site and voltage catalog scopes include either branch endpoint and the site itself',async()=>{
  const raw=JSON.parse(await readFile(new URL('../fixtures/small-dgs.json',import.meta.url),'utf8'));
  raw.StaCubic.Values.find((r:string[])=>r[0]==='C_L400-01_B')[2]='T154-PV';
  const model=await new DgsModel(raw,'two-endpoint fixture').build();
  assert.equal(catalogPage(model,{className:'ElmLne',siteId:'S154',search:'L400-01'}).total,1);
  assert.equal(catalogPage(model,{className:'ElmTr2',siteId:'S154'}).total,1);
  assert.equal(catalogPage(model,{className:'ElmTr2',siteId:'S400'}).total,1);
  assert.deepEqual(catalogPage(model,{className:'ElmSite',siteId:'S154',voltage:154}).rows[0].siteIds,['S154']);
});
