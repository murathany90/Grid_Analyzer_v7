import type { CapacitySeason } from '../model/capacity';
import { capacityLimit } from '../model/capacity';
import type { CanonicalNetwork } from '../model/network';
import { effectiveNetwork, type ScenarioOverlay } from '../scenario/overlay';
import { prepareReduced, type ReducedNetwork } from '../../analysis/fast-ac/reduced-model';
import { buildTopology } from '../../topology/electrical-topology';
import {auditOutageTopology} from '../../analysis/contingency-ac/topology-audit';

export type N1CatalogSourceClass = 'ElmLne' | 'ElmTr2';
export type N1CatalogTopology = 'NON_ISLANDING' | 'ISLANDING' | 'UNSUPPORTED';
export type N1CatalogScreenability = 'ALL' | 'SCREENABLE' | 'ISLANDING' | 'UNSCREENABLE';

/** A pre-screen row. Endpoint site relations come from the canonical electrical topology. */
export interface N1CatalogCandidate {
  candidateId: string;
  equipmentId: string;
  sourceClass: N1CatalogSourceClass;
  name: string;
  vnKv: number;
  voltageLevelsKv?: readonly number[];
  from: string;
  to: string;
  siteIds: readonly string[];
  fromSiteIds: readonly string[];
  toSiteIds: readonly string[];
  fromYtmIds: readonly string[];
  toYtmIds: readonly string[];
  representedInReducedModel: boolean;
  screenable: boolean;
  topology: N1CatalogTopology;
  ratingAvailable: boolean;
  exclusionReason: string | null;
}

export interface N1CandidateCatalog {
  candidates: readonly N1CatalogCandidate[];
  counts: { total: number; screenable: number; islanding: number; unscreenable: number };
}

export interface N1CatalogBuildOptions {
  capacitySeason?: CapacitySeason;
  includeAllVoltages?: boolean;
  /** Allows callers that already prepared the effective reduced model to share it. */
  reduced?: ReducedNetwork;
}

export interface N1CatalogFilter {
  ytmId?: string;
  ytmIds?: readonly string[];
  voltageBands?: readonly number[];
  endpointScope?: 'INTERNAL'|'CONNECTED'|'BOTH';
  tmId?: string;
  sourceClasses?: readonly N1CatalogSourceClass[];
  minVoltageKv?: number;
  maxVoltageKv?: number;
  screenability?: N1CatalogScreenability;
  search?: string;
}

function endpointSites(terminalToBus: Map<string, number>, busSites: readonly (readonly string[])[], terminal: string): string[] {
  const bus = terminalToBus.get(terminal);
  if (bus == null) return [];
  return [...new Set(busSites[bus] ?? [])].sort((a, b) => a.localeCompare(b));
}

function bridgesOf(reduced: ReducedNetwork): Set<string> {
  const bridges = new Set<string>();
  for (const island of reduced.islands) {
    const adjacency: { to: number; edgeId: string }[][] = island.busIds.map(() => []);
    for (const edge of island.edges) {
      adjacency[edge.a]?.push({ to: edge.b, edgeId: edge.id });
      adjacency[edge.b]?.push({ to: edge.a, edgeId: edge.id });
    }
    const entered = new Int32Array(adjacency.length).fill(-1);
    const low = new Int32Array(adjacency.length);
    let clock = 0;
    const visit = (bus: number, parentEdge: string | null): void => {
      entered[bus] = low[bus] = clock++;
      for (const next of adjacency[bus]) {
        if (next.edgeId === parentEdge) continue;
        if (entered[next.to] !== -1) low[bus] = Math.min(low[bus], entered[next.to]);
        else {
          visit(next.to, next.edgeId);
          low[bus] = Math.min(low[bus], low[next.to]);
          if (low[next.to] > entered[bus]) bridges.add(next.edgeId);
        }
      }
    };
    for (let bus = 0; bus < adjacency.length; bus++) if (entered[bus] === -1) visit(bus, null);
  }
  return bridges;
}

