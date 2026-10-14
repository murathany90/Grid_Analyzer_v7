import type {Point} from './physical-layout';
export interface OwnedSegment {a:Point;b:Point;terminalId:string;owners:string[]}
/** Draw each collinear source-node interval once. Shared intervals retain all
 * physical owners; sharing between different source terminals is never allowed. */
export function claimConductor(a:Point,b:Point,terminalId:string,owner:string,ledger:OwnedSegment[]){
 const vertical=a[0]===b[0],axis=vertical?1:0,fixed=vertical?0:1,lo=Math.min(a[axis],b[axis]),hi=Math.max(a[axis],b[axis]);
 let ranges:[number,number][]=[[lo,hi]];const shared:OwnedSegment[]=[];
 for(const s of ledger){if(s.terminalId!==terminalId||s.a[fixed]!==a[fixed]||s.b[fixed]!==a[fixed])continue;
  const start=Math.max(lo,Math.min(s.a[axis],s.b[axis])),end=Math.min(hi,Math.max(s.a[axis],s.b[axis]));if(end-start<=.01)continue;
  if(!s.owners.includes(owner))s.owners.push(owner);shared.push(s);
  ranges=ranges.flatMap(([l,h])=>end<=l||start>=h?[[l,h]]:[...(start>l?[[l,start] as [number,number]]:[]),...(end<h?[[end,h] as [number,number]]:[])]);
 }
 const p=(n:number):Point=>vertical?[a[0],n]:[n,a[1]],forward=b[axis]>=a[axis];
 const fresh=ranges.filter(([l,h])=>h-l>.01).map(([l,h])=>({a:p(forward?l:h),b:p(forward?h:l),terminalId,owners:[owner]}));
 ledger.push(...fresh);return {fresh,shared};
}
