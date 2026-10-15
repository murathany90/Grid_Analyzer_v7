import {activeResultId} from '../../domain/results/workspace';
import {createWorkspaceResults} from '../analysis/workspace-results';
import {buildStationTopologyGraph,type StationTopologyGraph,type Feeder} from '../../domain/model/station-topology';
import {voltageMatches} from '../../domain/model/voltage-band';
import {createVoltageFilter} from '../../ui/components/voltage-filter';
import type { AppContext, CatalogRow, Feature } from '../../app/contracts';
import type { Bus, CanonicalNetwork, Entity, Line, Site, Switch, Transformer2W } from '../../domain/model/network';
import type { StatusKey } from '../../domain/scenario/overlay';
import { downloadText, element } from '../../ui/components/dom';
import { fetchCatalogAll } from '../catalog';
import { SvgSldRenderer, type SldDiagram, type SldEquipment, type SldRegionalBranch, type SldSwitch, type SldTerminal } from './sld-renderer';
import {calculationEngineLabel,calculationSessionStatus} from '../../ui/components/calculation-controls';
import {createSldResultOverlay,type SldMode} from './result-overlay';
import {oppositeStation,SldNavigationHistory} from './navigation';
import {selectedN1Presentation} from '../../map/layer-policy';
import {sourceSwitchKind} from '../../domain/model/switch-usage';
import {feederOperation,feederCommandIds} from './feeder-operation';
import {downloadDiagramPng} from './png-export';

interface NetworkIndex {
  network: CanonicalNetwork;
  buses: Map<string, Bus>;
  sites: Map<string, Site>;
  entities: Map<string, Entity>;
  equipmentById: Map<string, SldEquipment[]>;
  equipmentBySite: Map<string, SldEquipment[]>;
  switchesById: Map<string, Switch>;
  groupsBySite: Map<string, Map<string, Bus[]>>;
}
interface StationData {
  graph: StationTopologyGraph;
  bays: CatalogRow[]; terminals: CatalogRow[]; cubicles: CatalogRow[]; switches: CatalogRow[]; substats: CatalogRow[];
  rawByKey: Map<string, CatalogRow>; substatsById: Map<string, string>;
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
  const busIds = 'from' in entity && 'to' in entity
    ? [String(entity.from), String(entity.to)].filter(Boolean)
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
  const equipmentById = new Map<string, SldEquipment[]>(), equipmentBySite = new Map<string, SldEquipment[]>();
  const switchesById = new Map(network.switches.map(sw => [sw.id, sw]));
  const scenario = ctx.scenario.current;
  const records: SldEquipment[] = [];
  for (const group of modelEntityLists(network)) for (const entity of group) {
    entities.set(keyOf(entity.sourceClass, entity.id), entity);
    if (entity.sourceClass === 'ElmSite' || entity.sourceClass === 'ElmTerm' || entity.sourceClass === 'ElmStactrl' || entity.sourceClass === 'ElmSecctrl' || entity.sourceClass === 'ElmBoundary') continue;
    const record = equipmentRecord(entity, network, buses, scenario); records.push(record);
    const sameId = equipmentById.get(record.id) || []; sameId.push(record); equipmentById.set(record.id, sameId);
    for (const siteId of record.siteIds) { const connected = equipmentBySite.get(siteId) || []; connected.push(record); equipmentBySite.set(siteId, connected); }
  }
  const groupsBySite = new Map<string, Map<string, Bus[]>>();
  for (const bus of network.buses) for (const siteId of bus.siteIds) {
    let groups = groupsBySite.get(siteId); if (!groups) groupsBySite.set(siteId, groups = new Map());
    const groupId = bus.parentId || '';
    let group = groups.get(groupId); if (!group) groups.set(groupId, group = []); group.push(bus);
  }
  return { network, buses, sites, entities, equipmentById, equipmentBySite, switchesById, groupsBySite };
}

async function fetchStationData(ctx: AppContext, network: CanonicalNetwork, site: Site): Promise<StationData> {
  const classes = ['ElmBay', 'ElmTerm', 'StaCubic', 'ElmCoup', 'ElmSubstat', 'StaSwitch', 'ElmTr3', 'ElmTr2', 'ElmSind'] as const;
  const results = await Promise.all(classes.map(async className => network.classCounts[className]
    ? (await fetchCatalogAll(ctx, className, { siteId: site.id })).rows : []));
  const [bays, terminals, cubicles, couplers, substats, stationSwitches,threeWinding,twoWinding,seriesReactors] = results;const switches=[...couplers,...stationSwitches];
  const unsupportedEquipment=[...threeWinding.map(r=>({...r,sourceClass:'ElmTr3'})),...twoWinding.filter(r=>!network.transformers.some(t=>t.id===r.id&&network.buses.some(b=>b.id===t.from)&&network.buses.some(b=>b.id===t.to))).map(r=>({...r,sourceClass:'ElmTr2'}))];
  const rawByKey = new Map<string, CatalogRow>();
  classes.forEach((className, index) => results[index].forEach(row => rawByKey.set(keyOf(className, row.id), row)));
  return { graph:buildStationTopologyGraph(network,site.id,{bays,terminals,cubicles,switches,substats,unsupportedEquipment,transformers:twoWinding,seriesReactors,sourceEvidenceComplete:true}),bays, terminals, cubicles, switches, substats, rawByKey, substatsById: new Map(substats.map(row => [row.id, row.name || row.id])) };
}

