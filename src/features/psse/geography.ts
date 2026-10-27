import type {PsseBus,PsseBusBranchNetwork} from '../../domain/psse/network';
import type {PsseEquipment,PsseModel} from '../../importers/psse/types';

export type GeoAssociationMethod='EXPLICIT_SOURCE_REFERENCE'|'EXACT_UNIQUE_SOURCE_NAME_ALIAS';
export interface GeoStation {
  isub:string;
  sourceEquipmentId:string;
  name:string;
  latitude:number;
  longitude:number;
  sourceFields:Record<string,unknown>;
}
export interface GeoBusAssociation {
  sourceSha256:string;
  connectionKey:string;
  busId:string;
  externalNumber:number|null;
  stationIsub:string;
  method:GeoAssociationMethod;
  busSourceEquipmentId:string|null;
  busSourceFields:Record<string,unknown>;
  stationSourceFields:Record<string,unknown>;
}
export interface GeoUnmatchedBus {connectionKey:string;busId:string;externalNumber:number|null;name:string;reason:'NO_SOURCE_BUS_RECORD'|'NO_STATION_REFERENCE'|'UNKNOWN_STATION_REFERENCE'|'AMBIGUOUS_STATION_REFERENCE'|'AMBIGUOUS_STATION_NAME'|'STATION_COORDINATE_INVALID';}
export interface GeoSnapshot {
  stations:GeoStation[];
  associations:GeoBusAssociation[];
  unmatched:GeoUnmatchedBus[];
  unreferencedStationIsubs:string[];
  invalidCoordinateStationIsubs:string[];
  counts:{sourceStations:number;validCoordinateStations:number;invalidCoordinateStations:number;sourceBuses:number;explicitReferences:number;exactNameAliases:number;ambiguousBuses:number;unmatchedBuses:number;unreferencedStations:number};
  sourceSha256:string;
}

/** Strict source-label comparison. This is deliberately not a geographic or bus-number heuristic. */
export function normalizeSourceAlias(value:unknown):string{
  return typeof value==='string'?value.normalize('NFKC').trim().replace(/\s+/gu,' ').toLocaleLowerCase('tr-TR'):'';
}
function asIsub(value:unknown):string|null{
  if(typeof value==='number'&&Number.isSafeInteger(value)&&value>=0)return String(value);
  if(typeof value==='string'&&/^\d+$/.test(value.trim()))return String(Number(value.trim()));
  return null;
}
function validCoordinate(equipment:PsseEquipment):{latitude:number;longitude:number}|null{
  const latitude=equipment.fields.latitude,longitude=equipment.fields.longitude;
  if(typeof latitude!=='number'||typeof longitude!=='number'||!Number.isFinite(latitude)||!Number.isFinite(longitude))return null;
  if(latitude===0||longitude===0||latitude < -90||latitude > 90||longitude < -180||longitude > 180)return null;
  return{latitude,longitude};
}
function busEquipment(bus:PsseBus,byId:ReadonlyMap<string,PsseEquipment>){return bus.sourceEquipmentId?byId.get(bus.sourceEquipmentId)??null:null;}

/**
 * Associates normalized physical buses with source substations. Direct native isub references
 * always win. If absent, only one exact, normalized source-name match is accepted. Coordinates
 * must be numeric source latitude/longitude fields in WGS84 bounds; no bus ID or city inference.
 */
