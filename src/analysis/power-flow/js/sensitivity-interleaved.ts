import type {AdmittanceMatrix,IterativeSolveDiagnostics,JacobianLayout,NumericalModel,PowerFlowResult,SparseMatrix} from './types';
import {buildY} from './ybus';
import {calcPQ,fillJacobian,makeLayout} from './jacobian';
import {iluFill,gmres,bicgstab,csrMatVec} from './linear-solver';
import {permuteSparseMatrix,permuteVector,reverseCuthillMcKee,unpermuteVector} from './ordering';
import {KluSparseDirectFactorization} from './sparse-direct';
import type {SensitivityBatch,SensitivityProbe,SensitivityFailure} from './sensitivity';

export type SensitivityOrdering='NATURAL'|'RCM';
export interface SensitivityAttemptDiagnostic {method:'ILU1-GMRES'|'ILU2-GMRES'|'ILU2-BiCGSTAB';iterations:number;trueResidual:number|null;solveMs:number;accepted:boolean}
export interface SensitivityRhsDiagnostic {remoteBus:number;dimension:number;nnz:number;ordering:SensitivityOrdering;method:string|null;iterations:number;trueResidual:number|null;solveMs:number;minPivotBeforeRegularization:number|null;minPivotAfterRegularization:number|null;regularizedPivotCount:number;pivotSource:'ILU_CLEAN'|'ILU_REGULARIZED'|'RCM_ILU'|'DIRECT';fallbackCount:number;reason:SensitivityFailure|null;attempts:SensitivityAttemptDiagnostic[]}
export interface SensitivitySolverDiagnostic {backend:'KLU_WASM'|'LEGACY_KRYLOV';ordering:SensitivityOrdering;dimension:number;nnz:number;rhsCount:number;uniqueRemoteRhsCount:number;cachedRhsHits:number;methodCounts:Record<string,number>;failureCounts:Record<string,number>;medianIterations:number|null;p95Iterations:number|null;medianTrueResidual:number|null;p95TrueResidual:number|null;orderingMs:number;ilu1FactorMs:number;ilu2FactorMs:number;iterativeSolveMs:number;cscConversionMs:number;symbolicFactorMs:number;numericFactorMs:number;directSolveMs:number;factorizations:number;rhs:SensitivityRhsDiagnostic[]}
export interface AdjointSensitivityBatch extends SensitivityBatch {
  busSensitivityByRemote:Array<Map<number,number>|null>;
  sensitivityMatrix:Array<Array<number|null>>;
  solverDiagnostics:SensitivitySolverDiagnostic;
}
export interface AdjointRhsSolution {solution:Float64Array|null;method:string|null;iterations:number;residual:number|null;minPivot:number|null;minPivotBeforeRegularization:number|null;minPivotAfterRegularization:number|null;regularizedPivotCount:number;fallbackCount:number;solveMs:number;attempts:SensitivityAttemptDiagnostic[];reason:SensitivityFailure|null}
export function solveSensitivityRhs(matrix:SparseMatrix,rhs:Float64Array,factor1:ReturnType<typeof iluFill>,getFactor2:()=>ReturnType<typeof iluFill>):AdjointRhsSolution {
  let solution:Float64Array|null=null,method:string|null=null,iterations=0,residual:number|null=null,minPivot:number|null=factor1.minPivot,usedAnySolution=false,failedResidual=false,usedFactor=factor1;
  const attempts:SensitivityAttemptDiagnostic[]=[];
  const trueResidual=(x:Float64Array)=>{const ax=new Float64Array(matrix.N);csrMatVec(matrix,x,ax);let sum=0,normB=0;for(let i=0;i<rhs.length;i++){const delta=rhs[i]-ax[i];sum+=delta*delta;normB+=rhs[i]*rhs[i];}return Math.sqrt(sum)/Math.max(1e-14,Math.sqrt(normB));};
  const attempt=(name:SensitivityAttemptDiagnostic['method'],factor:ReturnType<typeof iluFill>)=>{
    method=name;usedFactor=factor;const trace:IterativeSolveDiagnostics={iterations:0,trueResidual:null},start=performance.now();
    const candidate=name==='ILU2-BiCGSTAB'?bicgstab(matrix,rhs,factor,1e-6,Math.min(1200,Math.max(200,matrix.N)),trace):gmres(matrix,rhs,factor,1e-6,38,5,trace);
    const solveMs=performance.now()-start,actual=candidate?trueResidual(candidate.x):trace.trueResidual,accepted=!!candidate&&actual!=null&&Number.isFinite(actual)&&actual<=1e-6;
    const count=candidate?.iterations??trace.iterations;iterations+=count;residual=actual;minPivot=factor.minPivot;
    if(candidate)usedAnySolution=true;if(actual!=null&&(!Number.isFinite(actual)||actual>1e-6))failedResidual=true;
    attempts.push({method:name,iterations:count,trueResidual:actual,solveMs,accepted});if(accepted)solution=candidate!.x;
  };
  attempt('ILU1-GMRES',factor1);
  if(!solution){const factor2=getFactor2();attempt('ILU2-GMRES',factor2);if(!solution)attempt('ILU2-BiCGSTAB',factor2);}
  return{solution,method,iterations,residual,minPivot,minPivotBeforeRegularization:usedFactor.minPivotBeforeRegularization??usedFactor.minPivot,minPivotAfterRegularization:usedFactor.minPivotAfterRegularization??usedFactor.minPivot,regularizedPivotCount:usedFactor.regularizedPivotCount??0,fallbackCount:attempts.length-1,solveMs:attempts.reduce((sum,row)=>sum+row.solveMs,0),attempts,reason:solution?null:(failedResidual||usedAnySolution?'SENSITIVITY_RESIDUAL_TOO_HIGH':'SENSITIVITY_LINEAR_SOLVE_FAILED')};
}

