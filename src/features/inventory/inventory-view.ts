import {classLabel} from '../../domain/dgs-semantics/classes';
import {voltageMatches} from '../../domain/model/voltage-band';
import {createVoltageFilter} from '../../ui/components/voltage-filter';
import {engineeringColumns,semanticTable,semanticDetail,catalogCsv,exportSelect} from '../../ui/components/semantic-catalog';
import type { AppContext, CatalogPage, CatalogRow, Feature } from '../../app/contracts';
import { csvCell, downloadText, element, format } from '../../ui/components/dom';
import { fetchCatalogAll, type CatalogFilter } from '../catalog';


export function createInventoryView(ctx: AppContext): Feature {
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
  const count = element('p', 'ga-muted', 'Model bekleniyor.');
  const tableWrap = element('div', 'ga-table-wrap');
  const pager = element('div', 'ga-pager');
  const detail = element('section', 'ga-detail', 'Ayrıntı için bir ekipman seçin.');
  root.append(heading, toolbar, voltageFilter.element, count, tableWrap, pager, detail);

  let page = 0, selected: CatalogRow | null = null, revision = 0, lastModelHash = '', optionModelHash = '', siteOptionsKey = '', lastQueryKey = '', pendingQueryKey = '';
  const pageSizeNow = () => Math.max(10, Math.min(100, Math.floor(ctx.settings.value.pageSize || 20)));
  let lastFilterKey='';
  const currentClass = () => classSelect.value || 'ElmSite';
  const makeFilter = (): CatalogFilter => ({
    search: search.value.trim() || undefined,
    areaId: areaSelect.value || undefined,
    siteId: siteSelect.value || undefined,
    voltageBands: [...ctx.filters.voltages],
    sort: 'name', descending: false,
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
      if (!classSelect.value && classNames.length) classSelect.value = classNames.includes('ElmSite') ? 'ElmSite' : classNames[0];
      const areas = [...new Map(network.sites.map(s => [s.areaId, s.areaName || s.areaId] as const).filter(([id]) => Boolean(id)))];
      fillSelect(areaSelect, areas.map(([value, label]) => ({ value, label })), 'Bütün YTM’ler');

    }
    voltageFilter.render();const area=areaSelect.value,selectedVoltage=[...ctx.filters.voltages].sort().join(',');
    const key = `${network.modelHash}|${area}|${selectedVoltage ?? ''}`; if (key === siteOptionsKey) return; siteOptionsKey = key;
    const sites = network.sites.filter(s => (!area || s.areaId === area) && s.voltages.some(v=>voltageMatches(v,ctx.filters.voltages)))
      .sort((a, b) => a.name.localeCompare(b.name, 'tr'));
    fillSelect(siteSelect, sites.map(s => ({ value: s.id, label: s.name })), 'Bütün TM’ler');
  }

  function showDetail(row: CatalogRow): void {
    selected = row;
    semanticDetail(detail,row,currentClass());
    const actions = element('div', 'ga-actions');
    for (const [label, view] of [['Haritada göster', 'map'], ['Tek hat şeması', 'sld']] as const) {
      const b = element('button', 'ga-button', label); b.type = 'button';
      b.addEventListener('click', () => ctx.select(row.id, currentClass(), view)); actions.append(b);
    }
    detail.append(actions);
  }

  function renderTable(result: CatalogPage): void {
    if (!result.rows.length) { tableWrap.replaceChildren(element('p', 'ga-empty', 'Filtreye uygun kayıt bulunamadı.')); return; }
    tableWrap.replaceChildren(semanticTable(result.rows,currentClass(),engineeringColumns(currentClass(),result.attributes),showDetail));
  }

  function renderPager(total: number, size: number): void {
    const pages = Math.max(1, Math.ceil(total / size)); page = Math.max(0, Math.min(page, pages - 1));
    const previous = element('button', 'ga-button', '← Önceki'); previous.type = 'button'; previous.disabled = page === 0;
    const next = element('button', 'ga-button', 'Sonraki →'); next.type = 'button'; next.disabled = page >= pages - 1;
    previous.addEventListener('click', () => { page--; void render(); }); next.addEventListener('click', () => { page++; void render(); });
    pager.replaceChildren(previous, element('span', 'ga-muted', `${format(total, 0)} kayıt · ${page + 1}/${pages}`), next);
  }

  async function render(): Promise<void> {
    if (ctx.view !== 'inventory') { revision++; return; }
    syncOptions();

    const network = ctx.network;
    if (!network) { lastModelHash = ''; optionModelHash = ''; siteOptionsKey = ''; lastQueryKey = ''; pendingQueryKey = ''; selected = null; count.textContent = 'Model bekleniyor.'; tableWrap.replaceChildren(element('p', 'ga-empty', 'Önce DGS JSON modelini yükleyin.')); pager.replaceChildren(); detail.textContent = 'Ayrıntı için bir ekipman seçin.'; return; }
    if (lastModelHash !== network.modelHash) { selected = null; lastQueryKey = ''; pendingQueryKey = ''; detail.textContent = 'Ayrıntı için bir ekipman seçin.'; lastModelHash = network.modelHash; }
    const size = pageSizeNow(), filter = makeFilter(), className = currentClass();
    const filterKey=JSON.stringify([network.modelHash,className,filter,size]);if(filterKey!==lastFilterKey){page=0;lastFilterKey=filterKey;}
    const queryKey = JSON.stringify([network.modelHash, className, filter, page, size]);
    if (queryKey === lastQueryKey || queryKey === pendingQueryKey) return;
    const request = ++revision;
    pendingQueryKey = queryKey;
    try {
      const result = await ctx.catalog({ ...filter, className, page, pageSize: size });
      if (request !== revision || ctx.view !== 'inventory' || ctx.network?.modelHash !== network.modelHash) return;
      renderTable(result); renderPager(result.total, size);
      count.textContent = `${classLabel(className)} · ${format(result.total, 0)} kayıt`;
      lastQueryKey = queryKey;
    } catch (error) {
      if (request !== revision) return;
      tableWrap.replaceChildren(element('p', 'ga-notice ga-notice-error', `Envanter yüklenemedi: ${error instanceof Error ? error.message : String(error)}`));
      pager.replaceChildren();
    } finally { if (pendingQueryKey === queryKey) pendingQueryKey = ''; }
  }

  for (const control of [classSelect, siteSelect]) control.addEventListener('change', () => { page = 0; selected = null; void render(); });
  areaSelect.addEventListener('change', () => { siteSelect.value = ''; page = 0; selected = null; void render(); });
  search.addEventListener('input', () => { page = 0; selected = null; void render(); });
  exportButton.addEventListener('change', async () => {
    if(!exportButton.value)return;const technical=exportButton.value==='raw';
    if (!ctx.network) return;
    exportButton.disabled = true;
    try {
      const result = await fetchCatalogAll(ctx, currentClass(), makeFilter());
      const csv=catalogCsv(result.rows,currentClass(),result.attributes,technical,engineeringColumns(currentClass(),result.attributes));
      downloadText(csv, `YTBS_${currentClass()}_envanter.csv`, 'text/csv;charset=utf-8');
    } catch (error) { ctx.setMessage(`CSV oluşturulamadı: ${error instanceof Error ? error.message : String(error)}`); }
    finally { exportButton.disabled = false; exportButton.value=''; }
  });

  if (ctx.view === 'inventory') void render();
  return { element: root, render: () => { void render(); } };
}
