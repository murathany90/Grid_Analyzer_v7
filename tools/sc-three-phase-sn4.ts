/** Fresh 3PH MAX/MIN validation of the supplied study; private inputs/outputs never enter Git. */
import {readFile,writeFile,stat} from 'node:fs/promises';
import {serialize,deserialize} from 'node:v8';
import {createHash} from 'node:crypto';
import {basename} from 'node:path';
import assert from 'node:assert/strict';
import {loadBenchmarkModel} from '../src/importers/powerfactory-benchmark/model';
import {loadBenchmark} from '../src/importers/powerfactory-benchmark';
import {adaptShortCircuitSources} from '../src/importers/powerfactory-benchmark/short-circuit-source';
import {calculateThreePhase,clearScPreparationCache} from '../src/analysis/short-circuit';
import {emptyScenario,ScenarioStore,scenarioSignature} from '../src/domain/scenario/overlay';
import {cleanStudy,upgradeLegacyThreePhase} from '../src/domain/results/sc-persistence';
import {finishYtmStudy,type YtmStudyResult} from '../src/analysis/ytm-study';
import {compactScRows} from '../src/features/analysis/compact-rows';
import {buildBenchmarkMapData} from '../src/domain/benchmark/map-layer';
import {equipmentCard} from '../src/map/equipment-tooltip';
import {analysisUiFixture} from '../tests/helpers/analysis-ui';
const [modelPath,studyPath,referencePath]=process.argv.slice(2);if(!modelPath||!studyPath||!referencePath)throw Error('Arguments: native-model.zip supplied-study.json SC-reference.xlsx');
const original=JSON.parse(await readFile(studyPath,'utf8')) as YtmStudyResult,study=cleanStudy(original)!;
console.log('READ_STUDY '+study.faultTargets.length);
const reference=await loadBenchmark(new File([await readFile(referencePath)],basename(referencePath)));console.log('COMBINED_REFERENCE_VERIFIED');
const info=await stat(modelPath),parserHash=createHash('sha256').update(await readFile('src/importers/dgs/canonical.ts')).digest('hex'),stamp=JSON.stringify([modelPath,info.size,info.mtimeMs,parserHash]);
let loaded:Pick<Awaited<ReturnType<typeof loadBenchmarkModel>>,'raw'|'network'>;let cachedNative=false;
try{const saved=deserialize(await readFile('.tmp/sc-three-phase-native.cache'));if(saved.stamp!==stamp)throw Error('CACHE_STALE');loaded=saved.loaded;cachedNative=true;}catch{const parsed=await loadBenchmarkModel(new File([await readFile(modelPath)],basename(modelPath)));loaded={raw:parsed.raw,network:parsed.network};await writeFile('.tmp/sc-three-phase-native.cache',serialize({stamp,loaded}));}
const network=loaded.network;
assert.equal(network.modelHash,study.identity.modelHash);assert.equal(network.studyCase,study.identity.studyCase);
const scenario=Object.assign(emptyScenario(),Object.fromEntries(JSON.parse(study.identity.scenarioHash).map(([key,entries]:[string,[string,unknown][]])=>[key,key==='restoredTerminals'?entries:Object.fromEntries(entries)])));
assert.equal(scenarioSignature(scenario),study.identity.scenarioHash);
const proof:any={cachedNative,classification:'FRESH_SN4_3PH_MAX_MIN; DIAGNOSTIC_ONLY; PF_PARITY_NOT_VERIFIED',modelHash:network.modelHash,scenarioHash:study.identity.scenarioHash,physicalTargets:study.faultTargets.length,modes:[],legacyUpgrade:[],ui:[],pfParity:'NOT_VERIFIED',outliers:'UNRESOLVED_CAUSE; no per-fault device contribution matrix'};
for(const mode of ['MAX','MIN'] as const){
 const key=mode==='MAX'?'scMax':'scMin',old=original[key]!,context=adaptShortCircuitSources(loaded.raw,network,undefined,old.sourceOptions),byBus=new Map(old.faults.map(f=>[f.electricalBusId,f])),targets=[...byBus.values()].map(f=>f.physicalTerminalFid);
 const codeHash=createHash('sha256');for(const path of ['src/analysis/short-circuit/index.ts','src/analysis/short-circuit/positive-sequence.ts','src/importers/powerfactory-benchmark/short-circuit-source.ts'])codeHash.update(await readFile(path));const numericalStamp=codeHash.digest('hex')+network.modelHash+study.identity.scenarioHash+JSON.stringify(context.adapterOptions)+JSON.stringify(old.profile);
 let fresh:Awaited<ReturnType<typeof calculateThreePhase>>;let cachedRhs=false;try{const saved=JSON.parse(await readFile('.tmp/sc-three-phase-'+mode+'.json','utf8'));if(saved.stamp!==numericalStamp)throw Error('STALE_RESULT');fresh=saved.result;cachedRhs=true;}catch{fresh=await calculateThreePhase(network,scenario,context,targets,{...old.profile,timeBudgetMs:300000});await writeFile('.tmp/sc-three-phase-'+mode+'.json',JSON.stringify({stamp:numericalStamp,result:fresh}));}
 const errors=fresh.faults.map(f=>{assert.equal(f.status,'CALCULATED_NETWORK_APPROXIMATION');const prior=byBus.get(f.electricalBusId)!;return Math.abs(f.ikssKa!-prior.ikssKa!);});assert.equal(fresh.faults.length,505);assert.ok(Math.max(...errors)<1e-8);
 const oldByFid=new Map(old.faults.map(f=>[f.physicalTerminalFid,f.electricalBusId])),newByBus=new Map(fresh.faults.map(f=>[f.electricalBusId,f]));fresh.faults=study.faultTargets.map(fid=>({...newByBus.get(oldByFid.get(fid)!)!,physicalTerminalFid:fid}));fresh.workspaceScope=old.workspaceScope;
 const legacy=cleanStudy(original)![key]!;assert.ok(upgradeLegacyThreePhase(legacy,context));proof.legacyUpgrade.push(mode);
 study[key]=fresh;if(mode==='MAX')study.identity.sourceHashMAX=fresh.identity.sourceHash;else study.identity.sourceHashMIN=fresh.identity.sourceHash;
 const {ctx}=analysisUiFixture();ctx.network=network;ctx.scenario=new ScenarioStore(network.modelHash);ctx.scenario.replace(scenario);ctx.scContext=context;ctx.scResult={...fresh,workspaceScope:undefined};ctx.ytmStudy=null;ctx.studyOptions=undefined;ctx.filters.areaId='Y6';ctx.filters.siteId='';ctx.resultView={...ctx.resultView,analysis:'SC',source:'GA',faultId:undefined};ctx.benchmark=reference;
 const rows=compactScRows(ctx);assert.equal(rows.length,505);assert.equal(rows.filter(r=>r.raw.Hesap_Durumu==='CALCULATED').length,505);assert.doesNotMatch(JSON.stringify(rows),/sc1Lg|GA_1F|status_1F|Z2_|Z0_/);
 const selection={analysis:'SC' as const,source:'GA' as const,table:'SC_BusResults_Raw',metric:'ikss3FKa',scMode:mode};ctx.benchmarkMap=selection;const data=buildBenchmarkMapData(ctx,selection);let compared=0;
 for(const site of network.sites.filter(s=>s.areaId==='Y6')){const r=rows.filter(r=>r.siteIds?.includes(site.id)),max=r.length?Math.max(...r.map(r=>r.metrics.ikss.ga!)):null;if(max!==null){assert.ok(Math.abs(data.sites.get(site.id)!.value!-max)<1e-9);compared++;}}
 const pfAvailable=rows.filter(r=>r.metrics.ikss.pf!==null),absolute=pfAvailable.map(r=>Math.abs(r.raw.diagnosticDelta_kA as number)).sort((a,b)=>a-b);assert.equal(rows.filter(r=>r.metrics.ikss.delta!==null).length,0);
 proof.modes.push({mode,cachedRhs,electricalTargets:targets.length,solved:errors.length,maximumDeltaFromSuppliedKa:Math.max(...errors),sourceHash:fresh.identity.sourceHash,factorizations:fresh.factorizations,rhsCount:fresh.rhsCount,pfAvailable:pfAvailable.length,verifiedComparisons:0,diagnosticMaeKa:absolute.reduce((a,b)=>a+b,0)/absolute.length,diagnosticMaxKa:absolute.at(-1),mapStationsCompared:compared});
 if(mode==='MAX'){
  ctx.resultView.source='PF';ctx.benchmarkMap={...selection,source:'PF'};const map=buildBenchmarkMapData(ctx,ctx.benchmarkMap),site=network.sites.find(s=>network.buses.find(b=>b.sourceId==='B5332')?.siteIds.includes(s.id))!;assert.ok(site);const value=map.sites.get(site.id)!,card=equipmentCard(ctx,site);assert.equal(card.rows[0][1],value.representativeFid);assert.equal(card.status,'PF_REFERENCE_ONLY');assert.ok(value.value!==null);proof.ui.push({source:'PF',station:site.name,fid:value.representativeFid,nominalKv:value.nominalKv,ka:value.value,tooltip:card.rows[0],rule:'TM_MAXIMUM_SAME_CANONICAL_REFERENCE'});
 }
 console.log('VALIDATED '+JSON.stringify(proof.modes.at(-1)));
}
finishYtmStudy(study,'COMPLETE');assert.equal(study.status,'COMPLETE');assert.deepEqual(study.pendingCounts,{N1:0,SC_MAX:0,SC_MIN:0});assert.doesNotMatch(JSON.stringify(study),/sc1Lg|SC1_MAX|z2Ohm|z0Ohm/);
await writeFile('local-benchmark-results/sc-three-phase-sn4-private.json',JSON.stringify(proof,null,2));console.log('SN4_3PH_PROOF '+JSON.stringify(proof));clearScPreparationCache();
