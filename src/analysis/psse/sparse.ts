import type {SparseMatrix} from '../power-flow/js/types';
import {KluSparseDirectFactorization} from '../power-flow/js/sparse-direct';
/** PSS/E-specific boundary around the shared, source-independent sparse KLU backend. */
export function csrFromRows(rows:readonly ReadonlyMap<number,number>[]):SparseMatrix{
 const n=rows.length,rowPtr=new Int32Array(n+1),cols:number[]=[],values:number[]=[],pos:Map<number,number>[]=[],diagPos=new Int32Array(n).fill(-1);
 for(let i=0;i<n;i++){const entries=new Map(rows[i]);if(!entries.has(i))entries.set(i,0);for(const [j,v]of [...entries].sort((a,b)=>a[0]-b[0])){if(j<0||j>=n||!Number.isFinite(v))throw Error('PSSE_SPARSE_INVALID_ENTRY');const p=cols.length;cols.push(j);values.push(v);if(j===i)diagPos[i]=p;}rowPtr[i+1]=cols.length;pos.push(new Map([...entries.keys()].sort((a,b)=>a-b).map((j,k)=>[j,rowPtr[i]+k])));}
 return {N:n,rowPtr,colIdx:Int32Array.from(cols),values:Float64Array.from(values),pos,diagPos};
}
export function solvePssERealSparse(matrix:SparseMatrix,rhs:Float64Array){
 const direct=new KluSparseDirectFactorization();try{direct.factorize(matrix);const solved=direct.solve(rhs);return {x:solved.x,relativeResidual:solved.trueResidual,diagnostics:{...direct.diagnostics}};}finally{direct.dispose();}
}
export class PsseFactorizedRealSparse {
 private readonly factor=new KluSparseDirectFactorization();
 constructor(readonly matrix:SparseMatrix){this.factor.factorize(matrix);}
 solve(rhs:Float64Array){const result=this.factor.solve(rhs);return {x:result.x,relativeResidual:result.trueResidual,success:result.success,diagnostics:{...this.factor.diagnostics}};}
 dispose(){this.factor.dispose();}
}
