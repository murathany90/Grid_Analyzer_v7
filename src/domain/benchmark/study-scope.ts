import type {CanonicalNetwork} from '../model/network';
import {voltageBandMatches} from '../n1/catalog';
export interface FaultScope {tmId?:string;ytmIds?:readonly string[];voltageBands?:readonly number[];search?:string}
/** Native site/area relationships define fault scope; the electrical network is untouched. */
export function selectFaultTerminals(network:CanonicalNetwork,scope:FaultScope={}){
  const sites=new Map(network.sites.map(s=>[s.id,s])),q=scope.search?.trim().toLocaleLowerCase('tr-TR');
  return network.buses.filter(b=>b.inService&&(!scope.tmId||b.siteIds.includes(scope.tmId))&&(!scope.voltageBands?.length||scope.voltageBands.some(v=>voltageBandMatches(b.vnKv,v)))&&(!scope.ytmIds?.length||b.siteIds.some(id=>scope.ytmIds!.includes(sites.get(id)?.areaId??'')))&&(!q||`${b.sourceId} ${b.name} ${b.siteIds.map(id=>sites.get(id)?.name??'').join(' ')}`.toLocaleLowerCase('tr-TR').includes(q))).map(b=>b.sourceId);
}
