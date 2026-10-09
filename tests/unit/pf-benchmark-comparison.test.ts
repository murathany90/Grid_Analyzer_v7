import test from 'node:test';
import assert from 'node:assert/strict';
import { syntheticBenchmark } from '../helpers/benchmark';
import { loadBenchmark } from '../../src/importers/powerfactory-benchmark';
import { metricRows,metricStatistics,preflightBenchmark } from '../../src/domain/benchmark/comparison';
import { benchmarkCsv,benchmarkWorkbook } from '../../src/features/comparison/export';
import { unzipSync,strFromU8 } from 'fflate';
import { auditShortCircuitReadiness } from '../../src/importers/powerfactory-benchmark/readiness';

test('PF only keeps zero and missing distinct, with null differences and empty statistics',async()=>{
  const b=await loadBenchmark(syntheticBenchmark()),gate=preflightBenchmark(b,null,null),rows=metricRows(b.groups.LF.tables.GA_Reference_Raw,gate);
  assert.equal(rows.find(r=>r.metric==='voltagePu')!.pf.value,0);assert.ok(rows.every(r=>r.ga===null&&r.delta===null&&r.deltaPercent===null));assert.ok(metricStatistics(rows).every(s=>s.mae===null&&s.matched===0));
  assert.equal(preflightBenchmark(b,{studyCase:'different'} as never,null).status,'BLOCKED');
  const sc=metricRows(b.groups.SC.tables.SC_BusResults_Raw,gate);assert.ok(sc.every(r=>r.delta===null));assert.ok(sc.some(r=>r.status==='PF_REFERENCE_ONLY'));
});
test('exports keep numeric zeros, nulls, provenance and formula injection as text',async()=>{
  const b=await loadBenchmark(syntheticBenchmark()),rows=metricRows(b.groups.LF.tables.GA_Reference_Raw,preflightBenchmark(b,null,null));rows[0].name='=HYPERLINK("attack")';
  const csv=benchmarkCsv(rows);assert.ok(csv.includes("'=HYPERLINK"));assert.ok(csv.includes('"0"'));assert.equal(JSON.parse(JSON.stringify(rows))[0].delta,null);
  const workbook=unzipSync(benchmarkWorkbook(rows)),xml=strFromU8(workbook['xl/worksheets/sheet1.xml']);assert.ok(!xml.includes('<f>'));assert.ok(xml.includes('HYPERLINK'));assert.ok(xml.includes('<v>0</v>'));
});
test('readiness excludes sentinel, missing sequence, converter and absent source model',()=>{
  const raw={TypLne:{Attributes:['FID','rline','xline'],Values:[['SYN-LINE',1,2]]},ElmXnet:{Attributes:['FID','ikss','rntxn','bus1'],Values:[['SYN-X',999999,.1,'B']]},ElmGenStat:{Attributes:['FID','bus1'],Values:[['SYN-G','B']]}};
  const r=auditShortCircuitReadiness(raw);assert.equal(r.status,'NOT_COMPUTABLE');assert.equal(r.edition,null);assert.equal(r.rows[0].status,'MISSING_ZERO_SEQUENCE');assert.equal(r.rows[1].status,'INVALID_SOURCE');assert.equal(r.rows[2].status,'MISSING_SOURCE_MODEL');
});
