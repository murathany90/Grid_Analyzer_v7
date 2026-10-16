/** Independent world-coordinate oracle. No production layout helpers are used. */
export interface LabelBox {id:string;owner:string;role:string;text:string;anchorX?:number;x1:number;x2:number;y1:number;y2:number}
export interface LabelCell {id:string;axis:number;band:number;side:string;kv:number;ordinary:boolean;x1:number;x2:number}
export interface LabelSegment {owner:string;terminal:string;a:readonly number[];b:readonly number[]}
export function inspectLabelCells(texts:LabelBox[],cells:LabelCell[],wires:LabelSegment[],glyphs:LabelBox[]=[]){
 const errors:string[]=[],byOwner=new Map(cells.map(c=>[c.id,c]));
 for(const t of texts){const c=byOwner.get(t.owner);if(!c)continue;
  if(t.x1<c.x1-1||t.x2>c.x2+1||t.y1<c.band-29||t.y2>c.band+149)errors.push('LABEL_OUTSIDE_CELL '+t.owner+' '+t.text);
  if(t.role==='title'&&Math.abs((t.anchorX??(t.x1+t.x2)/2)-c.axis)>1)errors.push('LABEL_OFF_AXIS '+t.owner);
 }
 const bands=new Map<string,number>();for(const c of cells.filter(c=>c.ordinary&&c.kv<=36)){const k=c.side,prior=bands.get(k);if(prior!=null&&Math.abs(c.band-prior)>.01)errors.push('MV_BAND_MISMATCH '+c.id);else bands.set(k,c.band);}
 const hit=(a:LabelBox,b:LabelBox)=>Math.min(a.x2,b.x2)-Math.max(a.x1,b.x1)>.1&&Math.min(a.y2,b.y2)-Math.max(a.y1,b.y1)>.1;
 for(let i=0;i<texts.length;i++){const a=texts[i];for(const b of texts.slice(i+1))if(hit(a,b))errors.push('TEXT_TEXT '+a.owner+'/'+b.owner+' '+a.text+'/'+b.text);
  for(const b of glyphs)if(hit(a,b))errors.push('TEXT_GLYPH '+a.owner+'/'+b.owner+' '+a.text);
  for(const w of wires){const [p,q]=[w.a,w.b],inside=p[0]===q[0]?p[0]>a.x1-.5&&p[0]<a.x2+.5&&Math.max(p[1],q[1])>a.y1-.5&&Math.min(p[1],q[1])<a.y2+.5:p[1]===q[1]&&p[1]>a.y1-.5&&p[1]<a.y2+.5&&Math.max(p[0],q[0])>a.x1-.5&&Math.min(p[0],q[0])<a.x2+.5;if(inside)errors.push('TEXT_WIRE '+a.owner+'/'+w.owner+' '+a.text);}
 }
 return {errors:[...new Set(errors)],labels:texts.length,cells:cells.length};
}
export function sameLabelGeometry(a:unknown,b:unknown){return JSON.stringify(a)===JSON.stringify(b);}

/** Sample visible browser geometry in native sheet units, independent of zoom. */
export function sampleSvgLabels(svg:SVGSVGElement,graph:{feeders:{id:string;voltageKv:number;busSectionIds:string[];switchIds:string[];equipmentKeys:string[]}[];equipment:{id:string;sourceClass:string;kind:string}[]}){
 const inv=svg.getCTM()!.inverse(),box=(e:SVGGraphicsElement)=>{const b=e.getBBox(),m=inv.multiply(e.getCTM()!),ps=[[b.x,b.y],[b.x+b.width,b.y],[b.x,b.y+b.height],[b.x+b.width,b.y+b.height]].map(([x,y])=>new DOMPoint(x,y).matrixTransform(m));return {x1:Math.min(...ps.map(p=>p.x)),x2:Math.max(...ps.map(p=>p.x)),y1:Math.min(...ps.map(p=>p.y)),y2:Math.max(...ps.map(p=>p.y))};};
 const owner=(e:Element)=>e.closest<SVGElement>('[data-feeder-marker]')?.dataset.feederMarker??e.closest<SVGElement>('[data-id]')?.dataset.id??'';
 const texts=[...svg.querySelectorAll<SVGTextElement>('text')].filter(e=>!e.closest('[data-station-summary],[data-device-glyph]')&&e.getBBox().y>80).map((e,i)=>({id:String(i),owner:owner(e),role:e.dataset.labelZone??'',text:e.textContent??'',anchorX:new DOMPoint(Number(e.getAttribute('x')),Number(e.getAttribute('y'))).matrixTransform(inv.multiply(e.getCTM()!)).x,...box(e)}));
 const cells=[...svg.querySelectorAll<SVGGElement>('[data-feeder-marker]')].filter(e=>e.querySelector('[data-label-zone=title]')).map(e=>{const f=graph.feeders.find(f=>f.id===e.dataset.feederMarker)!,rect=e.dataset.compartment?.split(',').map(Number)??[-Infinity,0,Infinity,0];return {id:f.id,axis:Number(e.dataset.labelAxis),band:Number(e.dataset.labelBand),side:e.dataset.drawingSide??'',kv:f.voltageKv,ordinary:f.busSectionIds.length>0&&f.busSectionIds.length<=1&&!f.equipmentKeys.some(k=>graph.equipment.some(q=>k===q.sourceClass+'|'+q.id&&['transformer','transformer3w'].includes(q.kind))),x1:rect[0],x2:rect[2]};});
 const wires=[...svg.querySelectorAll<SVGPathElement>('path[data-connection]')].flatMap(e=>{const m=inv.multiply(e.getCTM()!),pairs:LabelSegment[]=[];let a:number[]|undefined;for(const t of (e.getAttribute('d')??'').matchAll(/([ML])([\d.-]+),([\d.-]+)/g)){const p=new DOMPoint(+t[2],+t[3]).matrixTransform(m),b=[p.x,p.y];if(t[1]==='L'&&a)pairs.push({owner:owner(e),terminal:e.dataset.nativeTerminal??'',a,b});a=b;}return pairs;});
 const glyphs=[...svg.querySelectorAll<SVGGraphicsElement>('[data-device-glyph]')].map((e,i)=>({id:String(i),owner:owner(e),role:'glyph',text:'',...box(e)}));
 return {texts,cells,wires,glyphs};
}
