import type {Point} from './physical-layout';
export interface Conductor {points:readonly Point[];terminalId:string}
/** Only proper interior crossings of different source nodes are jumps. Shared
 * endpoints / native-node conductors remain joins, without geometric inference. */
export function wireCrossings(wires:readonly Conductor[]){
 const crossings:{x:number;y:number;vertical:boolean;wire:number;other:number}[]=[],seen=new Set<string>();
 for(let a=0;a<wires.length;a++)for(let b=a+1;b<wires.length;b++){
  if(wires[a].terminalId===wires[b].terminalId)continue;
  for(let i=1;i<wires[a].points.length;i++)for(let j=1;j<wires[b].points.length;j++){
   const [p,q]=[wires[a].points[i-1],wires[a].points[i]],[r,s]=[wires[b].points[j-1],wires[b].points[j]],vertical=p[0]===q[0],otherVertical=r[0]===s[0];if(vertical===otherVertical)continue;
   const v=vertical?[p,q]:[r,s],h=vertical?[r,s]:[p,q],x=v[0][0],y=h[0][1];
   if(x<=Math.min(h[0][0],h[1][0])+7||x>=Math.max(h[0][0],h[1][0])-7||y<=Math.min(v[0][1],v[1][1])+7||y>=Math.max(v[0][1],v[1][1])-7)continue;
   const key=x+','+y;if(seen.has(key))continue;seen.add(key);crossings.push({x,y,vertical,wire:a,other:b});
  }
 }
 return crossings;
}
