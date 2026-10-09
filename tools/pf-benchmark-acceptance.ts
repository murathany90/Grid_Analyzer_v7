/** Local-only acceptance runner. Never writes real benchmark values into docs or CI. */
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { loadBenchmark } from '../src/importers/powerfactory-benchmark';
import { loadBenchmarkModel } from '../src/importers/powerfactory-benchmark/model';
import { benchmarkLfReference,benchmarkControlContext } from '../src/domain/benchmark/reference';
import { preflightPowerFactoryReference } from '../src/analysis/validation/powerfactory-preflight';
import { applyPowerFactoryControlContext } from '../src/analysis/validation/powerfactory-control-context';
import { BrowserJsPowerFlowEngine } from '../src/analysis/api/browser-js-engine';
import { emptyScenario } from '../src/domain/scenario/overlay';
import { identity } from '../src/domain/calculation/identity';
import { preflightBenchmark,metricRows,metricStatistics,METRICS } from '../src/domain/benchmark/comparison';
import { auditShortCircuitReadiness } from '../src/importers/powerfactory-benchmark/readiness';
import { rowObject } from '../src/domain/benchmark/types';
import { validateAcOutages,type AcOutage } from '../src/analysis/contingency-ac';
const [modelPath,benchmarkPath,tag='local']=process.argv.slice(2);if(!modelPath||!benchmarkPath)throw Error('Usage: model.zip benchmark.zip tag [--solve]');
const start=performance.now();let maxHeap=process.memoryUsage().heapUsed;const timer=setInterval(()=>maxHeap=Math.max(maxHeap,process.memoryUsage().heapUsed),50);
try{
  const file=async(path:string)=>new File([await readFile(path)],path.split(/[\\/]/).at(-1)!);
  const benchmark=await loadBenchmark(await file(benchmarkPath)),loaded=await loadBenchmarkModel(await file(modelPath));
  if(loaded.network.studyCase!==benchmark.groups.LF.identity.studyCase)throw Error('BENCHMARK_IDENTITY_MISMATCH');
  const reference=benchmarkLfReference(benchmark),control=benchmarkControlContext(benchmark),network=applyPowerFactoryControlContext(loaded.network,control);
  let fullAc:unknown=null,digest:string|null=null,statistics:unknown=null;
  if(process.argv.includes('--solve')){
    // --baseline-engine is local-only: extract the recorded base's src into this ignored directory.
    const baselinePath='../.local-fixtures/base-code/src/analysis/api/browser-js-engine.ts';
    const Engine=process.argv.includes('--baseline-engine')?(await import(baselinePath)).BrowserJsPowerFlowEngine:BrowserJsPowerFlowEngine;
    const scenario=emptyScenario(),result=await new Engine().runPowerFlow({network,scenario,identity:identity(network.modelHash,scenario,'powerFlow')});
    const stable=(value:unknown):unknown=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).filter(([k,v])=>typeof v==='object'||!/(?:Ms|Seconds)$|elapsed|duration|timestamp/i.test(k)).map(([k,v])=>[k,stable(v)])):value;
    digest=createHash('sha256').update(JSON.stringify(stable({buses:result.buses,branches:result.branches,generators:result.generators,status:result.status,converged:result.converged,iterations:result.iterations,rounds:result.rounds,diagnostics:result.diagnostics}))).digest('hex');
    const gate=preflightBenchmark(benchmark,network,result),rows=Object.values(benchmark.groups.LF.tables).filter(t=>METRICS[t.name]).flatMap(t=>metricRows(t,gate));statistics=metricStatistics(rows);
    fullAc={status:result.status,converged:result.converged,buses:result.buses.length,branches:result.branches.length,generators:result.generators.length,iterations:result.iterations,preflight:preflightPowerFactoryReference(reference,network,result).status,benchmarkGate:gate.status,gateReasons:gate.reasons};
  }
  let n1Ac:unknown=null;
  if(process.argv.includes('--n1')){
    const table=benchmark.groups.N1.tables.N1_Cases_Raw,rows=table.rows.map(r=>rowObject(table,r));
    const selected=rows.find(r=>r.outageClass==='ElmLne'&&network.lines.some(l=>l.sourceId===r.outageFid&&l.inService));
    if(!selected)throw Error('N1_NO_IN_SERVICE_CASE');
    const mesh=rows.find(r=>r!==selected&&r.outageClass==='ElmLne'&&network.lines.some(l=>l.sourceId===r.outageFid&&l.inService&&network.lines.some(other=>other.id!==l.id&&other.inService&&(other.from===l.from&&other.to===l.to||other.from===l.to&&other.to===l.from))));
    const outages=[selected,...mesh?[mesh]:[]].map(r=>({caseId:String(r.caseId),fid:String(r.outageFid),sourceClass:'ElmLne'} as AcOutage));
    n1Ac=(await validateAcOutages(network,emptyScenario(),outages)).map(r=>({outage:r.outage,status:r.status,reason:r.reason,buses:r.result?.buses.length??0,branches:r.result?.branches.length??0,elapsedMs:r.elapsedMs,identity:r.identity}));
  }
  const report={tag,modelJsonSha256:loaded.modelJsonSha256,classCount:Object.keys(network.classCounts).length,groups:Object.fromEntries(Object.entries(benchmark.groups).map(([a,g])=>[a,{identity:g.identity,workbook:g.workbook,tables:Object.fromEntries(Object.values(g.tables).map(t=>[t.name,{rows:t.rows.length,metadata:Object.keys(t.metadata).length,columns:t.headers.length}]))}])),controlLoads:control.loads.length,fullAc,digest,statistics,n1Ac,readinessCounts:auditShortCircuitReadiness(loaded.raw).counts,elapsedMs:performance.now()-start,maxHeapBytes:Math.max(maxHeap,process.memoryUsage().heapUsed),rssBytes:process.memoryUsage().rss};
  await mkdir('local-benchmark-results',{recursive:true});await writeFile(resolve('local-benchmark-results',tag+'.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({tag,fullAc,digest,seconds:report.elapsedMs/1000,maxHeapMiB:report.maxHeapBytes/1024**2}));
}finally{clearInterval(timer);}
