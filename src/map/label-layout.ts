/**
 * Deterministic TM name label placement. Pure geometry: no DOM, no DPR —
 * the budget is expressed in CSS pixels, viewport size and zoom only.
 */
export interface LabelCandidate { id: string; text: string; x: number; y: number; priority: number }
export interface LabelBox { x: number; y: number; width: number; height: number }
export type LabelAnchor = 'right' | 'above' | 'below' | 'left';
export interface LabelPlacement { id: string; text: string; x: number; y: number; anchor: LabelAnchor; box: LabelBox }
export interface LabelLayoutOptions {
  width: number; height: number;
  measure(text: string): { width: number; height: number };
  iconRadius: number;
  maxLabels: number;
  edgePadding?: number;
}
const GRID_CELL = 64;
const CANDIDATE_ORDER: LabelAnchor[] = ['right', 'above', 'below', 'left'];
const PAD = 3;
/**
 * Hard label budget for one paint. CSS-pixel viewport area × zoom taper —
 * screen density (DPR) must not inflate it; collision saturation does the
 * per-frame trimming on dense regions.
 */
export function labelBudget(width: number, height: number, zoom: number): number {
  const base = Math.min(200, Math.max(10, width * height / 2800));
  return Math.max(10, Math.min(260, Math.round(base * Math.min(1.5, Math.max(0.4, zoom * 0.7)))));
}
/** Occupied space: fixed geometry (icons, marks) or removable low-priority labels. */
export interface OccupiedBox { box: LabelBox; removable?: boolean }
export interface LabelPlan { placements: LabelPlacement[]; suppressed: LabelBox[] }
const overlapArea = (a: LabelBox, b: LabelBox): number => {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x), h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
};
class RectGrid {
  private cells = new Map<string, OccupiedBox[]>();
  add(entry: OccupiedBox): void {
    const box = entry.box;
    const x0 = Math.floor(box.x / GRID_CELL), x1 = Math.floor((box.x + box.width) / GRID_CELL);
    const y0 = Math.floor(box.y / GRID_CELL), y1 = Math.floor((box.y + box.height) / GRID_CELL);
    for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
      const key = cx + '|' + cy, list = this.cells.get(key);
      if (list) list.push(entry); else this.cells.set(key, [entry]);
    }
  }
  hits(box: LabelBox): OccupiedBox[] {
    const found: OccupiedBox[] = [];
    const x0 = Math.floor(box.x / GRID_CELL), x1 = Math.floor((box.x + box.width) / GRID_CELL);
    const y0 = Math.floor(box.y / GRID_CELL), y1 = Math.floor((box.y + box.height) / GRID_CELL);
    for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
      for (const other of this.cells.get(cx + '|' + cy) ?? []) {
        const o = other.box;
        if (box.x < o.x + o.width && o.x < box.x + box.width && box.y < o.y + o.height && o.y < box.y + box.height && !found.includes(other)) found.push(other);
      }
    }
    return found;
  }
}
const clampBox = (box: LabelBox, width: number, height: number, pad: number): LabelBox => ({
  x: Math.min(Math.max(pad, box.x), Math.max(pad, width - pad - box.width)),
  y: Math.min(Math.max(pad, box.y), Math.max(pad, height - pad - box.height)),
  width: box.width, height: box.height,
});
/** Anchor point for drawing given the resolved placement box. */
export function drawPoint(placement: LabelPlacement, iconRadius: number): { x: number; y: number; align: CanvasTextAlign; baseline: CanvasTextBaseline } {
  switch (placement.anchor) {
    case 'right': return { x: placement.box.x, y: placement.box.y + placement.box.height / 2, align: 'left', baseline: 'middle' };
    case 'left': return { x: placement.box.x + placement.box.width, y: placement.box.y + placement.box.height / 2, align: 'right', baseline: 'middle' };
    case 'above': return { x: placement.box.x + placement.box.width / 2, y: placement.box.y + placement.box.height, align: 'center', baseline: 'alphabetic' };
    default: return { x: placement.box.x + placement.box.width / 2, y: placement.box.y, align: 'center', baseline: 'top' };
  }
}
function candidateBox(anchor: LabelAnchor, x: number, y: number, r: number, w: number, h: number): LabelBox {
  switch (anchor) {
    case 'right': return { x: x + r + PAD, y: y - h / 2, width: w, height: h };
    case 'left': return { x: x - r - PAD - w, y: y - h / 2, width: w, height: h };
    case 'above': return { x: x - w / 2, y: y - r - PAD - h, width: w, height: h };
    default: return { x: x - w / 2, y: y + r + PAD, width: w, height: h };
  }
}
/** Reserved priority tiers that are always placed (clamped into view). */
export const LABEL_PRIORITY_SELECTED = 1e9;
export const LABEL_PRIORITY_HOVER = 5e8;
/**
 * Place as many labels as fit without overlapping each other, occupied
 * geometry or the viewport edges. Higher `priority` wins the free space;
 * ties break deterministically by text then id.
 *
 * Reserved-tier candidates (selected/hover) always get a label. When every
 * anchor collides only with removable low-priority labels, those labels are
 * suppressed for this frame (the caller must skip drawing them) instead of
 * accepting an overlap. A clamped anchor is the last resort and only when
 * fixed geometry (icons, marks) blocks all anchors; the anchor with the
 * smallest fixed-overlap area wins so the priority label stays legible.
 */
