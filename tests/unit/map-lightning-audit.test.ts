import test from 'node:test';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {scAuditFixture} from '../helpers/study-audit';
import {studyResultRows,queryStudyRows} from '../../src/features/analysis/study-result-rows';
import {workspaceMapSelection,initialResultView,activeResultId} from '../../src/domain/results/workspace';
import {pfFaultReference} from '../../src/domain/benchmark/pf-fault-reference';
import {scStudyState,setScStudyScope,setScStudyTargets,scBatchProgress,nextScBatch,cancelScBatch} from '../../src/features/analysis/sc-study-state';
import {studyExportRows} from '../../src/features/analysis/study-export';
import {equipmentCard} from '../../src/map/equipment-tooltip';
import {n1CaseRows,n1OperatorRows,ensureOperatorCatalog,groupN1Cases,filterOperatorGroups,operatorMetricKeys,operatorExportRows} from '../../src/features/analysis/study-operator';
import {createOperatorRowsCache} from '../../src/features/analysis/study-rows-cache';
import {identity,stableJson} from '../../src/domain/calculation/identity';
import {scenarioSignature} from '../../src/domain/scenario/overlay';
import type {CalculationResult} from '../../src/domain/results/types';
import {n1ControlEvidence} from '../../src/analysis/contingency-ac/control-evidence';

test('SC BLOCKED + PF available has GA=0, PF=1, BLOCKED=1 and keeps the full fault catalog',()=>{
  const {ctx,table,fault,result}=scAuditFixture();table.rows=table.rows.slice(0,1);ctx.scResult=result([fault(0)]);
  const study=studyResultRows(ctx,workspaceMapSelection(ctx));assert.equal(study.rows.length,3);assert.equal(study.totalFaultCatalogCount,3);assert.deepEqual([study.gaCalculatedCount,study.pfReferenceCount,study.gaBlockedCount,study.gaNotRunCount,study.numericCount],[0,1,1,2,0]);assert.equal(study.rows[0].ikss,null);assert.equal(study.rows[0].pfIkss,6);assert.equal(study.sourceMethod,'GA_POSITIVE_SEQUENCE_3PH_MAX');
  const selected=queryStudyRows(study.rows,{scView:'SELECTED',selectedFault:'B0',sort:'record',descending:false,page:0});assert.equal(selected.visible.length,1);assert.equal(queryStudyRows(study.rows,{scView:'ALL',sort:'record',descending:false,page:0}).visible.length,3);
  ctx.resultView.source='PF';const pf=studyResultRows(ctx,workspaceMapSelection(ctx));assert.equal(pf.numericCount,1);assert.equal(pf.gaCalculatedCount,0);assert.equal(pf.rows[0].ikss,null);
  ctx.resultView.source='GA';ctx.scResult!.identity.modelHash='OTHER_MODEL';assert.equal(activeResultId(ctx),null);assert.equal(studyResultRows(ctx,workspaceMapSelection(ctx)).gaCalculatedCount,0);
});

test('4689 synthetic PF records use indexed lookup, full counts and a sorted/searched 50-row page',()=>{
  const {ctx}=scAuditFixture(4689),heapBefore=process.memoryUsage().heapUsed,start=performance.now(),study=studyResultRows(ctx,workspaceMapSelection(ctx)),indexedMs=performance.now()-start,heapDeltaBytes=process.memoryUsage().heapUsed-heapBefore,queryStart=performance.now(),query=queryStudyRows(study.rows,{scView:'PF',sort:'pfIkss',descending:true,page:1}),queryMs=performance.now()-queryStart;
  assert.equal(study.pfReferenceCount,4689);assert.equal(study.gaCalculatedCount,0);assert.equal(query.visibleFilteredCount,4689);assert.equal(query.visible.length,50);assert.equal(query.visible[0].pfIkss,4644);assert.equal(study.rows[1].pfIkss,0);
  assert.equal(queryStudyRows(study.rows,{query:'Terminal 4688',sort:'record',descending:false,page:0}).visible.length,1);
  console.log(JSON.stringify({fixture:'SYNTHETIC_4689',indexedMs,queryMs,heapDeltaBytes,domPageLimit:query.visible.length}));
});



