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
