import {workspaceTableViewport} from '../../ui/components/workspace-table-viewport';
import {operatingValues} from './operating-values';
import {createColumnSelector,createRecordDialog} from '../../ui/components/workspace-columns';
import {workspaceCatalogColumns,workspaceRowValues,type WorkspaceColumn} from '../../ui/components/workspace-catalog';
import {operatingEvidence} from './operating-evidence';
import {catalogLayout} from '../../ui/components/catalog-layout';
import {activeResultId} from '../../domain/results/workspace';
import {voltageMatches} from '../../domain/model/voltage-band';
import {createVoltageFilter} from '../../ui/components/voltage-filter';
import {engineeringColumns,semanticTable,semanticDetail,catalogCsv,exportSelect} from '../../ui/components/semantic-catalog';
import type { AppContext, Feature, CatalogRow } from '../../app/contracts';
import type { TaggedCatalogRow } from '../catalog';
import { csvCell, downloadText, element, format } from '../../ui/components/dom';
import { fetchCatalogAll, fetchMergedPage, type CatalogFilter } from '../catalog';

interface OperatingKind { id: string; label: string; classes: readonly string[]; fields: readonly string[] }
const kinds: readonly OperatingKind[] = [
  { id: 'production', label: 'Üretim P/Q', classes: ['ElmSym', 'ElmGenStat'], fields: ['cCategory', 'pgini', 'qgini', 'Pmin_uc', 'Pmax_uc', 'usetp', 'outserv'] },
  { id: 'load', label: 'Tüketim P/Q', classes: ['ElmLod'], fields: ['plini', 'qlini', 'outserv'] },
  { id: 'tap', label: 'Trafo kademesi', classes: ['ElmTr2'], fields: ['nntap', 'strn', 'outserv'] },
  { id: 'switch', label: 'Anahtar pozisyonu', classes: ['ElmCoup','StaSwitch'], fields: ['on_off', 'aUsage', 'outserv'] },
  { id: 'line', label: 'Hat servis durumu', classes: ['ElmLne'], fields: ['outserv', 'bus1', 'bus2'] },
  { id: 'shunt', label: 'Şönt durumu', classes: ['ElmShnt'], fields: ['ncapa', 'qrean', 'qcapn', 'outserv'] },
  { id: 'voltage', label: 'Ünite gerilim ayarı', classes: ['ElmSym', 'ElmGenStat'], fields: ['usetp', 'pgini', 'qgini', 'outserv'] },
];
export function createOperatingView(ctx: AppContext, workspaceOptions:{sharedScope?:boolean}={}): Feature {
  const root = element('section', 'ga-feature ga-operating-view');
  const heading = element('div', 'ga-feature-heading');
  heading.append(element('h2', '', 'İşletme verileri'), element('p', 'ga-muted', 'Saatlik DGS model girdileri ve konfigürasyon değerleri.'));
  const toolbar = element('div', 'ga-toolbar');
  const kindsBar = element('div', 'ga-tabs');
  const area = element('select'); area.setAttribute('aria-label', 'YTM');
  const site = element('select'); site.setAttribute('aria-label', 'Trafo merkezi');
  const voltageFilter=createVoltageFilter(ctx,'İşletme gerilim grupları');
  const search = element('input'); search.type = 'search'; search.placeholder = 'Ünite / ekipman adı veya FID';
  const csv=exportSelect();
  toolbar.append(area, site, search, csv);
  const sort=element('select');sort.setAttribute('aria-label','Katalog sıralaması');sort.append(new Option('Ada göre','name'),new Option('FID sırası','FID'));const descending=element('input');descending.type='checkbox';const orderLabel=element('label','ga-check');orderLabel.append(descending,document.createTextNode('Azalan'));const sizeSelect=element('select');sizeSelect.setAttribute('aria-label','Sayfa boyutu');for(const size of [20,40,80,100])sizeSelect.append(new Option(String(size)+' / sayfa',String(size)));toolbar.append(sort,orderLabel,sizeSelect);
  if(workspaceOptions.sharedScope){area.remove();site.remove();search.remove();voltageFilter.element.hidden=true;}
  const notice = element('p', 'ga-notice', 'Bu değerler DGS anlık durumuna ait işletme girdileridir; hesap sonucu veya ölçüm değildir.');
  const status = element('p', 'ga-muted');
  const tableWrap = element('div', 'ga-table-wrap');
  const pager = element('div', 'ga-pager');const fitTable=workspaceTableViewport(tableWrap);
  const recordDialog=createRecordDialog(root,'Ekipman ayrıntısı'),detail=recordDialog.detail;
  let tableRows:readonly TaggedCatalogRow[]=[],tableAttributes:readonly string[]=[];const columnSelector=createColumnSelector(()=>redrawTable());toolbar.append(columnSelector.element);
  const columnsFor=()=>{const cls=kind.classes[0];const values=operatingValues(ctx),extra:WorkspaceColumn[]=[{key:'operating.source',label:'Kaynak DGS',value:r=>values(r,(r as TaggedCatalogRow).className||cls).source},{key:'operating.scenario',label:'Aktif senaryo',value:r=>values(r,(r as TaggedCatalogRow).className||cls).scenario},{key:'operating.lf',label:'Güncel LF',value:r=>values(r,(r as TaggedCatalogRow).className||cls).lf}];const def=workspaceCatalogColumns(cls,tableAttributes,extra);columnSelector.set(cls,def.columns,def.profiles);return columnSelector.visible(def.columns);};
  function redrawTable(){if(!tableRows.length)return;tableWrap.replaceChildren(semanticTable(tableRows,kind.classes[0],columnsFor(),row=>{showDetail({...row,className:row.className||kind.classes[0]});tableWrap.querySelectorAll('tr[data-id]').forEach(tr=>tr.classList.toggle('ga-selected',(tr as HTMLElement).dataset.id===row.id));},false,row=>rowActions(row)));fitTable();}
  function rowActions(row:CatalogRow&{className?:string}){const actions=element('div','ga-inline-actions'),cls=row.className||kind.classes[0];for(const [label,view]of [['Harita','map'],['SLD','sld']] as const){const b=element('button','',label);b.onclick=e=>{e.stopPropagation();ctx.select(row.id,cls,view);};actions.append(b);}const source=element('button','','Kaynak');source.onclick=e=>{e.stopPropagation();showDetail({...row,className:cls});recordDialog.show();};actions.prepend(source);const edit=element('button','','Düzenle');edit.disabled=ctx.busy;edit.onclick=e=>{e.stopPropagation();showDetail({...row,className:cls});recordDialog.show();};actions.append(edit);return actions;}
  root.append(heading,kindsBar,toolbar,voltageFilter.element,notice,status,...(workspaceOptions.sharedScope?[catalogLayout(tableWrap,pager)]:[tableWrap,pager]));

  let kind = kinds[0], page = 0, selected: TaggedCatalogRow | null = null, requestId = 0, lastModelHash = '';
  let filterModelHash = '', siteOptionsKey = '', kindDrawn = '', lastQueryKey = '', pendingQueryKey = '';
  const pageSizeNow = () => Math.max(10, Math.min(100, Math.floor(ctx.settings.value.pageSize || 20)));
  let lastFilterKey='',lastContextSelection='',lastDetailContext='';
  function options(select: HTMLSelectElement, values: readonly { value: string; label: string }[], first: string): void {
    const old = select.value; select.replaceChildren(new Option(first, ''), ...values.map(v => new Option(v.label, v.value)));
    if (values.some(v => v.value === old)) select.value = old;
  }
  function filter(): CatalogFilter {
    return { areaId: area.value || undefined, siteId: site.value || undefined,
      voltageBands: [...ctx.filters.voltages], search: search.value.trim() || undefined, sort: sort.value||'name', descending:descending.checked };
  }
  function fillFilters(net: NonNullable<AppContext['network']> | null): void {
    if (!net) return;
    if (filterModelHash !== net.modelHash) {
      filterModelHash = net.modelHash; siteOptionsKey = '';
      const areas = [...new Map(net.sites.map(s => [s.areaId, s.areaName || s.areaId] as const).filter(([id]) => Boolean(id)))];
      options(area, areas.map(([value, label]) => ({ value, label })), 'Bütün YTM’ler');

    }
    if(workspaceOptions.sharedScope){area.value=ctx.filters.areaId;search.value=ctx.filters.search;}sizeSelect.value=String(pageSizeNow());
    voltageFilter.render();const selectedArea=area.value,selectedVoltage=[...ctx.filters.voltages].sort().join(',');
    const key = `${net.modelHash}|${selectedArea}|${selectedVoltage ?? ''}`; if (siteOptionsKey === key) return; siteOptionsKey = key;
    const sites = net.sites.filter(s => (!selectedArea || s.areaId === selectedArea) && (s.voltages.length?s.voltages.some(v=>voltageMatches(v,ctx.filters.voltages)):voltageMatches(null,ctx.filters.voltages)))
      .sort((a, b) => a.name.localeCompare(b.name, 'tr'));
    options(site, sites.map(s => ({ value: s.id, label: s.name })), 'Bütün TM’ler');
  }
  function renderKinds(): void {
    kindsBar.replaceChildren(...kinds.map(item => {
      const b = element('button', item.id === kind.id ? 'ga-tab ga-tab-active' : 'ga-tab', item.label);
      b.type = 'button'; b.addEventListener('click', () => { kind = item; page = 0; selected = null; void render(); }); return b;
    }));
  }
  function showDetail(row: TaggedCatalogRow): void {
    const networkAtOpen=ctx.network,scenarioAtOpen=ctx.scenario.current;selected=row;detail.dataset.selectedFid=row.id;semanticDetail(detail,row,row.className||kind.classes[0]);
    const jump = element('button', 'ga-button', 'Haritada göster'); jump.type = 'button';
    const sourceClass = row.className || kind.classes.find(c => ctx.network?.classCounts[c] !== undefined) || kind.classes[0];
    jump.addEventListener('click', () => ctx.select(row.id, sourceClass, 'map')); detail.append(jump);
    detail.append(operatingEvidence(ctx,row,sourceClass));const sld=element('button','ga-button','Tek hat şeması');sld.onclick=()=>ctx.select(row.id,sourceClass,'sld');detail.append(sld);if(ctx.selection?.id!==row.id||ctx.selection?.sourceClass!==sourceClass){lastContextSelection=(ctx.network?.modelHash??'')+'|'+sourceClass+'|'+row.id;ctx.select(row.id,sourceClass);}
    const cls=sourceClass,collection=cls==='ElmLne'?ctx.network?.lines:cls==='ElmTr2'?ctx.network?.transformers:['ElmCoup','StaSwitch'].includes(cls)?ctx.network?.switches:null,entity=collection?.find(e=>e.id===row.id||e.sourceId===row.id);
    if(entity){const key=cls==='ElmLne'?'lineStatus':cls==='ElmTr2'?'transformerStatus':'switchState',source='closed' in entity?entity.closed:entity.inService,active=ctx.scenario.current[key][entity.id]??source;
      for(const [label,calculate] of [[active?'Aç / servis dışı':'Kapat / servise al',false],['Değiştir + Senaryo Full AC hesapla',true]] as const){const action=element('button','ga-button',label);action.disabled=ctx.busy;action.onclick=()=>{if(ctx.network!==networkAtOpen||ctx.scenario.current!==scenarioAtOpen){ctx.setMessage('İşlem kapsamı değişti; kaydı yeniden açın.');return;}void ctx.setStatus(key,entity.id,!active,source,calculate);};detail.append(action);}}

  }
  function drawRows(rows: readonly TaggedCatalogRow[], attributes: readonly string[]): void {
    if (!rows.length) { tableWrap.replaceChildren(element('p', 'ga-empty', 'Filtreye uygun kayıt bulunamadı.')); return; }
    tableRows=rows;tableAttributes=attributes;redrawTable();
  }

  async function render(): Promise<void> {root.dataset.scenarioId=ctx.scenario.selectedId;root.dataset.resultId=activeResultId(ctx)??'NOT_RUN';
    if (ctx.view !== 'operating') { recordDialog.close();requestId++; pendingQueryKey=''; return; }
    const focus=ctx.selection,focusKey=(ctx.network?.modelHash??'')+'|'+(focus?focus.sourceClass+'|'+focus.id:'');if(focus&&focusKey!==lastContextSelection){lastContextSelection=focusKey;const matched=kinds.find(k=>k.classes.includes(focus.sourceClass));if(matched){kind=matched;if(!workspaceOptions.sharedScope)search.value=focus.id;page=0;}}
    const network = ctx.network; fillFilters(network);if(workspaceOptions.sharedScope)site.value=ctx.filters.siteId;
    if (kindDrawn !== kind.id) { renderKinds(); kindDrawn = kind.id; }

    if (!network) { tableRows=[];recordDialog.close();lastModelHash = ''; filterModelHash = ''; siteOptionsKey = ''; lastQueryKey = ''; pendingQueryKey = ''; selected = null; status.textContent = 'Model bekleniyor.'; tableWrap.replaceChildren(element('p', 'ga-empty', 'Önce DGS JSON modelini yükleyin.')); pager.replaceChildren(); detail.textContent = 'Ayrıntı için bir ekipman seçin.'; return; }
    if (lastModelHash !== network.modelHash) { selected = null; lastQueryKey = ''; pendingQueryKey = ''; detail.textContent = 'Ayrıntı için bir ekipman seçin.'; lastModelHash = network.modelHash; }
    const filters = filter(), size = pageSizeNow();
    const filterKey=JSON.stringify([network.modelHash,kind.id,filters,size]);if(filterKey!==lastFilterKey){page=0;lastFilterKey=filterKey;}
    const queryKey = JSON.stringify([network.modelHash, kind.id, filters, page, size]);
    if(queryKey===lastQueryKey){const detailKey=ctx.scenario.revision+'|'+activeResultId(ctx)+'|'+ctx.busy;if(detailKey!==lastDetailContext){lastDetailContext=detailKey;if(selected)showDetail(selected);redrawTable();}return;}if(queryKey===pendingQueryKey)return;
    const request = ++requestId;
    pendingQueryKey = queryKey;recordDialog.close();tableRows=[];tableWrap.replaceChildren(element('p','ga-empty','Kapsam yükleniyor…'));pager.replaceChildren();detail.textContent='Kapsamdaki bir ekipmanı seçin.';
    try {
      const result = await fetchMergedPage(ctx,kind.classes,filters,page,size,()=>request===requestId&&ctx.view==='operating'&&ctx.network===network);
      if (request !== requestId || ctx.view !== 'operating' || ctx.network?.modelHash !== network.modelHash) return;
      const pages = Math.max(1, Math.ceil(result.total / size)); page = Math.max(0, Math.min(page, pages - 1));
      drawRows(result.rows, result.attributes);const focused=result.rows.find(r=>r.id===ctx.selection?.id&&r.className===ctx.selection.sourceClass);if(focused)showDetail(focused);
      status.textContent = `${kind.label} · ${format(result.total, 0)} eşleşen kayıt · ${network.name} · DGS model girdisi / konfigürasyon`;
      const prev = element('button', 'ga-button', '← Önceki'); prev.type = 'button'; prev.disabled = page === 0;
      const next = element('button', 'ga-button', 'Sonraki →'); next.type = 'button'; next.disabled = page >= pages - 1;
      prev.addEventListener('click', () => { page--; void render(); }); next.addEventListener('click', () => { page++; void render(); });
      pager.replaceChildren(prev, element('span', 'ga-muted', `${format(result.total, 0)} kayıt · ${page + 1}/${pages}`), next);
      lastQueryKey = queryKey;
    } catch (error) {
      if (request !== requestId) return;
      tableWrap.replaceChildren(element('p', 'ga-notice ga-notice-error', `İşletme verileri alınamadı: ${error instanceof Error ? error.message : String(error)}`)); pager.replaceChildren();
    } finally { if (pendingQueryKey === queryKey) pendingQueryKey = ''; }
  }
  for (const control of [site]) control.addEventListener('change', () => { page = 0; selected = null; void render(); });
  area.addEventListener('change', () => { site.value = ''; page = 0; selected = null; void render(); });
  search.addEventListener('input', () => { page = 0; selected = null; void render(); });
  csv.addEventListener('change', async () => {
    if(!csv.value)return;const technical=csv.value==='raw';
    if (!ctx.network) return;
    csv.disabled = true;
    try {
      const network=ctx.network,exportKind=kind,key=JSON.stringify(filter()),current=()=>ctx.network===network&&ctx.view==='operating'&&kind===exportKind&&JSON.stringify(filter())===key;const results=[];for(const className of exportKind.classes)results.push(await fetchCatalogAll(ctx,className,filter(),100,current));if(!current())return;
      const attributes=[...new Set(results.flatMap(result=>result.attributes))];
      const rows=results.flatMap((result,i)=>result.rows.map(row=>({...row,className:exportKind.classes[i]})));
      if(csv.value==='json'){downloadText(JSON.stringify({modelHash:network.modelHash,filters:filter(),scenarioId:ctx.scenario.selectedId,rows:rows.map(row=>({...row,operating:operatingValues(ctx)(row,row.className)}))},null,2),`GridAnalyzer_${exportKind.id}_isletme.json`,'application/json');return;}const exportColumns=columnsFor();const text=technical?catalogCsv(rows,exportKind.classes[0],attributes,true,[]):'\ufeff'+[exportColumns.map(c=>c.label),...rows.map(r=>workspaceRowValues(r,exportColumns))].map(r=>r.map(csvCell).join(';')).join('\r\n');
      downloadText(text, `GridAnalyzer_${exportKind.id}_isletme.csv`, 'text/csv;charset=utf-8');
    } catch (error) { ctx.setMessage(`CSV oluşturulamadı: ${error instanceof Error ? error.message : String(error)}`); }
    finally { csv.disabled = false; csv.value=''; }
  });

  sort.onchange=()=>{page=0;void render();};descending.onchange=sort.onchange;sizeSelect.onchange=()=>{ctx.settings.update({pageSize:Number(sizeSelect.value)});page=0;ctx.notify();void render();};
  if (ctx.view === 'operating') void render();
  return { element: root, render: () => { void render(); } };
}
