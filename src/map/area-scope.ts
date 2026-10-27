import { allVoltageBands } from '../domain/model/voltage-band';
import type { MapDisplayFilters } from '../app/contracts';
/** Initial map-only display scope: every YTM and voltage band visible. */
export function initialMapDisplayFilters(): MapDisplayFilters {
  return { areaMode: 'ALL', areaIds: [], voltages: allVoltageBands(), siteId: '', capacitySeason: 'inherit' };
}
/**
 * Tri-state YTM display scope. ALL shows every area, NONE shows none
 * ("Temizle" is deliberately not "all"), SELECTED shows the union of the
 * chosen areas. Never falls back to the shared analytical `filters.areaId`.
 */
export function areaInScope(scope: Pick<MapDisplayFilters, 'areaMode' | 'areaIds'>, areaId: string): boolean {
  if (scope.areaMode === 'ALL') return true;
  if (scope.areaMode === 'NONE') return false;
  return scope.areaIds.includes(areaId);
}
/** Fast per-frame predicate factory for line/site visibility by area id. */
export function scopeAreaFilter(scope: Pick<MapDisplayFilters, 'areaMode' | 'areaIds'>): (areaId: string) => boolean {
  if (scope.areaMode === 'ALL') return () => true;
  if (scope.areaMode === 'NONE') return () => false;
  const set = new Set(scope.areaIds);
  return areaId => set.has(areaId);
}
/** Cache-key stable serialization of the map display scope (including the map TM scope and capacity display choice). */
export function mapScopeKey(scope: MapDisplayFilters): string {
  return scope.areaMode + '|' + [...scope.areaIds].sort().join(',') + '|' + [...scope.voltages].sort().join(',') + '|' + scope.siteId + '|' + scope.capacitySeason;
}
/** Counter text for the YTM menu summary: Tümü / Yok / n/N. */
export function mapAreaScopeLabel(scope: Pick<MapDisplayFilters, 'areaMode' | 'areaIds'>, total: number): string {
  if (scope.areaMode === 'ALL') return 'Tümü';
  if (scope.areaMode === 'NONE') return 'Yok';
  return `${scope.areaIds.length}/${total}`;
}
/**
 * Display-only selection that mirrors a restored analytical study onto the
 * map without touching `filters` (calculation scope stays untouched).
 */
export function mapDisplayForStudy(ytmId: string, tmId?: string): MapDisplayFilters {
  return { areaMode: ytmId ? 'SELECTED' : 'ALL', areaIds: ytmId ? [ytmId] : [], voltages: allVoltageBands(), siteId: tmId ?? '', capacitySeason: 'inherit' };
}
