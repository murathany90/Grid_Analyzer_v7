/** Schematic TM-to-TM geometry, separated in screen pixels (no geographic route inferred). */
export function parallelPath(from,to,{index=0,count=1,separated=true,forward=true,scale=1}={}) {
  if(!separated||count<2)return [from,to];
  const a=forward?from:to,b=forward?to:from,dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);
  if(!length)return [from,to];
  const screenScale=Math.max(.0001,scale),offset=(index-(count-1)/2)*5/screenScale;
  const lead=Math.min(.12,12/(length*screenScale)),segments=Math.max(6,Math.min(48,Math.ceil(length*screenScale/100)));
  const fractions=[0,lead,...Array.from({length:segments-1},(_,i)=>lead+(1-2*lead)*(i+1)/segments),1-lead,1];
  const points=fractions.map(t=>{const edge=t===0||t===1?0:1;return {x:a.x+dx*t-dy/length*offset*edge,y:a.y+dy*t+dx/length*offset*edge};});
  return forward?points:points.reverse();
}
