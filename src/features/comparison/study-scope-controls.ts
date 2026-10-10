import {element} from '../../ui/components/dom';
import type {CanonicalNetwork} from '../../domain/model/network';
/** Multi-select empty/ALL represents the whole study; selection is by native IDs. */
export function createStudyScope(label:string){
  const root=element('div','ga-toolbar'),areas=element('select'),voltage=element('select'),tm=element('select'),types=element('select'),endpoints=element('select');
  areas.multiple=voltage.multiple=true;areas.size=voltage.size=4;areas.setAttribute('aria-label',label+' YTM kapsamı');voltage.setAttribute('aria-label',label+' gerilim kapsamı');endpoints.setAttribute('aria-label',label+' uç kapsamı');
  for(const [value,text] of [['','Tüm gerilimler'],['400','400 / 380 / 420 kV'],['154','154 kV bandı'],['33','33 / 34.5 / 31.5 kV']]){const o=element('option','',text);o.value=value;voltage.append(o);}voltage.options[0].selected=true;
  for(const [value,text]of [['BOTH','Seçili küme içi, sınır ve bilinmeyen'],['INTERNAL','Seçili YTM kümesinin içi'],['CONNECTED','Seçili kümenin sınırı'],['SAME_YTM_INTERNAL','Aynı YTM içi'],['UNKNOWN_SCOPE','Ucu çözümlenmemiş / belirsiz']]){const o=element('option','',text);o.value=value;endpoints.append(o);}
  tm.setAttribute('aria-label',label+' TM kapsamı');root.append(areas,tm,voltage,endpoints);
  types.setAttribute('aria-label',label+' kesinti tipi');for(const [value,text]of [['BOTH','Hat + trafo'],['ElmLne','Yalnız hat'],['ElmTr2','Yalnız trafo']]){const o=element('option','',text);o.value=value;types.append(o);}if(label==='Hibrit')root.append(types);
  const ids=(s:HTMLSelectElement)=>[...s.selectedOptions].map(o=>o.value).filter(Boolean);
  let current:CanonicalNetwork|null=null;
  return {element:root,areas,tm,types,voltage,endpoints,filter:()=>({sourceClasses:label==='Hibrit'&&types.value!=='BOTH'?[types.value as 'ElmLne'|'ElmTr2']:undefined,tmId:tm.value||undefined,ytmIds:ids(areas),voltageBands:ids(voltage).map(Number),endpointScope:endpoints.value as 'INTERNAL'|'CONNECTED'|'BOTH'|'SAME_YTM_INTERNAL'|'UNKNOWN_SCOPE'}),populate(n:CanonicalNetwork|null){if(current===n)return;current=n;tm.replaceChildren();const allTm=element('option','','Tüm TM');allTm.value='';tm.append(allTm);for(const site of n?.sites??[]){const o=element('option','',site.name);o.value=site.id;tm.append(o);}areas.replaceChildren();const all=element('option','','Tüm YTM');all.value='';all.selected=true;areas.append(all);for(const[id,name]of new Map(n?.sites.map(s=>[s.areaId,s.areaName]))){if(!id)continue;const o=element('option','',name);o.value=id;areas.append(o);}}};
}