/**
 * Builds the selectable N-1 inventory without solving power flow. Candidate scope is all
 * effective, in-service lines and two-winding transformers. The legacy default stays >=66 kV;
 * full-voltage callers retain low-voltage candidates for direct AC validation.
 */
export function buildN1CandidateCatalog(
  network: CanonicalNetwork,
  scenario: ScenarioOverlay,
  options: N1CatalogBuildOptions = {},
): N1CandidateCatalog {
  const effective = effectiveNetwork(network, scenario);
  const electrical = buildTopology(effective);
  const reduced = options.reduced ?? prepareReduced(effective);
  const represented = new Set(reduced.islands.flatMap((island) => island.edges.map((edge) => edge.id)));
  const bridges = bridgesOf(reduced);
  const fullEdges=options.includeAllVoltages?new Map(auditOutageTopology(network,scenario).edges.map(e=>[e.key,e.classification])):null;
  const sitesById = new Map(network.sites.map((site) => [site.id, site]));
  const busSites = electrical.buses.map((bus) => bus.siteIds);
  const getEndpointSites = (id: string) => endpointSites(electrical.terminalToBus, busSites, id);
  const lineById = new Map(effective.lines.map((line) => [line.id, line]));
  const transformerById = new Map(effective.transformers.map((transformer) => [transformer.id, transformer]));
  const candidates: N1CatalogCandidate[] = [];

  const add = (equipment: CanonicalNetwork['lines'][number] | CanonicalNetwork['transformers'][number], sourceClass: N1CatalogSourceClass, vnKv: number): void => {
    if (!equipment.inService || !Number.isFinite(vnKv) || vnKv <= 0 || !options.includeAllVoltages && vnKv < 66) return;
    const fromSiteIds = getEndpointSites(equipment.from);
    const toSiteIds = getEndpointSites(equipment.to);
    const siteIds = [...new Set([...equipment.siteIds, ...fromSiteIds, ...toSiteIds])].sort((a, b) => a.localeCompare(b));
    const fromYtmIds = [...new Set(fromSiteIds.map((id) => sitesById.get(id)?.areaId).filter((id): id is string => !!id))].sort((a, b) => a.localeCompare(b));
    const toYtmIds = [...new Set(toSiteIds.map((id) => sitesById.get(id)?.areaId).filter((id): id is string => !!id))].sort((a, b) => a.localeCompare(b));
    const isRepresented = represented.has(equipment.id);
    const full=fullEdges?.get(`${sourceClass}:${equipment.sourceId}`);
    const topology: N1CatalogTopology = fullEdges ? full==='BRIDGE'?'ISLANDING':full==='NON_BRIDGE'?'NON_ISLANDING':'UNSUPPORTED' : !isRepresented ? 'UNSUPPORTED' : bridges.has(equipment.id) ? 'ISLANDING' : 'NON_ISLANDING';
    const reason = topology === 'ISLANDING' ? (fullEdges?'Kesinti tam bağlı ağda adayı ayırır.':'Kesinti indirgenmiş ağda adayı ayırır.') : topology === 'UNSUPPORTED' ? (fullEdges?'Ekipman etkin tam ağda kesinti olarak temsil edilmiyor.':'Ekipman etkin indirgenmiş ağda temsil edilmiyor.') : null;
    candidates.push({
      candidateId: `${sourceClass}:${equipment.id}`, equipmentId: equipment.id, sourceClass,
      name: equipment.name, vnKv, voltageLevelsKv:[...new Set([vnKv,...'lvKv'in equipment?[equipment.lvKv]:[]])], from: equipment.from, to: equipment.to,
      siteIds, fromSiteIds, toSiteIds, fromYtmIds, toYtmIds,
      representedInReducedModel: isRepresented, screenable: isRepresented && vnKv>=66 && topology === 'NON_ISLANDING', topology,
      ratingAvailable: sourceClass === 'ElmTr2'
        ? Number.isFinite(transformerById.get(equipment.id)?.ratingMva) && (transformerById.get(equipment.id)?.ratingMva ?? 0) > 0
        : (() => { const line = lineById.get(equipment.id); return !!line?.capacity && capacityLimit(line.capacity, line.fastParameters?.vnKv ?? vnKv, options.capacitySeason ?? 'nominal') != null; })(),
      exclusionReason: reason,
    });
  };

  for (const line of effective.lines) add(line, 'ElmLne', line.fastParameters?.vnKv ?? line.vnKv);
  for (const transformer of effective.transformers) add(transformer, 'ElmTr2', Math.max(transformer.vnKv, transformer.lvKv));
  candidates.sort((a, b) => a.candidateId.localeCompare(b.candidateId));
  const islanding = candidates.filter((candidate) => candidate.topology === 'ISLANDING').length;
  const unscreenable = candidates.filter((candidate) => !candidate.screenable && candidate.topology !== 'ISLANDING').length;
  return { candidates, counts: { total: candidates.length, screenable: candidates.length - islanding - unscreenable, islanding, unscreenable } };
}

