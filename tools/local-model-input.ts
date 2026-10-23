import {readdir,readFile,realpath,stat} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {inspectModelFile} from '../src/importers/model-file';

export type LocalStatus='PASS'|'FAIL'|'SKIP'|'NOT_RUN';
const inside=(root:string,file:string)=>{const rel=path.relative(root,file);return rel!==''&&!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel);};
/** Discover only <study>_dosyaları/<study>.zip; never select the PF reference ZIP. */
export async function discoverModelArchives(directory:string,filter=''){
 const root=path.resolve(directory),models:string[]=[],skipped:{path:string;reason:string}[]=[];
 let dirs;try{dirs=await readdir(root,{withFileTypes:true});}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return {models,skipped,reason:'SOURCE_UNAVAILABLE'};throw e;}
 const base=await realpath(root);
 for(const dir of dirs.sort((a,b)=>a.name.localeCompare(b.name))){
  if(!dir.isDirectory()||!dir.name.normalize('NFC').endsWith('_dosyaları'))continue;
  const candidate=path.join(root,dir.name,dir.name.slice(0,-'_dosyaları'.length)+'.zip');
  try{const resolved=await realpath(candidate);if(!inside(base,resolved)){skipped.push({path:candidate,reason:'OUTSIDE_MODEL_ROOT'});continue;}if(!(await stat(resolved)).isFile())continue;if(!filter||candidate.toLocaleLowerCase('tr').includes(filter.toLocaleLowerCase('tr')))models.push(candidate);}
  catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')skipped.push({path:candidate,reason:'MODEL_ZIP_MISSING'});else throw e;}
 }
 return {models,skipped,reason:models.length?'':filter?'FILTER_NO_MATCH':'SOURCE_UNAVAILABLE'};
}
export async function readLocalDgsArchive(file:string){
 const size=(await stat(file)).size;if(size>512*1024*1024)throw Error('MODEL_SIZE_LIMIT');
 const bytes=await readFile(file),zipSha256=createHash('sha256').update(bytes).digest('hex');
 if(bytes.subarray(0,100).toString().startsWith('version https://git-lfs.github.com/spec/v1'))return {status:'SKIP' as const,reason:'LFS_POINTER'};
 const archive=await inspectModelFile(new File([bytes],path.basename(file))),wanted=path.basename(file,'.zip')+'.json';
 const preferred=archive.entries.filter(e=>path.posix.basename(e.name.replaceAll('\\','/')).toLowerCase()===wanted.toLowerCase());
 const entry=preferred.length===1?preferred[0]:archive.entries.length===1?archive.entries[0]:null;
 if(!entry)throw Error('AMBIGUOUS_MODEL_JSON');
 const model=await archive.extract(entry),data=Buffer.from(await model.arrayBuffer()),raw:unknown=JSON.parse(data.toString('utf8').replace(/^\uFEFF/,''));
 if(!raw||typeof raw!=='object'||!('ElmTerm' in raw)||!Array.isArray((raw as {ElmTerm?:{Attributes?:unknown}}).ElmTerm?.Attributes)||!Array.isArray((raw as {ElmTerm?:{Values?:unknown}}).ElmTerm?.Values))throw Error('NOT_A_DGS_MODEL');
 return {status:'READY' as const,raw:raw as Readonly<Record<string,unknown>>,name:model.name,size:data.length,zipSha256,modelHash:createHash('sha256').update(data).digest('hex')};
}
export function summarizeLocalRuns(statuses:LocalStatus[],reason=''){
 const counts={PASS:0,FAIL:0,SKIP:0,NOT_RUN:0};for(const s of statuses)counts[s]++;
 return {status:counts.FAIL?'FAIL':!statuses.length||counts.SKIP?'SKIP':counts.NOT_RUN?'NOT_RUN':'PASS',counts,reason};
}
