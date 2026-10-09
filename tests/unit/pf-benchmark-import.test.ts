import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { zipSync, strToU8, unzipSync, strFromU8 } from 'fflate';
import { syntheticBenchmark } from '../helpers/benchmark';
import { loadBenchmark } from '../../src/importers/powerfactory-benchmark';
import { inspectArchive, hashBlob } from '../../src/importers/powerfactory-benchmark/archive';
import { readWorkbook } from '../../src/importers/powerfactory-benchmark/workbook';
import { readCell } from '../../src/domain/benchmark/types';

test('manifest classified LF/N1/SC with title rows, sparse cells and numeric zero',async()=>{
  const result=await loadBenchmark(syntheticBenchmark()),table=result.groups.LF.tables.GA_Reference_Raw;
  assert.deepEqual(Object.keys(result.groups),['LF','N1','SC']);assert.equal(table.rows.length,1);assert.equal(table.headerRow,3);
  const zero=readCell(table,0,'voltagePu','pu'),missing=readCell(table,0,'angleDeg','deg');
  assert.equal(zero.value,0);assert.equal(zero.availability,'RECORDED_NUMERIC_ZERO');assert.equal(missing.value,null);assert.equal(missing.availability,'NOT_RECORDED');assert.equal(zero.source.row,4);assert.equal(zero.source.column,'U');
});
test('workbook integrity and mixed identities fail atomically',async()=>{
  await assert.rejects(loadBenchmark(syntheticBenchmark(undefined,f=>f['LF.xlsx'][70]^=1)),/CRC|HASH/);
  await assert.rejects(loadBenchmark(syntheticBenchmark(undefined,f=>{const raw=JSON.parse(strFromU8(f['N1.json']));raw.identity.studyCase='WRONG';f['N1.json']=strToU8(JSON.stringify(raw));})),/IDENTITY/);
  await assert.rejects(loadBenchmark(syntheticBenchmark(undefined,f=>delete f['SC.log'])),/exactly/);
});
test('archive rejects traversal, case aliases, malformed ZIP and CRC corruption',async()=>{
  for(const names of [['../a.json'],['A.json','a.json'],['C:/a.json']])await assert.rejects(inspectArchive(new Blob([zipSync(Object.fromEntries(names.map(n=>[n,strToU8('{}')])))])),/UNSAFE_ARCHIVE/);
  await assert.rejects(inspectArchive(new Blob(['not zip'])),/UNSAFE_ARCHIVE/);
  const bytes=zipSync({'x.json':strToU8('hello')},{level:0});bytes[36]^=1;const a=await inspectArchive(new Blob([bytes]));await assert.rejects(a.file(a.entries[0]),/CRC/);
});
test('streaming hash agrees with crypto and cancellation interrupts reading',async()=>{
  const bytes=strToU8('Türkçe '.repeat(30000));assert.equal(await hashBlob(new Blob([bytes])),createHash('sha256').update(bytes).digest('hex'));
  const signal=AbortSignal.abort();await assert.rejects(loadBenchmark(syntheticBenchmark(),undefined,signal),/CANCELLED/);
});
test('OOXML shared strings, inline text, cached formulas, booleans and date styles',async()=>{
  const files={
    'xl/workbook.xml':strToU8('<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Test_Raw" r:id="r1"/></sheets></workbook>'),
    'xl/_rels/workbook.xml.rels':strToU8('<Relationships><Relationship Id="r1" Target="worksheets/a.xml"/></Relationships>'),
    'xl/sharedStrings.xml':strToU8('<sst><si><t>value</t></si><si><r><t>Türk</t></r><r><t>çe</t></r></si></sst>'),
    'xl/styles.xml':strToU8('<styleSheet><cellXfs><xf numFmtId="14"/></cellXfs></styleSheet>'),
    'xl/worksheets/a.xml':strToU8('<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="inlineStr"><is><t>date</t></is></c></row><row r="3"><c r="A3"><f>1-1</f><v>0</v></c><c r="B3" s="0"><v>25569</v></c></row><row r="4"><c r="A4" t="s"><v>1</v></c></row></sheetData></worksheet>')
  };
  const table=(await readWorkbook(new File([zipSync(files)],'test.xlsx'),'LF','synthetic',{Test_Raw:['value','date']})).Test_Raw;
  assert.deepEqual(table.rows,[[0,'1970-01-01T00:00:00.000Z'],['Türkçe',null]]);assert.deepEqual(table.rowNumbers,[3,4]);
  files['xl/sharedStrings.xml']=strToU8('<!DOCTYPE sst [<!ENTITY x SYSTEM "file:///secret">]><sst/>');await assert.rejects(readWorkbook(new File([zipSync(files)],'test.xlsx'),'LF','x',{Test_Raw:['value','date']}),/DTD/);
});
test('missing Raw header is rejected without a partial package',async()=>{
  const file=syntheticBenchmark(undefined,files=>{const book=unzipSync(files['LF.xlsx']);for(const k of Object.keys(book))if(k.startsWith('xl/worksheets/'))book[k]=strToU8(strFromU8(book[k]).replace('<t xml:space="preserve">angleDeg</t>','<t>wrong</t>'));files['LF.xlsx']=zipSync(book);const manifest=JSON.parse(strFromU8(files['LF.json']));manifest.workbook.sizeBytes=files['LF.xlsx'].length;manifest.workbook.sha256=createHash('sha256').update(files['LF.xlsx']).digest('hex');files['LF.json']=strToU8(JSON.stringify(manifest));});
  await assert.rejects(loadBenchmark(file),/SOURCE_SCHEMA_MISMATCH/);
});