/** Adjoint form: one strictly checked solve per remote controller, regardless of unit count. */
export function probeAdjointSensitivities(model:NumericalModel,result:PowerFlowResult,groups:readonly {remoteBus:number;actuators:readonly {bus:number;weight:number}[]}[],admittance?:AdmittanceMatrix,options:{ordering?:SensitivityOrdering;solver?:'DIRECT'|'LEGACY_KRYLOV'}={}):AdjointSensitivityBatch {
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
  const ordering=options.ordering??'NATURAL',orderStart=clock(),permutation=ordering==='RCM'?reverseCuthillMcKee(matrix):null,solverMatrix=permutation?permuteSparseMatrix(matrix,permutation):matrix,orderingMs=clock()-orderStart;
  const direct=options.solver!=='LEGACY_KRYLOV';let ilu1FactorMs=0,ilu2FactorMs=0,factor2:ReturnType<typeof iluFill>|null=null;
  const factor1=direct?null:(()=>{const t=clock(),factor=iluFill(solverMatrix,1);ilu1FactorMs=clock()-t;return factor;})();
  const getFactor2=()=>{if(!factor2){const t=clock();factor2=iluFill(solverMatrix,2);ilu2FactorMs+=clock()-t;}return factor2;};
  const base=model.baseMVA||100,actuatorBuses=[...new Set(groups.flatMap(group=>group.actuators.map(actuator=>actuator.bus)))];
  const cache=new Map<number,{vector:Float64Array|null;method:string|null;iterations:number;residual:number|null;minPivot:number|null;reason:SensitivityFailure|null}>(),rhsDiagnostics:SensitivityRhsDiagnostic[]=[];let cachedRhsHits=0;
  const directSolutions=new Map<number,{vector:Float64Array|null;residual:number|null;solveMs:number;reason:SensitivityFailure|null}>();
  let cscConversionMs=0,symbolicFactorMs=0,numericFactorMs=0,directSolveMs=0,factorizations=0;
  if(direct){
    const unique=[...new Set(groups.filter(group=>layout.vIndex[group.remoteBus]>=0).map(group=>group.remoteBus))];
    if(unique.length){
      const rhsList=unique.map(remote=>{const rhs=new Float64Array(layout.N);rhs[inverse[layout.vIndex[remote]]]=1;return permutation?permuteVector(rhs,permutation):rhs;});
      const factor=new KluSparseDirectFactorization();
      try{
        factor.factorize(solverMatrix);const solutions=factor.solveMany(rhsList);
        solutions.forEach((solution,index)=>{const vector=solution.x&&permutation?unpermuteVector(solution.x,permutation):solution.x;
          directSolutions.set(unique[index],{vector,residual:solution.trueResidual,solveMs:solution.solveMs,reason:solution.success?null:solution.trueResidual==null?'SENSITIVITY_LINEAR_SOLVE_FAILED':'SENSITIVITY_RESIDUAL_TOO_HIGH'});
        });
        ({cscConversionMs,symbolicFactorMs,numericFactorMs,solveMs:directSolveMs,factorizations}=factor.diagnostics);
      }finally{factor.dispose();}
    }
  }
  const solveRemote=(remoteBus:number,remoteIndex:number)=>{if(cache.has(remoteBus)){cachedRhsHits++;return cache.get(remoteBus)!;}
    if(direct){const solved=directSolutions.get(remoteBus);if(!solved)throw Error('SPARSE_DIRECT_REMOTE_MISSING');
      const value={vector:solved.vector,method:'KLU-DIRECT',iterations:0,residual:solved.residual,minPivot:null,reason:solved.reason};cache.set(remoteBus,value);
      rhsDiagnostics.push({remoteBus,dimension:solverMatrix.N,nnz:solverMatrix.colIdx.length,ordering,method:'KLU-DIRECT',iterations:0,trueResidual:solved.residual,solveMs:solved.solveMs,minPivotBeforeRegularization:null,minPivotAfterRegularization:null,regularizedPivotCount:0,pivotSource:'DIRECT',fallbackCount:0,reason:solved.reason,attempts:[]});return value;
    }
    const rhs=new Float64Array(layout.N);rhs[remoteIndex]=1;const orderedRhs=permutation?permuteVector(rhs,permutation):rhs,solved=solveSensitivityRhs(solverMatrix,orderedRhs,factor1!,getFactor2),vector=solved.solution&&permutation?unpermuteVector(solved.solution,permutation):solved.solution;
    const value={vector,method:solved.method,iterations:solved.iterations,residual:solved.residual,minPivot:solved.minPivot,reason:solved.reason};cache.set(remoteBus,value);
    rhsDiagnostics.push({remoteBus,dimension:solverMatrix.N,nnz:solverMatrix.colIdx.length,ordering,method:solved.method,iterations:solved.iterations,trueResidual:solved.residual,solveMs:solved.solveMs,minPivotBeforeRegularization:solved.minPivotBeforeRegularization,minPivotAfterRegularization:solved.minPivotAfterRegularization,regularizedPivotCount:solved.regularizedPivotCount,pivotSource:ordering==='RCM'?'RCM_ILU':solved.regularizedPivotCount?'ILU_REGULARIZED':'ILU_CLEAN',fallbackCount:solved.fallbackCount,reason:solved.reason,attempts:solved.attempts});return value;
  };
  const busSensitivityByRemote:Array<Map<number,number>|null>=[],probes: SensitivityProbe[]=groups.map(group=>{const t=clock(),output=layout.vIndex[group.remoteBus],inputs=group.actuators.map(a=>layout.vIndex[a.bus]);
    const make=(reason:SensitivityFailure|null,individualSlopes:(number|null)[],slope:number|null,method:string|null=null,iterations:number|null=null,residual:number|null=null,minPivot:number|null=null):SensitivityProbe=>({slope,individualSlopes,reason,jacobianDimension:layout.N,linearMethod:method,linearIterations:iterations,linearResidual:residual,iluMinPivot:minPivot,elapsedMs:clock()-t});
    if(output<0){busSensitivityByRemote.push(null);return make('SENSITIVITY_INDEX_UNAVAILABLE',inputs.map(()=>null),null);}
    const saved=solveRemote(group.remoteBus,inverse[output]);if(!saved.vector){busSensitivityByRemote.push(null);return make(saved.reason,inputs.map(()=>null),null,saved.method,saved.iterations,saved.residual,saved.minPivot);}
    const busSlopes=new Map<number,number>();for(const bus of actuatorBuses){const input=layout.vIndex[bus];if(input>=0)busSlopes.set(bus,saved.vector[inverse[input]]/base);}busSensitivityByRemote.push(busSlopes);
    const individual=inputs.map(input=>input<0?null:saved.vector![inverse[input]]/base),slope=individual.every((value):value is number=>value!=null)?individual.reduce((sum,value,i)=>sum+value*group.actuators[i].weight,0):null;
    return make(slope==null?'SENSITIVITY_INDEX_UNAVAILABLE':!Number.isFinite(slope)?'SENSITIVITY_NONFINITE':Math.abs(slope)<1e-9?'SENSITIVITY_TOO_SMALL':null,individual,slope,saved.method,saved.iterations,saved.residual,saved.minPivot);
  });
  const sensitivityMatrix=busSensitivityByRemote.map(row=>groups.map(group=>row==null?null:group.actuators.reduce((sum,actuator)=>sum+(row.get(actuator.bus)??0)*actuator.weight,0)));
  const quantile=(values:number[],p:number)=>{if(!values.length)return null;const sorted=values.sort((a,b)=>a-b),at=(sorted.length-1)*p,lo=Math.floor(at),hi=Math.ceil(at);return sorted[lo]+(sorted[hi]-sorted[lo])*(at-lo);};
  const methods:Record<string,number>={KLU_DIRECT_SUCCESS:0,ILU1_GMRES_SUCCESS:0,ILU2_GMRES_SUCCESS:0,ILU2_BICGSTAB_SUCCESS:0},failures:Record<string,number>={SENSITIVITY_RESIDUAL_TOO_HIGH:0,SENSITIVITY_LINEAR_SOLVE_FAILED:0};
  for(const row of rhsDiagnostics){
    if(!row.reason&&row.method){const key=row.method==='KLU-DIRECT'?'KLU_DIRECT_SUCCESS':row.method==='ILU2-BiCGSTAB'?'ILU2_BICGSTAB_SUCCESS':row.method.replaceAll('-','_')+'_SUCCESS';methods[key]=(methods[key]??0)+1;}
    else if(row.reason)failures[row.reason]=(failures[row.reason]??0)+1;
  }
  const residuals=rhsDiagnostics.map(row=>row.trueResidual).filter((value):value is number=>value!=null&&Number.isFinite(value)),iluFactorMs=ilu1FactorMs+ilu2FactorMs,iterativeSolveMs=rhsDiagnostics.reduce((sum,row)=>sum+row.solveMs,0);
  const solverDiagnostics:SensitivitySolverDiagnostic={backend:direct?'KLU_WASM':'LEGACY_KRYLOV',ordering,dimension:solverMatrix.N,nnz:solverMatrix.colIdx.length,rhsCount:groups.length,uniqueRemoteRhsCount:rhsDiagnostics.length,cachedRhsHits,methodCounts:methods,failureCounts:failures,medianIterations:quantile(rhsDiagnostics.map(row=>row.iterations),.5),p95Iterations:quantile(rhsDiagnostics.map(row=>row.iterations),.95),medianTrueResidual:quantile(residuals,.5),p95TrueResidual:quantile(residuals,.95),orderingMs,ilu1FactorMs,ilu2FactorMs,iterativeSolveMs:direct?0:iterativeSolveMs,cscConversionMs,symbolicFactorMs,numericFactorMs,directSolveMs,factorizations,rhs:rhsDiagnostics};
  return{probes,busSensitivityByRemote,sensitivityMatrix,jacobianBuildMs,orderingMs,ilu1FactorMs,ilu2FactorMs,iluFactorMs,iterativeSolveMs:direct?0:iterativeSolveMs,cscConversionMs,symbolicFactorMs,numericFactorMs,directSolveMs,sensitivitySolveMs:clock()-start-jacobianBuildMs-orderingMs-iluFactorMs-symbolicFactorMs-numericFactorMs-cscConversionMs,admittance:Y,layout,solverDiagnostics};
}
