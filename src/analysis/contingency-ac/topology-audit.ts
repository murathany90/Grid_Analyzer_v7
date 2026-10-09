import type {CanonicalNetwork} from '../../domain/model/network';
import {effectiveNetwork,type ScenarioOverlay} from '../../domain/scenario/overlay';
import {buildTopology} from '../../topology/electrical-topology';
/** Full electrical multigraph, including series compensation and collapsed closed switches.
 * Iterative Tarjan traversal avoids browser recursion limits. Parent EDGE preserves parallels. */
export function auditOutageTopology(network:CanonicalNetwork,scenario:ScenarioOverlay){
  const active=effectiveNetwork(network,scenario),topology=buildTopology(active);
  const edges=[...active.lines,...active.transformers,...active.seriesCompensators].filter(e=>e.inService&&!topology.blockedEquipment.has(e.id)).flatMap(e=>{
    const a=topology.terminalToBus.get(e.from),b=topology.terminalToBus.get(e.to);
    return a===undefined||b===undefined?[]:[{key:`${e.sourceClass}:${e.sourceId}`,id:e.id,sourceClass:e.sourceClass,fid:e.sourceId,a,b}];
  });
  const adj=topology.buses.map(()=>[] as {to:number;edge:number}[]);
  edges.forEach((e,i)=>{adj[e.a].push({to:e.b,edge:i});adj[e.b].push({to:e.a,edge:i});});
  const entered=new Int32Array(adj.length).fill(-1),low=new Int32Array(adj.length),bridges=new Set<number>();let time=0;
  for(let root=0;root<adj.length;root++){
    if(entered[root]>=0)continue;
    entered[root]=low[root]=time++;
    const stack=[{v:root,parent:-1,edge:-1,next:0}];
    while(stack.length){const f=stack[stack.length-1];
      if(f.next===adj[f.v].length){stack.pop();if(f.parent>=0){low[f.parent]=Math.min(low[f.parent],low[f.v]);if(low[f.v]>entered[f.parent])bridges.add(f.edge);}continue;}
      const n=adj[f.v][f.next++];if(n.edge===f.edge)continue;
      if(entered[n.to]>=0){low[f.v]=Math.min(low[f.v],entered[n.to]);continue;}
      entered[n.to]=low[n.to]=time++;stack.push({v:n.to,parent:f.v,edge:n.edge,next:0});
    }
  }
  return {busCount:adj.length,edges:edges.map((e,i)=>({...e,classification:bridges.has(i)?'BRIDGE' as const:'NON_BRIDGE' as const}))};
}
