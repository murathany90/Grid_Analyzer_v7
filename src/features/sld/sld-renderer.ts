import type { Bus, Site } from '../../domain/model/network';
import type { CatalogRow } from '../../app/contracts';

export type SldScope = 'station' | 'bay' | 'regional';

export interface SldEquipment {
  id: string;
  name: string;
  sourceClass: string;
  busIds: readonly string[];
  siteIds: readonly string[];
  inService: boolean;
  closed?: boolean;
  fromSiteId?: string;
  toSiteId?: string;
  voltageKv?: number;
}

export interface SldBusGroup { id: string; name: string; buses: readonly Bus[] }
export interface SldTerminal { id: string; name: string; bayId: string; external: boolean; equipment: readonly SldEquipment[] }
export interface SldSwitch {
  id: string; name: string; sourceClass: 'ElmCoup'; kind: 'breaker' | 'isolator' | 'other';
  from: string | null; to: string | null; modelClosed: boolean; closed: boolean; inService: boolean;
}
export interface SldRegionalBranch extends SldEquipment { fromSiteId: string; toSiteId: string }
export interface SldDiagram {
  scope: SldScope;
  orientation: 'horizontal' | 'vertical';
  station: Site;
  selectedId: string | null;
  groups: readonly SldBusGroup[];
  equipment: readonly SldEquipment[];
  bays: readonly CatalogRow[];
  selectedBay: CatalogRow | null;
  terminals: readonly SldTerminal[];
  switches: readonly SldSwitch[];
  regionalSites: readonly Site[];
  regionalBranches: readonly SldRegionalBranch[];
  unresolvedSwitches: number;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const colors = { ink: '#d9eaf0', muted: '#9bb3c1', edge: '#6389a0', bus: '#8bd6e1', line: '#72b8ed', transformer: '#c8b2ef', switch: '#79e0bf', open: '#ffc57e', load: '#ecd48b', generator: '#82d7ac', selected: '#ffe382', out: '#e9868e' };
type Select = (id: string, sourceClass: string) => void;

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, parent?: SVGElement): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  parent?.appendChild(node);
  return node;
}

function text(parent: SVGElement, x: number, y: number, value: string, opts: { size?: number; fill?: string; anchor?: 'start' | 'middle' | 'end'; weight?: string } = {}): SVGTextElement {
  const node = svg('text', { x, y, fill: opts.fill || colors.ink, 'font-size': opts.size || 12, 'font-family': 'system-ui, sans-serif', 'text-anchor': opts.anchor || 'start', 'font-weight': opts.weight || '400' }, parent);
  node.textContent = value;
  return node;
}

function namedGroup(parent: SVGElement, id: string, sourceClass: string, name: string, selected: boolean, select: Select): SVGGElement {
  const group = svg('g', { 'data-id': id, 'data-class': sourceClass, role: 'button', tabindex: 0, 'aria-label': `${name} · ${sourceClass} · ${id}`, class: selected ? 'ga-sld-selected' : 'ga-sld-selectable' }, parent);
  group.addEventListener('click', () => select(id, sourceClass));
  group.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(id, sourceClass); } });
  const title = svg('title', {}, group); title.textContent = `${name} · ${sourceClass} · ${id}`;
  return group;
}

