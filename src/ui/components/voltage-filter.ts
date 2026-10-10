import type { AppContext } from '../../app/contracts';
import { VOLTAGE_BANDS, type VoltageBand } from '../../domain/model/voltage-band';
import { element } from './dom';
/** Shared selection and classification for every engineering view. */
export function createVoltageFilter(ctx: AppContext, name = 'Gerilim grupları') {
  const root = element('div', 'ga-voltage-layers');
  root.setAttribute('role', 'group'); root.setAttribute('aria-label', name);
  const inputs = new Map<VoltageBand, HTMLInputElement>();
  for (const band of VOLTAGE_BANDS) {
    const label = element('label', 'ga-check'), input = element('input'); input.type = 'checkbox'; input.dataset.helpId='map.voltage.'+(band.id==='low'?'low':band.id);
    input.onchange = () => {
      if (input.checked) ctx.filters.voltages.add(band.id); else ctx.filters.voltages.delete(band.id);
      ctx.filters.siteId = ''; ctx.selection = null; ctx.notify();
    };
    label.append(input, document.createTextNode(band.label)); root.append(label); inputs.set(band.id, input);
  }
  return { element: root, render() { for (const [id, input] of inputs) input.checked = ctx.filters.voltages.has(id); } };
}
