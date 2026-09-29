import type {AdmittanceMatrix,JacobianLayout,NumericalModel,PowerFlowResult,SparseMatrix} from './types';
import {buildY} from './ybus';
import {calcPQ,fillJacobian,makeLayout} from './jacobian';
import {iluFill,gmres,bicgstab,csrMatVec} from './linear-solver';
import type {SensitivityBatch,SensitivityProbe,SensitivityFailure} from './sensitivity';

/** Adjoint form: one strictly checked solve per remote controller, regardless of unit count. */
export function probeAdjointSensitivities(model:NumericalModel,result:PowerFlowResult,groups:readonly {remoteBus:number;actuators:readonly {bus:number;weight:number}[]}[],admittance?:AdmittanceMatrix):SensitivityBatch {
  const clock=()=>performance.now(),start=clock(),Y=admittance??buildY(model),types=Int8Array.from(model.busType);
  for(const row of result.pvToPq||[])types[row.bus]=0;
  const layout=makeLayout(Y,types,model.slack),vm=Float64Array.from(result.Vm||[]),va=Float64Array.from(result.Va||[]),p=new Float64Array(model.n),q=new Float64Array(model.n),values=new Float64Array(layout.colIdx.length);
  calcPQ(Y,vm,va,p,q);fillJacobian(Y,layout,vm,va,p,q,values);
  const order:number[]=[];for(let bus=0;bus<model.n;bus++){if(layout.angIndex[bus]>=0)order.push(layout.angIndex[bus]);if(layout.vIndex[bus]>=0)order.push(layout.vIndex[bus]);}
  const inverse=new Int32Array(layout.N);order.forEach((old,i)=>inverse[old]=i);
  const counts=new Int32Array(layout.N);for(let k=0;k<layout.colIdx.length;k++)counts[inverse[layout.colIdx[k]]]++;
  const rowPtr=new Int32Array(layout.N+1);for(let i=0;i<layout.N;i++)rowPtr[i+1]=rowPtr[i]+counts[i];
  const cursor=Int32Array.from(rowPtr),colIdx=new Int32Array(values.length),transposed=new Float64Array(values.length);
  for(let oldRow=0;oldRow<layout.N;oldRow++){const row=inverse[oldRow];for(let k=layout.rowPtr[oldRow];k<layout.rowPtr[oldRow+1];k++){const at=cursor[inverse[layout.colIdx[k]]]++;colIdx[at]=row;transposed[at]=values[k];}}
  const pos=Array.from({length:layout.N},()=>new Map<number,number>()),diagPos=new Int32Array(layout.N).fill(-1);
  for(let i=0;i<layout.N;i++){const entries:Array<{col:number;value:number}>=[];for(let k=rowPtr[i];k<rowPtr[i+1];k++)entries.push({col:colIdx[k],value:transposed[k]});entries.sort((a,b)=>a.col-b.col);for(let j=0;j<entries.length;j++){const at=rowPtr[i]+j;colIdx[at]=entries[j].col;transposed[at]=entries[j].value;pos[i].set(entries[j].col,at);if(entries[j].col===i)diagPos[i]=at;}}
  const matrix:SparseMatrix={N:layout.N,rowPtr,colIdx,values:transposed,pos,diagPos},jacobianBuildMs=clock()-start;
  const factorStart=clock(),factor=iluFill(matrix,1),iluFactorMs=clock()-factorStart,base=model.baseMVA||100;
  const cache=new Map<number,{vector:Float64Array|null;method:string|null;iterations:number|null;residual:number|null;reason:SensitivityFailure|null}>();
  const probes=groups.map(group=>{const t=clock(),output=layout.vIndex[group.remoteBus],inputs=group.actuators.map(a=>layout.vIndex[a.bus]);
    const make=(reason:SensitivityFailure|null,individualSlopes:(number|null)[],slope:number|null,method:string|null=null,iterations:number|null=null,residual:number|null=null):SensitivityProbe=>({slope,individualSlopes,reason,jacobianDimension:layout.N,linearMethod:method,linearIterations:iterations,linearResidual:residual,iluMinPivot:factor.minPivot,elapsedMs:clock()-t});
    if(output<0||inputs.some(i=>i<0))return make('SENSITIVITY_INDEX_UNAVAILABLE',inputs.map(()=>null),null);
    const remote=inverse[output];if(!cache.has(remote)){const rhs=new Float64Array(layout.N);rhs[remote]=1;let solved=gmres(matrix,rhs,factor,1e-8,38,5),method=solved?'ILU1-ADJOINT-GMRES':null;
      if(!solved){solved=bicgstab(matrix,rhs,factor,1e-8,Math.min(1200,Math.max(200,layout.N)));method=solved?'ILU1-ADJOINT-BiCGSTAB':null;}
      let residual:number|null=null;if(solved){const ax=new Float64Array(layout.N);csrMatVec(matrix,solved.x,ax);let sq=0;for(let i=0;i<ax.length;i++){const delta=rhs[i]-ax[i];sq+=delta*delta;}residual=Math.sqrt(sq);}
      cache.set(remote,{vector:solved?.x??null,method,iterations:solved?.iterations??null,residual,reason:solved?residual!=null&&residual>1e-6?'SENSITIVITY_RESIDUAL_TOO_HIGH':null:'SENSITIVITY_LINEAR_SOLVE_FAILED'});}
    const saved=cache.get(remote)!;if(!saved.vector)return make(saved.reason,inputs.map(()=>null),null,saved.method,saved.iterations,saved.residual);
    const individual=inputs.map(input=>saved.vector![inverse[input]]/base),slope=individual.reduce((sum,value,i)=>sum+value*group.actuators[i].weight,0);
    return make(!Number.isFinite(slope)?'SENSITIVITY_NONFINITE':Math.abs(slope)<1e-9?'SENSITIVITY_TOO_SMALL':saved.reason,individual,slope,saved.method,saved.iterations,saved.residual);
  });
  return{probes,jacobianBuildMs,iluFactorMs,sensitivitySolveMs:clock()-start-jacobianBuildMs-iluFactorMs,admittance:Y,layout};
}
