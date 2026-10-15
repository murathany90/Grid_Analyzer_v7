/** Canvas budgets apply to the whole page; never crop to satisfy them. */
export function pngDimensions(width:number,height:number,requestedScale=2){
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw Error('Geçersiz SVG pafta boyutu');
  const scale=Math.min(requestedScale,16384/width,16384/height,Math.sqrt(32_000_000/(width*height)));
  if(scale<=0)throw Error('PNG boyutu hesaplanamadı');
  return {width:Math.max(1,Math.floor(width*scale)),height:Math.max(1,Math.floor(height*scale)),scale,reduced:scale<requestedScale};
}

export async function diagramPng(xml:string,notice:(message:string)=>void):Promise<Blob>{
  const source=new DOMParser().parseFromString(xml,'image/svg+xml'),svg=source.documentElement;
  if(source.querySelector('parsererror'))throw Error('SVG okunamadı');
  const box=(svg.getAttribute('viewBox')??'').trim().split(/\s+/).map(Number);
  const size=pngDimensions(box[2],box[3]);
  if(size.reduced)notice(`PNG: paftanın tamamı korunarak ölçek ${size.scale.toFixed(2)}× olarak sınırlandı (16.384 px / 32 MP).`);
  // Full export already contains explicit colors and glyphs. Resolve the paper
  // fallback for SVG image documents, which do not inherit application CSS.
  svg.setAttribute('width',String(box[2]));svg.setAttribute('height',String(box[3]));
  svg.setAttribute('style',`width:${box[2]}px;height:${box[3]}px;background:white;font-family:Arial,sans-serif;--sld-paper:white`);
  const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml;charset=utf-8'}));
  try{
    const image=new Image();await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(Error('SVG rasterleştirilemedi'));image.src=url;});
    const canvas=document.createElement('canvas');canvas.width=size.width;canvas.height=size.height;
    const context=canvas.getContext('2d');if(!context)throw Error('PNG canvas kullanılamıyor');
    context.fillStyle='#fff';context.fillRect(0,0,size.width,size.height);context.drawImage(image,0,0,size.width,size.height);
    try{return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('PNG belleği yetersiz veya çıktı üretilemedi')),'image/png'));}
    finally{canvas.width=canvas.height=0;}
  }finally{URL.revokeObjectURL(url);}
}

export async function downloadDiagramPng(xml:string,filename:string,notice:(message:string)=>void):Promise<void>{
  const blob=await diagramPng(xml,notice),url=URL.createObjectURL(blob),link=document.createElement('a');
  try{link.href=url;link.download=filename;document.body.append(link);link.click();await new Promise(resolve=>setTimeout(resolve,1000));}
  finally{link.remove();URL.revokeObjectURL(url);}
}
