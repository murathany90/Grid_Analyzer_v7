import type { AppContext, CatalogRow, Feature } from '../../app/contracts';
import type { Bus, CanonicalNetwork, Entity, Line, Site, Switch, Transformer2W } from '../../domain/model/network';
import type { StatusKey } from '../../domain/scenario/overlay';
import { csvCell, downloadText, element } from '../../ui/components/dom';
import { fetchCatalogAll } from '../catalog';
import { SvgSldRenderer, type SldDiagram, type SldEquipment, type SldRegionalBranch, type SldSwitch, type SldTerminal, type SldScope } from './sld-renderer';

const bayPageSize = 20;
interface NetworkIndex {
  network: CanonicalNetwork;
  buses: Map<string, Bus>;
  sites: Map<string, Site>;
  entities: Map<string, Entity>;
  equipmentById: Map<string, SldEquipment[]>;
  equipmentByBus: Map<string, SldEquipment[]>;
  equipmentBySite: Map<string, SldEquipment[]>;
  switchesById: Map<string, Switch>;
  regionalBranches: readonly SldRegionalBranch[];
  groupsBySite: Map<string, Map<string, Bus[]>>;
}
interface StationData {
  bays: CatalogRow[]; terminals: CatalogRow[]; cubicles: CatalogRow[]; switches: CatalogRow[]; substats: CatalogRow[];
  rawByKey: Map<string, CatalogRow>; baysById: Map<string, CatalogRow>; terminalsByBay: Map<string, CatalogRow[]>;
  cubiclesByTerminal: Map<string, CatalogRow[]>; switchesByBay: Map<string, CatalogRow[]>; substatsById: Map<string, string>;
}
const keyOf = (sourceClass: string, id: string) => `${sourceClass}|${id}`;
const field = (row: CatalogRow, name: string): string => String(row.attributes[name] ?? '');
const bool = (value: unknown): boolean => Number(value) === 1 || value === true;

function modelEntityLists(network: CanonicalNetwork): readonly (readonly Entity[])[] {
  return [network.sites, network.buses, network.lines, network.transformers, network.generators, network.loads, network.shunts,
    network.seriesCompensators, network.externalGrids, network.internationalConnections, network.switches, network.stationControllers,
    network.secondaryControllers, network.boundaries];
}

function equipmentRecord(entity: Entity, network: CanonicalNetwork, buses: Map<string, Bus>, scenario: AppContext['scenario']['current']): SldEquipment {
  const line = entity.sourceClass === 'ElmLne' ? entity as Line : null;
  const transformer = entity.sourceClass === 'ElmTr2' ? entity as Transformer2W : null;
  const switchEntity = entity.sourceClass === 'ElmCoup' || entity.sourceClass === 'StaSwitch' ? entity as Switch : null;
  const busIds = line || transformer || switchEntity
    ? [line?.from || transformer?.from || switchEntity?.from || '', line?.to || transformer?.to || switchEntity?.to || ''].filter(Boolean)
    : 'bus' in entity && typeof entity.bus === 'string' ? [entity.bus] : [];
  const siteIds = new Set(entity.siteIds);
  for (const busId of busIds) for (const siteId of buses.get(busId)?.siteIds || []) siteIds.add(siteId);
  const inService = line ? (scenario.lineStatus[line.id] ?? line.inService)
    : transformer ? (scenario.transformerStatus[transformer.id] ?? transformer.inService)
      : switchEntity ? switchEntity.inService
      : entity.inService;
  const closed = switchEntity ? (scenario.switchState[switchEntity.id] ?? switchEntity.closed) : undefined;
  return { id: entity.id, name: entity.name || entity.id, sourceClass: entity.sourceClass, busIds, siteIds: [...siteIds], inService,
    ...(closed === undefined ? {} : { closed }), fromSiteId: buses.get(busIds[0] || '')?.siteIds[0], toSiteId: buses.get(busIds[1] || '')?.siteIds[0],
    voltageKv: line?.vnKv ?? transformer?.vnKv };
}

