import {newModel,n,integer,s,type SourceRow} from './common';
import {rawFields,rawxSection,windingFields} from './raw-fields';
import {normalizeRawTables,type SourceTables} from './raw-normalize';
import type {PsseModel} from './types';
/** Quoted commas, slashes and doubled quote characters are source text, not separators. */
export function splitRaw(line:string):string[]{
 const out:string[]=[];let part='',quote='';
 for(let i=0;i<line.length;i++){const c=line[i];if(quote){if(c===quote){if(line[i+1]===quote){part+=c;i++;}else quote='';}else part+=c;}
  else if(c==='"'||c==="'")quote=c;else if(c==='/')break;else if(c===','){out.push(part.trim());part='';}else part+=c;}
 if(quote)throw Error('Unterminated RAW quoted field');out.push(part.trim());return out;
}
const textFields=new Set(['name','mname','loadid','shntid','machid','ckt','droopname','loadtype','rsetnam','desc','vecgrp','rmidnt','swdid','eqid','arname','zoname','owname']);
function named(tokens:string[],fields:string[]):SourceRow {const row:SourceRow={};tokens.forEach((token,i)=>{const key=fields[i]??`sourceField${i+1}`;row[key]=token===''?null:textFields.has(key)||i>=fields.length?token:n(token,key);});return row;}
/** Terminal RAW rows omit J/K columns by equipment type, rather than leaving placeholders. */
function terminal(tokens:string[]):SourceRow{
 if(tokens.length<4)throw Error('Truncated substation terminal');const type=tokens[2].toUpperCase(),other=type==='3'?2:['B','2','Z'].includes(type)?1:0;
 if(tokens.length!==4+other)throw Error(`Invalid substation terminal ${type} field count`);
 return{ibus:integer(tokens[0]),inode:integer(tokens[1]),type,jbus:other?integer(tokens[3]):null,kbus:other===2?integer(tokens[4]):null,eqid:tokens[3+other],sourceTokens:tokens};
}
const sequence=['BUS','LOAD','FIXED_SHUNT','VOLTAGE_DROOP_CONTROL','GENERATOR','SWITCHING_DEVICE_RATING_SET','BRANCH','SYSTEM_SWITCHING_DEVICE','TRANSFORMER','AREA','TWO_TERMINAL_DC','VSC_DC_LINE','IMPEDANCE_CORRECTION','MULTI_TERMINAL_DC','MULTI_SECTION_LINE','ZONE','INTER_AREA_TRANSFER','OWNER','FACTS_DEVICE','SWITCHED_SHUNT','GNE','INDUCTION_MACHINE','LOAD_TYPE','INTERFACE','INTERFACE_ELEMENT','SUBSTATION'];
const impedanceFields='r1_2 x1_2 sbase1_2 r2_3 x2_3 sbase2_3 r3_1 x3_1 sbase3_1 vmstar anstar'.split(' ');
export function decodeRaw(bytes:Uint8Array,name:string):PsseModel{
 const text=new TextDecoder('windows-1254',{fatal:true}).decode(bytes);const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(line=>!line.trimStart().startsWith('@!'));
 while(lines.length&&!lines[0].trim())lines.shift();if(lines.length<3)throw Error('Truncated RAW header');
 const id=splitRaw(lines[0]);if(id.length<6)throw Error('Missing RAW case identification');const rev=integer(id[2]);if(![35,36].includes(rev))throw Error(`UNSUPPORTED_RAW_REVISION: ${rev}`);
 const model=newModel(bytes,name,'RAW',rev,n(id[1]),n(id[5]),lines.slice(1,3));const tables:SourceTables={};
 let section=lines.slice(3,100).some(l=>/BEGIN BUS DATA/i.test(l))?'SYSTEM_WIDE':'BUS',sub:number|null=null,ended=false;
 const rawSections:Record<string,string[][]>={};
 for(let index=3;index<lines.length;index++){
  const line=lines[index].trim();if(!line)continue;if(/^(?:Q|'Q'|"Q")\s*(?:\/.*)?$/i.test(line)){ended=true;break;}
  if(/^0\s*(?:[,/]|$)/.test(line)){
   const begin=/BEGIN\s+([A-Z0-9_\-\s]+?)(?:\s+DATA|$)/i.exec(line);
   if(begin)section=begin[1].trim().replace(/[\s-]+/g,'_').toUpperCase();
   else if(/END OF SUBSTATION TERMINAL/i.test(line))section='SUBSTATION';
   else if(/END OF SUBSTATION DATA/i.test(line))section='END';
   else{const next=sequence.indexOf(section)+1;if(next<=0||next>=sequence.length)throw Error(`Unknown RAW section transition: ${section}`);section=sequence[next];}
   continue;
  }
  if(section==='END')throw Error('Unexpected data after final RAW section');const tokens=splitRaw(line);(rawSections[section]??=[]).push(tokens);
  if(section==='SUBSTATION'){sub=integer(tokens[0]);(tables.SUBSTATION??=[]).push(named(tokens,rawFields.SUBSTATION));section='SUBSTATION_NODE';}
  else if(section.startsWith('SUBSTATION_')){if(sub===null)throw Error('Node-breaker record without parent substation');(tables[section]??=[]).push({isub:sub,...(section==='SUBSTATION_TERMINAL'?terminal(tokens):named(tokens,rawFields[section]??[]))});}
 }
 if(!ended)throw Error('TRUNCATED_RAW: missing Q end marker');
 for(const [key,rows]of Object.entries(rawSections)){
  if(key.startsWith('SUBSTATION'))continue;
  if(key==='TRANSFORMER'){
   for(let i=0;i<rows.length;){const first=rows[i],three=integer(first[2])!==0,count=three?5:4;if(i+count>rows.length)throw Error('TRUNCATED_TRANSFORMER');
    if(first.length<12||rows[i+1].length<(three?11:3)||rows[i+2].length<15||rows[i+3].length<2||(three&&rows[i+4].length<15))throw Error('Truncated transformer winding or impedance record');
    const row={...named(first,rawFields.TRANSFORMER),...named(rows[i+1],three?impedanceFields:impedanceFields.slice(0,3)),...named(rows[i+2],windingFields(1)),...named(rows[i+3],windingFields(2)),...(three?named(rows[i+4],windingFields(3)):{}),sourceLines:rows.slice(i,i+count)};
    (tables[key]??=[]).push(row);i+=count;
   }
  }else tables[key]=rows.map(tokens=>({...named(tokens,rawFields[key]??[]),sourceTokens:tokens}));
 }
 model.case.identification=id;normalizeRawTables(model,tables);return model;
}
function object(v:unknown,label:string):Record<string,unknown>{if(!v||typeof v!=='object'||Array.isArray(v))throw Error(`Invalid RAWX ${label}`);return v as Record<string,unknown>;}
export function decodeRawx(bytes:Uint8Array,name:string):PsseModel{
 const root=object(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes).replace(/^\uFEFF/,'')),'root'),network=object(root.network,'network');const tables:SourceTables={};let caseid:SourceRow|undefined;
 for(const [key,input]of Object.entries(network)){
  const table=object(input,key);if(!Array.isArray(table.fields)||!Array.isArray(table.data))throw Error(`Invalid RAWX table ${key}`);
  const fields=table.fields.map(x=>s(x).toLowerCase());if(fields.some(x=>!x)||new Set(fields).size!==fields.length)throw Error(`Duplicate/empty RAWX fields: ${key}`);
  const flat=['caseid','general','gauss','newton','adjust','tysl','solver'].includes(key);const rows=flat?[table.data]:table.data;
  const section=rawxSection[key]??key.toUpperCase(),known=new Set([...(rawFields[section]??[]),...(section==='TRANSFORMER'?[...impedanceFields,...windingFields(1),...windingFields(2),...windingFields(3)]:[])]);
  const records=rows.map((row:unknown)=>{if(!Array.isArray(row)||row.length>fields.length)throw Error(`Invalid RAWX row ${key}`);return Object.fromEntries(fields.map((field,i)=>{const value=row[i]??null,isText=textFields.has(field)||section==='SUBSTATION_TERMINAL'&&field==='type';return[field,value===null?null:known.has(field)&&!isText?n(value,`${section}.${field}`):isText?s(value):value];}));});
  if(key==='caseid')caseid=records[0];tables[rawxSection[key]??key.toUpperCase()]=records;
 }
 if(!caseid)throw Error('Missing RAWX caseid');const rev=integer(caseid.rev);if(![35,36].includes(rev))throw Error(`UNSUPPORTED_RAWX_REVISION: ${rev}`);
 const model=newModel(bytes,name,'RAWX',rev,n(caseid.sbase),n(caseid.basfrq),[s(caseid.title1),s(caseid.title2)]);model.case.general=root.general;normalizeRawTables(model,tables);return model;
}
