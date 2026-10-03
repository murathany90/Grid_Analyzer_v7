import type { CanonicalNetwork, Line, SeriesCompensator, Transformer2W } from '../domain/model/network';
import { buildTopology, type ElectricalTopology } from './electrical-topology';

export type TopologyClassification = 'NORMAL' | 'SPLIT_BUS' | 'TRUE_ISLAND' | 'UNSUPPLIED_ISLAND';
export interface TopologyIsland {
  islandId: string;
  classification: 'NORMAL' | 'TRUE_ISLAND' | 'UNSUPPLIED_ISLAND';
  busIds: string[];
  busCount: number;
  branchCount: number;
  sourceCount: number;
  generatorCount: number;
  referenceSourceIds: string[];
  referencePresent: boolean;
  supplied: boolean;
  siteIds: string[];
}
export interface SplitBusSide {
  electricalBusId: string;
  busName: string;
  barDesignation: 'B-1' | 'B-2' | 'UNKNOWN';
  terminalIds: string[];
  feederCount: number;
  feederIds: string[];
  feederNames: string[];
  islandIds: string[];
}
export interface SplitBusStation {
  classification: 'SPLIT_BUS';
  heuristic: true;
  confidence: 'STRUCTURAL' | 'HEURISTIC' | 'AMBIGUOUS';
  siteId: string | null;
  siteName: string | null;
  voltageKv: number;
  bus1: SplitBusSide;
  bus2: SplitBusSide;
  couplerId: string;
  couplerName: string;
  couplerInService: boolean;
  couplerClosed: boolean;
  sameConnectedComponent: boolean;
  topologyRelation: 'SAME_COMPONENT_VIA_ALTERNATE_PATH' | 'SEPARATE_COMPONENTS' | 'UNKNOWN';
  note: string;
}
export interface SplitBusTopology {
  islands: TopologyIsland[];
  splitStations: SplitBusStation[];
  electricalBusIslandIds: Map<string, string[]>;
  terminalToElectricalBus: Map<string, string>;
  warnings: string[];
}

type Branch = Line | Transformer2W | SeriesCompensator;
const validBranch = (branch: Branch): boolean => {
  if (!branch.inService) return false;
  if ('tap' in branch) return branch.tap > 0 && Number.isFinite(branch.rPu) && Number.isFinite(branch.xPu) && Math.abs(branch.rPu) + Math.abs(branch.xPu) > 1e-12;
  if (branch.sourceClass === 'ElmLne') return branch.xOhm > 0 && Number.isFinite(branch.rOhm) && Number.isFinite(branch.xOhm) && Math.abs(branch.rOhm) + Math.abs(branch.xOhm) > 1e-12;
  return Number.isFinite(branch.rOhm) && Number.isFinite(branch.xOhm) && Math.abs(branch.rOhm) + Math.abs(branch.xOhm) > 1e-12;
};

/**
 * Builds true electrical connected components and a separate heuristic view of open 154 kV bus couplers.
 * A split bus remains a split even when its two sides reconnect elsewhere in the wider network.
 */