function symbol(parent: SVGElement, item: SldEquipment, x: number, y: number, selected: boolean, select: Select, label = true): SVGGElement {
  const group = namedGroup(parent, item.id, item.sourceClass, item.name || item.id, selected, select);
  const color = selected ? colors.selected : item.inService ? symbolColor(item.sourceClass) : colors.out;
  if (item.sourceClass === 'ElmTr2' || item.sourceClass === 'ElmNec') {
    svg('circle', { cx: x - 6, cy: y, r: 8, fill: '#172c3e', stroke: color, 'stroke-width': 2.2 }, group);
    svg('circle', { cx: x + 6, cy: y, r: 8, fill: '#172c3e', stroke: color, 'stroke-width': 2.2 }, group);
  } else if (item.sourceClass === 'ElmLne' || item.sourceClass === 'ElmScap') {
    svg('path', { d: `M${x - 11},${y + 7} L${x - 5},${y - 7} L${x + 1},${y + 7} L${x + 7},${y - 7} L${x + 12},${y + 7}`, fill: 'none', stroke: color, 'stroke-width': 2.2 }, group);
  } else if (item.sourceClass === 'ElmLod' || item.sourceClass === 'ElmShnt') {
    svg('circle', { cx: x, cy: y, r: 10, fill: '#203b4f', stroke: color, 'stroke-width': 1.8 }, group);
    text(group, x, y + 4, item.sourceClass === 'ElmLod' ? 'Y' : 'S', { size: 11, fill: colors.ink, anchor: 'middle', weight: '700' });
  } else if (/Elm(Sym|GenStat|Xnet|Vac)/.test(item.sourceClass)) {
    svg('circle', { cx: x, cy: y, r: 10, fill: '#203b4f', stroke: color, 'stroke-width': 1.8 }, group);
    text(group, x, y + 4, 'G', { size: 11, fill: colors.ink, anchor: 'middle', weight: '700' });
  } else {
    svg('rect', { x: x - 8, y: y - 8, width: 16, height: 16, rx: 2, fill: '#203b4f', stroke: color, 'stroke-width': 1.8 }, group);
  }
  if (label) {
    const display = item.name && item.name !== item.id ? `${item.name} · ${item.id}` : item.id;
    text(group, x, y + 25, display.length > 40 ? `${display.slice(0, 37)}…` : display, { size: 10, fill: colors.muted, anchor: 'middle' });
  }
  return group;
}

function symbolColor(sourceClass: string): string {
  if (sourceClass === 'ElmLne' || sourceClass === 'ElmScap') return colors.line;
  if (sourceClass === 'ElmTr2' || sourceClass === 'ElmNec') return colors.transformer;
  if (sourceClass === 'ElmLod' || sourceClass === 'ElmShnt') return colors.load;
  if (/Elm(Sym|GenStat|Xnet|Vac)/.test(sourceClass)) return colors.generator;
  return colors.edge;
}

function baseSvg(host: HTMLElement, viewBox: string, aria: string): SVGSVGElement {
  host.replaceChildren();
  const [, , width = '1200', height = '800'] = viewBox.split(/\s+/);
  const root = svg('svg', { xmlns: SVG_NS, viewBox, width, height, role: 'img', 'aria-label': aria, class: 'ga-sld-svg', preserveAspectRatio: 'xMinYMin meet' });
  root.style.display = 'block'; root.style.width = `${Number(width)}px`; root.style.height = `${Number(height)}px`; root.style.maxWidth = 'none'; root.style.margin = '0 auto'; root.style.background = '#102033'; root.style.border = '1px solid #35546a'; root.style.borderRadius = '8px';
  host.style.display = 'block'; host.style.maxHeight = '70vh'; host.style.maxWidth = '100%'; host.style.overflow = 'auto';
  host.appendChild(root);
  return root;
}

