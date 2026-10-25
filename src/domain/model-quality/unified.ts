import type {CanonicalNetwork,Entity,SourceRef} from '../model/network';
import type {ModelQualityAuditResult,ModelQualityFinding,ModelQualitySeverity} from './index';
import {buildTopology} from '../../topology/electrical-topology';
import {voltageMatches,type VoltageBand} from '../model/voltage-band';
export type FindingOrigin='SOURCE'|'AUDIT'|'GEOGRAPHY';
export type FindingCause='SOURCE_DATA'|'CONVERSION'|'METHOD_LIMITATION';
export interface UnifiedFinding extends Omit<ModelQualityFinding,'category'>{category:ModelQualityFinding['category']|'SOURCE'|'GEOGRAPHY';origins:FindingOrigin[];cause:FindingCause;siteIds:string[];voltages:number[];related:SourceRef[];evidence:{origin:FindingOrigin;message:string}[]}
const ranks:ModelQualitySeverity[]=['BLOCKER','ERROR','WARNING','INFO'];
export function unifiedQuality(network:CanonicalNetwork,audit:ModelQualityAuditResult|null):UnifiedFinding[]{
 const entities:Entity[]=[...network.sites,...network.buses,...network.lines,...network.transformers,...network.generators,...network.loads,...network.switches,...network.shunts,...network.seriesCompensators,...network.externalGrids,...network.stationControllers],index=new Map(entities.map(e=>[e.sourceClass+'|'+e.id,e])),terms=new Map(network.buses.map(b=>[b.id,b])),rows=new Map<string,UnifiedFinding>();
 const ref=(e:Entity,field:string):SourceRef=>({sourceClass:e.sourceClass,sourceId:e.id,field});
 const voltages=(e:Entity|undefined):number[]=>!e?[]:'voltages'in e?Array.from(e.voltages as number[]):'vnKv'in e?[Number(e.vnKv),...('lvKv'in e?[Number(e.lvKv)]:[])]:('bus'in e?[String(e.bus)]:'from'in e&&'to'in e?[String(e.from),String(e.to)]:[]).flatMap(id=>terms.has(id)?[terms.get(id)!.vnKv]:[]);
 function add(f:Omit<ModelQualityFinding,'category'>&{category:UnifiedFinding['category']},origin:FindingOrigin,cause:FindingCause='SOURCE_DATA',related:SourceRef[]=[]){
  const e=index.get(f.entityClass+'|'+f.entityId),key=[f.code,f.entityClass??'',f.entityId??'',f.field??'',f.code==='SOURCE_WARNING'?f.message:''].join('|'),old=rows.get(key);
  if(old){if(!old.origins.includes(origin))old.origins.push(origin);if(!old.evidence.some(v=>v.origin===origin&&v.message===f.message))old.evidence.push({origin,message:f.message});if(ranks.indexOf(f.severity)<ranks.indexOf(old.severity))rows.set(key,{...old,severity:f.severity});return;}
  rows.set(key,{...f,id:key,entityName:f.entityName??e?.name??null,origins:[origin],cause,siteIds:e?.sourceClass==='ElmSite'?[e.id]:[...(e?.siteIds??[])],voltages:voltages(e),related,evidence:[{origin,message:f.message}]});
 }
 if(audit?.modelHash===network.modelHash)for(const f of audit.findings){
  let related:SourceRef[]=[];
  if(f.code==='CONTROLLER_Q_LIMITS_UNAVAILABLE'&&f.entityId){const c=network.stationControllers.find(c=>c.id===f.entityId);related=(c?.unitIds??[]).flatMap(id=>{const g=network.generators.find(g=>g.id===id);return g&&(g.qMin==null||g.qMax==null)?[ref(g,'qMin/qMax')]:[];});}
  add(f,'AUDIT',f.category==='REDUCED_MODEL'?'METHOD_LIMITATION':'SOURCE_DATA',related);
 }
 const diagnostics=network.diagnostics??[],messages=new Set(diagnostics.map(d=>d.message));
 for(const [i,d]of diagnostics.entries()){
  const ids=d.sourceId?[d.sourceId]:d.code==='TRANSFORMER_TAP_FALLBACK'?[...(network.sourceFidelity?.transformerTapFallbackIds??[])]:[];
  for(const id of ids.length?ids:[null]){
   const same=[...rows.values()].find(f=>f.code===d.code&&f.entityId===id&&f.entityClass===(d.sourceClass??null)),entity=id?index.get(d.sourceClass+'|'+id):undefined,field=same?.field??(d.code==='TRANSFORMER_TAP_FALLBACK'?'tap':null);
   add({id:'source:'+i,code:d.code,severity:d.severity,category:'SOURCE',entityClass:d.sourceClass??null,entityId:id,entityName:entity?.name??null,field,originalValue:null,normalizedValue:null,unit:null,message:d.message,calculationImpact:d.code==='TRANSFORMER_TAP_FALLBACK'?'Kaynak tap oranı çözülemedi; dönüşümde 1,0 kullanıldı. Kaynak doğruluğu PARTIAL; trafo oranını inceleyin.':'Kaynak tanısı; hesaplama kapsamı ve ilgili kaynak alanları incelenmeli.',sourceRefs:entity?[ref(entity,field??'source')]:[]},'SOURCE',d.code==='TRANSFORMER_TAP_FALLBACK'?'CONVERSION':'SOURCE_DATA');
  }
 }
 // The importer emits this structured issue format; a FID is accepted only
 // when its exact class/FID exists in the canonical inventory.
 const warnings=new Set(network.warnings);for(const message of warnings){
  if(messages.has(message))continue;
  const matching=[...rows.values()].find(f=>f.message===message);if(matching){add(matching,'SOURCE');continue;}
  const tap=/^Trafo kademe oranı çözülemedi; 1\.0: (.+)$/.exec(message),proven=tap&&network.sourceFidelity?.transformerTapFallbackIds.includes(tap[1])?rows.get(['TRANSFORMER_TAP_FALLBACK','ElmTr2',tap[1],'tap',''].join('|')):undefined;if(proven){add({...proven,message},'SOURCE','CONVERSION');continue;}
  const issue=/^\[(Bilgi|Uyarı|Kritik)\] (\w+) ([^:]+): (.*?) — /.exec(message),entity=issue?index.get(issue[2]+'|'+issue[3]):undefined;
  const coordinates=issue?.[2]==='ElmSubstat'&&issue[4]==='Geçersiz TM koordinatı';
  const geo=!!entity&&issue?.[2]==='ElmLne'&&['Hat güzergâhı bulunamadı','Hat güzergâhı tek noktalı'].includes(issue[4]),code=geo?'LINE_ROUTE_MISSING':coordinates?'SOURCE_COORDINATES_INVALID':'SOURCE_WARNING',field=geo?'GPScoords':coordinates?'GPSlat/GPSlon':null;
  const sourceRef=coordinates&&issue?{sourceClass:issue[2],sourceId:issue[3],field:field!}:undefined;
  add({id:message,code,severity:geo||issue?.[1]==='Bilgi'?'INFO':issue?.[1]==='Kritik'?'BLOCKER':'WARNING',category:geo||coordinates?'GEOGRAPHY':'SOURCE',entityClass:entity?.sourceClass??sourceRef?.sourceClass??null,entityId:entity?.id??sourceRef?.sourceId??null,entityName:entity?.name??null,field,originalValue:null,normalizedValue:null,unit:null,message,calculationImpact:geo||coordinates?'Coğrafi kaynak kaydı eksik/geçersiz; elektriksel hesap hatası değildir.':entity?'Kaynak alanlarını ve hesaplama kapsamını inceleyin.':'Toplu kaynak uyarısı; ekipman FID bağı kanıtlanmadı.',sourceRefs:entity?[ref(entity,field??'source')]:sourceRef?[sourceRef]:[]},'SOURCE');
 }
 for(const site of network.sites)if(site.lat==null||site.lon==null)add({id:site.id,code:'SITE_COORDINATES_MISSING',severity:'INFO',category:'GEOGRAPHY',entityClass:site.sourceClass,entityId:site.id,entityName:site.name,field:'GPSlat/GPSlon',originalValue:{lat:site.lat,lon:site.lon},normalizedValue:null,unit:null,message:'TM koordinatı kaynakta yok.',calculationImpact:'Harita yerleşimi eksik; elektriksel hesap hatası değildir.',sourceRefs:[ref(site,'GPSlat/GPSlon')]},'GEOGRAPHY');
 for(const line of network.lines)if(line.coordinates.length<2)add({id:line.id,code:'LINE_ROUTE_MISSING',severity:'INFO',category:'GEOGRAPHY',entityClass:line.sourceClass,entityId:line.id,entityName:line.name,field:'GPScoords',originalValue:null,normalizedValue:null,unit:null,message:'Hat güzergâhı kaynakta yok.',calculationImpact:'Harita güzergâhı eksik; elektriksel parametreler ayrı değerlendirilir.',sourceRefs:[ref(line,'GPScoords')]},'GEOGRAPHY');
 // Link the aggregate conflict only through actual closed-switch electrical buses.
 const conflicts=[...rows.values()].filter(f=>f.code==='CONTROLLER_LOCAL_VOLTAGE_CONFLICT');if(conflicts.length){const topo=buildTopology(network),byUnit=new Map(network.generators.map(g=>[g.id,g]));for(const c of network.stationControllers.filter(c=>c.inService)){const remote=topo.terminalToBus.get(c.remoteBus);if(remote==null)continue;for(const id of c.unitIds){const g=byUnit.get(id),bus=g?topo.terminalToBus.get(g.bus):undefined;if(g?.voltageControl&&bus!==remote)for(const f of conflicts)f.related.push(ref(c,'remoteBus'),ref(g,'voltageControl'));}}}
 for(const f of rows.values()){f.related=[...new Map(f.related.map(r=>[r.sourceClass+'|'+r.sourceId,r])).values()];if(!f.siteIds.length)f.siteIds=[...new Set(f.related.flatMap(r=>index.get(r.sourceClass+'|'+r.sourceId)?.siteIds??[]))];}
 return [...rows.values()].sort((a,b)=>ranks.indexOf(a.severity)-ranks.indexOf(b.severity)||a.code.localeCompare(b.code)||a.id.localeCompare(b.id));
}
export function matchesUnifiedFinding(f:UnifiedFinding,n:CanonicalNetwork,filters:{areaId:string;siteId:string;voltages:ReadonlySet<VoltageBand>;search:string}){
 const scoped=!!filters.areaId||!!filters.siteId||filters.voltages.size<5;if(scoped&&!f.siteIds.length)return false;
 if(filters.siteId&&!f.siteIds.includes(filters.siteId))return false;if(filters.areaId&&!n.sites.some(s=>f.siteIds.includes(s.id)&&s.areaId===filters.areaId))return false;
 if(filters.voltages.size<5&&!f.voltages.some(v=>voltageMatches(v,filters.voltages)))return false;
 const search=filters.search.trim().toLocaleLowerCase('tr-TR');return !search||[f.code,f.entityName,f.entityId,f.message,...f.related.map(r=>r.sourceId)].join(' ').toLocaleLowerCase('tr-TR').includes(search);
}
