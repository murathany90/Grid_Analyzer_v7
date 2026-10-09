import type {CanonicalNetwork} from '../../domain/model/network';
import type {CalculationResult} from '../../domain/results/types';
import {capacityLimit,type CapacitySeason} from '../../domain/model/capacity';

export interface PostLoading {currentPercent:number|null;apparentPercent:number|null;operationalPercent:number|null;basis:'CURRENT_A'|'APPARENT_MVA';season:CapacitySeason;fromLimitA:number|null;toLimitA:number|null;ratingMva:number|null;source:string;reason:string}
export interface PostBranch {sourceClass:string;fid:string;pf:number;qf:number;pt:number;qt:number;ifA:number;itA:number;loading:PostLoading}
export interface PostMapResults {buses:{terms:string[];vnKv:number;vmPu:number;angleDeg:number}[];branches:PostBranch[]}
/** One denominator definition for queue classification, observations and maps. */
export function postResultAssembler(n:CanonicalNetwork,r:CalculationResult,season:CapacitySeason):PostMapResults {
  const equipment=new Map([...n.lines,...n.transformers].map(e=>[`${e.sourceClass}:${e.id}`,e]));
  return {buses:r.buses.map(b=>({terms:b.terms,vnKv:b.vnKv,vmPu:b.vmPu,angleDeg:b.angleRad*180/Math.PI})),branches:r.branches.map(b=>{
    const e=equipment.get(`${b.sourceClass}:${b.id}`),line=e&&'capacity' in e?e:undefined;
    const limit=line?.capacity?capacityLimit(line.capacity,line.vnKv,season):null;
    const amps=limit&&Number.isFinite(limit.currentKA)&&limit.currentKA>0?1000*limit.currentKA:null;
    const rating=e&&Number.isFinite(e.ratingMva)&&e.ratingMva!>0&&e.ratingMva!<99999?e.ratingMva:null;
    const current=amps!==null?100*Math.max(Math.abs(b.ifA)/amps,Math.abs(b.itA)/amps):null;
    const apparent=rating!==null?100*Math.max(Math.hypot(b.pf,b.qf),Math.hypot(b.pt,b.qt))/rating:null;
    const basis=b.sourceClass==='ElmLne'?'CURRENT_A':'APPARENT_MVA',operational=basis==='CURRENT_A'?current:apparent;
    return {sourceClass:b.sourceClass,fid:e?.sourceId??b.id,pf:b.pf,qf:b.qf,pt:b.pt,qt:b.qt,ifA:b.ifA,itA:b.itA,loading:{currentPercent:current,apparentPercent:apparent,operationalPercent:operational,basis,season,fromLimitA:amps,toLimitA:amps,ratingMva:rating,source:limit?.source??(rating!==null?'DGS_TRANSFORMER_RATED_MVA':'MISSING_RATING'),reason:operational===null?'UNKNOWN_RATING':''}};
  })};
}
export function postBranchMetric(b:PostBranch,metric:string,side='FROM'):number|null {
  const to=['TO','BUS2','LV'].includes(side.toUpperCase()),valid=['','FROM','BUS1','HV','TO','BUS2','LV'].includes(side.toUpperCase());if(!valid)return null;
  const values:Record<string,number|null>={postLoadingPercent:b.loading.operationalPercent,postCurrentLoadingPercent:b.loading.currentPercent,postApparentLoadingPercent:b.loading.apparentPercent,postPmw:to?b.pt:b.pf,postQmvar:to?b.qt:b.qf,postMva:to?Math.hypot(b.pt,b.qt):Math.hypot(b.pf,b.qf),postCurrentA:to?b.itA:b.ifA};
  const value=values[metric]??null;return value!==null&&Number.isFinite(value)?value:null;
}
