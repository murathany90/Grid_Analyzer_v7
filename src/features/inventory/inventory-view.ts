import type { AppContext, CatalogPage, CatalogRow, Feature } from '../../app/contracts';
import { csvCell, downloadText, element, format } from '../../ui/components/dom';
import { fetchCatalogAll, type CatalogFilter } from '../catalog';

const labels: Record<string, string> = {
  ElmSite: 'Trafo merkezleri', ElmLne: 'Enerji iletim hatları', ElmTr2: 'Transformatörler', ElmSubstat: 'Bara grupları',
  ElmTerm: 'Baralar / düğümler', ElmBay: 'Fiderler', ElmSym: 'Senkron üniteler', ElmGenStat: 'Statik üniteler',
  ElmLod: 'Elektriksel yükler', ElmShnt: 'Şönt ekipmanlar', ElmScap: 'Seri kapasitörler', ElmCoup: 'Anahtarlama elemanları',
  TypLne: 'Hat türleri', TypTr2: 'Trafo türleri', StaCubic: 'Bağlantı hücreleri', Matrix: 'Güzergâh / matris',
};
export function createInventoryView(ctx: AppContext): Feature {
  const root = element('section', 'ga-feature ga-inventory-view');
  const heading = element('div', 'ga-feature-heading');
  heading.append(element('h2', '', 'Şebeke envanteri'), element('p', 'ga-muted', 'Sabit karakteristikler, kaynak alanları ve ekipman ilişkileri.'));
  const toolbar = element('div', 'ga-toolbar');
  const classSelect = element('select'); classSelect.setAttribute('aria-label', 'Envanter sınıfı');
  const areaSelect = element('select'); areaSelect.setAttribute('aria-label', 'YTM');
  const siteSelect = element('select'); siteSelect.setAttribute('aria-label', 'Trafo merkezi');
  const voltageSelect = element('select'); voltageSelect.setAttribute('aria-label', 'Nominal gerilim');
  const search = element('input'); search.type = 'search'; search.placeholder = 'Ad veya FID ile ara'; search.setAttribute('aria-label', 'Ad veya FID ile ara');
  const exportButton = element('button', 'ga-button', 'Filtreli CSV'); exportButton.type = 'button';
  toolbar.append(classSelect, areaSelect, siteSelect, voltageSelect, search, exportButton);
  const count = element('p', 'ga-muted', 'Model bekleniyor.');
  const tableWrap = element('div', 'ga-table-wrap');
  const pager = element('div', 'ga-pager');
  const detail = element('section', 'ga-detail', 'Ayrıntı için bir ekipman seçin.');
  root.append(heading, toolbar, count, tableWrap, pager, detail);

  let page = 0, selected: CatalogRow | null = null, revision = 0, lastModelHash = '', optionModelHash = '', siteOptionsKey = '', lastQueryKey = '', pendingQueryKey = '';
  const pageSizeNow = () => Math.max(10, Math.min(100, Math.floor(ctx.settings.value.pageSize || 20)));
  const currentClass = () => classSelect.value || 'ElmSite';
  const makeFilter = (): CatalogFilter => ({
    search: search.value.trim() || undefined,
    areaId: areaSelect.value || undefined,
    siteId: siteSelect.value || undefined,
    voltage: voltageSelect.value ? Number(voltageSelect.value) : undefined,
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
      const classNames = Object.keys(network.classCounts).sort((a, b) => (labels[a] || a).localeCompare(labels[b] || b, 'tr'));
      fillSelect(classSelect, classNames.map(value => ({ value, label: labels[value] || value })), 'Envanter');
      if (!classSelect.value && classNames.length) classSelect.value = classNames.includes('ElmSite') ? 'ElmSite' : classNames[0];
      const areas = [...new Map(network.sites.map(s => [s.areaId, s.areaName || s.areaId] as const).filter(([id]) => Boolean(id)))];
      fillSelect(areaSelect, areas.map(([value, label]) => ({ value, label })), 'Bütün YTM’ler');
      const volts = [...new Set(network.sites.flatMap(s => s.voltages))].sort((a, b) => b - a);
      fillSelect(voltageSelect, volts.map(v => ({ value: String(v), label: `${v} kV` })), 'Bütün gerilimler');
    }
    const area = areaSelect.value, selectedVoltage = voltageSelect.value ? Number(voltageSelect.value) : null;
    const key = `${network.modelHash}|${area}|${selectedVoltage ?? ''}`; if (key === siteOptionsKey) return; siteOptionsKey = key;
    const sites = network.sites.filter(s => (!area || s.areaId === area) && (!selectedVoltage || s.voltages.includes(selectedVoltage)))
      .sort((a, b) => a.name.localeCompare(b.name, 'tr'));
    fillSelect(siteSelect, sites.map(s => ({ value: s.id, label: s.name })), 'Bütün TM’ler');
  }

  function showDetail(row: CatalogRow): void {
    selected = row;
    detail.replaceChildren();
    const title = element('h3', '', row.name || row.id);
    detail.append(title, element('p', 'ga-muted', `${currentClass()} · ${row.id}`));
    const sites = row.siteIds.map(id => ctx.network?.sites.find(s => s.id === id)?.name || id).filter(Boolean);
    if (sites.length) detail.append(element('p', 'ga-muted', `Trafo merkezi: ${sites.join(', ')}`));
    const attributes = element('dl', 'ga-attribute-grid');
    for (const [key, value] of Object.entries(row.attributes)) {
      const entry = element('div', 'ga-attribute'); entry.append(element('dt', '', key), element('dd', '', value == null ? '—' : String(value))); attributes.append(entry);
    }
    detail.append(attributes);
    const actions = element('div', 'ga-actions');
    for (const [label, view] of [['Haritada göster', 'map'], ['Tek hat şeması', 'sld']] as const) {
      const b = element('button', 'ga-button', label); b.type = 'button';
      b.addEventListener('click', () => ctx.select(row.id, currentClass(), view)); actions.append(b);
    }
    detail.append(actions);
  }

  function renderTable(result: CatalogPage): void {
    if (!result.rows.length) { tableWrap.replaceChildren(element('p', 'ga-empty', 'Filtreye uygun kayıt bulunamadı.')); return; }
    const table = element('table', 'ga-table');
    const thead = element('thead'); const headRow = element('tr');
    for (const text of ['Ad', 'FID', 'Trafo merkezi', ...result.attributes.filter(a => a !== 'FID' && a !== 'loc_name').slice(0, 6)]) headRow.append(element('th', '', text));
    thead.append(headRow); table.append(thead);
    const body = element('tbody');
    for (const row of result.rows) {
      const tr = element('tr', selected?.id === row.id ? 'ga-selected' : '');
      const siteNames = row.siteIds.map(id => ctx.network?.sites.find(s => s.id === id)?.name || id).join(', ');
      for (const value of [row.name || '—', row.id, siteNames, ...result.attributes.filter(a => a !== 'FID' && a !== 'loc_name').slice(0, 6).map(a => row.attributes[a])])
        tr.append(element('td', '', value == null ? '—' : String(value)));
      tr.tabIndex = 0; tr.setAttribute('role', 'button');
      tr.addEventListener('click', () => showDetail(row));
      tr.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); showDetail(row); } });
      body.append(tr);
    }
    table.append(body); tableWrap.replaceChildren(table);
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
    const request = ++revision;
    const network = ctx.network;
    if (!network) { lastModelHash = ''; optionModelHash = ''; siteOptionsKey = ''; lastQueryKey = ''; pendingQueryKey = ''; selected = null; count.textContent = 'Model bekleniyor.'; tableWrap.replaceChildren(element('p', 'ga-empty', 'Önce DGS JSON modelini yükleyin.')); pager.replaceChildren(); detail.textContent = 'Ayrıntı için bir ekipman seçin.'; return; }
    if (lastModelHash !== network.modelHash) { selected = null; lastQueryKey = ''; pendingQueryKey = ''; detail.textContent = 'Ayrıntı için bir ekipman seçin.'; lastModelHash = network.modelHash; }
    const size = pageSizeNow(), filter = makeFilter(), className = currentClass();
    const queryKey = JSON.stringify([network.modelHash, className, filter, page, size]);
    if (queryKey === lastQueryKey || queryKey === pendingQueryKey) return;
    pendingQueryKey = queryKey;
    try {
      const result = await ctx.catalog({ ...filter, className, page, pageSize: size });
      if (request !== revision || ctx.view !== 'inventory' || ctx.network?.modelHash !== network.modelHash) return;
      renderTable(result); renderPager(result.total, size);
      count.textContent = `${labels[className] || className} · ${format(result.total, 0)} kayıt`;
      lastQueryKey = queryKey;
    } catch (error) {
      if (request !== revision) return;
      tableWrap.replaceChildren(element('p', 'ga-notice ga-notice-error', `Envanter yüklenemedi: ${error instanceof Error ? error.message : String(error)}`));
      pager.replaceChildren();
    } finally { if (pendingQueryKey === queryKey) pendingQueryKey = ''; }
  }

  for (const control of [classSelect, siteSelect, voltageSelect]) control.addEventListener('change', () => { page = 0; selected = null; void render(); });
  areaSelect.addEventListener('change', () => { siteSelect.value = ''; page = 0; selected = null; void render(); });
  search.addEventListener('input', () => { page = 0; selected = null; void render(); });
  exportButton.addEventListener('click', async () => {
    if (!ctx.network) return;
    exportButton.disabled = true;
    try {
      const result = await fetchCatalogAll(ctx, currentClass(), makeFilter());
      const columns = ['Name', 'FID', ...result.attributes.filter(a => a !== 'FID' && a !== 'loc_name')];
      const csv = '\ufeff' + [columns, ...result.rows.map(row => [row.name, row.id, ...columns.slice(2).map(key => row.attributes[key])])]
        .map(row => row.map(csvCell).join(';')).join('\r\n');
      downloadText(csv, `YTBS_${currentClass()}_envanter.csv`, 'text/csv;charset=utf-8');
    } catch (error) { ctx.setMessage(`CSV oluşturulamadı: ${error instanceof Error ? error.message : String(error)}`); }
    finally { exportButton.disabled = false; }
  });

  if (ctx.view === 'inventory') void render();
  return { element: root, render: () => { void render(); } };
}
