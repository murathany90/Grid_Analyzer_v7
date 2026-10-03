import type { CanonicalNetwork, Line } from '../../domain/model/network';
import { buildTopology, UnionFind, type ElectricalBus } from '../../topology/electrical-topology';
export interface ReducedEdge {id:string;cls:string;a:number;b:number;r:number;x:number;bc:number;tap:number}
export interface ReducedIsland {
  busIds:string[];injections:[number,number][];shunts:number[];edges:ReducedEdge[];slack:number;
  pv:{bus:number;setpoint:number}[];slackSetpoint:number;baseMVA:number;iterations:number;threshold:number;
  pvLimits:{bus:number;qMin:number|null;qMax:number|null;fixedQ:number;hasLimits:boolean;units:{id:string;cls:string;qMin:number|null;qMax:number|null}[]}[];
}
export interface ReducedNetwork {islands:ReducedIsland[];buses:Map<string,ElectricalBus>;warnings:string[];diagnostics:Record<string,unknown>}
/** Preserves v6.8 >=66 kV projection and series-capacitor rules, consuming canonical SI fields. */
export function prepareReduced(n:CanonicalNetwork,minVoltageKv=66):ReducedNetwork{
  const topo=buildTopology(n),buses=topo.buses,warnings=[...topo.warnings];
  const root=(id:string)=>topo.terminalToBus.get(id),high=new Set<number>(),low=new Set<number>();buses.forEach((b,i)=>(b.vnKv>=minVoltageKv?high:low).add(i));
  const enabled=(e:{id:string;inService:boolean})=>e.inService&&!topo.blockedEquipment.has(e.id);
  const transformers=n.transformers.filter(enabled).map(e=>({e,a:root(e.from),b:root(e.to)})).filter((x):x is typeof x&{a:number;b:number}=>x.a!==undefined&&x.b!==undefined);
  const lowUf=new UnionFind([...low].map(String));for(const{a,b}of transformers)if(low.has(a)&&low.has(b))lowUf.union(String(a),String(b));
  const boundaries=new Map<string,Set<number>>();const add=(l:number,h:number)=>{const key=lowUf.find(String(l));if(key==null)return;if(!boundaries.has(key))boundaries.set(key,new Set());boundaries.get(key)!.add(h);};
  for(const{a,b}of transformers){if(low.has(a)&&high.has(b))add(a,b);if(low.has(b)&&high.has(a))add(b,a);}
  const highIds=[...high],hi=new Map(highIds.map((b,i)=>[b,i])),injections=highIds.map(()=>[0,0]as[number,number]),sources=highIds.map(()=>0),shunts=highIds.map(()=>0);let projected=0,excluded=0;
  const route=(terminal:string,label:string):number|null=>{const r=root(terminal);if(r==null)return null;if(high.has(r))return hi.get(r)!;const targets=boundaries.get(lowUf.find(String(r))||'');if(targets?.size===1){projected++;return hi.get([...targets][0])!;}excluded++;warnings.push(`Alt gerilim tek sınır noktasına indirgenemedi: ${label}`);return null;};
  for(const g of n.generators.filter(enabled)){const i=route(g.bus,g.name);if(i!=null){injections[i][0]+=g.pMw;injections[i][1]+=g.qMvar;sources[i]+=Math.max(0,g.pMw);}}
  for(const g of n.loads.filter(enabled)){const i=route(g.bus,g.name);if(i!=null){injections[i][0]-=g.pMw;injections[i][1]-=g.qMvar;}}
  for(const g of n.externalGrids.filter(enabled)){const i=route(g.bus,g.name);if(i!=null)sources[i]+=1e8;}
  const pv=new Map<number,number>(),controlled=new Map<number,typeof n.generators[number][]>();
  for(const g of n.generators.filter(g=>enabled(g)&&g.voltageControl)){
    const direct=root(g.bus),i=route(g.bus,g.name);if(i==null)continue;if(g.vmSet>.88&&g.vmSet<1.15)pv.set(i,g.vmSet);
    if(direct!=null&&high.has(direct)){if(!controlled.has(i))controlled.set(i,[]);controlled.get(i)!.push(g);}else warnings.push(`Alt gerilim ünite gerilim kontrolü sınırda yaklaşık temsil: ${g.name}`);
  }
  for(const s of n.shunts.filter(enabled)){const i=route(s.bus,s.name);if(i==null)continue;const q=s.nominalQMvar??s.bPu*n.baseMva;if(high.has(root(s.bus)!))shunts[i]+=q;else injections[i][1]+=q;}
  const edges:ReducedEdge[]=[],lineEnds=new Map<number,{line:Line;side:'from'|'to'}[]>();
  for(const line of n.lines.filter(enabled))if((line.fastParameters?.vnKv??line.vnKv)>=66)for(const side of['from','to']as const){const r=root(line[side]);if(r==null)continue;if(!lineEnds.has(r))lineEnds.set(r,[]);lineEnds.get(r)!.push({line,side});}
  const comp=new Map<string,{side:'from'|'to'|null;far:number;x:number}>();let seriesApplied=0,seriesUnresolved=0;
  const fastX=(l:Line)=>l.fastParameters?.xOhm??l.xOhm;
  for(const c of n.seriesCompensators.filter(enabled)){
    const a=root(c.from),b=root(c.to);if(a==null||b==null||!high.has(a)||!high.has(b)){seriesUnresolved++;continue;}if(a===b)continue;
    const candidates:{line:Line;side:'from'|'to';near:number;far:number}[]=[];
    for(const[near,far]of[[a,b],[b,a]]){const lines=lineEnds.get(near)||[];if(buses[near].terms.length>1||lines.length!==1)continue;const item=lines[0];if(comp.has(item.line.id)||!(fastX(item.line)+c.xOhm>1e-6))continue;candidates.push({...item,near,far});}
    if(candidates.length){const chosen=candidates.sort((a,b)=>buses[a.near].terms.length-buses[b.near].terms.length||a.line.id.localeCompare(b.line.id))[0];comp.set(chosen.line.id,{side:chosen.side,far:chosen.far,x:c.xOhm});seriesApplied++;continue;}
    const left=lineEnds.get(a)||[],right=lineEnds.get(b)||[];
    if(buses[a].terms.length===1&&buses[b].terms.length===1&&left.length===1&&right.length===1&&left[0].line.id!==right[0].line.id&&!comp.has(left[0].line.id)&&!comp.has(right[0].line.id)){
      const x1=fastX(left[0].line),x2=fastX(right[0].line);if(x1>0&&x2>0&&x1+x2+c.xOhm>1e-6){comp.set(left[0].line.id,{side:left[0].side,far:b,x:c.xOhm*x1/(x1+x2)});comp.set(right[0].line.id,{side:null,far:b,x:c.xOhm*x2/(x1+x2)});seriesApplied++;continue;}
    }
    seriesUnresolved++;warnings.push(`Seri kapasitör pozitif eşdeğere indirgenemedi: ${c.name}`);
  }
  const addEdge=(id:string,cls:string,a:number|undefined,b:number|undefined,r:number,x:number,bc=0,tap=1)=>{if(a==null||b==null||!high.has(a)||!high.has(b)||a===b)return;if(!(Number.isFinite(r)&&Number.isFinite(x)&&r>=0&&x>1e-9)){warnings.push(`İndirgenmiş dal R/X geçersiz: ${id}`);return;}edges.push({id,cls,a:hi.get(a)!,b:hi.get(b)!,r,x,bc,tap});};
  for(const l of n.lines.filter(enabled)){
    const param=l.fastParameters||l;if(!(param.vnKv>=66))continue;let a=root(l.from),b=root(l.to),x=param.xOhm;const c=comp.get(l.id);if(c){if(c.side==='from')a=c.far;if(c.side==='to')b=c.far;x+=c.x;}const zb=param.vnKv**2/100;addEdge(l.id,l.sourceClass,a,b,param.rOhm/zb,x/zb,param.bSiemens*zb);
  }
  for(const{e,a,b}of transformers)addEdge(e.id,e.sourceClass,a,b,e.rPu,e.xPu,0,e.tap);
  const adjacency:number[][]=highIds.map(()=>[]);for(const e of edges){adjacency[e.a].push(e.b);adjacency[e.b].push(e.a);}
  const seen=new Uint8Array(highIds.length),islands:ReducedIsland[]=[];let noSourceIslands=0;
  for(let v=0;v<highIds.length;v++){
    if(seen[v]||!adjacency[v].length)continue;const stack=[v],group:number[]=[];seen[v]=1;while(stack.length){const u=stack.pop()!;group.push(u);for(const w of adjacency[u])if(!seen[w]){seen[w]=1;stack.push(w);}}
    const slack=group.filter(i=>sources[i]>0).sort((a,b)=>sources[b]-sources[a])[0];if(slack==null){noSourceIslands++;continue;}if(group.length>4500){warnings.push(`Çok büyük indirgenmiş ada: ${group.length}`);continue;}
    const local=new Map(group.map((g,i)=>[g,i])),pvLimits:ReducedIsland['pvLimits']=[];
    for(const[bus,gs]of controlled)if(local.has(bus)&&bus!==slack){const fixedQ=injections[bus][1]-gs.reduce((s,g)=>s+g.qMvar,0),hasLimits=gs.every(g=>g.sourceClass==='ElmSym'&&g.qMin!=null&&g.qMax!=null);pvLimits.push({bus:local.get(bus)!,fixedQ,hasLimits,qMin:hasLimits?fixedQ+gs.reduce((s,g)=>s+g.qMin!,0):null,qMax:hasLimits?fixedQ+gs.reduce((s,g)=>s+g.qMax!,0):null,units:gs.map(g=>({id:g.id,cls:g.sourceClass,qMin:g.qMin,qMax:g.qMax}))});}
    islands.push({busIds:group.map(i=>buses[highIds[i]].id),injections:group.map(i=>injections[i]),shunts:group.map(i=>shunts[i]),edges:edges.filter(e=>local.has(e.a)&&local.has(e.b)).map(e=>({...e,a:local.get(e.a)!,b:local.get(e.b)!})),slack:local.get(slack)!,pv:[...pv].filter(([i])=>local.has(i)&&i!==slack).map(([i,setpoint])=>({bus:local.get(i)!,setpoint})),slackSetpoint:1,baseMVA:100,iterations:110,threshold:.005,pvLimits});
  }
  return{islands,buses:new Map(buses.map(b=>[b.id,b])),warnings,diagnostics:{scope:'REDUCED_GE66',highBuses:highIds.length,branches:edges.length,islands:islands.length,noSourceIslands,projectedInputs:projected,excludedInputs:excluded,seriesApplied,seriesUnresolved,internationalConnections:'Excluded as in v6.8 reduced engine'}};
}