/** Scope semantics: include a candidate when at least one endpoint matches the selected TM/YTM. */
export function filterN1CatalogCandidates(candidates: readonly N1CatalogCandidate[], filter: N1CatalogFilter = {}): N1CatalogCandidate[] {
  const query = filter.search?.trim().toLocaleLowerCase('tr-TR') ?? '';
  const classes = filter.sourceClasses ? new Set(filter.sourceClasses) : null;
  return candidates.filter((candidate) => {
    if (classes && !classes.has(candidate.sourceClass)) return false;
    if (filter.minVoltageKv != null && candidate.vnKv < filter.minVoltageKv) return false;
    if (filter.maxVoltageKv != null && candidate.vnKv > filter.maxVoltageKv) return false;
    if (filter.screenability === 'SCREENABLE' && !candidate.screenable) return false;
    if (filter.screenability === 'ISLANDING' && candidate.topology !== 'ISLANDING') return false;
    if (filter.screenability === 'UNSCREENABLE' && (candidate.screenable || candidate.topology === 'ISLANDING')) return false;
    if(filter.voltageBands?.length&&!filter.voltageBands.some(v=>(candidate.voltageLevelsKv??[candidate.vnKv]).some(kv=>voltageBandMatches(kv,v))))return false;
    const ytms=filter.ytmIds?.length?filter.ytmIds:filter.ytmId?[filter.ytmId]:[];
    const from=ytms.length?candidate.fromYtmIds.filter(id=>ytms.includes(id)):candidate.fromYtmIds,to=ytms.length?candidate.toYtmIds.filter(id=>ytms.includes(id)):candidate.toYtmIds;
    if(ytms.length&&!from.length&&!to.length)return false;
    const internal=from.some(id=>to.includes(id));
    if(filter.endpointScope==='INTERNAL'&&!internal||filter.endpointScope==='CONNECTED'&&internal)return false;
    if (filter.ytmId && filter.tmId) {
      const fromMatches = candidate.fromYtmIds.includes(filter.ytmId) && candidate.fromSiteIds.includes(filter.tmId);
      const toMatches = candidate.toYtmIds.includes(filter.ytmId) && candidate.toSiteIds.includes(filter.tmId);
      if (!fromMatches && !toMatches) return false;
    } else if (filter.ytmId && !candidate.fromYtmIds.includes(filter.ytmId) && !candidate.toYtmIds.includes(filter.ytmId)) return false;
    else if (filter.tmId && !candidate.fromSiteIds.includes(filter.tmId) && !candidate.toSiteIds.includes(filter.tmId)) return false;
    if (query && !`${candidate.candidateId} ${candidate.name} ${candidate.from} ${candidate.to} ${candidate.siteIds.join(' ')}`.toLocaleLowerCase('tr-TR').includes(query)) return false;
    return true;
  });
}

/** Native voltage bands: 400 includes 380/420, 33 includes 31.5/34.5. */
export function voltageBandMatches(kv:number,band:number):boolean{return band===400?kv>=300&&kv<=450:band===154?kv>=110&&kv<=170:band===33?kv>=24&&kv<=36:kv===band;}