test('600+ selected targets remain distinct from partition/reference/processed counts; shared YTM does not trim the network',()=>{
  const {ctx,network,fault,result}=scAuditFixture(660),originalLines=network.lines,targets=network.buses.map(t=>t.sourceId);setScStudyScope(ctx,{ytmIds:['A']});setScStudyTargets(ctx,targets);ctx.scResult=result([fault(0,'CALCULATED_NETWORK_APPROXIMATION'),fault(1),fault(2,'CANCELLED')]);
  const study=studyResultRows(ctx,workspaceMapSelection(ctx));assert.deepEqual([study.selectedFaultCount,study.totalFaultCatalogCount,study.uniqueElectricalPartitionCount,study.gaCalculatedCount,study.gaBlockedCount,study.pfReferenceCount],[660,660,null,1,1,660]);assert.equal(network.lines,originalLines);assert.equal(network.externalGrids.length,1);assert.deepEqual(scBatchProgress(ctx),{targets:660,processed:3,calculated:1,blocked:1,cancelled:1,remaining:658,batch:0});
  setScStudyScope(ctx,{ytmIds:['OTHER']});assert.equal(studyResultRows(ctx,workspaceMapSelection(ctx)).rows.length,0);
});

test('bounded SC resume skips completed/blocked rows, retries cancellation and invalidates on scenario/settings changes',async()=>{
  const {ctx,network,fault,result}=scAuditFixture(660),targets=network.buses.map(t=>t.sourceId);setScStudyTargets(ctx,targets);assert.deepEqual(nextScBatch(ctx,targets,10,false),targets.slice(0,10));ctx.scResult=result(Array.from({length:10},(_,i)=>fault(i,i===4?'CANCELLED':'BLOCKED')));assert.deepEqual(nextScBatch(ctx,targets,20,true),[targets[4],...targets.slice(10,29)]);assert.equal(nextScBatch(ctx,targets,1000,true).length,20);
  ctx.scResult=result(Array.from({length:30},(_,i)=>fault(i)));assert.deepEqual(nextScBatch(ctx,targets,10,true),targets.slice(30,40));setScStudyTargets(ctx,targets,targets.slice(30,40));ctx.busy=true;cancelScBatch(ctx);ctx.busy=false;assert.equal(scBatchProgress(ctx).cancelled,10);assert.equal(scBatchProgress(ctx).remaining,630);assert.deepEqual(nextScBatch(ctx,targets,10,true),targets.slice(30,40));ctx.analysisSettings.update({powerFlow:{stationControlMode:ctx.analysisSettings.value.powerFlow.stationControlMode==='off'?'droop':'off'}});assert.equal(scStudyState(ctx).targets.length,0);ctx.scenario.setStatus('lineStatus','L0',false,true);assert.deepEqual(nextScBatch(ctx,targets,10,true),targets.slice(0,10));assert.equal(scBatchProgress(ctx).processed,0);
});

