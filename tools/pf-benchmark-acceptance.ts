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
const [modelPath,benchmarkPath,tag='local']=process.argv.slice(2);if(!modelPath||!benchmarkPath)throw Error('Usage: model.zip benchmark.zip tag [--solve]');
const start=performance.now();let maxHeap=process.memoryUsage().heapUsed;const timer=setInterval(()=>maxHeap=Math.max(maxHeap,process.memoryUsage().heapUsed),50);
try{
  const file=async(path:string)=>new File([await readFile(path)],path.split(/[\\/]/).at(-1)!);
  const benchmark=await loadBenchmark(await file(benchmarkPath)),loaded=await loadBenchmarkModel(await file(modelPath));
  if(loaded.network.studyCase!==benchmark.groups.LF.identity.studyCase)throw Error('BENCHMARK_IDENTITY_MISMATCH');
  const reference=benchmarkLfReference(benchmark),control=benchmarkControlContext(benchmark),network=applyPowerFactoryControlContext(loaded.network,control);
  let fullAc:unknown=null,digest:string|null=null;
  if(process.argv.includes('--solve')){
    const scenario=emptyScenario(),result=await new BrowserJsPowerFlowEngine().runPowerFlow({network,scenario,identity:identity(network.modelHash,scenario,'powerFlow')});
    digest=createHash('sha256').update(JSON.stringify({buses:result.buses,branches:result.branches,generators:result.generators,status:result.status,converged:result.converged,iterations:result.iterations,rounds:result.rounds,diagnostics:Object.fromEntries(Object.entries(result.diagnostics).filter(([k])=>!/time|elapsed|duration/i.test(k)))})).digest('hex');
    fullAc={status:result.status,converged:result.converged,buses:result.buses.length,branches:result.branches.length,generators:result.generators.length,iterations:result.iterations,preflight:preflightPowerFactoryReference(reference,network,result).status};
  }
  const report={tag,modelJsonSha256:loaded.modelJsonSha256,classCount:Object.keys(network.classCounts).length,groups:Object.fromEntries(Object.entries(benchmark.groups).map(([a,g])=>[a,{identity:g.identity,workbook:g.workbook,tables:Object.fromEntries(Object.values(g.tables).map(t=>[t.name,{rows:t.rows.length,metadata:Object.keys(t.metadata).length,columns:t.headers.length}]))}])),controlLoads:control.loads.length,fullAc,digest,elapsedMs:performance.now()-start,maxHeapBytes:Math.max(maxHeap,process.memoryUsage().heapUsed),rssBytes:process.memoryUsage().rss};
  await mkdir('local-benchmark-results',{recursive:true});await writeFile(resolve('local-benchmark-results',tag+'.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({tag,fullAc,digest,seconds:report.elapsedMs/1000,maxHeapMiB:report.maxHeapBytes/1024**2}));
}finally{clearInterval(timer);}
