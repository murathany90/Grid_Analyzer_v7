import {wireCrossings} from './wire-crossings';
import type {Point} from './physical-layout';
/** Only visible conductor intervals can need bridges. An SVG M is a real gap;
 * shared same-net intervals can change owner without creating an optical gap. */
export function visibleCrossings(paths:readonly {d:string;terminalId:string}[]){
 const groups=new Map<string,{terminalId:string;vertical:boolean;fixed:number;parts:{lo:number;hi:number;owner:number}[]}>();
 for(const [owner,path]of paths.entries()){let previous:Point|null=null;for(const m of path.d.matchAll(/([ML])([\d.-]+),([\d.-]+)/g)){const p:Point=[+m[2],+m[3]];if(m[1]==='L'&&previous){const vertical=p[0]===previous[0],axis=vertical?1:0,fixed=p[vertical?0:1],lo=Math.min(p[axis],previous[axis]),hi=Math.max(p[axis],previous[axis]);if(hi>lo){const key=path.terminalId+'|'+vertical+'|'+fixed,g=groups.get(key)??{terminalId:path.terminalId,vertical,fixed,parts:[]};g.parts.push({lo,hi,owner});groups.set(key,g);}}previous=p;}}
 const runs:{terminalId:string;points:Point[];parts:{lo:number;hi:number;owner:number}[]}[]=[];
 for(const g of groups.values()){let run:{lo:number;hi:number;parts:typeof g.parts}|null=null;const flush=()=>{if(run){const p=(n:number):Point=>g.vertical?[g.fixed,n]:[n,g.fixed];runs.push({terminalId:g.terminalId,points:[p(run.lo),p(run.hi)],parts:run.parts});}};for(const part of g.parts.sort((a,b)=>a.lo-b.lo)){if(run&&part.lo<=run.hi+.01){run.hi=Math.max(run.hi,part.hi);run.parts.push(part);}else{flush();run={lo:part.lo,hi:part.hi,parts:[part]};}}flush();}
 return wireCrossings(runs).map(c=>{const a=runs[c.wire],b=runs[c.other],coordinate=c.vertical?c.y:c.x,otherCoordinate=c.vertical?c.x:c.y;return{...c,wire:a.parts.find(p=>coordinate>=p.lo-.01&&coordinate<=p.hi+.01)!.owner,other:b.parts.find(p=>otherCoordinate>=p.lo-.01&&otherCoordinate<=p.hi+.01)!.owner};});
}
