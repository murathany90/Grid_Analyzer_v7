import type { CatalogRow } from '../../app/contracts';
import { fieldLabel, semanticValue } from '../../domain/dgs-semantics/fields';
import { classLabel } from '../../domain/dgs-semantics/classes';
import { element, csvDocument } from './dom';
export interface SemanticColumn { key:string; label:string; rawField?:string }
const contextLabels:Record<string,string>={voltageKv:'Nominal gerilim (kV)',lvKv:'AG gerilimi (kV)',ratingMva:'Nominal güç (MVA)',sites:'Trafo merkezi',areas:'Yük Tevzi Bölgesi',groups:'Bara grubu',bays:'Fider',terminals:'Bağlı bara / terminal',connectedEquipmentCount:'Bağlı ekipman',typeName:'Tip',fromSite:'Başlangıç TM',toSite:'Bitiş TM'};
const c=(key:string):SemanticColumn=>({key:'context.'+key,label:contextLabels[key]||key});
const f=(key:string):SemanticColumn=>({key,label:fieldLabel(key),rawField:key});
export function engineeringColumns(cls:string,attributes:readonly string[],operating=false):SemanticColumn[] {
  if(cls==='ElmTerm')return [{...c('voltageKv'),rawField:'uknom'},c('areas'),c('sites'),c('groups'),c('bays'),f('outserv'),c('connectedEquipmentCount')];
  if(cls==='ElmLne')return [c('voltageKv'),c('fromSite'),c('toSite'),c('areas'),f('dline'),c('typeName'),f('outserv')];
  if(cls==='ElmTr2')return [c('sites'),{...c('voltageKv'),label:'YG gerilimi (kV)'},c('lvKv'),c('ratingMva'),f('nntap'),f('outserv')];
  if(['ElmSym','ElmGenStat','ElmXnet'].includes(cls))return [c('sites'),c('areas'),c('voltageKv'),f('pgini'),f('qgini'),f('usetp'),f('outserv')];
  if(cls==='ElmLod')return [c('sites'),c('areas'),c('voltageKv'),f('plini'),f('qlini'),f('outserv')];
  if(['ElmCoup','StaSwitch'].includes(cls))return [c('sites'),c('bays'),c('voltageKv'),c('terminals'),f('on_off'),f('outserv')];
  if(cls==='ElmShnt')return [c('sites'),c('areas'),c('voltageKv'),f('qrean'),f('qcapn'),f('ncapa'),f('outserv')];
  if(cls==='ElmSite')return [c('areas'),...attributes.filter(a=>['sType','GPSlat','GPSlon'].includes(a)).map(f)];
  if(['ElmSubstat','ElmBay','StaCubic'].includes(cls))return [c('sites'),c('areas'),c('groups'),c('bays'),c('terminals'),c('connectedEquipmentCount')];
  return [...(cls.startsWith('Typ')?[]:[c('sites'),c('areas')]),...attributes.filter(a=>!['FID','loc_name','fold_id'].includes(a)).slice(0,operating?5:6).map(f)];
}
export function columnValue(row:CatalogRow,column:SemanticColumn):unknown {
  if(!column.key.startsWith('context.'))return semanticValue(column.key,row.attributes[column.key]);
  const key=column.key.slice(8) as keyof NonNullable<CatalogRow['context']>,value=row.context?.[key];
  return Array.isArray(value)?value.map(v=>'name'in v?v.name:'id'in v?v.id:'').join(' · '):value;
}
export function semanticTable(rows:readonly (CatalogRow&{className?:string})[],cls:string,columns:readonly SemanticColumn[],pick:(row:CatalogRow&{className?:string})=>void,technical=false):HTMLElement {
  const table=element('table','ga-table ga-semantic-table'),head=element('tr'),thead=element('thead'),body=element('tbody');
  head.append(element('th','','Ekipman'));for(const col of columns){const th=element('th','',col.label);th.title=col.key;if(col.rawField)th.append(element('small',technical?'':'ga-muted',col.rawField));head.append(th);}thead.append(head);table.append(thead,body);
  for(const row of rows){const tr=element('tr'),name=element('td','ga-semantic-name');name.append(element('strong','',row.name||'Adsız kaynak kaydı'),element('small','ga-muted',row.id));name.title=classLabel(row.className||cls);tr.append(name);
    for(const col of columns){const raw=columnValue(row,col),text=raw==null||raw===''?'—':String(raw),td=element('td','',text);td.title=text;tr.append(td);}
    if(technical)name.append(element('small','ga-muted',row.className||cls));
    tr.tabIndex=0;tr.onclick=()=>pick(row);tr.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pick(row);}};body.append(tr);
  }return table;
}
export function semanticDetail(holder:HTMLElement,row:CatalogRow,cls:string):void {
  holder.replaceChildren(element('h3','',row.name||row.id),element('p','ga-muted',`${classLabel(cls)} · ${row.id}`));
  const context=row.context;
  if(context){const chain=[context.areas,context.sites,context.groups,context.bays,context.terminals].map(refs=>refs.map(r=>r.name).join(' / ')).filter(Boolean);holder.append(element('p','ga-breadcrumb',chain.join(' → ')||'Kaynak hiyerarşisi bulunamadı.'));}
  const raw=element('details'),summary=element('summary','','Teknik kaynak alanları ve bağlantılar'),dl=element('dl','ga-attribute-grid');raw.append(summary,dl);
  for(const [key,value]of Object.entries(row.attributes)){const entry=element('div','ga-attribute');entry.append(element('dt','',`${fieldLabel(key)} · ${key}`),element('dd','',semanticValue(key,value)));dl.append(entry);}
  if(context){raw.append(element('pre','ga-source-refs',JSON.stringify({sourceClass:cls,FID:row.id,context},null,2)));}holder.append(raw);
}
export function catalogCsv(rows:readonly (CatalogRow&{className?:string})[],cls:string,attributes:readonly string[],technical:boolean,columns:readonly SemanticColumn[]):string {
  const rawFields=[...new Set(['FID','loc_name',...attributes])];
  const headers=technical?['sourceClass',...rawFields,'context','sourceReferences']:['Ekipman','Teknik kimlik',...columns.map(c=>c.label)];
  const data=rows.map(row=>technical?[row.className||cls,...rawFields.map(k=>row.attributes[k]??(k==='FID'?row.id:k==='loc_name'?row.name:null)),JSON.stringify(row.context??null),JSON.stringify(row.context?.sourceRefs??[])]:[row.name,row.id,...columns.map(c=>c.key.startsWith('context.')?columnValue(row,c):row.attributes[c.key])]);
  return csvDocument([headers,...data].map(row=>row.map(value=>typeof value==='object'&&value!==null?JSON.stringify(value):value)));
}
export function exportSelect():HTMLSelectElement {
  const select=element('select');select.setAttribute('aria-label','Dışa aktar');select.append(new Option('Dışa aktar…',''),new Option('Filtreli mühendislik CSV','engineering'),new Option('Teknik / Ham CSV','raw'));return select;
}
