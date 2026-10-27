import type {PsseFinding,PsseModel} from '../../importers/psse/types';
import type {PsseBusBranchNetwork,PsseBranch} from '../../domain/psse/network';
import {isPsseContractibleZeroImpedanceLink,psseZeroImpedanceThreshold,type PsseSwitchThreshold} from '../../domain/psse/system-switch';
import {csrFromRows,solvePssERealSparse} from './sparse';

export interface PsseDcSwitchComponent {buses:number[];branches:PsseBranch[]}
export interface PsseDcSwitchContraction {
 threshold:PsseSwitchThreshold;
 busToNode:Int32Array;
 nodeBuses:number[][];
 branches:PsseBranch[];
 components:PsseDcSwitchComponent[];
 cycleRank:number;
}
export interface PsseDcSwitchRecovery {flows:Map<string,number>;relativeResidual:number;cyclicComponentCount:number;cycleRank:number}

const compatibleBase=(a:number|null,b:number|null)=>a!==null&&b!==null&&Math.abs(a-b)<=Math.max(a,b)*1e-9;

/** Build the source-validated PSS/E ZIL bus contraction without changing source records. */
export function preparePsseDcSwitchContraction(model:PsseModel,network:PsseBusBranchNetwork):{contraction:PsseDcSwitchContraction;findings:PsseFinding[]} {
 const threshold=psseZeroImpedanceThreshold(model),findings:PsseFinding[]=[],equipmentById=new Map<string,PsseModel['equipment'][number]>();for(const item of model.equipment)if(!equipmentById.has(item.id))equipmentById.set(item.id,item);const branches=network.branches.filter(branch=>branch.status===1&&isPsseContractibleZeroImpedanceLink(model,branch,threshold,equipmentById)),parent=Int32Array.from({length:network.buses.length},(_,i)=>i),rank=new Uint8Array(network.buses.length);
 const root=(value:number):number=>{let i=value;while(parent[i]!==i)i=parent[i];while(parent[value]!==value){const next=parent[value];parent[value]=i;value=next;}return i;};
 const join=(a:number,b:number)=>{let ra=root(a),rb=root(b);if(ra===rb)return;if(rank[ra]<rank[rb])[ra,rb]=[rb,ra];parent[rb]=ra;if(rank[ra]===rank[rb])rank[ra]++;};
 for(const branch of branches){const from=network.buses[branch.from],to=network.buses[branch.to];if(branch.rPu!==0||branch.tapFrom!==1||branch.tapTo!==1||branch.phaseDeg!==0||branch.from===branch.to||!from||!to||from.status!==1||to.status!==1||!compatibleBase(from.baseKv,to.baseKv)){findings.push({severity:'ERROR',code:'DC_IDEAL_LINK_TERMINAL_INCOMPATIBLE',message:`Non-transformer zero-impedance link ${branch.id} cannot be contracted: it requires active endpoints with compatible physical voltage bases, zero phase shift, unity taps and zero resistance.`,equipment:branch.sourceEquipmentId});continue;}join(branch.from,branch.to);}
 const nodeBuses:number[][]=[],nodeForRoot=new Map<number,number>(),busToNode=new Int32Array(network.buses.length);busToNode.fill(-1);
 for(let i=0;i<network.buses.length;i++)if(network.buses[i].status===1){const representative=root(i);let node=nodeForRoot.get(representative);if(node===undefined){node=nodeBuses.length;nodeForRoot.set(representative,node);nodeBuses.push([]);}nodeBuses[node].push(i);busToNode[i]=node;}
 const componentByRoot=new Map<number,PsseDcSwitchComponent>();for(const branch of branches){const representative=root(branch.from);let component=componentByRoot.get(representative);if(!component){component={buses:nodeBuses[nodeForRoot.get(representative)!].slice(),branches:[]};componentByRoot.set(representative,component);}component.branches.push(branch);}
 const components=[...componentByRoot.values()];let cycleRank=0;for(const component of components){const rank=Math.max(0,component.branches.length-component.buses.length+1);cycleRank+=rank;if(rank>0&&component.branches.some(branch=>!(branch.xPu>0&&Number.isFinite(branch.xPu))))findings.push({severity:'ERROR',code:'DC_IDEAL_SWITCH_CYCLE_RECOVERY_UNSUPPORTED',message:`Cyclic ideal-switch component ${component.buses.map(i=>network.buses[i].id).slice(0,8).join(', ')} has signed or zero X. Cyclic recovery is validated only for strictly positive source X.`,equipment:component.branches[0]?.sourceEquipmentId});}
 return{contraction:{threshold,busToNode,nodeBuses,branches,components,cycleRank},findings};
}

