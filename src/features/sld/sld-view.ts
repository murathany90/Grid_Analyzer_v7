import {activeResultId} from '../../domain/results/workspace';
import {buildStationTopologyGraph,type StationTopologyGraph,type Feeder} from '../../domain/model/station-topology';
import {voltageMatches} from '../../domain/model/voltage-band';
import {createVoltageFilter} from '../../ui/components/voltage-filter';
import type { AppContext, CatalogRow, Feature } from '../../app/contracts';
import type { Bus, CanonicalNetwork, Entity, Line, Site, Switch, Transformer2W } from '../../domain/model/network';
import type { StatusKey } from '../../domain/scenario/overlay';
import { downloadText, element } from '../../ui/components/dom';
import { fetchCatalogAll } from '../catalog';
import { SvgSldRenderer, type SldDiagram, type SldEquipment, type SldRegionalBranch, type SldSwitch, type SldTerminal, type SldScope } from './sld-renderer';
import {calculationEngineLabel,calculationSessionStatus} from '../../ui/components/calculation-controls';

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
  graph: StationTopologyGraph;
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
  return { id: entity.id, name: entity.name || entity.id, sourceClass: entity.sourceClass, busIds, siteIds: [...siteIds], inService,sourceInService:entity.inService,sourceClosed:switchEntity?.closed,
    ...(closed === undefined ? {} : { closed }), fromSiteId: buses.get(busIds[0] || '')?.siteIds[0], toSiteId: buses.get(busIds[1] || '')?.siteIds[0],
    voltageKv: line?.vnKv ?? transformer?.vnKv,lvKv:transformer?.lvKv,ratingMva:transformer?.ratingMva };
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
  const switchesById = new Map(network.switches.map(sw => [sw.id, sw]));
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
  const classes = ['ElmBay', 'ElmTerm', 'StaCubic', 'ElmCoup', 'ElmSubstat', 'StaSwitch'] as const;
  const results = await Promise.all(classes.map(async className => network.classCounts[className]
    ? (await fetchCatalogAll(ctx, className, { siteId: site.id })).rows : []));
  const [bays, terminals, cubicles, couplers, substats, stationSwitches] = results;const switches=[...couplers,...stationSwitches];
  const rawByKey = new Map<string, CatalogRow>();
  classes.forEach((className, index) => results[index].forEach(row => rawByKey.set(keyOf(className, row.id), row)));
  const terminalsByBay = new Map<string, CatalogRow[]>(), cubiclesByTerminal = new Map<string, CatalogRow[]>(), switchesByBay = new Map<string, CatalogRow[]>();
  for (const row of terminals) { const parent = field(row, 'fold_id'); const list = terminalsByBay.get(parent) || []; list.push(row); terminalsByBay.set(parent, list); }
  for (const row of cubicles) { const terminal = field(row, 'fold_id'); const list = cubiclesByTerminal.get(terminal) || []; list.push(row); cubiclesByTerminal.set(terminal, list); }
  for (const row of switches) { const direct=field(row,'fold_id'),cub=cubicles.find(c=>c.id===direct),term=cub?terminals.find(t=>t.id===field(cub,'fold_id')):null;const parent=term?field(term,'fold_id'):direct; const list = switchesByBay.get(parent) || []; list.push(row); switchesByBay.set(parent, list); }
  return { graph:buildStationTopologyGraph(network,site.id,{bays,terminals,cubicles,switches,substats}),bays, terminals, cubicles, switches, substats, rawByKey, baysById: new Map(bays.map(row => [row.id, row])),
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
  return { id: row.id, name: row.name || row.id, sourceClass: switchEntity?.sourceClass==='StaSwitch'?'StaSwitch':'ElmCoup', kind,
    from: switchEntity?.from || null, to: switchEntity?.to || null, modelClosed: sourceClosed,
    closed: ctx.scenario.current.switchState[row.id] ?? sourceClosed, inService: switchEntity?.inService ?? !bool(row.attributes.outserv) };
}

