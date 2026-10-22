/** Fresh real-model computations; private raw results never enter tracked docs. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {basename,join} from 'node:path';
import {cpus,totalmem,platform,release} from 'node:os';
import assert from 'node:assert/strict';
import {loadBenchmarkModel} from '../src/importers/powerfactory-benchmark/model';
import {loadBenchmark} from '../src/importers/powerfactory-benchmark';
import {rowObject} from '../src/domain/benchmark/types';
import {emptyScenario} from '../src/domain/scenario/overlay';
import {defaultAnalysisSettings} from '../src/domain/calculation/analysis-settings';
import {identity} from '../src/domain/calculation/identity';
import {BrowserJsPowerFlowEngine} from '../src/analysis/api/browser-js-engine';
import {adaptShortCircuitSources} from '../src/importers/powerfactory-benchmark/short-circuit-source';
import {engineeringSourceOptions} from '../src/analysis/short-circuit/engineering-profile';
import {calculateThreePhase,clearScPreparationCache} from '../src/analysis/short-circuit';
import {reconcileYtmTimings,runYtmStudy,type YtmStudyProfile} from '../src/analysis/ytm-study';
import {ytmScRows,ytmN1Rows,ytmReferenceRows} from '../src/analysis/ytm-study/export';

const [modelPath,tag,area='Y9',profile='BALANCED',referencePath]=process.argv.slice(2),out='local-benchmark-results/n1-sc-20261022';
if(!modelPath||!tag)throw Error('Usage: model.zip SN2|SN3|SN4 YTM_ID FAST|BALANCED reference.zip?');
await mkdir(out,{recursive:true});
const t=performance.now(),loaded=await loadBenchmarkModel(new File([await readFile(modelPath)],basename(modelPath))),n=loaded.network,scenario=emptyScenario();
const proof:Record<string,unknown>={tag,studyCase:n.studyCase,modelHash:n.modelHash,importMs:performance.now()-t,hardware:{cpu:cpus()[0]?.model,threads:cpus().length,memoryBytes:totalmem(),os:platform()+' '+release(),node:process.version}};
console.log(tag+' IMPORT '+JSON.stringify(proof));
const prep=performance.now(),contexts={MAX:adaptShortCircuitSources(loaded.raw,n,undefined,engineeringSourceOptions('MAX',profile!=='FAST')),MIN:adaptShortCircuitSources(loaded.raw,n,undefined,engineeringSourceOptions('MIN',profile!=='FAST'))},prepMs=performance.now()-prep;
console.log(tag+' SOURCES '+JSON.stringify({prepMs,active:contexts.MAX.sources.filter(s=>s.inService).reduce<Record<string,number>>((a,s)=>{const key=s.sourceClass+':'+s.parameterStatus;a[key]=(a[key]??0)+1;return a;},{}),invalidBranches:contexts.MAX.invalidBranches.length}));
const study=await runYtmStudy(n,scenario,contexts,{ytmId:area,profile:profile as YtmStudyProfile},{onProgress:(stage,detail)=>{if(['MODEL_PREPARATION','CATALOG','DC_SCREEN','SC_BATCH','AC_FULL','AC_APPROX','REPORT','HYBRID_AC_CASE'].includes(stage))console.log(tag+' '+stage+' '+String(detail?.message??''));},onCheckpoint:r=>{void writeFile(join(out,tag+'-'+area+'-'+profile+'-checkpoint-private.json'),JSON.stringify({status:r.status,elapsedMs:r.elapsedMs,n1:r.n1?.counts,scMax:r.scMax?.counts,scMin:r.scMin?.counts}));}});
study.stageMs.SC_SOURCE_PREP+=prepMs;study.elapsedMs+=prepMs;reconcileYtmTimings(study);
assert.equal(study.n1?.cases.length,study.catalog.length);assert.equal(ytmScRows(study,n).length,study.faultTargets.length);
for(const sc of [study.scMax,study.scMin]){assert.equal(sc?.faults.length,study.faultTargets.length);for(const f of sc?.faults??[]){assert.equal(f.ipKa,null);if(f.ikssKa!==null){assert.ok(f.ikssKa>0&&Number.isFinite(f.ikssKa));assert.ok(f.skssMva!==null&&Math.abs(f.skssMva-Math.sqrt(3)*f.nominalKv!*f.ikssKa)<1e-7);assert.ok(f.residual!<1e-6);assert.equal(f.quality,'ENGINEERING_APPROX');}}}
const native=adaptShortCircuitSources(loaded.raw,n),sample=study.scMax?.faults.find(f=>f.ikssKa!==null)?.physicalTerminalFid??study.faultTargets[0];
const baselineTargets=[...new Map(study.scMax?.faults.filter(f=>f.electricalBusId).map(f=>[f.electricalBusId,f.physicalTerminalFid])).values()],nativeBatch=await calculateThreePhase(n,scenario,native,baselineTargets,{faultType:'3PH',calculateMode:'MAX',voltageFactor:1.1,factorProvenance:'NATIVE_BASELINE_NO_ASSUMPTIONS',edition:null,rfOhm:0,xfOhm:0,maxFaults:10000,timeBudgetMs:30000});proof.nativeBaseline={electricalTargets:baselineTargets.length,calculated:nativeBatch.faults.filter(f=>f.ikssKa!==null).length,counts:nativeBatch.counts};
proof.nativeBefore=sample?(await calculateThreePhase(n,scenario,native,[sample],{faultType:'3PH',calculateMode:'MAX',voltageFactor:1.1,factorProvenance:'BASELINE_NO_ASSUMPTIONS',edition:null,rfOhm:0,xfOhm:0,maxFaults:1,timeBudgetMs:30000})).faults[0]:null;
proof.result={status:study.status,elapsedMs:study.elapsedMs,stageMs:study.stageMs,n1:study.n1?.counts,quality:study.qualityCounts,physical:study.faultTargets.length,electrical:study.electricalTargets,scMax:{counts:study.scMax?.counts,factorizations:study.scMax?.factorizations,rhs:study.scMax?.rhsCount,minIkss:Math.min(...(study.scMax?.faults.filter(f=>f.ikssKa!==null).map(f=>f.ikssKa!)??[])),maxIkss:Math.max(...(study.scMax?.faults.map(f=>f.ikssKa??0)??[])),blockedReasons:[...new Set(study.scMax?.faults.filter(f=>f.ikssKa===null).flatMap(f=>f.reasons))]},scMin:study.scMin?.counts};
console.log(tag+' RESULT '+JSON.stringify(proof.result));
if(process.env.GA_RUN_BASE_LF==='1'){
 const settings=defaultAnalysisSettings(),lf=await new BrowserJsPowerFlowEngine().runPowerFlow({network:n,scenario,analysisSettings:settings,identity:identity(n.modelHash,scenario,'powerFlow',{analysisSettings:settings})});proof.lf={status:lf.status,converged:lf.converged,residualMw:lf.maxMismatchMw,buses:lf.buses.length,branches:lf.branches.length,elapsedMs:lf.elapsedMs,diagnostics:lf.diagnostics};await writeFile(join(out,tag+'-lf-private.json'),JSON.stringify(lf));console.log(tag+' LF '+JSON.stringify({...proof.lf as object,diagnostics:undefined}));
}
if(referencePath){
 const reference=await loadBenchmark(new File([await readFile(referencePath)],basename(referencePath))),rows=ytmReferenceRows(study,n,reference),matched=rows.filter(r=>typeof r.delta_kA==='number'),errors=matched.map(r=>Math.abs(r.delta_kA as number)).sort((a,b)=>a-b);
 proof.scComparison={identity:reference.groups.SC.identity,referenceHeaders:reference.groups.SC.tables.SC_BusResults_Raw?.headers,sample:reference.groups.SC.tables.SC_BusResults_Raw?.rows.slice(0,1).map(r=>rowObject(reference.groups.SC.tables.SC_BusResults_Raw,r)),matched:matched.length,unmatched:rows.length-matched.length,mae:errors.length?errors.reduce((a,b)=>a+b,0)/errors.length:null,p95:errors.length?errors[Math.ceil(.95*errors.length)-1]:null,max:errors.at(-1)??null,worst20:matched.sort((a,b)=>Math.abs(b.delta_kA as number)-Math.abs(a.delta_kA as number)).slice(0,20)};
 await writeFile(join(out,tag+'-'+area+'-reference-rows-private.json'),JSON.stringify(rows));console.log(tag+' PF '+JSON.stringify(proof.scComparison));
}
await writeFile(join(out,tag+'-'+area+'-'+profile+'-proof-private.json'),JSON.stringify(proof,null,2));await writeFile(join(out,tag+'-'+area+'-'+profile+'-study-private.json'),JSON.stringify(study));await writeFile(join(out,tag+'-'+area+'-'+profile+'-ui-private.json'),JSON.stringify({network:n,study}));
assert.equal(ytmN1Rows(study).length,study.catalog.length);clearScPreparationCache();
