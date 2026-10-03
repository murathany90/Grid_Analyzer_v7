import type { AnalysisSettingsStore, FullAcProfile } from '../../domain/calculation/analysis-settings';
import { defaultAnalysisSettings } from '../../domain/calculation/analysis-settings';
import { button, element } from '../../ui/components/dom';
import { powerFactoryLoadFlowSettings, type PowerFactoryReference } from '../../analysis/validation/powerfactory-reference';

export function createAnalysisSettingsDialog(store: AnalysisSettingsStore, changed: () => void) {
  const dialog = element('dialog', 'ga-analysis-settings'), body = element('div', 'ga-panel'), tabs = element('div', 'ga-tabs-small'), panel = element('div', 'ga-analysis-settings-content');
  let active: 'powerFlow' | 'fastAc' | 'dc' = 'powerFlow';
  let reference: PowerFactoryReference | null = null;
  const close = button('Kapat', () => dialog.close());
  const header = element('header', 'ga-analysis-settings-header'); header.append(element('h2', '', 'Hesap Ayarları'), close);
  const save = () => { store.update(store.value); changed(); render(); };
  function field(label: string, key: string, value: number, min: number, max: number, step: number, unit = '') {
    const wrap = element('label', 'ga-analysis-setting'); wrap.append(element('span', '', label));
    const input = element('input'); input.type = 'number'; input.min = String(min); input.max = String(max); input.step = String(step); input.value = String(value);
    input.onchange = () => { const v = Number(input.value); if (!Number.isFinite(v) || v < min || v > max) { input.value = String(value); return; }
      if (active === 'powerFlow') Object.assign(store.value.powerFlow, { [key]: v, profile: 'CUSTOM' as FullAcProfile });
      else Object.assign(store.value[active], { [key]: v }); save(); };
    wrap.append(input); if (unit) wrap.append(element('small', '', unit)); return wrap;
  }
  function select(label: string, value: string, options: Array<[string, string]>, changedValue: (value: string) => void) {
    const wrap = element('label', 'ga-analysis-setting'); wrap.append(element('span', '', label)); const input = element('select');
    input.innerHTML = options.map(([v, name]) => `<option value="${v}">${name}</option>`).join(''); input.value = value; input.onchange = () => changedValue(input.value); wrap.append(input); return wrap;
  }
  function toggle(label: string, value: boolean, set: (v: boolean) => void) { const wrap = element('label', 'ga-analysis-setting ga-analysis-setting-toggle'), input = element('input'); input.type = 'checkbox'; input.checked = value; input.onchange = () => set(input.checked); wrap.append(input, element('span', '', label)); return wrap; }
  function render() {
    tabs.replaceChildren(); for (const [key, title] of [['powerFlow', 'Tam AC'], ['fastAc', 'Hızlı AC'], ['dc', 'DC']] as const) { const tab = button(title, () => { active = key; render(); }); tab.setAttribute('aria-pressed', String(active === key)); tabs.append(tab); }
    panel.replaceChildren(); const s = store.value;
    if (active === 'powerFlow') {
      panel.append(select('Profil', s.powerFlow.profile, [['POWERFACTORY_TEIAS_PARITY', 'PowerFactory / TEİAŞ Parity'], ['GA_ROBUST', 'GA Robust'], ['CUSTOM', 'Custom']], value => {
        const defaults = defaultAnalysisSettings(); if (value === 'POWERFACTORY_TEIAS_PARITY') store.value.powerFlow = defaults.powerFlow;
        else if (value === 'GA_ROBUST') store.value.powerFlow = { ...defaults.powerFlow, profile: 'GA_ROBUST', activeBalancingMode: 'SINGLE_REFERENCE', stationControlMode: 'off', maxInnerIterations: 30, maxOuterIterations: 8, nodalToleranceKva: 100 };
        else store.value.powerFlow.profile = 'CUSTOM'; save();
      }));
      const detected = reference ? powerFactoryLoadFlowSettings(reference) : null;
      const semanticText = detected && Object.keys(detected.semantic).length ? Object.entries(detected.semantic).map(([key, value]) => `${key}: ${value}`).join(' · ') : detected && Object.keys(detected.raw).length ? 'Ayar alanları bulundu; enum değerleri için semantik etiket yok.' : 'Referans ayar metadata alanı bulunamadı.';
      panel.append(element('p', 'ga-notice', `PowerFactory Ayarları Algılandı: ${semanticText}`));
      const applyReference = button('Referans ayarlarını uygula', () => {
        if (!detected) return;
        const mapping: Record<string, (value: string) => void> = {
          activeBalancingMode: value => { if (value === 'Distributed Slack by Loads') store.value.powerFlow.activeBalancingMode = 'DISTRIBUTED_ADJUSTABLE_LOADS'; else if (value === 'Single Reference') store.value.powerFlow.activeBalancingMode = 'SINGLE_REFERENCE'; },
          stationControlMode: value => { if (value === 'Zero Droop') store.value.powerFlow.stationControlMode = 'zeroDroop'; else if (value === 'Droop') store.value.powerFlow.stationControlMode = 'droop'; else if (value === 'Off') store.value.powerFlow.stationControlMode = 'off'; },
          reactiveLimitsEnabled: value => { if (value === 'ON') store.value.powerFlow.reactiveLimitsEnabled = true; else if (value === 'OFF') store.value.powerFlow.reactiveLimitsEnabled = false; },
          maxInnerIterations: value => { const v = Number(value); if (Number.isFinite(v)) store.value.powerFlow.maxInnerIterations = v; }, maxOuterIterations: value => { const v = Number(value); if (Number.isFinite(v)) store.value.powerFlow.maxOuterIterations = v; },
          nodalToleranceKva: value => { const v = Number(value.replace(/\s*kva$/i, '')); if (Number.isFinite(v)) store.value.powerFlow.nodalToleranceKva = v; },
          modelEquationTolerancePercent: value => { const v = Number(value.replace(/\s*%$/, '')); if (Number.isFinite(v)) store.value.powerFlow.modelEquationTolerancePercent = v; }
        };
        for (const [key, value] of Object.entries(detected.semantic)) mapping[key]?.(value);
        store.value.powerFlow.profile = 'CUSTOM';
        save();
      });
      applyReference.disabled = !detected || !Object.keys(detected.semantic).some(key => key in ({activeBalancingMode:1,stationControlMode:1,reactiveLimitsEnabled:1,maxInnerIterations:1,maxOuterIterations:1,nodalToleranceKva:1,modelEquationTolerancePercent:1})); panel.append(applyReference);
      panel.append(select('Aktif güç dengeleme', s.powerFlow.activeBalancingMode, [['SINGLE_REFERENCE', 'Tek referans'], ['DISTRIBUTED_ADJUSTABLE_LOADS', 'Ayarlanabilir yüklerle dağıtılmış']], value => { s.powerFlow.activeBalancingMode = value as typeof s.powerFlow.activeBalancingMode; s.powerFlow.profile = 'CUSTOM'; save(); }));
      panel.append(thisNumber('Maks. Newton adımı', 'maxInnerIterations', s.powerFlow.maxInnerIterations, 1, 10000, 1), thisNumber('Maks. dış kontrol adımı', 'maxOuterIterations', s.powerFlow.maxOuterIterations, 1, 10000, 1), thisNumber('Düğüm toleransı', 'nodalToleranceKva', s.powerFlow.nodalToleranceKva, .001, 1e6, .1, 'kVA'), thisNumber('Model denklem toleransı', 'modelEquationTolerancePercent', s.powerFlow.modelEquationTolerancePercent, .001, 100, .01, '%'), thisNumber('İyileşmesiz adım eşiği', 'maxNoImprovementIterations', s.powerFlow.maxNoImprovementIterations, 1, 10000, 1), thisNumber('Tekrarlı Q sınırı algılama', 'repeatedReactiveLimitDetection', s.powerFlow.repeatedReactiveLimitDetection, 1, 1000, 1), thisNumber('Q sınırı toleransı', 'qLimitToleranceMvar', s.powerFlow.qLimitToleranceMvar, 0, 10000, .01, 'MVAr'));
      panel.append(toggle('Reaktif güç limitleri', s.powerFlow.reactiveLimitsEnabled, v => { s.powerFlow.reactiveLimitsEnabled = v; s.powerFlow.profile = 'CUSTOM'; save(); }));
      const activeLimits = element('label', 'ga-analysis-setting'); activeLimits.append(element('span', '', 'Aktif güç limitleri')); activeLimits.append(element('strong', '', 'Kapalı · motor seçeneği')); panel.append(activeLimits);
      panel.append(select('İstasyon kontrolü', s.powerFlow.stationControlMode, [['off', 'Kapalı'], ['zeroDroop', 'Sıfır droop'], ['droop', 'Droop']], value => { s.powerFlow.stationControlMode = value as typeof s.powerFlow.stationControlMode; s.powerFlow.profile = 'CUSTOM'; save(); }));
    } else {
      if (active === 'fastAc') {
        const f = s.fastAc;
        panel.append(thisNumber('En düşük gerilim seviyesi', 'minVoltageKv', f.minVoltageKv, 1, 1000, 1, 'kV'), thisNumber('Yaklaşık AC iterasyonu', 'maxIterations', f.maxIterations, 1, 100000, 1), thisNumber('NR artık toleransı', 'mismatchTolerance', f.mismatchTolerance, 1e-12, 1, 1e-5, 'pu'), thisNumber('Newton iyileştirme adımı', 'nrRefinementMaxIterations', f.nrRefinementMaxIterations, 1, 10000, 1), thisNumber('Maks. Q limit turu', 'maxQLimitRounds', f.maxQLimitRounds, 1, 10000, 1));
        panel.append(toggle('Newton iyileştirmesi', f.nrRefinementEnabled, v => { f.nrRefinementEnabled = v; save(); }), toggle('PV gerilim kontrolleri', f.usePvControls, v => { f.usePvControls = v; save(); }), toggle('Q limitlerini dikkate al', f.considerQLimits, v => { f.considerQLimits = v; save(); }));
        panel.append(select('Newton başarısızlığında', f.fallbackPolicy, [['APPROXIMATE', 'Yaklaşık sonucu koru'], ['FAIL', 'Başarısız işaretle']], value => { f.fallbackPolicy = value as typeof f.fallbackPolicy; save(); }));
        panel.append(element('p', 'ga-muted', 'Hızlı AC indirgenmiş modelde çalışır; Q ve kontrol sadakati kısmi raporlanır.'));
      } else {
        const d = s.dc;
        panel.append(thisNumber('En düşük gerilim seviyesi', 'minVoltageKv', d.minVoltageKv, 1, 1000, 1, 'kV'), thisNumber('Maks. doğrusal iterasyon', 'maxLinearIterations', d.maxLinearIterations, 1, 1000000, 1), thisNumber('Göreli artık toleransı', 'relativeResidualTolerance', d.relativeResidualTolerance, 1e-12, 1, 1e-8));
        const balancing = element('label', 'ga-analysis-setting'); balancing.append(element('span', '', 'Aktif güç dengeleme')); balancing.append(element('strong', '', 'Tek referans')); panel.append(balancing);
        panel.append(element('p', 'ga-muted', 'DC yalnız aktif güç ve açı hesabıdır; Q ve gerilim ayarları bulunmaz.'));
      }
    }
  }
  function thisNumber(label: string, key: string, value: number, min: number, max: number, step: number, unit = '') { return field(label, key, value, min, max, step, unit); }
  dialog.append(header, body); body.append(tabs, panel); dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  function open() { render(); if (!dialog.open) dialog.showModal(); }
  render(); return { element: dialog, open, setReference(value: PowerFactoryReference | null) { reference = value; if (dialog.open) render(); } };
}
