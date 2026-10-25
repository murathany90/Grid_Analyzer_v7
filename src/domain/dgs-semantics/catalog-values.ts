import type {CatalogRow} from '../../app/contracts';
export function catalogCellValue(row:CatalogRow,cls:string,key:string):unknown {
 const c=row.context,refs=(k:'areas'|'sites'|'groups'|'bays')=>c?.[k].map(r=>r.name).join(' · ')||null;
 if(key==='name'||key==='equipment')return row.name||row.id;
 if(key==='FID')return row.id;
 if(key==='hierarchy.area')return cls==='ElmLne'?(c?.fromArea||c?.toArea?`${c.fromArea??'—'} → ${c.toArea??'—'}`:null):refs('areas');
 if(key==='hierarchy.site')return cls==='ElmLne'?(c?.fromSite||c?.toSite?`${c.fromSite??'—'} → ${c.toSite??'—'}`:null):refs('sites');
 if(key==='hierarchy.bay')return [refs('groups'),refs('bays')].filter(Boolean).join(' / ')||null;
 if(key.startsWith('context.')){const v=c?.[key.slice(8) as keyof NonNullable<typeof c>];return Array.isArray(v)?v.map(r=>'name'in r?r.name:'id'in r?r.id:'').join(' · ')||null:v;}
 if(key==='status.missing')return null;
 return row.attributes[key];
}
