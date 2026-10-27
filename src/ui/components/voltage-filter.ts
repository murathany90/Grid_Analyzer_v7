import type { AppContext } from '../../app/contracts';
import { VOLTAGE_BANDS, type VoltageBand } from '../../domain/model/voltage-band';
import { element,button } from './dom';
/** Target of a voltage band multi-select: the owned Set plus its commit side effects. */
export interface VoltageFilterTarget { voltages: Set<VoltageBand>; onCommit(): void }
/** Shared selection and classification for every engineering view. */
export function createVoltageFilter(ctx: AppContext, name = 'Gerilim grupları', compact=false,preserveSelection=false) {
  return createVoltageFilterFor({
    // Resolved per access: controller replaces the whole `filters` object on
    // every model load, so a captured Set reference would go stale.
    get voltages() { return ctx.filters.voltages; },
    onCommit() { ctx.filters.siteId = ''; if (!preserveSelection) ctx.selection = null; ctx.notify(); },
  }, name, compact);
}
/** Voltage band multi-select bound to an explicit target Set (map display scope uses its own). */
export function createVoltageFilterFor(target: VoltageFilterTarget, name = 'Gerilim grupları', compact=false) {
  const root = element('div', 'ga-voltage-layers');
  root.setAttribute('role', 'group'); root.setAttribute('aria-label', name);
  const inputs = new Map<VoltageBand, HTMLInputElement>();
  for (const band of VOLTAGE_BANDS) {
    const label = element('label', 'ga-check'), input = element('input'); input.type = 'checkbox'; input.dataset.helpId='map.voltage.'+(band.id==='low'?'low':band.id);
    input.onchange = () => {
      if (input.checked) target.voltages.add(band.id); else target.voltages.delete(band.id);
      target.onCommit();
    };
    label.append(input, document.createTextNode(band.label)); root.append(label); inputs.set(band.id, input);
  }
  const menu=element('details','ga-map-menu ga-voltage-menu'),summary=element('summary'),text=element('span','','Gerilim'),count=element('span'),body=element('div','ga-map-menu-body'),actions=element('div','ga-menu-actions');text.dataset.helpId='map.voltages';text.dataset.helpLabel='Gerilim';text.tabIndex=0;summary.append(text,count);
  const choose=(all:boolean)=>{target.voltages.clear();if(all)for(const band of VOLTAGE_BANDS)target.voltages.add(band.id);target.onCommit();};
  actions.append(button('Tümünü seç',()=>choose(true)),button('Temizle',()=>choose(false)));body.append(root,actions);menu.append(summary,body);
  return { element:compact?menu:root as HTMLElement, render() { for (const [id, input] of inputs) input.checked = target.voltages.has(id);count.textContent=target.voltages.size===VOLTAGE_BANDS.length?'Tümü':target.voltages.size?`${target.voltages.size}/${VOLTAGE_BANDS.length}`:'Seçim yok'; } };
}
