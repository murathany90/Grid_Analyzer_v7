const tables=['bus','acline','transformer','generator','load','fixshunt','sysswd','contingency'];
const scalar=value=>value==null?null:String(value).trim()||null;
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
export function buildInventoryCatalog(text){
  let parsed;try{parsed=JSON.parse(text.replace(/^\uFEFF/,''));}catch{return null;}
  if(!object(parsed)||!tables.some(key=>object(parsed[key])||Array.isArray(parsed[key])))return null;
  const indexes=new Map(),previews=new Map(),counts=new Map();
  for(const key of tables){
    const source=parsed[key],rows=Array.isArray(source)?source:object(source)?Object.values(source):[],index=new Map(),preview=[];let malformed=0,records=0;
    for(const row of rows){
      if(!object(row)){malformed++;continue;}records++;
      const entry=Object.fromEntries(['ad','ibus','ckt','machid','id'].map(k=>[k,scalar(row[k])]));if(preview.length<50)preview.push(entry);
      if(entry.ad&&entry.ibus)for(const id of [`i:${entry.ibus}`,entry.ckt?`c:${entry.ibus}|${entry.ckt}`:null,entry.machid?`g:${entry.ibus}|${entry.machid}`:null,entry.id?`d:${entry.ibus}|${entry.id}`:null])if(id&&!index.has(id))index.set(id,entry.ad);
    }
    indexes.set(key,index);previews.set(key,preview);counts.set(key,{records,malformed});
  }
  return {tables:tables.map(table=>({table,recordCount:counts.get(table).records,malformedCount:counts.get(table).malformed})),contingencyCount:counts.get('contingency').records,
    preview:(key,limit=50)=>previews.get(key)?.slice(0,Math.max(0,limit))??[],
    lookup(key,identity){const index=indexes.get(key),bus=scalar(identity.ibus);if(!index||!bus)return null;for(const id of [identity.ckt?`c:${bus}|${scalar(identity.ckt)}`:null,identity.machid?`g:${bus}|${scalar(identity.machid)}`:null,identity.id?`d:${bus}|${scalar(identity.id)}`:null,`i:${bus}`])if(id&&index.has(id))return index.get(id);return null;}
  };
}
export async function inspectAttachments(sourceSha256,entries,hash){
  const items=[];
  for(const entry of entries){
    const file=entry.file??entry,archiveName=entry.archiveName??file.name,extension=archiveName.split('.').at(-1).toUpperCase();
    if(!['IEC','GCP','MON','CON','JSON','SAV'].includes(extension))continue;
    const bytes=new Uint8Array(await file.arrayBuffer()),format=extension==='JSON'?'INVENTORY_JSON':extension,catalog=format==='INVENTORY_JSON'?buildInventoryCatalog(new TextDecoder().decode(bytes)):null;
    items.push({archiveName,file,format,byteLength:bytes.byteLength,sha256:Array.from(hash(bytes),b=>b.toString(16).padStart(2,'0')).join(''),...(catalog?{catalog}:{})});
  }
  return {sourceSha256,items};
}
