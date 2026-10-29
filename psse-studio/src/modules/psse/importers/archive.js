import { unzipSync } from 'fflate';
export async function unpackModel(file) {
  if(!/\.zip$/i.test(file.name))return {model:file,sidecars:[]};
  let total=0;
  const files=unzipSync(new Uint8Array(await file.arrayBuffer()),{filter(entry){
    total+=entry.originalSize;
    if(total>512*1024*1024||entry.originalSize>256*1024*1024)throw Error('ZIP_SIZE_LIMIT');
    if(/(^|[\\/])\.\.([\\/]|$)/.test(entry.name))throw Error('ZIP_PATH_INVALID');
    return !entry.name.endsWith('/');
  }});
  const entries=Object.entries(files), models=entries.filter(([name])=>/\.(sav|raw|rawx)$/i.test(name));
  if(!models.length)throw Error('ZIP içinde PSS/E SAV/RAW/RAWX modeli bulunamadı.');
  models.sort(([a],[b])=>Number(!/\.sav$/i.test(a))-Number(!/\.sav$/i.test(b))||a.localeCompare(b));
  const [name,bytes]=models[0];
  return {model:new File([bytes],name.split(/[\\/]/).at(-1)),sidecars:entries.filter(([n])=>n!==name).map(([n,b])=>new File([b],n))};
}