function n1Fixture(){
  const {ctx,network}=scAuditFixture(),make=(angles:number[]):CalculationResult=>({identity:identity(network.modelHash,ctx.scenario.current,'powerFlow',{analysisSettings:ctx.analysisSettings.value}),converged:true,status:'CONVERGED',buses:network.buses.map((b,i)=>({id:'E'+i,name:b.name,terms:[b.id],siteIds:b.siteIds,vnKv:100,vmPu:1,angleRad:angles[i]*Math.PI/180,islandId:'I',pMw:0,qMvar:0})),branches:network.lines.map(l=>({...l,pf:10,pt:-9,qf:3,qt:-2,ifA:50,itA:40,loading:0,pLoss:1,qLoss:1})),generators:[],warnings:[],quality:{},diagnostics:{islands:[{islandId:'I',referenceSource:'SLACK',status:'CONVERGED'}]}} as unknown as CalculationResult);
  const base=make([1,2,3]),post=make([4,5,6]);ctx.resultStore.expect('base',base.identity);ctx.resultStore.accept('base',base);ctx.benchmark=null;ctx.resultView={...initialResultView(),analysis:'N1',caseId:'N1:ElmLne:BYPASS',phase:'POST',metric:'postPmw'};
  ctx.n1AcResults=[{identity:{modelHash:network.modelHash,baseScenarioHash:scenarioSignature(ctx.scenario.current),settingsHash:stableJson(ctx.analysisSettings.value)},outage:{caseId:'N1:ElmLne:BYPASS',sourceClass:'ElmLne',fid:'BYPASS'},status:'CONVERGED',result:post,unsuppliedLoadMw:16.921}] as unknown as typeof ctx.n1AcResults;return {ctx,network,base,post};
}

test('Full AC N1 endpoint angles follow physical ends and reference gates; reversed, bridge and DC remain honest',()=>{
  const {ctx,network,post}=n1Fixture(),line=network.lines[0];assert.deepEqual(equipmentCard(ctx,line).rows.map(r=>r[5]),['+4,0','+5,0']);assert.deepEqual(equipmentCard(ctx,{...line,from:line.to,to:line.from}).rows.map(r=>r[5]),['+5,0','+4,0']);ctx.resultView.phase='CHANGE';assert.deepEqual(equipmentCard(ctx,line).rows.map(r=>r[5]),['+3,0','+3,0']);
  post.diagnostics.islands=[{islandId:'I',referenceSource:'OTHER',status:'CONVERGED'}] as never;assert.deepEqual(equipmentCard(ctx,line).rows.map(r=>r[5]),['—','—']);assert.match(equipmentCard(ctx,line).note,/ANGLE_REFERENCE_MISMATCH/);ctx.resultView.phase='POST';post.buses=post.buses.slice(0,1);ctx.n1AcResults[0].status='PARTIAL_SOLUTION';assert.deepEqual(equipmentCard(ctx,line).rows.map(r=>r[5]),['+4,0','—']);
  ctx.n1AcResults=[];ctx.n1Result={identity:{modelHash:network.modelHash,scenarioHash:scenarioSignature(ctx.scenario.current)},candidates:[{equipmentId:'BYPASS',sourceClass:'ElmLne',status:'SCREENED',topImpacts:[{equipmentId:line.id,sourceClass:line.sourceClass,baseFlowMw:10,postFlowMw:12}]}]} as unknown as typeof ctx.n1Result;assert.ok(!equipmentCard(ctx,line).headers.includes('Açı (°)'));assert.match(equipmentCard(ctx,line).note,/DC P-only/);
});

test('N1 case total exports once as CASE_TOTAL and each equipment remains ELEMENT with null unsupplied MW',()=>{
  const {ctx}=n1Fixture(),study=studyResultRows(ctx,workspaceMapSelection(ctx)),exported=studyExportRows(study,ctx.resultView.caseId!);assert.equal(study.caseUnsuppliedLoadMw,16.921);assert.ok(study.rows.length>1);assert.ok(study.rows.every(r=>r.unsupplied===null));const column=exported[0].indexOf('unsuppliedLoadMW');assert.equal(exported.filter(r=>r[0]==='CASE_TOTAL').length,1);assert.equal(exported.filter(r=>r[0]==='ELEMENT').length,study.rows.length);assert.equal(exported.slice(1).reduce<number>((sum,r)=>sum+(typeof r[column]==='number'?r[column]:0),0),16.921);
});

