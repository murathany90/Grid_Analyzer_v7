import type { CanonicalNetwork } from '../domain/model/network';
export class UnionFind {
  private parent = new Map<string,string>(); private rank = new Map<string,number>();
  constructor(ids: Iterable<string>) { for (const id of ids) this.parent.set(id,id); }
  find(id: string): string | null { let p = this.parent.get(id); if (p === undefined) return null; while (p !== id) { const next = this.parent.get(p)!; this.parent.set(id,next); id=p; p=next; } return id; }
  union(a: string,b: string): void { const x=this.find(a),y=this.find(b); if (x===null || y===null || x===y) return; const ra=this.rank.get(x)||0,rb=this.rank.get(y)||0; if(ra<rb)this.parent.set(x,y);else{this.parent.set(y,x);if(ra===rb)this.rank.set(x,ra+1);} }
}
export interface ElectricalBus { id: string; name: string; vnKv: number; terms: string[]; siteIds: string[] }
export interface ElectricalTopology { buses: ElectricalBus[]; terminalToBus: Map<string,number>; blockedEquipment: Set<string>; warnings: string[]; closedSwitches: number }
export function buildTopology(network: CanonicalNetwork): ElectricalTopology {
  const terminals = new Map(network.buses.filter(b=>b.inService && b.vnKv>0).map(b=>[b.id,b]));
  const uf = new UnionFind(terminals.keys()), warnings: string[] = [], blockedEquipment = new Set<string>(); let closedSwitches=0;
  for (const sw of network.switches) {
    if (sw.sourceClass === 'StaSwitch') {
      if ((!sw.inService || !sw.closed) && sw.equipmentId) blockedEquipment.add(sw.equipmentId);
      continue;
    }
    if (!sw.inService || !sw.closed) continue;
    const a=terminals.get(sw.from),b=terminals.get(sw.to); if (!a || !b) continue;
    if (Math.abs(a.vnKv-b.vnKv)/Math.max(a.vnKv,b.vnKv)>.02) { warnings.push(`Kapalı anahtar farklı nominal gerilim: ${sw.name}`); continue; }
    uf.union(a.id,b.id); closedSwitches++;
  }
  const groups = new Map<string,string[]>();
  for (const id of terminals.keys()) { const root=uf.find(id)!; if(!groups.has(root))groups.set(root,[]);groups.get(root)!.push(id); }
  const used = new Set<string>();
  const add=(id:string)=>{ const root=uf.find(id);if(root)used.add(root); };
  for(const e of [...network.lines,...network.transformers,...network.seriesCompensators]) if(e.inService&&!blockedEquipment.has(e.id)){add(e.from);add(e.to);}
  for(const e of [...network.generators,...network.loads,...network.shunts,...network.externalGrids,...network.internationalConnections]) if(e.inService&&!blockedEquipment.has(e.id))add(e.bus);
  const buses = [...used].sort().map(id=>{const terms=groups.get(id)!; const representative=terms.map(t=>terminals.get(t)!).find(b=>b.parentId.startsWith('G'))||terminals.get(terms[0])!;
    return{id,name:representative.name,vnKv:representative.vnKv,terms,siteIds:[...new Set(terms.flatMap(t=>terminals.get(t)!.siteIds))]};});
  const terminalToBus=new Map<string,number>();buses.forEach((b,i)=>b.terms.forEach(t=>terminalToBus.set(t,i)));
  return{buses,terminalToBus,blockedEquipment,warnings,closedSwitches};
}
