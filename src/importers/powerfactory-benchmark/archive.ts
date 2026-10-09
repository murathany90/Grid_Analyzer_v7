import { Inflate } from 'fflate';
import { sha256 } from '@noble/hashes/sha2.js';

export interface ArchiveEntry { name:string; size:number; compressedSize:number; offset:number; method:number; crc:number; flags:number }
export interface Archive {
  entries:ArchiveEntry[];
  stream(entry:ArchiveEntry,accept:(chunk:Uint8Array)=>void,signal?:AbortSignal):Promise<void>;
  file(entry:ArchiveEntry,signal?:AbortSignal):Promise<File>;
}
export const checkCancel=(signal?:AbortSignal)=>{if(signal?.aborted)throw Error('CANCELLED');};
const fail=(reason:string):never=>{throw Error(`UNSAFE_ARCHIVE: ${reason}`);};
const LIMIT=512*1024**2;
const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
export function safePath(name:string):boolean {
  return !!name&&!/^[\\/]|^[a-z]:|[\u0000-\u001f\u007f]/i.test(name)&&!name.replaceAll('\\','/').split('/').some(p=>p==='..'||p==='.') ;
}
export async function hashBlob(blob:Blob,signal?:AbortSignal):Promise<string>{
  const hash=sha256.create();
  for(let p=0;p<blob.size;p+=65536){checkCancel(signal);hash.update(new Uint8Array(await blob.slice(p,p+65536).arrayBuffer()));}
  checkCancel(signal);return Array.from(hash.digest(),v=>v.toString(16).padStart(2,'0')).join('');
}
/** Bounded central directory, CRC checked streaming extraction; no eager unzip. */
export async function inspectArchive(file:Blob,signal?:AbortSignal):Promise<Archive>{
  checkCancel(signal);if(file.size>LIMIT)fail('compressed file exceeds 512 MiB');
  const tailOffset=Math.max(0,file.size-65557),tail=new DataView(await file.slice(tailOffset).arrayBuffer());
  let end=-1;for(let p=tail.byteLength-22;p>=0;p--)if(tail.getUint32(p,true)===0x06054b50&&p+22+tail.getUint16(p+20,true)===tail.byteLength){end=p;break;}
  if(end<0)fail('missing end record');
  const count=tail.getUint16(end+10,true),length=tail.getUint32(end+12,true),offset=tail.getUint32(end+16,true);
  if(tail.getUint16(end+4,true)||tail.getUint16(end+6,true)||count!==tail.getUint16(end+8,true)||count===65535||offset===0xffffffff)fail('ZIP64 / split archive');
  if(count>1000||length>4*1024**2||offset+length>tailOffset+end)fail('directory limits');
  const data=new Uint8Array(await file.slice(offset,offset+length).arrayBuffer()),view=new DataView(data.buffer),entries:ArchiveEntry[]=[],names=new Set<string>();let p=0,total=0;
  for(let i=0;i<count;i++){
    checkCancel(signal);if(p+46>data.length||view.getUint32(p,true)!==0x02014b50)fail('invalid directory');
    const flags=view.getUint16(p+8,true),method=view.getUint16(p+10,true),crc=view.getUint32(p+16,true),compressedSize=view.getUint32(p+20,true),size=view.getUint32(p+24,true),n=view.getUint16(p+28,true),extra=view.getUint16(p+30,true),comment=view.getUint16(p+32,true),entryOffset=view.getUint32(p+42,true);
    if(p+46+n+extra+comment>data.length)fail('invalid name length');
    const name=new TextDecoder(flags&2048?'utf-8':'windows-1254',{fatal:true}).decode(data.subarray(p+46,p+46+n)),key=name.replaceAll('\\','/').normalize('NFC').toLowerCase();p+=46+n+extra+comment;
    if(!safePath(name)||names.has(key))fail('path traversal / duplicate entry');names.add(key);
    total+=size;if(size>LIMIT||total>2*1024**3||size/Math.max(1,compressedSize)>1000)fail('decompression budget');
    if(flags&1||![0,8].includes(method)||entryOffset+30+compressedSize>offset)fail('encrypted / invalid entry');
    if(!name.endsWith('/'))entries.push({name,size,compressedSize,offset:entryOffset,method,crc,flags});
  }
  if(p!==data.length)fail('trailing central directory');
  const stream:Archive['stream']=async(entry,accept,signal)=>{
    checkCancel(signal);if(!entries.includes(entry))fail('foreign entry');
    const header=new DataView(await file.slice(entry.offset,entry.offset+30).arrayBuffer());
    if(header.byteLength!==30||header.getUint32(0,true)!==0x04034b50||header.getUint16(6,true)!==entry.flags||header.getUint16(8,true)!==entry.method)fail('local header mismatch');
    const nameLength=header.getUint16(26,true),name=new TextDecoder(entry.flags&2048?'utf-8':'windows-1254',{fatal:true}).decode(await file.slice(entry.offset+30,entry.offset+30+nameLength).arrayBuffer());
    if(name!==entry.name)fail('local name mismatch');
    const start=entry.offset+30+nameLength+header.getUint16(28,true);if(start+entry.compressedSize>offset)fail('entry range');
    let size=0,crc=0xffffffff;
    const receive=(chunk:Uint8Array)=>{checkCancel(signal);size+=chunk.length;if(size>entry.size)fail('inflated size');for(const b of chunk)crc=crcTable[(crc^b)&255]^(crc>>>8);accept(chunk);};
    const inflater=entry.method===8?new Inflate(receive):null;
    for(let p=start;p<start+entry.compressedSize;p+=65536){checkCancel(signal);const bytes=new Uint8Array(await file.slice(p,Math.min(p+65536,start+entry.compressedSize)).arrayBuffer());if(inflater)inflater.push(bytes,p+65536>=start+entry.compressedSize);else receive(bytes);}
    if(entry.compressedSize===0&&inflater)inflater.push(new Uint8Array(),true);
    if(size!==entry.size||((crc^0xffffffff)>>>0)!==entry.crc)fail('CRC / size mismatch');
  };
  return {entries,stream,async file(entry,signal){const chunks:BlobPart[]=[];await stream(entry,b=>chunks.push(new Blob([b as Uint8Array<ArrayBuffer>])),signal);return new File(chunks,entry.name.split(/[\\/]/).at(-1)!);}};
}
