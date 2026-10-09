import { SaxesParser, type SaxesTagNS } from 'saxes';
import { inspectArchive, type Archive, type ArchiveEntry, checkCancel, safePath } from './archive';
import type { BenchmarkAnalysis, RawTable } from '../../domain/benchmark/types';

const SPREADSHEET='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const MAX_ROWS=250000,MAX_CELLS=10000000,MAX_TEXT=32767;
function schemaError(message:string):never{throw Error(`SOURCE_SCHEMA_MISMATCH: ${message}`);}
const attr=(tag:SaxesTagNS,key:string)=>Object.values(tag.attributes).find(a=>a.name===key||a.local===key)?.value??'';
function parser(){const p=new SaxesParser({xmlns:true});p.on('doctype',()=>schemaError('DTD forbidden'));p.on('error',e=>{throw Error(`INVALID_XML: ${e.message}`);});return p;}
async function xml(archive:Archive,entry:ArchiveEntry,configure:(p:ReturnType<typeof parser>)=>void,signal?:AbortSignal){
  const p=parser(),decoder=new TextDecoder('utf-8',{fatal:true});configure(p);
  await archive.stream(entry,bytes=>p.write(decoder.decode(bytes,{stream:true})),signal);p.write(decoder.decode()).close();checkCancel(signal);
}
/** Read shared strings and one Raw worksheet at a time, with bounded SAX buffers. */
export async function readWorkbook(file:File,analysis:BenchmarkAnalysis,fileSha256:string,expected:Record<string,readonly string[]>,signal?:AbortSignal):Promise<Record<string,RawTable>>{
  const archive=await inspectArchive(file,signal),byName=new Map(archive.entries.map(e=>[e.name,e]));
  const need=(name:string)=>byName.get(name)??schemaError(`missing OOXML part ${name}`);
  const strings:string[]=[];let textBudget=0;
  if(byName.has('xl/sharedStrings.xml'))await xml(archive,need('xl/sharedStrings.xml'),p=>{
    let inSi=false,inText=false,text='';
    p.on('opentag',t=>{if(t.local==='si'){inSi=true;text='';}if(t.local==='t'&&inSi)inText=true;});
    const accept=(s:string)=>{if(inText){text+=s;if(text.length>MAX_TEXT)schemaError('shared string too long');}};
    p.on('text',accept);p.on('cdata',accept);
    p.on('closetag',t=>{if(t.local==='t')inText=false;if(t.local==='si'){strings.push(text);inSi=false;textBudget+=text.length;if(strings.length>1000000||textBudget>64*1024**2)schemaError('shared string budget');}});
  },signal);
  const rels=new Map<string,string>();
  await xml(archive,need('xl/_rels/workbook.xml.rels'),p=>p.on('opentag',t=>{
    if(t.local!=='Relationship')return;
    if(attr(t,'TargetMode')==='External')schemaError('external relationship');
    const id=attr(t,'Id'),target=attr(t,'Target');if(rels.has(id))schemaError('duplicate relationship');
    const name=target.startsWith('/')?target.slice(1):'xl/'+target;
    if(!safePath(name))schemaError('unsafe relationship target');rels.set(id,name);
  }),signal);
  const sheets:{name:string;part:string}[]=[];const sheetNames=new Set<string>();let date1904=false;
  await xml(archive,need('xl/workbook.xml'),p=>p.on('opentag',t=>{
    if(t.uri!==SPREADSHEET)schemaError('unsupported workbook namespace');
    if(t.local==='workbookPr')date1904=['1','true'].includes(attr(t,'date1904'));
    if(t.local==='sheet'){const name=attr(t,'name'),part=rels.get(attr(t,'r:id'));if(!part||sheetNames.has(name))schemaError('missing/duplicate sheet');sheetNames.add(name);if(name.endsWith('_Raw'))sheets.push({name,part});}
  }),signal);
  const dateStyles=new Set<number>();
  if(byName.has('xl/styles.xml'))await xml(archive,need('xl/styles.xml'),p=>{
    const dateFormats=new Set<number>();let xfs=false,index=0;
    p.on('opentag',t=>{if(t.local==='numFmt'&&/[ydhs]/i.test(attr(t,'formatCode').replace(/"[^"]*"|\[[^\]]*\]/g,'')))dateFormats.add(Number(attr(t,'numFmtId')));if(t.local==='cellXfs'){xfs=true;index=0;}if(t.local==='xf'&&xfs){const id=Number(attr(t,'numFmtId'));if(id>=14&&id<=22||dateFormats.has(id))dateStyles.add(index);index++;}});
    p.on('closetag',t=>{if(t.local==='cellXfs')xfs=false;});
  },signal);
  const tables:Record<string,RawTable>=Object.create(null);let cellCount=0,rowCount=0;
  for(const {name,part} of sheets){
    const required=expected[name];if(!required)schemaError(`unknown Raw sheet ${name}`);
    const table:RawTable={name,headers:[],rows:[],rowNumbers:[],metadata:Object.create(null),analysis,fileSha256,headerRow:0};let row:(string|number|null)[]=[],r=0,lastRow=0,column=-1,type='',style=-1,value='',capture=false,hasCache=false,hasFormula=false,flags:string[]=[];
    await xml(archive,need(part),p=>{
      p.on('opentag',t=>{
        if(t.uri!==SPREADSHEET)schemaError(`namespace in ${name}`);
        if(t.local==='row'){r=Number(attr(t,'r'));if(!Number.isInteger(r)||r<=lastRow||r>1048576)schemaError('invalid row address');lastRow=r;row=[];rowCount++;if(rowCount>MAX_ROWS)schemaError('row budget');}
        if(t.local==='c'){
          const ref=/^([A-Z]+)(\d+)$/.exec(attr(t,'r'));if(!ref||Number(ref[2])!==r)schemaError('invalid cell address');column=0;for(const letter of ref[1])column=column*26+letter.charCodeAt(0)-64;column--;if(column>255||row[column]!==undefined)schemaError('column budget / duplicate cell');
          type=attr(t,'t');style=Number(attr(t,'s')||-1);value='';hasCache=false;hasFormula=false;flags=[];if(++cellCount>MAX_CELLS)schemaError('cell budget');
        }
        if(t.local==='f')hasFormula=true;
        if(t.local==='v'||t.local==='t'){capture=true;hasCache=true;}
      });
      const accept=(s:string)=>{if(capture){value+=s;if(value.length>MAX_TEXT)schemaError('cell text budget');}};p.on('text',accept);p.on('cdata',accept);
      p.on('closetag',t=>{
        if(t.local==='v'||t.local==='t')capture=false;
        if(t.local==='c'){
          let parsed:string|number|null=value===''?null:value;
          if(type==='s'){if(!/^\d+$/.test(value)||Number(value)>=strings.length)schemaError('shared string index');parsed=strings[Number(value)];}
          else if(type==='e'){parsed=value;flags.push('EXCEL_ERROR');}
          else if(type==='b'){if(!['0','1'].includes(value))schemaError('boolean encoding');parsed=Number(value);}
          else if((!type||type==='n')&&value!==''){const n=Number(value);if(!Number.isFinite(n))schemaError('invalid numeric value');parsed=n;if(dateStyles.has(style))parsed=new Date((n-(date1904?24107:25569))*86400000).toISOString();}
          if(hasFormula&&!hasCache)flags.push('FORMULA_CACHE_MISSING');row[column]=parsed;
        }
        if(t.local==='row'){
          if(!row.some(v=>v!=null&&v!==''))return;
          if(!table.headers.length){
            if(required.every(h=>row.includes(h))){table.headers=Array.from({length:row.length},(_,i)=>String(row[i]??''));if(table.headers.some(h=>!h)||new Set(table.headers).size!==table.headers.length)schemaError(`duplicate / blank header ${name}`);table.headerRow=r;}
            else if(r>10)schemaError(`required headers missing in ${name}`);
          }else{
            if(row.length>table.headers.length)schemaError(`column beyond header ${name}`);
            const kind=table.headers.indexOf('kind');
            if(kind>=0&&row[kind]==='meta'){
              const k=table.headers.indexOf(name==='GA_Reference_Raw'?'metaKey':'key'),v=table.headers.indexOf(name==='GA_Reference_Raw'?'metaValue':'value');const key=String(row[k]??'');if(key in table.metadata&&table.metadata[key]!==String(row[v]??''))schemaError('conflicting metadata');table.metadata[key]=String(row[v]??'');
            }else{table.rows.push(Array.from({length:table.headers.length},(_,i)=>row[i]??null));table.rowNumbers.push(r);}
          }
        }
      });
    },signal);
    if(!table.headers.length)schemaError(`no header ${name}`);tables[name]=table;
  }
  for(const name of Object.keys(expected))if(!tables[name])schemaError(`missing sheet ${name}`);
  return tables;
}
