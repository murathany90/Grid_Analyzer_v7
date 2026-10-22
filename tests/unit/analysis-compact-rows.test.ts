import test from 'node:test';
import assert from 'node:assert/strict';
import {analysisUiFixture,installLfFixture} from '../helpers/analysis-ui';
import {compactN1Rows,compactScRows,compactLfRows,sortCompactRows,acStatus} from '../../src/features/analysis/compact-rows';
import {runEvidence} from '../../src/features/analysis/run-evidence';
import {selectScMode} from '../../src/domain/results/sc-selection';

test('660 presentation rows retain independent AC/DC sets, names, missing POST and budget/divergence states',()=>{
 const {ctx}=analysisUiFixture(),rows=compactN1Rows(ctx);assert.equal(rows.length,660);assert.equal(runEvidence(ctx).acCalculated,30);assert.equal(runEvidence(ctx).acAttempted,37);assert.equal(runEvidence(ctx).acVerified,0);assert.equal(runEvidence(ctx).distinctNumerical,298);
 assert.equal(rows[0].loadingSource,'AC');assert.equal(rows[0].loading,120);assert.match(rows[0].overloads![0].name,/CAYIRHAN/);assert.equal(rows[0].missingDetail,'Tam POST ayrıntısı yok');assert.match(rows[28].acLabel!,/Yakınsamadı/);assert.match(rows[35].acLabel!,/Denenmedi · süre/);assert.equal(rows[35].loadingSource,'~DC');assert.equal(rows[400].dcLabel,'Taranmadı');assert.match(rows[400].acLabel!,/Sayısal/);
 assert.equal(acStatus({...ctx.hybridResult!.cases[0],status:'ISLAND_UNSUPPLIED',acSolved:false}),'Beslemesiz ada');assert.equal(acStatus({...ctx.hybridResult!.cases[0],status:'BLOCKED',acSolved:false}),'Bloke');
});
test('SC aliases produce 500 independent rows, diagnostic signed MAX delta and missing MIN PF stays null',()=>{
 const {ctx}=analysisUiFixture();ctx.analysisTab='SC';const rows=compactScRows(ctx);assert.equal(rows.length,500);assert.equal(runEvidence(ctx).physicalTerminals,6278);const matched=rows.find(r=>r.metrics.ikss.delta!==null)!;assert.ok(matched);assert.equal(matched.metrics.ikss.delta,-.99);assert.equal(matched.raw.IEC_VERIFIED,'false');assert.equal(rows.find(r=>r.kv===66)?.kv,66);
 assert.ok(selectScMode(ctx,'MIN'));const min=compactScRows(ctx);assert.ok(min.every(r=>r.metrics.ikss.pf===null&&r.metrics.ikss.delta===null));assert.notEqual(ctx.scResult!.identity.sourceHash,ctx.ytmStudy!.scMax!.identity.sourceHash);
 ctx.filters.areaId='OTHER';assert.equal(compactScRows(ctx).length,0);
});
test('LF retains signed FROM values, unknown rating, kV and the inclusive 66 kV boundary',()=>{
 const {ctx}=analysisUiFixture();ctx.analysisTab='LF';installLfFixture(ctx);const lines=compactLfRows(ctx,'lines');assert.equal(lines[0].metrics.p.ga,-12);assert.equal(lines[0].metrics.q.ga,3);assert.equal(lines[0].metrics.loading.ga,null);assert.equal(lines[0].metrics.p.delta,null);const buses=compactLfRows(ctx,'buses');assert.equal(buses.length,2);assert.equal(buses[0].kv,66);assert.ok(Math.abs(buses[0].metrics.voltage.ga!-67.32)<1e-10);
});
test('sorting is numeric, signed, with null last in both directions and raw export fields retained',()=>{
 const {ctx}=analysisUiFixture(),a=compactN1Rows(ctx).slice(0,3);a[0].loading=2;a[1].loading=100;a[2].loading=null;assert.deepEqual(sortCompactRows(a,'loading',true).map(r=>r.loading),[100,2,null]);assert.deepEqual(sortCompactRows(a,'loading').map(r=>r.loading),[2,100,null]);assert.ok('capacityBasis' in a[0].raw);assert.ok('scenarioHash' in a[0].raw);
});
test('transformer P/Q use the native HV terminal even when HV is the TO endpoint',()=>{
 const {ctx}=analysisUiFixture(),n=ctx.network!,r=installLfFixture(ctx);n.transformers=[{...n.lines[0],id:'T0',sourceId:'T0',sourceClass:'ElmTr2',from:'B0',to:'B1',vnKv:154,lvKv:66,rPu:.01,xPu:.1,tap:1,phase:0,ratingMva:100,tapPosition:0,gPu:0,bPu:0}];r.branches.push({...r.branches[0],id:'T0',sourceClass:'ElmTr2',pf:10,qf:3,pt:-9,qt:-2});const t=compactLfRows(ctx,'transformers')[0];assert.equal(t.metrics.p.ga,-9);assert.equal(t.metrics.q.ga,-2);assert.equal(t.kv,154);
});
