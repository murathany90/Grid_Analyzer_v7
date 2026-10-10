import type { AppContext } from '../../app/contracts';
import { VOLTAGE_BANDS, type VoltageBand } from '../../domain/model/voltage-band';
import { element,button } from './dom';
/** Shared selection and classification for every engineering view. */
export function createVoltageFilter(ctx: AppContext, name = 'Gerilim grupları', compact=false) {
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
  const menu=element('details','ga-map-menu ga-voltage-menu'),summary=element('summary'),body=element('div','ga-map-menu-body'),actions=element('div','ga-menu-actions');summary.dataset.helpId='map.voltages';
  const choose=(all:boolean)=>{ctx.filters.voltages.clear();if(all)for(const band of VOLTAGE_BANDS)ctx.filters.voltages.add(band.id);ctx.filters.siteId='';ctx.selection=null;ctx.notify();};
  actions.append(button('Tümünü seç',()=>choose(true)),button('Temizle',()=>choose(false)));body.append(root,actions);menu.append(summary,body);
  return { element:compact?menu:root, render() { for (const [id, input] of inputs) input.checked = ctx.filters.voltages.has(id);summary.textContent=ctx.filters.voltages.size===5?'Gerilimler · Tümü':ctx.filters.voltages.size?`Gerilimler · ${ctx.filters.voltages.size}/5`:'Gerilimler · Seçim yok'; } };
}