function renderStation(host: HTMLElement, diagram: SldDiagram, select: Select): void {
  const groups = diagram.groups.length ? diagram.groups : [{ id: diagram.station.id, name: 'Baralar', buses: [] as readonly Bus[] }];
  const cols = Math.min(3, Math.max(1, groups.length));
  const groupHeights: number[] = [];
  for (let row = 0; row < Math.ceil(groups.length / cols); row++) {
    groupHeights.push(Math.max(...groups.slice(row * cols, (row + 1) * cols).map(g => 92 + Math.max(1, g.buses.length) * 62)));
  }
  const rowY: number[] = []; let totalHeight = 90;
  for (const height of groupHeights) { rowY.push(totalHeight); totalHeight += height + 22; }
  const width = 70 + cols * 430, height = totalHeight + 45;
  const root = baseSvg(host, `0 0 ${width} ${height}`, `${diagram.station.name} trafo merkezi bara ve ekipman şeması`);
  text(root, 26, 35, `${diagram.station.name} · bara ve dal bağlantıları`, { size: 20, fill: '#fff0cb', weight: '650' });
  text(root, 26, 59, 'DGS kaynak ilişkilerinden otomatik yerleşim · fiziksel PowerFactory çizimi değildir', { size: 12, fill: colors.muted });

  const busById = new Map<string, Bus>(); const busPosition = new Map<string, [number, number]>();
  groups.forEach((group, groupIndex) => {
    const column = groupIndex % cols, row = Math.floor(groupIndex / cols), x = 36 + column * 430, y = rowY[row];
    const cardHeight = Math.max(92 + Math.max(1, group.buses.length) * 62, groupHeights[row]);
    svg('rect', { x, y, width: 405, height: cardHeight - 10, rx: 8, fill: '#172c3e', stroke: '#45647a' }, root);
    text(root, x + 14, y + 23, group.name, { size: 13, fill: '#b9e4f3', weight: '600' });
    const buses = group.buses.slice().sort((a, b) => a.name.localeCompare(b.name, 'tr') || a.id.localeCompare(b.id));
    if (!buses.length) { text(root, x + 16, y + 55, 'Bara kaydı bulunamadı.', { size: 11, fill: colors.muted }); return; }
    buses.forEach((bus, index) => {
      busById.set(bus.id, bus);
      const bx = x + 220, by = y + 58 + index * 62;
      busPosition.set(bus.id, [bx, by]);
      const busGroup = namedGroup(root, bus.id, bus.sourceClass, bus.name || bus.id, diagram.selectedId === bus.id, select);
      svg('line', { x1: bx - 85, y1: by, x2: bx + 85, y2: by, stroke: diagram.selectedId === bus.id ? colors.selected : colors.bus, 'stroke-width': 6, 'stroke-linecap': 'round' }, busGroup);
      text(busGroup, bx, by - 8, `${bus.name || bus.id} · ${bus.vnKv} kV`, { size: 11, anchor: 'middle', fill: colors.ink, weight: '600' });
      text(busGroup, bx, by + 17, bus.id, { size: 9, anchor: 'middle', fill: colors.muted });
    });
  });

  const busDevices = new Map<string, SldEquipment[]>();
  for (const item of diagram.equipment) {
    if (item.sourceClass === 'ElmLne' || item.sourceClass === 'ElmTr2' || item.sourceClass === 'ElmCoup') continue;
    for (const id of item.busIds) { const list = busDevices.get(id) || []; list.push(item); busDevices.set(id, list); }
  }
  const pairOffsets = new Map<string, number>();
  for (const item of diagram.equipment) {
    if (!['ElmLne', 'ElmTr2', 'ElmCoup', 'ElmScap'].includes(item.sourceClass)) continue;
    const [a, b] = item.busIds;
    if (!a || !busPosition.has(a)) continue;
    const [ax, ay] = busPosition.get(a)!; const onB = Boolean(b && busPosition.has(b));
    let bx = ax + 120, by = ay;
    if (onB) [bx, by] = busPosition.get(b!)!;
    const pair = onB ? [a, b!].sort().join('|') : `${a}|external`;
    const ix = pairOffsets.get(pair) || 0; pairOffsets.set(pair, ix + 1);
    const offset = (ix - 1) * 12, midX = (ax + bx) / 2, midY = (ay + by) / 2 + offset;
    const edgeGroup = namedGroup(root, item.id, item.sourceClass, item.name || item.id, diagram.selectedId === item.id, select);
    if (item.sourceClass === 'ElmCoup') {
      svg('line', { x1: ax, y1: ay + offset, x2: midX - 12, y2: midY, stroke: colors.edge, 'stroke-width': 2 }, edgeGroup);
      svg('line', { x1: midX + 12, y1: midY, x2: bx, y2: by + offset, stroke: colors.edge, 'stroke-width': 2 }, edgeGroup);
      const closed = item.closed ?? item.inService;
      svg('rect', { x: midX - 10, y: midY - 8, width: 20, height: 16, rx: 2, fill: '#172c3e', stroke: item.inService ? (closed ? colors.switch : colors.open) : colors.out, 'stroke-width': 2 }, edgeGroup);
      svg('line', { x1: midX - 6, y1: midY - 5, x2: midX + 5, y2: midY + (closed ? -5 : 5), stroke: colors.ink, 'stroke-width': 2 }, edgeGroup);
    } else {
      svg('path', { d: `M${ax},${ay + offset} Q${midX},${midY} ${bx},${by + offset}`, fill: 'none', stroke: diagram.selectedId === item.id ? colors.selected : item.inService ? symbolColor(item.sourceClass) : colors.out, 'stroke-width': item.sourceClass === 'ElmTr2' ? 2.4 : 1.8, 'stroke-dasharray': item.inService ? '' : '7 5' }, edgeGroup);
      if (item.sourceClass === 'ElmTr2') {
        svg('circle', { cx: midX - 6, cy: midY, r: 8, fill: '#172c3e', stroke: colors.transformer, 'stroke-width': 2 }, edgeGroup);
        svg('circle', { cx: midX + 6, cy: midY, r: 8, fill: '#172c3e', stroke: colors.transformer, 'stroke-width': 2 }, edgeGroup);
      } else if (item.sourceClass === 'ElmLne' || item.sourceClass === 'ElmScap') {
        svg('path', { d: `M${midX - 8},${midY + 6} L${midX - 3},${midY - 6} L${midX + 2},${midY + 6} L${midX + 7},${midY - 6}`, fill: 'none', stroke: colors.line, 'stroke-width': 2 }, edgeGroup);
      }
    }
    const label = item.name && item.name !== item.id ? `${item.name} · ${item.id}` : item.id;
    text(edgeGroup, midX, midY - 13, label.length > 38 ? `${label.slice(0, 35)}…` : label, { size: 9, anchor: 'middle', fill: colors.ink });
    const title = svg('title', {}, edgeGroup); title.textContent = `${item.name} · ${item.sourceClass} · ${item.id}${onB ? '' : ' · diğer TM bağlantısı'}`;
  }
  const stubCounts = new Map<string, number>();
  for (const [busId, devices] of busDevices) {
    const pos = busPosition.get(busId); if (!pos) continue;
    const [bx, by] = pos;
    devices.slice(0, 8).forEach((item, index) => {
      const side = index % 2 ? 1 : -1, lane = Math.floor(index / 2), x = bx + side * (116 + lane * 75), y = by + (index % 2 ? 18 : -18);
      svg('line', { x1: bx + side * 85, y1: by, x2: x - side * 14, y2: y, stroke: '#6a93aa', 'stroke-width': 1.3 }, root);
      symbol(root, item, x, y, diagram.selectedId === item.id, select, false);
      const label = item.name && item.name !== item.id ? `${item.name} · ${item.id}` : item.id;
      text(root, x, y + 24, label.length > 24 ? `${label.slice(0, 21)}…` : label, { size: 8, anchor: 'middle', fill: colors.muted });
    });
    if (devices.length > 8) stubCounts.set(busId, devices.length - 8);
  }
  for (const [busId, count] of stubCounts) {
    const pos = busPosition.get(busId)!; text(root, pos[0] + 6, pos[1] + 34, `+${count} bağlı ekipman`, { size: 9, fill: colors.muted, anchor: 'middle' });
  }
}

