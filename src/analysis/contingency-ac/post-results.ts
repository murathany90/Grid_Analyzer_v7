import type {CanonicalNetwork} from '../../domain/model/network';
import type {CalculationResult} from '../../domain/results/types';
import {capacityLimit,type CapacitySeason} from '../../domain/model/capacity';

export interface PostLoading {currentPercent:number|null;apparentPercent:number|null;operationalPercent:number|null;basis:'CURRENT_A'|'APPARENT_MVA';season:CapacitySeason;fromLimitA:number|null;toLimitA:number|null;ratingMva:number|null;source:string;reason:string;missingRatingCause?:string;sourceCategory?:'TEIAS_VERIFIED'|'MODEL_NOMINAL'|'USER'|'UNKNOWN'}
export interface PostBranch {sourceClass:string;fid:string;from?:string;to?:string;voltageKv?:number;ytmIds?:string[];tapPosition?:number;angleDifferenceDeg?:number|null;pf:number;qf:number;pt:number;qt:number;ifA:number;itA:number;loading:PostLoading}
export interface PostMapResults {buses:{terms:string[];vnKv:number;vmPu:number;angleDeg:number;ytmIds?:string[]}[];branches:PostBranch[]}
/** One denominator definition for queue classification, observations and maps. */
export function postResultAssembler(n:CanonicalNetwork,r:CalculationResult,season:CapacitySeason):PostMapResults {
  const equipment=new Map([...n.lines,...n.transformers].map(e=>[`${e.sourceClass}:${e.id}`,e]));
  const sites=new Map(n.sites.map(s=>[s.id,s.areaId])),areas=(ids:readonly string[])=>[...new Set(ids.map(id=>sites.get(id)).filter((id):id is string=>!!id))],angles=new Map(r.buses.flatMap(b=>b.terms.map(t=>[t,b.angleRad] as const)));
  return {buses:r.buses.map(b=>({terms:b.terms,vnKv:b.vnKv,vmPu:b.vmPu,angleDeg:b.angleRad*180/Math.PI,ytmIds:areas(b.siteIds)})),branches:r.branches.map(b=>{
    const e=equipment.get(`${b.sourceClass}:${b.id}`),line=e&&'capacity' in e?e:undefined;
    const limit=line?.capacity?capacityLimit(line.capacity,line.vnKv,season):null;
    const amps=limit&&Number.isFinite(limit.currentKA)&&limit.currentKA>0?1000*limit.currentKA:null;
    const rating=e&&Number.isFinite(e.ratingMva)&&e.ratingMva!>0&&e.ratingMva!<99999?e.ratingMva:null;
    const current=amps!==null?100*Math.max(Math.abs(b.ifA)/amps,Math.abs(b.itA)/amps):null;
    const apparent=rating!==null?100*Math.max(Math.hypot(b.pf,b.qf),Math.hypot(b.pt,b.qt))/rating:null;
    const basis=b.sourceClass==='ElmLne'?'CURRENT_A':'APPARENT_MVA',operational=basis==='CURRENT_A'?current:apparent;
    const fromAngle=angles.get(e?.from??b.from),toAngle=angles.get(e?.to??b.to);
    const missingRatingCause=operational!==null?'':b.sourceClass==='ElmScap'?'SERIES_COMPENSATOR_RATING_NOT_IN_CANONICAL_MODEL':!e?'EQUIPMENT_IDENTITY_UNRESOLVED':basis==='CURRENT_A'?!line?.capacity?'NO_LINE_CAPACITY_METADATA':!amps?'NO_VALID_CURRENT_FOR_SELECTED_SEASON':'CURRENT_RESULT_UNAVAILABLE':!rating?'NO_VALID_TRANSFORMER_NOMINAL_MVA':'APPARENT_POWER_UNAVAILABLE';
    return {sourceClass:b.sourceClass,fid:e?.sourceId??b.id,from:e?.from??b.from,to:e?.to??b.to,voltageKv:b.vnKv,ytmIds:areas(b.siteIds),...e&&'tapPosition' in e?{tapPosition:e.tapPosition}:{},angleDifferenceDeg:fromAngle===undefined||toAngle===undefined?null:Math.atan2(Math.sin(fromAngle-toAngle),Math.cos(fromAngle-toAngle))*180/Math.PI,pf:b.pf,qf:b.qf,pt:b.pt,qt:b.qt,ifA:b.ifA,itA:b.itA,loading:{currentPercent:current,apparentPercent:apparent,operationalPercent:operational,basis,season,fromLimitA:amps,toLimitA:amps,ratingMva:rating,source:limit?.source??(rating!==null?'DGS_TRANSFORMER_RATED_MVA':'MISSING_RATING'),sourceCategory:operational===null?'UNKNOWN':limit?.source.startsWith('Kullanıcı')?'USER':'MODEL_NOMINAL',missingRatingCause,reason:operational===null?'UNKNOWN_RATING':''}};
  })};
}
export function postBranchMetric(b:PostBranch,metric:string,side='FROM'):number|null {
  const to=['TO','BUS2','LV'].includes(side.toUpperCase()),valid=['','FROM','BUS1','HV','TO','BUS2','LV'].includes(side.toUpperCase());if(!valid)return null;
  const values:Record<string,number|null>={postLoadingPercent:b.loading.operationalPercent,postCurrentLoadingPercent:b.loading.currentPercent,postApparentLoadingPercent:b.loading.apparentPercent,postPmw:to?b.pt:b.pf,postQmvar:to?b.qt:b.qf,postMva:to?Math.hypot(b.pt,b.qt):Math.hypot(b.pf,b.qf),postCurrentA:to?b.itA:b.ifA,postAngleDifferenceDeg:b.angleDifferenceDeg??null,postPLossMw:b.pf+b.pt,postQLossMvar:b.qf+b.qt,postTapPosition:b.tapPosition??null};
  const value=values[metric]??null;return value!==null&&Number.isFinite(value)?value:null;
}
