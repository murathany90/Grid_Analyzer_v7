import type { AppContext, CatalogPage, CatalogQuery, CatalogRow } from '../app/contracts';

export type CatalogFilter = Omit<CatalogQuery, 'className' | 'page' | 'pageSize'>;
export type TaggedCatalogRow = CatalogRow & { className: string };
export type MergedCatalogPage = Omit<CatalogPage, 'rows'> & { rows: TaggedCatalogRow[] };

export async function fetchCatalogAll(ctx: AppContext, className: string, filter: CatalogFilter, pageSize = 200): Promise<CatalogPage> {
  // The catalog worker deliberately caps transfers at 100 rows per request.
  // Keep pagination math in sync with that cap so exports and SLD bay lists
  // don't silently omit the remainder of larger classes.
  const size = Math.min(100, Math.max(1, Math.floor(pageSize)));
  const first = await ctx.catalog({ ...filter, className, page: 0, pageSize: size });
  const pages = Math.ceil(first.total / size);
  const rows = [...first.rows];
  for (let page = 1; page < pages; page++) {
    const next = await ctx.catalog({ ...filter, className, page, pageSize: size });
    rows.push(...next.rows);
  }
  return { rows, total: first.total, attributes: first.attributes };
}

/**
 * Fetch enough name-sorted pages from each class to produce the requested page
 * of their merged result. Results are kept paged through the catalog worker.
 */
export async function fetchMergedPage(
  ctx: AppContext, classNames: readonly string[], filter: CatalogFilter, page: number, pageSize: number,
): Promise<MergedCatalogPage> {
  const starts = await Promise.all(classNames.map(className => ctx.catalog({ ...filter, className, page: 0, pageSize: 1, sort: 'name' })));
  const total = starts.reduce((sum, result) => sum + result.total, 0);
  const attributes = [...new Set(starts.flatMap(result => result.attributes))];
  const merged: TaggedCatalogRow[] = [];
  for (const className of classNames) {
    const first = await ctx.catalog({ ...filter, className, page: 0, pageSize, sort: 'name' });
    merged.push(...first.rows.map(row => ({ ...row, className })));
    for (let p = 1; p <= page; p++) {
      const next = await ctx.catalog({ ...filter, className, page: p, pageSize, sort: 'name' });
      merged.push(...next.rows.map(row => ({ ...row, className })));
      if (next.rows.length < pageSize) break;
    }
  }
  merged.sort((a, b) => a.name.localeCompare(b.name, 'tr') || a.id.localeCompare(b.id, 'tr'));
  return { rows: merged.slice(page * pageSize, (page + 1) * pageSize), total, attributes };
}
