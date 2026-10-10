import type { AppContext } from '../../app/contracts';
import type { N1CandidateStatus, N1ScreenCandidate, N1SelectedDetail } from '../../domain/n1';
import { element, button, escapeHtml as h, format as f, csvDocument, downloadText } from '../../ui/components/dom';
import { n1IslandStatusLabels, n1StatusLabels } from './presentation';
import { aggregateCriticalConstraints, collectN1Violations, type N1ViolationRow } from './aggregation';
import { sortN1, type SortDirection } from './sorting';

type ResultSection = 'scenarios' | 'violations' | 'islands' | 'critical';
const resultStatusChoices: readonly N1CandidateStatus[] = ['ISLANDING', 'SCREENED_VIOLATION', 'SCREENED_NO_VIOLATION', 'CAPACITY_UNAVAILABLE', 'UNSCREENABLE'];
const bands = ['all', '400', '220', '154', '66'] as const;
type VoltageBandFilter = typeof bands[number];
const bandRange = (value: VoltageBandFilter): { minVoltageKv?: number; maxVoltageKv?: number } => value === '400' ? { minVoltageKv: 300 } : value === '220' ? { minVoltageKv: 180, maxVoltageKv: 299.999 } : value === '154' ? { minVoltageKv: 100, maxVoltageKv: 179.999 } : value === '66' ? { minVoltageKv: 66, maxVoltageKv: 99.999 } : {};

