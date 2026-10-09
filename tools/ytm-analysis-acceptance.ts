/** Bounded local acceptance. Inputs, native identities and numerical outputs stay ignored. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {loadBenchmark} from '../src/importers/powerfactory-benchmark';
import {loadBenchmarkModel} from '../src/importers/powerfactory-benchmark/model';
import {benchmarkControlContext} from '../src/domain/benchmark/reference';
import {applyPowerFactoryControlContext} from '../src/analysis/validation/powerfactory-control-context';
import {emptyScenario} from '../src/domain/scenario/overlay';
import {buildN1CandidateCatalog,filterN1CatalogCandidates,voltageBandMatches} from '../src/domain/n1/catalog';
import {runHybridN1,type HybridOptions} from '../src/analysis/contingency-hybrid';
import {adaptShortCircuitSources} from '../src/importers/powerfactory-benchmark/short-circuit-source';
import {calculateThreePhase,type ScProfile} from '../src/analysis/short-circuit';
import {METRICS,metricRows,preflightBenchmark} from '../src/domain/benchmark/comparison';
import {diagnosticStatistics} from '../src/domain/benchmark/diagnostic-statistics';
import {rowObject} from '../src/domain/benchmark/types';
import {boundedBenchmarkCalculation} from './bounded-benchmark-calculation';
import type {CalculationResult} from '../src/domain/results/types';
import type {N1ScreenResult} from '../src/domain/n1';
import type {AcContingency} from '../src/analysis/contingency-ac';
import {postResultAssembler} from '../src/analysis/contingency-ac/post-results';
const [modelPath,benchmarkPath,tag]=process.argv.slice(2);
if(!modelPath||!benchmarkPath||!/^SN[34]$/i.test(tag))throw Error('Usage: model.zip benchmark.zip SN3|SN4');
// The current acceptance path uses identical canonical GUI settings for base/outages.
// Historical scope/LF audits remain explicitly isolated from N1 acceptance.
if(!process.argv.includes('--lf-audit')&&!process.argv.includes('--scope-supplement')){await import('./ytm-parity-fix-acceptance');process.exit(0);}
const file=async(path:string)=>new File([await readFile(path)],path.split(/[\\/]/).at(-1)!);
const start=performance.now();
console.log(tag,'LOAD');
const loaded=await loadBenchmarkModel(await file(modelPath)),benchmark=await loadBenchmark(await file(benchmarkPath));
const network=applyPowerFactoryControlContext(loaded.network,benchmarkControlContext(benchmark)),scenario=emptyScenario();
if(process.argv.includes('--scope-supplement')){
  const prior=JSON.parse(await readFile(`local-benchmark-results/ytm-${tag.toLowerCase()}-private.json`,'utf8'));
  const candidates=filterN1CatalogCandidates(buildN1CandidateCatalog(network,scenario,{includeAllVoltages:true}).candidates,{ytmIds:[prior.area],voltageBands:[33]});
  const c=candidates.find(c=>c.topology==='NON_ISLANDING'&&!prior.selected.includes(c.candidateId));if(!c)throw Error('NO_NATIVE_33KV_SCOPE_SUPPLEMENT');
  const equipment=[...network.lines,...network.transformers].find(e=>`${e.sourceClass}:${e.id}`===c.candidateId)!;
  const outage={sourceClass:c.sourceClass,fid:equipment.sourceId,caseId:`N1:${c.sourceClass}:${equipment.sourceId}`};
  const ac=await boundedBenchmarkCalculation<AcContingency>({kind:'AC',network,scenario,outage},120000),post=ac.result?postResultAssembler(network,ac.result,'nominal'):null;
  const safe={scope33Candidates:candidates.length,selected:1,status:ac.status,voltageViolations:post?.buses.filter(b=>b.vmPu<.9||b.vmPu>1.1).length??0,thermalViolations:post?.branches.filter(b=>(b.loading.operationalPercent??0)>100).length??0,unknownRatings:post?.branches.filter(b=>b.loading.operationalPercent===null).length??0,residualMw:ac.result?.maxMismatchMw??null,voltageLevelsKv:c.voltageLevelsKv,unsuppliedLoadMw:ac.unsuppliedLoadMw??null};
  await writeFile(`local-benchmark-results/ytm-${tag.toLowerCase()}-33-private.json`,JSON.stringify({candidate:c,ac,post},null,2));await writeFile(`local-benchmark-results/ytm-${tag.toLowerCase()}-33-safe.json`,JSON.stringify(safe,null,2));console.log(JSON.stringify(safe));process.exit(0);
}
const base=await boundedBenchmarkCalculation<CalculationResult>({kind:'BASE',network,scenario},120000);
const stable=(v:unknown):unknown=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).filter(([k,x])=>typeof x==='object'||!/(?:Ms|Seconds)$|elapsed|duration|timestamp/i.test(k)).map(([k,x])=>[k,stable(x)])):v;
const digest=createHash('sha256').update(JSON.stringify(stable({buses:base.buses,branches:base.branches,generators:base.generators,status:base.status,converged:base.converged,iterations:base.iterations,rounds:base.rounds,diagnostics:base.diagnostics}))).digest('hex');
const baseline=JSON.parse(await readFile(`local-benchmark-results/fix-final-lf-${tag.toLowerCase()}.json`,'utf8'));
if(!base.converged||digest!==baseline.digest)throw Error('BASE_FULL_AC_CHANGED');
const gate=preflightBenchmark(benchmark,network,base),lfRows=Object.values(benchmark.groups.LF.tables).filter(t=>METRICS[t.name]).flatMap(t=>metricRows(t,gate,undefined,{network,scenario,lfResult:base,diagnostic:true}));
const rawRows=(cls:string)=>{const t=loaded.raw[cls] as {Attributes:string[];Values:unknown[][]}|undefined;return t?.Values.map(v=>Object.fromEntries(t.Attributes.map((a,i)=>[a,v[i]])))??[];};
const rawCache=new Map<string,ReturnType<typeof rawRows>>();
const native=(cls:string,fid:string)=>{if(!rawCache.has(cls))rawCache.set(cls,rawRows(cls));return rawCache.get(cls)!.find(r=>String(r.FID)===fid)??null;};
const anomalyRows=[...lfRows.filter(r=>r.metric==='voltagePu'&&r.pf.value!==null&&r.pf.value<.1).slice(0,3),...lfRows.filter(r=>r.sourceClass==='ElmTr2'&&r.metric==='loadingPercent'&&Math.abs(r.diagnosticDelta??0)>1400).slice(0,3),...lfRows.filter(r=>/q.*mvar/i.test(r.metric)&&r.sourceClass==='ElmTr2').sort((a,b)=>Math.abs(b.diagnosticDelta??0)-Math.abs(a.diagnosticDelta??0)).slice(0,3),...lfRows.filter(r=>r.metric==='qResultMvar'&&['ElmSym','ElmGenStat','ElmGenstat'].includes(r.sourceClass)).sort((a,b)=>Math.abs(b.diagnosticDelta??0)-Math.abs(a.diagnosticDelta??0)).slice(0,3)];
const anomalyAudit=anomalyRows.map(r=>{const source=native(r.sourceClass,r.fid),type=source?.typ_id?native(r.sourceClass==='ElmTr2'?'TypTr2':r.sourceClass==='ElmSym'?'TypSym':'TypGenStat',String(source.typ_id)):null;return {metricRow:r,source,type,canonical:[...network.buses,...network.transformers,...network.generators].find(e=>e.sourceClass===(r.sourceClass==='ElmGenstat'?'ElmGenStat':r.sourceClass)&&e.sourceId===r.fid),stationControllers:network.stationControllers.filter(c=>c.unitIds.includes(r.fid)),loadFlowOptionsRaw:network.loadFlowOptionsRaw};});
if(process.argv.includes('--lf-audit')){await writeFile(`local-benchmark-results/ytm-${tag.toLowerCase()}-lf-audit-private.json`,JSON.stringify(anomalyAudit,null,2));console.log(JSON.stringify({tag,unchanged:digest===baseline.digest,anomaliesAudited:anomalyAudit.length}));process.exit(0);}
console.log(tag,'BASE_UNCHANGED',base.buses.length,'LF_DIAGNOSTICS',lfRows.filter(r=>r.diagnosticDelta!=null).length);
const catalog=buildN1CandidateCatalog(network,scenario,{includeAllVoltages:true}),areaCounts=new Map<string,number>();
for(const c of catalog.candidates)for(const id of new Set([...c.fromYtmIds,...c.toYtmIds]))areaCounts.set(id,(areaCounts.get(id)??0)+1);
const area=[...areaCounts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0][0],second=[...areaCounts].sort((a,b)=>b[1]-a[1])[1]?.[0];
const filter={ytmIds:[area],endpointScope:'BOTH' as const},scoped=filterN1CatalogCandidates(catalog.candidates,filter);
const dc=await boundedBenchmarkCalculation<N1ScreenResult>({kind:'DC',network,scenario,options:{minVoltageKv:66,selectedCandidateIds:scoped.map(c=>c.candidateId),candidateTypes:['ElmLne','ElmTr2']}},120000);
const clear=dc.candidates.find(c=>c.status==='SCREENED_NO_VIOLATION'),selected:string[]=[];
const take=(id:string|undefined)=>{if(id&&!selected.includes(id))selected.push(id);};
take(clear?.candidateId);
for(const band of [400,154,33])take(scoped.find(c=>voltageBandMatches(c.vnKv,band)&&c.topology==='NON_ISLANDING')?.candidateId);
take(scoped.find(c=>c.sourceClass==='ElmTr2'&&c.topology==='NON_ISLANDING')?.candidateId);
take(scoped.find(c=>c.topology==='ISLANDING')?.candidateId);
for(const c of scoped.filter(c=>c.topology==='NON_ISLANDING')){if(selected.length>=8)break;take(c.candidateId);}
let solveCalls=0;
const options:HybridOptions={filter,catalogCandidateIds:selected,solveAllSelected:true,dcClearValidationCases:1,policy:{acBudgetCases:5},solveBase:async()=>base,screen:async()=>dc,solveOutage:(outage,budget)=>{solveCalls++;console.log(tag,'AC',solveCalls);return boundedBenchmarkCalculation<AcContingency>({kind:'AC',network,scenario,outage},budget);}};
let hybrid=await runHybridN1(network,scenario,options);const stages=[{calls:solveCalls,counts:hybrid.counts}];
hybrid=await runHybridN1(network,scenario,{...options,resume:hybrid});stages.push({calls:solveCalls,counts:hybrid.counts});
const repeat=await runHybridN1(network,scenario,{...options,resume:hybrid});if(solveCalls!==selected.length||repeat.counts.NOT_RUN!==0)throw Error('REAL_RESUME_REPEATED_OR_PENDING');
const scopeCounts={all:catalog.candidates.length,single:scoped.length,internal:filterN1CatalogCandidates(catalog.candidates,{...filter,endpointScope:'INTERNAL'}).length,boundary:filterN1CatalogCandidates(catalog.candidates,{...filter,endpointScope:'CONNECTED'}).length,multi:filterN1CatalogCandidates(catalog.candidates,{ytmIds:[area,...second?[second]:[]]}).length,lowVoltage:scoped.filter(c=>c.vnKv<66).length};
const scTable=benchmark.groups.SC.tables.SC_BusResults_Raw,pfFaultRows=scTable.rows.map(r=>rowObject(scTable,r)),faults:string[]=[];
for(const band of [400,154,33]){const row=pfFaultRows.find(r=>typeof r.nominalKv==='number'&&voltageBandMatches(r.nominalKv,band)&&network.buses.some(b=>b.sourceId===r.physicalTerminalFid&&b.inService));if(row)faults.push(String(row.physicalTerminalFid));}
const assumptions={externalGridFactor:{value:1.1,provenance:'EXPLICIT_LOCAL_APPROXIMATION_SOURCE_C'},converterAngleDeg:-90,converterTerminalBasis:true,allowMixedNominalKv:true,provenance:'EXPLICIT_LOCAL_APPROXIMATION: connected-terminal converter basis/angle; canonical mixed nominal normalization; NOT_IEC_PROOF'};
const profile:ScProfile={faultType:'3PH',calculateMode:'MAX',voltageFactor:1.1,factorProvenance:'EXPLICIT_LOCAL_APPROXIMATION_FAULT_C',edition:null,rfOhm:0,xfOhm:0,maxFaults:5,timeBudgetMs:120000};
const nativeContext=adaptShortCircuitSources(loaded.raw,network),nativeSc=await calculateThreePhase(network,scenario,nativeContext,faults,profile);
const context=adaptShortCircuitSources(loaded.raw,network,undefined,{...assumptions,missingMachineXdssPu:.2,missingMachineRPu:.01}),sc=await calculateThreePhase(network,scenario,context,faults,profile);
const minContext=adaptShortCircuitSources(loaded.raw,network,undefined,{...assumptions,missingMachineXdssPu:.2,missingMachineRPu:.01,mode:'MIN'}),minSc=await calculateThreePhase(network,scenario,minContext,faults,{...profile,calculateMode:'MIN',voltageFactor:1});
const scRows=metricRows(scTable,gate,undefined,{network,scenario,sc,benchmark,diagnostic:true});
const n1Table=benchmark.groups.N1.tables.N1_RecordedExtrema_Raw,n1Rows=metricRows(n1Table,gate,undefined,{network,scenario,hybrid,benchmark,diagnostic:true});
const safeStats=(rows:typeof scRows,dimension:'METRIC'|'VOLTAGE'|'YTM'='METRIC')=>diagnosticStatistics(rows,dimension).map(({worstPrivateFid,worstPrivateSide,ytm,...r})=>r);
const genCounts:Record<string,number>={};for(const r of rawRows(loaded.raw.ElmGenstat?'ElmGenstat':'ElmGenStat').filter(r=>r.outserv===0))genCounts[String(r.ngnum)]=(genCounts[String(r.ngnum)]??0)+1;
const safe={tag,base:{unchanged:true,converged:base.converged,buses:base.buses.length,iterations:base.iterations,residualMw:base.maxMismatchMw},lf:{diagnosticCells:lfRows.filter(r=>r.diagnosticDelta!=null).length,certifiedCells:lfRows.filter(r=>r.delta!==null).length,statistics:safeStats(lfRows),anomaliesAudited:anomalyAudit.length},n1:{scopeCounts,selected:selected.length,solveCalls,stages,counts:hybrid.counts,voltageViolations:hybrid.cases.reduce((s,c)=>s+c.voltageViolations,0),thermalViolations:hybrid.cases.reduce((s,c)=>s+c.thermalViolations,0),unknownRatings:hybrid.cases.reduce((s,c)=>s+c.unknownRatings,0),maxResidualMw:Math.max(...hybrid.cases.map(c=>c.maxMismatchMw??0)),postBusRecords:hybrid.cases.reduce((s,c)=>s+(c.mapResults?.buses.length??0),0),postBranchRecords:hybrid.cases.reduce((s,c)=>s+(c.mapResults?.branches.length??0),0),diagnosticCells:n1Rows.filter(r=>r.diagnosticDelta!=null).length},sc:{selected:faults.length,native:nativeSc.counts,approximation:sc.counts,minApproximation:minSc.counts,readySources:context.sources.filter(s=>s.inService&&!s.reason).length,missingNativeSources:nativeContext.sources.filter(s=>s.inService&&s.reason).length,invalidBranches:context.invalidBranches.length,maxResidual:Math.max(...sc.faults.map(f=>f.residual??0)),diagnosticCells:scRows.filter(r=>r.diagnosticDelta!=null).length,certifiedCells:scRows.filter(r=>r.delta!==null).length,statistics:safeStats(scRows),byVoltage:safeStats(scRows,'VOLTAGE'),byYtm:safeStats(scRows,'YTM'),genStatParallelCounts:genCounts},elapsedSeconds:(performance.now()-start)/1000};
await mkdir('local-benchmark-results',{recursive:true});
await writeFile(`local-benchmark-results/ytm-${tag.toLowerCase()}-private.json`,JSON.stringify({digest,area,selected,hybrid,sc,minSc,nativeSc,context,anomalyAudit,n1Rows,scRows},null,2));
await writeFile(`local-benchmark-results/ytm-${tag.toLowerCase()}-safe.json`,JSON.stringify(safe,null,2));
console.log(JSON.stringify({tag,base:safe.base,n1:safe.n1,sc:{selected:safe.sc.selected,native:safe.sc.native,approximation:safe.sc.approximation,minApproximation:safe.sc.minApproximation,diagnosticCells:safe.sc.diagnosticCells}}));
