/** Local-only physical diagnostics. Discovery has no date, model or YTM constants. */
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {basename,join,resolve,extname} from 'node:path';
import {createHash} from 'node:crypto';
import {cpus,totalmem} from 'node:os';
import {inspectArchive} from '../src/importers/powerfactory-benchmark/archive';
import {loadBenchmarkModel} from '../src/importers/powerfactory-benchmark/model';
import {loadBenchmarkReferences} from '../src/importers/powerfactory-benchmark';
import {rowObject} from '../src/domain/benchmark/types';
import {emptyScenario} from '../src/domain/scenario/overlay';
import {buildTopology} from '../src/topology/electrical-topology';
import {buildN1CandidateCatalog,filterN1CatalogCandidates} from '../src/domain/n1/catalog';
import {adaptShortCircuitSources} from '../src/importers/powerfactory-benchmark/short-circuit-source';
import {engineeringSourceOptions,engineeringScProfile} from '../src/analysis/short-circuit/engineering-profile';
import {calculateThreePhase,clearScPreparationCache} from '../src/analysis/short-circuit';
import {runYtmStudy} from '../src/analysis/ytm-study';
import {runHybridN1} from '../src/analysis/contingency-hybrid';
import {defaultAnalysisSettings} from '../src/domain/calculation/analysis-settings';
import {auditScPartitionSubset,auditScPartition} from '../src/domain/benchmark/sc-partition';
import type {ScFaultResult} from '../src/analysis/short-circuit';
import type {ScAdapterOptions} from '../src/analysis/short-circuit/source-adapter';
const out=resolve('local-benchmark-results/pr7-followup');await mkdir(out,{recursive:true});
const save=async(name:string,value:unknown)=>writeFile(join(out,name+'.json'),JSON.stringify(value,null,2));
const file=async(path:string)=>new File([await readFile(path)],basename(path));
const rows=(raw:Record<string,unknown>,cls:string)=>{const t=raw[cls] as {Attributes:string[];Values:unknown[][]}|undefined;return t?.Values.map(v=>Object.fromEntries(t.Attributes.map((k,i)=>[k,v[i]])))??[];};
const stats=(v:number[])=>{v.sort((a,b)=>a-b);return {count:v.length,mae:v.length?v.reduce((a,b)=>a+b,0)/v.length:null,p95:v[Math.ceil(.95*v.length)-1]??null,max:v.at(-1)??null};};
type Entry={path:string;sha256:string;kind:string;entries?:string[]};
type Pair={model:Entry;reference:Entry;studyCase:string;modelHash:string;studyTime:unknown;identity:unknown;fidOverlap:number};
const [command='discover',pairIndex='0']=process.argv.slice(2);
if(command==='discover'){
 const entries:Entry[]=[],skip=new Set(['.git','node_modules','dist','dist-portable','local-benchmark-results','.tmp','sld-v36','tek_hat_ornekleri']);
 async function walk(dir:string){for(const e of await readdir(dir,{withFileTypes:true})){const p=join(dir,e.name);if(e.isDirectory()){if(!skip.has(e.name))await walk(p);}else if(/\.(zip|json|xlsx|csv)$/i.test(e.name)){
  const bytes=await readFile(p),f=new File([bytes],e.name),item:Entry={path:resolve(p),sha256:createHash('sha256').update(bytes).digest('hex'),kind:extname(p).slice(1).toUpperCase()};
  if(/\.zip$/i.test(p))try{const a=await inspectArchive(f);item.entries=a.entries.map(e=>e.name);item.kind=item.entries.some(n=>/Reference_Package.*\.json$/i.test(n))?'PF_REFERENCE':item.entries.length===1&&/\.(json|zip)$/i.test(item.entries[0])?'MODEL_CANDIDATE':'OTHER_ZIP';}catch{item.kind='UNSUPPORTED_ARCHIVE';}
  else if(/\.json$/i.test(p)&&bytes.length>0&&bytes.length<200*1024**2){const s=bytes.toString('utf8',0,Math.min(bytes.length,5000));if(/"IntCase"\s*:/.test(s))item.kind='MODEL_CANDIDATE';}
  entries.push(item);
 }}}
 await walk('.');await save('inventory',entries);
 const refs=[];for(const entry of entries.filter(e=>e.kind==='PF_REFERENCE')){
  const archive=await inspectArchive(await file(entry.path));for(const e of archive.entries.filter(e=>/\.json$/i.test(e.name))){const metadata=JSON.parse(await (await archive.file(e)).text());if(metadata.analysisType==='SC')refs.push({entry,identity:metadata.identity,workbookSha256:metadata.workbook.sha256});}
 }
 const pairs:Pair[]=[],modelHashes=new Set<string>(),pairHashes=new Set<string>();for(const model of entries.filter(e=>e.kind==='MODEL_CANDIDATE'))try{
  if(modelHashes.has(model.sha256))continue;modelHashes.add(model.sha256);
  const loaded=await loadBenchmarkModel(await file(model.path)),n=loaded.network,studyTime=rows(loaded.raw,'IntCase');
  for(const r of refs)if(r.identity.studyCase===n.studyCase){const key=n.modelHash+':'+r.workbookSha256;if(pairHashes.has(key))continue;pairHashes.add(key);pairs.push({model,reference:r.entry,studyCase:n.studyCase!,modelHash:n.modelHash,studyTime,identity:r.identity,fidOverlap:0});}
  console.log('DISCOVERED '+JSON.stringify({path:model.path,studyCase:n.studyCase,studyTime,hash:n.modelHash}));
 }catch(error){console.log('MODEL_REJECTED '+model.path+' '+error);}
 await save('pairs',pairs);console.log(JSON.stringify({files:entries.length,kinds:entries.reduce<Record<string,number>>((a,e)=>(a[e.kind]=(a[e.kind]??0)+1,a),{}),pairs:pairs.map(p=>({model:p.model.path,reference:p.reference.path,studyCase:p.studyCase,overlap:p.fidOverlap}))}));
}else{
 const pairs:Pair[]=JSON.parse(await readFile(join(out,'pairs.json'),'utf8')),pair=pairs[Number(pairIndex)];if(!pair)throw Error('NO_DISCOVERED_PAIR');
 const loaded=await loadBenchmarkModel(await file(pair.model.path)),n=loaded.network,reference=await loadBenchmarkReferences(await file(pair.reference.path)),scenario=emptyScenario(),topology=buildTopology(n),catalog=buildN1CandidateCatalog(n,scenario,{includeAllVoltages:true});
 const table=reference.groups.SC.tables.SC_BusResults_Raw,pf=table.rows.map(v=>rowObject(table,v)).filter(r=>r.calculateMode==='MAX'&&r.rfOhm===0&&r.xfOhm===0&&typeof r.ikssKa==='number'&&['3PH','3-Phase Short-Circuit'].includes(String(r.faultType)));
 const busByFid=new Map(n.buses.map(b=>[b.sourceId,b]));
 const matched=pf.filter(r=>{const b=busByFid.get(String(r.physicalTerminalFid));return b&&Math.abs(b.vnKv-Number(r.nominalKv))<1e-6&&topology.terminalToBus.has(b.sourceId);});
 const unique=[...new Map(matched.map(r=>[topology.terminalToBus.get(String(r.physicalTerminalFid)),r])).values()],targets=unique.map(r=>String(r.physicalTerminalFid));
 async function compute(options:ScAdapterOptions,mode:'MAX'|'MIN'='MAX',ids=targets){const c=adaptShortCircuitSources(loaded.raw,n,undefined,options),r=await calculateThreePhase(n,scenario,c,ids,engineeringScProfile(mode));clearScPreparationCache();return r;}
 function comparison(r:Awaited<ReturnType<typeof compute>>){const by=new Map(r.faults.map(f=>[f.physicalTerminalFid,f]));const values=unique.flatMap(p=>{const f=by.get(String(p.physicalTerminalFid));return f?.ikssKa===null||!f?[]:[{FID:f.physicalTerminalFid,electricalBusId:f.electricalBusId,kV:f.nominalKv,GA:f.ikssKa!,PF:Number(p.ikssKa),delta:f.ikssKa!-Number(p.ikssKa),relative:100*(f.ikssKa!/Number(p.ikssKa)-1),zkk:f.zkkOhm,members:f.physicalTerminalFids}];});return {statistics:stats(values.map(v=>Math.abs(v.delta))),relative:stats(values.map(v=>Math.abs(v.relative))),values};}
 if(command==='targeted'){
  const balanced=await compute(engineeringSourceOptions('MAX')),fast=await compute(engineeringSourceOptions('MAX',false)),native=await compute({mode:'MAX'}),base=comparison(balanced),worst=[...base.values].sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta)).slice(0,5),relativeWorst=[...base.values].sort((a,b)=>Math.abs(b.relative)-Math.abs(a.relative)).slice(0,5);
  const variants:[string,ScAdapterOptions,'MAX'|'MIN'][]=[['BALANCED',engineeringSourceOptions('MAX'),'MAX'],['FAST',engineeringSourceOptions('MAX',false),'MAX'],['NATIVE_NO_ASSUMPTIONS',{mode:'MAX'},'MAX'],['OMIT_MISSING_XDSS',{...engineeringSourceOptions('MAX'),missingMachineXdssPu:undefined},'MAX'],['OMIT_MISSING_R',{...engineeringSourceOptions('MAX'),missingMachineRPu:undefined},'MAX'],['IBR_PHASE_0',{...engineeringSourceOptions('MAX'),converterAngleDeg:0},'MAX'],['MIN_POLICY',engineeringSourceOptions('MIN'),'MIN']];
  const ablations:(ReturnType<typeof comparison>&{name:string;mode:'MAX'|'MIN';comparableToMaxReference:boolean;top5:{FID:string;ikss:number|null|undefined;deltaFromBalanced:number}[]})[]=[];for(const [name,options,mode]of variants){const r=name==='BALANCED'?balanced:name==='FAST'?fast:name==='NATIVE_NO_ASSUMPTIONS'?native:await compute(options,mode),c=comparison(r);ablations.push({name,mode,comparableToMaxReference:mode==='MAX',...c,top5:worst.map(w=>({FID:w.FID,ikss:r.faults.find(f=>f.physicalTerminalFid===w.FID)?.ikssKa,deltaFromBalanced:(r.faults.find(f=>f.physicalTerminalFid===w.FID)?.ikssKa??NaN)-w.GA}))});}
  const zero=adaptShortCircuitSources(loaded.raw,n,undefined,engineeringSourceOptions('MAX'));zero.sources=zero.sources.map(s=>s.currentKa===0?{...s,currentAngleDeg:-90}:s);const zr=await calculateThreePhase(n,scenario,zero,targets,engineeringScProfile('MAX'));ablations.push({name:'ZERO_RECORDED_PHASE_IRRELEVANCE',mode:'MAX',comparableToMaxReference:true,...comparison(zr),top5:worst.map(w=>({FID:w.FID,ikss:zr.faults.find(f=>f.physicalTerminalFid===w.FID)?.ikssKa,deltaFromBalanced:zr.faults.find(f=>f.physicalTerminalFid===w.FID)!.ikssKa!-w.GA}))});clearScPreparationCache();
  const rawSources=new Map<string,Record<string,unknown>>(['ElmSym','ElmGenStat','ElmGenstat','ElmXnet','ElmVac'].flatMap(cls=>rows(loaded.raw,cls).map(r=>[`${cls==='ElmGenstat'?'ElmGenStat':cls}:${r.FID}`,r] as const))),types=new Map(['TypSym','TypTr2'].flatMap(cls=>rows(loaded.raw,cls).map(r=>[String(r.FID),r] as const))),sources=balanced.sourceModelInputs??[];
  const traces=worst.map(w=>{const b=topology.terminalToBus.get(w.FID)!,dist=new Map([[b,0]]),queue=[b];for(let q=0;q<queue.length;q++)for(const e of [...n.lines,...n.transformers]){if(!e.inService)continue;const a=topology.terminalToBus.get(e.from),z=topology.terminalToBus.get(e.to),other=a===queue[q]?z:z===queue[q]?a:undefined;if(other!==undefined&&!dist.has(other)){dist.set(other,dist.get(queue[q])!+1);queue.push(other);}}
   const sourceInputs=sources.filter(s=>s.inService&&dist.has(topology.terminalToBus.get(s.bus)!)).map(s=>{const raw=rawSources.get(s.sourceClass+':'+s.fid);return {...s,hops:dist.get(topology.terminalToBus.get(s.bus)!),terminalKv:busByFid.get(s.bus)?.vnKv,raw,type:types.get(String(raw?.typ_id))};}).sort((a,b)=>a.hops!-b.hops!);
   return {...w,cause:'UNRESOLVED_CAUSE',sourceInputs,adjacentTransformers:n.transformers.filter(t=>t.inService&&(topology.terminalToBus.get(t.from)===b||topology.terminalToBus.get(t.to)===b)).map(t=>({...t,type:types.get(String(rows(loaded.raw,'ElmTr2').find(r=>r.FID===t.sourceId)?.typ_id))})),ablations:ablations.map(a=>({name:a.name,...a.top5.find(t=>t.FID===w.FID)}))};});
  const areas=[...new Set(n.sites.map(s=>s.areaId).filter(Boolean))].map(id=>({id,name:n.sites.find(s=>s.areaId===id)!.areaName,candidates:filterN1CatalogCandidates(catalog.candidates,{ytmIds:[id],endpointScope:'BOTH'}).length})).sort((a,b)=>a.candidates-b.candidates),area=areas[Math.floor(areas.length/2)],initial=await runHybridN1(n,scenario,{filter:{ytmIds:[area.id],endpointScope:'BOTH'},studyProfile:'NATIVE_PARTIAL_CONTROLS',preferDirectAcSample:true,allowSuppliedIslandResults:true,preserveDcOnAcFailure:true,analysisSettings:defaultAnalysisSettings(),policy:{acBudgetCases:2,perCaseTimeLimitMs:20000,globalTimeLimitMs:60000}});
  const proof={pair,physicalMatched:matched.length,uniqueElectricalMatched:targets.length,fullPhysical:n.buses.length,electrical:topology.buses.length,areas,selectedArea:area,worst:traces,relativeWorst,ablations,n1Initial:{counts:initial.counts,elapsedMs:initial.elapsedMs,cases:initial.cases.filter(c=>c.acAttempted)},unknownRatings:initial.basePost?.branches.filter(b=>b.loading.operationalPercent===null).map(b=>({FID:b.fid,sourceClass:b.sourceClass,loading:b.loading}))};await save('targeted-'+pairIndex,proof);console.log(JSON.stringify({...proof,worst:traces.map(t=>({FID:t.FID,GA:t.GA,PF:t.PF,zkk:t.zkk,nearestSources:t.sourceInputs.slice(0,3).map(s=>({fid:s.fid,sourceClass:s.sourceClass,hops:s.hops,rOhm:s.rOhm,xOhm:s.xOhm,currentKa:s.currentKa}))})),ablations:ablations.map(a=>({...a,values:undefined})),n1Initial:{counts:initial.counts,elapsedMs:initial.elapsedMs},unknownRatings:proof.unknownRatings?.length}));
 }else if(command==='bench'){
  const previous=JSON.parse(await readFile(join(out,'targeted-'+pairIndex+'.json'),'utf8')),area=previous.selectedArea.id,results=[];
  const balancedValues=previous.ablations[0].values as {FID:string;kV:number;members:string[];delta:number}[],partitions=new Map(balancedValues.map(v=>{const f={physicalTerminalFids:v.members,nominalKv:v.kV} as ScFaultResult;return [v.FID,{subset:auditScPartitionSubset(reference,f,engineeringScProfile('MAX')),full:auditScPartition(reference,f,engineeringScProfile('MAX'))}];}));
  const repairedR=await compute({...engineeringSourceOptions('MAX'),missingMachineRPu:undefined});
  const repaired=comparison(repairedR);previous.ablations.push({name:'OMIT_MISSING_R_FIXED',mode:'MAX',...repaired});
  previous.partitionSummary={compatibleElectrical:[...partitions.values()].filter(p=>p.subset.matched).length,fullElectrical:[...partitions.values()].filter(p=>p.full.matched).length,reasons:[...partitions.values()].reduce<Record<string,number>>((a,p)=>{for(const r of p.subset.reasons)a[r]=(a[r]??0)+1;return a;},{})};
  for(const a of previous.ablations){a.compatibleStatistics=stats(a.values.filter((v:{FID:string})=>partitions.get(v.FID)?.subset.matched).map((v:{delta:number})=>Math.abs(v.delta)));}
  previous.worst.forEach((w:{FID:string;partition?:unknown})=>{w.partition=partitions.get(w.FID);});await save('targeted-'+pairIndex,previous);
  const before=await runHybridN1(n,scenario,{filter:{ytmIds:[area],endpointScope:'BOTH'},studyProfile:'NATIVE_PARTIAL_CONTROLS',preferDirectAcSample:true,allowSuppliedIslandResults:true,preserveDcOnAcFailure:true,analysisSettings:defaultAnalysisSettings(),policy:{acBudgetCases:3,perCaseTimeLimitMs:20000,globalTimeLimitMs:178000}});await save('before-'+pairIndex,{counts:before.counts,elapsedMs:before.elapsedMs,cases:before.cases.map(c=>({id:c.candidateId,dc:!!c.dcResult,ac:!!c.acSolved,status:c.status,topology:c.metadata?.topology}))});
  for(const profile of ['FAST','BALANCED'] as const){const t=performance.now(),contexts={MAX:adaptShortCircuitSources(loaded.raw,n,undefined,engineeringSourceOptions('MAX',profile!=='FAST')),MIN:adaptShortCircuitSources(loaded.raw,n,undefined,engineeringSourceOptions('MIN',profile!=='FAST'))},study=await runYtmStudy(n,scenario,contexts,{ytmId:area,profile},{onProgress:(stage,d)=>{if(stage==='HYBRID_AC_CASE')console.log(profile+' '+d?.message);}}),elapsedMs=performance.now()-t;
   await save('study-'+pairIndex+'-'+profile,study);const c=study.n1?.cases??[],counts={candidates:c.length,dc:c.filter(c=>c.dcResult).length,ac:c.filter(c=>c.acSolved).length,acVerified:study.n1?.counts.AC_VERIFIED,distinct:c.filter(c=>c.dcResult||c.acSolved).length,islanding:c.filter(c=>c.metadata?.topology==='ISLANDING').length,noNumeric:c.filter(c=>!c.dcResult&&!c.acSolved).length,notAttempted:c.filter(c=>!c.acAttempted).length},reasons=c.filter(c=>!c.dcResult&&!c.acSolved).reduce<Record<string,number>>((a,c)=>(a[c.status+':'+c.reason]=(a[c.status+':'+c.reason]??0)+1,a),{});
   const r={profile,area,elapsedMs,stageMs:study.stageMs,counts,reasons,unknownRatings:study.n1?.basePost?.branches.filter(b=>b.loading.operationalPercent===null).map(b=>({FID:b.fid,sourceClass:b.sourceClass,...b.loading})),physical:study.faultTargets.length,electrical:study.electricalTargets,quality:study.qualityCounts,scMax:study.scMax?.counts,scMin:study.scMin?.counts,hardware:{cpu:cpus()[0]?.model,threads:cpus().length,memoryBytes:totalmem(),node:process.version},memory:process.memoryUsage()};results.push(r);console.log(JSON.stringify(r));clearScPreparationCache();
  }await save('bench-'+pairIndex,results);
 }else throw Error('UNKNOWN_COMMAND');
}
