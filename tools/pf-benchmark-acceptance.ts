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
import {diagnosticStatistics} from '../src/domain/benchmark/diagnostic-statistics';
import { auditShortCircuitReadiness } from '../src/importers/powerfactory-benchmark/readiness';
import { rowObject } from '../src/domain/benchmark/types';
import { type AcContingency,type AcOutage } from '../src/analysis/contingency-ac';
import {boundedBenchmarkCalculation} from './bounded-benchmark-calculation';
import type {CalculationResult} from '../src/domain/results/types';
import type {N1ScreenResult} from '../src/domain/n1';
import {auditOutageTopology} from '../src/analysis/contingency-ac/topology-audit';
import {buildN1CandidateCatalog,filterN1CatalogCandidates} from '../src/domain/n1/catalog';
import {runHybridN1,DEFAULT_HYBRID_POLICY} from '../src/analysis/contingency-hybrid';
import {adaptShortCircuitSources} from '../src/importers/powerfactory-benchmark/short-circuit-source';
import {calculateThreePhase} from '../src/analysis/short-circuit';
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
    const gate=preflightBenchmark(benchmark,network,result),rows=Object.values(benchmark.groups.LF.tables).filter(t=>METRICS[t.name]).flatMap(t=>metricRows(t,gate,undefined,{network,scenario,lfResult:result,diagnostic:process.argv.includes('--diagnostic')}));statistics={certified:metricStatistics(rows),diagnosticCount:rows.filter(r=>r.diagnosticDelta!=null).length,diagnostic:diagnosticStatistics(rows),byVoltage:diagnosticStatistics(rows,'VOLTAGE'),byYtm:diagnosticStatistics(rows,'YTM')};
    if(process.argv.includes('--diagnostic')){
      const measured=diagnosticStatistics(rows),safe=measured.map(({worstPrivateFid,worstPrivateSide,...r})=>r);
      await mkdir('local-benchmark-results',{recursive:true});
      await writeFile(resolve('local-benchmark-results',tag+'-diagnostic-summary.json'),JSON.stringify(safe,null,2));
      const headers=['kind','metric','unit','nDiagnostic','bias_diag','MAE_diag','RMSE_diag','P50_diag','P95_diag','P99_diag','maxAbs_diag'];
      const csv=headers.join(',')+'\n'+safe.map(r=>headers.map(k=>String(r[k as keyof typeof r]??'')).join(',')).join('\n');
      await writeFile(resolve('local-benchmark-results',tag+'-diagnostic.csv'),csv);
      await writeFile(resolve('local-benchmark-results',tag+'-diagnostic.md'),'# EXPLORATORY; certified errors remain null\n\n|'+headers.join('|')+'|\n|'+headers.map(()=>'---').join('|')+'|\n'+safe.map(r=>'|'+headers.map(k=>String(r[k as keyof typeof r]??'null')).join('|')+'|').join('\n'));
      await writeFile(resolve('local-benchmark-results',tag+'-diagnostic-cells.json'),JSON.stringify(rows.filter(r=>r.diagnosticDelta!=null).sort((a,b)=>Math.abs(b.diagnosticDelta!)-Math.abs(a.diagnosticDelta!)),null,2));
    }
    fullAc={status:result.status,converged:result.converged,buses:result.buses.length,branches:result.branches.length,generators:result.generators.length,iterations:result.iterations,preflight:preflightPowerFactoryReference(reference,network,result).status,benchmarkGate:gate.status,gateReasons:gate.reasons};
  }
  let n1Ac:unknown=null,topologyAudit:unknown=null,hybrid:unknown=null,scCoverage:unknown=null,hybridStages:unknown=null;
  if(process.argv.includes('--n1')){
    const table=benchmark.groups.N1.tables.N1_Cases_Raw,rows=table.rows.map(r=>rowObject(table,r));
    const graph=auditOutageTopology(network,emptyScenario()),byKey=new Map(graph.edges.map(e=>[e.key,e]));
    const mapped=rows.map(r=>({row:r,edge:byKey.get(`${r.outageClass}:${r.outageFid}`)})),nonBridge=mapped.filter(r=>r.edge?.classification==='NON_BRIDGE'),bridge=mapped.filter(r=>r.edge?.classification==='BRIDGE');
    topologyAudit={pfCases:rows.length,bridge:bridge.length,nonBridge:nonBridge.length,unmapped:mapped.filter(r=>!r.edge).length,fullBusCount:graph.busCount,fullEdgeCount:graph.edges.length};
    const extremaTable=benchmark.groups.N1.tables.N1_RecordedExtrema_Raw,extremaCases=new Set(extremaTable.rows.map(r=>String(rowObject(extremaTable,r).caseId)));const prioritize=(a:typeof mapped[number],b:typeof mapped[number])=>Number(extremaCases.has(String(b.row.caseId)))-Number(extremaCases.has(String(a.row.caseId)))||String(a.row.caseId).localeCompare(String(b.row.caseId));nonBridge.sort(prioritize);bridge.sort(prioritize);
    const selected=[...nonBridge.slice(0,2),...bridge.slice(0,1)].map(({row:r})=>({caseId:String(r.caseId),fid:String(r.outageFid),sourceClass:String(r.outageClass)} as AcOutage));
    const tr=graph.edges.find(e=>e.sourceClass==='ElmTr2'&&e.classification==='NON_BRIDGE')??graph.edges.find(e=>e.sourceClass==='ElmTr2');if(tr)selected.push({caseId:`N1:ElmTr2:${tr.fid}`,sourceClass:'ElmTr2',fid:tr.fid});
    if(nonBridge.length<2||bridge.length<1||!tr)throw Error('N1_REAL_SELECTION_COVERAGE');
    const validated:AcContingency[]=[];for(const outage of selected){validated.push(await boundedBenchmarkCalculation<AcContingency>({kind:'AC',network,scenario:emptyScenario(),outage},120000));}
    n1Ac=validated.map(r=>({outage:r.outage,status:r.status,reason:r.reason,components:r.components,buses:r.result?.buses.length??0,branches:r.result?.branches.length??0,iterations:r.result?.iterations??null,maxMismatchMw:r.result?.maxMismatchMw??null,terminalResults:r.result?.buses,branchResults:r.result?.branches,elapsedMs:r.elapsedMs,identity:r.identity}));
    if(process.argv.includes('--hybrid')){
      const areas=[...new Set(network.sites.filter(s=>s.areaName==='Orta Anadolu YTM').map(s=>s.areaId))];if(areas.length!==1)throw Error('N1_SCOPE_YTM_ID_UNRESOLVED');
      const table=benchmark.groups.N1.tables.N1_RecordedExtrema_Raw,observations=table.rows.map(r=>rowObject(table,r)).flatMap(r=>Object.keys(METRICS[table.name]).map(metric=>({sourceClass:String(r.affectedClass??r.elementClass??''),fid:String(r.affectedFid??r.elementFid??''),metric,side:String(r.postPowerEndpoint??''),caseId:String(r.caseId??'')})));
      const catalog=filterN1CatalogCandidates(buildN1CandidateCatalog(network,emptyScenario()).candidates,{ytmId:areas[0]}),internal=new Map([...network.lines,...network.transformers].map(e=>[`${e.sourceClass}:${e.sourceId}`,`${e.sourceClass}:${e.id}`]));
      const stratified=process.argv.includes('--stratified'),preferred=[...selected.map(o=>internal.get(`${o.sourceClass}:${o.fid}`)!).filter(id=>catalog.some(c=>c.candidateId===id)),...catalog.filter(c=>c.sourceClass==='ElmTr2').slice(0,1).map(c=>c.candidateId),...catalog.filter(c=>c.vnKv>=300).slice(0,2).map(c=>c.candidateId),...catalog.map(c=>c.candidateId)],selection=stratified?[...new Set(preferred)].slice(0,20):selected.slice(0,3).map(o=>internal.get(`${o.sourceClass}:${o.fid}`)!);
      const options:import('../src/analysis/contingency-hybrid').HybridOptions={filter:{ytmId:areas[0]},selectedCandidateIds:selection,catalogCandidateIds:selection,observations,onProgress:(stage)=>{if(stage==='HYBRID_PHASE')console.log(stage);},solveBase:budget=>boundedBenchmarkCalculation<CalculationResult>({kind:'BASE',network,scenario:emptyScenario()},budget),screen:(options,budget)=>boundedBenchmarkCalculation<N1ScreenResult>({kind:'DC',network,scenario:emptyScenario(),options},budget),solveOutage:(outage,budget)=>boundedBenchmarkCalculation<AcContingency>({kind:'AC',network,scenario:emptyScenario(),outage},budget),policy:{...DEFAULT_HYBRID_POLICY,acBudgetCases:stratified?5:3,globalTimeLimitMs:300000,limitsProvenance:'N1_RunManifest_Raw: loadingLimitPercent=100; minVoltagePu=.9; maxVoltagePu=1.1'}};
      let current=await runHybridN1(network,emptyScenario(),options);const stages=[{budget:options.policy!.acBudgetCases,status:current.status,counts:current.counts}];
      if(stratified)for(const budget of [10,20]){current=await runHybridN1(network,emptyScenario(),{...options,policy:{...options.policy,acBudgetCases:budget},resume:current});stages.push({budget,status:current.status,counts:current.counts});}
      hybrid=current;hybridStages=stages;
    }
  }
  if(process.argv.includes('--sc')){
    const context=adaptShortCircuitSources(loaded.raw,network),table=benchmark.groups.SC.tables.SC_BusResults_Raw,terminals=[...new Set(table.rows.map(r=>String(rowObject(table,r).physicalTerminalFid??'')).filter(Boolean))];
    const sc=await calculateThreePhase(network,emptyScenario(),context,terminals,{faultType:'3PH',calculateMode:'MAX',voltageFactor:1.1,factorProvenance:'EXPLICIT_APPROXIMATION_PROFILE; NOT_PF_CMAX_EVIDENCE',edition:null,rfOhm:0,xfOhm:0,maxFaults:10000,timeBudgetMs:120000});
    scCoverage={...sc,faults:sc.faults.map(f=>({...f,reasons:[...new Set(f.reasons.map(r=>r.split(':')[0]))]})),audit:context.audit,sourceEvidence:context.sources};
  }
  const gate=preflightBenchmark(benchmark,network,null),n1Crosscheck=metricRows(benchmark.groups.N1.tables.N1_RecordedExtrema_Raw,gate,undefined,{network,scenario:emptyScenario(),hybrid:hybrid as import('../src/analysis/contingency-hybrid').HybridResult|null,diagnostic:process.argv.includes('--diagnostic')});
  const n1ComparisonCoverage={pfExtrema:benchmark.groups.N1.tables.N1_RecordedExtrema_Raw.rows.length,identityMatched:n1Crosscheck.filter(r=>r.identityMatched).length,diagnosticDeltas:n1Crosscheck.filter(r=>r.diagnosticDelta!==null&&r.diagnosticDelta!==undefined).length,statistics:metricStatistics(n1Crosscheck)};
  const report={tag,n1ComparisonCoverage,modelJsonSha256:loaded.modelJsonSha256,classCount:Object.keys(network.classCounts).length,groups:Object.fromEntries(Object.entries(benchmark.groups).map(([a,g])=>[a,{identity:g.identity,workbook:g.workbook,tables:Object.fromEntries(Object.values(g.tables).map(t=>[t.name,{rows:t.rows.length,metadata:Object.keys(t.metadata).length,columns:t.headers.length}]))}])),controlLoads:control.loads.length,fullAc,digest,statistics,n1Ac,topologyAudit,hybrid,hybridStages,scCoverage,readinessCounts:auditShortCircuitReadiness(loaded.raw).counts,elapsedMs:performance.now()-start,maxHeapBytes:Math.max(maxHeap,process.memoryUsage().heapUsed),rssBytes:process.memoryUsage().rss};
  await mkdir('local-benchmark-results',{recursive:true});await writeFile(resolve('local-benchmark-results',tag+'.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({tag,fullAc,digest,seconds:report.elapsedMs/1000,maxHeapMiB:report.maxHeapBytes/1024**2}));
}finally{clearInterval(timer);}
