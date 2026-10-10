import type {CanonicalNetwork,Line,Transformer2W} from '../domain/model/network';
import type {CalculationResult} from '../domain/results/types';
import {capacitySession,selectedCapacity,selectedLineLoading} from '../domain/model/capacity';
import {postResultAssembler,postBranchMetric} from '../analysis/contingency-ac/post-results';
import {modelPresentationIndex,resultPresentationIndex} from './presentation-index';
export interface PresentedLoading {maximum:number|null;from:number|null;to:number|null;basis:string;source:string;season:string;status:string}
const cache=new WeakMap<CalculationResult,{network:CanonicalNetwork;revision:number;identity:string;values:Map<string,PresentedLoading>}>();
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
export function mapLoadingValues(network:CanonicalNetwork,result:CalculationResult){
  const session=capacitySession(network.modelHash),identity=JSON.stringify(result.identity),old=cache.get(result);if(old?.network===network&&old.revision===session.revision&&old.identity===identity)return old.values;
  const equipment=modelPresentationIndex(network).equipmentByKey,values=new Map<string,PresentedLoading>(),assembled=postResultAssembler(network,result,session.season),post=new Map(assembled.branches.map(b=>[b.sourceClass+':'+b.fid,b]));
  for(const [key,b] of resultPresentationIndex(network,result).branchByKey){const e=equipment.get(key),value:PresentedLoading={maximum:null,from:null,to:null,basis:'UNKNOWN',source:'UNKNOWN_CAPACITY',season:session.season,status:'UNKNOWN_CAPACITY'};
    if(e&&result.converged&&result.identity.modelHash===network.modelHash){
      if(e.sourceClass==='ElmLne'){const line=e as Line,limit=selectedCapacity(line,network.modelHash),loading=selectedLineLoading(line,network.modelHash,{...result,branches:[b]});if(limit&&loading){value.maximum=loading.percent;value.basis='CURRENT_A';value.source=loading.source;value.status=loading.quality;
          value.from=finite(b.ifA)&&b.ifA>=0?100*b.ifA/(limit.currentKA*1000):null;value.to=finite(b.itA)&&b.itA>=0?100*b.itA/(limit.currentKA*1000):null;}}
      else{const t=e as Transformer2W,p=post.get('ElmTr2:'+t.sourceId),rating=p?.loading.ratingMva;if(p&&finite(rating)&&rating>0&&rating<99999){const from=postBranchMetric(p,'postMva','FROM'),to=postBranchMetric(p,'postMva','TO');value.from=finite(from)?100*from/rating:null;value.to=finite(to)?100*to/rating:null;value.maximum=p.loading.apparentPercent;value.basis='APPARENT_MVA';value.source=p.loading.source;value.status='DGS_TRANSFORMER_RATED_MVA';}}
    }
    values.set(key,value);
  }
  cache.set(result,{network,revision:session.revision,identity,values});return values;
}
