import {measurementSpec} from '../../domain/dgs-semantics/measurement-format';
import {workspaceTableViewport} from '../../ui/components/workspace-table-viewport';
import {createColumnSelector,createRecordDialog} from '../../ui/components/workspace-columns';
import {workspaceCatalogColumns,workspaceRowValues,type WorkspaceColumn} from '../../ui/components/workspace-catalog';
import {catalogLayout} from '../../ui/components/catalog-layout';
import {classLabel} from '../../domain/dgs-semantics/classes';
import {voltageMatches} from '../../domain/model/voltage-band';
import {createVoltageFilter} from '../../ui/components/voltage-filter';
import {engineeringColumns,semanticTable,semanticDetail,catalogCsv,exportSelect} from '../../ui/components/semantic-catalog';
import type { AppContext, CatalogPage, CatalogRow, Feature } from '../../app/contracts';
import { csvCell, downloadText, element, format } from '../../ui/components/dom';
import { fetchCatalogAll, type CatalogFilter } from '../catalog';


export function createInventoryView(ctx: AppContext, options:{sharedScope?:boolean}={}): Feature {
  const root = element('section', 'ga-feature ga-inventory-view');
  const heading = element('div', 'ga-feature-heading');
  heading.append(element('h2', '', 'Şebeke envanteri'), element('p', 'ga-muted', 'Sabit karakteristikler, kaynak alanları ve ekipman ilişkileri.'));
  const toolbar = element('div', 'ga-toolbar');
  const classSelect = element('select'); classSelect.setAttribute('aria-label', 'Envanter sınıfı');
  const areaSelect = element('select'); areaSelect.setAttribute('aria-label', 'YTM');
  const siteSelect = element('select'); siteSelect.setAttribute('aria-label', 'Trafo merkezi');
  const voltageFilter=createVoltageFilter(ctx,'Envanter gerilim grupları');
  const search = element('input'); search.type = 'search'; search.placeholder = 'Ad veya FID ile ara'; search.setAttribute('aria-label', 'Ad veya FID ile ara');
  const exportButton=exportSelect();
  toolbar.append(classSelect, areaSelect, siteSelect, search, exportButton);
  const sort=element('select');sort.setAttribute('aria-label','Katalog sıralaması');sort.append(new Option('Ada göre','name'),new Option('FID sırası','FID'));const descending=element('input');descending.type='checkbox';const orderLabel=element('label','ga-check');orderLabel.append(descending,document.createTextNode('Azalan'));const sizeSelect=element('select');sizeSelect.setAttribute('aria-label','Sayfa boyutu');for(const size of [20,40,80,100])sizeSelect.append(new Option(String(size)+' / sayfa',String(size)));toolbar.append(sort,orderLabel,sizeSelect);
  if(options.sharedScope){areaSelect.remove();siteSelect.remove();search.remove();voltageFilter.element.hidden=true;}
  const count = element('p', 'ga-muted', 'Model bekleniyor.');
  const tableWrap = element('div', 'ga-table-wrap');
  const pager = element('div', 'ga-pager');const fitTable=workspaceTableViewport(tableWrap);
  const recordDialog=createRecordDialog(root,'Ekipman ayrıntısı'),detail=recordDialog.detail;
  let tableRows:readonly CatalogRow[]=[],tableAttributes:readonly string[]=[];const columnSelector=createColumnSelector(()=>redrawTable());toolbar.append(columnSelector.element);
  const columnsFor=()=>{const cls=currentClass();const extra:WorkspaceColumn[]=[];const def=workspaceCatalogColumns(cls,tableAttributes,extra);columnSelector.set(cls,def.columns,def.profiles);return columnSelector.visible(def.columns);};
  function redrawTable(){if(!tableRows.length)return;tableWrap.replaceChildren(semanticTable(tableRows,currentClass(),columnsFor(),row=>{showDetail(row);tableWrap.querySelectorAll('tr[data-id]').forEach(tr=>tr.classList.toggle('ga-selected',(tr as HTMLElement).dataset.id===row.id));},columnSelector.technical,row=>rowActions(row),{key:sort.value||'name',descending:descending.checked,change:sortHeader}));fitTable();}
  function sortHeader(key:string){if(![...sort.options].some(o=>o.value===key))sort.append(new Option(columnsFor().find(c=>c.key===key)?.label??key,key));descending.checked=sort.value===key?!descending.checked:false;sort.value=key;page=0;void render();}
  function rowActions(row:CatalogRow&{className?:string}){const actions=element('div','ga-inline-actions'),cls=currentClass();for(const [label,view]of [['Harita','map'],['SLD','sld']] as const){const b=element('button','',label);b.onclick=e=>{e.stopPropagation();ctx.select(row.id,cls,view);};actions.append(b);}const source=element('button','','Kaynak');source.onclick=e=>{e.stopPropagation();showDetail(row);recordDialog.show();};actions.prepend(source);return actions;}
  root.append(heading,toolbar,voltageFilter.element,count,...(options.sharedScope?[catalogLayout(tableWrap,pager)]:[tableWrap,pager]));

  let page = 0, selected: CatalogRow | null = null, revision = 0, lastModelHash = '', optionModelHash = '', siteOptionsKey = '', lastQueryKey = '', pendingQueryKey = '',lastContextSelection='';
  const pageSizeNow = () => Math.max(10, Math.min(100, Math.floor(ctx.settings.value.pageSize || 20)));
  let lastFilterKey='';
  const currentClass = () => classSelect.value || 'ElmSite';
  const makeFilter = (): CatalogFilter => ({
    search: search.value.trim() || undefined,
    areaId: areaSelect.value || undefined,
    siteId: siteSelect.value || undefined,
    voltageBands: [...ctx.filters.voltages],
    sort: sort.value||'name', descending: descending.checked,sortKind:measurementSpec(sort.value)?'number':['FID','name','equipment'].includes(sort.value)||sort.value.startsWith('hierarchy.')?'text':'auto',
  });

  function fillSelect(select: HTMLSelectElement, options: readonly { value: string; label: string }[], first: string): void {
    const before = select.value;
    select.replaceChildren(new Option(first, ''), ...options.map(o => new Option(o.label, o.value)));
    if (options.some(o => o.value === before)) select.value = before;
  }

  function syncOptions(): void {
    const network = ctx.network;
    if (!network) return;
    if (optionModelHash !== network.modelHash) {
      optionModelHash = network.modelHash; siteOptionsKey = '';
      const classNames = Object.keys(network.classCounts).sort((a, b) => classLabel(a).localeCompare(classLabel(b), 'tr'));
      fillSelect(classSelect, classNames.map(value => ({ value, label: classLabel(value) })), 'Envanter');
      if(ctx.networkInventoryClass&&classNames.includes(ctx.networkInventoryClass))classSelect.value=ctx.networkInventoryClass;
      if (!classSelect.value && classNames.length) classSelect.value = classNames.includes('ElmSite') ? 'ElmSite' : classNames[0];
      const areas = [...new Map(network.sites.map(s => [s.areaId, s.areaName || s.areaId] as const).filter(([id]) => Boolean(id)))];
      fillSelect(areaSelect, areas.map(([value, label]) => ({ value, label })), 'Bütün YTM’ler');

    }
    if(options.sharedScope){areaSelect.value=ctx.filters.areaId;search.value=ctx.filters.search;const requested=ctx.networkInventoryClass;if(requested&&classSelect.value!==requested&&[...classSelect.options].some(o=>o.value===requested)){classSelect.value=requested;page=0;lastContextSelection=network.modelHash+'|'+(ctx.selection?ctx.selection.sourceClass+'|'+ctx.selection.id:'');}}sizeSelect.value=String(pageSizeNow());
    voltageFilter.render();const area=areaSelect.value,selectedVoltage=[...ctx.filters.voltages].sort().join(',');
    const key = `${network.modelHash}|${area}|${selectedVoltage ?? ''}`; if (key === siteOptionsKey) return; siteOptionsKey = key;
    const sites = network.sites.filter(s => (!area || s.areaId === area) && (s.voltages.length?s.voltages.some(v=>voltageMatches(v,ctx.filters.voltages)):voltageMatches(null,ctx.filters.voltages)))
      .sort((a, b) => a.name.localeCompare(b.name, 'tr'));
    fillSelect(siteSelect, sites.map(s => ({ value: s.id, label: s.name })), 'Bütün TM’ler');
  }

  function showDetail(row: CatalogRow): void {
    selected = row;
    semanticDetail(detail,row,currentClass());detail.dataset.selectedFid=row.id;if(ctx.selection?.id!==row.id||ctx.selection?.sourceClass!==currentClass()){lastContextSelection=(ctx.network?.modelHash??'')+'|'+currentClass()+'|'+row.id;ctx.select(row.id,currentClass());}
    const actions = element('div', 'ga-actions');
    for (const [label, view] of [['Haritada göster', 'map'], ['Tek hat şeması', 'sld']] as const) {
      const b = element('button', 'ga-button', label); b.type = 'button';
      b.addEventListener('click', () => ctx.select(row.id, currentClass(), view)); actions.append(b);
    }
    detail.append(actions);
  }

  function renderTable(result: CatalogPage): void {
    if (!result.rows.length) { tableWrap.replaceChildren(element('p', 'ga-empty', 'Filtreye uygun kayıt bulunamadı.')); return; }
    tableRows=result.rows;tableAttributes=result.attributes;redrawTable();
  }

  function renderPager(total: number, size: number): void {
    const pages = Math.max(1, Math.ceil(total / size)); page = Math.max(0, Math.min(page, pages - 1));
    const previous = element('button', 'ga-button', '← Önceki'); previous.type = 'button'; previous.disabled = page === 0;
    const next = element('button', 'ga-button', 'Sonraki →'); next.type = 'button'; next.disabled = page >= pages - 1;
    previous.addEventListener('click', () => { page--; void render(); }); next.addEventListener('click', () => { page++; void render(); });
    pager.replaceChildren(previous, element('span', 'ga-muted', `${format(total, 0)} kayıt · ${page + 1}/${pages}`), next);
  }

  async function render(): Promise<void> {
    if (ctx.view !== 'inventory') { recordDialog.close();revision++; pendingQueryKey=''; return; }
    syncOptions();if(options.sharedScope)siteSelect.value=ctx.filters.siteId;
    const focus=ctx.selection,focusKey=(ctx.network?.modelHash??'')+'|'+(focus?focus.sourceClass+'|'+focus.id:'');
    if(focus&&focusKey!==lastContextSelection&&[...classSelect.options].some(o=>o.value===focus.sourceClass)){lastContextSelection=focusKey;classSelect.value=focus.sourceClass;ctx.networkInventoryClass=focus.sourceClass;if(!options.sharedScope){search.value=focus.id;areaSelect.value='';siteSelect.value='';}page=0;}

    const network = ctx.network;
    if (!network) { tableRows=[];recordDialog.close();lastModelHash = ''; optionModelHash = ''; siteOptionsKey = ''; lastQueryKey = ''; pendingQueryKey = ''; selected = null; count.textContent = 'Model bekleniyor.'; tableWrap.replaceChildren(element('p', 'ga-empty', 'Önce DGS JSON modelini yükleyin.')); pager.replaceChildren(); detail.textContent = 'Ayrıntı için bir ekipman seçin.'; return; }
    if (lastModelHash !== network.modelHash) { selected = null; lastQueryKey = ''; pendingQueryKey = ''; detail.textContent = 'Ayrıntı için bir ekipman seçin.'; lastModelHash = network.modelHash; }
    const size = pageSizeNow(), filter = makeFilter(), className = currentClass();
    const filterKey=JSON.stringify([network.modelHash,className,filter,size]);if(filterKey!==lastFilterKey){page=0;lastFilterKey=filterKey;}
    const queryKey = JSON.stringify([network.modelHash, className, filter, page, size]);
    if (queryKey === lastQueryKey || queryKey === pendingQueryKey) return;
    const request = ++revision;
    pendingQueryKey = queryKey;recordDialog.close();tableRows=[];tableWrap.replaceChildren(element('p','ga-empty','Kapsam yükleniyor…'));pager.replaceChildren();detail.textContent='Kapsamdaki bir ekipmanı seçin.';
    try {
      const result = await ctx.catalog({ ...filter, className, page, pageSize: size });
      if (request !== revision || ctx.view !== 'inventory' || ctx.network?.modelHash !== network.modelHash) return;
      renderTable(result); renderPager(result.total, size);
      const focused=result.rows.find(r=>r.id===ctx.selection?.id&&currentClass()===ctx.selection.sourceClass);if(focused)showDetail(focused);
      count.textContent = `${classLabel(className)} · ${format(result.total, 0)} kayıt`;
      lastQueryKey = queryKey;
    } catch (error) {
      if (request !== revision) return;
      tableWrap.replaceChildren(element('p', 'ga-notice ga-notice-error', `Envanter yüklenemedi: ${error instanceof Error ? error.message : String(error)}`));
      pager.replaceChildren();
    } finally { if (pendingQueryKey === queryKey) pendingQueryKey = ''; }
  }

  for (const control of [classSelect, siteSelect]) control.addEventListener('change', () => {if(control===classSelect)ctx.networkInventoryClass=classSelect.value; page = 0; selected = null; void render(); });
  areaSelect.addEventListener('change', () => { siteSelect.value = ''; page = 0; selected = null; void render(); });
  search.addEventListener('input', () => { page = 0; selected = null; void render(); });
  exportButton.addEventListener('change', async () => {
    if(!exportButton.value)return;const technical=exportButton.value==='raw';
    if (!ctx.network) return;
    exportButton.disabled = true;
    try {
      const network=ctx.network,cls=currentClass(),filter=makeFilter(),key=JSON.stringify(filter),current=()=>ctx.network===network&&ctx.view==='inventory'&&currentClass()===cls&&JSON.stringify(makeFilter())===key;const result = await fetchCatalogAll(ctx,cls,filter,100,current);if(!current())return;
      if(exportButton.value==='json'){downloadText(JSON.stringify({modelHash:network.modelHash,sourceClass:cls,filters:filter,rows:result.rows},null,2),`GridAnalyzer_${cls}_envanter.json`,'application/json');return;}const exportColumns=columnsFor();const csv=technical?catalogCsv(result.rows,cls,result.attributes,true,[]):'\ufeff'+[exportColumns.map(c=>c.label),...result.rows.map(r=>workspaceRowValues(r,exportColumns))].map(r=>r.map(csvCell).join(';')).join('\r\n');
      downloadText(csv, `GridAnalyzer_${cls}_envanter.csv`, 'text/csv;charset=utf-8');
    } catch (error) { ctx.setMessage(`CSV oluşturulamadı: ${error instanceof Error ? error.message : String(error)}`); }
    finally { exportButton.disabled = false; exportButton.value=''; }
  });

  sort.onchange=()=>{page=0;void render();};descending.onchange=sort.onchange;sizeSelect.onchange=()=>{ctx.settings.update({pageSize:Number(sizeSelect.value)});page=0;ctx.notify();void render();};
  if (ctx.view === 'inventory') void render();
  return { element: root, render: () => { void render(); } };
}
