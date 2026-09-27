import {voltageMatches} from '../../domain/model/voltage-band';
import {createVoltageFilter} from '../../ui/components/voltage-filter';
import {engineeringColumns,semanticTable,semanticDetail,catalogCsv,exportSelect} from '../../ui/components/semantic-catalog';
import type { AppContext, Feature } from '../../app/contracts';
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
export function createOperatingView(ctx: AppContext): Feature {
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
  const notice = element('p', 'ga-notice', 'Bu değerler DGS anlık durumuna ait işletme girdileridir; hesap sonucu veya ölçüm değildir.');
  const status = element('p', 'ga-muted');
  const tableWrap = element('div', 'ga-table-wrap');
  const pager = element('div', 'ga-pager');
  const detail = element('section', 'ga-detail', 'Ayrıntı için bir ekipman seçin.');
  root.append(heading, kindsBar, toolbar, voltageFilter.element, notice, status, tableWrap, pager, detail);

  let kind = kinds[0], page = 0, selected: TaggedCatalogRow | null = null, requestId = 0, lastModelHash = '';
  let filterModelHash = '', siteOptionsKey = '', kindDrawn = '', lastQueryKey = '', pendingQueryKey = '';
  const pageSizeNow = () => Math.max(10, Math.min(100, Math.floor(ctx.settings.value.pageSize || 20)));
  let lastFilterKey='';
  function options(select: HTMLSelectElement, values: readonly { value: string; label: string }[], first: string): void {
    const old = select.value; select.replaceChildren(new Option(first, ''), ...values.map(v => new Option(v.label, v.value)));
    if (values.some(v => v.value === old)) select.value = old;
  }
  function filter(): CatalogFilter {
    return { areaId: area.value || undefined, siteId: site.value || undefined,
      voltageBands: [...ctx.filters.voltages], search: search.value.trim() || undefined, sort: 'name' };
  }
  function fillFilters(net: NonNullable<AppContext['network']> | null): void {
    if (!net) return;
    if (filterModelHash !== net.modelHash) {
      filterModelHash = net.modelHash; siteOptionsKey = '';
      const areas = [...new Map(net.sites.map(s => [s.areaId, s.areaName || s.areaId] as const).filter(([id]) => Boolean(id)))];
      options(area, areas.map(([value, label]) => ({ value, label })), 'Bütün YTM’ler');

    }
    voltageFilter.render();const selectedArea=area.value,selectedVoltage=[...ctx.filters.voltages].sort().join(',');
    const key = `${net.modelHash}|${selectedArea}|${selectedVoltage ?? ''}`; if (siteOptionsKey === key) return; siteOptionsKey = key;
    const sites = net.sites.filter(s => (!selectedArea || s.areaId === selectedArea) && s.voltages.some(v=>voltageMatches(v,ctx.filters.voltages)))
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
    selected=row;semanticDetail(detail,row,row.className||kind.classes[0]);
    const jump = element('button', 'ga-button', 'Haritada göster'); jump.type = 'button';
    const sourceClass = row.className || kind.classes.find(c => ctx.network?.classCounts[c] !== undefined) || kind.classes[0];
    jump.addEventListener('click', () => ctx.select(row.id, sourceClass, 'map')); detail.append(jump);
  }
  function drawRows(rows: readonly TaggedCatalogRow[], attributes: readonly string[]): void {
    if (!rows.length) { tableWrap.replaceChildren(element('p', 'ga-empty', 'Filtreye uygun kayıt bulunamadı.')); return; }
    tableWrap.replaceChildren(semanticTable(rows,kind.classes[0],engineeringColumns(kind.classes[0],attributes,true),row=>showDetail({...row,className:row.className||kind.classes[0]})));
  }

  async function render(): Promise<void> {
    if (ctx.view !== 'operating') { requestId++; return; }
    const network = ctx.network; fillFilters(network);
    if (kindDrawn !== kind.id) { renderKinds(); kindDrawn = kind.id; }

    if (!network) { lastModelHash = ''; filterModelHash = ''; siteOptionsKey = ''; lastQueryKey = ''; pendingQueryKey = ''; selected = null; status.textContent = 'Model bekleniyor.'; tableWrap.replaceChildren(element('p', 'ga-empty', 'Önce DGS JSON modelini yükleyin.')); pager.replaceChildren(); detail.textContent = 'Ayrıntı için bir ekipman seçin.'; return; }
    if (lastModelHash !== network.modelHash) { selected = null; lastQueryKey = ''; pendingQueryKey = ''; detail.textContent = 'Ayrıntı için bir ekipman seçin.'; lastModelHash = network.modelHash; }
    const filters = filter(), size = pageSizeNow();
    const filterKey=JSON.stringify([network.modelHash,kind.id,filters,size]);if(filterKey!==lastFilterKey){page=0;lastFilterKey=filterKey;}
    const queryKey = JSON.stringify([network.modelHash, kind.id, filters, page, size]);
    if (queryKey === lastQueryKey || queryKey === pendingQueryKey) return;
    const request = ++requestId;
    pendingQueryKey = queryKey;
    try {
      const result = await fetchMergedPage(ctx, kind.classes, filters, page, size);
      if (request !== requestId || ctx.view !== 'operating' || ctx.network?.modelHash !== network.modelHash) return;
      const pages = Math.max(1, Math.ceil(result.total / size)); page = Math.max(0, Math.min(page, pages - 1));
      drawRows(result.rows, result.attributes);
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
      const results=[];for(const className of kind.classes)results.push(await fetchCatalogAll(ctx,className,filter()));
      const attributes=[...new Set(results.flatMap(result=>result.attributes))];
      const rows=results.flatMap((result,i)=>result.rows.map(row=>({...row,className:kind.classes[i]})));
      const text=catalogCsv(rows,kind.classes[0],attributes,technical,engineeringColumns(kind.classes[0],attributes,true));
      downloadText(text, `YTBS_${kind.id}_isletme.csv`, 'text/csv;charset=utf-8');
    } catch (error) { ctx.setMessage(`CSV oluşturulamadı: ${error instanceof Error ? error.message : String(error)}`); }
    finally { csv.disabled = false; csv.value=''; }
  });

  if (ctx.view === 'operating') void render();
  return { element: root, render: () => { void render(); } };
}