function createBayTerminals(index: NetworkIndex, station: StationData, bay: CatalogRow, switches: readonly SldSwitch[], ctx: AppContext): SldTerminal[] {
  const feeder=station.graph.feeders.find(f=>f.id===bay.id),bayEquipment=new Set(feeder?.equipmentKeys||[]);
  const terminalById = new Map<string, CatalogRow>((station.terminalsByBay.get(bay.id) || []).map(row => [row.id, row]));
  for(const id of feeder?.terminalIds||[]){const bus=index.buses.get(id);if(bus&&!terminalById.has(id))terminalById.set(id,{id,name:bus.name,siteIds:[...bus.siteIds],attributes:{fold_id:bus.parentId}});}
  for (const edge of switches) for (const id of [edge.from, edge.to]) if (id && !terminalById.has(id)) {
    const bus = index.buses.get(id);
    if (bus) terminalById.set(id, { id: bus.id, name: bus.name, siteIds: [...bus.siteIds], attributes: { FID: bus.id, loc_name: bus.name, fold_id: bus.parentId } });
  }
  const equipmentForObject=(objectId:string,termId:string):SldEquipment|null=>{const matches=(index.equipmentById.get(objectId)||[]).filter(e=>bayEquipment.has(keyOf(e.sourceClass,e.id))&&e.busIds.includes(termId));return matches.length===1?matches[0]:null;};
  return [...terminalById.values()].map(row => {
    const bus = index.buses.get(row.id), parent = field(row, 'fold_id') || bus?.parentId || '';
    const sourceEquipment=(station.cubiclesByTerminal.get(row.id)||[]).map(c=>equipmentForObject(field(c,'obj_id'),row.id)).filter((x):x is SldEquipment=>!!x);
    const equipment = (sourceEquipment.length?sourceEquipment:(index.equipmentByBus.get(row.id)||[]).filter(e=>bayEquipment.has(keyOf(e.sourceClass,e.id))))
      .filter(item => item.sourceClass !== 'ElmCoup' && item.sourceClass !== 'StaSwitch').map(item => effectiveEquipment(item, index, ctx));
    return { id: row.id, name: bus?.name || row.name || row.id, bayId: parent, external: parent !== bay.id, equipment };
  }).sort((a, b) => a.name.localeCompare(b.name, 'tr') || a.id.localeCompare(b.id));
}

