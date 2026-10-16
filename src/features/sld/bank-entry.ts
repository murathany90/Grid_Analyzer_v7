import type {StationTopologyGraph} from '../../domain/model/station-topology';
import type {EquipmentGeometry,EquipmentPort,Point,PortPosition} from './physical-layout';

/** Inset a bank's common horizontal lead inside its existing rectangle. The
 * native junction stays fixed for the feeder/transfer connections; a short
 * vertical neck separates that junction from the winding fan-out. No new node,
 * device, compartment or glyph displacement is introduced. */
export function insetBankEntries(equipment:EquipmentGeometry[],graph:StationTopologyGraph,context?:{wires:readonly {terminal:string;points:readonly Point[]}[];obstacles:readonly {id:string;x1:number;x2:number;y1:number;y2:number}[]}):void{
 const groups=new Map<string,{e:EquipmentGeometry;p:EquipmentPort;n:PortPosition}[]>(),planned:{terminal:string;points:Point[]}[]=[];
 for(const e of equipment){if(e.boundary||!['transformer','transformer3w'].includes(e.equipment.kind))continue;
  for(const p of e.ports){if(p.side>1||p.corridor!=null||p.wires.some(w=>w.waypoints?.length))continue;const n=e.nativePorts.find(n=>n.terminalId===p.terminalId);if(!n||n.semantics==='busbar-section'||graph.switches.some(s=>s.from===s.to&&s.from===p.terminalId&&s.equipmentId===e.equipment.id))continue;
   const key=p.side+'|'+p.terminalId,group=groups.get(key)??[];group.push({e,p,n});groups.set(key,group);
  }
 }
 for(const group of groups.values()){
  if(group.length<2||new Set(group.map(({p})=>p.point[0])).size<2)continue;const {n}=group[0],sign=Math.sign(group[0].p.point[1]-n.y);
  if(!sign||group.some(r=>r.n.x!==n.x||r.n.y!==n.y||Math.sign(r.p.point[1]-n.y)!==sign||r.p.wires.some(w=>w.points[0][0]!==n.x||w.points[0][1]!==n.y)))continue;
  const maxNeck=Math.min(16,...group.map(({p})=>Math.abs(p.point[1]-n.y)/2));if(maxNeck<8)continue;
  const x1=Math.min(n.x,...group.map(r=>r.p.point[0])),x2=Math.max(n.x,...group.map(r=>r.p.point[0]));
  const clear=(neck:number)=>{const y=n.y+sign*neck,between=(v:number,a:number,b:number)=>v>=Math.min(a,b)&&v<=Math.max(a,b);
   for(const w of [...(context?.wires??[]),...planned]){if(w.terminal===n.terminalId)continue;for(let i=1;i<w.points.length;i++){const a=w.points[i-1],b=w.points[i];if(a[1]===b[1]&&Math.abs(a[1]-y)<4&&Math.max(a[0],b[0])>=x1&&Math.min(a[0],b[0])<=x2)return false;for(const x of [n.x,...group.map(r=>r.p.point[0])])if(a[0]===b[0]?a[0]===x&&between(y,a[1],b[1]):a[1]===y&&between(x,a[0],b[0]))return false;}}
   return !(context?.obstacles??[]).some(o=>o.id!=='PORT|'+n.terminalId&&(y>=o.y1&&y<=o.y2&&x1<=o.x2&&x2>=o.x1||n.x>=o.x1&&n.x<=o.x2&&Math.max(n.y,y)>o.y1&&Math.min(n.y,y)<o.y2));
  };
  const neck=(group[0].p.side===1?[8,10,12,14,16]:[16,14,12,10,8]).find(v=>v<=maxNeck&&clear(v));if(neck==null)continue;
  const entry:Point=[n.x,n.y+sign*neck];for(const {p}of group)for(const w of p.wires){w.waypoints=[entry,[p.point[0],entry[1]]];w.bankEntry={native:[n.x,n.y],collector:entry};}
  planned.push({terminal:n.terminalId,points:[[n.x,n.y],entry]},{terminal:n.terminalId,points:[[x1,entry[1]],[x2,entry[1]]]});
 }
}