function effectiveEquipment(item: SldEquipment, index: NetworkIndex, ctx: AppContext): SldEquipment {
  const entity = index.entities.get(keyOf(item.sourceClass, item.id));
  if (item.sourceClass === 'ElmLne' && entity) return { ...item, inService: ctx.scenario.current.lineStatus[item.id] ?? entity.inService };
  if (item.sourceClass === 'ElmTr2' && entity) return { ...item, inService: ctx.scenario.current.transformerStatus[item.id] ?? entity.inService };
  if ((item.sourceClass === 'ElmCoup' || item.sourceClass === 'StaSwitch') && entity) {
    return { ...item, closed: ctx.scenario.current.switchState[item.id] ?? (entity as Switch).closed };
  }
  return item;
}

function buildNetworkIndex(network: CanonicalNetwork, ctx: AppContext): NetworkIndex {
  const buses = new Map(network.buses.map(bus => [bus.id, bus]));
  const sites = new Map(network.sites.map(site => [site.id, site]));
  const entities = new Map<string, Entity>();
  const equipmentById = new Map<string, SldEquipment[]>(), equipmentByBus = new Map<string, SldEquipment[]>(), equipmentBySite = new Map<string, SldEquipment[]>();
  const switchesById = new Map(network.switches.filter(sw => sw.sourceClass === 'ElmCoup').map(sw => [sw.id, sw]));
  const scenario = ctx.scenario.current;
  const records: SldEquipment[] = [];
  for (const group of modelEntityLists(network)) for (const entity of group) {
    entities.set(keyOf(entity.sourceClass, entity.id), entity);
    if (entity.sourceClass === 'ElmSite' || entity.sourceClass === 'ElmTerm' || entity.sourceClass === 'ElmStactrl' || entity.sourceClass === 'ElmSecctrl' || entity.sourceClass === 'ElmBoundary') continue;
    const record = equipmentRecord(entity, network, buses, scenario); records.push(record);
    const sameId = equipmentById.get(record.id) || []; sameId.push(record); equipmentById.set(record.id, sameId);
    for (const busId of record.busIds) { const connected = equipmentByBus.get(busId) || []; connected.push(record); equipmentByBus.set(busId, connected); }
    for (const siteId of record.siteIds) { const connected = equipmentBySite.get(siteId) || []; connected.push(record); equipmentBySite.set(siteId, connected); }
  }
  const regionalBranches: SldRegionalBranch[] = [];
  for (const record of records) {
    if (!['ElmLne', 'ElmTr2'].includes(record.sourceClass)) continue;
    const fromSiteId = record.fromSiteId, toSiteId = record.toSiteId;
    if (fromSiteId && toSiteId && fromSiteId !== toSiteId) regionalBranches.push({ ...record, fromSiteId, toSiteId });
  }
  const groupsBySite = new Map<string, Map<string, Bus[]>>();
  for (const bus of network.buses) for (const siteId of bus.siteIds) {
    let groups = groupsBySite.get(siteId); if (!groups) groupsBySite.set(siteId, groups = new Map());
    const groupId = bus.parentId || '';
    let group = groups.get(groupId); if (!group) groups.set(groupId, group = []); group.push(bus);
  }
  return { network, buses, sites, entities, equipmentById, equipmentByBus, equipmentBySite, switchesById, regionalBranches, groupsBySite };
}

async function fetchStationData(ctx: AppContext, network: CanonicalNetwork, site: Site): Promise<StationData> {
  const classes = ['ElmBay', 'ElmTerm', 'StaCubic', 'ElmCoup', 'ElmSubstat'] as const;
  const results = await Promise.all(classes.map(async className => network.classCounts[className]
    ? (await fetchCatalogAll(ctx, className, { siteId: site.id })).rows : []));
  const [bays, terminals, cubicles, switches, substats] = results;
  const rawByKey = new Map<string, CatalogRow>();
  classes.forEach((className, index) => results[index].forEach(row => rawByKey.set(keyOf(className, row.id), row)));
  const terminalsByBay = new Map<string, CatalogRow[]>(), cubiclesByTerminal = new Map<string, CatalogRow[]>(), switchesByBay = new Map<string, CatalogRow[]>();
  for (const row of terminals) { const parent = field(row, 'fold_id'); const list = terminalsByBay.get(parent) || []; list.push(row); terminalsByBay.set(parent, list); }
  for (const row of cubicles) { const terminal = field(row, 'fold_id'); const list = cubiclesByTerminal.get(terminal) || []; list.push(row); cubiclesByTerminal.set(terminal, list); }
  for (const row of switches) { const parent = field(row, 'fold_id'); const list = switchesByBay.get(parent) || []; list.push(row); switchesByBay.set(parent, list); }
  return { bays, terminals, cubicles, switches, substats, rawByKey, baysById: new Map(bays.map(row => [row.id, row])),
    terminalsByBay, cubiclesByTerminal, switchesByBay, substatsById: new Map(substats.map(row => [row.id, row.name || row.id])) };
}

