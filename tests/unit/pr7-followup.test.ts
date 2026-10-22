import test from 'node:test';
import assert from 'node:assert/strict';
import {syntheticBenchmarkPair} from '../helpers/benchmark-model';
import {acNetwork} from '../helpers/ac-network';
import {loadBenchmark} from '../../src/importers/powerfactory-benchmark';
import {loadBenchmarkModel} from '../../src/importers/powerfactory-benchmark/model';
import {adaptShortCircuitSources} from '../../src/importers/powerfactory-benchmark/short-circuit-source';
import {calculateThreePhase} from '../../src/analysis/short-circuit';
import {engineeringScProfile} from '../../src/analysis/short-circuit/engineering-profile';
import {auditScPartition,auditScPartitionSubset} from '../../src/domain/benchmark/sc-partition';
import {ytmReferenceSummary,ytmN1ReferenceRows} from '../../src/analysis/ytm-study/export';
import type {YtmStudyResult} from '../../src/analysis/ytm-study';
import {runHybridN1} from '../../src/analysis/contingency-hybrid';
import {emptyScenario} from '../../src/domain/scenario/overlay';
test('missing machine R and X assumptions are independent and never replace invalid supplied values',async()=>{
 const p=syntheticBenchmarkPair(),n=(await loadBenchmarkModel(p.model)).network;
 const raw={...p.raw,ElmXnet:undefined,ElmSym:{Attributes:['FID','bus1','outserv','typ_id','ngnum'],Values:[['G','SYN-CX',0,'T',2]]},TypSym:{Attributes:['FID','rstr','xdss','ugn','sgn'],Values:[['T',0,'',100,100]]}};
 const x=adaptShortCircuitSources(raw,n,undefined,{missingMachineXdssPu:.2,provenance:'X_ONLY'}).sources[0];assert.equal(x.rOhm,0);assert.equal(x.xOhm,10);assert.equal(x.reason,'');
 raw.TypSym.Values=[['T','',.3,100,100]];const r=adaptShortCircuitSources(raw,n,undefined,{missingMachineRPu:.01,provenance:'R_ONLY'}).sources[0];assert.equal(r.rOhm,.5);assert.equal(r.xOhm,15);
 raw.TypSym.Values=[['T',-.1,'',100,100]];assert.match(adaptShortCircuitSources(raw,n,undefined,{missingMachineXdssPu:.2,missingMachineRPu:.01,provenance:'EXPLICIT'}).sources[0].reason,/INVALID_UNIT/);
});
test('subset comparison tolerates unexported terminals but rejects split partitions and conflicts',async()=>{
 const p=syntheticBenchmarkPair(true),b=await loadBenchmark(p.benchmark),n=(await loadBenchmarkModel(p.model)).network,r=await calculateThreePhase(n,emptyScenario(),adaptShortCircuitSources(p.raw,n),['SYN-B1'],engineeringScProfile('MAX')),f={...r.faults[0],physicalTerminalFids:['SYN-B1','INTERNAL']};
 assert.equal(r.calculationStandard,'IEC60909-0:2016');assert.equal(r.methodEvidence?.normativeStatus,'BLOCKED');assert.equal(auditScPartition(b,f,r.profile).matched,false);assert.equal(auditScPartitionSubset(b,f,r.profile).matched,true);
 assert.equal(auditScPartitionSubset(b,{...f,physicalTerminalFids:['SYN-B0','SYN-B1']},r.profile).matched,false);
 const table=b.groups.SC.tables.SC_BusResults_Raw;table.headers.push('resultConflictFlag');table.rows[1].push(1);assert.equal(auditScPartitionSubset({...b},f,r.profile).matched,false);
});
test('SC summary weights one electrical bus once while reporting physical aliases',()=>{
 const rows=[{mode:'MAX',FID:'A',electricalBusId:'X',delta_kA:1},{mode:'MAX',FID:'B',electricalBusId:'X',delta_kA:1},{mode:'MAX',FID:'C',electricalBusId:'Y',delta_kA:3}],s=ytmReferenceSummary(rows)[0];assert.equal(s.physicalMatched,3);assert.equal(s.electricalMatched,2);assert.equal(s.MAE_kA,2);assert.equal(s.referenceValidated,'NO');
});
test('adaptive AC queue solves more than three distinct physical outages with residual gates',async()=>{
 const n=acNetwork(10),r=await runHybridN1(n,emptyScenario(),{adaptiveAcTimeBudget:true,studyProfile:'NATIVE_PARTIAL_CONTROLS',solveAllSelected:true,policy:{acBudgetCases:100,globalTimeLimitMs:15000,perCaseTimeLimitMs:2000}});
 assert.ok(r.cases.filter(c=>c.acSolved).length>=8);assert.equal(new Set(r.cases.filter(c=>c.acSolved).map(c=>c.candidateId)).size,r.counts.AC_CALCULATED);assert.ok(r.cases.filter(c=>c.acSolved).every(c=>c.maxMismatchMw!==null&&c.maxMismatchMw<.005));
});
test('DC scope exclusion and topology isolation never imply failed physical computation',async()=>{
 const base=acNetwork(),n={...base,buses:base.buses.map(b=>({...b,vnKv:33})),lines:base.lines.slice(0,2).map(l=>({...l,vnKv:33}))},r=await runHybridN1(n,emptyScenario(),{screenOnly:true});assert.ok(r.cases.every(c=>['DC_UNSCREENABLE','TOPOLOGY_ISLANDING'].includes(c.status)&&c.quality===undefined));
});
test('PF N-1 extrema require the same equipment, explicit endpoint and capacity denominator',async()=>{
 const b=await loadBenchmark(syntheticBenchmarkPair().benchmark),n={...acNetwork(),studyCase:b.groups.N1.identity.studyCase},t=b.groups.N1.tables.N1_RecordedExtrema_Raw;
 t.headers=['caseId','affectedClass','affectedFid','postPowerEndpoint','loadingDenominatorBasis','loadingSeason','ratingMva','postLoadingPercent'];t.rows=[['N1:ElmLne:L0','ElmLne','L0','FROM','APPARENT_MVA','nominal',200,90]];
 const r={n1:{cases:[{outage:{caseId:'N1:ElmLne:L0'},mapResults:{branches:[{sourceClass:'ElmLne',fid:'L0',loading:{basis:'APPARENT_MVA',season:'nominal',ratingMva:100,operationalPercent:40}}]}}]}} as YtmStudyResult;
 let row=ytmN1ReferenceRows(r,n,b)[0];assert.equal(row.status,'REFERENCE_EXTREMA_ONLY');assert.equal(row.numericStatus,'NOT_NUMERICALLY_COMPARABLE');assert.equal(row.delta_percent,null);
 t.rows[0][6]=100;t.rows[0][3]='GLOBAL_MAX';assert.equal(ytmN1ReferenceRows(r,n,b)[0].delta_percent,null);
 t.rows[0][3]='FROM';row=ytmN1ReferenceRows(r,n,b)[0];assert.equal(row.delta_percent,-50);assert.equal(row.referenceValidated,'NO');
});
