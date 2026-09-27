import type { AppContext, Feature } from '../../app/contracts';
import type { TaggedCatalogRow } from '../catalog';
import { csvCell, downloadText, element, format } from '../../ui/components/dom';
import { fetchCatalogAll, fetchMergedPage, type CatalogFilter } from '../catalog';

interface OperatingKind { id: string; label: string; classes: readonly string[]; fields: readonly string[] }
const kinds: readonly OperatingKind[] = [
  { id: 'production', label: 'Üretim P/Q', classes: ['ElmSym', 'ElmGenStat'], fields: ['cCategory', 'pgini', 'qgini', 'Pmin_uc', 'Pmax_uc', 'usetp', 'outserv'] },
  { id: 'load', label: 'Tüketim P/Q', classes: ['ElmLod'], fields: ['plini', 'qlini', 'outserv'] },
  { id: 'tap', label: 'Trafo kademesi', classes: ['ElmTr2'], fields: ['nntap', 'strn', 'outserv'] },
  { id: 'switch', label: 'Anahtar pozisyonu', classes: ['ElmCoup'], fields: ['on_off', 'aUsage', 'outserv'] },
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
  const voltage = element('select'); voltage.setAttribute('aria-label', 'Nominal gerilim');
  const search = element('input'); search.type = 'search'; search.placeholder = 'Ünite / ekipman adı veya FID';
  const csv = element('button', 'ga-button', 'Filtreli CSV'); csv.type = 'button';
  toolbar.append(area, site, voltage, search, csv);
  const notice = element('p', 'ga-notice', 'pgini / qgini / plini / qlini bunlar çözümlenmiş hat akışları veya ölçümler değil, model girdileridir.');
  const status = element('p', 'ga-muted');
  const tableWrap = element('div', 'ga-table-wrap');
  const pager = element('div', 'ga-pager');
  const detail = element('section', 'ga-detail', 'Ayrıntı için bir ekipman seçin.');
  root.append(heading, kindsBar, toolbar, notice, status, tableWrap, pager, detail);

  let kind = kinds[0], page = 0, selected: TaggedCatalogRow | null = null, requestId = 0, lastModelHash = '';
  let filterModelHash = '', siteOptionsKey = '', kindDrawn = '', lastQueryKey = '', pendingQueryKey = '';
  const pageSizeNow = () => Math.max(10, Math.min(100, Math.floor(ctx.settings.value.pageSize || 20)));
  function options(select: HTMLSelectElement, values: readonly { value: string; label: string }[], first: string): void {
    const old = select.value; select.replaceChildren(new Option(first, ''), ...values.map(v => new Option(v.label, v.value)));
    if (values.some(v => v.value === old)) select.value = old;
  }
  function filter(): CatalogFilter {
    return { areaId: area.value || undefined, siteId: site.value || undefined,
      voltage: voltage.value ? Number(voltage.value) : undefined, search: search.value.trim() || undefined, sort: 'name' };
  }
  function fillFilters(net: NonNullable<AppContext['network']> | null): void {
    if (!net) return;
    if (filterModelHash !== net.modelHash) {
      filterModelHash = net.modelHash; siteOptionsKey = '';
      const areas = [...new Map(net.sites.map(s => [s.areaId, s.areaName || s.areaId] as const).filter(([id]) => Boolean(id)))];
      options(area, areas.map(([value, label]) => ({ value, label })), 'Bütün YTM’ler');
      const voltages = [...new Set([...net.buses.map(b => b.vnKv), ...net.lines.map(l => l.vnKv)])].filter(Number.isFinite).sort((a, b) => b - a);
      options(voltage, voltages.map(v => ({ value: String(v), label: `${v} kV` })), 'Bütün gerilimler');
    }
    const selectedArea = area.value, selectedVoltage = voltage.value ? Number(voltage.value) : null;
    const key = `${net.modelHash}|${selectedArea}|${selectedVoltage ?? ''}`; if (siteOptionsKey === key) return; siteOptionsKey = key;
    const sites = net.sites.filter(s => (!selectedArea || s.areaId === selectedArea) && (!selectedVoltage || s.voltages.includes(selectedVoltage)))
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
    selected = row; detail.replaceChildren(element('h3', '', row.name || row.id), element('p', 'ga-muted', `${row.className || kind.classes[0]} · ${row.id}`));
    const dl = element('dl', 'ga-attribute-grid');
    for (const [key, value] of Object.entries(row.attributes)) {
      const cell = element('div', 'ga-attribute'); cell.append(element('dt', '', key), element('dd', '', value == null ? '—' : String(value))); dl.append(cell);
    }
    detail.append(dl);
    const jump = element('button', 'ga-button', 'Haritada göster'); jump.type = 'button';
    const sourceClass = row.className || kind.classes.find(c => ctx.network?.classCounts[c] !== undefined) || kind.classes[0];
    jump.addEventListener('click', () => ctx.select(row.id, sourceClass, 'map')); detail.append(jump);
  }
  function drawRows(rows: readonly TaggedCatalogRow[], attributes: readonly string[]): void {
    if (!rows.length) { tableWrap.replaceChildren(element('p', 'ga-empty', 'Filtreye uygun kayıt bulunamadı.')); return; }
    const cols = ['Name', 'FID', 'Sınıf', ...kind.fields.filter(field => attributes.includes(field)).slice(0, 7)];
    const table = element('table', 'ga-table'); const head = element('tr'); cols.forEach(c => head.append(element('th', '', c)));
    const thead = element('thead'); thead.append(head); table.append(thead);
    const body = element('tbody');
    for (const row of rows) {
      const rowClass = row.className || kind.classes.find(c => ctx.network?.classCounts[c] !== undefined) || kind.classes[0];
      const tr = element('tr', selected?.id === row.id && selected.className === rowClass ? 'ga-selected' : ''); tr.tabIndex = 0;
      const values = [row.name || '—', row.id, rowClass, ...cols.slice(3).map(field => row.attributes[field])];
      values.forEach(value => tr.append(element('td', '', value == null ? '—' : String(value))));
      tr.addEventListener('click', () => showDetail(row));
      tr.addEventListener('keydown', event => { if (event.key === 'Enter') showDetail(row); }); body.append(tr);
    }
    table.append(body); tableWrap.replaceChildren(table);
  }
  async function render(): Promise<void> {
    if (ctx.view !== 'operating') { requestId++; return; }
    const network = ctx.network; fillFilters(network);
    if (kindDrawn !== kind.id) { renderKinds(); kindDrawn = kind.id; }
    const request = ++requestId;
    if (!network) { lastModelHash = ''; filterModelHash = ''; siteOptionsKey = ''; lastQueryKey = ''; pendingQueryKey = ''; selected = null; status.textContent = 'Model bekleniyor.'; tableWrap.replaceChildren(element('p', 'ga-empty', 'Önce DGS JSON modelini yükleyin.')); pager.replaceChildren(); detail.textContent = 'Ayrıntı için bir ekipman seçin.'; return; }
    if (lastModelHash !== network.modelHash) { selected = null; lastQueryKey = ''; pendingQueryKey = ''; detail.textContent = 'Ayrıntı için bir ekipman seçin.'; lastModelHash = network.modelHash; }
    const filters = filter(), size = pageSizeNow();
    const queryKey = JSON.stringify([network.modelHash, kind.id, filters, page, size]);
    if (queryKey === lastQueryKey || queryKey === pendingQueryKey) return;
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
  for (const control of [site, voltage]) control.addEventListener('change', () => { page = 0; selected = null; void render(); });
  area.addEventListener('change', () => { site.value = ''; page = 0; selected = null; void render(); });
  search.addEventListener('input', () => { page = 0; selected = null; void render(); });
  csv.addEventListener('click', async () => {
    if (!ctx.network) return;
    csv.disabled = true;
    try {
      const results = await Promise.all(kind.classes.map(className => fetchCatalogAll(ctx, className, filter())));
      const attributes = [...new Set(results.flatMap(result => result.attributes))];
      const columns = ['Name', 'FID', 'Sınıf', ...attributes];
      const rows = results.flatMap((result, i) => result.rows.map(row => [row.name, row.id, kind.classes[i], ...attributes.map(a => row.attributes[a])]));
      rows.sort((a, b) => String(a[0] || '').localeCompare(String(b[0] || ''), 'tr') || String(a[1]).localeCompare(String(b[1]), 'tr'));
      const text = '\ufeff' + [columns, ...rows].map(row => row.map(csvCell).join(';')).join('\r\n');
      downloadText(text, `YTBS_${kind.id}_isletme.csv`, 'text/csv;charset=utf-8');
    } catch (error) { ctx.setMessage(`CSV oluşturulamadı: ${error instanceof Error ? error.message : String(error)}`); }
    finally { csv.disabled = false; }
  });

  if (ctx.view === 'operating') void render();
  return { element: root, render: () => { void render(); } };
}