function equipmentForStation(index: NetworkIndex, siteId: string, ctx: AppContext): SldEquipment[] {
  const records = index.equipmentBySite.get(siteId) || [];
  return records.map(item => effectiveEquipment(item, index, ctx));
}

function classifySwitch(row: CatalogRow, switchIndex: Map<string, Switch>, ctx: AppContext): SldSwitch {
  const switchEntity = switchIndex.get(row.id);
  const sourceClosed = bool(row.attributes.on_off);
  const usage = field(row, 'aUsage').toLocaleLowerCase('en-US');
  const kind = usage === 'cbk' ? 'breaker' : usage === 'dct' ? 'isolator' : 'other';
  return { id: row.id, name: row.name || row.id, sourceClass: 'ElmCoup', kind,
    from: switchEntity?.from || null, to: switchEntity?.to || null, modelClosed: sourceClosed,
    closed: ctx.scenario.current.switchState[row.id] ?? sourceClosed, inService: switchEntity?.inService ?? !bool(row.attributes.outserv) };
}

function createBayTerminals(index: NetworkIndex, station: StationData, bay: CatalogRow, switches: readonly SldSwitch[], ctx: AppContext): SldTerminal[] {
  const terminalById = new Map<string, CatalogRow>((station.terminalsByBay.get(bay.id) || []).map(row => [row.id, row]));
  for (const edge of switches) for (const id of [edge.from, edge.to]) if (id && !terminalById.has(id)) {
    const bus = index.buses.get(id);
    if (bus) terminalById.set(id, { id: bus.id, name: bus.name, siteIds: [...bus.siteIds], attributes: { FID: bus.id, loc_name: bus.name, fold_id: bus.parentId } });
  }
  const prefixClass: Record<string, readonly string[]> = { H: ['ElmLne'], T: ['ElmTr2'], U: ['ElmSym', 'ElmGenStat'], L: ['ElmLod'], R: ['ElmShnt'], K: ['ElmScap'] };
  const equipmentForObject = (objectId: string): SldEquipment | null => {
    if (!objectId || objectId.startsWith('C')) return null;
    const candidates = index.equipmentById.get(objectId) || [];
    if (candidates.length === 1) return candidates[0];
    const allowed = prefixClass[objectId[0].toUpperCase()];
    if (!allowed) return null;
    const matches = candidates.filter(candidate => allowed.includes(candidate.sourceClass));
    return matches.length === 1 ? matches[0] : null;
  };
  return [...terminalById.values()].map(row => {
    const bus = index.buses.get(row.id), parent = field(row, 'fold_id') || bus?.parentId || '';
    const equipment = (station.cubiclesByTerminal.get(row.id) || []).map(c => equipmentForObject(field(c, 'obj_id'))).filter((x): x is SldEquipment => !!x)
      .filter(item => item.sourceClass !== 'ElmCoup' && item.sourceClass !== 'StaSwitch').map(item => effectiveEquipment(item, index, ctx));
    return { id: row.id, name: bus?.name || row.name || row.id, bayId: parent, external: parent !== bay.id, equipment };
  }).sort((a, b) => a.name.localeCompare(b.name, 'tr') || a.id.localeCompare(b.id));
}

