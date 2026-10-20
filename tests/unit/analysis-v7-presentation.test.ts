import test from 'node:test';
import assert from 'node:assert/strict';
import {compactStudyLabel} from '../../src/ui/components/study-labels';
import {scAuditFixture} from '../helpers/study-audit';
import {studyResultRows,queryStudyRows} from '../../src/features/analysis/study-result-rows';
import {workspaceMapSelection} from '../../src/domain/results/workspace';
import {studyEvidence} from '../../src/features/analysis/study-evidence';
import {metricRows,metricStatistics,preflightBenchmark} from '../../src/domain/benchmark/comparison';

test('common filters and multiple sorting preserve bounded rows, metadata, zero and null',()=>{
  assert.equal(compactStudyLabel('NOT_RUN'),'Çalıştırılmadı');assert.equal(compactStudyLabel('SC_BATCH_BLOCKED'),'Bloke');assert.equal(compactStudyLabel('MANUAL_FULL_AC · PARTIAL_SOLUTION'),'Kısmi');assert.equal(compactStudyLabel('PARTIAL_SOLUTION · ISLAND_UNSUPPLIED'),'Beslenmiyor');
  const {ctx,fault,result}=scAuditFixture(70);ctx.scResult=result([fault(0,'CALCULATED_NETWORK_APPROXIMATION'),fault(2,'CALCULATED_NETWORK_APPROXIMATION')]);
  const rows=studyResultRows(ctx,workspaceMapSelection(ctx)).rows;assert.equal(rows.length,70);assert.equal(rows.find(r=>r.fid==='B0')!.ikss,0);assert.equal(rows.find(r=>r.fid==='B1')!.ikss,null);assert.equal(rows[0].ytm,'Test YTM');
  const q=queryStudyRows(rows,{ytm:'Test YTM',tm:'Test TM',nominal:100,sort:'status',descending:false,secondary:[{key:'ikss',descending:true}],page:0});assert.equal(q.visible.length,50);assert.equal(q.filtered.length,70);assert.equal(q.pages,2);assert.equal(q.filtered.filter(r=>r.status==='CALCULATED_NETWORK_APPROXIMATION')[0].ikss,2);
  assert.equal(queryStudyRows(rows,{ytm:'UNKNOWN',sort:'record',descending:false,page:20}).visible.length,0);
});
test('method and numerical state stay independent and model/scenario changes expose stale',()=>{
  const {ctx,fault,result}=scAuditFixture();ctx.analysisTab='SC';ctx.scResult=result([fault(2,'CALCULATED_NETWORK_APPROXIMATION')]);
  assert.equal(studyEvidence(ctx).numerical,'ENGINE_CALCULATED');assert.equal(studyEvidence(ctx).method,'NETWORK_APPROXIMATION');assert.equal(studyEvidence(ctx).pf,'EXPLORATORY_ONLY');
  ctx.scResult.identity.modelHash='OLD';assert.equal(studyEvidence(ctx).numerical,'STALE_RESULT');ctx.scResult=null;assert.equal(studyEvidence(ctx).numerical,'NOT_CALCULATED');
});
test('certified statistics retain all denominators and never use exploratory or non-finite errors',()=>{
  const {ctx,benchmark,table}=scAuditFixture(),gate=preflightBenchmark(benchmark,ctx.network,null),raw=metricRows(table,gate,'ikssKa'),base=raw[0];
  const rows=[{...base,ga:5,delta:1,identityMatched:true},{...base,fid:'SECOND',ga:1,delta:-3,identityMatched:true},{...base,fid:'DIAGNOSTIC',ga:100,delta:null,diagnosticDelta:94,identityMatched:true},{...base,fid:'INVALID',ga:100,delta:NaN}],s=metricStatistics(rows)[0];
  assert.equal(s.nTotal,4);assert.equal(s.nMatched,3);assert.equal(s.nComparable,2);assert.equal(s.nMethodComparable,2);assert.equal(s.bias,-1);assert.equal(s.mae,2);assert.equal(s.median,2);assert.equal(s.rmse,Math.sqrt(5));assert.equal(s.worstFid,'SECOND');
  const blocked=metricStatistics(raw)[0];assert.equal(blocked.nComparable,0);assert.equal(blocked.mae,null);assert.equal(blocked.bias,null);assert.equal(blocked.median,null);
});
