import type {PsseBranch} from '../../domain/psse/network';

/** Group numerical star legs into the one physical source transformer they represent. */
export function groupPsseResultBranches(branches:readonly PsseBranch[],kind:'lines'|'transformers',transformerType:'all'|'2w'|'3w'='all'):PsseBranch[][]{
 const groups=new Map<string,PsseBranch[]>();
 for(const branch of branches){
  if(kind==='lines'&&branch.kind!=='line')continue;
  if(kind==='transformers'&&(branch.kind==='line'||transformerType==='2w'&&branch.kind!=='transformer'||transformerType==='3w'&&branch.kind!=='three-winding-leg'))continue;
  const key=branch.kind==='three-winding-leg'?`three:${branch.sourceEquipmentId}`:`branch:${branch.id}`;
  const group=groups.get(key);if(group)group.push(branch);else groups.set(key,[branch]);
 }
 return [...groups.values()].map(group=>group.sort((a,b)=>a.windingId.localeCompare(b.windingId,'tr',{numeric:true})));
}
