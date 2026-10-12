/** Explicit local real-data acceptance. Never read a result cache or write private data to docs. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {basename,join} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {loadBenchmarkModel} from '../src/importers/powerfactory-benchmark/model';
import {loadBenchmark} from '../src/importers/powerfactory-benchmark';
import {benchmarkControlContext} from '../src/domain/benchmark/reference';
import {applyPowerFactoryControlContext} from '../src/analysis/validation/powerfactory-control-context';
import {defaultAnalysisSettings} from '../src/domain/calculation/analysis-settings';
import {identity} from '../src/domain/calculation/identity';
import {emptyScenario,scenarioSignature} from '../src/domain/scenario/overlay';
import {BrowserJsPowerFlowEngine} from '../src/analysis/api/browser-js-engine';
import {buildN1CandidateCatalog,filterN1CatalogCandidates} from '../src/domain/n1/catalog';
import {runHybridN1} from '../src/analysis/contingency-hybrid';
import {n1ControlEvidence} from '../src/analysis/contingency-ac/control-evidence';
import {selectFaultTerminals} from '../src/domain/benchmark/study-scope';
import {adaptShortCircuitSources} from '../src/importers/powerfactory-benchmark/short-circuit-source';
import {calculateThreePhase,clearScPreparationCache,scFaultCatalog,type ScProfile} from '../src/analysis/short-circuit';
import {preflightBenchmark,metricRows,metricStatistics,METRICS} from '../src/domain/benchmark/comparison';
import {auditScPartition} from '../src/domain/benchmark/sc-partition';

const [modelPath,referencePath,tag]=process.argv.slice(2);
if(!modelPath||!referencePath||!/^SN[347]$/.test(tag))throw Error('Usage: model.zip reference.zip|- SN3|SN4|SN7');
const out='local-benchmark-results/engineering-20261012',sha=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
await mkdir(out,{recursive:true});
const proof:Record<string,unknown>={tag,sourceSha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),startedUtc:new Date().toISOString(),freshImport:true,cachedResultsUsed:false,stages:[]};
const stage=async<T>(name:string,fn:()=>Promise<T>|T)=>{const start=performance.now(),value=await fn();(proof.stages as unknown[]).push({name,wallMs:performance.now()-start});console.log(tag+' '+name+' COMPLETE');return value;};
try{
  const bytes=await readFile(modelPath);proof.modelFile={path:modelPath,sha256:sha(bytes),bytes:bytes.length};
  const loaded=await stage('NEW_MODEL_IMPORT',()=>loadBenchmarkModel(new File([bytes],basename(modelPath))));
  const benchmark=referencePath==='-'?null:await stage('NEW_PF_IMPORT',async()=>{const bytes=await readFile(referencePath);proof.referenceFile={path:referencePath,sha256:sha(bytes),bytes:bytes.length};return loadBenchmark(new File([bytes],basename(referencePath)));});
  const network=benchmark?applyPowerFactoryControlContext(loaded.network,benchmarkControlContext(benchmark)):loaded.network;
  const settings=defaultAnalysisSettings(),scenario=emptyScenario(),engine=new BrowserJsPowerFlowEngine();
  proof.settings=settings;proof.baseMva=network.baseMva;proof.frequencyHz={requested:50,nativeVerified:false};
  proof.referenceIdentity=benchmark?Object.fromEntries(Object.entries(benchmark.groups).map(([k,g])=>[k,g.identity])):{status:'SOURCE_UNAVAILABLE'};
  const lf=await stage('NEW_NATIVE_LF',()=>engine.runPowerFlow({network,scenario,identity:identity(network.modelHash,scenario,'powerFlow',{analysisSettings:settings}),analysisSettings:settings}));
  assert.equal(lf.converged,true);assert.ok(lf.maxMismatchMw!==null&&lf.maxMismatchMw<=settings.powerFlow.nodalToleranceKva/1000);
  proof.lf={status:lf.status,converged:lf.converged,maxMismatchMw:lf.maxMismatchMw,elapsedMs:lf.elapsedMs,buses:lf.buses.length,branches:lf.branches.length,diagnostics:lf.diagnostics,control:n1ControlEvidence(network,lf,settings)};
  const area=network.sites.find(s=>/orta.*anadolu/i.test(s.areaName))?.areaId;
  assert.ok(area,'real model must have the requested OA scope');
  const catalog=buildN1CandidateCatalog(network,scenario,{includeAllVoltages:true}),scoped=filterN1CatalogCandidates(catalog.candidates,{ytmIds:[area],endpointScope:'BOTH'});
  const pilots=[scoped.find(c=>c.sourceClass==='ElmLne'&&c.topology==='NON_ISLANDING'),scoped.find(c=>c.sourceClass==='ElmTr2'&&c.topology==='ISLANDING')??scoped.find(c=>c.topology==='ISLANDING')].filter(c=>!!c);
  assert.equal(pilots.length,2);proof.catalog={global:catalog.candidates.length,scope:scoped.length,islanding:scoped.filter(c=>c.topology==='ISLANDING').length,pilots};
  const strict=await stage('FRESH_BASE_STRICT_PREFLIGHT',()=>runHybridN1(network,scenario,{analysisSettings:settings,solveBase:async()=>lf,policy:{acBudgetCases:1}}));
  proof.strict={status:strict.status,counts:strict.counts,reason:strict.reason};
  const hybrid=await stage('NEW_DC_AND_TWO_FULL_AC_POSTS',()=>runHybridN1(network,scenario,{analysisSettings:settings,studyProfile:'NATIVE_PARTIAL_CONTROLS',solveBase:async()=>lf,filter:{ytmIds:[area],endpointScope:'BOTH'},catalogCandidateIds:pilots.map(c=>c!.candidateId),selectedCandidateIds:pilots.map(c=>c!.candidateId),solveAllSelected:true,policy:{acBudgetCases:2,perCaseTimeLimitMs:120000,globalTimeLimitMs:480000}}));
  assert.equal(hybrid.counts.AC_ATTEMPTED,2);assert.ok(hybrid.counts.AC_NUMERICALLY_SOLVED>0);proof.n1=hybrid;
  if(tag==='SN7'){
    // This is a new controlled test ledger, never the historical user's S2.
    let overlay=scenario;const ledger:unknown[]=[];
    for(const [i,pilot] of pilots.entries()){const collection=pilot!.sourceClass==='ElmLne'?network.lines:network.transformers,target=collection.find(e=>e.id===pilot!.equipmentId)!;overlay=pilot!.sourceClass==='ElmLne'?{...overlay,lineStatus:{...overlay.lineStatus,[target.id]:false}}:{...overlay,transformerStatus:{...overlay.transformerStatus,[target.id]:false}};const post=await stage('NEW_CONTROLLED_S'+(i+1),()=>engine.runPowerFlow({network,scenario:overlay,identity:identity(network.modelHash,overlay,'powerFlow',{analysisSettings:settings}),analysisSettings:settings}));ledger.push({label:'NEW_CONTROLLED_TEST_S'+(i+1),originalS2:false,outage:pilot,scenarioHash:scenarioSignature(overlay),status:post.status,converged:post.converged,maxMismatchMw:post.maxMismatchMw,buses:post.buses.length,branches:post.branches.length});}proof.newControlledLedger=ledger;
  }
  const targets=selectFaultTerminals(network,{ytmIds:[area]}),native=adaptShortCircuitSources(loaded.raw,network),profile:ScProfile={schemaVersion:2,faultType:'3PH',calculateMode:'MAX',voltageFactor:1.1,factorProvenance:'EXPLICIT_APPROVED_NETWORK_APPROXIMATION; NOT_NORMATIVE',edition:null,frequencyHz:50,rfOhm:0,xfOhm:0,maxFaults:5,timeBudgetMs:120000};
  const scCatalog=scFaultCatalog(network,scenario,native,targets);proof.scCatalog=scCatalog;
  const selected:string[]=[],seen=new Set<number>();for(const fid of targets){const bus=network.buses.find(b=>b.sourceId===fid)!;if(!seen.has(bus.vnKv)){selected.push(fid);seen.add(bus.vnKv);if(selected.length===3)break;}}
  assert.equal(selected.length,3);
  const scNative=await stage('NEW_NATIVE_3PH_MAX',()=>calculateThreePhase(network,scenario,native,selected,profile));proof.scNative=scNative;
  const options={externalGridFactor:{value:1.1,provenance:'EXPLICIT_USER_NETWORK_APPROXIMATION'},missingMachineXdssPu:.2,missingMachineRPu:.01,converterAngleDeg:-90,converterTerminalBasis:true,allowMixedNominalKv:true,provenance:'EXPLICIT_USER_NETWORK_APPROXIMATION; IEC_KG_KT_KKW_UNVERIFIED'};
  const diagnostic=adaptShortCircuitSources(loaded.raw,network,undefined,options),sc=await stage('NEW_DIAGNOSTIC_3PH_MAX',()=>calculateThreePhase(network,scenario,diagnostic,selected,profile));proof.scDiagnostic=sc;
  assert.ok(sc.faults.every(f=>f.ipKa===null&&f.ibKa===null&&f.ithKa===null));
  const alias=sc.faults.flatMap(f=>f.physicalTerminalFids).find(fid=>!selected.includes(fid)&&targets.includes(fid));
  if(alias){const reuse=await stage('NEW_ALIAS_BATCH_REUSE',()=>calculateThreePhase(network,scenario,diagnostic,[alias],profile));assert.equal(reuse.rhsCount,0);assert.equal(reuse.factorizations,0);proof.scReuse=reuse;}
  const normative=await stage('NEW_NORMATIVE_REQUEST_BLOCKED',()=>calculateThreePhase(network,scenario,diagnostic,selected,{...profile,edition:'IEC60909-0:2016',breakerOpeningTimeS:.1,thermalClearingTimeS:1}));proof.scNormative=normative;assert.equal(normative.counts.BLOCKED,3);assert.equal(normative.rhsCount,0);assert.equal(normative.factorizations,0);assert.ok(normative.faults.every(f=>f.ikssKa===null&&f.skssMva===null));
  if(benchmark){const gate=preflightBenchmark(benchmark,network,lf),rows=Object.values(benchmark.groups.LF.tables).filter(t=>METRICS[t.name]).flatMap(t=>metricRows(t,gate,undefined,{network,scenario,settings,lfResult:lf}));proof.lfComparison={gate:gate.status,comparable:rows.filter(r=>r.delta!==null).length,statistics:metricStatistics(rows)};proof.scComparison=sc.faults.map(f=>auditScPartition(benchmark,f,profile));assert.equal((proof.lfComparison as {comparable:number}).comparable,0);}
  proof.resultIdentity={modelHash:network.modelHash,scenarioHash:scenarioSignature(scenario)};
  proof.status='PASS_SOFTWARE_WITH_PARTIAL_ENGINEERING';proof.completedUtc=new Date().toISOString();
  // Genuine freshly computed snapshots for a separate rendered UI acceptance; all remain ignored.
  await writeFile(join(out,tag+'-fresh-ui-private.json'),JSON.stringify({network,benchmark,lf,settings,hybrid,sc,scContext:diagnostic,catalog:scCatalog,areaId:area}));
  console.log(JSON.stringify({tag,status:proof.status,lf:{buses:lf.buses.length,branches:lf.branches.length,residualMw:lf.maxMismatchMw},n1:hybrid.counts,sc:{physical:scCatalog.physicalTerminals,electrical:scCatalog.electricalPartitions,native:scNative.counts,diagnostic:sc.counts,normative:normative.counts},pfComparable:benchmark?0:null}));
}catch(error){proof.status='FAIL';proof.error=String(error);process.exitCode=1;console.error(tag+' FAILED; see ignored private proof');}
finally{clearScPreparationCache();await writeFile(join(out,tag+'-private-proof.json'),JSON.stringify(proof,null,2));}
