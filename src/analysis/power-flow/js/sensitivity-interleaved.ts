import type {AdmittanceMatrix,JacobianLayout,NumericalModel,PowerFlowResult,SparseMatrix} from './types';
import {buildY} from './ybus';
import {calcPQ,fillJacobian,makeLayout} from './jacobian';
import {iluFill,gmres,bicgstab,csrMatVec} from './linear-solver';
import type {SensitivityBatch,SensitivityProbe,SensitivityFailure} from './sensitivity';

export interface AdjointSensitivityBatch extends SensitivityBatch {
  busSensitivityByRemote:Array<Map<number,number>|null>;
  sensitivityMatrix:Array<Array<number|null>>;
}
export interface AdjointRhsSolution {solution:Float64Array|null;method:string|null;iterations:number;residual:number|null;minPivot:number|null;reason:SensitivityFailure|null}
export function solveSensitivityRhs(matrix:SparseMatrix,rhs:Float64Array,factor1:ReturnType<typeof iluFill>,getFactor2:()=>ReturnType<typeof iluFill>):AdjointRhsSolution {
  let solution:Float64Array|null=null,method:string|null=null,iterations=0,residual:number|null=null,minPivot:number|null=factor1.minPivot,usedAnySolution=false,failedResidual=false;
  const trueResidual=(x:Float64Array)=>{const ax=new Float64Array(matrix.N);csrMatVec(matrix,x,ax);let sum=0,normB=0;for(let i=0;i<rhs.length;i++){const delta=rhs[i]-ax[i];sum+=delta*delta;normB+=rhs[i]*rhs[i];}return Math.sqrt(sum)/Math.max(1e-14,Math.sqrt(normB));};
  const accept=(candidate:ReturnType<typeof gmres>,candidateMethod:string,candidatePivot:number|null)=>{method=candidateMethod;if(!candidate)return false;usedAnySolution=true;iterations+=candidate.iterations;const actual=trueResidual(candidate.x);if(!Number.isFinite(actual)||actual>1e-6){failedResidual=true;residual=actual;return false;}solution=candidate.x;residual=actual;minPivot=candidatePivot;return true;};
  accept(gmres(matrix,rhs,factor1,1e-6,38,5),'ILU1-GMRES',factor1.minPivot);
  if(!solution){const factor2=getFactor2();accept(gmres(matrix,rhs,factor2,1e-6,38,5),'ILU2-GMRES',factor2.minPivot);if(!solution)accept(bicgstab(matrix,rhs,factor2,1e-6,Math.min(1200,Math.max(200,matrix.N))),'ILU2-BiCGSTAB',factor2.minPivot);}
  return{solution,method,iterations,residual,minPivot,reason:solution?null:(failedResidual||usedAnySolution?'SENSITIVITY_RESIDUAL_TOO_HIGH':'SENSITIVITY_LINEAR_SOLVE_FAILED')};
}

/** Adjoint form: one strictly checked solve per remote controller, regardless of unit count. */
export function probeAdjointSensitivities(model:NumericalModel,result:PowerFlowResult,groups:readonly {remoteBus:number;actuators:readonly {bus:number;weight:number}[]}[],admittance?:AdmittanceMatrix):AdjointSensitivityBatch {
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
  const factorStart=clock(),factor1=iluFill(matrix,1);let iluFactorMs=clock()-factorStart,factor2:ReturnType<typeof iluFill>|null=null;
  const getFactor2=()=>{if(!factor2){const t=clock();factor2=iluFill(matrix,2);iluFactorMs+=clock()-t;}return factor2;};
  const base=model.baseMVA||100,actuatorBuses=[...new Set(groups.flatMap(group=>group.actuators.map(actuator=>actuator.bus)))];
  const cache=new Map<number,{vector:Float64Array|null;method:string|null;iterations:number|null;residual:number|null;minPivot:number|null;reason:SensitivityFailure|null}>();
  const solveRemote=(remote:number)=>{if(cache.has(remote))return cache.get(remote)!;const rhs=new Float64Array(layout.N);rhs[remote]=1;const solved=solveSensitivityRhs(matrix,rhs,factor1,getFactor2),value={vector:solved.solution,method:solved.method,iterations:solved.iterations,residual:solved.residual,minPivot:solved.minPivot,reason:solved.reason};cache.set(remote,value);return value;};
  const busSensitivityByRemote:Array<Map<number,number>|null>=[],probes: SensitivityProbe[]=groups.map(group=>{const t=clock(),output=layout.vIndex[group.remoteBus],inputs=group.actuators.map(a=>layout.vIndex[a.bus]);
    const make=(reason:SensitivityFailure|null,individualSlopes:(number|null)[],slope:number|null,method:string|null=null,iterations:number|null=null,residual:number|null=null,minPivot:number|null=null):SensitivityProbe=>({slope,individualSlopes,reason,jacobianDimension:layout.N,linearMethod:method,linearIterations:iterations,linearResidual:residual,iluMinPivot:minPivot,elapsedMs:clock()-t});
    if(output<0){busSensitivityByRemote.push(null);return make('SENSITIVITY_INDEX_UNAVAILABLE',inputs.map(()=>null),null);}
    const saved=solveRemote(inverse[output]);if(!saved.vector){busSensitivityByRemote.push(null);return make(saved.reason,inputs.map(()=>null),null,saved.method,saved.iterations,saved.residual,saved.minPivot);}
    const busSlopes=new Map<number,number>();for(const bus of actuatorBuses){const input=layout.vIndex[bus];if(input>=0)busSlopes.set(bus,saved.vector[inverse[input]]/base);}busSensitivityByRemote.push(busSlopes);
    const individual=inputs.map(input=>input<0?null:saved.vector![inverse[input]]/base),slope=individual.every((value):value is number=>value!=null)?individual.reduce((sum,value,i)=>sum+value*group.actuators[i].weight,0):null;
    return make(slope==null?'SENSITIVITY_INDEX_UNAVAILABLE':!Number.isFinite(slope)?'SENSITIVITY_NONFINITE':Math.abs(slope)<1e-9?'SENSITIVITY_TOO_SMALL':null,individual,slope,saved.method,saved.iterations,saved.residual,saved.minPivot);
  });
  const sensitivityMatrix=busSensitivityByRemote.map(row=>groups.map(group=>row==null?null:group.actuators.reduce((sum,actuator)=>sum+(row.get(actuator.bus)??0)*actuator.weight,0)));
  return{probes,busSensitivityByRemote,sensitivityMatrix,jacobianBuildMs,iluFactorMs,sensitivitySolveMs:clock()-start-jacobianBuildMs-iluFactorMs,admittance:Y,layout};
}
