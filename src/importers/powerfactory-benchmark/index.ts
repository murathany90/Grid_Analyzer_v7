import { inspectArchive, hashBlob, checkCancel } from './archive';
import { readWorkbook } from './workbook';
import { RAW_SCHEMA } from './schema';
import { rowObject, type BenchmarkAnalysis, type BenchmarkGroup, type BenchmarkIdentity, type BenchmarkPackage } from '../../domain/benchmark/types';

export type BenchmarkProgress=(stage:string,detail?:Record<string,unknown>)=>void;
function fail(code:string,message:string):never{throw Error(`${code}: ${message}`);}
const analyses:BenchmarkAnalysis[]=['LF','N1','SC'];
const fields=['studyCase','studyTime','modelHash','scenarioHash','topologyHash','project','pfVersion'] as const;
export function loadBenchmark(file:File,onProgress:BenchmarkProgress=()=>{},signal?:AbortSignal){return readPackage(file,onProgress,signal,false);}
export function loadBenchmarkReferences(file:File,onProgress:BenchmarkProgress=()=>{},signal?:AbortSignal){return readPackage(file,onProgress,signal,true);}
async function readPackage(file:File,onProgress:BenchmarkProgress,signal:AbortSignal|undefined,allowSingle:boolean):Promise<BenchmarkPackage>{
  const started=performance.now(),stages:string[]=[];
  const stage=(name:string)=>{stages.push(name);onProgress(name,{message:`Benchmark: ${name}`});};
  stage('DISCOVER');const archive=await inspectArchive(file,signal),entries=archive.entries;
  if(entries.length!==9&&(!allowSingle||entries.length!==3))fail('SOURCE_SCHEMA_MISMATCH','exactly 3 XLSX + 3 reference JSON + 3 LOG required');
  const files=new Map<string,File>();
  for(const entry of entries){
    const basename=entry.name.split(/[\\/]/).at(-1)!;
    if(files.has(basename)||!/[.](xlsx|json|log)$/i.test(basename))fail('SOURCE_SCHEMA_MISMATCH','duplicate basename or unsupported file');
    if(/\.(json|log)$/i.test(basename)&&entry.size>16*1024**2)fail('UNSAFE_ARCHIVE','sidecar/log size budget');
    files.set(basename,await archive.file(entry,signal));
  }
  const sidecars=new Map<BenchmarkAnalysis,{raw:Record<string,unknown>;file:File}>();
  const logs=new Map<BenchmarkAnalysis,{file:File;text:string}>();
  for(const f of files.values()){
    checkCancel(signal);
    if(/\.json$/i.test(f.name)){
      let raw:Record<string,unknown>;try{raw=JSON.parse((await f.text()).replace(/^\uFEFF/,''));}catch{fail('INVALID_JSON','reference package');}
      const a=raw!.analysisType as BenchmarkAnalysis;
      if(!analyses.includes(a)||raw!.schemaVersion!=='PF-GA-REF-1.0'||sidecars.has(a))fail('SOURCE_SCHEMA_MISMATCH','unknown or duplicate analysis');
      sidecars.set(a,{raw:raw!,file:f});
    }
    if(/\.log$/i.test(f.name)){
      const text=(await f.text()).replace(/^\uFEFF/,''),markers=analyses.filter(a=>new RegExp(`GUI_EVENT \\| ${a==='LF'?'RUN_STARTED':a+'_RUN_STARTED'}(?:\\s|$)`).test(text));
      if(markers.length!==1||logs.has(markers[0]))fail('SOURCE_SCHEMA_MISMATCH','unidentified / duplicate analysis log');logs.set(markers[0],{file:f,text});
    }
  }
  const selected=analyses.filter(a=>sidecars.has(a));
  if(sidecars.size!==entries.length/3||logs.size!==selected.length||selected.some(a=>!logs.has(a)))fail('SOURCE_SCHEMA_MISMATCH','missing analysis artifacts');
  const groups={} as Record<BenchmarkAnalysis,BenchmarkGroup>;const books=new Set<string>();
  stage('HASH');const archiveSha256=await hashBlob(file,signal);
  for(const analysis of selected){
    const {raw,file:sidecar}=sidecars.get(analysis)!,identity=raw.identity as BenchmarkIdentity,workbook=raw.workbook as BenchmarkGroup['workbook'];
    if(!identity||fields.some(k=>typeof identity[k]!=='string'||!identity[k])||!workbook||typeof workbook.file!=='string'||!/^[a-f0-9]{64}$/i.test(workbook.sha256))fail('SOURCE_SCHEMA_MISMATCH','identity/workbook manifest');
    const source=files.get(workbook.file),log=logs.get(analysis)!;
    if(!source||!/\.xlsx$/i.test(source.name)||books.has(source.name))fail('SOURCE_SCHEMA_MISMATCH','missing or duplicate workbook manifest');books.add(source.name);
    const actual=await hashBlob(source,signal);if(actual!==workbook.sha256.toLowerCase()||source.size!==workbook.sizeBytes)fail('WORKBOOK_HASH_MISMATCH',analysis);
    const caseName=/\bStudyCase=([^\r\n]*?)\s+StudyTime=/.exec(log.text)?.[1];
    if(caseName!==identity.studyCase)fail('BENCHMARK_IDENTITY_MISMATCH','diagnostic log Study Case');
    stage(`READ_${analysis}`);const tables=await readWorkbook(source,analysis,actual,RAW_SCHEMA[analysis],signal);
    const manifest=tables.Analysis_Manifest_Raw;if(manifest.rows.length!==1)fail('SOURCE_SCHEMA_MISMATCH','analysis manifest cardinality');
    const manifestRow=rowObject(manifest,manifest.rows[0]);
    for(const k of [...fields,'requestedMethod','effectiveMethod','methodVerificationStatus'])if(typeof identity[k]!=='string'||!identity[k]||String(manifestRow[k]??'')!==identity[k])fail('BENCHMARK_IDENTITY_MISMATCH',`workbook ${analysis}.${k}`);
    for(const k of ['addonVersion','scopeType','schemaVersion'])if(identity[k]!==undefined&&String(manifestRow[k]??'')!==identity[k])fail('BENCHMARK_IDENTITY_MISMATCH',`workbook ${analysis}.${k}`);
    const manifestAnalysis=({LOAD_FLOW:'LF',N1_CONTINGENCY:'N1',SHORT_CIRCUIT:'SC'} as Record<string,string>)[String(manifestRow.analysisType)]??manifestRow.analysisType;
    if(manifestAnalysis!==analysis)fail('BENCHMARK_IDENTITY_MISMATCH','workbook analysis');
    groups[analysis]={analysis,identity,workbook:{...workbook,sha256:actual},tables,log:{file:log.file.name,text:log.text,sha256:await hashBlob(log.file,signal)},sidecarSha256:await hashBlob(sidecar,signal)};
  }
  stage('VERIFY');for(const analysis of selected)for(const k of fields)if(groups[analysis].identity[k]!==groups[selected[0]].identity[k])fail('BENCHMARK_IDENTITY_MISMATCH',`mixed model/case ${analysis}.${k}`);
  // LF/N1/SC exporters have independent versions; each is verified against its
  // own workbook manifest above, not assumed identical across analysis families.
  // Empty containers preserve the legacy total shape; availableAnalyses is authoritative.
  for(const a of analyses)if(!groups[a])groups[a]={analysis:a,identity:Object.fromEntries([...fields,'effectiveMethod','requestedMethod','methodVerificationStatus'].map(k=>[k,''])) as BenchmarkIdentity,tables:Object.fromEntries(Object.entries(RAW_SCHEMA[a]).map(([name,headers])=>[name,{name,headers:[...headers],rows:[],rowNumbers:[],metadata:{availability:'REFERENCE_NOT_LOADED'},fileSha256:'',analysis:a,headerRow:0}])),workbook:{file:'',sha256:'',sizeBytes:0},log:{file:'',sha256:'',text:''},sidecarSha256:''};
  stage('INDEX');checkCancel(signal);stage('READY');return {groups,archiveSha256,elapsedMs:performance.now()-started,stages,availableAnalyses:selected};
}