export function createSldView(ctx: AppContext): Feature {
  const root = element('section', 'ga-feature ga-sld-view');
  const session=calculationSessionStatus(ctx);
  const heading = element('div', 'ga-feature-heading');
  heading.append(element('h2', '', 'Tek hat şeması'), element('p', 'ga-muted', 'DGS terminal ve ekipman referanslarından türetilen istasyon ve bölgesel şemalar.'));
  const toolbar = element('div', 'ga-toolbar');
  const siteSelect = element('select'); siteSelect.setAttribute('aria-label', 'Trafo merkezi');
  const scopeSelect = element('select'); scopeSelect.setAttribute('aria-label', 'Şema kapsamı');
  scopeSelect.append(new Option('TM Genel — Tam İstasyon', 'station'), new Option('Fider / Bay ayrıntısı', 'bay'), new Option('Bölgesel bağlı TM–hat', 'regional'));
  const layoutSelect = element('select'); layoutSelect.setAttribute('aria-label', 'Fider şema yönü');
  layoutSelect.append(new Option('Yatay bara + dikey fider', 'vertical'), new Option('Yatay fider ayrıntısı', 'horizontal'));
  const voltageFilter=createVoltageFilter(ctx,'SLD gerilim grupları'),technical=element('input');technical.type='checkbox';const technicalLabel=element('label','ga-check','Teknik görünüm');technicalLabel.append(technical);
  const downloadButton = element('button', 'ga-button', 'SVG indir'); downloadButton.type = 'button';
  const resetButton = element('button', 'ga-button', 'Seçimi temizle'); resetButton.type = 'button';
  toolbar.append(siteSelect, scopeSelect, layoutSelect, downloadButton,technicalLabel);
  const lineBar = element('div', 'ga-toolbar');
  const lineSelect = element('select'); lineSelect.setAttribute('aria-label', 'TM ile ilişkili hat');
  lineBar.append(lineSelect);
  const notice = element('p', 'ga-notice', 'Şema otomatik yerleşimlidir; fiziksel PowerFactory sayfa düzenini temsil etmez. Senaryo işlemleri bu uygulamanın yerel model kopyasını etkiler.');
  const bayToolbar = element('div', 'ga-toolbar');
  const baySearch=element('input'),bayGroup=element('select'),bayPicker=element('select');baySearch.type='search';baySearch.placeholder='Fider ara';baySearch.setAttribute('aria-label','Fider ara');bayGroup.setAttribute('aria-label','Fider grubu');bayPicker.setAttribute('aria-label','Fider seç');
  bayToolbar.append(baySearch,bayGroup,bayPicker);
  bayToolbar.hidden = true; lineBar.hidden = true;
  const info = element('p', 'ga-muted');
  const regionalPager=element('div','ga-pager');regionalPager.hidden=true;
  const diagramHost = element('div', 'ga-sld-diagram');
  const detail = element('section', 'ga-detail', 'Bir bara, fider veya ekipman seçin.');
  root.append(heading, session.element, toolbar, voltageFilter.element, lineBar, notice, bayToolbar, info,regionalPager, diagramHost, detail);

  let scope: SldScope = 'station', selectedBayId = '', regionalPage = 0;
  let networkIndex: NetworkIndex | null = null, networkHash = '', siteOptionsHash = '', stationData: StationData | null = null;
  let request = 0, lastRenderKey = '', selected: { id: string; sourceClass: string } | null = null;
  let lastContextSelection = '';
  const stationCache = new Map<string, StationData>();
  const renderer = new SvgSldRenderer();
  toolbar.append(actionButton('Sığdır',()=>renderer.fit()),actionButton('Yakınlaştır +',()=>renderer.zoom(1.3)),actionButton('Uzaklaştır −',()=>renderer.zoom(1/1.3)));
  baySearch.oninput=()=>{if(stationData)drawFeederPicker(stationData);};bayGroup.onchange=()=>{if(stationData)drawFeederPicker(stationData);};technical.onchange=()=>{lastRenderKey='';void render();};
  bayPicker.onchange=()=>{const feeder=stationData?.graph.feeders.find(f=>f.id===bayPicker.value);if(!feeder)return;selectedBayId=feeder.id;selectEquipment(feeder.sourceClass==='ElmBay'?feeder.id:feeder.id.slice(feeder.id.indexOf('|')+1),feeder.sourceClass);};

  function effectiveSignature(): string { return JSON.stringify(ctx.scenario.current); }
  function ensureNetwork(): CanonicalNetwork | null {
    const network = ctx.network, hash = network?.modelHash || '';
    if (hash !== networkHash) {
      networkHash = hash; networkIndex = network ? buildNetworkIndex(network, ctx) : null;
      stationCache.clear(); stationData = null; selectedBayId = ''; regionalPage = 0; selected = null; lastContextSelection = '';
      siteOptionsHash = '';
    }
    return network;
  }
  function syncSites(network: CanonicalNetwork | null): void {
    const hash = (network?.modelHash || '')+'|'+[...ctx.filters.voltages].sort().join(',');
    if (siteOptionsHash === hash) return;
    siteOptionsHash = hash;
    if (!network) { siteSelect.replaceChildren(new Option('Model bekleniyor', '')); return; }
    const previous = siteSelect.value;
    siteSelect.replaceChildren(...network.sites.filter(site=>site.voltages.some(v=>voltageMatches(v,ctx.filters.voltages))).slice().sort((a, b) => a.name.localeCompare(b.name, 'tr'))
      .map(site => new Option(`${site.name} · ${site.areaName || site.areaId}`, site.id)));
    siteSelect.value = [...siteSelect.options].some(o=>o.value===previous)?previous:siteSelect.options[0]?.value||'';
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
      const cell = element('div', 'ga-attribute'); cell.append(element('dt', '', name), element('dd', '', value == null || value === '' ? '—' : typeof value==='object'?JSON.stringify(value):String(value))); dl.append(cell);
    }
    if (dl.childElementCount) holder.append(dl);
  }
  function actionButton(label: string, run: () => void): HTMLButtonElement {
    const button = element('button', 'ga-button', label); button.type = 'button'; button.addEventListener('click', run); return button;
  }
  function renderDetail(): void {
    if (!selected) { detail.textContent = 'Bir bara, fider veya ekipman seçin.'; return; }
    const entity = findEntity(selected.id, selected.sourceClass), raw = findRaw(selected.id, selected.sourceClass);
    const equipment = networkIndex?.equipmentById.get(selected.id)?.find(item => item.sourceClass === selected?.sourceClass);
    const name = entity?.name || raw?.name || equipment?.name || selected.id;
    detail.replaceChildren(element('h3', '', name), element('p', 'ga-muted', `${selected.sourceClass} · ${selected.id}`));
    const technicalDetails=element('details'),technicalSummary=element('summary','','Teknik kaynak ayrıntıları');technicalDetails.append(technicalSummary);
    if(entity)addAttributes(technicalDetails,entity.sourceRefs);if(raw)addAttributes(technicalDetails,raw.attributes);detail.append(technicalDetails);
    const actions=element('div','ga-actions');actions.append(resetButton);
    if(entity){const key:StatusKey|null=entity.sourceClass==='ElmLne'?'lineStatus':entity.sourceClass==='ElmTr2'?'transformerStatus':entity.sourceClass==='ElmTerm'?'busOrTerminalStatus':['ElmCoup','StaSwitch'].includes(entity.sourceClass)?'switchState':null;
      if(key){const source=key==='switchState'?(entity as Switch).closed:entity.inService,active=ctx.scenario.current[key][entity.id]??(key==='busOrTerminalStatus'?ctx.scenario.current.restoredTerminals.includes(entity.id)||source:source);
      const engine=calculationEngineLabel(ctx);
      actions.append(actionButton(key==='switchState'?'Kapat / servise al':'Servise al',()=>void ctx.setStatus(key,entity.id,true,source)),actionButton(key==='switchState'?'Aç / servis dışı':'Servis dışı',()=>void ctx.setStatus(key,entity.id,false,source)),actionButton(`Değiştir + Senaryo Full AC hesapla`,()=>void ctx.setStatus(key,entity.id,!active,source,true)),actionButton('Kaynağa dön',()=>void ctx.setStatus(key,entity.id,source,source)));
      }
      actions.append(actionButton('Haritada göster',()=>ctx.select(entity.id,entity.sourceClass,'map')));
    }
    if (actions.childElementCount) detail.append(actions);
  }
  function selectEquipment(id: string, sourceClass: string): void {
    const feeder=stationData?.graph.feeders.find(f=>sourceClass==='ElmBay'?f.id===id:f.equipmentKeys.includes(keyOf(sourceClass,id)));
    if(feeder&&scope!=='regional'){selectedBayId=feeder.id;scope='bay';}
    selected = { id, sourceClass }; ctx.select(id, sourceClass); renderDetail(); lastRenderKey = '';
    // Render immediately so the selected symbol is emphasized; the parent shell
    // may also call render after the context notification, which is deduplicated.
    void render();
  }
  function filteredFeeders(data:StationData):Feeder[]{const q=baySearch.value.toLocaleLowerCase('tr-TR');return data.graph.feeders.filter(f=>voltageMatches(f.voltageKv,ctx.filters.voltages)&&(!q||(f.name+' '+f.id).toLocaleLowerCase('tr-TR').includes(q))&&(!bayGroup.value||String(data.baysById.get(f.id)?.attributes.fold_id||'')===bayGroup.value));}
  function drawFeederPicker(data:StationData):void {
    const previousGroup=bayGroup.value;bayGroup.replaceChildren(new Option('Tüm fider grupları',''),...data.substats.map(g=>new Option(g.name,g.id)));bayGroup.value=previousGroup;
    const feeders=filteredFeeders(data);bayToolbar.hidden=scope!=='bay';
    bayPicker.replaceChildren(new Option('Fider / ekipman ayrıntısı seçin',''),...feeders.map(f=>new Option(f.name,f.id)));bayPicker.value=selectedBayId;
  }
  function makeDiagram(network: CanonicalNetwork, site: Site, data: StationData | null): SldDiagram {
    const index = networkIndex!;
    const groupsById = index.groupsBySite.get(site.id) || new Map<string, Bus[]>();
    const groups = [...groupsById.entries()].map(([id, buses]) => ({ id: id || site.id, name: data?.substatsById.get(id) || (id ? `Bara grubu · ${id}` : 'Baralar'), buses }));
    const equipment = equipmentForStation(index, site.id, ctx);
    const feeder=scope==='bay'?data?.graph.feeders.find(f=>f.id===selectedBayId):null;
    const switchRows=data?.switchesByBay.get(selectedBayId)||data?.switches.filter(sw=>feeder?.switchIds.includes(sw.id))||[];
    const switches=switchRows.map(row=>classifySwitch(row,index.switchesById,ctx));
    const selectedBay=feeder?(data?.baysById.get(feeder.id)||{id:feeder.id,name:feeder.name,siteIds:[site.id],attributes:{}}):null;
    const terminals = selectedBay && data ? createBayTerminals(index, data, selectedBay, switches, ctx) : [];
    const unresolvedSwitches = switches.filter(sw => !sw.from || !sw.to || !index.buses.has(sw.from) || !index.buses.has(sw.to)).length;
    const connectedSites = new Set<string>([site.id]);
    const adjacent = (index.equipmentBySite.get(site.id) || []).filter(item => ['ElmLne', 'ElmTr2'].includes(item.sourceClass))
      .filter(item => item.fromSiteId && item.toSiteId && item.fromSiteId !== item.toSiteId&&voltageMatches(item.voltageKv,ctx.filters.voltages));
    for (const item of adjacent) { connectedSites.add(item.fromSiteId!); connectedSites.add(item.toSiteId!); }
    const regionalSites = [...connectedSites].map(id => index.sites.get(id)).filter((x): x is Site => !!x)
      .sort((a, b) => a.id === site.id ? -1 : b.id === site.id ? 1 : a.name.localeCompare(b.name, 'tr'));
    const regionalSet = new Set(regionalSites.map(x => x.id));
    const regionalBranches = adjacent.filter(item => regionalSet.has(item.fromSiteId!) && regionalSet.has(item.toSiteId!))
      .map(item => ({ ...effectiveEquipment(item, index, ctx), fromSiteId: item.fromSiteId!, toSiteId: item.toSiteId! }));
    const bay=scope;
    const effectiveGroups = groups.map(group => ({ ...group, buses: group.buses.map(bus => ({ ...bus,
      inService: ctx.scenario.current.busOrTerminalStatus[bus.id] ?? (ctx.scenario.current.restoredTerminals.includes(bus.id) || bus.inService) })) }));
    const n1Detail=ctx.n1Detail?.candidate.candidateId===ctx.selectedN1CandidateId?ctx.n1Detail:null;
    return { scope: bay, orientation: layoutSelect.value === 'vertical' ? 'vertical' : 'horizontal', station: site, selectedId: selected?.id || null, groups: effectiveGroups, equipment,
      bays: data?.bays || [], selectedBay, terminals, switches, regionalSites, regionalBranches, unresolvedSwitches,graph:data?.graph||null,voltageBands:ctx.filters.voltages,page:bay==='regional'?regionalPage:0,technical:technical.checked,scenario:ctx.scenario.current,settings:ctx.settings.value,n1Detail,selectedN1IslandId:ctx.selectedN1IslandId };
  }
  function makeRenderKey(network: CanonicalNetwork | null, site: Site | null): string {
    return JSON.stringify([network?.modelHash || '', ctx.view, site?.id || '', scope, regionalPage, selectedBayId,
      selected?.sourceClass || '', selected?.id || '', scope==='bay'?layoutSelect.value:'vertical',technical.checked,[...ctx.filters.voltages],ctx.settings.value,effectiveSignature(),ctx.selectedN1CandidateId,ctx.selectedN1IslandId,ctx.n1DetailLoading]);
  }
  async function render(): Promise<void> {
    if (ctx.view !== 'sld') { request++; return; }
    session.render();
    const network = ensureNetwork();voltageFilter.render(); syncSites(network);
    if (!network || !networkIndex) {
      const key = makeRenderKey(null, null); if (key === lastRenderKey) return; lastRenderKey = key;
      lineBar.hidden = true; bayToolbar.hidden = true; regionalPager.hidden=true;layoutSelect.hidden=true;
      diagramHost.replaceChildren(element('p', 'ga-empty', 'Önce DGS JSON modelini yükleyin.'));
      detail.textContent = 'Bir bara, fider veya ekipman seçin.'; info.textContent = ''; return;
    }
    const contextSelection = ctx.selection ? keyOf(ctx.selection.sourceClass, ctx.selection.id) : '';
    const contextChanged=contextSelection!==lastContextSelection;
    if (contextChanged) { selected = ctx.selection ? { ...ctx.selection } : null; lastContextSelection = contextSelection;
      if(selected){const entity=networkIndex.entities.get(keyOf(selected.sourceClass,selected.id)),siteId=selected.sourceClass==='ElmSite'?selected.id:entity?.siteIds.includes(siteSelect.value)?siteSelect.value:entity?.siteIds[0];if(siteId){if(siteSelect.value!==siteId)selectedBayId='';siteSelect.value=siteId;}}
    }
    const site = currentSite();
    if (!site) { diagramHost.replaceChildren(element('p', 'ga-empty', 'Bu modelde trafo merkezi bulunamadı.')); return; }
    if(scope==='regional')syncLines(site);
    const key = makeRenderKey(network, site); if (key === lastRenderKey) return; lastRenderKey = key;
    const activeRequest = ++request;
    lineBar.hidden = scope!=='regional';
    layoutSelect.hidden = scope !== 'bay';
    const cacheKey = `${network.modelHash}|${site.id}`;
    let data: StationData | null = null;
    if (scope !== 'regional') {
      try {
        if(!stationCache.has(cacheKey)){diagramHost.replaceChildren(element('p','ga-muted','Şema kaynakları hazırlanıyor…'));info.textContent='';}
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
      if(contextChanged&&selected&&selected.sourceClass!=='ElmSite'){const feeder=data.graph.feeders.find(f=>selected!.sourceClass==='ElmBay'?f.id===selected!.id:f.equipmentKeys.includes(keyOf(selected!.sourceClass,selected!.id)));if(feeder){selectedBayId=feeder.id;scope='bay';}}
      if(scope==='bay'&&!data.graph.feeders.some(f=>f.id===selectedBayId&&voltageMatches(f.voltageKv,ctx.filters.voltages)))selectedBayId=filteredFeeders(data)[0]?.id||'';
      drawFeederPicker(data);
    } else { stationData = null; bayToolbar.hidden = true; }
    scopeSelect.value=scope;layoutSelect.hidden=scope!=='bay';
    const diagram = makeDiagram(network, site, data);
    regionalPager.hidden=scope!=='regional';
    if(scope==='regional'){
      const pages=Math.max(1,Math.ceil((diagram.regionalSites.length-1)/12));regionalPage=Math.min(regionalPage,pages-1);diagram.page=regionalPage;
      const prev=actionButton('← Önceki merkezler',()=>{regionalPage--;lastRenderKey='';void render();}),next=actionButton('Sonraki merkezler →',()=>{regionalPage++;lastRenderKey='';void render();});prev.disabled=regionalPage===0;next.disabled=regionalPage===pages-1;
      regionalPager.replaceChildren(prev,element('span','ga-muted',`${regionalPage+1}/${pages}`),next);
    }
    renderer.render(diagramHost, diagram, selectEquipment);
    if (scope === 'regional') info.textContent = `${diagram.regionalBranches.length} gerçek TM bağlantısı · ${diagram.regionalSites.length} merkez · sayfada en fazla 12 komşu. Paralel hatlar üstteki hat seçicisinden ayrı seçilebilir.`;
    else if (scope==='bay') info.textContent = `${diagram.terminals.length} gerçek terminal · ${diagram.switches.length} ElmCoup anahtarı · ${diagram.unresolvedSwitches} çözülemeyen uç. Senaryo durumları yerel çalışma kopyasındadır.`;
    else info.textContent = `${site.name} · ${data?.graph.busSections.length||0} bara bölümü · ${data?.bays.length||0} kaynak fider · ${data?.graph.terminals.length||0} terminal · yatay bara / dikey fider. Sürükle: kaydır · tekerlek: yakınlaştır.`;
    if(ctx.n1DetailLoading)info.textContent+=' · Seçili N-1 ayrıntısı hesaplanıyor…';
    else if(diagram.n1Detail)info.textContent+=` · N-1 kesinti: ${diagram.n1Detail.candidate.name} · ${diagram.n1Detail.outageIslands.length} ada · Kırmızı risk bandı >90%, sert limit aşımı >100%.`;
    renderDetail();
    lastRenderKey=makeRenderKey(network,site);
  }

  scopeSelect.addEventListener('change', () => { scope = scopeSelect.value as SldScope; regionalPage = 0; lastRenderKey = ''; void render(); });
  siteSelect.addEventListener('change', () => { selectedBayId = ''; regionalPage = 0;baySearch.value='';bayGroup.value=''; selected = null; ctx.selection = null; lastRenderKey = ''; void render(); });
  lineSelect.addEventListener('change', () => { const line=currentLine();if(line)selectEquipment(line.id,line.sourceClass);else{lastRenderKey = ''; void render();} });
  layoutSelect.addEventListener('change', () => { lastRenderKey = ''; void render(); });
  resetButton.addEventListener('click', () => { selected = null; ctx.selection = null; ctx.notify(); lastRenderKey = ''; void render(); });
  downloadButton.addEventListener('click', () => {
    const svg = diagramHost.querySelector('svg'); if (!svg) { ctx.setMessage('Önce SVG şeması oluşturulmalıdır.'); return; }
    const xml = renderer.exportSvg();if(!xml)return;
    const site = currentSite(); downloadText(xml, `YTBS_SLD_${site?.id || 'TM'}.svg`, 'image/svg+xml;charset=utf-8');
  });
  const unsubscribe = () => {};
  if (ctx.view === 'sld') void render();
  return { element: root, render: () => { void render(); }, dispose: unsubscribe };
}
