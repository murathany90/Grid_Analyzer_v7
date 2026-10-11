import type {CanonicalNetwork} from '../../domain/model/network';
import {effectiveNetwork,scenarioSignature,type ScenarioOverlay} from '../../domain/scenario/overlay';
import {buildTopology} from '../../topology/electrical-topology';
import {stableJson} from '../../domain/calculation/identity';
export interface OperationalLimits {voltageMinPu:number;voltageMaxPu:number;operationalLoadingLimitPercent:number}
export interface OperationalLimitProfile extends OperationalLimits {id:string;ytmId?:string;voltageKv?:number;provenance:string}
export function validateLimitProfiles(profiles:readonly OperationalLimitProfile[]=[]){
  const ids=new Set<string>();
  for(const p of profiles){if(!p.id||ids.has(p.id)||!p.provenance||(!p.ytmId&&p.voltageKv===undefined)||!(p.voltageMinPu>0&&p.voltageMinPu<p.voltageMaxPu)||!Number.isFinite(p.voltageMaxPu)||!(p.operationalLoadingLimitPercent>0&&Number.isFinite(p.operationalLoadingLimitPercent))||(p.voltageKv!==undefined&&!(p.voltageKv>0&&Number.isFinite(p.voltageKv))))throw Error('HYBRID_INVALID_LIMIT_PROFILE');ids.add(p.id);}
}
/** Most specific matching policy wins. Equal-specificity conflicting policies are an error. */
export function operationalLimits(defaults:OperationalLimits,profiles:readonly OperationalLimitProfile[]|undefined,voltageKv:number,ytmIds:readonly string[]=[]):OperationalLimits{
  const matches=(profiles??[]).filter(p=>(p.voltageKv===undefined||Math.abs(p.voltageKv-voltageKv)<1e-6)&&(!p.ytmId||ytmIds.includes(p.ytmId)));
  const specificity=(p:OperationalLimitProfile)=>Number(!!p.ytmId)+Number(p.voltageKv!==undefined);
  const best=matches.filter(p=>specificity(p)===Math.max(...matches.map(specificity)));
  if(best.some(p=>p.voltageMinPu!==best[0].voltageMinPu||p.voltageMaxPu!==best[0].voltageMaxPu||p.operationalLoadingLimitPercent!==best[0].operationalLoadingLimitPercent))throw Error('HYBRID_AMBIGUOUS_LIMIT_PROFILE');
  return best[0]??defaults;
}


export interface LimitConflict {sourceClass:string;fid:string;physicalTerminalFids?:readonly string[];voltageKv:number;ytmIds:readonly string[];profileIds:string[]}
export interface LimitPreflight {status:'READY'|'BLOCKED';checkedElements:number;conflicts:LimitConflict[];message:string}
const preflightCache=new WeakMap<CanonicalNetwork,{key:string;value:LimitPreflight}>();
/** Inspect the full effective graph before LF; target filters do not truncate BASE/POST constraints. */
export function preflightOperationalLimits(network:CanonicalNetwork,scenario:ScenarioOverlay,policy:OperationalLimits&{limitProfiles?:readonly OperationalLimitProfile[]}):LimitPreflight {
  const profiles=policy.limitProfiles??[];validateLimitProfiles(profiles);
  if(!profiles.length)return {status:'READY',checkedElements:0,conflicts:[],message:'Özel limit profili yok.'};
  const key=stableJson([scenarioSignature(scenario),profiles]),cached=preflightCache.get(network);if(cached?.key===key)return cached.value;
  const n=effectiveNetwork(network,scenario),topology=buildTopology(n),sites=new Map(n.sites.map(s=>[s.id,s.areaId])),areas=(ids:readonly string[])=>[...new Set(ids.map(id=>sites.get(id)).filter((id):id is string=>!!id))];
  const conflicts:LimitConflict[]=[];let checkedElements=0;
  const check=(sourceClass:string,fid:string,voltageKv:number,ytmIds:readonly string[],physicalTerminalFids?:readonly string[])=>{
    checkedElements++;const matching=profiles.filter(p=>(p.voltageKv===undefined||Math.abs(p.voltageKv-voltageKv)<1e-6)&&(!p.ytmId||ytmIds.includes(p.ytmId))),score=(p:OperationalLimitProfile)=>Number(!!p.ytmId)+Number(p.voltageKv!==undefined),best=matching.filter(p=>score(p)===Math.max(...matching.map(score)));
    if(best.some(p=>p.voltageMinPu!==best[0].voltageMinPu||p.voltageMaxPu!==best[0].voltageMaxPu||p.operationalLoadingLimitPercent!==best[0].operationalLoadingLimitPercent))conflicts.push({sourceClass,fid,voltageKv,ytmIds,physicalTerminalFids,profileIds:best.map(p=>p.id)});
  };
  for(const b of topology.buses)check('ElmTerm',b.terms[0],b.vnKv,areas(b.siteIds),b.terms);
  for(const e of [...n.lines,...n.transformers].filter(e=>e.inService&&!topology.blockedEquipment.has(e.id)))check(e.sourceClass,e.sourceId,e.vnKv,areas(e.siteIds));
  const message=conflicts.length?`Limit profili çakışması: ${conflicts.length} öğe. Eşit öncelikli profiller (${[...new Set(conflicts.flatMap(c=>c.profileIds))].slice(0,5).join(', ')}) farklı limitler içeriyor. YTM + gerilim profili tek alanlı profilden önceliklidir; eşit öncelikte sessiz seçim yapılmaz.`:'Limit profilleri uyumlu; YTM + gerilim profili tek alanlı profilden önceliklidir.';
  const value:LimitPreflight={status:conflicts.length?'BLOCKED':'READY',checkedElements,conflicts,message};preflightCache.set(network,{key,value});return value;
}
export function assertOperationalLimits(network:CanonicalNetwork,scenario:ScenarioOverlay,policy:OperationalLimits&{limitProfiles?:readonly OperationalLimitProfile[]}){
  const result=preflightOperationalLimits(network,scenario,policy);if(result.status==='BLOCKED')throw Error('HYBRID_AMBIGUOUS_LIMIT_PROFILE; '+result.message);return result;
}
