import test from 'node:test';
import assert from 'node:assert/strict';
import {analysisUiFixture,installLfFixture} from '../helpers/analysis-ui';
import {compactN1Rows,compactScRows,compactLfRows,sortCompactRows,acStatus} from '../../src/features/analysis/compact-rows';
import {runEvidence} from '../../src/features/analysis/run-evidence';
import {selectScMode} from '../../src/domain/results/sc-selection';
import {seedBenchmarkPreflight,type BenchmarkPreflight} from '../../src/domain/benchmark/comparison';

test('660 presentation rows retain independent AC/DC sets, names, missing POST and budget/divergence states',()=>{
 const {ctx}=analysisUiFixture(),rows=compactN1Rows(ctx);assert.equal(rows.length,660);assert.equal(runEvidence(ctx).acCalculated,30);assert.equal(runEvidence(ctx).acAttempted,37);assert.equal(runEvidence(ctx).acVerified,0);assert.equal(runEvidence(ctx).distinctNumerical,298);
 assert.equal(rows[0].loadingSource,'AC');assert.equal(rows[0].loading,120);assert.match(rows[0].overloads![0].name,/CAYIRHAN/);assert.equal(rows[0].missingDetail,'Tam POST ayrıntısı yok');assert.match(rows[28].acLabel!,/Yakınsamadı/);assert.match(rows[35].acLabel!,/Denenmedi · süre/);assert.equal(rows[35].loadingSource,'~DC');assert.equal(rows[400].dcLabel,'Taranmadı');assert.match(rows[400].acLabel!,/Sayısal/);
 assert.equal(acStatus({...ctx.hybridResult!.cases[0],status:'ISLAND_UNSUPPLIED',acSolved:false}),'Beslemesiz ada');assert.equal(acStatus({...ctx.hybridResult!.cases[0],status:'BLOCKED',acSolved:false}),'Bloke');
});
test('SC aliases produce 500 independent rows, diagnostic signed MAX delta and missing MIN PF stays null',()=>{
 const {ctx}=analysisUiFixture();ctx.analysisTab='SC';const rows=compactScRows(ctx);assert.equal(rows.length,500);assert.equal(runEvidence(ctx).physicalTerminals,6278);const matched=rows.find(r=>r.metrics.ikss.delta!==null)!;assert.ok(matched);assert.equal(matched.metrics.ikss.delta,-.99);assert.equal(matched.raw.IEC_VERIFIED,'false');assert.equal(rows.find(r=>r.kv===66)?.kv,66);
 assert.ok(selectScMode(ctx,'MIN'));const min=compactScRows(ctx);assert.ok(min.every(r=>r.metrics.ikss.pf===null&&r.metrics.ikss.delta===null));assert.notEqual(ctx.scResult!.identity.sourceHash,ctx.ytmStudy!.scMax!.identity.sourceHash);
 ctx.filters.areaId='OTHER';assert.equal(compactScRows(ctx).length,0);ctx.filters.areaId='A';assert.ok(selectScMode(ctx,'MAX'));ctx.ytmStudy=null;ctx.studyOptions=undefined;assert.ok(compactScRows(ctx).some(r=>r.metrics.ikss.delta!==null));
});
test('LF retains signed FROM values, unknown rating, kV and the inclusive 66 kV boundary',()=>{
 const {ctx}=analysisUiFixture();ctx.analysisTab='LF';installLfFixture(ctx);const lines=compactLfRows(ctx,'lines');assert.equal(lines[0].metrics.p.ga,-12);assert.equal(lines[0].metrics.q.ga,3);assert.equal(lines[0].metrics.loading.ga,null);assert.equal(lines[0].metrics.p.delta,null);const buses=compactLfRows(ctx,'buses');assert.equal(buses.length,2);assert.equal(buses[0].kv,66);assert.ok(Math.abs(buses[0].metrics.voltage.ga!-67.32)<1e-10);
});
test('sorting is numeric, signed, with null last in both directions and raw export fields retained',()=>{
 const {ctx}=analysisUiFixture(),a=compactN1Rows(ctx).slice(0,3);a[0].loading=2;a[1].loading=100;a[2].loading=null;assert.deepEqual(sortCompactRows(a,'loading',true).map(r=>r.loading),[100,2,null]);assert.deepEqual(sortCompactRows(a,'loading').map(r=>r.loading),[2,100,null]);assert.ok('capacityBasis' in a[0].raw);assert.ok('scenarioHash' in a[0].raw);
});
test('transformer P/Q use the native HV terminal even when HV is the TO endpoint',()=>{
 const {ctx}=analysisUiFixture();installLfFixture(ctx);const t=compactLfRows(ctx,'transformers')[0];assert.equal(t.metrics.p.ga,-9);assert.equal(t.metrics.q.ga,-2);assert.equal(t.kv,154);
});
test('LF presentation retains a signed GA minus PF pair only after the existing identity gate',()=>{
 const {ctx}=analysisUiFixture(),r=installLfFixture(ctx),fid=r.branches[0].id,b=ctx.benchmark!,n=ctx.network!;
 b.groups.LF.tables.GA_Reference_Raw={name:'GA_Reference_Raw',analysis:'LF',fileSha256:'PUBLIC_PRESENTATION_FIXTURE',metadata:{},headers:['kind','fid','sourceClass','pFromMw','qFromMvar'],rows:[['line',fid,'ElmLne',-15,5]],rowNumbers:[2],headerRow:1};
 const metric=(ga:number,pf:number,unit:string)=>({gridAnalyzer:ga,powerFactory:pf,delta:ga-pf,absoluteDelta:Math.abs(ga-pf),deltaPercent:null,unit,comparable:true,semantics:'PUBLIC_PRESENTATION_GATE_FIXTURE'});
 // Seed an already accepted mapping to test presentation, not the independent physical gate.
 const gate={status:'COMPARABLE_PARTIAL',reasons:[],lf:{status:'COMPATIBLE',reference:{records:[{kind:'line',fid,name:fid}]}},comparison:{rows:[{kind:'line',status:'MATCHED',matchMethod:'FID',powerFactoryFid:fid,metrics:{pFromMw:metric(-12,-15,'MW'),qFromMvar:metric(3,5,'Mvar')}}]}} as unknown as BenchmarkPreflight;
 seedBenchmarkPreflight(b,n,r,undefined,gate);const row=compactLfRows(ctx,'lines')[0];assert.deepEqual([row.metrics.p.ga,row.metrics.p.pf,row.metrics.p.delta],[-12,-15,3]);assert.equal(row.metrics.q.delta,-2);assert.equal(row.metrics.loading.delta,null);
});