export function buildGeoSnapshot(model:PsseModel,network:PsseBusBranchNetwork):GeoSnapshot{
  const equipmentById=new Map(model.equipment.map(item=>[item.id,item]));
  const sourceStations=model.equipment.filter(item=>item.kind==='substation'),stationByIsub=new Map<string,PsseEquipment>(),ambiguousStationIsubs=new Set<string>(),aliasIndex=new Map<string,PsseEquipment[]>();
  for(const station of sourceStations){
    const isub=asIsub(station.fields.isub)??asIsub(station.id);if(isub!==null){const previous=stationByIsub.get(isub);if(previous&&previous.id!==station.id)ambiguousStationIsubs.add(isub);else stationByIsub.set(isub,station);}
    const alias=normalizeSourceAlias(station.name||station.fields.name);if(alias)(aliasIndex.get(alias)??(aliasIndex.set(alias,[]),aliasIndex.get(alias)!)).push(station);
  }
  const stations:GeoStation[]=[],invalidCoordinateStationIsubs:string[]=[];
  for(const [isub,equipment] of stationByIsub){if(ambiguousStationIsubs.has(isub))continue;const coordinate=validCoordinate(equipment);if(!coordinate){invalidCoordinateStationIsubs.push(isub);continue;}stations.push({isub,sourceEquipmentId:equipment.id,name:equipment.name||String(equipment.fields.name??`TM ${isub}`),...coordinate,sourceFields:{isub:equipment.fields.isub??equipment.id,latitude:equipment.fields.latitude,longitude:equipment.fields.longitude}});}
  const coordinateIsubs=new Set(stations.map(station=>station.isub)),associations:GeoBusAssociation[]=[],unmatched:GeoUnmatchedBus[]=[],referenced=new Set<string>();let explicitReferences=0,exactNameAliases=0,ambiguousBuses=0;
  for(const bus of network.buses){if(!bus.source)continue;const source=busEquipment(bus,equipmentById),name=String(source?.name??source?.fields.name??bus.id);let station:PsseEquipment|undefined,method:GeoAssociationMethod|undefined,reason:GeoUnmatchedBus['reason']|null=null;
    if(!source||source.kind!=='bus'){reason='NO_SOURCE_BUS_RECORD';}
    else{
      const rawReference=source.fields.isub;
      if(rawReference!==undefined&&rawReference!==null&&rawReference!==''){
        const isub=asIsub(rawReference);method='EXPLICIT_SOURCE_REFERENCE';if(isub!==null&&ambiguousStationIsubs.has(isub)){station=undefined;reason='AMBIGUOUS_STATION_REFERENCE';}else station=isub===null?undefined:stationByIsub.get(isub);
        if(!station&&!reason)reason='UNKNOWN_STATION_REFERENCE';
      }else{
        const alias=normalizeSourceAlias(source.name||source.fields.name),candidates=alias?aliasIndex.get(alias)??[]:[];
        if(candidates.length===1){station=candidates[0];method='EXACT_UNIQUE_SOURCE_NAME_ALIAS';}
        else if(candidates.length>1){reason='AMBIGUOUS_STATION_NAME';ambiguousBuses++;}
        else reason='NO_STATION_REFERENCE';
      }
        if(station&&method){const isub=asIsub(station.fields.isub)??asIsub(station.id);if(isub===null)reason='UNKNOWN_STATION_REFERENCE';else if(!coordinateIsubs.has(isub))reason='STATION_COORDINATE_INVALID';else{associations.push({sourceSha256:model.source.sha256,connectionKey:bus.connectionKey,busId:bus.id,externalNumber:bus.externalNumber,stationIsub:isub,method,busSourceEquipmentId:source.id,busSourceFields:{name:source.name,...source.fields},stationSourceFields:{name:station.name,...station.fields}});referenced.add(isub);if(method==='EXPLICIT_SOURCE_REFERENCE')explicitReferences++;else exactNameAliases++;continue;}}
    }
    unmatched.push({connectionKey:bus.connectionKey,busId:bus.id,externalNumber:bus.externalNumber,name,reason:reason??'NO_STATION_REFERENCE'});
  }
  const allStationIsubs=[...stationByIsub.keys()],unreferencedStationIsubs=allStationIsubs.filter(isub=>coordinateIsubs.has(isub)&&!referenced.has(isub));
  return{stations,associations,unmatched,unreferencedStationIsubs,invalidCoordinateStationIsubs,sourceSha256:model.source.sha256,counts:{sourceStations:sourceStations.length,validCoordinateStations:stations.length,invalidCoordinateStations:invalidCoordinateStationIsubs.length,sourceBuses:network.buses.filter(bus=>bus.source).length,explicitReferences,exactNameAliases,ambiguousBuses,unmatchedBuses:unmatched.length,unreferencedStations:unreferencedStationIsubs.length}};
}
