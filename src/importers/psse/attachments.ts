import {sha256} from '@noble/hashes/sha2.js';

export interface PsseSidecarInput {archiveName:string;file:File}
export interface PsseSidecarAttachment extends PsseSidecarInput {format:'IEC'|'GCP'|'MON'|'CON'|'SAV'|'INVENTORY_JSON';byteLength:number;sha256:string;catalog?:PsseInventoryCatalog}
export interface PsseAttachmentBundle {sourceSha256:string;items:PsseSidecarAttachment[]}

/** YTBS inventory sidecar tables; `contingency` is a future N-1 input candidate, never a study result. */
export const PSSE_INVENTORY_TABLES=['bus','acline','transformer','generator','load','fixshunt','sysswd','contingency'] as const;
export type PsseInventoryTable=typeof PSSE_INVENTORY_TABLES[number];
/** Per-table row previews are capped so a multi-megabyte sidecar never bloats the catalog summary. */
export const PSSE_INVENTORY_PREVIEW_LIMIT=50;
export interface PsseInventoryRowRef {ibus?:string|number;ckt?:string|number;machid?:string|number;id?:string|number}
export interface PsseInventoryTableRow {ad:string|null;ibus:string|null;ckt:string|null;machid:string|null;id:string|null}
export interface PsseInventoryTableSummary {table:PsseInventoryTable;recordCount:number;malformedCount:number}
export interface PsseInventoryCatalog {
 tables:readonly PsseInventoryTableSummary[];
 /** Future N-1 input candidate count only — contingencies are cataloged, never applied or evaluated here. */
 contingencyCount:number;
 /** Capped identity+ad preview rows captured for the table (empty for tables the sidecar does not carry). */
 preview(table:PsseInventoryTable,limit?:number):readonly PsseInventoryTableRow[];
 /** Identity-based label lookup (table, ibus[, ckt][, machid][, id]) -> ad; null when no stored ad matches. */
 lookup(table:PsseInventoryTable,ref:PsseInventoryRowRef):string|null;
}

const hex=(bytes:Uint8Array)=>Array.from(bytes,value=>value.toString(16).padStart(2,'0')).join('');
const formatOf=(name:string):PsseSidecarAttachment['format']=>{const extension=name.split('.').at(-1)?.toUpperCase();if(extension==='JSON')return'INVENTORY_JSON';if(extension==='IEC'||extension==='GCP'||extension==='MON'||extension==='CON')return extension;if(extension==='SAV')return'SAV';throw new Error(`UNSUPPORTED_PSSE_SIDECAR:${name}`);};
const text=(value:unknown):string|null=>{if(value===null||value===undefined)return null;const label=String(value).trim();return label===''?null:label;};
const isRow=(value:unknown):value is Record<string,unknown>=>typeof value==='object'&&value!==null&&!Array.isArray(value);
const isRowCollection=(value:unknown):value is ReadonlyArray<unknown>|Record<string,unknown>=>Array.isArray(value)||isRow(value);
const rowsOf=(value:unknown):readonly unknown[]=>Array.isArray(value)?value:isRow(value)?Object.values(value):[];

/**
 * Parse the YTBS inventory sidecar CATALOG-ONLY: per-table record counts, an identity label index
 * ((table, ibus, ckt, machid/id) -> ad) and capped row previews. Rows may be arrays or objects keyed
 * by id; numeric and string ids are String()-coerced; malformed rows are skipped into malformedCount.
 * The catalog is diagnostic metadata for labels only — it is never solver input or a study result.
 */
export function parsePsseInventoryCatalog(json:string):PsseInventoryCatalog|null{
 const clean=json.charCodeAt(0)===0xFEFF?json.slice(1):json;let parsed:unknown;try{parsed=JSON.parse(clean);}catch{return null;}
 if(!isRow(parsed))return null;
 const present=PSSE_INVENTORY_TABLES.filter(table=>isRowCollection(parsed[table]));if(!present.length)return null;
 const previews=new Map<PsseInventoryTable,PsseInventoryTableRow[]>(),labels=new Map<PsseInventoryTable,Map<string,string>>(),counts=new Map<PsseInventoryTable,{records:number;malformed:number}>();
 for(const table of present){const summary={records:0,malformed:0},tableLabels=new Map<string,string>(),preview:PsseInventoryTableRow[]=[];for(const entry of rowsOf(parsed[table])){if(!isRow(entry)){summary.malformed++;continue;}summary.records++;const row:PsseInventoryTableRow={ad:text(entry.ad),ibus:text(entry.ibus),ckt:text(entry.ckt),machid:text(entry.machid),id:text(entry.id)};if(preview.length<PSSE_INVENTORY_PREVIEW_LIMIT)preview.push(row);if(row.ad&&row.ibus){const keys=[`i:${row.ibus}`];if(row.ckt)keys.push(`c:${row.ibus}|${row.ckt}`);if(row.machid)keys.push(`g:${row.ibus}|${row.machid}`);if(row.id)keys.push(`d:${row.ibus}|${row.id}`);for(const key of keys)if(!tableLabels.has(key))tableLabels.set(key,row.ad);}}previews.set(table,preview);labels.set(table,tableLabels);counts.set(table,summary);}
 return{tables:PSSE_INVENTORY_TABLES.map(table=>({table,recordCount:counts.get(table)?.records??0,malformedCount:counts.get(table)?.malformed??0})),contingencyCount:counts.get('contingency')?.records??0,preview:(table,limit=PSSE_INVENTORY_PREVIEW_LIMIT)=>previews.get(table)?.slice(0,Math.max(0,limit))??[],lookup:(table,ref)=>{const tableLabels=labels.get(table);if(!tableLabels)return null;const ibus=text(ref.ibus);if(!ibus)return null;const ckt=text(ref.ckt),machid=text(ref.machid),id=text(ref.id);for(const key of [ckt?`c:${ibus}|${ckt}`:null,machid?`g:${ibus}|${machid}`:null,id?`d:${ibus}|${id}`:null,`i:${ibus}`]){if(key&&tableLabels.has(key))return tableLabels.get(key)!;}return null;}};
}

/** Sidecars stay opaque, byte-preserved files; the inventory JSON is cataloged read-only and nothing here feeds the solver. */
export async function hashPsseSidecars(sourceSha256:string,inputs:readonly PsseSidecarInput[]):Promise<PsseAttachmentBundle>{
 const items:PsseSidecarAttachment[]=[];for(const input of inputs){const bytes=new Uint8Array(await input.file.arrayBuffer());const fileFormat=formatOf(input.archiveName),catalog=fileFormat==='INVENTORY_JSON'?parsePsseInventoryCatalog(new TextDecoder().decode(bytes)):null;items.push({archiveName:input.archiveName,format:fileFormat,byteLength:bytes.byteLength,sha256:hex(sha256(bytes)),file:input.file,...(catalog?{catalog}:{})});}return{sourceSha256,items};
}