export function buildSplitBusTopology(network: CanonicalNetwork, electrical = buildTopology(network)): SplitBusTopology {
  const warnings: string[] = [], count = electrical.buses.length;
  const adjacency: number[][] = Array.from({ length: count }, () => []);
  const branchesByBus: Map<number, Set<string>> = new Map(Array.from({ length: count }, (_, i) => [i, new Set<string>()]));
  const branchById = new Map<string, Branch>();
  const branches: Branch[] = [...network.lines, ...network.transformers, ...network.seriesCompensators];
  for (const branch of branches) {
    branchById.set(branch.id, branch);
    if (!validBranch(branch) || electrical.blockedEquipment.has(branch.id)) continue;
    const from = electrical.terminalToBus.get(branch.from), to = electrical.terminalToBus.get(branch.to);
    if (from == null || to == null || from === to) continue;
    adjacency[from].push(to); adjacency[to].push(from);
    branchesByBus.get(from)!.add(branch.id); branchesByBus.get(to)!.add(branch.id);
  }

  const componentOf = new Int32Array(count).fill(-1), components: number[][] = [];
  for (let start = 0; start < count; start++) if (componentOf[start] < 0) {
    const index = components.length, group: number[] = [], stack = [start]; componentOf[start] = index;
    while (stack.length) {
      const current = stack.pop()!; group.push(current);
      for (const next of adjacency[current]) if (componentOf[next] < 0) { componentOf[next] = index; stack.push(next); }
    }
    components.push(group);
  }
  const sourcesByComponent = new Map<number, Set<string>>();
  const generatorsByComponent = new Map<number, number>();
  for (const source of network.externalGrids) {
    if (!source.inService || electrical.blockedEquipment.has(source.id)) continue;
    const bus = electrical.terminalToBus.get(source.bus); if (bus == null) continue;
    const index = componentOf[bus], ids = sourcesByComponent.get(index) || new Set<string>(); ids.add(source.id); sourcesByComponent.set(index, ids);
  }
  for (const generator of network.generators) {
    if (!generator.inService || electrical.blockedEquipment.has(generator.id)) continue;
    const bus = electrical.terminalToBus.get(generator.bus); if (bus == null) continue;
    const index = componentOf[bus]; generatorsByComponent.set(index, (generatorsByComponent.get(index) || 0) + 1);
  }
  const branchesByComponent = new Map<number, Set<string>>();
  for (const [bus, ids] of branchesByBus) {
    const component = componentOf[bus], target = branchesByComponent.get(component) || new Set<string>();
    for (const id of ids) target.add(id); branchesByComponent.set(component, target);
  }
  const islandIdsByComponent = components.map((_, index) => `island-${index + 1}`);
  const islands: TopologyIsland[] = components.map((group, index) => {
    const refs = [...(sourcesByComponent.get(index) || [])].sort();
    const siteIds = [...new Set(group.flatMap(bus => electrical.buses[bus].siteIds))].sort();
    const classification = components.length === 1 ? 'NORMAL' : refs.length > 0 ? 'TRUE_ISLAND' : 'UNSUPPLIED_ISLAND';
    const generatorCount=generatorsByComponent.get(index)||0;
    return { islandId: islandIdsByComponent[index], classification, busIds: group.map(bus => electrical.buses[bus].id), busCount: group.length,
      branchCount: branchesByComponent.get(index)?.size || 0, sourceCount: refs.length + generatorCount, generatorCount, referenceSourceIds: refs, referencePresent: refs.length > 0,
      supplied: refs.length > 0, siteIds };
  });
  const electricalBusIslandIds = new Map<string, string[]>();
  electrical.buses.forEach((bus, index) => electricalBusIslandIds.set(bus.id, [islandIdsByComponent[componentOf[index]]]));
  const terminalToElectricalBus = new Map<string, string>();
  for (const [terminal, index] of electrical.terminalToBus) terminalToElectricalBus.set(terminal, electrical.buses[index].id);

  const siteById = new Map(network.sites.map(site => [site.id, site]));
  const terminalById = new Map(network.buses.map(terminal => [terminal.id, terminal]));
  const splitStations: SplitBusStation[] = [];
  for (const coupler of network.switches) {
    if (coupler.sourceClass !== 'ElmCoup' || !coupler.inService || coupler.closed) continue;
    const a = electrical.terminalToBus.get(coupler.from), b = electrical.terminalToBus.get(coupler.to);
    if (a == null || b == null || a === b) continue;
    const busA = electrical.buses[a], busB = electrical.buses[b];
    const avgKv = (busA.vnKv + busB.vnKv) / 2;
    if (Math.abs(busA.vnKv - 154) > 3.08 || Math.abs(busB.vnKv - 154) > 3.08 || Math.abs(busA.vnKv - busB.vnKv) > 3.08) continue;
    const sharedSites = busA.siteIds.filter(id => busB.siteIds.includes(id));
    const linkedSites = [...new Set([...sharedSites, ...coupler.siteIds.filter(id => busA.siteIds.includes(id) && busB.siteIds.includes(id))])];
    const siteId = linkedSites.length === 1 ? linkedSites[0] : null;
    if (!siteId) warnings.push(`${coupler.id}: 154 kV açık kuplaj bulundu; TM eşlemesi ${linkedSites.length ? 'belirsiz' : 'eksik'}.`);
    const side = (index: number): SplitBusSide => {
      const bus = electrical.buses[index], feederIds = [...(branchesByBus.get(index) || [])].sort();
      const termNames = bus.terms.map(id => terminalById.get(id)?.name || '').join(' ');
      const barDesignation = /(?:^|\s)B\s*[-–]?\s*1(?:\s|$)/i.test(termNames) ? 'B-1' : /(?:^|\s)B\s*[-–]?\s*2(?:\s|$)/i.test(termNames) ? 'B-2' : 'UNKNOWN';
      return { electricalBusId: bus.id, busName: bus.name, barDesignation, terminalIds: [...bus.terms], feederCount: feederIds.length,
        feederIds, feederNames: feederIds.map(id => branchById.get(id)?.name || id), islandIds: [islandIdsByComponent[componentOf[index]]] };
    };
    const bus1 = side(a), bus2 = side(b);
    const namesShowDistinctBars = bus1.barDesignation !== 'UNKNOWN' && bus2.barDesignation !== 'UNKNOWN' && bus1.barDesignation !== bus2.barDesignation;
    const confidence = !siteId ? 'AMBIGUOUS' : (busA.vnKv === busB.vnKv && sharedSites.length === 1 && namesShowDistinctBars) ? 'STRUCTURAL' : 'HEURISTIC';
    const sameConnectedComponent = componentOf[a] === componentOf[b];
    splitStations.push({ classification: 'SPLIT_BUS', heuristic: true, confidence, siteId,
      siteName: siteId ? siteById.get(siteId)?.name || siteId : null, voltageKv: avgKv,
      bus1, bus2, couplerId: coupler.id, couplerName: coupler.name,
      couplerInService: coupler.inService, couplerClosed: coupler.closed, sameConnectedComponent,
      topologyRelation: sameConnectedComponent ? 'SAME_COMPONENT_VIA_ALTERNATE_PATH' : 'SEPARATE_COMPONENTS',
      note: 'Açık ElmCoup iki ayrı 154 kV elektrik barasını ayırıyor; bu sınıflama gerçek bağlı bileşen adası değildir.' });
  }
  splitStations.sort((a, b) => (a.siteName || '').localeCompare(b.siteName || '', 'tr') || a.couplerId.localeCompare(b.couplerId));
  return { islands, splitStations, electricalBusIslandIds, terminalToElectricalBus, warnings };
}