export function planLabels(candidates: LabelCandidate[], occupied: ReadonlyArray<LabelBox | OccupiedBox>, options: LabelLayoutOptions): LabelPlan {
  const pad = options.edgePadding ?? 1, grid = new RectGrid();
  const entries: OccupiedBox[] = occupied.map(entry => 'box' in entry ? entry : { box: entry });
  for (const entry of entries) if (entry.box.width > 0 && entry.box.height > 0) grid.add(entry);
  const ordered = [...candidates].sort((a, b) => b.priority - a.priority || a.text.localeCompare(b.text, 'tr') || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const placements: LabelPlacement[] = [];
  const suppressed: LabelBox[] = [];
  const asPlacement = (candidate: LabelCandidate, anchor: LabelAnchor, box: LabelBox): LabelPlacement => ({ id: candidate.id, text: candidate.text, x: candidate.x, y: candidate.y, anchor, box });
  for (const candidate of ordered) {
    if (placements.length >= options.maxLabels) break;
    const metrics = options.measure(candidate.text), w = Math.ceil(metrics.width), h = Math.ceil(metrics.height);
    const reserved = candidate.priority >= LABEL_PRIORITY_HOVER;
    const clipped: { anchor: LabelAnchor; box: LabelBox; fixedArea: number; removable: LabelBox[] }[] = [];
    let placed: LabelPlacement | null = null;
    for (const anchor of CANDIDATE_ORDER) {
      const raw = candidateBox(anchor, candidate.x, candidate.y, options.iconRadius, w, h);
      if (raw.x < pad || raw.y < pad || raw.x + w > options.width - pad || raw.y + h > options.height - pad) continue;
      const hits = grid.hits(raw);
      const fixed = hits.filter(entry => !entry.removable), removable = hits.filter(entry => entry.removable);
      if (!hits.length) { placed = asPlacement(candidate, anchor, raw); break; }
      if (reserved) clipped.push({ anchor, box: raw, fixedArea: fixed.reduce((sum, entry) => sum + overlapArea(raw, entry.box), 0), removable: removable.map(entry => entry.box) });
    }
    if (!placed && reserved && clipped.length) {
      clipped.sort((a, b) => a.fixedArea - b.fixedArea || CANDIDATE_ORDER.indexOf(a.anchor) - CANDIDATE_ORDER.indexOf(b.anchor));
      const best = clipped[0];
      placed = asPlacement(candidate, best.anchor, clampBox(best.box, options.width, options.height, pad));
      for (const box of best.removable) suppressed.push(box);
    }
    if (!placed) continue;
    grid.add({ box: placed.box });
    placements.push(placed);
  }
  return { placements, suppressed };
}
