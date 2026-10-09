import type {PostMapResults,PostLoading} from '../contingency-ac/post-results';
export type ConstraintState='BASE_VIOLATION'|'NEW'|'WORSENED'|'PERSISTENT'|'RELIEVED'|'UNKNOWN_RATING'|'UNSOLVED_ISLAND'|'IDENTITY_UNVERIFIED';
export interface ConstraintChange {sourceClass:string;fid:string;physicalTerminalFids?:string[];voltageKv?:number;metric:'voltagePu'|'postLoadingPercent';side:string;base:number|null;post:number|null;delta:number|null;state:ConstraintState;limit:number|null;baseSeverity:number|null;postSeverity:number|null;loading?:PostLoading}
const severity=(v:number,min:number,max:number)=>Math.max(min-v,v-max,0);
export function constraintState(base:number,post:number,min:number,max:number):ConstraintState|null{
  const a=severity(base,min,max),b=severity(post,min,max);
  return a===0?(b>0?'NEW':null):b===0?'RELIEVED':b>a+1e-9?'WORSENED':'PERSISTENT';
}
const key=(b:PostMapResults['buses'][number])=>`${b.vnKv}|${[...b.terms].sort().join('|')}`;
export function comparePostConstraints(base:PostMapResults,post:PostMapResults,limits:{voltageMinPu:number;voltageMaxPu:number;operationalLoadingLimitPercent:number},outage?:{sourceClass:string;fid:string}):ConstraintChange[]{
  const rows:ConstraintChange[]=[],postTerms=new Set(post.buses.flatMap(b=>b.terms)),after=new Map(post.buses.map(b=>[key(b),b]));
  for(const b of base.buses){const p=after.get(key(b)),state=p?constraintState(b.vmPu,p.vmPu,limits.voltageMinPu,limits.voltageMaxPu):b.terms.some(t=>postTerms.has(t))?'IDENTITY_UNVERIFIED':'UNSOLVED_ISLAND';if(state)rows.push({sourceClass:'ElmTerm',fid:b.terms[0],physicalTerminalFids:b.terms,voltageKv:b.vnKv,metric:'voltagePu',side:'BUS',base:b.vmPu,post:p?.vmPu??null,delta:p?p.vmPu-b.vmPu:null,state,limit:(p?.vmPu??b.vmPu)<limits.voltageMinPu?limits.voltageMinPu:limits.voltageMaxPu,baseSeverity:severity(b.vmPu,limits.voltageMinPu,limits.voltageMaxPu),postSeverity:p?severity(p.vmPu,limits.voltageMinPu,limits.voltageMaxPu):null});}
  const branches=new Map(post.branches.map(b=>[`${b.sourceClass}:${b.fid}`,b]));
  for(const b of base.branches){if(b.sourceClass===outage?.sourceClass&&b.fid===outage.fid)continue;
    const p=branches.get(`${b.sourceClass}:${b.fid}`),a=b.loading,c=p?.loading,compatible=c&&a.basis===c.basis&&a.season===c.season&&a.fromLimitA===c.fromLimitA&&a.toLimitA===c.toLimitA&&a.ratingMva===c.ratingMva;
    const state:ConstraintState|null=!p?'UNSOLVED_ISLAND':a.operationalPercent===null||c!.operationalPercent===null?'UNKNOWN_RATING':!compatible?'IDENTITY_UNVERIFIED':constraintState(a.operationalPercent,c!.operationalPercent!,0,limits.operationalLoadingLimitPercent);
    if(state)rows.push({sourceClass:b.sourceClass,fid:b.fid,metric:'postLoadingPercent',side:'MAX_BOTH_ENDS',base:a.operationalPercent,post:c?.operationalPercent??null,delta:compatible&&a.operationalPercent!==null&&c!.operationalPercent!==null?c!.operationalPercent-a.operationalPercent:null,state,limit:limits.operationalLoadingLimitPercent,baseSeverity:a.operationalPercent===null?null:severity(a.operationalPercent,0,limits.operationalLoadingLimitPercent),postSeverity:c?.operationalPercent==null?null:severity(c.operationalPercent,0,limits.operationalLoadingLimitPercent),loading:c??a});
  }
  return rows;
}
export function constraintCounts(rows:readonly ConstraintChange[]){const counts:Record<string,number>={};for(const r of rows)counts[r.state]=(counts[r.state]??0)+1;return counts;}