/** Recover original switch terminal MW from bus KCL; positive-X cycles use the validated minimum-energy cutspace. */
export function recoverPsseDcSwitchFlows(contraction:PsseDcSwitchContraction,network:PsseBusBranchNetwork,residualMw:Float64Array):PsseDcSwitchRecovery{
 const flows=new Map<string,number>();let relativeResidual=0,cyclicComponentCount=0;
 for(const component of contraction.components){const {buses,branches}=component;if(branches.length===buses.length-1){const adjacency=new Map<number,{next:number;branch:PsseBranch}[]>();for(const bus of buses)adjacency.set(bus,[]);for(const branch of branches){adjacency.get(branch.from)!.push({next:branch.to,branch});adjacency.get(branch.to)!.push({next:branch.from,branch});}
   const root=buses[0],parent=new Map<number,number>([[root,-1]]),parentEdge=new Map<number,PsseBranch>(),order=[root];for(let cursor=0;cursor<order.length;cursor++){const bus=order[cursor];for(const {next,branch}of adjacency.get(bus)??[])if(!parent.has(next)){parent.set(next,bus);parentEdge.set(next,branch);order.push(next);}}if(order.length!==buses.length)throw Error('DC_SWITCH_TREE_TOPOLOGY_INVALID');const subtree=new Map<number,number>();for(let k=order.length-1;k>0;k--){const bus=order[k],sum=residualMw[bus]+(subtree.get(bus)??0),p=parent.get(bus)!,branch=parentEdge.get(bus)!;subtree.set(bus,sum);subtree.set(p,(subtree.get(p)??0)+sum);flows.set(branch.id,branch.from===p?-sum:sum);}
   const total=residualMw[root]+(subtree.get(root)??0),scale=Math.max(1,buses.reduce((sum,bus)=>sum+Math.abs(residualMw[bus]),0));relativeResidual=Math.max(relativeResidual,Math.abs(total)/scale);continue;
  }
  cyclicComponentCount++;if(branches.some(branch=>!(branch.xPu>0&&Number.isFinite(branch.xPu))))throw Error('DC_SWITCH_CYCLE_REQUIRES_POSITIVE_X');const pinned=buses[0],unknown=buses.slice(1),local=new Map(unknown.map((bus,index)=>[bus,index])),rows=unknown.map(()=>new Map<number,number>()),rhs=new Float64Array(unknown.length);
  for(let row=0;row<unknown.length;row++)rhs[row]=residualMw[unknown[row]];
  for(const branch of branches){const weight=1/branch.xPu,from=local.get(branch.from),to=local.get(branch.to);if(from!==undefined){rows[from].set(from,(rows[from].get(from)??0)+weight);if(to!==undefined)rows[from].set(to,(rows[from].get(to)??0)-weight);}if(to!==undefined){rows[to].set(to,(rows[to].get(to)??0)+weight);if(from!==undefined)rows[to].set(from,(rows[to].get(from)??0)-weight);}}
  const matrix=csrFromRows(rows),solution=solvePssERealSparse(matrix,rhs);if(!solution.x||solution.relativeResidual===null||solution.relativeResidual>1e-8)throw Error('DC_SWITCH_CYCLE_LAPLACIAN_FAILED');const lambda=new Map<number,number>([[pinned,0]]);unknown.forEach((bus,index)=>lambda.set(bus,solution.x![index]));for(const branch of branches)flows.set(branch.id,(lambda.get(branch.from)!-lambda.get(branch.to)!)/branch.xPu);relativeResidual=Math.max(relativeResidual,solution.relativeResidual);
 }
 // Check KCL at every original bus after recovery, including the pinned bus in each cycle.
 let maximum=0,totalScale=1;const recoveredOut=new Float64Array(network.buses.length);for(const branch of contraction.branches){const flow=flows.get(branch.id)??0;recoveredOut[branch.from]+=flow;recoveredOut[branch.to]-=flow;}for(const component of contraction.components){let componentScale=1;for(const bus of component.buses)componentScale+=Math.abs(residualMw[bus]);for(const bus of component.buses)maximum=Math.max(maximum,Math.abs(residualMw[bus]-recoveredOut[bus]));totalScale=Math.max(totalScale,componentScale);}relativeResidual=Math.max(relativeResidual,maximum/totalScale);
 return{flows,relativeResidual,cyclicComponentCount,cycleRank:contraction.cycleRank};
}