function renderBay(host: HTMLElement, diagram: SldDiagram, select: Select): void {
  const bay = diagram.selectedBay!;
  const adj = new Map<string, string[]>();
  for (const terminal of diagram.terminals) adj.set(terminal.id, []);
  for (const edge of diagram.switches) if (edge.from && edge.to && adj.has(edge.from) && adj.has(edge.to)) {
    adj.get(edge.from)!.push(edge.to); adj.get(edge.to)!.push(edge.from);
  }
  const levels = new Map<string, number>(), roots = diagram.terminals.filter(t => t.external).map(t => t.id);
  const queue = roots.length ? roots : diagram.terminals.slice(0, 1).map(t => t.id);
  for (const id of queue) levels.set(id, 0);
  for (let i = 0; i < queue.length; i++) for (const next of adj.get(queue[i]) || []) if (!levels.has(next)) { levels.set(next, levels.get(queue[i])! + 1); queue.push(next); }
  let nextLevel = Math.max(0, ...levels.values()) + 1;
  for (const terminal of diagram.terminals) if (!levels.has(terminal.id)) levels.set(terminal.id, nextLevel++);
  const bands = new Map<number, SldTerminal[]>();
  for (const terminal of diagram.terminals) { const level = levels.get(terminal.id) || 0, rows = bands.get(level) || []; rows.push(terminal); bands.set(level, rows); }
  for (const band of bands.values()) band.sort((a, b) => a.name.localeCompare(b.name, 'tr') || a.id.localeCompare(b.id));
  const horizontal = diagram.orientation === 'horizontal', maxLevel = Math.max(0, ...bands.keys()), maxRows = Math.max(1, ...[...bands.values()].map(v => v.length));
  const width = horizontal ? Math.max(1120, 300 + maxLevel * 260) : Math.max(1100, 260 + maxRows * 190);
  const height = horizontal ? Math.max(600, 230 + maxRows * 145) : Math.max(650, 230 + maxLevel * 220);
  const root = baseSvg(host, `0 0 ${width} ${height}`, `${diagram.station.name} ${bay.name} fider bağlantı şeması`);
  text(root, 24, 34, `${bay.name || bay.id} · ${bay.id}`, { size: 20, fill: '#fff0cb', weight: '650' });
  text(root, 24, 59, `${diagram.terminals.length} terminal · ${diagram.switches.length} anahtar · StaCubic → ElmTerm kaynak uçları`, { size: 12, fill: colors.muted });
  const position = new Map<string, [number, number]>();
  for (const [level, band] of bands) band.forEach((terminal, i) => position.set(terminal.id, horizontal ? [120 + level * 260, 140 + i * 145] : [140 + i * 190, 130 + level * 220]));
  const pairIndex = new Map<string, number>();
  for (const edge of diagram.switches) {
    if (!edge.from || !edge.to || !position.has(edge.from) || !position.has(edge.to)) continue;
    const [ax, ay] = position.get(edge.from)!; const [bx, by] = position.get(edge.to)!;
    const pair = [edge.from, edge.to].sort().join('|'), index = pairIndex.get(pair) || 0; pairIndex.set(pair, index + 1);
    const dx = bx - ax, dy = by - ay, dist = Math.hypot(dx, dy) || 1, parallel = (index - 1) * 13, px = -dy / dist * parallel, py = dx / dist * parallel;
    const x1 = ax + px, y1 = ay + py, x2 = bx + px, y2 = by + py, mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const edgeGroup = namedGroup(root, edge.id, edge.sourceClass, edge.name, diagram.selectedId === edge.id, select);
    svg('line', { x1, y1, x2: mx - dx / dist * 22, y2: my - dy / dist * 22, stroke: '#75a7bf', 'stroke-width': 2 }, edgeGroup);
    svg('line', { x1: mx + dx / dist * 22, y1: my + dy / dist * 22, x2, y2, stroke: '#75a7bf', 'stroke-width': 2 }, edgeGroup);
    const color = diagram.selectedId === edge.id ? colors.selected : edge.closed ? colors.switch : colors.open;
    if (edge.kind === 'breaker') {
      svg('rect', { x: mx - 12, y: my - 15, width: 24, height: 30, rx: 3, fill: '#172c3e', stroke: color, 'stroke-width': 2 }, edgeGroup);
      svg('line', { x1: mx - 8, y1: my - 10, x2: mx + 8, y2: my + (edge.closed ? 10 : -10), stroke: color, 'stroke-width': 2.5 }, edgeGroup);
    } else if (edge.kind === 'isolator') {
      svg('circle', { cx: mx - 12, cy: my, r: 3.5, fill: color }, edgeGroup); svg('circle', { cx: mx + 12, cy: my, r: 3.5, fill: color }, edgeGroup);
      svg('line', { x1: mx - 12, y1: my, x2: mx + 8, y2: edge.closed ? my : my - 12, stroke: color, 'stroke-width': 2.5 }, edgeGroup);
    } else svg('polygon', { points: `${mx},${my - 11} ${mx + 11},${my} ${mx},${my + 11} ${mx - 11},${my}`, fill: 'none', stroke: color, 'stroke-width': 2 }, edgeGroup);
    text(edgeGroup, mx, my - 28, edge.name && edge.name !== edge.id ? `${edge.name} · ${edge.id}` : edge.id, { size: 9, fill: color, anchor: 'middle' });
    const title = svg('title', {}, edgeGroup); title.textContent = `${edge.kind} · ${edge.name} · ${edge.closed ? 'kapalı' : 'açık'} · ${edge.from} ↔ ${edge.to}`;
  }
  for (const terminal of diagram.terminals) {
    const pos = position.get(terminal.id); if (!pos) continue;
    const [x, y] = pos; const node = namedGroup(root, terminal.id, 'ElmTerm', terminal.name, diagram.selectedId === terminal.id, select);
    if (terminal.external) svg('line', { x1: x - 48, y1: y, x2: x + 48, y2: y, stroke: colors.open, 'stroke-width': 6, 'stroke-linecap': 'round' }, node);
    else svg('circle', { cx: x, cy: y, r: 9, fill: '#7bd5e2', stroke: '#ddf8ff', 'stroke-width': 1.5 }, node);
    text(node, x, y + 26, `${terminal.name || terminal.id}${terminal.external ? ' · dış bara' : ''}`, { size: 10, fill: colors.ink, anchor: 'middle', weight: '550' });
    text(node, x, y + 41, terminal.id, { size: 9, fill: colors.muted, anchor: 'middle' });
    terminal.equipment.slice(0, 5).forEach((item, i) => {
      const dx = (i - (Math.min(5, terminal.equipment.length) - 1) / 2) * 62, sx = x + dx, sy = y + 62;
      svg('line', { x1: x, y1: y + 10, x2: sx, y2: sy - 11, stroke: '#6494ae', 'stroke-width': 1.2 }, root);
      symbol(root, item, sx, sy, diagram.selectedId === item.id, select, false);
      const label = item.name && item.name !== item.id ? `${item.name} · ${item.id}` : item.id;
      text(root, sx, sy + 24, label.length > 18 ? `${label.slice(0, 16)}…` : label, { size: 8, fill: colors.muted, anchor: 'middle' });
    });
    if (terminal.equipment.length > 5) text(root, x, y + 115, `+${terminal.equipment.length - 5} bağlı kayıt`, { size: 9, fill: colors.muted, anchor: 'middle' });
  }
  const unresolved = diagram.unresolvedSwitches;
  if (unresolved) text(root, 24, height - 18, `${unresolved} anahtar uç çifti çözülemedi; kaynağı olmayan bağlantı çizilmedi.`, { size: 11, fill: colors.open });
}