export function createN1ResultsView(ctx: AppContext, isCurrent: () => boolean) {
  const controls = element('div', 'ga-analysis-controls ga-n1-results-controls');
  const ytm = element('select'), tm = element('select'), voltage = element('select'), type = element('select'), status = element('select'), search = element('input');
  const exportScenarios = button('Senaryolar CSV', exportScenariosCsv), exportViolations = button('Kısıt yüklenmeleri CSV', exportViolationsCsv), exportJson = button('JSON indir', exportJsonFile);
  const exportMenu = element('details', 'ga-n1-export-menu'), exportSummary = element('summary', 'ga-button', 'Dışa aktar'), exportActions = element('div', 'ga-n1-export-actions');
  exportSummary.setAttribute('aria-label', 'N-1 sonuçlarını dışa aktar'); exportActions.append(exportScenarios, exportViolations, exportJson); exportMenu.append(exportSummary, exportActions);
  const notice = element('p', 'ga-n1-dc-notice', 'P-only DC Screening · AC doğrulaması değildir.');
  const tabs = element('div', 'ga-tabs-small');
  const body = element('div');
  const tabButtons: Record<ResultSection, HTMLButtonElement> = {
    scenarios: button('KISIT SENARYOLARI', () => { section = 'scenarios'; renderCurrent(); }),
    violations: button('KISIT YÜKLENMELERİ', () => { section = 'violations'; renderCurrent(); }),
    islands: button('ADA / KAYIP', () => { section = 'islands'; renderCurrent(); }),
    critical: button('KRİTİK KISITLAR', () => { section = 'critical'; renderCurrent(); }),
  };
  tabs.append(...Object.values(tabButtons));
  let section: ResultSection = 'scenarios';
  let scenarioPage = 0, violationPage = 0, detailPage = 0, islandPage = 0, criticalOutagePage = 0, criticalPage = 0;
  let scenarioSort = 'priority', scenarioDirection: SortDirection = 'asc';
  let violationSort = 'postLoading', violationDirection: SortDirection = 'desc';
  let islandSort = 'name', islandDirection: SortDirection = 'asc';
  let criticalOutageSort = 'estimatedOverloadCount', criticalOutageDirection: SortDirection = 'desc';
  let criticalSort = 'outages', criticalDirection: SortDirection = 'desc';
  const violationSearch = element('input'), loadedType = element('select'), islandSearch = element('input'), criticalOutageSearch = element('input'), criticalSearch = element('input');

  search.type = 'search'; search.placeholder = 'Senaryo, ekipman veya FID ara'; search.setAttribute('aria-label', 'N-1 sonuçlarında ara');
  ytm.setAttribute('aria-label', 'YTM filtresi'); tm.setAttribute('aria-label', 'TM filtresi');
  voltage.innerHTML = '<option value="all">Tüm gerilimler</option><option value="400">400 kV</option><option value="220">220 kV</option><option value="154">154 kV</option><option value="66">66 kV</option>'; voltage.setAttribute('aria-label', 'Sonuç gerilim filtresi');
  type.innerHTML = '<option value="">Tüm kesinti tipleri</option><option value="ElmLne">Hat</option><option value="ElmTr2">Trafo</option>'; type.setAttribute('aria-label', 'Kesinti ekipmanı tipi');
  loadedType.innerHTML = '<option value="">Tüm yüklenen tipler</option><option value="ElmLne">Hat</option><option value="ElmTr2">Trafo</option>'; loadedType.setAttribute('aria-label', 'Yüklenen ekipman tipi');
  status.innerHTML = '<option value="">Tüm durumlar</option>' + resultStatusChoices.map(x => `<option value="${x}">${n1StatusLabels[x]}</option>`).join(''); status.setAttribute('aria-label', 'N-1 sonuç durumu');
  violationSearch.type = islandSearch.type = criticalSearch.type = 'search';
  violationSearch.placeholder = 'Kesinti veya yüklenen ekipman ara'; violationSearch.setAttribute('aria-label', 'Kısıt yüklenmelerinde ara');
  islandSearch.placeholder = 'Ada ayıran ekipman ara'; islandSearch.setAttribute('aria-label', 'Ada ayıran senaryolarda ara');
  criticalSearch.placeholder = 'Kritik kısıt ara'; criticalSearch.setAttribute('aria-label', 'Kritik kısıtlarda ara');
  controls.append(ytm, tm, voltage, type, status, search, exportMenu);

  for (const input of [ytm, tm, voltage, type, status]) input.addEventListener('change', () => resetPagesAndRender());
  ytm.onchange = () => { tm.value = ''; resetPagesAndRender(); };
  search.oninput = () => resetPagesAndRender();
  violationSearch.oninput = () => { violationPage = 0; renderCurrent(); };
  loadedType.onchange = () => { violationPage = 0; renderCurrent(); };
  islandSearch.oninput = () => { islandPage = 0; renderCurrent(); };
  criticalOutageSearch.type = 'search'; criticalOutageSearch.placeholder = 'Kesinti senaryosu ara'; criticalOutageSearch.setAttribute('aria-label', 'İhlal içeren kesinti senaryolarında ara');
  criticalSearch.placeholder = 'Yüklenen ekipman ara'; criticalSearch.setAttribute('aria-label', 'En çok etkilenen kısıt ekipmanlarında ara');
  criticalOutageSearch.oninput = () => { criticalOutagePage = 0; renderCurrent(); };
  criticalSearch.oninput = () => { criticalPage = 0; renderCurrent(); };

  function resetPagesAndRender() { scenarioPage = violationPage = islandPage = criticalOutagePage = criticalPage = 0; renderCurrent(); }
  function updateAreaOptions() {
    const sites = ctx.network?.sites || [];
    const areas = [...new Map(sites.map(s => [s.areaId, s.areaName || s.areaId])).entries()].sort((a, b) => a[1].localeCompare(b[1], 'tr'));
    const oldArea = ytm.value;
    ytm.innerHTML = '<option value="">Tüm YTM’ler</option>' + areas.map(([id, label]) => `<option value="${h(id)}">${h(label)}</option>`).join('');
    if (areas.some(([id]) => id === oldArea)) ytm.value = oldArea;
    const available = sites.filter(s => !ytm.value || s.areaId === ytm.value).sort((a, b) => a.name.localeCompare(b.name, 'tr'));
    const oldSite = tm.value;
    tm.innerHTML = '<option value="">Tüm TM’ler</option>' + available.map(s => `<option value="${h(s.id)}">${h(s.name)}</option>`).join('');
    if (available.some(s => s.id === oldSite)) tm.value = oldSite;
  }
  function result() { return isCurrent() ? ctx.n1Result : null; }
  function currentDetail(candidateId: string): N1SelectedDetail | null {
    return ctx.n1Detail?.candidateId === candidateId ? ctx.n1Detail : null;
  }
  function catalogMap() { return new Map((ctx.n1CatalogResult?.candidates || []).map(c => [c.candidateId, c])); }
  function filteredCandidates(candidates: readonly N1ScreenCandidate[]): N1ScreenCandidate[] {
    const byId = catalogMap(), q = search.value.toLocaleLowerCase('tr-TR'), range = bandRange(voltage.value as VoltageBandFilter), qYtm = ytm.value, qTm = tm.value;
    return candidates.filter(x => {
      const c = byId.get(x.candidateId);
      if (type.value && x.sourceClass !== type.value) return false;
      if (range.minVoltageKv != null && x.vnKv < range.minVoltageKv) return false;
      if (range.maxVoltageKv != null && x.vnKv > range.maxVoltageKv) return false;
      if (status.value && x.status !== status.value) return false;
      if (c && qYtm && qTm) {
        const fromMatch = c.fromYtmIds.includes(qYtm) && c.fromSiteIds.includes(qTm), toMatch = c.toYtmIds.includes(qYtm) && c.toSiteIds.includes(qTm);
        if (!fromMatch && !toMatch) return false;
      } else if (c && qYtm && !c.fromYtmIds.includes(qYtm) && !c.toYtmIds.includes(qYtm)) return false;
      else if (c && qTm && !c.fromSiteIds.includes(qTm) && !c.toSiteIds.includes(qTm)) return false;
      return !q || `${x.name} ${x.equipmentId} ${x.candidateId} ${c?.siteIds.join(' ') || ''}`.toLocaleLowerCase('tr-TR').includes(q);
    });
  }
  function labelForEquipment(id: string): string {
    const network = ctx.network;
    return network?.lines.find(x => x.id === id)?.name || network?.transformers.find(x => x.id === id)?.name || id;
  }
  function loadedLocation(id: string): string {
    const network = ctx.network, branch = network?.lines.find(x => x.id === id) || network?.transformers.find(x => x.id === id);
    return branch?.siteIds.map(siteId => {
      const site = network?.sites.find(item => item.id === siteId);
      return site ? `${site.areaName || site.areaId} / ${site.name}` : siteId;
    }).join(', ') || '—';
  }
  function compactLoadedLocation(id: string): string {
    const network = ctx.network, branch = network?.lines.find(x => x.id === id) || network?.transformers.find(x => x.id === id);
    return branch?.siteIds.map(siteId => {
      const site = network?.sites.find(item => item.id === siteId);
      return site ? `${site.areaName || site.areaId} / ${site.name}` : siteId;
    }).join(' ↔ ') || '—';
  }
  function loadedVoltage(id: string): number | null {
    const line = ctx.network?.lines.find(x => x.id === id);
    if (line) return line.fastParameters?.vnKv ?? line.vnKv;
    const transformer = ctx.network?.transformers.find(x => x.id === id);
    return transformer ? Math.max(transformer.vnKv, transformer.lvKv) : null;
  }
  function percent(value: number | null | undefined): string { return value == null ? '—' : `${f(value)}%`; }
  function cardGrid(resultValue: NonNullable<ReturnType<typeof result>>, candidates: readonly N1ScreenCandidate[], violations: readonly N1ViolationRow[]) {
    const catalogIdentity = ctx.n1CatalogIdentity, catalog = ctx.n1CatalogResult;
    const catalogMatches = !!catalog && catalogIdentity?.modelHash === resultValue.identity.modelHash && catalogIdentity.scenarioHash === resultValue.identity.scenarioHash && catalogIdentity.capacitySeason === resultValue.capacitySeason;
    const catalogTotal = catalogMatches ? catalog!.counts.total : '—';
    const catalogUnsupported = catalogMatches ? catalog!.counts.unscreenable : '—';
    const islandCount = candidates.filter(x => x.status === 'ISLANDING').length;
    const violationScenarios = candidates.filter(x => x.violationImpacts?.length).length;
    const cards = element('div', 'ga-n1-summary'); cards.dataset.n1ResultReady = 'true';
    const main = element('div', 'ga-n1-summary-main');
    for (const [label, value] of [['Seçili / DC taraması', `${resultValue.candidateCount} / ${resultValue.screenedCount}`], ['İhlalli N-1', violationScenarios], ['İhlal ilişkisi', violations.length], ['Ada ayıran', islandCount]]) {
      const card = element('div', 'ga-n1-summary-card'); card.innerHTML = `<small>${h(label)}</small><strong>${h(value)}</strong>`; main.append(card);
    }
    const metadata = element('p', 'ga-n1-summary-meta', `Katalog ${h(catalogTotal)} · Bu taramada taranamayan ${h(resultValue.unsupportedCount)} · Katalogda taranamayan ${h(catalogUnsupported)} · Kapasite bilgisi eksik ${h(resultValue.unratedCount)}`);
    cards.append(main, metadata);
    return cards;
  }
  function renderCurrent() { const value = result(); if (value) renderSection(value); }
  function render(target: HTMLElement) {
    updateAreaOptions();
    exportScenarios.disabled = exportViolations.disabled = exportJson.disabled = !result();
    const value = result();
    if (!value) {
      target.replaceChildren(notice, element('p', 'ga-muted', ctx.n1Result ? 'Sonuç seçili model/senaryo/kapsam veya aday kümesiyle eşleşmiyor. Yeni tarama başlatın.' : 'Henüz N-1 tarama sonucu yok. N-1 Senaryoları sekmesinden aday seçip tarama başlatın.'));
      return;
    }
    renderSection(value, target);
  }
  function renderSection(value: NonNullable<ReturnType<typeof result>>, target?: HTMLElement) {
    const candidates = filteredCandidates(value.candidates), violations = collectN1Violations(candidates);
    for (const key of Object.keys(tabButtons) as ResultSection[]) tabButtons[key].setAttribute('aria-pressed', String(section === key));
    const cards = cardGrid(value, value.candidates, collectN1Violations(value.candidates));
    if (section === 'scenarios') renderScenarios(candidates);
    else if (section === 'violations') renderViolations(violations);
    else if (section === 'islands') renderIslands(candidates);
    else renderCritical(aggregateCriticalConstraints(violations), candidates);
    if (target) target.replaceChildren(notice, cards, tabs, body);
  }

  function sortableHeaders(keys: readonly [string, string][], selectedSort: string, direction: SortDirection) {
    return keys.map(([key, label]) => `<th><button class="ga-sort" data-sort="${key}">${label}${selectedSort === key ? direction === 'asc' ? ' ▲' : ' ▼' : ''}</button></th>`).join('');
  }
  function bindSort(table: HTMLTableElement, onSort: (key: string) => void) { table.querySelectorAll<HTMLButtonElement>('thead button[data-sort]').forEach(b => b.onclick = () => onSort(b.dataset.sort || '')); }
  function pageSlice<T>(rows: readonly T[], page: number, setPage: (n: number) => void) {
    const safePage = Math.max(0, Math.min(page, Math.max(0, Math.ceil(rows.length / 20) - 1))), pageRows = rows.slice(safePage * 20, safePage * 20 + 20);
    return { pageRows, pager: pager(rows.length, safePage, setPage) };
  }
  function pager(total: number, page: number, setPage: (page: number) => void): HTMLElement {
    const pages = Math.ceil(total / 20), bar = element('div', 'ga-pager');
    bar.append(button('Önceki', () => setPage(Math.max(0, page - 1))), element('span', '', `${total.toLocaleString('tr-TR')} kayıt · ${pages ? page + 1 : 0}/${pages}`), button('Sonraki', () => setPage(Math.min(Math.max(0, pages - 1), page + 1))));
    (bar.firstElementChild as HTMLButtonElement).disabled = page <= 0; (bar.lastElementChild as HTMLButtonElement).disabled = page >= pages - 1;
    return bar;
  }
  function selectCandidate(candidateId: string | null) { detailPage = 0;const c=ctx.n1Result?.candidates.find(c=>c.candidateId===candidateId),e=c?[...ctx.network?.lines??[],...ctx.network?.transformers??[]].find(e=>e.id===c.equipmentId&&e.sourceClass===c.sourceClass):null;if(c){ctx.resultView.caseId=`N1:${c.sourceClass}:${e?.sourceId??c.equipmentId}`;if(ctx.benchmarkMap?.analysis==='N1')ctx.benchmarkMap.caseId=ctx.resultView.caseId;}void ctx.selectN1Candidate(candidateId).then(renderCurrent, renderCurrent); }
  function renderScenarios(candidates: readonly N1ScreenCandidate[]) {
    const rows = sortN1(candidates, scenarioSort, scenarioDirection), { pageRows, pager: pageBar } = pageSlice(rows, scenarioPage, p => { scenarioPage = p; renderCurrent(); });
    const byId = catalogMap(), siteName = (id: string) => ctx.network?.sites.find(s => s.id === id)?.name || id, areaName = (id: string) => ctx.network?.sites.find(s => s.areaId === id)?.areaName || id;
    const ytmLabel = (candidateId: string) => { const c = byId.get(candidateId); return c ? [...new Set([...c.fromYtmIds, ...c.toYtmIds])].map(areaName).join(', ') || '—' : '—'; };
    const tmLabel = (candidateId: string) => { const c = byId.get(candidateId); return c ? [...new Set([...c.fromSiteIds, ...c.toSiteIds])].map(siteName).join(', ') || '—' : '—'; };
    const wrap = element('div', 'ga-table-wrap'), table = element('table', 'ga-table');
    table.innerHTML = `<thead><tr>${sortableHeaders([['priority', 'Öncelik'], ['name', 'Kesinti ekipmanı'], ['type', 'Tip'], ['kv', 'kV'], ['status', 'Durum'], ['baseFlow', 'Baz P MW'], ['estimatedOverloadCount', 'İhlalli kısıt'], ['maxEstimatedLoadingPct', 'En yüksek tahmini yüklenme'], ['maxDeltaPMw', 'En büyük |ΔP| MW']], scenarioSort, scenarioDirection)}<th>YTM</th><th>TM</th></tr></thead><tbody>${pageRows.map((x, i) => `<tr data-id="${h(x.candidateId)}" class="${x.candidateId === ctx.selectedN1CandidateId ? 'ga-selected' : ''}"><td>${scenarioPage * 20 + i + 1}</td><td>${h(x.name)}<small>${h(x.equipmentId)}</small></td><td>${x.sourceClass === 'ElmLne' ? 'Hat' : 'Trafo'}</td><td>${f(x.vnKv)}</td><td>${n1StatusLabels[x.status]}</td><td>${f(x.baseFlowMw)}</td><td>${x.estimatedOverloadCount}</td><td>${x.maxEstimatedLoadingPct == null ? '—' : `${f(x.maxEstimatedLoadingPct)}%`}</td><td>${x.maxDeltaPMw == null ? '—' : `${f(x.maxDeltaPMw)} MW`}</td><td>${h(ytmLabel(x.candidateId))}</td><td>${h(tmLabel(x.candidateId))}</td></tr>`).join('') || '<tr><td colspan="11" class="ga-empty">Bu filtrelerde senaryo yok.</td></tr>'}</tbody>`;
    bindSort(table, key => { if (scenarioSort === key) scenarioDirection = scenarioDirection === 'asc' ? 'desc' : 'asc'; else { scenarioSort = key; scenarioDirection = 'asc'; } renderCurrent(); });
    table.querySelectorAll<HTMLTableRowElement>('tbody tr[data-id]').forEach(row => row.onclick = () => selectCandidate(row.dataset.id || null));
    wrap.append(table);
    body.replaceChildren(element('p', 'ga-muted', 'Kesinti senaryoları katalogdaki ekipman sayısından ayrı sayılır; tabloda yalnız bu taramaya alınan adaylar gösterilir.'), wrap, pageBar, scenarioDetail(rows.find(x => x.candidateId === ctx.selectedN1CandidateId)));
  }
  function scenarioDetail(candidate: N1ScreenCandidate | undefined): HTMLElement {
    if (!candidate) return element('p', 'ga-muted', 'Senaryo ayrıntısı için bir kesinti ekipmanı seçin.');
    const detail = currentDetail(candidate.candidateId), box = element('div', 'ga-panel');
    if (detail) box.dataset.n1DetailId = candidate.candidateId;
    box.innerHTML = `<h3>Kesinti senaryosu · ${h(candidate.name)}</h3><p><strong>FID:</strong> ${h(candidate.equipmentId)} · <strong>Tip:</strong> ${candidate.sourceClass === 'ElmLne' ? 'Hat' : 'Trafo'} · <strong>Gerilim:</strong> ${f(candidate.vnKv)} kV</p><p><strong>Durum:</strong> ${n1StatusLabels[candidate.status]} · <strong>Baz P:</strong> ${f(candidate.baseFlowMw)} MW · <strong>İhlalli kısıt:</strong> ${candidate.estimatedOverloadCount} · <strong>En yüksek tahmini yüklenme:</strong> ${candidate.maxEstimatedLoadingPct == null ? '—' : `${f(candidate.maxEstimatedLoadingPct)}%`}</p><p><strong>Kapasite kapsamı:</strong> ${candidate.ratingCoverage.evaluated ? `${candidate.ratingCoverage.ratedBranches}/${candidate.ratingCoverage.totalBranches} dal (${f(candidate.ratingCoverage.percent)}%)` : 'Tarama yapılmadı'}</p>`;
    if (detail) box.append(element('p', 'ga-muted', `${detail.branchImpacts.length.toLocaleString('tr-TR')} dal ayrıntısı hazır. Kısıt yüklenmeleri sekmesinde ihlal ilişkilerini açın.`));
    else if (ctx.n1DetailLoading && ctx.selectedN1CandidateId === candidate.candidateId) box.append(element('p', 'ga-notice', 'Kesinti ayrıntısı hesaplanıyor…'));
    const actions = element('div', 'ga-row-actions'); actions.append(button('Haritada göster', () => ctx.select(candidate.equipmentId, candidate.sourceClass, 'map')), button('Tek Hat Şeması', () => ctx.select(candidate.equipmentId, candidate.sourceClass, 'sld'))); box.append(actions);
    return box;
  }

  function renderViolations(input: readonly N1ViolationRow[]) {
    const q = violationSearch.value.toLocaleLowerCase('tr-TR');
    const rows = input.filter(x => (!loadedType.value || x.impact.sourceClass === loadedType.value) && `${x.outage.name} ${x.outage.equipmentId} ${x.impact.equipmentId} ${labelForEquipment(x.impact.equipmentId)} ${loadedLocation(x.impact.equipmentId)} ${x.impact.from} ${x.impact.to}`.toLocaleLowerCase('tr-TR').includes(q));
    rows.sort((a, b) => compareViolation(a, b, violationSort, violationDirection));
    const { pageRows, pager: pageBar } = pageSlice(rows, violationPage, p => { violationPage = p; renderCurrent(); });
    const wrap = element('div', 'ga-table-wrap ga-n1-violation-wrap'), table = element('table', 'ga-table ga-n1-violation-table');
    table.innerHTML = `<thead><tr>${sortableHeaders([['outage', 'Kesinti senaryosu'], ['equipment', 'Yüklenen teçhizat'], ['type', 'Tip'], ['location', 'YTM / TM'], ['baseFlow', 'Baz durum · MW / tahmini %'], ['postFlow', 'Kesinti sonrası · MW / tahmini % / MVA'], ['delta', 'ΔP MW']], violationSort, violationDirection)}</tr></thead><tbody>${pageRows.map(x => {
      const baseLoading = percent(x.impact.baseEstimatedLoadingPct), postLoading = percent(x.impact.postEstimatedLoadingPct ?? x.impact.estimatedLoadingPct);
      const location = compactLoadedLocation(x.impact.equipmentId), fullLocation = loadedLocation(x.impact.equipmentId);
      return `<tr data-id="${h(x.outage.candidateId)}" class="${x.outage.candidateId === ctx.selectedN1CandidateId ? 'ga-selected' : ''}"><td class="ga-n1-sticky-context"><span>${h(x.outage.name)}</span><small>${h(x.outage.equipmentId)} · ${x.outage.sourceClass === 'ElmTr2' ? 'Trafo' : 'Hat'}</small></td><td class="ga-n1-sticky-equipment"><span>${h(labelForEquipment(x.impact.equipmentId))}</span><small>${h(x.impact.equipmentId)} · ${h(x.impact.from)} → ${h(x.impact.to)}</small></td><td>${x.impact.sourceClass === 'ElmTr2' ? 'Trafo' : 'Hat'}<small>${f(loadedVoltage(x.impact.equipmentId))} kV</small></td><td title="${h(fullLocation)}">${h(location)}</td><td><span>${f(x.impact.baseFlowMw)} MW</span><small>${baseLoading}</small></td><td><span>${f(x.impact.postFlowMw)} MW</span><small>${postLoading} · ${f(x.impact.capacityMva)} MVA</small></td><td>${f(x.impact.deltaPMw)}</td></tr>`;
    }).join('') || '<tr><td colspan="7" class="ga-empty">Bu filtrelerde tahmini limit aşımı yok.</td></tr>'}</tbody>`;
    bindSort(table, key => { if (violationSort === key) violationDirection = violationDirection === 'asc' ? 'desc' : 'asc'; else { violationSort = key; violationDirection = 'asc'; } renderCurrent(); });
    table.querySelectorAll<HTMLTableRowElement>('tbody tr[data-id]').forEach(row => row.onclick = () => selectCandidate(row.dataset.id || null));
    wrap.append(table);
    const selected = input.find(x => x.outage.candidateId === ctx.selectedN1CandidateId)?.outage;
    const detail = selected ? currentDetail(selected.candidateId) : null;
    const detailBox = detail ? detailImpacts(detail) : element('p', ctx.n1DetailLoading ? 'ga-notice' : 'ga-muted', selected ? (ctx.n1DetailLoading ? 'Kesinti ayrıntısı hesaplanıyor…' : 'Seçili kesinti için dal ayrıntısı hazır değil.') : 'İlişki ayrıntısı için bir kesinti satırı seçin.');
    body.replaceChildren(violationSearch, loadedType, wrap, pageBar, detailBox);
  }
  function compareViolation(a: N1ViolationRow, b: N1ViolationRow, key: string, direction: SortDirection): number {
    const value = (x: N1ViolationRow): string | number => key === 'outage' ? x.outage.name : key === 'outageType' ? x.outage.sourceClass : key === 'equipment' ? labelForEquipment(x.impact.equipmentId) : key === 'type' ? x.impact.sourceClass : key === 'kv' ? loadedVoltage(x.impact.equipmentId) ?? -1 : key === 'location' ? loadedLocation(x.impact.equipmentId) : key === 'baseFlow' ? x.impact.baseFlowMw ?? -1 : key === 'postFlow' ? x.impact.postFlowMw ?? -1 : key === 'baseLoading' ? x.impact.baseEstimatedLoadingPct ?? -1 : key === 'delta' ? Math.abs(x.impact.deltaPMw ?? 0) : key === 'capacity' ? x.impact.capacityMva ?? -1 : x.impact.postEstimatedLoadingPct ?? x.impact.estimatedLoadingPct ?? -1;
    const av = value(a), bv = value(b), cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv), 'tr');
    return (direction === 'asc' ? cmp : -cmp) || a.outage.candidateId.localeCompare(b.outage.candidateId) || a.impact.equipmentId.localeCompare(b.impact.equipmentId);
  }
  function detailImpacts(detail: N1SelectedDetail): HTMLElement {
    const box = element('div', 'ga-panel'), rows = [...detail.branchImpacts].sort((a, b) => (b.postEstimatedLoadingPct ?? b.estimatedLoadingPct ?? -1) - (a.postEstimatedLoadingPct ?? a.estimatedLoadingPct ?? -1));
    box.dataset.n1DetailId = detail.candidateId;
    const { pageRows, pager: pageBar } = pageSlice(rows, detailPage, p => { detailPage = p; renderCurrent(); });
    const wrap = element('div', 'ga-table-wrap'), table = element('table', 'ga-table');
    table.innerHTML = `<thead><tr><th>Dal</th><th>Uçlar</th><th>Baz MW</th><th>Son MW</th><th>ΔP MW</th><th>Limit MVA</th><th>Tahmini yüklenme</th></tr></thead><tbody>${pageRows.map(x => `<tr><td>${h(x.name)}<small>${h(x.equipmentId)}</small></td><td>${h(x.from)} → ${h(x.to)}</td><td>${f(x.baseFlowMw)}</td><td>${f(x.postFlowMw)}</td><td>${f(x.deltaPMw)}</td><td>${f(x.capacityMva)}</td><td>${percent(x.postEstimatedLoadingPct ?? x.estimatedLoadingPct)}</td></tr>`).join('')}</tbody>`;
    wrap.append(table); box.append(element('h3', '', `Kesinti: ${h(detail.candidate.name)} · izlenen dal ayrıntısı`), wrap, pageBar, element('p', 'ga-muted', 'Akış MW, kapasite sınırı MVA olarak gösterilir.'));
    const actions = element('div', 'ga-row-actions'); actions.append(button('Kesinti ekipmanını haritada göster', () => ctx.select(detail.outage.equipmentId, detail.outage.sourceClass, 'map'))); box.append(actions); return box;
  }

  function renderIslands(candidates: readonly N1ScreenCandidate[]) {
    const q = islandSearch.value.toLocaleLowerCase('tr-TR');
    const rows = candidates.filter(x => x.status === 'ISLANDING' && `${x.name} ${x.equipmentId} ${x.from} ${x.to}`.toLocaleLowerCase('tr-TR').includes(q));
    rows.sort((a, b) => compareCandidate(a, b, islandSort, islandDirection));
    const { pageRows, pager: pageBar } = pageSlice(rows, islandPage, p => { islandPage = p; renderCurrent(); });
    const wrap = element('div', 'ga-table-wrap'), table = element('table', 'ga-table');
    table.innerHTML = `<thead><tr>${sortableHeaders([['name', 'Ada ayıran kesinti'], ['type', 'Tip'], ['kv', 'kV'], ['status', 'Durum'], ['islands', 'Bileşen sayısı']], islandSort, islandDirection)}</tr></thead><tbody>${pageRows.map(x => { const detail = currentDetail(x.candidateId); return `<tr data-id="${h(x.candidateId)}" class="${x.candidateId === ctx.selectedN1CandidateId ? 'ga-selected' : ''}"><td>${h(x.name)}<small>${h(x.equipmentId)} · ${h(x.from)} → ${h(x.to)}</small></td><td>${x.sourceClass === 'ElmTr2' ? 'Trafo' : 'Hat'}</td><td>${f(x.vnKv)}</td><td>${n1StatusLabels[x.status]}</td><td>${detail?.outageIslands.length ?? (x.candidateId === ctx.selectedN1CandidateId ? 'Yükleniyor…' : 'Seçilince')}</td></tr>`; }).join('') || '<tr><td colspan="5" class="ga-empty">Filtrelerde ada ayıran senaryo yok.</td></tr>'}</tbody>`;
    bindSort(table, key => { if (islandSort === key) islandDirection = islandDirection === 'asc' ? 'desc' : 'asc'; else { islandSort = key; islandDirection = 'asc'; } renderCurrent(); });
    table.querySelectorAll<HTMLTableRowElement>('tbody tr[data-id]').forEach(row => row.onclick = () => selectCandidate(row.dataset.id || null));
    wrap.append(table);
    const selectedId = ctx.selectedN1CandidateId, detail = selectedId ? currentDetail(selectedId) : null;
    body.replaceChildren(islandSearch, element('p', 'ga-muted', 'Ada ayıran adaylar için kesinti sonrası elektrik bileşenleri, bağlı referanslar, yük ve üretim ayrıntıları gösterilir.'), wrap, pageBar, detail ? islandDetail(detail) : element('p', ctx.n1DetailLoading ? 'ga-notice' : 'ga-muted', selectedId ? (ctx.n1DetailLoading ? 'Kesinti ayrıntısı hesaplanıyor…' : 'Ada bileşenleri hazır değil.') : 'Ada ayrıntısı için bir kesinti ekipmanı seçin.'));
  }
  function compareCandidate(a: N1ScreenCandidate, b: N1ScreenCandidate, key: string, direction: SortDirection) {
    const av: string | number = key === 'type' ? a.sourceClass : key === 'kv' ? a.vnKv : key === 'islands' ? currentDetail(a.candidateId)?.outageIslands.length ?? -1 : key === 'status' ? a.status : a.name;
    const bv: string | number = key === 'type' ? b.sourceClass : key === 'kv' ? b.vnKv : key === 'islands' ? currentDetail(b.candidateId)?.outageIslands.length ?? -1 : key === 'status' ? b.status : b.name;
    const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv), 'tr');
    return (direction === 'asc' ? cmp : -cmp) || a.candidateId.localeCompare(b.candidateId);
  }
  function islandDetail(detail: N1SelectedDetail): HTMLElement {
    const box = element('div', 'ga-panel'), components = detail.outageIslands;
    box.dataset.n1DetailId = detail.candidateId;
    box.innerHTML = `<h3>Ada ayrıntısı · ${h(detail.candidate.name)}</h3><p><strong>Kesinti ekipmanı:</strong> ${h(detail.outageEquipment.equipmentId)} · <strong>Kesinti sonrası bileşen:</strong> ${components.length}</p>`;
    const unreferenced = components.filter(c => !c.hasGridReference), summary = element('p', 'ga-notice ga-n1-island-summary');
    summary.dataset.n1IslandSummary = 'true';
    const separatedLoad = unreferenced.reduce((sum, c) => sum + (c.topologicallySeparatedLoadMw ?? 0), 0), separatedGeneration = unreferenced.reduce((sum, c) => sum + (c.topologicallySeparatedGenerationMw ?? 0), 0);
    summary.dataset.componentCount = String(components.length);
    summary.dataset.referenceLessCount = String(unreferenced.length);
    summary.dataset.separatedLoadMw = String(separatedLoad);
    summary.dataset.separatedGenerationMw = String(separatedGeneration);
    summary.textContent = `Bileşen ${components.length} · Şebeke referansı olmayan ${unreferenced.length} · Topolojik olarak ayrılan tüketim ${unreferenced.length ? `${f(separatedLoad)} MW` : '—'} · üretim ${unreferenced.length ? `${f(separatedGeneration)} MW` : '—'}. Bunlar yük atma kararı değildir.`;
    const wrap = element('div', 'ga-table-wrap'), table = element('table', 'ga-table');
    table.innerHTML = `<thead><tr><th>Ada</th><th>Şebeke durumu</th><th>Referans</th><th>Bara</th><th>Dal</th><th>Tüketim MW</th><th>Yerel üretim MW</th><th>Net P MW</th><th>Topolojik ayrılan tüketim MW</th><th>Topolojik ayrılan üretim MW</th></tr></thead><tbody>${components.map((c, index) => `<tr data-island="${h(c.componentId)}" class="${c.componentId === ctx.selectedN1IslandId ? 'ga-selected' : ''}"><td title="${h(c.componentId)}">Ada ${index + 1}<small>${h(c.componentId)}</small></td><td>${n1IslandStatusLabels[c.status]}<small>${c.hasLocalGeneration ? `Yerel üretim var · ${c.generatorCount} ünite` : 'Yerel üretim yok'}</small></td><td>${c.referenceCount} · ${h(c.references.map(r => r.name).join(', ') || 'yok')}</td><td>${c.busIds.length}</td><td>${c.branchIds.length}</td><td>${f(c.loadMw)}</td><td>${f(c.generationMw)}</td><td>${f(c.netInjectionMw)}</td><td>${f(c.topologicallySeparatedLoadMw)}</td><td>${f(c.topologicallySeparatedGenerationMw)}</td></tr>`).join('') || '<tr><td colspan="10">Bileşen ayrıntısı bulunamadı.</td></tr>'}</tbody>`;
    table.querySelectorAll<HTMLTableRowElement>('tbody tr[data-island]').forEach(row => row.onclick = () => { ctx.selectN1Island(row.dataset.island || null); renderCurrent(); });
    wrap.append(table); box.append(summary, wrap);
    const selected = components.find(c => c.componentId === ctx.selectedN1IslandId);
    if (selected) {
      const index = components.indexOf(selected) + 1;
      box.append(element('p', 'ga-muted', `Seçili Ada ${index}: ${selected.busIds.length} bara, ${selected.branchIds.length} dal · ${selected.hasGridReference ? 'Şebeke referansı var' : 'Şebeke referansı yok'} · ${selected.hasLocalGeneration ? `yerel üretim var (${selected.generatorCount} ünite, ${f(selected.generationMw)} MW)` : 'yerel üretim yok'}. Baralar: ${selected.busIds.slice(0, 12).join(', ')}${selected.busIds.length > 12 ? ` … (+${selected.busIds.length - 12})` : ''}. Referanslar: ${selected.references.map(r => `${r.name} (${r.sourceClass}:${r.id})`).join(', ') || 'yok'}.`));
    }
    return box;
  }

  function renderCritical(input: ReturnType<typeof aggregateCriticalConstraints>, candidates: readonly N1ScreenCandidate[]) {
    const outageQuery = criticalOutageSearch.value.toLocaleLowerCase('tr-TR');
    const outageRows = candidates.filter(x => x.estimatedOverloadCount > 0 && `${x.name} ${x.equipmentId} ${x.candidateId}`.toLocaleLowerCase('tr-TR').includes(outageQuery));
    const orderedOutages = sortN1(outageRows, criticalOutageSort, criticalOutageDirection), outagePage = pageSlice(orderedOutages, criticalOutagePage, p => { criticalOutagePage = p; renderCurrent(); });
    const maxOutageCount = Math.max(1, ...outagePage.pageRows.map(x => x.estimatedOverloadCount));
    const chart = element('div', 'ga-n1-bars'); chart.setAttribute('role', 'img'); chart.setAttribute('aria-label', 'Kesinti senaryosu başına tahmini ihlalli kısıt sayısı');
    for (const row of outagePage.pageRows) { const item = element('div', 'ga-n1-bar-row'), label = element('span', 'ga-n1-bar-label', row.name), track = element('span', 'ga-n1-bar-track'), fill = element('span', 'ga-n1-bar-fill'); item.style.cssText = 'display:grid;grid-template-columns:minmax(100px,1fr) minmax(120px,3fr) auto;gap:8px;align-items:center;margin:5px 0'; label.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap'; track.style.cssText = 'display:block;height:10px;background:var(--panel2,#233);border-radius:6px;overflow:hidden'; fill.style.cssText = `display:block;height:100%;width:${Math.max(3, row.estimatedOverloadCount / maxOutageCount * 100)}%;background:var(--accent,#58b9bc);border-radius:inherit`; fill.title = `${row.estimatedOverloadCount} tahmini ihlalli kısıt`; track.append(fill); item.append(label, track, element('strong', '', row.estimatedOverloadCount.toLocaleString('tr-TR'))); chart.append(item); }
    const outageWrap = element('div', 'ga-table-wrap'), outageTable = element('table', 'ga-table');
    outageTable.innerHTML = `<thead><tr>${sortableHeaders([['priority', 'Öncelik'], ['name', 'Kesinti senaryosu'], ['estimatedOverloadCount', 'İhlalli kısıt'], ['maxEstimatedLoadingPct', 'En yüksek tahmini yüklenme'], ['maxDeltaPMw', 'En büyük |ΔP| MW']], criticalOutageSort, criticalOutageDirection)}</tr></thead><tbody>${outagePage.pageRows.map((x, i) => `<tr data-id="${h(x.candidateId)}" class="${x.candidateId === ctx.selectedN1CandidateId ? 'ga-selected' : ''}"><td>${criticalOutagePage * 20 + i + 1}</td><td>${h(x.name)}<small>${h(x.equipmentId)}</small></td><td>${x.estimatedOverloadCount}</td><td>${percent(x.maxEstimatedLoadingPct)}</td><td>${x.maxDeltaPMw == null ? '—' : `${f(x.maxDeltaPMw)} MW`}</td></tr>`).join('') || '<tr><td colspan="5" class="ga-empty">Filtrelerde ihlal içeren kesinti yok.</td></tr>'}</tbody>`;
    bindSort(outageTable, key => { if (criticalOutageSort === key) criticalOutageDirection = criticalOutageDirection === 'asc' ? 'desc' : 'asc'; else { criticalOutageSort = key; criticalOutageDirection = 'asc'; } renderCurrent(); });
    outageTable.querySelectorAll<HTMLTableRowElement>('tbody tr[data-id]').forEach(row => row.onclick = () => selectCandidate(row.dataset.id || null));
    outageWrap.append(outageTable);
    const q = criticalSearch.value.toLocaleLowerCase('tr-TR');
    const rows = input.filter(x => `${labelForEquipment(x.equipmentId)} ${x.name} ${x.equipmentId} ${x.from} ${x.to}`.toLocaleLowerCase('tr-TR').includes(q));
    rows.sort((a, b) => compareCritical(a, b, criticalSort, criticalDirection));
    const { pageRows, pager: pageBar } = pageSlice(rows, criticalPage, p => { criticalPage = p; renderCurrent(); });
    const topEquipment = [...rows].sort((a, b) => b.outageCount - a.outageCount || b.violationCount - a.violationCount || a.equipmentId.localeCompare(b.equipmentId)).slice(0, 5);
    const topEquipmentList = element('div', 'ga-n1-top-equipment');
    topEquipmentList.innerHTML = topEquipment.map((x, i) => `<div><span>${i + 1}. ${h(labelForEquipment(x.equipmentId))}<small>${h(x.equipmentId)}</small></span><strong>${x.outageCount.toLocaleString('tr-TR')} kesinti · ${x.violationCount.toLocaleString('tr-TR')} ilişki</strong></div>`).join('') || '<p class="ga-muted">Kritik ekipman bulunamadı.</p>';
    const wrap = element('div', 'ga-table-wrap'), table = element('table', 'ga-table');
    table.innerHTML = `<thead><tr>${sortableHeaders([['name', 'Kritik ekipman'], ['type', 'Tip'], ['outages', 'Etkilenen kesinti'], ['violations', 'İhlal ilişkisi'], ['loading', 'En yüksek tahmini yüklenme'], ['delta', 'En büyük |ΔP| MW']], criticalSort, criticalDirection)}</tr></thead><tbody>${pageRows.map(x => `<tr data-id="${h(x.equipmentId)}"><td>${h(labelForEquipment(x.equipmentId))}<small>${h(x.equipmentId)} · ${h(x.from)} → ${h(x.to)}</small></td><td>${x.sourceClass === 'ElmTr2' ? 'Trafo' : 'Hat'}</td><td>${x.outageCount}</td><td>${x.violationCount}</td><td>${f(x.maxEstimatedLoadingPct)}%</td><td>${f(x.maxAbsDeltaPMw)} MW</td></tr>`).join('') || '<tr><td colspan="6" class="ga-empty">Filtrelerde tekrarlanan kritik kısıt yok.</td></tr>'}</tbody>`;
    bindSort(table, key => { if (criticalSort === key) criticalDirection = criticalDirection === 'asc' ? 'desc' : 'asc'; else { criticalSort = key; criticalDirection = 'asc'; } renderCurrent(); });
    body.replaceChildren(criticalOutageSearch, element('p', 'ga-muted', 'Grafik her kesinti için tahmini ihlalli kısıt sayısını gösterir.'), chart, outageWrap, outagePage.pager, element('h3', '', 'En çok etkilenen kısıt ekipmanları'), topEquipmentList, criticalSearch, wrap, pageBar);
  }
  function compareCritical(a: ReturnType<typeof aggregateCriticalConstraints>[number], b: ReturnType<typeof aggregateCriticalConstraints>[number], key: string, direction: SortDirection) {
    const value = (x: typeof a): string | number => key === 'type' ? x.sourceClass : key === 'outages' ? x.outageCount : key === 'violations' ? x.violationCount : key === 'loading' ? x.maxEstimatedLoadingPct : key === 'delta' ? x.maxAbsDeltaPMw : labelForEquipment(x.equipmentId);
    const av = value(a), bv = value(b), cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv), 'tr');
    return (direction === 'asc' ? cmp : -cmp) || a.equipmentId.localeCompare(b.equipmentId);
  }

  function exportJsonFile() { const value = result(); if (value) downloadText(JSON.stringify(value, null, 2), 'GridAnalyzer-n1-screening.json', 'application/json;charset=utf-8'); }
  function exportScenariosCsv() {
    const value = result(); if (!value) return;
    const byId = catalogMap();
    const matrix: unknown[][] = [['N-1 senaryo', 'Kesinti FID', 'Ekipman', 'Tip', 'Gerilim kV', 'YTM/TM', 'Durum', 'Ada ayrılması', 'Baz P MW', 'En yüksek tahmini yüklenme %', 'İhlalli kısıt sayısı', 'En büyük |ΔP| MW', 'Kapasite kapsamı'], ...filteredCandidates(value.candidates).map(x => {
      const c = byId.get(x.candidateId), sites = c ? [...new Set([...c.fromSiteIds, ...c.toSiteIds])].map(id => ctx.network?.sites.find(s => s.id === id)?.name || id).join(', ') : '';
      return [x.candidateId, x.equipmentId, x.name, x.sourceClass === 'ElmLne' ? 'Hat' : 'Trafo', x.vnKv, sites, n1StatusLabels[x.status], x.islanding ? 'Evet' : 'Hayır', x.baseFlowMw, x.maxEstimatedLoadingPct, x.estimatedOverloadCount, x.maxDeltaPMw, x.ratingCoverage.evaluated ? `${x.ratingCoverage.ratedBranches}/${x.ratingCoverage.totalBranches} (${x.ratingCoverage.percent}%)` : 'Tarama yapılmadı'];
    })];
    downloadText(csvDocument(matrix), 'GridAnalyzer-n1-senaryolar.csv', 'text/csv;charset=utf-8');
  }
  function exportViolationsCsv() {
    const value = result(); if (!value) return;
    const rows = collectN1Violations(filteredCandidates(value.candidates));
    const matrix: unknown[][] = [['N-1 senaryo', 'Kesinti FID', 'Kesinti ekipmanı', 'Kesinti tipi', 'İhlalli dal FID', 'İhlalli ekipman', 'Dal tipi', 'Uç A', 'Uç B', 'Baz akış MW', 'Son akış MW', 'ΔP MW', 'Limit MVA', 'Baz tahmini yüklenme %', 'Son tahmini yüklenme %', 'Hesap türü'], ...rows.map(({ outage, impact }) => [outage.candidateId, outage.equipmentId, outage.name, outage.sourceClass === 'ElmLne' ? 'Hat' : 'Trafo', impact.equipmentId, labelForEquipment(impact.equipmentId), impact.sourceClass === 'ElmTr2' ? 'Trafo' : 'Hat', impact.from, impact.to, impact.baseFlowMw, impact.postFlowMw, impact.deltaPMw, impact.capacityMva, impact.baseEstimatedLoadingPct, impact.postEstimatedLoadingPct ?? impact.estimatedLoadingPct, 'P-only DC tahmini; AC doğrulaması yok'])];
    downloadText(csvDocument(matrix), 'GridAnalyzer-n1-kisit-yuklenmeleri.csv', 'text/csv;charset=utf-8');
  }

  return { controls, notice, render };
}
