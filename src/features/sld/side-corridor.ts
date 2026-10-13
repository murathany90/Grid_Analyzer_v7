/** Routing geometry only. Prefer the shorter outside corridor, with distinct
 * lanes that remain clear of rail bodies and their left-hand captions. */
export function nearestSideCorridor(fromX:number,toX:number,left:number,right:number,usedLeft=0,usedRight=0){
 const l=Math.max(108,left-92)+usedLeft*12,r=right+24+usedRight*12;
 return l>=40&&l<=left-10&&Math.abs(fromX-l)+Math.abs(toX-l)<Math.abs(fromX-r)+Math.abs(toX-r)?{x:l,side:'LEFT' as const}:{x:r,side:'RIGHT' as const};
}
