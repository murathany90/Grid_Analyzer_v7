import {mkdir,writeFile} from 'node:fs/promises';
import {discoverModelArchives,readLocalDgsArchive,summarizeLocalRuns,type LocalStatus} from './local-model-input';
import {DgsModel} from '../src/importers/dgs/index';
import {mapCanonical} from '../src/importers/dgs/canonical';
import {prepareModel} from '../src/analysis/power-flow/preparation';
import {solveNR,selfTests} from '../src/analysis/power-flow/js/index';
import {BrowserJsPowerFlowEngine} from '../src/analysis/api/browser-js-engine';
import {emptyScenario} from '../src/domain/scenario/overlay';
import {identity} from '../src/domain/calculation/identity';
const report:unknown[]=[],statuses:LocalStatus[]=[],discovery=await discoverModelArchives(process.env.MODEL_ROOT??'kontrol1',process.env.MODEL_FILTER),listOnly=process.argv.includes('--list');
for(const file of discovery.models){
 try{
  if(listOnly){report.push({file,status:'NOT_RUN',reason:'DISCOVERED_ONLY'});statuses.push('NOT_RUN');continue;}
  const started=performance.now(),heapBefore=process.memoryUsage().heapUsed,parseStart=performance.now(),input=await readLocalDgsArchive(file);
  if(input.status==='SKIP'){report.push({file,...input});statuses.push('SKIP');continue;}
  const {name,size,raw,modelHash:hash}=input,parseMs=performance.now()-parseStart,heapAfterParse=process.memoryUsage().heapUsed;
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
  const status:LocalStatus=!result.converged||!sc.converged||!fast.converged||!dc.converged?'FAIL':!line?'SKIP':'PASS';statuses.push(status);
  const entry={file,status,reason:!line?'NO_OUTAGE_CANDIDATE':'',zipSha256:input.zipSha256,modelHash:hash,name,size,records:network.records,counts:{sites:network.sites.length,lines:network.lines.length,transformers:network.transformers.length,generators:network.generators.length,loads:network.loads.length},...prepared.diagnostics,timing:{parseMs,importMs,canonicalMs,preparationMs,fullAcMs:result.elapsedMs,scenarioAcMs,totalMs:performance.now()-started},fullAc:{status:result.status,converged:result.converged,iterations:result.iterations,rounds:result.rounds,maxMismatchMW:result.maxMismatchMW},scenarioAc:{lineId:line?.id,status:sc.status,iterations:sc.iterations,maxMismatchMw:sc.maxMismatchMw},fast:{status:fast.status,diagnostics:fast.diagnostics,runtimeMs:fast.elapsedMs},dc:{status:dc.status,diagnostics:dc.diagnostics,runtimeMs:dc.elapsedMs},memory:{source:'Node process.heapUsed; not browser heap',heapBefore,heapAfterParse,heapAfterCanonical,heapAfterSolve:process.memoryUsage().heapUsed},warnings:prepared.warnings};
  report.push(entry);console.log(JSON.stringify({name,status,size,buses:prepared.model.n,branches:prepared.model.branches.length,fullAc:entry.fullAc,fast:fast.status,dc:dc.status,totalMs:entry.timing.totalMs}));
 }catch(error){statuses.push('FAIL');report.push({file,status:'FAIL',reason:error instanceof Error?error.message:String(error)});}
}
const summary=summarizeLocalRuns(statuses,discovery.reason),checks=selfTests();
if(checks.some(c=>!c.pass)){summary.status='FAIL';summary.reason='SOLVER_SELF_TEST_FAILED';}
console.log(JSON.stringify({summary,discovery}));
process.exitCode=summary.status==='FAIL'?1:summary.status==='SKIP'&&process.env.REQUIRE_MODELS==='1'?2:0;
await mkdir('local-benchmark-results',{recursive:true});await writeFile('local-benchmark-results/full-model-results.json',JSON.stringify({created:new Date().toISOString(),summary,discovery,selfTests:checks,models:report,scope:'NUMERICAL_REGRESSION_ONLY; NOT_PF_OR_IEC_VALIDATED'},null,2));
