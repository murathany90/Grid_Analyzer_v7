import type { AppContext } from '../../app/contracts';
import { element, button, escapeHtml as h } from './dom';
import { mapAreaScopeLabel } from '../../map/area-scope';
/**
 * Map-only YTM (area) multi-select. Writes `ctx.mapDisplay` — never the
 * shared analytical `filters.areaId`. Tri-state: all boxes checked → ALL,
 * none → NONE, partial → SELECTED with the union of the chosen areas.
 */
export function createMapAreaFilter(ctx: AppContext, onChange: () => void) {
  let areas: { id: string; name: string }[] = [];
  const inputs = new Map<string, HTMLInputElement>();
  const menu = element('details', 'ga-map-menu ga-area-menu'), summary = element('summary'), text = element('span', '', 'YTM'), count = element('span'), body = element('div', 'ga-map-menu-body');
  summary.id = 'mapArea';
  const search = element('input') as HTMLInputElement;
  const list = element('div', 'ga-area-list'), actions = element('div', 'ga-menu-actions');
  text.dataset.helpId = 'map.area'; text.dataset.helpLabel = 'YTM'; text.tabIndex = 0;
  summary.append(text, count);
  search.type = 'search'; search.placeholder = 'YTM ara'; search.setAttribute('aria-label', 'YTM listesinde ara'); search.dataset.helpId = 'map.area';
  list.setAttribute('role', 'group'); list.setAttribute('aria-label', 'YTM filtresi');
  search.oninput = () => applyFilter();
  const applyFilter = () => {
    const q = search.value.trim().toLocaleLowerCase('tr-TR');
    for (const [id, input] of inputs) {
      const row = input.closest('label') as HTMLElement;
      row.hidden = !!q && !areas.find(area => area.id === id && area.name.toLocaleLowerCase('tr-TR').includes(q));
    }
  };
  const collectChecked = (): string[] => areas.filter(area => inputs.get(area.id)?.checked).map(area => area.id);
  const commit = () => {
    const checked = collectChecked();
    ctx.mapDisplay.areaIds = checked;
    ctx.mapDisplay.areaMode = checked.length === 0 ? 'NONE' : checked.length === areas.length ? 'ALL' : 'SELECTED';
    ctx.mapDisplay.siteId = ''; ctx.selection = null;
    ctx.notify();
    onChange();
  };
  const choose = (all: boolean) => {
    ctx.mapDisplay.areaMode = all ? 'ALL' : 'NONE';
    ctx.mapDisplay.areaIds = [];
    ctx.mapDisplay.siteId = ''; ctx.selection = null;
    ctx.notify();
    onChange();
  };
  actions.append(button('Tümünü seç', () => choose(true)), button('Temizle', () => choose(false)));
  body.append(search, list, actions);
  menu.append(summary, body);
  const rebuild = () => {
    inputs.clear();
    list.innerHTML = areas.map(area => `<label class="ga-check"><input type="checkbox" value="${h(area.id)}" data-help-id="map.area"><span>${h(area.name)}</span></label>`).join('');
    for (const input of list.querySelectorAll<HTMLInputElement>('input[type=checkbox]')) {
      inputs.set(input.value, input);
      input.onchange = commit;
    }
    applyFilter();
  };
  return {
    element: menu as HTMLElement,
    /** Rebuild the option list for a newly loaded model (areaId/areaName pairs). */
    setAreas(next: { id: string; name: string }[]) {
      areas = [...next].sort((a, b) => a.name.localeCompare(b.name, 'tr'));
      rebuild();
      this.render();
    },
    render() {
      const mode = ctx.mapDisplay.areaMode, ids = ctx.mapDisplay.areaIds;
      for (const [id, input] of inputs) input.checked = mode === 'ALL' || (mode === 'SELECTED' && ids.includes(id));
      count.textContent = mapAreaScopeLabel(ctx.mapDisplay, inputs.size);
      count.title = mode === 'SELECTED' ? `${ids.length} YTM seçili` : mode === 'ALL' ? 'Tüm YTM görüntüleniyor' : 'Hiçbir YTM görüntülenmiyor';
    },
  };
}
