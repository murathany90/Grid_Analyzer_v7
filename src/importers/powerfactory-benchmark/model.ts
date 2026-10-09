import { DgsModel, type DgsRawData } from '../dgs';
import { mapCanonical } from '../dgs/canonical';
import { inspectArchive, hashBlob, checkCancel } from './archive';
import type { BenchmarkProgress } from './index';

export async function loadBenchmarkModel(file:File,progress:BenchmarkProgress=()=>{},signal?:AbortSignal){
  let candidate=file;
  for(let depth=0;/\.zip$/i.test(candidate.name);depth++){
    if(depth>1)throw Error('SOURCE_SCHEMA_MISMATCH: model ZIP nesting limit');
    const archive=await inspectArchive(candidate,signal),models=archive.entries.filter(e=>/\.(json|zip)$/i.test(e.name));
    if(models.length!==1)throw Error('SOURCE_SCHEMA_MISMATCH: exactly one DGS model required');candidate=await archive.file(models[0],signal);
  }
  if(!/\.json$/i.test(candidate.name))throw Error('SOURCE_SCHEMA_MISMATCH: DGS JSON required');
  progress('HASH',{message:'DGS SHA-256'});const sha256=await hashBlob(candidate,signal);checkCancel(signal);
  let raw:DgsRawData;try{raw=JSON.parse((await candidate.text()).replace(/^\uFEFF/,''));}catch{throw Error('INVALID_JSON: DGS model');}
  if(!raw||!raw.IntCase||!raw.ElmTerm||!raw.StaCubic)throw Error('SOURCE_SCHEMA_MISMATCH: DGS classes');
  for(const [name,data] of Object.entries(raw)){
    if(!data||typeof data!=='object'||!('Attributes' in data))continue;
    const table=data as {Attributes:unknown[];Values:unknown[][]};if(!Array.isArray(table.Attributes)||!Array.isArray(table.Values)||new Set(table.Attributes).size!==table.Attributes.length)throw Error(`SOURCE_SCHEMA_MISMATCH: DGS ${name} columns`);
    const fid=table.Attributes.indexOf('FID'),seen=new Set<string>();
    for(const row of table.Values){
      if(!Array.isArray(row)||row.length>table.Attributes.length)throw Error(`SOURCE_SCHEMA_MISMATCH: DGS ${name} row length`);
      // DGS variable arrays omit only unused trailing cells; fixed attributes may not shift.
      if(row.length<table.Attributes.length){
        const omitted=table.Attributes.slice(row.length).map(String),prefix=/^(.+):\d+$/.exec(omitted[0])?.[1];
        const arrayStart=table.Attributes.indexOf(`${prefix}:0`),rows=Number(row[table.Attributes.indexOf(`${prefix}:SIZEROW`)]),cols=Number(row[table.Attributes.indexOf(`${prefix}:SIZECOL`)]);
        if(!prefix||omitted.some(a=>!new RegExp('^'+prefix+':\\d+$').test(a))||!Number.isInteger(rows)||!Number.isInteger(cols)||rows<0||cols<0||arrayStart+(cols>0?rows:0)!==row.length)throw Error(`SOURCE_SCHEMA_MISMATCH: DGS ${name} truncated fixed/array fields`);
      }
      if(fid>=0&&name!=='Matrix'&&name!=='MATRIX'){const id=String(row[fid]??'');if(!id||seen.has(id))throw Error(`SOURCE_SCHEMA_MISMATCH: DGS ${name} FID`);seen.add(id);}
    }
  }
  const source=new DgsModel(raw,candidate.name,candidate.size);await source.build(message=>progress('MODEL',{message}));checkCancel(signal);
  return {network:mapCanonical(source,sha256),source,raw,modelJsonSha256:sha256};
}
