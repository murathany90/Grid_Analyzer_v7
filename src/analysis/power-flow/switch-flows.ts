import type {CanonicalNetwork} from '../../domain/model/network';
import type {CalculationResult,SwitchFlowResult} from '../../domain/results/types';
import {buildTopology} from '../../topology/electrical-topology';

/** Result reconstruction only; never adds impedances or alters the solve.
 * A bridge cut in the native ideal-switch graph has one KCL flow. Cycle
 * currents have a free degree of freedom and must remain unavailable. */
export function reconstructSwitchFlows(n:CanonicalNetwork,r:CalculationResult,toleranceMw=0.005):SwitchFlowResult[]{
 const topology=buildTopology(n),solved=new Map(r.buses.flatMap(b=>b.terms.map(t=>[t,b] as const))),finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v),enabled=(e:{id:string;inService:boolean})=>e.inService&&!topology.blockedEquipment.has(e.id);
 const balance=new Map([...solved.keys()].map(t=>[t,{p:0,q:0,unknown:false}]));
 const add=(t:string,p:unknown,q:unknown)=>{const d=balance.get(t);if(!d)return;if(!finite(p)||!finite(q))d.unknown=true;else{d.p+=p;d.q+=q;}};
 const branches=new Map(r.branches.map(b=>[b.sourceClass+'|'+b.id,b]));
 for(const e of [...n.lines,...n.transformers,...n.seriesCompensators].filter(enabled)){const b=branches.get(e.sourceClass+'|'+e.id);add(e.from,b?.pf,b?.qf);add(e.to,b?.pt,b?.qt);}
 const loads=new Map(r.loads?.map(l=>[l.id,l]));for(const e of n.loads.filter(enabled)){const l=loads.get(e.id);add(e.bus,l?.pMw,l?.qMvar);}
 const generators=new Map(r.generators.map(g=>[g.id,g]));for(const e of n.generators.filter(enabled)){const g=generators.get(e.id);add(e.bus,finite(g?.pMw)?-g.pMw:null,finite(g?.qMvar)?-g.qMvar!:null);}
 const grids=new Map(((r.diagnostics.externalGridResults??[]) as {id:string;pMw:number|null;qMvar:number|null}[]).map(g=>[g.id,g]));for(const e of n.externalGrids.filter(enabled)){const g=grids.get(e.id);add(e.bus,finite(g?.pMw)?-g.pMw:null,finite(g?.qMvar)?-g.qMvar!:null);}
 for(const e of n.internationalConnections.filter(enabled))add(e.bus,e.pMw,e.qMvar);
 for(const e of n.shunts.filter(enabled)){const v=solved.get(e.bus)?.vmPu;add(e.bus,finite(v)?e.gPu*v*v*n.baseMva:null,finite(v)?-e.bPu*v*v*n.baseMva:null);}
 const rows=n.switches.map(s=>({id:s.id,sourceClass:s.sourceClass,from:s.from,to:s.to,pf:null,qf:null,pt:null,qt:null,status:'SWITCH_FLOW_UNAVAILABLE',method:'IDEAL_BRIDGE_KCL',reason:!s.inService?'OUT_OF_SERVICE':!s.closed?'SWITCH_OPEN':!r.converged?'NOT_CONVERGED':s.sourceClass==='StaSwitch'?'CUBICLE_ORDER_UNAVAILABLE':'NO_SOLVED_NATIVE_COMPONENT'} as SwitchFlowResult)),byId=new Map(rows.map(row=>[row.id,row])),edges=n.switches.filter(s=>s.sourceClass!=='StaSwitch'&&s.inService&&s.closed&&s.from!==s.to&&solved.has(s.from)&&solved.get(s.from)===solved.get(s.to)&&topology.terminalToBus.get(s.from)===topology.terminalToBus.get(s.to));
 if(!r.converged)return rows;
 const adjacent=new Map<string,{to:string;edge:string}[]>();for(const s of edges){for(const [a,b]of [[s.from,s.to],[s.to,s.from]]){const list=adjacent.get(a)??[];list.push({to:b,edge:s.id});adjacent.set(a,list);}}
 const visited=new Set<string>();
 for(const start of [...adjacent.keys()].sort()){if(visited.has(start))continue;
  const tin=new Map<string,number>(),low=new Map<string,number>(),parent=new Map<string,{node:string;edge:string}>(),order:string[]=[],stack=[{node:start,index:0}],sub=new Map<string,{p:number;q:number;count:number}>();let time=0,unknown=false;
  visited.add(start);tin.set(start,time);low.set(start,time++);
  while(stack.length){const frame=stack.at(-1)!,links=adjacent.get(frame.node)??[];
   if(frame.index<links.length){const e=links[frame.index++];if(parent.get(frame.node)?.edge===e.edge)continue;if(!tin.has(e.to)){parent.set(e.to,{node:frame.node,edge:e.edge});visited.add(e.to);tin.set(e.to,time);low.set(e.to,time++);stack.push({node:e.to,index:0});}else low.set(frame.node,Math.min(low.get(frame.node)!,tin.get(e.to)!));}
   else{stack.pop();order.push(frame.node);const p=parent.get(frame.node);if(p)low.set(p.node,Math.min(low.get(p.node)!,low.get(frame.node)!));}
  }
  for(const node of order){const d=balance.get(node)!,sum=sub.get(node)??{p:0,q:0,count:0};sum.p+=d.p;sum.q+=d.q;sum.count++;sub.set(node,sum);unknown ||=d.unknown;const p=parent.get(node);if(p){const total=sub.get(p.node)??{p:0,q:0,count:0};total.p+=sum.p;total.q+=sum.q;total.count+=sum.count;sub.set(p.node,total);}}
  const total=sub.get(start)!,valid=!unknown&&Math.max(Math.abs(total.p),Math.abs(total.q))<=Math.max(1e-7,toleranceMw),bridgeById=new Map(order.filter(node=>parent.has(node)&&low.get(node)!>tin.get(parent.get(node)!.node)!).map(node=>[parent.get(node)!.edge,node]));
  const componentEdges=new Set(order.flatMap(node=>(adjacent.get(node)??[]).map(e=>e.edge)));
  for(const id of componentEdges){const row=byId.get(id)!,child=bridgeById.get(id);row.kclResidualMw=total.p;row.kclResidualMvar=total.q;
   row.reason=!child?'IDEAL_SWITCH_CYCLE_NON_UNIQUE':unknown?'INCOMPLETE_NATIVE_INJECTIONS':!valid?'NATIVE_KCL_RESIDUAL_EXCEEDS_TOLERANCE':'UNIQUE_NATIVE_BRIDGE_CUT';
   if(child&&valid){const sum=sub.get(child)!,sign=row.to===child?1:-1;row.pf=sign*sum.p;row.qf=sign*sum.q;row.pt=-row.pf;row.qt=-row.qf;row.cutTerminalCount=sum.count;row.status='SWITCH_FLOW_CALCULATED';}
  }
 }
 return rows;
}
