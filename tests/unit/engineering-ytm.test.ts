import test from 'node:test';
import assert from 'node:assert/strict';
import {unzipSync,strFromU8} from 'fflate';
import {acNetwork} from '../helpers/ac-network';
import {emptyScenario} from '../../src/domain/scenario/overlay';
import {calculateThreePhase,clearScPreparationCache} from '../../src/analysis/short-circuit';
import {engineeringScProfile,engineeringSourceOptions} from '../../src/analysis/short-circuit/engineering-profile';
import type {ScSourceContext} from '../../src/analysis/short-circuit/source-adapter';
import {runHybridN1} from '../../src/analysis/contingency-hybrid';
import {runYtmStudy,ytmStudyIsCurrent,finishYtmStudy} from '../../src/analysis/ytm-study';
import {ytmScRows,ytmN1Rows,recordTable,ytmReferenceRows} from '../../src/analysis/ytm-study/export';
import {buildWorkbook} from '../../src/features/analysis/xlsx-export';
import {csvDocument} from '../../src/ui/components/dom';
import {adaptShortCircuitSources} from '../../src/importers/powerfactory-benchmark/short-circuit-source';
import {loadBenchmarkModel} from '../../src/importers/powerfactory-benchmark/model';
import {syntheticBenchmarkPair} from '../helpers/benchmark-model';
import {validateAcOutages} from '../../src/analysis/contingency-ac';
const network=()=>{const n=acNetwork();return {...n,sites:[{...n.buses[0],id:'S',sourceId:'S',sourceClass:'ElmSite',areaId:'Y',areaName:'Real scope semantics',name:'TM',lat:null,lon:null,voltages:[100]}],buses:n.buses.map(b=>({...b,siteIds:['S']}))};};
const context=(n=network()):ScSourceContext=>({modelHash:n.modelHash,audit:[],invalidBranches:[],sources:[{sourceClass:'ElmXnet',fid:'SLACK',bus:'B0',inService:true,rOhm:1,xOhm:10,reason:'',sourceRef:'EXACT_ANALYTIC_OHM',parameterStatus:'NATIVE'}]});
const near=(a:number|null,b:number)=>assert.ok(a!==null&&Math.abs(a-b)<1e-8*Math.max(1,b),`${a} / ${b}`);
test('engineering SC isolates an omitted converter and keeps exact known-source Thevenin calculation',async()=>{
 clearScPreparationCache();const base=network(),n={...base,lines:base.lines.filter(l=>l.id!=='BYPASS')},c=context(n);c.sources.push({sourceClass:'ElmGenStat',fid:'IBR',bus:'B1',inService:true,rOhm:null,xOhm:null,reason:'UNSUPPORTED_CONVERTER',sourceRef:'MISSING_NATIVE_DATA'});
 assert.equal((await calculateThreePhase(n,emptyScenario(),c,['B2'],engineeringScProfile('MAX'))).faults[0].ikssKa,null);
 c.adapterOptions={sourcePolicy:'ENGINEERING_PARTIAL',provenance:'TEST_EXPLICIT_POLICY'};
 const r=await calculateThreePhase(n,emptyScenario(),c,['B2'],engineeringScProfile('MAX')),f=r.faults[0];near(f.zkkOhm?.im??null,30);near(f.ikssKa,110/(Math.sqrt(3)*Math.hypot(1,30)));assert.equal(f.quality,'ENGINEERING_APPROX');assert.match(f.reasons.join(),/NOT_A_SAFE_LOWER_OR_UPPER_BOUND/);assert.match(r.componentEvidence[0].reasons.join(),/IBR/);
});
test('engineering policy never bypasses invalid branch impedances or makes an unsupplied island solvable',async()=>{
 const n=network(),c=context(n);c.adapterOptions=engineeringSourceOptions('MAX');c.invalidBranches=[{sourceClass:'ElmLne',fid:'L0',reason:'INVALID_NATIVE_IMPEDANCE'}];
 assert.equal((await calculateThreePhase(n,emptyScenario(),c,['B1'],engineeringScProfile('MAX'))).faults[0].ikssKa,null);
 const none={...context(n),sources:[],adapterOptions:engineeringSourceOptions('MAX')};assert.equal((await calculateThreePhase(n,emptyScenario(),none,['B1'],engineeringScProfile('MAX'))).faults[0].quality,'NOT_COMPUTABLE');
});
test('closed-coupler aliases reuse one RHS and subsequent calls reuse the factorization',async()=>{
 clearScPreparationCache();const n=network(),c=context(n),alias={...n.buses[1],id:'ALIAS',sourceId:'ALIAS'},withAlias={...n,buses:[...n.buses,alias],switches:[{...alias,id:'COUPLER',sourceId:'COUPLER',sourceClass:'ElmCoup',from:'B1',to:'ALIAS',closed:true}]};
 const a=await calculateThreePhase(withAlias,emptyScenario(),c,['B1','ALIAS'],engineeringScProfile('MAX'));assert.equal(a.factorizations,1);assert.equal(a.rhsCount,1);assert.equal(a.reusedDrivingPoints,1);near(a.faults[0].ikssKa,a.faults[1].ikssKa!);
 const b=await calculateThreePhase(withAlias,emptyScenario(),c,['ALIAS'],engineeringScProfile('MAX'));assert.equal(b.factorizations,0);assert.equal(b.rhsCount,0);
});
test('MAX/MIN voltage presets retain explicit separate mode identities and do not imply certified extrema',async()=>{
 const n=network(),c=context(n),max=await calculateThreePhase(n,emptyScenario(),{...c,calculateMode:'MAX'},['B1'],engineeringScProfile('MAX')),min=await calculateThreePhase(n,emptyScenario(),{...c,calculateMode:'MIN'},['B1'],engineeringScProfile('MIN'));
 near(max.faults[0].ikssKa!/min.faults[0].ikssKa!,1.1);assert.notEqual(max.identity.profileHash,min.identity.profileHash);assert.equal(max.faults[0].ipKa,null);
 await assert.rejects(calculateThreePhase(n,emptyScenario(),{...c,calculateMode:'MIN'},['B1'],engineeringScProfile('MAX')),/MODE_MISMATCH/);
});
test('IEC 2016 remains a code-owned blocked gate even with engineering sources',async()=>{
 const n=network(),r=await calculateThreePhase(n,emptyScenario(),context(n),['B1'],engineeringScProfile('MAX','IEC_REFERENCE_VERIFIED'));
 assert.equal(r.faults[0].ikssKa,null);assert.equal(r.faults[0].quality,'NOT_COMPUTABLE');assert.equal(r.factorizations,0);
});
test('DC-only catalog does not call base AC and retains P-only results for every computable outage',async()=>{
 const n=network();let called=false;const r=await runHybridN1(n,emptyScenario(),{screenOnly:true,solveBase:async()=>{called=true;throw Error('must not call');}});
 assert.equal(called,false);assert.equal(r.cases.length,3);assert.ok(r.cases.every(c=>c.quality==='DC_SCREEN_ONLY'&&c.dcResult?.maxDeltaPMw!==null&&c.minVpu===null&&c.maxLoadingPercent===null));
});
test('failed base AC retains numeric DC evidence without relaxing Strict status',async()=>{
 const r=await runHybridN1(network(),emptyScenario(),{solveBase:async()=>{throw Error('PHYSICAL_BASE_NOT_SOLVED');}});assert.equal(r.status,'BLOCKED');assert.ok(r.cases.every(c=>c.dcResult?.baseFlowMw!==null&&c.quality==='DC_SCREEN_ONLY'));assert.equal(r.basePost,undefined);
});
test('YTM fast batch targets the entire scope, including low voltage and unmapped physical terminals',async()=>{
 const base=network(),n={...base,buses:[...base.buses,{...base.buses[0],id:'UNUSED',sourceId:'UNUSED',vnKv:34.5}]},c=context(n),r=await runYtmStudy(n,emptyScenario(),{MAX:c,MIN:c},{ytmId:'Y',profile:'FAST'});
 assert.equal(r.catalog.length,3);assert.equal(r.faultTargets.length,4);assert.equal(r.electricalTargets,3);assert.equal(r.scMax!.faults.find(f=>f.physicalTerminalFid==='UNUSED')?.ikssKa,null);assert.equal(r.n1?.cases.length,3);assert.equal(r.status,'COMPLETE');assert.equal(r.qualityCounts.REFERENCE_VALIDATED,0);
 const rows=ytmScRows(r,n),table=recordTable(rows),csv=csvDocument(table),xlsx=unzipSync(buildWorkbook([{name:'Study',rows:table}]));assert.ok(csv.includes('Ikss_MAX_kA'));assert.ok(strFromU8(xlsx['xl/worksheets/sheet1.xml']).includes('ENGINEERING_APPROX'));assert.deepEqual(JSON.parse(JSON.stringify(rows)),rows);assert.equal(ytmN1Rows(r).length,3);assert.match(String(ytmReferenceRows(r,n,null)[0].status),/UNAVAILABLE/);
 assert.ok(ytmStudyIsCurrent(r,n,emptyScenario()));assert.equal(ytmStudyIsCurrent(r,n,{...emptyScenario(),lineStatus:{L0:false}}),false);assert.equal(ytmStudyIsCurrent(r,{...n,modelHash:'OTHER'},emptyScenario()),false);finishYtmStudy(r,'CANCELLED');assert.equal(r.status,'CANCELLED');
});
test('all result qualities remain separate from full IEC/PowerFactory verification',async()=>{
 const n=network(),c=context(n),r=await runYtmStudy(n,emptyScenario(),{MAX:c,MIN:c},{ytmId:'Y',profile:'STRICT'});assert.equal(r.scMax?.faults.filter(f=>f.ikssKa!==null).length,0);assert.equal(r.qualityCounts.REFERENCE_VALIDATED,0);
});
test('YTM scope and time budget are validated',async()=>{
 const n=network(),c=context(n);await assert.rejects(runYtmStudy(n,emptyScenario(),{MAX:c,MIN:c},{ytmId:'unknown'}),/INVALID_YTM/);await assert.rejects(runYtmStudy(n,emptyScenario(),{MAX:c,MIN:c},{ytmId:'Y',timeBudgetMs:180001}),/INVALID_YTM/);
});
test('resume retains completed DC and both SC modes and rejects a changed source/scenario',async()=>{
 const n=network(),c=context(n),options={ytmId:'Y',profile:'FAST' as const},r=await runYtmStudy(n,emptyScenario(),{MAX:c,MIN:c},options),resumed=await runYtmStudy(n,emptyScenario(),{MAX:c,MIN:c},{...options,timeBudgetMs:1000},{resume:r});
 assert.equal(resumed.scMax,r.scMax);assert.equal(resumed.scMin,r.scMin);assert.equal(resumed.n1,r.n1);assert.equal(resumed.stageMs.DC_SCREEN,0);assert.equal(resumed.stageMs.SC_BATCH,0);
 await assert.rejects(runYtmStudy(n,emptyScenario(),{MAX:{...c,assumptions:['CHANGED']},MIN:c},options,{resume:r}),/STALE_RESUME/);
 await assert.rejects(runYtmStudy(n,{...emptyScenario(),lineStatus:{L0:false}},{MAX:c,MIN:c},options,{resume:r}),/STALE_RESUME/);
});
test('recorded zero converter current is a native input, while absent current remains unknown',async()=>{
 const loaded=await loadBenchmarkModel(syntheticBenchmarkPair().model),raw={...loaded.raw,ElmGenStat:{Attributes:['FID','bus1','outserv','psutype','Ikss3PF','ngnum'],Values:[['ZERO','SYN-CX',0,'fsce',0,1],['UNKNOWN','SYN-CX',0,'fsce','',1]]}},c=adaptShortCircuitSources(raw,loaded.network);
 const zero=c.sources.find(s=>s.fid==='ZERO')!,unknown=c.sources.find(s=>s.fid==='UNKNOWN')!;assert.equal(zero.currentKa,0);assert.equal(zero.parameterStatus,'NATIVE');assert.equal(zero.reason,'');assert.ok(unknown.reason);assert.equal(unknown.currentKa,undefined);
});
test('missing-machine fallback retains every supplied native impedance parameter',async()=>{
 const loaded=await loadBenchmarkModel(syntheticBenchmarkPair().model),raw={...loaded.raw,ElmXnet:undefined,ElmSym:{Attributes:['FID','bus1','outserv','typ_id','ngnum'],Values:[['G','SYN-CX',0,'GT',2]]},TypSym:{Attributes:['FID','rstr','xdss','ugn','sgn'],Values:[['GT',.01,'',100,100]]}},c=adaptShortCircuitSources(raw,loaded.network,undefined,{missingMachineXdssPu:.2,missingMachineRPu:.02,provenance:'MISSING_X_ONLY'});
 const g=c.sources.find(s=>s.fid==='G')!;near(g.rOhm,.5);near(g.xOhm,10);assert.equal(g.parameterStatus,'ASSUMED');
 const invalid=adaptShortCircuitSources({...raw,TypSym:{...raw.TypSym,Values:[['GT',.01,-.2,100,100]]}},loaded.network,undefined,{missingMachineXdssPu:.2,missingMachineRPu:.02,provenance:'MISSING_ONLY'});assert.match(invalid.sources.find(s=>s.fid==='G')!.reason,/INVALID_UNIT/);
});
test('expired study budget reports all targets with null quantities and a resumable ledger',async()=>{
 const n=network(),c=context(n),r=await runYtmStudy(n,emptyScenario(),{MAX:c,MIN:c},{ytmId:'Y',profile:'FAST',timeBudgetMs:.001});assert.equal(r.status,'BUDGET_EXHAUSTED');assert.equal(r.catalog.length,3);assert.equal(ytmScRows(r,n).length,3);assert.ok(ytmScRows(r,n).every(row=>row.Ikss_MAX_kA===null&&row.Ikss_MIN_kA===null&&row.quality===null));assert.equal(r.pendingCounts?.SC_MAX,3);
});
test('unsupplied component is explicit while the independently solved supplied component stays usable',async()=>{
 const base=network(),bus={...base.buses[2],id:'DETACHED',sourceId:'DETACHED'},n={...base,buses:[...base.buses,bus],lines:[...base.lines,{...base.lines[0],id:'SPUR',sourceId:'SPUR',from:'B2',to:'DETACHED'}],loads:[...base.loads,{...base.loads[0],id:'DETACHED_LOAD',sourceId:'DETACHED_LOAD',bus:'DETACHED',pMw:5,qMvar:1}]};
 const r=await runHybridN1(n,emptyScenario(),{studyProfile:'NATIVE_PARTIAL_CONTROLS',allowSuppliedIslandResults:true,catalogCandidateIds:['ElmLne:SPUR'],selectedCandidateIds:['ElmLne:SPUR'],policy:{acBudgetCases:1}}),c=r.cases[0];
 assert.equal(c.unsuppliedLoadMw,5);assert.equal(c.acSolved,true);assert.equal(c.status,'PARTIAL_SOLUTION');assert.match(c.reason,/ISLAND_UNSUPPLIED/);assert.equal(r.counts.ISLAND_UNSUPPLIED_COMPONENT_CASES,1);assert.ok(c.mapResults?.buses.length);assert.ok(c.mapResults?.buses.every(b=>!b.terms.includes('DETACHED')));
});
test('a forged successful POST flag cannot expose invalid residuals as AC numbers',async()=>{
 const n=network(),outage={caseId:'N1:ElmLne:L0',sourceClass:'ElmLne' as const,fid:'L0'},[valid]=await validateAcOutages(n,emptyScenario(),[outage],{controlPolicy:'ALLOW_PARTIAL'});assert.ok(valid.result);
 const r=await runHybridN1(n,emptyScenario(),{studyProfile:'NATIVE_PARTIAL_CONTROLS',catalogCandidateIds:['ElmLne:L0'],selectedCandidateIds:['ElmLne:L0'],policy:{acBudgetCases:1},solveOutage:async()=>({...valid,status:'CONVERGED',result:{...valid.result!,maxMismatchMw:123},controlEvidence:{...valid.controlEvidence!,numericalSolved:true}})}),c=r.cases[0];
 assert.equal(c.acSolved,false);assert.equal(c.status,'BLOCKED');assert.equal(c.mapResults,undefined);assert.equal(c.minVpu,null);assert.ok(c.dcResult);assert.equal(c.quality,'DC_SCREEN_ONLY');assert.equal(r.counts.AC_NUMERICALLY_SOLVED,0);
});
