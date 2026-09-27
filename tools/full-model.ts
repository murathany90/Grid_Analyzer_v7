import {readFile,readdir,stat,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {DgsModel} from '../src/importers/dgs/index';
import {mapCanonical} from '../src/importers/dgs/canonical';
import {prepareModel} from '../src/analysis/power-flow/preparation';
import {solveNR,selfTests} from '../src/analysis/power-flow/js/index';
import {BrowserJsPowerFlowEngine} from '../src/analysis/api/browser-js-engine';
import {emptyScenario} from '../src/domain/scenario/overlay';
import {identity} from '../src/domain/calculation/identity';
const report:unknown[]=[];
const dir='control1',names=(await readdir(dir).catch(()=>[])).filter(n=>n.endsWith('.json'));
if(!names.length){console.log('SKIPPED / SOURCE_UNAVAILABLE');process.exitCode=0;}
for(const name of names){
  if(process.env.MODEL_FILTER&&!name.includes(process.env.MODEL_FILTER))continue;
  const started=performance.now(),size=(await stat(`${dir}/${name}`)).size;
  if(size<200){report.push({name,size,status:'SKIPPED / LFS_POINTER'});continue;}
  const heapBefore=process.memoryUsage().heapUsed,bytes=await readFile(`${dir}/${name}`),hash=createHash('sha256').update(bytes).digest('hex'),parseStart=performance.now();
  const raw=JSON.parse(bytes.toString('utf8')),parseMs=performance.now()-parseStart,heapAfterParse=process.memoryUsage().heapUsed;
  const source=new DgsModel(raw,name,size),importStart=performance.now();await source.build();const importMs=performance.now()-importStart;
  const mapStart=performance.now(),network=mapCanonical(source,hash),canonicalMs=performance.now()-mapStart,heapAfterCanonical=process.memoryUsage().heapUsed;
  const prepStart=performance.now(),prepared=prepareModel(network),preparationMs=performance.now()-prepStart;
  const result=solveNR(prepared.model),engine=new BrowserJsPowerFlowEngine();
  const scenario=emptyScenario(),line=network.lines.find(l=>l.inService&&prepared.branches.some(b=>b.id===l.id));
  const scenarioOverlay=line?{...scenario,lineStatus:{[line.id]:false}}:scenario;
  const scenarioStart=performance.now(),sc=await engine.runPowerFlow({network,scenario:scenarioOverlay,identity:identity(hash,scenarioOverlay,'powerFlow')});
  const scenarioAcMs=performance.now()-scenarioStart;
  const fast=await engine.runFastAc({network,scenario,identity:identity(hash,scenario,'fastAc')});
  const dc=await engine.runDcPowerFlow({network,scenario,identity:identity(hash,scenario,'dc')});
  const entry={name,size,records:network.records,counts:{sites:network.sites.length,lines:network.lines.length,transformers:network.transformers.length,generators:network.generators.length,loads:network.loads.length},...prepared.diagnostics,timing:{parseMs,importMs,canonicalMs,preparationMs,fullAcMs:result.elapsedMs,scenarioAcMs,totalMs:performance.now()-started},fullAc:{status:result.status,converged:result.converged,iterations:result.iterations,rounds:result.rounds,maxMismatchMW:result.maxMismatchMW},scenarioAc:{lineId:line?.id,status:sc.status,iterations:sc.iterations,maxMismatchMw:sc.maxMismatchMw},fast:{status:fast.status,diagnostics:fast.diagnostics,runtimeMs:fast.elapsedMs},dc:{status:dc.status,diagnostics:dc.diagnostics,runtimeMs:dc.elapsedMs},memory:{source:'Node process.heapUsed; not browser heap',heapBefore,heapAfterParse,heapAfterCanonical,heapAfterSolve:process.memoryUsage().heapUsed},warnings:prepared.warnings};
  report.push(entry);console.log(JSON.stringify({name,size,buses:prepared.model.n,branches:prepared.model.branches.length,fullAc:entry.fullAc,fast:fast.status,dc:dc.status,totalMs:entry.timing.totalMs}));
}
await mkdir('docs/validation',{recursive:true});await writeFile('docs/validation/full-model-results.json',JSON.stringify({created:new Date().toISOString(),selfTests:selfTests(),models:report},null,2));
