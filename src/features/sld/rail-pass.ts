import type {Point} from './physical-layout';
export interface RailPass {railId:string;x:number;y:number}
/** Optical insulation at a foreign rail, not an electrical open contact.
 * Native endpoints remain unchanged in the source conductor ledger. The rail
 * is continuous; the crossing lead has an explicit gap and never a junction. */
export function railPassPath(points:readonly Point[],terminalId:string,rails:readonly {id:string;x1:number;x2:number;y:number}[]){
 const passes:RailPass[]=[],commands:string[]=[];
 if(!points.length)return {d:'',passes};
 commands.push(`M${points[0].join(',')}`);
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],sign=Math.sign(b[1]-a[1]);
  const crossed=a[0]===b[0]?rails.filter(r=>r.id!==terminalId&&a[0]>r.x1&&a[0]<r.x2&&r.y>Math.min(a[1],b[1])+6&&r.y<Math.max(a[1],b[1])-6).sort((r,s)=>sign*(r.y-s.y)):[];
  for(const r of crossed){commands.push(`L${a[0]},${r.y-sign*6}`,`M${a[0]},${r.y+sign*6}`);passes.push({railId:r.id,x:a[0],y:r.y});}
  commands.push(`L${b.join(',')}`);
 }
 return {d:commands.join(' '),passes};
}
