/** One-hop AC boundary: either selected terminal admits the entire physical line. */
export function expandIncidentAcScope(network,seeds){
  const scope=new Set(seeds);
  for(const branch of network.branches){
    if(branch.kind!=='line'||!String(branch.sourceEquipmentId).startsWith('line:'))continue;
    if(seeds.has(branch.from)||seeds.has(branch.to)){scope.add(branch.from);scope.add(branch.to);}
  }
  return scope;
}