function equipmentForStation(index: NetworkIndex, siteId: string, ctx: AppContext): SldEquipment[] {
  const records = index.equipmentBySite.get(siteId) || [];
  return records.map(item => effectiveEquipment(item, index, ctx));
}

export function createSldView(ctx: AppContext): Feature {
  const root = element('section', 'ga-feature ga-sld-view');
  const session=calculationSessionStatus(ctx);
  root.setAttribute('aria-label','Tek hat şeması');
  const toolbar = element('div', 'ga-toolbar ga-sld-toolbar');
  const siteSelect = element('select'); siteSelect.setAttribute('aria-label', 'Trafo merkezi');
  const areaSelect=element('select');areaSelect.setAttribute('aria-label','SLD YTM filtresi');areaSelect.title='YTM seçimi trafo merkezi listesini süzer.';
  const voltageFilter=createVoltageFilter(ctx,'SLD gerilim grupları');
  const downloadButton = element('button', 'ga-button', 'SVG indir'); downloadButton.type = 'button';
  const mode=element('select'),colorMode=element('select');mode.setAttribute('aria-label','SLD görünüm modu');colorMode.setAttribute('aria-label','SLD renk temeli');
  for(const [value,label]of [['ytbs','YTBS klasik'],['technical','Teknik tek hat'],['LF','Güç akışı'],['N1','N-1 analiz'],['SC','Kısa devre sonuç'],['operation','Bara / anahtar işletme'],['compact','Kompakt görünüm']])mode.append(new Option(label,value));
  colorMode.append(new Option('Gerilim renkleri','voltage'),new Option('İşletme durum renkleri','state'));
  colorMode.title='Gerilim rengi anma kV sınıfını gösterir; enerjilenme kanıtı değildir. Anahtar konumu, servis durumu, senaryo ve analiz alarmı ayrı katmanlardır.';
  const resultsToggle=element('input'),arrowsToggle=element('input');resultsToggle.type=arrowsToggle.type='checkbox';resultsToggle.checked=arrowsToggle.checked=true;
  resultsToggle.setAttribute('aria-label','Sonuç etiketleri');arrowsToggle.setAttribute('aria-label','Akış okları');
  const resultsLabel=element('label','ga-check','Değer'),arrowsLabel=element('label','ga-check','Akış');resultsLabel.append(resultsToggle);arrowsLabel.append(arrowsToggle);
  const resetButton = element('button', 'ga-button', 'Seçimi temizle'); resetButton.type = 'button';
  toolbar.append(areaSelect,siteSelect,mode);
  const feederMenu=element('details','ga-sld-feeder-menu'),feederSummary=element('summary','','Fider manevrası'),feederCommands=element('div','ga-sld-feeder-commands');feederSummary.setAttribute('aria-label','Fider manevrası');feederMenu.append(feederSummary,feederCommands);feederMenu.hidden=true;
  const feederButton=actionButton('Fider manevrası',()=>{setPanel(true);feederMenu.open=!feederMenu.open;});feederButton.hidden=true;
  const sourceNotice = 'Kaynak model bağlantıları, otomatik yerleşim. Senaryo işlemleri yalnız yerel model kopyasını etkiler; fiziksel işletme komutu gönderilmez.';
  const bayPicker=element('select');bayPicker.setAttribute('aria-label','Fider seç');
  const info = element('p', 'ga-muted ga-sld-status');info.title=sourceNotice;
  const diagramHost = element('div', 'ga-sld-diagram');
  const workspace=element('div','ga-sld-workspace'),canvasPane=element('div','ga-sld-canvas'),sidePanel=element('aside','ga-sld-side-panel');sidePanel.hidden=true;sidePanel.setAttribute('aria-label','Ekipman bilgisi ve analiz sonuçları');
  canvasPane.append(diagramHost);workspace.append(canvasPane,sidePanel);
  const quickSwitch=element('section','ga-sld-quick-switch');quickSwitch.setAttribute('role','region');quickSwitch.setAttribute('aria-label','Hızlı manevra');quickSwitch.hidden=true;
  const detail = element('section', 'ga-detail', 'Bir bara, fider veya ekipman seçin.');
  const shared=createWorkspaceResults(ctx),resultPanel=element('details','ga-sld-results'),resultSummary=element('summary','','Analiz sonucu');resultPanel.append(resultSummary,shared.element);resultPanel.ontoggle=()=>{if(resultPanel.open)shared.render();};
  const panelToggle=actionButton('Bilgi ve sonuçlar',()=>setPanel(sidePanel.hasAttribute('hidden')));panelToggle.setAttribute('aria-expanded','false');
  const panelClose=actionButton('Paneli kapat',()=>setPanel(false));
  sidePanel.append(panelClose,feederMenu,detail,resultPanel,session.element);
  const drawingAudit=element('details','ga-sld-drawing-audit');drawingAudit.setAttribute('aria-label','SLD kaynak çizim denetimi');
  sidePanel.append(drawingAudit);root.append(toolbar,workspace,info);

  let selectedBayId = '';
  const scope = 'station' as const;
  let networkIndex: NetworkIndex | null = null, networkHash = '', siteOptionsHash = '', stationData: StationData | null = null;
  let request = 0, lastRenderKey = '', selected: { id: string; sourceClass: string } | null = null;
  let lastContextSelection = '';
  let resultRevision=0,lastResultRefs:unknown[]=[];
  let detailTab='Genel';
  const stationCache = new Map<string, StationData>();
  const equipmentSourceCache=new Map<string,CatalogRow>();
  const renderer = new SvgSldRenderer();
  const history=new SldNavigationHistory(),back=actionButton('Önceki TM’ye dön',()=>{const previous=history.back();if(!previous)return;navigateSite(previous.siteId);selectedBayId=previous.bayId;selected={id:previous.lineId,sourceClass:'ElmLne'};ctx.selection={...selected};lastContextSelection=keyOf('ElmLne',previous.lineId);lastRenderKey='';ctx.notify();void render();});back.disabled=true;toolbar.append(back);
  const redraw=()=>{lastRenderKey='';void render();};
  const familyMetrics:Partial<Record<'LF'|'N1'|'SC',string>>={},defaultMetrics={LF:'pFromMw',N1:'postLoadingPercent',SC:'ikssKa'};
  mode.onchange=()=>{if(['LF','N1','SC'].includes(mode.value)){const family=mode.value as 'LF'|'N1'|'SC';if(family!==ctx.resultView.analysis){familyMetrics[ctx.resultView.analysis]=ctx.resultView.metric;ctx.resultView.analysis=family;ctx.resultView.metric=familyMetrics[family]??defaultMetrics[family];ctx.resultView.source='GA';ctx.benchmarkMap=null;if(family==='LF'){ctx.resultStore.role=ctx.scenario.selectedId==='B0'?'base':'scenario';ctx.resultView.phase=ctx.resultStore.role==='base'?'BASE':'POST';}else ctx.resultView.phase='POST';}}ctx.notify();redraw();};colorMode.onchange=resultsToggle.onchange=arrowsToggle.onchange=redraw;
  function compactButton(label:string,short:string,run:()=>void):HTMLButtonElement {const button=actionButton(short,run);button.setAttribute('aria-label',label);button.title=label;return button;}
  back.textContent='←';back.setAttribute('aria-label','Önceki TM’ye dön');back.title='Önceki TM’ye dön';
  toolbar.append(compactButton('Okunabilir ölçek','Detay',()=>renderer.readable()),actionButton('Sığdır',()=>renderer.fit()),compactButton('Yakınlaştır +','+',()=>renderer.zoom(1.3)),compactButton('Uzaklaştır −','−',()=>renderer.zoom(1/1.3)),compactButton('Seçili ekipmana odaklan','Odak',()=>{if(selected)renderer.focus(selected.id,selected.sourceClass);}));
  downloadButton.textContent='SVG';
  downloadButton.setAttribute('aria-label','SVG indir');downloadButton.title='Tam istasyon SVG indir';
  const pngButton=actionButton('PNG',()=>{void exportPng();});pngButton.setAttribute('aria-label','PNG indir');pngButton.title='Tam istasyon PNG indir (2×, güvenli boyut sınırı)';
  toolbar.prepend(areaSelect,siteSelect,mode);
  toolbar.insertBefore(voltageFilter.element,back);toolbar.insertBefore(colorMode,back);toolbar.insertBefore(resultsLabel,back);toolbar.insertBefore(arrowsLabel,back);toolbar.insertBefore(bayPicker,back);
  toolbar.append(downloadButton,pngButton,feederButton,panelToggle);
  let expanded=false,resizeFrame=0;
  function sizeWorkspace():void {root.style.height=(expanded?innerHeight:Math.max(240,innerHeight-Math.max(0,root.getBoundingClientRect().top)-(document.querySelector('.ga-footer')?.getBoundingClientRect().height??8)-12))+'px';}
  function setPanel(open:boolean):void {sidePanel.hidden=!open;panelToggle.setAttribute('aria-expanded',String(open));resize();}
  const fullscreen=actionButton('Tam ekran',()=>{void (async()=>{if(document.fullscreenElement===root){await document.exitFullscreen();return;}if(expanded){expanded=false;root.classList.remove('ga-sld-expanded');fullscreen.textContent='Tam ekran';resize();return;}try{await root.requestFullscreen();}catch{expanded=true;root.classList.add('ga-sld-expanded');fullscreen.textContent='Tam ekrandan çık';resize();}})();});toolbar.append(fullscreen);
  const fullscreenChange=()=>{expanded=document.fullscreenElement===root;fullscreen.textContent=expanded?'Tam ekrandan çık':'Tam ekran';resize();};
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&expanded&&!document.fullscreenElement){expanded=false;root.classList.remove('ga-sld-expanded');fullscreen.textContent='Tam ekran';resize();}};
  const resize=()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>{sizeWorkspace();redraw();});};
  window.addEventListener('resize',resize);document.addEventListener('fullscreenchange',fullscreenChange);window.addEventListener('keydown',escape);
  feederMenu.ontoggle=()=>{if(feederMenu.open)quickSwitch.hidden=true;else renderDetail();};
  resizeFrame=requestAnimationFrame(()=>{sizeWorkspace();redraw();});
  bayPicker.onchange=()=>focusFeeder(bayPicker.value);
  function focusFeeder(id:string):void {const feeder=stationData?.graph.feeders.find(f=>f.id===id);if(!feeder)return;selectedBayId=id;selectEquipment(feeder.sourceClass==='ElmBay'?id:id.slice(id.indexOf('|')+1),feeder.sourceClass);void render().then(()=>renderer.focusFeeder(id));}
  async function exportPng():Promise<void> {const xml=renderer.exportSvg();if(!xml){ctx.setMessage('Önce SVG şeması oluşturulmalıdır.');return;}pngButton.disabled=true;try{await downloadDiagramPng(xml,`YTBS_SLD_${currentSite()?.id??'TM'}.png`,message=>ctx.setMessage(message));}catch(error){ctx.setMessage(`PNG indirilemedi: ${error instanceof Error?error.message:String(error)}`);}finally{pngButton.disabled=false;}}

  function effectiveSignature(): string { return JSON.stringify(ctx.scenario.current); }
  function ensureNetwork(): CanonicalNetwork | null {
    const network = ctx.network, hash = network?.modelHash || '';
    if (hash !== networkHash) {
      networkHash = hash; networkIndex = network ? buildNetworkIndex(network, ctx) : null;
      stationCache.clear(); stationData = null; selectedBayId = ''; selected = null; lastContextSelection = '';
      equipmentSourceCache.clear();
      history.clear();
      siteOptionsHash = '';
    }
    return network;
  }
  function syncSites(network: CanonicalNetwork | null): void {
    const hash = (network?.modelHash || '')+'|'+[...ctx.filters.voltages].sort().join(',')+'|'+areaSelect.value;
    if (siteOptionsHash === hash) return;
    siteOptionsHash = hash;
    if (!network) { siteSelect.replaceChildren(new Option('Model bekleniyor', '')); return; }
    const previous = siteSelect.value,area=areaSelect.value,areas=[...new Map(network.sites.map(s=>[s.areaId,s.areaName||s.areaId])).entries()].sort((a,b)=>a[1].localeCompare(b[1],'tr'));
    areaSelect.replaceChildren(new Option('Tüm YTM’ler',''),...areas.filter(([id])=>id).map(([id,name])=>new Option(name,id)));areaSelect.value=area;
    siteSelect.replaceChildren(...network.sites.filter(site=>(!area||site.areaId===area)&&(!site.voltages.length||site.voltages.some(v=>voltageMatches(v,ctx.filters.voltages)))).slice().sort((a, b) => a.name.localeCompare(b.name, 'tr'))
      .map(site => new Option(site.name, site.id)));
    siteSelect.value = [...siteSelect.options].some(o=>o.value===previous)?previous:siteSelect.options[0]?.value||'';
  }
  function navigateSite(id:string):void {const site=networkIndex?.sites.get(id);if(areaSelect.value&&site?.areaId!==areaSelect.value){areaSelect.value=site?.areaId??'';siteOptionsHash='';syncSites(ctx.network);}siteSelect.value=id;}
  function currentSite(): Site | null { return networkIndex?.sites.get(siteSelect.value) || null; }
  function findEntity(id: string, sourceClass: string): Entity | undefined { return networkIndex?.entities.get(keyOf(sourceClass, id)); }
  function findRaw(id: string, sourceClass: string): CatalogRow | undefined { return stationData?.rawByKey.get(keyOf(sourceClass, id))??equipmentSourceCache.get(keyOf(sourceClass,id)); }
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
    renderFeederCommands();
    quickSwitch.replaceChildren();quickSwitch.hidden=true;
    if (!selected) { detail.textContent = 'Bir bara, fider veya ekipman seçin.'; return; }
    const entity = findEntity(selected.id, selected.sourceClass), raw = findRaw(selected.id, selected.sourceClass);
    const equipment = networkIndex?.equipmentById.get(selected.id)?.find(item => item.sourceClass === selected?.sourceClass);
    const name = entity?.name || raw?.name || equipment?.name || selected.id;
    detail.replaceChildren(element('h3', '', name), element('p', 'ga-muted', `${selected.sourceClass} · ${selected.id}`));
    const tabs=element('div','ga-sld-detail-tabs');tabs.setAttribute('role','tablist');const panels=element('div','ga-sld-detail-panels');detail.append(tabs,panels);
    const sections=new Map<string,HTMLElement>();
    for(const label of ['Genel','Elektriksel','Sonuçlar','Kaynak ve kalite','İşlemler']){const panel=element('section');panel.setAttribute('role','tabpanel');panel.hidden=label!==detailTab;sections.set(label,panel);panels.append(panel);const tab=actionButton(label,()=>{detailTab=label;for(const [name,p]of sections)p.hidden=name!==label;for(const b of tabs.querySelectorAll('button'))b.setAttribute('aria-selected',String(b===tab));});tab.setAttribute('role','tab');tab.setAttribute('aria-selected',String(label===detailTab));tabs.append(tab);}
    const general=sections.get('Genel')!,electrical=sections.get('Elektriksel')!,quality=sections.get('Kaynak ve kalite')!,results=sections.get('Sonuçlar')!;
    addAttributes(general,{FID:selected.id,Sınıf:selected.sourceClass,TM:currentSite()?.name??'—',YTM:currentSite()?.areaName??'—',İşletme:equipment?.inService===false?'Servis dışı':equipment?.closed===false?'Açık':equipment?.inService?'Serviste':'—',Terminaller:equipment?.busIds??(entity&&'bus'in entity?[entity.bus]:[])});
    if(entity){const canonical:Record<string,unknown>={};for(const [key,value]of Object.entries(entity))if(!['sourceRefs','sourceId','sourceClass','siteIds','coordinates','name','id'].includes(key))canonical[key]=value;electrical.append(element('p','ga-muted','Kanonik model değerleri; kaynak dönüşümleri ve baz bilgisi aşağıdadır.'));addAttributes(electrical,canonical);quality.append(element('h4','','Kaynak alanları'));if(entity.sourceRefs)addAttributes(quality,entity.sourceRefs);else quality.append(element('p','ga-muted','SOURCE_UNAVAILABLE · kaynak alan izleri bu kayıtta yok.'));}
    if(raw){quality.append(element('h4','','Ham DGS alanları · birimler yalnız kaynakta doğrulanır'));addAttributes(quality,raw.attributes);}else quality.append(element('p','ga-muted','Ham kaynak ayrıntıları yükleniyor veya mevcut değil.'));
    const overlay=createSldResultOverlay(ctx,mode.value as SldMode),entry=overlay.entries.get(keyOf(selected.sourceClass,selected.id));results.append(element('p','ga-result-context',`${overlay.phase} · ${entry?.status??overlay.status} · ${entry?.method??overlay.method}`));if(entry)addAttributes(results,entry.values);else results.append(element('p','ga-muted','— · Bu ekipman için güncel sayısal sonuç yok.'));
    const issues=stationData?.graph.issues.filter(i=>i.sourceId===selected!.id)??[];if(issues.length)addAttributes(quality,{KaynakSorunları:issues});
    const sourceAudit=stationData?.graph.sourceAudit,leaves=sourceAudit?.leaves.filter(l=>l.terminalId===selected!.id||l.switchIds.includes(selected!.id)||l.windings.some(w=>w.transformerId===selected!.id))??[],windings=sourceAudit?.windings.filter(w=>w.transformerId===selected!.id)??[];if(leaves.length){general.append(element('p','ga-muted',`${leaves.length} kaynak yaprağı · ${leaves.every(l=>l.status==='SOURCE_LEAF_VERIFIED')?'Ham DGS ile doğrulandı; saha bağlantısı türetilmedi.':'Kaynak kanıtı eksik veya eşleme uyuşmazlığı var.'}`));addAttributes(quality,{KaynakYaprakları:leaves});}if(windings.length)addAttributes(quality,{SargıUçKanıtı:windings});
    if(entity?.sourceClass==='ElmTr2'){const t=entity as Transformer2W;quality.append(element('p','ga-muted',`İki sargı kanonik model · ${raw?.attributes.i_auto===1?'OTOTRANSFORMATÖR · DGS i_auto=1 (belge s.61)':raw?.attributes.i_auto===0?'İki sargılı · DGS i_auto=0':'UNVERIFIED_TYPE · i_auto kanıtı yok'} · faz ${t.sourceRefs?.phase?.map(r=>r.field).join(',')??'—'} · tap ${t.tapResolution??'—'}`));const type=raw?findRaw(String(raw.attributes.typ_id??''),'TypTr2'):null;if(type){electrical.append(element('h4','','Ham TypTr2 · anma gerilimleri işletme barasından farklı olabilir'));addAttributes(electrical,type.attributes);}}
    const actions=element('div','ga-actions');actions.append(resetButton);
    if(entity){const key:StatusKey|null=entity.sourceClass==='ElmLne'?'lineStatus':entity.sourceClass==='ElmTr2'?'transformerStatus':entity.sourceClass==='ElmTerm'?'busOrTerminalStatus':['ElmCoup','StaSwitch'].includes(entity.sourceClass)?'switchState':null;
      if(key){const source=key==='switchState'?(entity as Switch).closed:entity.inService,active=ctx.scenario.current[key][entity.id]??(key==='busOrTerminalStatus'?ctx.scenario.current.restoredTerminals.includes(entity.id)||source:source);
      if(key==='switchState'&&!feederMenu.open){
        quickSwitch.hidden=false;quickSwitch.dataset.switchId=entity.id;quickSwitch.append(element('strong','',`${name} · ${entity.id} · ${active?'Kapalı':'Açık'}`),element('p','ga-muted','Yerel senaryo simülasyonu'));
        quickSwitch.title='Yalnız yerel senaryo değişir; fiziksel işletme komutu gönderilmez. Kapalı konum enerjilenme kanıtı değildir.';
        const buttons=element('div','ga-actions');buttons.append(actionButton('Aç',()=>void ctx.setStatus(key,entity.id,false,source)),actionButton('Kapat',()=>void ctx.setStatus(key,entity.id,true,source)),actionButton('Değiştir + Senaryo Full AC hesapla',()=>void ctx.setStatus(key,entity.id,!active,source,true)),actionButton('Kaynağa dön',()=>void ctx.setStatus(key,entity.id,source,source)),actionButton('Manevra kartını kapat',()=>{quickSwitch.hidden=true;renderer.focus(entity.id,entity.sourceClass);}));
        for(const button of buttons.querySelectorAll('button'))button.disabled=ctx.busy;quickSwitch.append(buttons);quickSwitch.onkeydown=e=>{if(e.key==='Escape'){quickSwitch.hidden=true;renderer.focus(entity.id,entity.sourceClass);}};canvasPane.append(quickSwitch);
      }
      actions.append(actionButton(key==='switchState'?'Senaryoda kapat':'Senaryoda servise al',()=>void ctx.setStatus(key,entity.id,true,source)),actionButton(key==='switchState'?'Senaryoda aç':'Senaryoda servis dışı',()=>void ctx.setStatus(key,entity.id,false,source)),actionButton(`Değiştir + Senaryo Full AC hesapla`,()=>void ctx.setStatus(key,entity.id,!active,source,true)),actionButton('Kaynağa dön',()=>void ctx.setStatus(key,entity.id,source,source)));
      }
      actions.append(actionButton('Haritada göster',()=>ctx.select(entity.id,entity.sourceClass,'map')));
      actions.append(actionButton('Envanterde göster',()=>ctx.select(entity.id,entity.sourceClass,'inventory')),actionButton('Analizlerde göster',()=>{ctx.select(entity.id,entity.sourceClass);ctx.setView('analysis:'+ctx.resultView.analysis);}));
      if(entity.sourceClass==='ElmLne'&&ctx.network){const target=oppositeStation(ctx.network,entity.id,siteSelect.value);if(target)actions.append(actionButton('Karşı TM: '+target.site.name,()=>{history.push({siteId:siteSelect.value,lineId:entity.id,scope,bayId:selectedBayId});navigateSite(target.site.id);selectedBayId='';lastContextSelection=keyOf(entity.sourceClass,entity.id);ctx.select(entity.id,entity.sourceClass);lastRenderKey='';void render();}));}
    }
    const feeders=stationData?.graph.feeders.filter(f=>f.equipmentKeys.includes(keyOf(selected!.sourceClass,selected!.id))||f.switchIds.includes(selected!.id)||f.terminalIds.includes(selected!.id))??[];
    for(const f of feeders)actions.append(actionButton('Fider: '+f.name,()=>{selectedBayId=f.id;focusFeeder(f.id);}));
    if(entity?.sourceClass==='ElmTr2'&&equipment?.busIds.length===2)actions.append(actionButton('Diğer sargıyı göster',()=>{selectedBayId='';lastRenderKey='';void render().then(()=>renderer.focus(equipment.busIds[1],'ElmTerm'));}));
    if (actions.childElementCount) sections.get('İşlemler')!.append(element('p','ga-muted','Yerel senaryo simülasyonu; fiziksel işletme komutu gönderilmez.'),actions);
  }
  function renderFeederCommands():void {
    const graph=stationData?.graph,feeder=graph?.feeders.find(f=>f.id===selectedBayId||selected&&(f.switchIds.includes(selected.id)||f.equipmentKeys.includes(keyOf(selected.sourceClass,selected.id))));feederMenu.hidden=feederButton.hidden=!feeder;
    if(!graph||!feeder)return;const effective=new Map(graph.switches.flatMap(s=>{const native=networkIndex?.switchesById.get(s.id);return native?[[s.id,{closed:ctx.scenario.current.switchState[s.id]??native.closed,inService:native.inService}] as const]:[];})),plan=feederOperation(graph,feeder,effective);feederCommands.replaceChildren(element('strong','',feeder.name));feederCommands.dataset.feederId=feeder.id;
    feederCommands.title='Yalnız kanıtlı ana devre işletilir. Alternatif bara ve bypass cihazları korunur. Yerel senaryo simülasyonu.';
    feederCommands.append(element('p','ga-muted',plan.ready?plan.switches.map(s=>`${s.kind==='breaker'?'Kesici':'Ayırıcı'} ${s.id}: ${(ctx.scenario.current.switchState[s.id]??networkIndex?.switchesById.get(s.id)?.closed)?'Kapalı':'Açık'}`).join(' · '):plan.reason??'—'));
    const commands=element('div','ga-actions');for(const [label,value]of [['Fider Aç',false],['Fider Kapat',true],['Fider kaynağa dön','source']] as const){const button=actionButton(label,()=>void ctx.setFeederStatus(feederCommandIds(plan,value,networkIndex!.switchesById),value));button.disabled=!plan.ready||ctx.busy||plan.switches.some(s=>!networkIndex?.switchesById.get(s.id)?.inService);if(!plan.ready)button.title=plan.reason??'UNKNOWN';commands.append(button);}
    const calculate=actionButton('Senaryo Full AC hesapla',()=>void ctx.run('powerFlow','scenario'));calculate.disabled=ctx.busy;commands.append(calculate);feederCommands.append(commands);
  }
  function selectEquipment(id: string, sourceClass: string): void {
    if(mode.value==='SC'&&sourceClass==='ElmTerm')ctx.resultView.faultId=networkIndex?.buses.get(id)?.sourceId??id;
    if(selected?.id!==id||selected.sourceClass!==sourceClass)detailTab='Genel';
    const feeder=stationData?.graph.feeders.find(f=>sourceClass==='ElmBay'?f.id===id:f.equipmentKeys.includes(keyOf(sourceClass,id)));
    if(feeder)selectedBayId=feeder.id;
    selected = { id, sourceClass }; setPanel(true);ctx.select(id, sourceClass); renderDetail(); lastRenderKey = '';
    // Render immediately so the selected symbol is emphasized; the parent shell
    // may also call render after the context notification, which is deduplicated.
    void render();
    const sourceModelHash=ctx.network?.modelHash;
    if(!findRaw(id,sourceClass)&&ctx.network?.classCounts[sourceClass])void fetchCatalogAll(ctx,sourceClass,{search:id}).then(async page=>{const row=page.rows.find(r=>r.id===id);if(!row||ctx.network?.modelHash!==sourceModelHash)return;equipmentSourceCache.set(keyOf(sourceClass,id),row);const typeId=String(row.attributes.typ_id??'');if(typeId&&sourceClass==='ElmTr2'&&!findRaw(typeId,'TypTr2')){const types=await fetchCatalogAll(ctx,'TypTr2',{search:typeId});if(ctx.network?.modelHash!==sourceModelHash)return;const type=types.rows.find(r=>r.id===typeId);if(type)equipmentSourceCache.set(keyOf('TypTr2',typeId),type);}if(selected?.id===id&&selected.sourceClass===sourceClass)renderDetail();}).catch(()=>{});
  }
  function drawFeederPicker(data:StationData):void {const feeders=data.graph.feeders.filter(f=>voltageMatches(f.voltageKv,ctx.filters.voltages));bayPicker.replaceChildren(new Option('Fider seç / odaklan',''),...feeders.map(f=>new Option(f.name,f.id)));bayPicker.value=selectedBayId;}
  function makeDiagram(network: CanonicalNetwork, site: Site, data: StationData | null): SldDiagram {
    const index = networkIndex!;
    const groupsById = index.groupsBySite.get(site.id) || new Map<string, Bus[]>();
    const groups = [...groupsById.entries()].map(([id, buses]) => ({ id: id || site.id, name: data?.substatsById.get(id) || (id ? `Bara grubu · ${id}` : 'Baralar'), buses }));
    const equipment = equipmentForStation(index, site.id, ctx);
    for(const item of data?.graph.equipment??[])if(item.sourceClass==='ElmTr3'||!equipment.some(e=>e.sourceClass===item.sourceClass&&e.id===item.id)){const raw=data?.rawByKey.get(keyOf(item.sourceClass,item.id));equipment.push({id:item.id,name:item.name,sourceClass:item.sourceClass,busIds:item.terminals,siteIds:[site.id],inService:raw?!bool(raw.attributes.outserv):false,voltageKv:index.buses.get(item.terminals[0])?.vnKv,lvKv:index.buses.get(item.terminals.at(-1)??'')?.vnKv});}
    const selectedBay=null,terminals: SldTerminal[]=[],switches:SldSwitch[]=[],regionalSites:Site[]=[],regionalBranches:SldRegionalBranch[]=[],unresolvedSwitches=0;
    const effectiveGroups = groups.map(group => ({ ...group, buses: group.buses.map(bus => ({ ...bus,
      inService: ctx.scenario.current.busOrTerminalStatus[bus.id] ?? (ctx.scenario.current.restoredTerminals.includes(bus.id) || bus.inService) })) }));
    const candidate=mode.value==='N1'?selectedN1Presentation(ctx).candidate:null,n1Detail=candidate&&ctx.n1Detail?.candidate.candidateId===candidate.candidateId?ctx.n1Detail:null;
    return { scope:'station',orientation:'vertical', station: site, selectedId: selected?.id || null, groups: effectiveGroups, equipment,
      bays: data?.bays || [], selectedBay, terminals, switches, regionalSites, regionalBranches, unresolvedSwitches,graph:data?.graph||null,voltageBands:ctx.filters.voltages,page:0,technical:mode.value==='technical',scenario:ctx.scenario.current,settings:ctx.settings.value,n1Detail,selectedN1IslandId:ctx.selectedN1IslandId,mode:mode.value as SldMode,overlay:createSldResultOverlay(ctx,mode.value as SldMode),showResults:resultsToggle.checked,showArrows:arrowsToggle.checked,colorMode:colorMode.value as 'voltage'|'state' };
  }
  function makeRenderKey(network: CanonicalNetwork | null, site: Site | null): string {
    const refs=[ctx.resultStore.active,ctx.hybridResult,ctx.scResult,ctx.scContext,ctx.n1AcResults,ctx.n1Result];if(refs.some((r,i)=>r!==lastResultRefs[i])){resultRevision++;lastResultRefs=refs;}
    return JSON.stringify([network?.modelHash || '', ctx.view, site?.id || '', selectedBayId,
      selected?.sourceClass || '', selected?.id || '', [...ctx.filters.voltages],ctx.settings.value,effectiveSignature(),ctx.selectedN1CandidateId,ctx.selectedN1IslandId,ctx.n1DetailLoading,mode.value,colorMode.value,resultsToggle.checked,arrowsToggle.checked,resultRevision,ctx.resultView,ctx.analysisSettings.value,ctx.resultStore.role,ctx.powerFactoryControlContextHash]);
  }
  async function render(): Promise<void> {
    if (ctx.view !== 'sld') { request++; return; }
    resultSummary.textContent=`Analiz sonucu · ${ctx.resultView.analysis} · ${ctx.resultView.source} · ${activeResultId(ctx)??'NOT_RUN / STALE'}`;if(resultPanel.open)shared.render();
    session.render();
    const network = ensureNetwork();voltageFilter.render(); syncSites(network);
    if (!network || !networkIndex) {
      const key = makeRenderKey(null, null); if (key === lastRenderKey) return; lastRenderKey = key;
      diagramHost.replaceChildren(element('p', 'ga-empty', 'Önce DGS JSON modelini yükleyin.'));
      detail.textContent = 'Bir bara, fider veya ekipman seçin.'; info.textContent = ''; return;
    }
    const contextSelection = ctx.selection ? keyOf(ctx.selection.sourceClass, ctx.selection.id) : '';
    const contextChanged=contextSelection!==lastContextSelection;
    if (contextChanged) { selected = ctx.selection ? { ...ctx.selection } : null; lastContextSelection = contextSelection;
      if(selected){const entity=networkIndex.entities.get(keyOf(selected.sourceClass,selected.id)),siteId=selected.sourceClass==='ElmSite'?selected.id:entity?.siteIds.includes(siteSelect.value)?siteSelect.value:entity?.siteIds[0];if(siteId){if(siteSelect.value!==siteId)selectedBayId='';navigateSite(siteId);}}
    }
    const site = currentSite();
    if (!site) { diagramHost.replaceChildren(element('p', 'ga-empty', 'Bu modelde trafo merkezi bulunamadı.')); return; }
    const key = makeRenderKey(network, site); if (key === lastRenderKey) return; lastRenderKey = key;
    const activeRequest = ++request;
    const cacheKey = `${network.modelHash}|${site.id}`;
    let data: StationData | null = null;
    {
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
      if(contextChanged&&selected&&selected.sourceClass!=='ElmSite'){const feeder=data.graph.feeders.find(f=>selected!.sourceClass==='ElmBay'?f.id===selected!.id:f.equipmentKeys.includes(keyOf(selected!.sourceClass,selected!.id)));if(feeder)selectedBayId=feeder.id;}
      if(!data.graph.feeders.some(f=>f.id===selectedBayId&&voltageMatches(f.voltageKv,ctx.filters.voltages)))selectedBayId='';
      drawFeederPicker(data);
    }
    const diagram = makeDiagram(network, site, data);
    diagram.lod='overview';diagram.onFocusFeeder=focusFeeder;
    diagram.onNavigateSite=(id,lineId)=>{history.push({siteId:siteSelect.value,lineId:lineId??'',scope,bayId:selectedBayId});navigateSite(id);selectedBayId='';selected=null;ctx.selection=null;lastRenderKey='';void render();};
    renderer.render(diagramHost, diagram, selectEquipment);
    back.disabled=history.length===0;
    root.dataset.sldUnresolved=String(data?.graph.counters.diagramUnresolvedTotal??0);root.dataset.sldMode=mode.value;
    info.textContent=`${site.name} · ${data?.graph.busSections.length??0} bara · ${data?.graph.feeders.length??0} fider · ${data?.graph.terminals.length??0} terminal`;
    if(ctx.n1DetailLoading)info.textContent+=' · Seçili N-1 ayrıntısı hesaplanıyor…';
    else if(diagram.n1Detail)info.textContent+=` · N-1 kesinti: ${diagram.n1Detail.candidate.name} · ${diagram.n1Detail.outageIslands.length} ada · Kırmızı risk bandı >90%, sert limit aşımı >100%.`;
    drawingAudit.replaceChildren();const decisions=data?.graph.sourceAudit?.switchDrawing??[],listed=decisions.filter(r=>r.classification!=='DRAW_VERIFIED_PATH');drawingAudit.append(element('summary','',`SLD kaynak denetimi · ${listed.filter(r=>r.classification==='HIDE_NONFUNCTIONAL_SOURCE_LEAF').length} gizlenen · ${listed.filter(r=>r.classification==='REVIEW_UNRESOLVED').length} incelenecek`));for(const row of listed){const item=element('details'),summary=element('summary','',`${row.sourceClass} ${row.switchId} · ${row.from} ↔ ${row.to} · ${row.classification}`);item.append(summary,element('p','',row.reason),element('pre','',row.evidence));drawingAudit.append(item);}
    info.textContent+=` · ${ctx.scenario.selectedId} · ${calculationEngineLabel(ctx)} · ${diagram.overlay?.status??'NOT_RUN'}`;
    info.title=info.textContent+' · '+sourceNotice;
    renderDetail();
    lastRenderKey=makeRenderKey(network,site);
  }

  siteSelect.addEventListener('change',()=>{selectedBayId='';selected=null;ctx.selection=null;redraw();});
  areaSelect.onchange=()=>{siteOptionsHash='';selected=null;ctx.selection=null;selectedBayId='';redraw();};
  resetButton.addEventListener('click', () => { selected = null; ctx.selection = null; ctx.notify(); lastRenderKey = ''; void render(); });
  downloadButton.addEventListener('click', () => {
    const svg = diagramHost.querySelector('svg'); if (!svg) { ctx.setMessage('Önce SVG şeması oluşturulmalıdır.'); return; }
    const xml = renderer.exportSvg();if(!xml)return;
    const site = currentSite(); downloadText(xml, `YTBS_SLD_${site?.id || 'TM'}.svg`, 'image/svg+xml;charset=utf-8');
  });
  const unsubscribe = () => {window.removeEventListener('resize',resize);document.removeEventListener('fullscreenchange',fullscreenChange);window.removeEventListener('keydown',escape);cancelAnimationFrame(resizeFrame);};
  if (ctx.view === 'sld') void render();
  return { element: root, render: () => { void render(); }, dispose: unsubscribe };
}
