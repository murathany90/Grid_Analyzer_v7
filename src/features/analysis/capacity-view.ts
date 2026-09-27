import type { AppContext } from '../../app/contracts';
import { capacityLimit, capacitySession, loadingFromResult, removeManualCapacity, setCapacitySeason, setManualCapacity, type CapacitySeason } from '../../domain/model/capacity';
import type { Line } from '../../domain/model/network';
import { button, element, escapeHtml as h, format as f } from '../../ui/components/dom';

type CapacityFilter = 'all' | 'excel' | 'missing';

/** Reusable DGS-derived line capacity table; manual values live for this browser session and model hash. */
export function createCapacityView(ctx: AppContext) {
  const root = element('section', 'ga-capacity-view');
  const notice = element('p', 'ga-muted');
  const stats = element('div', 'ga-card-grid');
  const editor = element('form', 'ga-capacity-editor');
  const lineId = element('input'); lineId.type = 'search'; lineId.autocomplete = 'off'; lineId.placeholder = 'H5846'; lineId.setAttribute('aria-label', 'Hat FID');
  const summer = element('input'); summer.type = 'number'; summer.min = '0.01'; summer.step = 'any'; summer.setAttribute('aria-label', 'Yazlık MVA');
  const winter = element('input'); winter.type = 'number'; winter.min = '0.01'; winter.step = 'any'; winter.setAttribute('aria-label', 'Kışlık MVA');
  const message = element('p', 'ga-notice');
  const save = button('Mevsimsel kapasiteyi kaydet', () => undefined);
  save.type = 'submit';
  const remove = button('Manuel değeri kaldır', () => {
    const id = lineId.value.trim(), network = ctx.network;
    if (network && capacitySession(network.modelHash).manual.has(id)) {
      removeManualCapacity(network.modelHash, id);
      message.textContent = `${id}: manuel kapasite kaldırıldı.`;
      ctx.notify(); render(lastQuery);
    }
  });
  const idField = element('label', 'ga-field', 'Hat FID'); idField.append(lineId);
  const summerField = element('label', 'ga-field', 'Yaz MVA'); summerField.append(summer);
  const winterField = element('label', 'ga-field', 'Kış MVA'); winterField.append(winter);
  const editorActions = element('div', 'ga-capacity-actions'); editorActions.append(save, remove);
  editor.append(idField, summerField, winterField, editorActions, message);
  editor.onsubmit = (event) => {
    event.preventDefault();
    const id = lineId.value.trim(), line = ctx.network?.lines.find((item) => item.id === id);
    const summerMVA = Number(summer.value), winterMVA = Number(winter.value);
    if (!line || !(Number.isFinite(summerMVA) && summerMVA > 0 && Number.isFinite(winterMVA) && winterMVA > 0)) {
      message.textContent = 'Geçerli hat FID ve iki pozitif MVA değeri giriniz.';
      return;
    }
    setManualCapacity(ctx.network!.modelHash, id, { summer: summerMVA, winter: winterMVA });
    message.textContent = `${id}: yaz ${f(summerMVA)} MVA; kış ${f(winterMVA)} MVA · yalnız bu model oturumu; resmî işletme limiti değildir.`;
    ctx.notify(); render(lastQuery);
  };

  const controls = element('div', 'ga-analysis-controls');
  const filter = element('select'); filter.setAttribute('aria-label', 'Kapasite satır filtresi');
  filter.innerHTML = '<option value="all">Tüm hatlar</option><option value="excel">Mevsimsel referansı eşleşen</option><option value="missing">Nominal kapasitesi eksik</option>';
  const season = element('select'); season.setAttribute('aria-label', 'Yüklenme kapasitesi türü');
  season.innerHTML = '<option value="nominal">Nominal akım (DGS)</option><option value="summer">Yazlık (Excel / kullanıcı)</option><option value="winter">Kışlık (Excel / kullanıcı)</option><option value="operational">İşletme adayı (doğrulanmış manuel limit yok)</option>';
  const filterLabel = element('label', 'ga-field', 'Hat filtresi'); filterLabel.append(filter);
  const seasonLabel = element('label', 'ga-field', 'Yüklenme sınırı'); seasonLabel.append(season);
  controls.append(filterLabel, seasonLabel);
  const tableHost = element('div');
  const pager = element('div', 'ga-pager');
  root.append(notice, stats, editor, controls, tableHost, pager);

  let page = 0, lastQuery = '', previousNetwork: AppContext['network'] = null;
  filter.onchange = () => { page = 0; render(lastQuery); };
  season.onchange = () => {
    const network = ctx.network;
    if (network) setCapacitySeason(network.modelHash, season.value as CapacitySeason);
    ctx.notify(); render(lastQuery);
  };

  function pickLine(id: string): void {
    const selected = ctx.network?.lines.find((item) => item.id === id);
    if (!selected) return;
    lineId.value = id;
    const session = ctx.network ? capacitySession(ctx.network.modelHash) : null;
    const values = session?.manual.get(id);
    summer.value = values ? String(values.summer) : '';
    winter.value = values ? String(values.winter) : '';
    message.textContent = selected.capacity?.seasonalReference?.matched
      ? `Mevcut mevsimsel referans: ${selected.capacity.seasonalReference.reason}. Manuel değer kaydedilirse yalnız yaz/kış için öncelik kazanır.`
      : 'Bu hat için uyumlu mevsimsel referans yok. Pozitif yaz/kış MVA değerleri manuel olarak girilebilir.';
    editor.scrollIntoView({ block: 'nearest' });
  }

  function sourceText(line: Line): string {
    const c = line.capacity;
    if (!c) return 'Kapasite metadatası yok · hesaplanmadı';
    const seasonal = c.seasonalReference;
    const manual = ctx.network ? capacitySession(ctx.network.modelHash).manual : null;
    if (seasonal?.matched) return manual?.has(line.id) ? 'DGS + eşleşen Excel + kullanıcı parametresi' : 'DGS + eşleşen Excel';
    return manual?.has(line.id) ? 'DGS + kullanıcı parametresi' : 'DGS nominal akım';
  }

  function sectionDetails(line: Line): string {
    const c = line.capacity;
    if (!c) return '<span>Kapasite hesabı desteklenmiyor: DGS capacity metadata bulunamadı.</span>';
    const sections = c.sections.map((section) => {
      const source = section.sourceRefs.map((ref) => `${ref.sourceClass}:${ref.sourceId}.${ref.field}`).join(' · ');
      const reasons = section.unsupportedReasons.length ? `<small class="ga-capacity-unsupported">${section.unsupportedReasons.map(h).join(' ')}</small>` : '';
      return `<div class="ga-capacity-section"><b>${h(section.id || 'Ana hat türü')}</b> · ${h(section.conductor || section.typeId || 'Hat tipi yok')} · sline ${f(section.rawCurrentKA)} kA × kesit ${f(section.sectionFactor)} × hat ${f(section.lineFactor)} = ${f(section.nominalCurrentKA)} kA / ${f(section.nominalMVA)} MVA${reasons}<small>${h(source)}</small></div>`;
    }).join('');
    const ref = c.seasonalReference;
    const reference = ref ? `<div class="ga-capacity-section"><b>Mevsimsel referans: ${h(ref.matched ? 'eşleşti' : 'uygulanmadı')}</b> · ${h(ref.name)} · ${h(ref.reason)}<small>${h(ref.stationA)} → ${h(ref.stationB)} · ${f(ref.voltageKv, 0)} kV</small></div>` : '<div class="ga-capacity-section">315 hatlık mevsimsel envanterinde FID kaydı yok.</div>';
    const candidate = ref?.operationalCandidateMVA != null
      ? `<small class="ga-capacity-unsupported">Excel işletme kapasitesi adayı ${f(ref.operationalCandidateMVA)} MVA: anlamı bağımsız doğrulanmadığı için limit olarak kullanılmaz.</small>`
      : '';
    return `<details class="ga-capacity-details"><summary>Hat kapasitesi kaynakları</summary>${sections}${reference}${candidate}</details>`;
  }

  function render(query = ''): void {
    lastQuery = query;
    const network = ctx.network;
    if (network !== previousNetwork) { previousNetwork = network; lineId.value = ''; summer.value = ''; winter.value = ''; message.textContent = ''; }
    if (!network) { notice.textContent = 'Önce DGS JSON modeli yükleyin.'; stats.replaceChildren(); tableHost.replaceChildren(); pager.replaceChildren(); return; }
    const session = capacitySession(network.modelHash);
    season.value = session.season;
    const rows = network.lines.map((line) => ({ line, capacity: line.capacity }));
    const report = {
      all: rows.length,
      covered: rows.filter(({ capacity }) => capacity?.nominalMVA != null).length,
      excel: rows.filter(({ capacity }) => capacity?.seasonalReference != null).length,
      seasonalMatches: rows.filter(({ capacity }) => capacity?.seasonalReference?.matched).length,
      missing: rows.filter(({ capacity }) => capacity?.nominalMVA == null).length,
      sections: rows.filter(({ capacity }) => (capacity?.sections.length ?? 0) > 1).length,
    };
    notice.textContent = 'Nominal akım, DGS TypLne.sline × ElmLne/ElmLnesec.fline çarpanlarından ve sınırlayıcı kesitten hesaplanır. Yaz/kış yalnız FID, gerilim ve nominal/yaz MVA eşleşmesinde uygulanır; manuel MVA bu iki mevsimi oturum içinde geçersiz kılar. Excel işletme adayları limit değildir. Tam AC ratingMVA bu kapasite hesabında kullanılmaz.';
    stats.innerHTML = [
      ['Hat', report.all], ['Nominal kapasite', report.covered], ['Mevsimsel kayıt', report.excel],
      ['Uyumlu yaz referansı', report.seasonalMatches], ['Kesitli hat', report.sections], ['Kapasitesi eksik', report.missing],
    ].map(([label, value]) => `<div class="ga-card"><small>${label}</small><strong>${f(value, 0)}</strong></div>`).join('');

    const q = query.toLocaleLowerCase('tr-TR'), filterKind = filter.value as CapacityFilter;
    const filtered = rows.filter(({ line, capacity }) => {
      const ref = capacity?.seasonalReference;
      const matches = !q || `${line.name} ${line.id} ${ref?.name ?? ''}`.toLocaleLowerCase('tr-TR').includes(q);
      return matches && (filterKind === 'all' || filterKind === 'excel' && !!ref?.matched || filterKind === 'missing' && capacity?.nominalMVA == null);
    });
    const pageSize = 50, pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
    page = Math.min(Math.max(page, 0), pageCount - 1);
    const visible = filtered.slice(page * pageSize, (page + 1) * pageSize);
    const selectedSeason = session.season;
    const result = ctx.resultStore.active;
    tableHost.innerHTML = `<div class="ga-table-wrap"><table class="ga-table"><thead><tr><th>Hat</th><th>Gerilim</th><th>DGS nominal A</th><th>Nominal MVA</th><th>Yaz MVA</th><th>Kış MVA</th><th>İşletme adayı</th><th>Sınırlayıcı kesit</th><th>Yüklenme · ${h(season.options[season.selectedIndex]?.text || '')}</th><th>Kaynak / eşleşme</th></tr></thead><tbody>${visible.map(({ line, capacity }) => {
      const override = session.manual.get(line.id), summerLimit = capacity ? capacityLimit(capacity, line.vnKv, 'summer', override) : null;
      const winterLimit = capacity ? capacityLimit(capacity, line.vnKv, 'winter', override) : null;
      const selectedLimit = capacity ? capacityLimit(capacity, line.vnKv, selectedSeason, override) : null;
      const load = capacity ? loadingFromResult(line.id, capacity, line.vnKv, network.modelHash, result, selectedSeason, override) : null;
      const reference = capacity?.seasonalReference;
      const status = capacity?.quality === 'CAPACITY_UNAVAILABLE'
        ? 'DGS nominal akım/faktör/gerilim verisi yetersiz'
        : reference && !reference.matched ? reference.reason
        : selectedSeason === 'operational' ? 'İşletme limiti yok; aday doğrulanmadı'
        : selectedLimit?.source || 'Bu dönem için kapasite doğrulanmadı';
      const selectedCell = load ? `${f(load.percent)} %<small>${f(load.currentKA, 3)} kA · ${h(load.quality)} · ${h(load.source)}</small>` : '<span class="ga-muted">—</span>';
      const candidate = reference?.operationalCandidateMVA;
      const candidateCell = candidate != null
        ? `${f(candidate)} MVA<small class="ga-capacity-unsupported">Doğrulanmamış aday</small>` : '—';
      const capacitySource = reference && !reference.matched ? `DGS nominal · ${reference.reason}` : sourceText(line);
      return `<tr><td><strong>${h(line.name)}</strong><small>${h(line.id)}</small></td><td>${f(line.vnKv, 0)} kV</td><td>${f(capacity?.nominalCurrentKA == null ? null : capacity.nominalCurrentKA * 1000, 0)}</td><td>${f(capacity?.nominalMVA)}</td><td>${summerLimit ? `${f(summerLimit.mva)}<small>${override ? 'Kullanıcı parametresi' : 'MVA · '+h(summerLimit.source)}</small>` : '—'}</td><td>${winterLimit ? `${f(winterLimit.mva)}<small>${override ? 'Kullanıcı parametresi' : 'MVA · '+h(winterLimit.source)}</small>` : '—'}</td><td>${candidateCell}</td><td>${h(capacity?.limitingSectionId || 'Ana hat türü')}<small>${f(capacity?.sections.length, 0)} kapasite kaydı</small></td><td>${selectedCell}<small>${h(status)}</small></td><td>${h(capacitySource)}<button class="ga-button ga-capacity-edit" type="button" data-line="${h(line.id)}">Düzenle</button>${sectionDetails(line)}</td></tr>`;
    }).join('')}</tbody></table></div>`;
    pager.replaceChildren(
      button('Önceki', () => { page--; render(lastQuery); }),
      element('span', '', `${f(filtered.length, 0)} hat · Sayfa ${page + 1}/${pageCount}`),
      button('Sonraki', () => { page++; render(lastQuery); }),
    );
    (tableHost as HTMLElement).querySelectorAll<HTMLButtonElement>('[data-line]').forEach((control) => {
      control.onclick = () => pickLine(control.dataset.line || '');
    });
  }

  return { element: root, render };
}
