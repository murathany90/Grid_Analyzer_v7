import { Inflate } from 'fflate';

const MAX_MODEL=512*1024*1024, MAX_ENTRIES=1000, MAX_DIRECTORY=4*1024*1024;
export interface ModelEntry {name:string;size:number;compressedSize:number;offset:number;method:number;crc:number}
export interface ModelArchive {entries:ModelEntry[];extract(entry:ModelEntry):Promise<File>}
const failure=(message:string)=>new Error(`ZIP okunamadı: ${message}`);
const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
const safeName=(name:string)=>!!name&&!/^[\\/]|^[a-z]:|[\u0000-\u001f]/i.test(name)&&!name.replaceAll('\\','/').split('/').some(p=>p==='..');
/** Read only the bounded directory and the selected entry; never materialize the whole ZIP. */
export async function inspectModelFile(file:File):Promise<ModelArchive> {
  if(file.size>MAX_MODEL)throw Error('Dosya 512 MiB sınırını aşıyor.');
  if(/\.json$/i.test(file.name))return{entries:[{name:file.name,size:file.size,compressedSize:file.size,offset:0,method:0,crc:0}],extract:async()=>file};
  if(!/\.zip$/i.test(file.name))throw Error('JSON veya ZIP dosyası seçin.');
  const tailOffset=Math.max(0,file.size-65557),tail=new DataView(await file.slice(tailOffset).arrayBuffer());
  let end=-1;for(let i=tail.byteLength-22;i>=0;i--)if(tail.getUint32(i,true)===0x06054b50&&i+22+tail.getUint16(i+20,true)===tail.byteLength){end=i;break;}
  if(end<0)throw failure('bozuk veya tamamlanmamış arşiv.');
  const count=tail.getUint16(end+10,true),directorySize=tail.getUint32(end+12,true),directoryOffset=tail.getUint32(end+16,true);
  if(tail.getUint16(end+4,true)||tail.getUint16(end+6,true)||count!==tail.getUint16(end+8,true)||count===65535||directoryOffset===0xffffffff)throw failure('çok parçalı / ZIP64 arşiv desteklenmiyor.');
  if(count>MAX_ENTRIES||directorySize>MAX_DIRECTORY)throw failure('en fazla 1000 dosya ve 4 MiB dizin kabul edilir.');
  if(directoryOffset+directorySize>tailOffset+end)throw failure('geçersiz dosya dizini.');
  const bytes=new Uint8Array(await file.slice(directoryOffset,directoryOffset+directorySize).arrayBuffer()),view=new DataView(bytes.buffer),entries:ModelEntry[]=[],names=new Set<string>();let pos=0,total=0;
  for(let i=0;i<count;i++){
    if(pos+46>bytes.length||view.getUint32(pos,true)!==0x02014b50)throw failure('dosya dizini bozuk.');
    const flags=view.getUint16(pos+8,true),method=view.getUint16(pos+10,true),crc=view.getUint32(pos+16,true),compressedSize=view.getUint32(pos+20,true),size=view.getUint32(pos+24,true),length=view.getUint16(pos+28,true),extra=view.getUint16(pos+30,true),comment=view.getUint16(pos+32,true),offset=view.getUint32(pos+42,true);
    if(pos+46+length+extra+comment>bytes.length)throw failure('dosya adı / dizin boyutu geçersiz.');
    const name=new TextDecoder(flags&2048?'utf-8':'windows-1254').decode(bytes.subarray(pos+46,pos+46+length));pos+=46+length+extra+comment;
    if(!safeName(name)||names.has(name))throw failure('güvensiz veya yinelenen dosya yolu.');names.add(name);
    total+=size;if(size>MAX_MODEL||total>2*1024**3||size/Math.max(1,compressedSize)>1000)throw failure('açılmış boyut / sıkıştırma oranı güvenlik sınırını aşıyor.');
    if(!/\.json$/i.test(name))continue;
    if(flags&1||![0,8].includes(method)||offset+30+compressedSize>directoryOffset)throw failure('şifreli, desteklenmeyen veya bozuk JSON girdisi.');
    entries.push({name,size,compressedSize,offset,method,crc});
  }
  if(!entries.length)throw failure('JSON dosyası bulunamadı.');
  return{entries,async extract(entry){
    if(!entries.includes(entry))throw failure('geçersiz dosya seçimi.');
    const local=new DataView(await file.slice(entry.offset,entry.offset+30).arrayBuffer());
    if(local.byteLength!==30||local.getUint32(0,true)!==0x04034b50||local.getUint16(6,true)&1||local.getUint16(8,true)!==entry.method)throw failure('yerel dosya başlığı bozuk.');
    const start=entry.offset+30+local.getUint16(26,true)+local.getUint16(28,true);
    if(start+entry.compressedSize>directoryOffset)throw failure('dosya içeriği arşiv sınırını aşıyor.');
    let size=0,crc=0xffffffff;const chunks:BlobPart[]=[];
    const accept=(chunk:Uint8Array)=>{size+=chunk.length;if(size>entry.size||size>MAX_MODEL)throw failure('açılmış veri beyan edilen boyutu aşıyor.');for(const byte of chunk)crc=crcTable[(crc^byte)&255]^(crc>>>8);chunks.push(new Blob([chunk as Uint8Array<ArrayBuffer>]));};
    const inflate=entry.method===8?new Inflate(accept):null;
    try{for(let offset=start;offset<start+entry.compressedSize;offset+=65536){const chunk=new Uint8Array(await file.slice(offset,Math.min(offset+65536,start+entry.compressedSize)).arrayBuffer());if(inflate)inflate.push(chunk,offset+65536>=start+entry.compressedSize);else accept(chunk);}
      if(size!==entry.size||(crc^0xffffffff)>>>0!==entry.crc)throw failure('boyut veya CRC doğrulaması başarısız.');
      return new File(chunks,entry.name.split(/[\\/]/).pop()!,{type:'application/json'});
    }catch(error){throw failure(error instanceof Error?error.message:'sıkıştırılmış veri bozuk.');}
  }};
}
