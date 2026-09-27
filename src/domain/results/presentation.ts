import type { CanonicalNetwork } from '../model/network';
import { capacitySession, selectedCapacity } from '../model/capacity';
import type { BranchResult, CalculationResult } from './types';

const cache = new WeakMap<CalculationResult,{network:CanonicalNetwork;revision:number;rows:Map<string,BranchResult>}>();
/** View-only capacity choice. Solver results and their calculation identity are never rewritten. */
export function displayBranches(network:CanonicalNetwork,result:CalculationResult|null):Map<string,BranchResult>{
  if(!result)return new Map();
  const session=capacitySession(network.modelHash),existing=cache.get(result);
  if(existing?.network===network&&existing.revision===session.revision)return existing.rows;
  const lines=new Map(network.lines.map(l=>[l.id,l])),rows=new Map<string,BranchResult>();
  for(const branch of result.branches){
    const line=branch.sourceClass==='ElmLne'?lines.get(branch.id):undefined;
    let row=branch;
    if(line?.capacity){
      const limit=selectedCapacity(line,network.modelHash),currents=[branch.ifA,branch.itA].filter(v=>Number.isFinite(v)&&v>=0);
      const loading=result.converged&&result.identity.modelHash===network.modelHash&&limit&&currents.length?Math.max(...currents)/(limit.currentKA*10):null;
      row={...branch,loading};
    }
    rows.set(`${row.sourceClass}|${row.id}`,row);
  }
  cache.set(result,{network,revision:session.revision,rows});return rows;
}
