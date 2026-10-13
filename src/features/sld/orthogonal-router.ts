export type RoutePoint=readonly[number,number];
export interface RouteObstacle {id:string;x1:number;y1:number;x2:number;y2:number}
export interface RoutingOptions {obstacles?:readonly RouteObstacle[];existing?:readonly (readonly RoutePoint[])[];startNormal?:RoutePoint;endNormal?:RoutePoint;corridor?:{x1:number;y1:number;x2:number;y2:number}}
export const routeLength=(p:readonly RoutePoint[])=>p.slice(1).reduce((n,b,i)=>n+Math.abs(b[0]-p[i][0])+Math.abs(b[1]-p[i][1]),0);
function clean(p:RoutePoint[]):RoutePoint[]{const a=p.filter((v,i)=>!i||v[0]!==p[i-1][0]||v[1]!==p[i-1][1]);return a.filter((v,i)=>!i||i===a.length-1||!(a[i-1][0]===v[0]&&v[0]===a[i+1][0]||a[i-1][1]===v[1]&&v[1]===a[i+1][1]));}
export function obstacleIntersections(p:readonly RoutePoint[],o:readonly RouteObstacle[]):number {let n=0;for(let i=1;i<p.length;i++){const a=p[i-1],b=p[i];for(const r of o){if(a[0]===b[0]?a[0]>r.x1&&a[0]<r.x2&&Math.max(a[1],b[1])>r.y1&&Math.min(a[1],b[1])<r.y2:a[1]>r.y1&&a[1]<r.y2&&Math.max(a[0],b[0])>r.x1&&Math.min(a[0],b[0])<r.x2)n++;}}return n;}
export function wireCrossings(p:readonly RoutePoint[],routes:readonly (readonly RoutePoint[])[]):number{let n=0;for(let i=1;i<p.length;i++)for(const q of routes)for(let j=1;j<q.length;j++){const a=p[i-1],b=p[i],c=q[j-1],d=q[j];const horizontal=a[1]===b[1],other=c[1]===d[1];if(horizontal===other)continue;const h=horizontal?[a,b]:[c,d],v=horizontal?[c,d]:[a,b];if(v[0][0]>Math.min(h[0][0],h[1][0])&&v[0][0]<Math.max(h[0][0],h[1][0])&&h[0][1]>Math.min(v[0][1],v[1][1])&&h[0][1]<Math.max(v[0][1],v[1][1]))n++;}return n;}
/** Compile existing segment spans once per route search; candidate scores remain exact. */
export function compileWireCrossings(routes:readonly (readonly RoutePoint[])[]){const horizontal:{y:number;x1:number;x2:number}[]=[],vertical:{x:number;y1:number;y2:number}[]=[];for(const q of routes)for(let i=1;i<q.length;i++){const a=q[i-1],b=q[i];if(a[1]===b[1])horizontal.push({y:a[1],x1:Math.min(a[0],b[0]),x2:Math.max(a[0],b[0])});else vertical.push({x:a[0],y1:Math.min(a[1],b[1]),y2:Math.max(a[1],b[1])});}return (p:readonly RoutePoint[])=>{let n=0;for(let i=1;i<p.length;i++){const a=p[i-1],b=p[i];if(a[1]===b[1]){const lo=Math.min(a[0],b[0]),hi=Math.max(a[0],b[0]);for(const v of vertical)if(v.x>lo&&v.x<hi&&a[1]>v.y1&&a[1]<v.y2)n++;}else {const lo=Math.min(a[1],b[1]),hi=Math.max(a[1],b[1]);for(const h of horizontal)if(h.y>lo&&h.y<hi&&a[0]>h.x1&&a[0]<h.x2)n++;}}return n;};}
/** 0/1/2/3 bend candidates; contact normals are hard constraints, not cosmetic masks. */
export function routeCandidates(a:RoutePoint,b:RoutePoint,o:RoutingOptions={}):RoutePoint[][]{
 const pad=22,x=[(a[0]+b[0])/2,a[0]-pad,a[0]+pad,b[0]-pad,b[0]+pad,...(o.obstacles??[]).flatMap(r=>[r.x1-.5,r.x2+.5])],y=[(a[1]+b[1])/2,a[1]-pad,a[1]+pad,b[1]-pad,b[1]+pad,...(o.obstacles??[]).flatMap(r=>[r.y1-.5,r.y2+.5])];
 const nearby=(v:number[],a:number,b:number)=>[...new Set(v)].sort((x,y)=>Math.min(Math.abs(x-a),Math.abs(x-b))-Math.min(Math.abs(y-a),Math.abs(y-b))).slice(0,18);
 const all:RoutePoint[][]=[[a,[a[0],b[1]],b],[a,[b[0],a[1]],b]];if(a[0]===b[0]||a[1]===b[1])all.unshift([a,b]);for(const xx of x)all.push([a,[xx,a[1]],[xx,b[1]],b]);for(const yy of y)all.push([a,[a[0],yy],[b[0],yy],b]);for(const xx of nearby(x,a[0],b[0]))for(const yy of nearby(y,a[1],b[1]))all.push([a,[a[0],yy],[xx,yy],[xx,b[1]],b],[a,[xx,a[1]],[xx,yy],[b[0],yy],b]);
 const normal=(dx:number,dy:number,n:RoutePoint)=>n[0]?dy===0&&dx*n[0]>0:dx===0&&dy*n[1]>0;
 return all.map(clean).filter(p=>p.length>=2&&(!o.startNormal||normal(p[1][0]-a[0],p[1][1]-a[1],o.startNormal))&&(!o.endNormal||normal(p[p.length-2][0]-b[0],p[p.length-2][1]-b[1],o.endNormal)));
}
export function optimizedOrthogonalRoute(a:RoutePoint,b:RoutePoint,o:RoutingOptions={}):RoutePoint[]{
 const candidates=routeCandidates(a,b,o),crossings=compileWireCrossings(o.existing??[]),cost=(p:RoutePoint[])=>routeLength(p)+(p.length-2)*10+obstacleIntersections(p,o.obstacles??[])*100000+crossings(p)*35+(o.corridor?p.filter(v=>v[0]<o.corridor!.x1||v[0]>o.corridor!.x2||v[1]<o.corridor!.y1||v[1]>o.corridor!.y2).length*80:0);
 const best=candidates.map((p,i)=>({p,i,cost:cost(p)})).sort((a,b)=>a.cost-b.cost||a.i-b.i)[0]?.p;
 // Dense neighboring contacts can require more than three bends. Visibility search
 // is a fallback, not a guessed connection: both native/contact endpoints stay fixed.
 if(!best||obstacleIntersections(best,o.obstacles??[])){const detour=visibilityRoute(a,b,o,crossings);if(detour)return detour;}
 return best??[a,[a[0],b[1]],b];
}
function visibilityRoute(a:RoutePoint,b:RoutePoint,o:RoutingOptions,crossings:(p:readonly RoutePoint[])=>number):RoutePoint[]|null {
 const obstacles=o.obstacles??[],xs=[...new Set([a[0],b[0],...obstacles.flatMap(r=>[r.x1-.5,r.x2+.5])])].sort((a,b)=>a-b),ys=[...new Set([a[1],b[1],...obstacles.flatMap(r=>[r.y1-.5,r.y2+.5])])].sort((a,b)=>a-b);
 type State={x:number;y:number;dir:number;cost:number;score:number;key:string;prev:string|null};const heap:State[]=[],states=new Map<string,State>();
 const push=(s:State)=>{heap.push(s);let i=heap.length-1;while(i){const p=(i-1)>>1;if(heap[p].score<=s.score)break;heap[i]=heap[p];i=p;}heap[i]=s;};
 const pop=()=>{const first=heap[0],last=heap.pop()!;if(heap.length){let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&heap[c+1].score<heap[c].score)c++;if(heap[c].score>=last.score)break;heap[i]=heap[c];i=c;}heap[i]=last;}return first;};
 const normal=(dx:number,dy:number,n:RoutePoint)=>n[0]?dy===0&&dx*n[0]>0:dx===0&&dy*n[1]>0;
 const start:State={x:xs.indexOf(a[0]),y:ys.indexOf(a[1]),dir:0,cost:0,score:0,key:'START',prev:null};push(start);states.set(start.key,start);
 while(heap.length){const s=pop();if(states.get(s.key)!==s)continue;const p:RoutePoint=[xs[s.x],ys[s.y]];
  if(p[0]===b[0]&&p[1]===b[1]){const points:RoutePoint[]=[];let state:State|undefined=s;while(state){points.push([xs[state.x],ys[state.y]]);state=state.prev?states.get(state.prev):undefined;}return clean(points.reverse());}
  for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const x=s.x+dx,y=s.y+dy;if(x<0||x>=xs.length||y<0||y>=ys.length)continue;const q:RoutePoint=[xs[x],ys[y]],vx=q[0]-p[0],vy=q[1]-p[1];if(s.prev===null&&o.startNormal&&!normal(vx,vy,o.startNormal))continue;if(q[0]===b[0]&&q[1]===b[1]&&o.endNormal&&!normal(-vx,-vy,o.endNormal))continue;if(obstacleIntersections([p,q],obstacles))continue;
   const dir=dx?1:2,key=x+':'+y+':'+dir,cost=s.cost+Math.abs(vx)+Math.abs(vy)+(s.dir&&s.dir!==dir?10:0)+crossings([p,q])*35+(o.corridor&&(q[0]<o.corridor.x1||q[0]>o.corridor.x2||q[1]<o.corridor.y1||q[1]>o.corridor.y2)?80:0);if((states.get(key)?.cost??Infinity)<=cost)continue;const next={x,y,dir,key,cost,score:cost+Math.abs(q[0]-b[0])+Math.abs(q[1]-b[1]),prev:s.key};states.set(key,next);push(next);
  }
 }
 return null;
}
