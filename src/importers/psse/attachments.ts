import {sha256} from '@noble/hashes/sha2.js';

export interface PsseSidecarInput {archiveName:string;file:File}
export interface PsseSidecarAttachment extends PsseSidecarInput {format:'IEC'|'GCP'|'MON'|'CON'|'INVENTORY_JSON';byteLength:number;sha256:string}
export interface PsseAttachmentBundle {sourceSha256:string;items:PsseSidecarAttachment[]}

const hex=(bytes:Uint8Array)=>Array.from(bytes,value=>value.toString(16).padStart(2,'0')).join('');
const formatOf=(name:string):PsseSidecarAttachment['format']=>{const extension=name.split('.').at(-1)?.toUpperCase();if(extension==='JSON')return'INVENTORY_JSON';if(extension==='IEC'||extension==='GCP'||extension==='MON'||extension==='CON')return extension;throw new Error(`UNSUPPORTED_PSSE_SIDECAR:${name}`);};

/** Sidecars stay opaque, byte-preserved files; they are not analysis results or solver inputs. */
export async function hashPsseSidecars(sourceSha256:string,inputs:readonly PsseSidecarInput[]):Promise<PsseAttachmentBundle>{
 const items:PsseSidecarAttachment[]=[];for(const input of inputs){const bytes=new Uint8Array(await input.file.arrayBuffer());items.push({archiveName:input.archiveName,format:formatOf(input.archiveName),byteLength:bytes.byteLength,sha256:hex(sha256(bytes)),file:input.file});}return{sourceSha256,items};
}
