import type {NumericalModel,PowerFlowResult,SparseMatrix} from './types';
import {buildY} from './ybus';
import {calcPQ,fillJacobian,makeLayout} from './jacobian';
import {ilu0,gmres,bicgstab} from './linear-solver';
import type {AdmittanceMatrix,JacobianLayout} from './types';

export type SensitivityFailure='SENSITIVITY_INDEX_UNAVAILABLE'|'SENSITIVITY_LINEAR_SOLVE_FAILED'|'SENSITIVITY_NONFINITE'|'SENSITIVITY_TOO_SMALL'|'SENSITIVITY_RESIDUAL_TOO_HIGH'|'SENSITIVITY_CONDITIONING_FAILURE';
export interface SensitivityProbe {
  slope:number|null;individualSlopes:(number|null)[];reason:SensitivityFailure|null;
  jacobianDimension:number;linearMethod:string|null;linearIterations:number|null;linearResidual:number|null;
  iluMinPivot:number|null;elapsedMs:number;
}
export interface SensitivityBatch {probes:SensitivityProbe[];jacobianBuildMs:number;orderingMs?:number;ilu1FactorMs?:number;ilu2FactorMs?:number;iluFactorMs:number;iterativeSolveMs?:number;sensitivitySolveMs:number;admittance:AdmittanceMatrix;layout:JacobianLayout}

/** ∂V(remote)/∂Q(actuator) from the converged NR Jacobian, in pu/MVAr. */
export function remoteVoltageSensitivities(model:NumericalModel,result:PowerFlowResult,pairs:readonly {actuatorBus:number;remoteBus:number}[]):(number|null)[]{
  if(!result.converged||!result.Vm||!result.Va)return pairs.map(()=>null);
  try{
    const Y=buildY(model),types=Int8Array.from(model.busType);for(const row of result.pvToPq||[])types[row.bus]=0;
    const layout=makeLayout(Y,types,model.slack),vm=Float64Array.from(result.Vm),va=Float64Array.from(result.Va),p=new Float64Array(model.n),q=new Float64Array(model.n),values=new Float64Array(layout.colIdx.length);
    calcPQ(Y,vm,va,p,q);fillJacobian(Y,layout,vm,va,p,q,values);
    const matrix:SparseMatrix={N:layout.N,rowPtr:layout.rowPtr,colIdx:layout.colIdx,values,pos:layout.pos,diagPos:layout.diagPos},factor=ilu0(matrix),base=model.baseMVA||100;
    const cache=new Map<number,Float64Array|null>();
    return pairs.map(({actuatorBus,remoteBus})=>{
      const input=layout.vIndex[actuatorBus],output=layout.vIndex[remoteBus];if(input<0||output<0)return null;
      if(!cache.has(input)){const rhs=new Float64Array(layout.N);rhs[input]=1/base;const solved=gmres(matrix,rhs,factor,1e-8,38,5)||bicgstab(matrix,rhs,factor,1e-8,Math.min(1200,Math.max(200,layout.N)));cache.set(input,solved?.x??null);}
      const vector=cache.get(input),sensitivity=vector?.[output];return sensitivity!=null&&Number.isFinite(sensitivity)?sensitivity:null;
    });
  }catch{return pairs.map(()=>null);}
}