test('scenario delta tooltip keeps flow, loss, tap/service and 1/2 decimals beside loading pp',()=>{
  const {ctx,network,base,post}=n1Fixture();ctx.resultView={...initialResultView(),source:'Senaryo−Baz',metric:'loadingPercent'};ctx.scenario.setStatus('lineStatus','BYPASS',false,true);post.identity=identity(network.modelHash,ctx.scenario.current,'powerFlow',{analysisSettings:ctx.analysisSettings.value});post.branches=post.branches.map(b=>({...b,pf:-22,pt:20,pLoss:2,qLoss:2}));ctx.resultStore.selectScenario(ctx.scenario.selectedId);ctx.resultStore.expect('scenario',post.identity);ctx.resultStore.accept('scenario',post);ctx.resultStore.role='delta';ctx.benchmarkMap=workspaceMapSelection(ctx);base.diagnostics.convergence={stationControl:'STATION_CONTROL_CONVERGED',activeBalance:'ACTIVE_BALANCE_CONVERGED'};
  const trafo={...network.lines[0],id:'TR',sourceId:'TR',sourceClass:'ElmTr2',lvKv:33,tapPosition:2,ratingMva:100,rPu:0,xPu:.1,tap:1,phase:0,gPu:0,bPu:0};ctx.network={...network,transformers:[trafo],buses:network.buses.map((b,i)=>i===1?{...b,vnKv:33}:b)};base.buses=base.buses.map((b,i)=>i===1?{...b,vnKv:33}:b);post.buses=post.buses.map((b,i)=>i===1?{...b,vnKv:33}:b);base.branches=[...base.branches,{...base.branches[0],id:'TR',sourceClass:'ElmTr2'}];post.branches=[...post.branches,{...post.branches[0],id:'TR',sourceClass:'ElmTr2'}];
  const card=equipmentCard(ctx,trafo);assert.match(card.note,/Baz .*%.*Δ .*pp/);assert.match(card.note,/P: B → A.*ΔKayıp P\/Q.*Serviste.*Tap 2,0/);assert.match(card.details!,/Kayıp P\/Q.*1,0\/1,0/);ctx.settings.value.precision=2;assert.match(equipmentCard(ctx,trafo).note,/Tap 2,00/);
});