export function createSldView(ctx: AppContext): Feature {
  const root = element('section', 'ga-feature ga-sld-view');
  const heading = element('div', 'ga-feature-heading');
  heading.append(element('h2', '', 'Tek hat şeması'), element('p', 'ga-muted', 'DGS terminal ve ekipman referanslarından türetilen istasyon ve bölgesel şemalar.'));
  const toolbar = element('div', 'ga-toolbar');
  const siteSelect = element('select'); siteSelect.setAttribute('aria-label', 'Trafo merkezi');
  const scopeSelect = element('select'); scopeSelect.setAttribute('aria-label', 'Şema kapsamı');
  scopeSelect.append(new Option('TM bara / fider', 'station'), new Option('Bölgesel bağlı TM–hat', 'regional'));
  const layoutSelect = element('select'); layoutSelect.setAttribute('aria-label', 'Fider şema yönü');
  layoutSelect.append(new Option('Yatay elektriksel akış', 'horizontal'), new Option('Dikey elektriksel akış', 'vertical'));
  const downloadButton = element('button', 'ga-button', 'SVG indir'); downloadButton.type = 'button';
  const bayBack = element('button', 'ga-button', 'Fider listesine dön'); bayBack.type = 'button'; bayBack.hidden = true;
  const resetButton = element('button', 'ga-button', 'Seçimi temizle'); resetButton.type = 'button';
  toolbar.append(siteSelect, scopeSelect, layoutSelect, downloadButton, bayBack, resetButton);
  const lineBar = element('div', 'ga-toolbar');
  const lineSelect = element('select'); lineSelect.setAttribute('aria-label', 'TM ile ilişkili hat');
  const lineOff = element('button', 'ga-button', 'Senaryoda servis dışı'); lineOff.type = 'button';
  const lineOn = element('button', 'ga-button', 'Senaryoda servise al'); lineOn.type = 'button';
  lineBar.append(lineSelect, lineOff, lineOn);
  const notice = element('p', 'ga-notice', 'Şema otomatik yerleşimlidir; fiziksel PowerFactory sayfa düzenini temsil etmez. Senaryo işlemleri bu uygulamanın yerel model kopyasını etkiler.');
  const bayToolbar = element('div', 'ga-toolbar');
  const bayPager = element('div', 'ga-pager');
  const bayList = element('div', 'ga-sld-bays');
  bayToolbar.append(bayPager);
  bayBack.hidden = true; bayToolbar.hidden = true; bayList.hidden = true; lineBar.hidden = true;
  const info = element('p', 'ga-muted');
  const diagramHost = element('div', 'ga-sld-diagram');
  const detail = element('section', 'ga-detail', 'Bir bara, fider veya ekipman seçin.');
  root.append(heading, toolbar, lineBar, notice, bayToolbar, bayList, info, diagramHost, detail);

  let scope: SldScope = 'station', selectedBayId = '', stationPage = 0;
  let networkIndex: NetworkIndex | null = null, networkHash = '', siteOptionsHash = '', stationData: StationData | null = null;
  let request = 0, lastRenderKey = '', selected: { id: string; sourceClass: string } | null = null;
  let lastContextSelection = '';
  const stationCache = new Map<string, StationData>();
  const renderer = new SvgSldRenderer();

  function effectiveSignature(): string { return JSON.stringify(ctx.scenario.current); }
  function ensureNetwork(): CanonicalNetwork | null {
    const network = ctx.network, hash = network?.modelHash || '';
    if (hash !== networkHash) {
      networkHash = hash; networkIndex = network ? buildNetworkIndex(network, ctx) : null;
      stationCache.clear(); stationData = null; selectedBayId = ''; stationPage = 0; selected = null; lastContextSelection = '';
      siteOptionsHash = '';
    }
    return network;
  }
  function syncSites(network: CanonicalNetwork | null): void {
    const hash = network?.modelHash || '';
    if (siteOptionsHash === hash) return;
    siteOptionsHash = hash;
    if (!network) { siteSelect.replaceChildren(new Option('Model bekleniyor', '')); return; }
    const previous = siteSelect.value;
    siteSelect.replaceChildren(...network.sites.slice().sort((a, b) => a.name.localeCompare(b.name, 'tr'))
      .map(site => new Option(`${site.name} · ${site.areaName || site.areaId}`, site.id)));
    siteSelect.value = network.sites.some(site => site.id === previous) ? previous : network.sites[0]?.id || '';
  }
  function currentSite(): Site | null { return networkIndex?.sites.get(siteSelect.value) || null; }
  function currentLine(): SldEquipment | null {
    const list = networkIndex?.equipmentBySite.get(siteSelect.value) || [];
    const item = list.find(record => record.id === lineSelect.value && record.sourceClass === 'ElmLne');
    return item && networkIndex ? effectiveEquipment(item, networkIndex, ctx) : null;
  }
  function syncLines(site: Site | null): void {
    const previous = lineSelect.value;
    const lines = (site && networkIndex?.equipmentBySite.get(site.id) || []).filter(item => item.sourceClass === 'ElmLne')
      .slice().sort((a, b) => a.name.localeCompare(b.name, 'tr') || a.id.localeCompare(b.id));
    lineSelect.replaceChildren(new Option('Bağlı hat seçiniz', ''), ...lines.map(item => new Option(`${item.name} · ${item.id}`, item.id)));
    if (lines.some(item => item.id === previous)) lineSelect.value = previous;
  }
  function findEntity(id: string, sourceClass: string): Entity | undefined { return networkIndex?.entities.get(keyOf(sourceClass, id)); }
  function findRaw(id: string, sourceClass: string): CatalogRow | undefined { return stationData?.rawByKey.get(keyOf(sourceClass, id)); }
  function addAttributes(holder: HTMLElement, attributes: Readonly<Record<string, unknown>>): void {
    const dl = element('dl', 'ga-attribute-grid');
    for (const [name, value] of Object.entries(attributes)) {
      const cell = element('div', 'ga-attribute'); cell.append(element('dt', '', name), element('dd', '', value == null || value === '' ? '—' : String(value))); dl.append(cell);
    }
    if (dl.childElementCount) holder.append(dl);
  }
  function actionButton(label: string, run: () => void): HTMLButtonElement {
    const button = element('button', 'ga-button', label); button.type = 'button'; button.addEventListener('click', run); return button;
  }
  async function updateStatus(key: StatusKey, id: string, next: boolean, source: boolean): Promise<void> {
    await ctx.setStatus(key, id, next, source, false);
    lastRenderKey = '';
    await render();
  }
  function renderDetail(): void {
    if (!selected) { detail.textContent = 'Bir bara, fider veya ekipman seçin.'; return; }
    const entity = findEntity(selected.id, selected.sourceClass), raw = findRaw(selected.id, selected.sourceClass);
    const equipment = networkIndex?.equipmentById.get(selected.id)?.find(item => item.sourceClass === selected?.sourceClass);
    const name = entity?.name || raw?.name || equipment?.name || selected.id;
    detail.replaceChildren(element('h3', '', name), element('p', 'ga-muted', `${selected.sourceClass} · ${selected.id}`));
    if (entity) {
      const refs = entity.sourceRefs;
      const sourceGrid = element('dl', 'ga-attribute-grid');
      for (const [key, refsForField] of Object.entries(refs)) {
        const cell = element('div', 'ga-attribute');
        cell.append(element('dt', '', key), element('dd', '', refsForField.map(ref => `${ref.sourceClass}.${ref.field} · ${ref.sourceId}${ref.unit ? ` (${ref.unit})` : ''}`).join(' | ')));
        sourceGrid.append(cell);
      }
      if (sourceGrid.childElementCount) detail.append(sourceGrid);
    }
    if (raw) addAttributes(detail, raw.attributes);
    const actions = element('div', 'ga-actions');
    if (entity?.sourceClass === 'ElmLne') {
      const source = entity.inService, active = ctx.scenario.current.lineStatus[entity.id] ?? source;
      actions.append(actionButton(active ? 'Senaryoda servis dışı' : 'Senaryoda servise al', () => void updateStatus('lineStatus', entity.id, !active, source)));
    } else if (entity?.sourceClass === 'ElmTr2') {
      const source = entity.inService, active = ctx.scenario.current.transformerStatus[entity.id] ?? source;
      actions.append(actionButton(active ? 'Senaryoda servis dışı' : 'Senaryoda servise al', () => void updateStatus('transformerStatus', entity.id, !active, source)));
    } else if (entity?.sourceClass === 'ElmTerm') {
      const source = entity.inService, active = ctx.scenario.current.busOrTerminalStatus[entity.id] ?? (ctx.scenario.current.restoredTerminals.includes(entity.id) || source);
      actions.append(actionButton(active ? 'Senaryoda servis dışı' : 'Senaryoda servise al', () => void updateStatus('busOrTerminalStatus', entity.id, !active, source)));
    } else if (entity?.sourceClass === 'ElmCoup' || entity?.sourceClass === 'StaSwitch') {
      const sw = entity as Switch, source = sw.closed, active = ctx.scenario.current.switchState[entity.id] ?? source;
      actions.append(actionButton(active ? 'Senaryoda anahtarı aç' : 'Senaryoda anahtarı kapat', () => void updateStatus('switchState', entity.id, !active, source)));
      if (active !== source) actions.append(actionButton('Model pozisyonuna dön', () => void updateStatus('switchState', entity.id, source, source)));
    }
    if (entity?.sourceClass === 'ElmLne' || entity?.sourceClass === 'ElmSite') {
      actions.append(actionButton('Haritada göster', () => ctx.select(entity.id, entity.sourceClass, 'map')));
    }
    if (actions.childElementCount) detail.append(actions);
  }
  function selectEquipment(id: string, sourceClass: string): void {
    selected = { id, sourceClass }; ctx.select(id, sourceClass); renderDetail(); lastRenderKey = '';
    // Render immediately so the selected symbol is emphasized; the parent shell
    // may also call render after the context notification, which is deduplicated.
    void render();
  }
  function drawBayList(data: StationData): void {
    const pages = Math.max(1, Math.ceil(data.bays.length / bayPageSize)); stationPage = Math.min(Math.max(stationPage, 0), pages - 1);
    bayToolbar.hidden = scope !== 'station' || Boolean(selectedBayId);
    bayBack.hidden = scope !== 'station' || !selectedBayId;
    bayPager.hidden = Boolean(selectedBayId);
    bayList.hidden = scope !== 'station' || Boolean(selectedBayId);
    if (scope !== 'station' || selectedBayId) { bayList.replaceChildren(); bayPager.replaceChildren(); return; }
    const previous = element('button', 'ga-button', '← Önceki'); previous.type = 'button'; previous.disabled = stationPage === 0;
    const next = element('button', 'ga-button', 'Sonraki →'); next.type = 'button'; next.disabled = stationPage >= pages - 1;
    previous.addEventListener('click', () => { stationPage--; lastRenderKey = ''; void render(); });
    next.addEventListener('click', () => { stationPage++; lastRenderKey = ''; void render(); });
    bayPager.replaceChildren(previous, element('span', 'ga-muted', `${data.bays.length.toLocaleString('tr-TR')} fider · ${stationPage + 1}/${pages} · 20 kayıt/sayfa`), next);
    const shown = data.bays.slice(stationPage * bayPageSize, (stationPage + 1) * bayPageSize);
    bayList.replaceChildren(...shown.map(bay => {
      const button = element('button', 'ga-sld-node ga-sld-node-bay', `${bay.name || bay.id} · ${bay.id}`); button.type = 'button';
      button.addEventListener('click', () => { selectedBayId = bay.id; lastRenderKey = ''; void render(); }); return button;
    }));
  }
  function selectRawRow(row: CatalogRow, sourceClass: string): void { selected = { id: row.id, sourceClass }; ctx.select(row.id, sourceClass); renderDetail(); lastRenderKey = ''; void render(); }
  function makeDiagram(network: CanonicalNetwork, site: Site, data: StationData | null): SldDiagram {
    const index = networkIndex!;
    const groupsById = index.groupsBySite.get(site.id) || new Map<string, Bus[]>();
    const groups = [...groupsById.entries()].map(([id, buses]) => ({ id: id || site.id, name: data?.substatsById.get(id) || (id ? `Bara grubu · ${id}` : 'Baralar'), buses }));
    const equipment = equipmentForStation(index, site.id, ctx);
    const switches = (data?.switchesByBay.get(selectedBayId) || []).map(row => classifySwitch(row, index.switchesById, ctx));
    const selectedBay = selectedBayId ? data?.baysById.get(selectedBayId) || null : null;
    const terminals = selectedBay && data ? createBayTerminals(index, data, selectedBay, switches, ctx) : [];
    const unresolvedSwitches = switches.filter(sw => !sw.from || !sw.to || !index.buses.has(sw.from) || !index.buses.has(sw.to)).length;
    const connectedSites = new Set<string>([site.id]);
    const adjacent = (index.equipmentBySite.get(site.id) || []).filter(item => ['ElmLne', 'ElmTr2'].includes(item.sourceClass))
      .filter(item => item.fromSiteId && item.toSiteId && item.fromSiteId !== item.toSiteId).slice(0, 85);
    for (const item of adjacent) { connectedSites.add(item.fromSiteId!); connectedSites.add(item.toSiteId!); }
    const regionalSites = [...connectedSites].map(id => index.sites.get(id)).filter((x): x is Site => !!x)
      .sort((a, b) => a.id === site.id ? -1 : b.id === site.id ? 1 : a.name.localeCompare(b.name, 'tr')).slice(0, 37);
    const regionalSet = new Set(regionalSites.map(x => x.id));
    const regionalBranches = adjacent.filter(item => regionalSet.has(item.fromSiteId!) && regionalSet.has(item.toSiteId!))
      .map(item => ({ ...effectiveEquipment(item, index, ctx), fromSiteId: item.fromSiteId!, toSiteId: item.toSiteId! }));
    const bay = selectedBayId ? 'bay' : scope;
    const effectiveGroups = groups.map(group => ({ ...group, buses: group.buses.map(bus => ({ ...bus,
      inService: ctx.scenario.current.busOrTerminalStatus[bus.id] ?? (ctx.scenario.current.restoredTerminals.includes(bus.id) || bus.inService) })) }));
    return { scope: bay, orientation: layoutSelect.value === 'vertical' ? 'vertical' : 'horizontal', station: site, selectedId: selected?.id || null, groups: effectiveGroups, equipment,
      bays: data?.bays || [], selectedBay, terminals, switches, regionalSites, regionalBranches, unresolvedSwitches };
  }
  function makeRenderKey(network: CanonicalNetwork | null, site: Site | null): string {
    return JSON.stringify([network?.modelHash || '', ctx.view, site?.id || '', scope, stationPage, selectedBayId,
      selected?.sourceClass || '', selected?.id || '', lineSelect.value, layoutSelect.value, effectiveSignature()]);
  }
  async function render(): Promise<void> {
    if (ctx.view !== 'sld') { request++; return; }
    const network = ensureNetwork(); syncSites(network);
    if (!network || !networkIndex) {
      const key = makeRenderKey(null, null); if (key === lastRenderKey) return; lastRenderKey = key;
      lineBar.hidden = true; bayToolbar.hidden = true; bayList.replaceChildren();
      diagramHost.replaceChildren(element('p', 'ga-empty', 'Önce DGS JSON modelini yükleyin.'));
      detail.textContent = 'Bir bara, fider veya ekipman seçin.'; info.textContent = ''; return;
    }
    const contextSelection = ctx.selection ? keyOf(ctx.selection.sourceClass, ctx.selection.id) : '';
    if (contextSelection !== lastContextSelection) { selected = ctx.selection ? { ...ctx.selection } : null; lastContextSelection = contextSelection; }
    const site = currentSite();
    if (!site) { diagramHost.replaceChildren(element('p', 'ga-empty', 'Bu modelde trafo merkezi bulunamadı.')); return; }
    syncLines(site);
    const key = makeRenderKey(network, site); if (key === lastRenderKey) return; lastRenderKey = key;
    const activeRequest = ++request;
    lineBar.hidden = scope !== 'station';
    layoutSelect.hidden = scope !== 'station';
    const cacheKey = `${network.modelHash}|${site.id}`;
    let data: StationData | null = null;
    if (scope !== 'regional') {
      try {
        if(!stationCache.has(cacheKey)){bayList.replaceChildren();bayPager.replaceChildren();diagramHost.replaceChildren(element('p','ga-muted','Şema kaynakları hazırlanıyor…'));info.textContent='';}
        data = stationCache.get(cacheKey) || await fetchStationData(ctx, network, site);
        stationCache.set(cacheKey, data); stationData = data;
      } catch (error) {
        if (activeRequest !== request || ctx.view !== 'sld') return;
        lastRenderKey = '';
        const message = element('p', 'ga-notice ga-notice-error', `SLD kaynak kayıtları yüklenemedi: ${error instanceof Error ? error.message : String(error)}`);
        const retry = element('button', 'ga-button', 'Yeniden dene'); retry.type = 'button'; retry.addEventListener('click', () => { stationCache.delete(cacheKey); lastRenderKey = ''; void render(); });
        diagramHost.replaceChildren(message, retry); return;
      }
      if (activeRequest !== request || ctx.view !== 'sld' || ctx.network?.modelHash !== network.modelHash) return;
      drawBayList(data);
    } else { stationData = null; bayToolbar.hidden = true; bayList.hidden = true; }
    const diagram = makeDiagram(network, site, data);
    renderer.render(diagramHost, diagram, selectEquipment);
    if (scope === 'regional') info.textContent = `${diagram.regionalBranches.length} gerçek TM–hat/trafo bağlantısı · ${diagram.regionalSites.length} merkez · doğrudan komşu görünüm (en fazla 37 TM / 85 dal).`;
    else if (selectedBayId) info.textContent = `${diagram.terminals.length} gerçek terminal · ${diagram.switches.length} ElmCoup anahtarı · ${diagram.unresolvedSwitches} çözülemeyen uç. Senaryo durumları yerel çalışma kopyasındadır.`;
    else info.textContent = `${site.name} · ${diagram.groups.reduce((count, group) => count + group.buses.length, 0)} bara · ${data?.bays.length || 0} fider · paralel bağlantılar kaynak FID ile ayrı gösterilir.`;
    renderDetail();
    const line = currentLine(), lineActive = line ? ctx.scenario.current.lineStatus[line.id] ?? line.inService : false;
    lineOff.disabled = !line || !lineActive; lineOn.disabled = !line || lineActive;
  }

  scopeSelect.addEventListener('change', () => { scope = scopeSelect.value === 'regional' ? 'regional' : 'station'; selectedBayId = ''; stationPage = 0; lastRenderKey = ''; void render(); });
  siteSelect.addEventListener('change', () => { selectedBayId = ''; stationPage = 0; selected = null; ctx.selection = null; lastRenderKey = ''; void render(); });
  lineSelect.addEventListener('change', () => { lastRenderKey = ''; void render(); });
  layoutSelect.addEventListener('change', () => { lastRenderKey = ''; void render(); });
  bayBack.addEventListener('click', () => { selectedBayId = ''; selected = null; lastRenderKey = ''; void render(); });
  resetButton.addEventListener('click', () => { selected = null; ctx.selection = null; ctx.notify(); lastRenderKey = ''; void render(); });
  lineOff.addEventListener('click', () => { const line = currentLine(), source = line ? findEntity(line.id, 'ElmLne')?.inService : undefined; if (line && typeof source === 'boolean') void updateStatus('lineStatus', line.id, false, source); });
  lineOn.addEventListener('click', () => { const line = currentLine(), source = line ? findEntity(line.id, 'ElmLne')?.inService : undefined; if (line && typeof source === 'boolean') void updateStatus('lineStatus', line.id, true, source); });
  downloadButton.addEventListener('click', () => {
    const svg = diagramHost.querySelector('svg'); if (!svg) { ctx.setMessage('Önce SVG şeması oluşturulmalıdır.'); return; }
    const xml = new XMLSerializer().serializeToString(svg);
    const site = currentSite(); downloadText(xml, `YTBS_SLD_${site?.id || 'TM'}.svg`, 'image/svg+xml;charset=utf-8');
  });
  const unsubscribe = () => {};
  if (ctx.view === 'sld') void render();
  return { element: root, render: () => { void render(); }, dispose: unsubscribe };
}
