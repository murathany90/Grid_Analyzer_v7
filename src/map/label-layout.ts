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
class RectGrid {
  private cells = new Map<string, LabelBox[]>();
  add(box: LabelBox): void {
    const x0 = Math.floor(box.x / GRID_CELL), x1 = Math.floor((box.x + box.width) / GRID_CELL);
    const y0 = Math.floor(box.y / GRID_CELL), y1 = Math.floor((box.y + box.height) / GRID_CELL);
    for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
      const key = cx + '|' + cy, list = this.cells.get(key);
      if (list) list.push(box); else this.cells.set(key, [box]);
    }
  }
  hits(box: LabelBox): boolean {
    const x0 = Math.floor(box.x / GRID_CELL), x1 = Math.floor((box.x + box.width) / GRID_CELL);
    const y0 = Math.floor(box.y / GRID_CELL), y1 = Math.floor((box.y + box.height) / GRID_CELL);
    for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
      for (const other of this.cells.get(cx + '|' + cy) ?? []) {
        if (box.x < other.x + other.width && other.x < box.x + box.width && box.y < other.y + other.height && other.y < box.y + box.height) return true;
      }
    }
    return false;
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
 * Place as many labels as fit without overlapping each other, pre-occupied
 * boxes (split-bus / measurement labels, marks) or the viewport edges.
 * Higher `priority` wins the free space; ties break deterministically by
 * text then id. Reserved-tier candidates (selected/hover) are always placed
 * (clamped inside the viewport) so selection/hover never loses its label.
 */
export function planLabels(candidates: LabelCandidate[], occupied: LabelBox[], options: LabelLayoutOptions): LabelPlacement[] {
  const pad = options.edgePadding ?? 1, grid = new RectGrid();
  for (const box of occupied) if (box.width > 0 && box.height > 0) grid.add(box);
  const ordered = [...candidates].sort((a, b) => b.priority - a.priority || a.text.localeCompare(b.text, 'tr') || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const placements: LabelPlacement[] = [];
  for (const candidate of ordered) {
    if (placements.length >= options.maxLabels) break;
    const metrics = options.measure(candidate.text), w = Math.ceil(metrics.width), h = Math.ceil(metrics.height);
    let placed: LabelPlacement | null = null;
    let fallback: LabelPlacement | null = null;
    for (const anchor of CANDIDATE_ORDER) {
      const raw = candidateBox(anchor, candidate.x, candidate.y, options.iconRadius, w, h);
      if (raw.x < pad || raw.y < pad || raw.x + w > options.width - pad || raw.y + h > options.height - pad) continue;
      if (!grid.hits(raw)) { placed = { id: candidate.id, text: candidate.text, x: candidate.x, y: candidate.y, anchor, box: raw }; break; }
      if (!fallback && candidate.priority >= LABEL_PRIORITY_HOVER) fallback = { id: candidate.id, text: candidate.text, x: candidate.x, y: candidate.y, anchor, box: raw };
    }
    if (!placed && fallback) placed = { ...fallback, box: clampBox(fallback.box, options.width, options.height, pad) };
    if (!placed) continue;
    grid.add(placed.box);
    placements.push(placed);
  }
  return placements;
}
