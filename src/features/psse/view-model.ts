import type {PsseBusBranchNetwork} from '../../domain/psse/network';
import type {PsseModel} from '../../importers/psse/types';
import {normalizeSourceAlias} from './geography';

/** View filters never change the electrical model. Actual BASKV wins over ZONE labels. */
export function psseVoltageGroup(kv:number|null):string{return kv===null||!Number.isFinite(kv)||kv<=0?'unknown':kv<=36?'<=36':String(kv);}
export function psseVoltageGroupLabel(key:string):string{return key==='<=36'?'≤36 kV':key==='unknown'?'kV bilinmiyor':`${Number(key).toLocaleString('tr-TR')} kV`;}
export function psseVoltageGroups(network:PsseBusBranchNetwork){return [...new Set(network.buses.filter(b=>b.source).map(b=>psseVoltageGroup(b.baseKv)))].sort((a,b)=>a==='unknown'?1:b==='unknown'?-1:a==='<=36'?1:b==='<=36'?-1:Number(b)-Number(a)).map(value=>({value,label:psseVoltageGroupLabel(value)}));}
export interface PsseStationView {id:string;name:string;busIndices:number[]}
/** Source ISUB first; otherwise a unique exact source name. No geographic or numeric-ID guess. */
export function psseStationViews(model:PsseModel,network:PsseBusBranchNetwork):PsseStationView[]{
 const sources=model.equipment.filter(e=>e.kind==='substation'),byId=new Map(sources.map(e=>[String(e.fields.isub??e.id),e])),names=new Map<string,typeof sources>();
 for(const e of sources){const name=normalizeSourceAlias(e.name);names.set(name,[...(names.get(name)??[]),e]);}
 const equipment=new Map(model.equipment.map(e=>[e.id,e])),groups=new Map<string,PsseStationView>();
 network.buses.forEach((bus,index)=>{if(!bus.source)return;const e=bus.sourceEquipmentId?equipment.get(bus.sourceEquipmentId):undefined;if(!e)return;const ref=e.fields.isub,explicit=ref!==undefined&&ref!==null&&ref!=='';const candidates=names.get(normalizeSourceAlias(e.name))??[];const station=explicit?byId.get(String(ref)):candidates.length===1?candidates[0]:undefined;if(!station)return;const id=String(station.fields.isub??station.id);let group=groups.get(id);if(!group){group={id,name:station.name,busIndices:[]};groups.set(id,group);}group.busIndices.push(index);});
 return [...groups.values()].sort((a,b)=>a.name.localeCompare(b.name,'tr'));
}
/** Shared Canvas/SVG affine fit, in already projected WGS84 coordinates. */
export function fitPsseProjectedPoints(points:readonly (readonly [number,number])[],width:number,height:number,baseScale:number,padding=36){
 if(!points.length)return null;const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);if(!xs.every(Number.isFinite)||!ys.every(Number.isFinite))return null;
 const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),scale=Math.min(baseScale*64,(width-padding*2)/Math.max(maxX-minX,.05),(height-padding*2)/Math.max(maxY-minY,.05));
 return{zoom:scale/baseScale,panX:-(minX+maxX)/2*scale,panY:-(minY+maxY)/2*scale};
}
