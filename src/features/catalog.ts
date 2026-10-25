import {compareTableRows} from '../domain/dgs-semantics/table-sort';
import {catalogCellValue} from '../domain/dgs-semantics/catalog-values';
import type { AppContext, CatalogPage, CatalogQuery, CatalogRow } from '../app/contracts';

export type CatalogFilter = Omit<CatalogQuery, 'className' | 'page' | 'pageSize'>;
export type TaggedCatalogRow = CatalogRow & { className: string };
export type MergedCatalogPage = Omit<CatalogPage, 'rows'> & { rows: TaggedCatalogRow[] };

export function sortCatalogRows(rows:TaggedCatalogRow[],filter:CatalogFilter):TaggedCatalogRow[]{
 const external=filter.sortSnapshot?new Map(filter.sortSnapshot.values.map(([cls,id,v])=>[cls+'|'+id,v])):null,field=filter.sort??'name',value=(r:TaggedCatalogRow)=>external?external.get(r.className+'|'+r.id)??null:catalogCellValue(r,r.className,field);
 return rows.sort((a,b)=>compareTableRows(value(a),value(b),a.id,b.id,filter.descending,filter.sortKind??'auto',a.className,b.className));
}

export async function fetchCatalogAll(ctx: AppContext, className: string, filter: CatalogFilter, pageSize = 200, current:()=>boolean=()=>true): Promise<CatalogPage> {
  // The catalog worker deliberately caps transfers at 100 rows per request.
  // Keep pagination math in sync with that cap so exports and SLD bay lists
  // don't silently omit the remainder of larger classes.
  const size = Math.min(100, Math.max(1, Math.floor(pageSize)));
  const check=()=>{if(!current())throw Error('CATALOG_SCOPE_CHANGED');};check();
  const first = await ctx.catalog({ ...filter, className, page: 0, pageSize: size });check();
  const pages = Math.ceil(first.total / size);
  const rows = [...first.rows];
  for (let page = 1; page < pages; page++) {
    check();const next = await ctx.catalog({ ...filter, className, page, pageSize: size });check();
    rows.push(...next.rows);
  }
  return { rows, total: first.total, attributes: first.attributes };
}

interface MergeCache {network:AppContext['network'];entries:Map<string,Map<string,Map<number,Promise<CatalogPage>>>>}
const mergedCaches=new WeakMap<AppContext,MergeCache>();
/** Single classes use direct offset pages. Multi-class merges retain bounded
 * per-context prefixes, so advancing pages never refetches earlier source pages. */
export async function fetchMergedPage(ctx:AppContext,classNames:readonly string[],filter:CatalogFilter,page:number,pageSize:number,current:()=>boolean=()=>true):Promise<MergedCatalogPage>{
 const check=()=>{if(!current())throw Error('CATALOG_SCOPE_CHANGED');};check();
 const size=Math.min(100,Math.max(1,Math.floor(pageSize))),offset=Math.max(0,Math.floor(page));
 if(classNames.length===1){const result=await ctx.catalog({...filter,className:classNames[0],page:offset,pageSize:size,sort:filter.sort??'name'});check();return{...result,rows:result.rows.map(row=>({...row,className:classNames[0]}))};}
 let cache=mergedCaches.get(ctx);if(!cache||cache.network!==ctx.network){cache={network:ctx.network,entries:new Map()};mergedCaches.set(ctx,cache);}
 const key=JSON.stringify([classNames,filter,size]);let entry=cache.entries.get(key);if(!entry){entry=new Map();cache.entries.set(key,entry);while(cache.entries.size>4)cache.entries.delete(cache.entries.keys().next().value!);}
 const read=(className:string,p:number)=>{let pages=entry!.get(className);if(!pages){pages=new Map();entry!.set(className,pages);}let pending=pages.get(p);if(!pending){pending=ctx.catalog({...filter,className,page:p,pageSize:size,sort:filter.sort??'name'});pages.set(p,pending);pending.catch(()=>pages!.delete(p));}return pending;};
 const starts=await Promise.all(classNames.map(cls=>read(cls,0)));check();
 const merged:TaggedCatalogRow[]=[],attributes=[...new Set(starts.flatMap(r=>r.attributes))];
 for(let i=0;i<classNames.length;i++){const cls=classNames[i],first=starts[i];merged.push(...first.rows.map(row=>({...row,className:cls})));for(let p=1;p<=offset&&p*size<first.total;p++){check();const next=await read(cls,p);check();merged.push(...next.rows.map(row=>({...row,className:cls})));}}
 // Match the worker's Turkish collator and stable equal-value source order.
 sortCatalogRows(merged,filter);
 return{rows:merged.slice(offset*size,(offset+1)*size),total:starts.reduce((sum,r)=>sum+r.total,0),attributes};
}
