import type {CatalogRow} from '../../app/contracts';
import {engineeringColumns,columnValue,type SemanticColumn} from './semantic-catalog';
import {fieldLabel} from '../../domain/dgs-semantics/fields';
import type {ColumnChoice} from './workspace-columns';
export type WorkspaceColumn=SemanticColumn&ColumnChoice;
const refs=(r:CatalogRow,key:'areas'|'sites'|'groups'|'bays')=>r.context?.[key]?.map(e=>e.name).join(' · ')||'—';
/** Required hierarchy stays first; status stays after technical fields in every profile. */
export function workspaceCatalogColumns(cls:string,attrs:readonly string[],extra:readonly WorkspaceColumn[]=[]):{columns:WorkspaceColumn[];profiles:Record<string,string[]>}{
 const hierarchy:WorkspaceColumn[]=[
  {key:'hierarchy.area',label:'YTM',required:true,value:r=>cls==='ElmLne'?`${r.context?.fromArea??'—'} → ${r.context?.toArea??'—'}`:refs(r,'areas')},
  {key:'hierarchy.site',label:'TM',required:true,value:r=>cls==='ElmLne'?`${r.context?.fromSite??'—'} → ${r.context?.toSite??'—'}`:refs(r,'sites')},
  {key:'hierarchy.bay',label:'Bara/Fider',required:true,value:r=>[refs(r,'groups'),refs(r,'bays')].filter(v=>v!=='—').join(' / ')||'—'},
  {key:'equipment',label:'Ekipman',required:true,value:r=>r.name||r.id},
 ];
 const engineering=engineeringColumns(cls,attrs,true).filter(c=>!['context.areas','context.sites','context.groups','context.bays','context.fromSite','context.toSite','outserv','on_off'].includes(c.key));
 const fields=new Map<string,WorkspaceColumn>();for(const c of [{key:'FID',label:'FID',value:(r:CatalogRow)=>r.id},...engineering,...extra,...attrs.filter(k=>!['loc_name','outserv','on_off'].includes(k)).map(key=>({key,label:`${fieldLabel(key)} [${key}]`,rawField:key}))])if(!fields.has(c.key))fields.set(c.key,c);
 const status:WorkspaceColumn[]=[{key:'on_off',label:'Anahtar durumu'},{key:'outserv',label:'Servis durumu'}].filter(c=>attrs.includes(c.key));
 if(!status.length)status.push({key:'status.missing',label:'Durum',value:()=>null} as WorkspaceColumn);
 const columns=[...hierarchy,...fields.values(),...status],defaults=['FID',...engineering.map(c=>c.key),...extra.map(c=>c.key),...status.map(c=>c.key)];
 return{columns,profiles:{'Mühendislik':defaults,'Kompakt':['FID',...extra.map(c=>c.key),...status.map(c=>c.key)],'Tüm kaynak alanları':[...fields.keys(),...status.map(c=>c.key)]}};
}
export const workspaceRowValues=(r:CatalogRow,cols:readonly SemanticColumn[])=>cols.map(c=>columnValue(r,c));