function renderRegional(host: HTMLElement, diagram: SldDiagram, select: Select): void {
  const sites = diagram.regionalSites, width = 1200, height = 900, cx = width / 2, cy = height / 2, positions = new Map<string, [number, number]>();
  positions.set(diagram.station.id, [cx, cy]);
  const others = sites.filter(site => site.id !== diagram.station.id).slice(0, 36);
  others.forEach((site, index) => { const angle = 2 * Math.PI * index / Math.max(1, others.length) - Math.PI / 2; positions.set(site.id, [cx + 440 * Math.cos(angle), cy + 345 * Math.sin(angle)]); });
  const root = baseSvg(host, `0 0 ${width} ${height}`, `${diagram.station.name} çevresindeki bağlı trafo merkezleri ve hatlar`);
  text(root, 24, 36, `${diagram.station.name} · bağlı TM ağı`, { size: 20, fill: '#fff0cb', weight: '650' });
  text(root, 24, 61, 'Seçili TM’den gerçek bara uçlarıyla doğrudan bağlanan komşu merkezler · tek-adımlı bölgesel görünüm', { size: 12, fill: colors.muted });
  const pairIndex = new Map<string, number>();
  for (const branch of diagram.regionalBranches) {
    const a = positions.get(branch.fromSiteId), b = positions.get(branch.toSiteId); if (!a || !b) continue;
    const pair = [branch.fromSiteId, branch.toSiteId].sort().join('|'), index = pairIndex.get(pair) || 0; pairIndex.set(pair, index + 1);
    const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy) || 1, offset = (index - 1) * 9, ox = -dy / length * offset, oy = dx / length * offset;
    const edge = svg('g', { role: 'button', tabindex: 0, 'aria-label': `${branch.name} · ${branch.sourceClass} · ${branch.id}` }, root);
    edge.addEventListener('click', () => select(branch.id, branch.sourceClass));
    edge.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(branch.id, branch.sourceClass); } });
    svg('line', { x1: a[0] + ox, y1: a[1] + oy, x2: b[0] + ox, y2: b[1] + oy, stroke: diagram.selectedId === branch.id ? colors.selected : branch.inService ? symbolColor(branch.sourceClass) : colors.out, 'stroke-width': diagram.selectedId === branch.id ? 4 : 2.5, 'stroke-dasharray': branch.inService ? '' : '8 6' }, edge);
    const title = svg('title', {}, edge); title.textContent = `${branch.name} · ${branch.sourceClass} · ${branch.id} · ${branch.inService ? 'serviste' : 'servis dışı'}`;
    if (index === 0) text(root, (a[0] + b[0]) / 2 + ox, (a[1] + b[1]) / 2 + oy - 7, `${branch.name} · ${branch.id}`, { size: 9, fill: colors.ink, anchor: 'middle' });
  }
  for (const site of sites) {
    const pos = positions.get(site.id); if (!pos) continue;
    const selected = site.id === diagram.station.id, node = namedGroup(root, site.id, site.sourceClass, site.name, diagram.selectedId === site.id, select);
    svg('circle', { cx: pos[0], cy: pos[1], r: selected ? 17 : 12, fill: selected ? '#f6b968' : '#9ae3d6', stroke: diagram.selectedId === site.id ? colors.selected : '#d7f2ee', 'stroke-width': 2 }, node);
    text(node, pos[0] + 20, pos[1] - 8, site.name || site.id, { size: 12, fill: selected ? '#fff0cb' : colors.ink, weight: selected ? '650' : '400' });
    text(node, pos[0] + 20, pos[1] + 10, site.id, { size: 9, fill: colors.muted });
  }
}

export class SvgSldRenderer {
  render(host: HTMLElement, diagram: SldDiagram, select: Select): void {
    if (diagram.scope === 'regional') renderRegional(host, diagram, select);
    else if (diagram.scope === 'bay' && diagram.selectedBay) renderBay(host, diagram, select);
    else renderStation(host, diagram, select);
  }
}
