import type { CanonicalNetwork } from '../domain/model/network';
export interface NetworkGeometry { modelHash:string;paths:Map<string,readonly (readonly[number,number])[]>;parallel:Map<string,{index:number;count:number}> }
export function buildGeometry(n:CanonicalNetwork):NetworkGeometry{
  const sites=new Map(n.sites.map(s=>[s.id,s])),paths=new Map<string,readonly(readonly[number,number])[]>(),groups=new Map<string,string[]>(),parallel=new Map<string,{index:number;count:number}>();
  for(const line of n.lines){const ends=line.siteIds.map(id=>sites.get(id)).filter(s=>s?.lat!=null&&s.lon!=null);paths.set(line.id,line.coordinates.length>=2?line.coordinates:ends.map(s=>[s!.lat!,s!.lon!]as const));const key=[...line.siteIds].sort().join('|');if(!key)continue;if(!groups.has(key))groups.set(key,[]);groups.get(key)!.push(line.id);}
  for(const group of groups.values())group.forEach((id,index)=>parallel.set(id,{index,count:group.length}));return{modelHash:n.modelHash,paths,parallel};
}
export function offsetPath(points:readonly(readonly[number,number])[],offset:number):[number,number][]{
  if(!offset||points.length<2)return points.map(p=>[p[0],p[1]]);
  return points.map((p,i)=>{const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy)||1;return[p[0]-dy/length*offset,p[1]+dx/length*offset];});
}

/** Move the route endpoint nearest a station marker only when its geometry already reaches that station. */
export function routeEndpointToStationSide(points:readonly(readonly[number,number])[],station:readonly[number,number],side:readonly[number,number],maxDistance=24):[number,number][]{
  if(points.length<2)return points.map(point=>[point[0],point[1]]);
  const first=points[0],last=points[points.length-1],firstDistance=Math.hypot(first[0]-station[0],first[1]-station[1]),lastDistance=Math.hypot(last[0]-station[0],last[1]-station[1]);
  if(Math.min(firstDistance,lastDistance)>maxDistance)return points.map(point=>[point[0],point[1]]);
  const result=points.map(point=>[point[0],point[1]] as [number,number]);
  if(firstDistance<=lastDistance)result[0]=[side[0],side[1]];else result[result.length-1]=[side[0],side[1]];
  return result;
}
