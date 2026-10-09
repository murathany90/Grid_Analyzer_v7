export type BenchmarkAnalysis='LF'|'N1'|'SC';
export type Availability='RECORDED'|'RECORDED_NUMERIC_ZERO'|'NOT_RECORDED'|'INVALID'|'CAPABILITY_UNVERIFIED'|'MISSING_ATTRIBUTE'|string;
export interface BenchmarkCell {value:number|null;rawText:string;availability:Availability;qualityFlags:string[];unit:string;source:{fileSha256:string;sheet:string;row:number;column:string;analysis:BenchmarkAnalysis}}
/** Compact row storage; cells with provenance are materialized on request. */
export interface RawTable {name:string;headers:string[];rows:(string|number|null)[][];rowNumbers:number[];metadata:Record<string,string>;fileSha256:string;analysis:BenchmarkAnalysis;headerRow:number;cellFlags?:Record<string,string[]>}
export interface BenchmarkIdentity {studyCase:string;studyTime:string;modelHash:string;scenarioHash:string;topologyHash:string;project:string;pfVersion:string;effectiveMethod:string;requestedMethod:string;methodVerificationStatus:string;[key:string]:string}
export interface BenchmarkGroup {analysis:BenchmarkAnalysis;identity:BenchmarkIdentity;tables:Record<string,RawTable>;workbook:{file:string;sha256:string;sizeBytes:number};log:{file:string;sha256:string;text:string};sidecarSha256:string}
export interface BenchmarkPackage {groups:Record<BenchmarkAnalysis,BenchmarkGroup>;archiveSha256:string;elapsedMs:number;stages:string[]}
export function rowObject(table:RawTable,row:readonly(string|number|null)[]):Record<string,string|number|null>{return Object.fromEntries(table.headers.map((h,i)=>[h,row[i]??null]));}
export function readCell(table:RawTable,index:number,field:string,unit=''):BenchmarkCell{
  const column=table.headers.indexOf(field),raw=table.rows[index]?.[column],rawText=raw==null?'':String(raw),n=typeof raw==='number'?raw:rawText.trim()&&/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(rawText)?Number(rawText):NaN;
  const availability=column<0?'MISSING_ATTRIBUTE':rawText===''?'NOT_RECORDED':Number.isFinite(n)?n===0?'RECORDED_NUMERIC_ZERO':'RECORDED':'INVALID';
  let x=column+1,label='';while(x>0){x--;label=String.fromCharCode(65+x%26)+label;x=Math.floor(x/26);}
  return {value:Number.isFinite(n)?n:null,rawText,availability,qualityFlags:[...(column<0?['MISSING_ATTRIBUTE']:availability==='INVALID'?['NON_NUMERIC']:Math.abs(n)===9999||Math.abs(n)>=99999?['SENTINEL_CANDIDATE']:[]),...(table.cellFlags?.[`${table.rowNumbers[index]}:${column}`]||[])],unit,source:{fileSha256:table.fileSha256,sheet:table.name,row:table.rowNumbers[index],column:label,analysis:table.analysis}};
}
