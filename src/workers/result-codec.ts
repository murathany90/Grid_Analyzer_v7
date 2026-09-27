import type { CalculationResult } from '../domain/results/types';
export interface PackedResult { meta:Omit<CalculationResult,'buses'|'branches'>; buses:Omit<CalculationResult['buses'][number],'vmPu'|'angleRad'|'pMw'|'qMvar'>[]; branches:Omit<CalculationResult['branches'][number],'pf'|'qf'|'pt'|'qt'|'ifA'|'itA'|'loading'|'pLoss'|'qLoss'>[]; busValues:Float64Array;branchValues:Float64Array }
export function packResult(result:CalculationResult):PackedResult{
  const{buses,branches,...meta}=result,busValues=new Float64Array(buses.length*4),branchValues=new Float64Array(branches.length*9);
  return{meta,busValues,branchValues,buses:buses.map(({vmPu,angleRad,pMw,qMvar,...row},i)=>{busValues.set([vmPu,angleRad,pMw,qMvar],i*4);return row;}),branches:branches.map(({pf,qf,pt,qt,ifA,itA,loading,pLoss,qLoss,...row},i)=>{branchValues.set([pf,qf,pt,qt,ifA,itA,loading??NaN,pLoss,qLoss],i*9);return row;})};
}
export function unpackResult(p:PackedResult):CalculationResult{return{...p.meta,buses:p.buses.map((b,i)=>({...b,vmPu:p.busValues[i*4],angleRad:p.busValues[i*4+1],pMw:p.busValues[i*4+2],qMvar:p.busValues[i*4+3]})),branches:p.branches.map((b,i)=>{const v=p.branchValues.subarray(i*9,i*9+9);return{...b,pf:v[0],qf:v[1],pt:v[2],qt:v[3],ifA:v[4],itA:v[5],loading:Number.isFinite(v[6])?v[6]:null,pLoss:v[7],qLoss:v[8]};})};}
