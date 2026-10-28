import type {PsseBusBranchNetwork} from '../../domain/psse/network';
import type {PsseModel} from '../../importers/psse/types';
import {button,downloadText,element} from '../../ui/components/dom';
import {buildGeoSnapshot,type GeoSnapshot} from './geography';

/** Spreadsheet-safe CSV; full source identity stays in the local export. */
function csvCell(value:unknown){let text=String(value??'');if(/^[\s\u0000-\u001f\u007f]*[=+@-]/.test(text))text="'"+text;return '"'+text.replace(/"/g,'""')+'"';}
const csv=(rows:unknown[][])=>'\uFEFFsep=;\r\n'+rows.map(row=>row.map(csvCell).join(';')).join('\r\n');
export function psseUnmatchedGeographyCsv(geo:GeoSnapshot){
 return csv([['source_sha256','bus_id','external_number','bus_name','association_status','association_rule'],...geo.unmatched.map(row=>[geo.sourceSha256,row.busId,row.externalNumber,row.name,row.reason,'EXPLICIT_SOURCE_REFERENCE_THEN_EXACT_UNIQUE_SOURCE_NAME_ALIAS'])]);
}
export function psseGeographyProvenanceCsv(geo:GeoSnapshot){
 const stations=new Map(geo.stations.map(station=>[station.isub,station]));
 return csv([['source_sha256','bus_id','external_number','connection_key','bus_source_equipment_id','station_isub','station_name','latitude','longitude','association_method','bus_source_fields_json','station_source_fields_json'],...geo.associations.map(row=>{const station=stations.get(row.stationIsub)!;return [row.sourceSha256,row.busId,row.externalNumber,row.connectionKey,row.busSourceEquipmentId,row.stationIsub,station.name,station.latitude,station.longitude,row.method,JSON.stringify(row.busSourceFields),JSON.stringify(row.stationSourceFields)];})]);
}
export function psseGeographyTemplateCsv(){return csv([['source_sha256','bus_id','bus_source_name','source_bus_isub','station_isub','station_name','latitude','longitude','association_method','evidence_note']]);}

/** Source-coordinate diagnostics belong to Model → Quality, never below the map. */
export function createPsseGeographyReport(model:PsseModel,network:PsseBusBranchNetwork){
 const geo=buildGeoSnapshot(model,network),box=element('details','ga-psse-advanced ga-psse-geography-quality'),actions=element('div','ga-toolbar'),suffix=model.source.sha256.slice(0,12),c=geo.counts;
 box.append(element('summary','','Gelişmiş / Koordinat provenansı ve eşleşmeyen baralar'),element('p','ga-muted',`${c.validCoordinateStations}/${c.sourceStations} kaynak TM koordinatı · ${c.explicitReferences+c.exactNameAliases}/${c.sourceBuses} eşleşen bara · ${c.unmatchedBuses} eşleşmeyen · ${c.ambiguousBuses} belirsiz · ${c.invalidCoordinateStations} geçersiz koordinat.`));
 actions.append(button('Eşleşmeyen bara CSV',()=>downloadText(psseUnmatchedGeographyCsv(geo),`psse-tm-eslesmeyen-baralar-${suffix}.csv`,'text/csv;charset=utf-8')),button('TM eşleşme provenansı CSV',()=>downloadText(psseGeographyProvenanceCsv(geo),`psse-tm-geo-provenance-${suffix}.csv`,'text/csv;charset=utf-8')),button('Boş koordinat şablonu',()=>downloadText(psseGeographyTemplateCsv(),'TM_KOORDINAT_ESLEME_SABLONU.csv','text/csv;charset=utf-8')));
 box.append(actions,element('p','ga-muted','Eşleşmeler yalnız açık kaynak ilişkisi veya tekil tam kaynak adı ile kurulur. CSV kaynak kimliklerini ve eşleşme yöntemini korur; tam provenans dosyası gerçek koordinat içerir ve yerel kullanım içindir.'));
 return box;
}
