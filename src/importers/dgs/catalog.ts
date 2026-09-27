import type { CatalogPage, CatalogQuery, CatalogRow } from '../../app/contracts';
import { cloneDgsValue, type DgsModel, type DgsTable } from './index';

const MAX_CACHED_QUERIES = 16;
// Uint32Array storage is compact (4 bytes per result); keep query indexes under 6 MiB/model.
const MAX_CACHED_INDICES = 1_500_000;

interface QueryCache {
  readonly entries: Map<string, Uint32Array>;
  indices: number;
}

const modelCaches = new WeakMap<DgsModel, QueryCache>();

function queryCache(model: DgsModel): QueryCache {
  let cache = modelCaches.get(model);
  if (!cache) {
    cache = { entries: new Map(), indices: 0 };
    modelCaches.set(model, cache);
  }
  return cache;
}

function cachedIndices(cache: QueryCache, key: string): Uint32Array | undefined {
  const found = cache.entries.get(key);
  if (!found) return undefined;
  // Map insertion order provides a small, bounded LRU without a second index.
  cache.entries.delete(key);
  cache.entries.set(key, found);
  return found;
}

function rememberIndices(cache: QueryCache, key: string, indices: Uint32Array): void {
  if (indices.length > MAX_CACHED_INDICES) return;
  const previous = cache.entries.get(key);
  if (previous) {
    cache.entries.delete(key);
    cache.indices -= previous.length;
  }
  while (cache.entries.size >= MAX_CACHED_QUERIES || cache.indices + indices.length > MAX_CACHED_INDICES) {
    const oldest = cache.entries.keys().next();
    if (oldest.done) break;
    const removed = cache.entries.get(oldest.value);
    cache.entries.delete(oldest.value);
    cache.indices -= removed?.length ?? 0;
  }
  cache.entries.set(key, indices);
  cache.indices += indices.length;
}

function cacheKey(query: CatalogQuery, search: string): string {
  let voltage: unknown = null;
  if (query.voltage != null) {
    voltage = Number.isNaN(query.voltage) ? 'NaN'
      : query.voltage === Infinity ? '+Infinity'
        : query.voltage === -Infinity ? '-Infinity' : query.voltage;
  }
  return JSON.stringify([
    query.className,
    search,
    query.siteId || '',
    query.areaId || '',
    voltage,
    query.sort || '',
    Boolean(query.sort) && Boolean(query.descending),
  ]);
}

function rawValue(table: DgsTable, row: readonly unknown[], column: number): unknown {
  return column >= 0 ? row[column] : null;
}

function firstPresent(first: unknown, second: unknown, third?: unknown, fourth?: unknown): unknown {
  if (first !== null && first !== undefined) return first;
  if (second !== null && second !== undefined) return second;
  if (third !== null && third !== undefined) return third;
  return fourth;
}

function voltageForRow(model: DgsModel, table: DgsTable, row: readonly unknown[], columns: Map<string, number>, id: string): number {
  if (table === model.t('ElmLne')) {
    const lineVoltage = model.lineById(id)?.voltage;
    if (lineVoltage !== null && lineVoltage !== undefined) return lineVoltage;
    return Number(firstPresent(
      rawValue(table, row, columns.get('uknom') ?? -1),
      rawValue(table, row, columns.get('utrn_h') ?? -1),
    ));
  }

  let transformerVoltage: unknown = null;
  if (table === model.t('ElmTr2')) {
    const typeId = rawValue(table, row, columns.get('typ_id') ?? -1);
    const typeRowIndex = model.index.get('TypTr2')?.get(String(typeId ?? ''));
    const typeTable = model.t('TypTr2');
    const typeColumn = model.attrAt('TypTr2', 'utrn_h');
    if (typeRowIndex !== undefined && typeTable && typeColumn >= 0) {
      transformerVoltage = typeTable.Values[typeRowIndex]?.[typeColumn];
    }
  }

  return Number(firstPresent(
    rawValue(table, row, columns.get('uknom') ?? -1),
    rawValue(table, row, columns.get('voltage') ?? -1),
    transformerVoltage,
    rawValue(table, row, columns.get('utrn_h') ?? -1),
  ));
}

function rowSiteIds(model: DgsModel, className: string, table: DgsTable, rowIndex: number, idColumn: number, foldColumn: number): string[] {
  const raw = table.Values[rowIndex];
  if (!raw) return [];
  const id = String(rawValue(table, raw, idColumn) ?? '');
  if(className==='ElmSite')return [id];
  if(className==='ElmLne'){const line=model.lineById(id);return [...new Set([line?.stationA,line?.stationB].filter((v):v is string=>!!v))];}
  if(['ElmTr2','ElmScap','ElmCoup'].includes(className)){
    const fields=className==='ElmTr2'?['bushv','buslv']:['bus1','bus2'];
    const ids=fields.map(f=>model.siteFromCub(raw[model.attrAt(className,f)])).filter((v):v is string=>!!v);
    if(ids.length)return [...new Set(ids)];
  }
  const site=model.resolveSiteByClass(className, id, raw, foldColumn);
  return site?[site]:[];
}