test('operator case metadata filters the cut equipment, results filter affected equipment, and modes reuse one guarded pair',()=>{
  const {ctx,network,base,post}=n1Fixture(),read=createOperatorRowsCache(ctx),first=read();assert.strictEqual(read(),first);ctx.resultView.metric='postQmvar';assert.strictEqual(read(),first);
  ctx.resultStore.clear();assert.doesNotThrow(()=>studyResultRows(ctx,workspaceMapSelection(ctx)));assert.equal(n1OperatorRows(ctx).find(r=>r.row.fid==='L0')!.values.p.delta,null);ctx.resultStore.expect('base',base.identity);ctx.resultStore.accept('base',base);
  const line=first.rows.find(r=>r.row.fid==='L0')!;assert.equal(line.values.p.pre,10);assert.equal(line.values.q.post,3);assert.equal(line.values.loading.post,null);assert.equal(line.values.loading.delta,null);
  const terminal=first.rows.find(r=>r.row.cls==='ElmTerm')!;assert.equal(terminal.values.voltage.post,100);assert.ok(Math.abs(terminal.values.angle.delta!-3)<1e-9);
  post.diagnostics.islands=[{islandId:'I',referenceSource:'OTHER',status:'CONVERGED'}] as never;assert.equal(n1OperatorRows(ctx).find(r=>r.row.cls==='ElmTerm')!.values.angle.delta,null);
  post.buses[0].terms=['B0','B1'];assert.equal(n1OperatorRows(ctx).find(r=>r.row.fid==='L0')!.values.p.delta,null);post.buses=post.buses.map((b,i)=>({...b,terms:['B'+i]}));
  const tr={...network.lines[0],id:'TR',sourceId:'TR',name:'Kesilen Trafo',sourceClass:'ElmTr2',siteIds:['STATION'],lvKv:33} as unknown as typeof network.transformers[number];network.transformers=[tr];ctx.n1AcResults[0].outage={caseId:'N1:ElmTr2:TR',sourceClass:'ElmTr2',fid:'TR'};ctx.resultView.caseId='N1:ElmTr2:TR';
  const query=(rows:ReturnType<typeof n1CaseRows>,equipmentTypes:string[])=>queryStudyRows(rows,{equipmentTypes,sort:'name',descending:false,page:0}).filtered;
  assert.equal(query(n1CaseRows(ctx),['trafo']).length,1);assert.equal(query(n1CaseRows(ctx),['line']).length,0);assert.ok(query(n1OperatorRows(ctx).map(r=>r.row),['line']).length>0);assert.equal(query(n1OperatorRows(ctx).map(r=>r.row),['trafo']).length,0);
  ctx.n1AcResults=[];assert.equal(n1OperatorRows(ctx).length,0);ctx.n1Result={identity:{modelHash:network.modelHash,scenarioHash:scenarioSignature(ctx.scenario.current)},candidates:[{equipmentId:'TR',sourceClass:'ElmTr2',status:'SCREENED',topImpacts:[{equipmentId:'L0',sourceClass:'ElmLne',baseFlowMw:10,postFlowMw:12,deltaPMw:2,baseEstimatedLoadingPct:50,postEstimatedLoadingPct:60}]}]} as unknown as typeof ctx.n1Result;
  const dc=n1OperatorRows(ctx)[0];assert.equal(dc.values.p.post,12);assert.equal(dc.values.q.post,null);assert.equal(dc.values.loading.post,null);for(const metric of ['postQmvar','voltageKv','postLoadingPercent']){ctx.resultView.metric=metric;assert.ok(studyResultRows(ctx,workspaceMapSelection(ctx)).rows.every(r=>r.post===null&&r.delta===null));}
  ctx.n1Result!.identity.scenarioHash='STALE';assert.equal(n1OperatorRows(ctx).length,0);assert.equal(base.identity.modelHash,network.modelHash);
});

