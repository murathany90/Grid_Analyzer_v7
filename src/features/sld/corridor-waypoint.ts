import type {Point} from './physical-layout';
type GlyphBox={id:string;x1:number;x2:number;y1:number;y2:number};
const onSegment=(q:Point,a:Point,b:Point)=>q[0]>=Math.min(a[0],b[0])-.01&&q[0]<=Math.max(a[0],b[0])+.01&&q[1]>=Math.min(a[1],b[1])-.01&&q[1]<=Math.max(a[1],b[1])+.01;

/** A routing waypoint is presentation, not a source junction. Putting it on a
 * foreign conductor defeats the router's legitimate endpoint obstacle escape. */
export function clearCorridorWaypoint(point:Point,terminal:string,equipmentId:string,obstacles:readonly GlyphBox[],wires:readonly {terminal:string;points:readonly Point[]}[]):Point{
  const clear=(q:Point)=>!obstacles.some(o=>o.id!==equipmentId&&q[0]>=o.x1&&q[0]<=o.x2&&q[1]>=o.y1&&q[1]<=o.y2)
    &&!wires.some(w=>w.terminal!==terminal&&w.points.slice(1).some((b,i)=>onSegment(q,w.points[i],b)));
  if(clear(point))return point;
  for(let n=1;n<=64;n++)for(const [dx,dy]of [[0,n*8],[0,-n*8],[n*8,0],[-n*8,0]]){const candidate:Point=[point[0]+dx,point[1]+dy];if(clear(candidate))return candidate;}
  throw Error('SLD_CORRIDOR_WAYPOINT_BLOCKED: '+equipmentId);
}