function makeQueryIndices(model: DgsModel, query: CatalogQuery, table: DgsTable, search: string): Uint32Array {
  const className = query.className;
  const columns = model.attr.get(className) ?? new Map<string, number>();
  const idColumn = columns.get('FID') ?? -1;
  const nameColumn = columns.get('loc_name') ?? -1;
  const foldColumn = columns.get('fold_id') ?? -1;
  const voltageColumnPresent = query.voltage != null;
  const collator = query.sort ? new Intl.Collator('tr') : null;
  const matched: number[] = [];

  for (let rowIndex = 0; rowIndex < table.Values.length; rowIndex += 1) {
    const raw = table.Values[rowIndex];
    if (!raw) continue;
    const id = String(rawValue(table, raw, idColumn) ?? '');
    const name = String(rawValue(table, raw, nameColumn) ?? id);
    if (search && !`${name} ${id}`.toLocaleLowerCase('tr-TR').includes(search)) continue;

    if (query.siteId || query.areaId) {
      const siteIds = rowSiteIds(model, className, table, rowIndex, idColumn, foldColumn);
      if (query.siteId && !siteIds.includes(query.siteId)) continue;
      if (query.areaId) {
        if (!siteIds.some(id=>model.siteById(id)?.ytmId===query.areaId)) continue;
      }
    }

    if (voltageColumnPresent && (className==='ElmSite' ? !model.siteById(id)?.volts.has(query.voltage!) : voltageForRow(model, table, raw, columns, id) !== query.voltage)) continue;
    matched.push(rowIndex);
  }

  if (query.sort) {
    const sortColumn = columns.get(query.sort) ?? -1;
    matched.sort((leftIndex, rightIndex) => {
      const left = table.Values[leftIndex];
      const right = table.Values[rightIndex];
      if (!left || !right) return leftIndex - rightIndex;
      const leftId = String(rawValue(table, left, idColumn) ?? '');
      const rightId = String(rawValue(table, right, idColumn) ?? '');
      const leftValue = query.sort === 'name' ? String(rawValue(table, left, nameColumn) ?? leftId) : rawValue(table, left, sortColumn);
      const rightValue = query.sort === 'name' ? String(rawValue(table, right, nameColumn) ?? rightId) : rawValue(table, right, sortColumn);
      const order = typeof leftValue === 'number' && typeof rightValue === 'number'
        ? leftValue - rightValue
        : (collator?.compare(String(leftValue ?? ''), String(rightValue ?? '')) ?? 0);
      if (order === 0) return leftIndex - rightIndex;
      return query.descending ? -order : order;
    });
  }

  return Uint32Array.from(matched);
}

function detachedCatalogRow(model: DgsModel, table: DgsTable, className: string, rowIndex: number): CatalogRow | null {
  const values = table.Values[rowIndex];
  if (!values) return null;
  const idColumn = model.attrAt(className, 'FID');
  const nameColumn = model.attrAt(className, 'loc_name');
  const id = String(rawValue(table, values, idColumn) ?? '');
  const name = String(rawValue(table, values, nameColumn) ?? id);
  const attributes: Record<string, unknown> = {};
  const length = Math.min(table.Attributes.length, values.length);
  for (let column = 0; column < length; column += 1) {
    Object.defineProperty(attributes, table.Attributes[column], {
      value: cloneDgsValue(values[column]),
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }
  const siteIds = rowSiteIds(model, className, table, rowIndex, idColumn, model.attrAt(className, 'fold_id'));
  return { id, name, siteIds, attributes };
}

export function catalogPage(model: DgsModel, query: CatalogQuery): CatalogPage {
  const table = model.t(query.className);
  if (!table) return { rows: [], total: 0, attributes: [] };

  const search = (query.search || '').trim().toLocaleLowerCase('tr-TR');
  const key = cacheKey(query, search);
  const cache = queryCache(model);
  let indices = cachedIndices(cache, key);
  if (!indices) {
    indices = makeQueryIndices(model, query, table, search);
    rememberIndices(cache, key, indices);
  }

  const size = Math.min(100, Math.max(1, query.pageSize || 20));
  const page = Math.max(0, query.page || 0);
  const start = page * size;
  const end = Math.min(indices.length, start + size);
  const rows: CatalogRow[] = [];
  for (let position = start; position < end; position += 1) {
    const row = detachedCatalogRow(model, table, query.className, indices[position]);
    if (row) rows.push(row);
  }

  return { rows, total: indices.length, attributes: [...table.Attributes] };
}