test('operator catalog loads without AC, once per model/scenario; grouped results keep whole cases, mixed types and view export units',async()=>{
  const {ctx,network,post,base}=n1Fixture();ctx.hybridResult={status:'BLOCKED'} as never;ctx.n1AcResults=[];let loads=0;ctx.loadN1Catalog=async(scope,season,all)=>{assert.deepEqual([scope,season,all],['scenario','nominal',true]);loads++;};
  ensureOperatorCatalog(ctx);ensureOperatorCatalog(ctx);await new Promise<void>(resolve=>queueMicrotask(resolve));assert.equal(loads,1);
  ctx.hybridResult=null;const {ctx:source}=n1Fixture();ctx.n1AcResults=source.n1AcResults;
  const first=ctx.n1AcResults[0];first.result=post;post.branches=post.branches.map(b=>({...b,pf:21,qf:7}));
  const second=structuredClone(first);second.outage={...first.outage,caseId:'N1:ElmLne:OTHER',fid:'OTHER'};second.result!.branches=second.result!.branches.map(b=>({...b,pf:30,qf:11}));ctx.n1AcResults=[first,second];
  const groups=groupN1Cases(ctx,n1CaseRows(ctx)),line=groups.find(g=>g.row.cls==='ElmLne')!;assert.equal(line.cases.length,2);assert.equal(line.critical.verified,false);assert.equal(line.critical.violation,false);
  assert.deepEqual(line.cases.map(c=>[c.values.p.post,c.values.q.post]),[[21,7],[30,11]]);assert.equal(filterOperatorGroups(groups,[],[],'violations').length,0);assert.equal(filterOperatorGroups(groups,[],[],'unverified').length,groups.length);
  const mixed=queryStudyRows(groups.map(g=>g.row),{equipmentTypes:['line','trafo','bus'],sort:'record',descending:false,page:0}).filtered;assert.ok(mixed.some(r=>r.cls==='ElmTerm'));assert.ok(mixed.some(r=>r.cls==='ElmLne'));
  const out=operatorExportRows([line.row],new Map([[line.row.id,line]]),r=>operatorMetricKeys(r,'pq-loading','voltage-angle'),{model:network.modelHash,scenario:scenarioSignature(ctx.scenario.current),source:'GA'});assert.equal(out.length,4);const col=(name:string)=>out[0].indexOf(name);assert.deepEqual(out.slice(1).map(r=>r[col('Vaka')]),Array(3).fill(line.critical.caseId));assert.deepEqual(out.slice(1).map(r=>r[col('Fark birimi')]),['MW','MVAr','pp']);assert.equal(out[1][col('Sonra')],line.critical.values.p.post);assert.equal(out[2][col('Sonra')],line.critical.values.q.post);assert.equal(out[3][col('Sonra')],null);
  // Deliberately supplied synthetic source/control evidence and rating; production never infers these.
  base.maxMismatchMw=0;base.diagnostics.convergence={activeBalance:'ACTIVE_BALANCE_CONVERGED'};
  const evidence=n1ControlEvidence(network,base,ctx.analysisSettings.value);assert.equal(evidence.fidelity,'CONTROL_VERIFIED');first.controlEvidence=second.controlEvidence=evidence;
  network.lines=network.lines.map(l=>({...l,capacity:{quality:'DGS_MAIN_TYPE',nominalCurrentKA:.05,nominalMVA:8.66,sections:[],seasonalReference:null} as never}));
  post.branches=post.branches.map(b=>({...b,ifA:75}));second.result!.branches=second.result!.branches.map(b=>({...b,ifA:85}));
  const verified=filterOperatorGroups(groupN1Cases(ctx,n1CaseRows(ctx)),[],[],'worsened'),critical=verified.find(g=>g.row.fid==='L0')!.critical;assert.equal(critical.caseId,second.outage.caseId);assert.deepEqual([critical.values.p.pre,critical.values.p.post,critical.values.q.post,critical.values.loading.post,critical.values.loading.delta],[10,30,11,170,70]);assert.equal(critical.violation,true);
});

test('catalog request finishes before a scenario undo or failed-load retry requests the same key',async()=>{
  const {ctx}=n1Fixture();let loads=0,fail=false;
  ctx.n1CatalogResult=null;ctx.n1CatalogIdentity=null;
  ctx.loadN1Catalog=async()=>{loads++;if(fail)throw Error('Temporary catalog failure');ctx.n1CatalogResult={candidates:[]} as never;ctx.n1CatalogIdentity={modelHash:ctx.network!.modelHash,scenarioHash:scenarioSignature(ctx.scenario.current),analysisScope:'scenario',capacitySeason:'nominal',includeAllVoltages:true};};
  const settled=()=>new Promise<void>(resolve=>setImmediate(resolve));
  ensureOperatorCatalog(ctx);ensureOperatorCatalog(ctx);await settled();assert.equal(loads,1);
  ensureOperatorCatalog(ctx);await settled();assert.equal(loads,1);
  ctx.scenario.setStatus('lineStatus','L0',false,true);ctx.scenario.undo();ctx.n1CatalogResult=null;ctx.n1CatalogIdentity=null;
  ensureOperatorCatalog(ctx);await settled();assert.equal(loads,2);assert.ok(ctx.n1CatalogResult);
  ctx.n1CatalogResult=null;ctx.n1CatalogIdentity=null;fail=true;ensureOperatorCatalog(ctx);await settled();assert.equal(loads,3);
  fail=false;ensureOperatorCatalog(ctx);await settled();assert.equal(loads,4);assert.ok(ctx.n1CatalogResult);
});