test('failed LF is never labelled converged or exposed as numerical rows',()=>{
 const {ctx}=analysisUiFixture();ctx.analysisTab='LF';const r=installLfFixture(ctx);r.converged=false;r.status='DIVERGED';
 assert.doesNotMatch(runEvidence(ctx).label,/Sayısal yakınsadı/);assert.match(runEvidence(ctx).label,/yakınsamadı/);assert.equal(runEvidence(ctx).numericalAvailable,0);
 for(const kind of ['lines','transformers','buses'] as const)assert.equal(compactLfRows(ctx,kind).length,0);
});
test('standalone SC filters YTM and TM before electrical dedup and run counters',()=>{
 const {ctx}=analysisUiFixture();ctx.analysisTab='SC';ctx.ytmStudy=null;ctx.studyOptions=undefined;
 const n=ctx.network!;ctx.network={...n,sites:[...n.sites,{...n.sites[0],id:'OTHER',name:'Other TM',areaId:'B'}],buses:n.buses.map(t=>({...t,siteIds:[t.sourceId==='B1'?'STATION':'OTHER']}))};
 ctx.filters.areaId='A';ctx.filters.siteId='STATION';const rows=compactScRows(ctx);assert.equal(rows.length,1);assert.equal(rows[0].fid,'B1');assert.equal(runEvidence(ctx).electricalBuses,1);assert.equal(runEvidence(ctx).physicalTerminals,1);
 ctx.filters.siteId='OTHER';assert.equal(compactScRows(ctx).length,0);assert.equal(runEvidence(ctx).electricalBuses,0);
 ctx.filters.areaId='B';assert.ok(compactScRows(ctx).length>0);assert.ok(compactScRows(ctx).every(r=>r.tm==='Other TM'));
});
