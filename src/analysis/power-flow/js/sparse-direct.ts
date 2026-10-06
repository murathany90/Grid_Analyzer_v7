import type {SparseMatrix} from './types';
import {csrMatVec} from './linear-solver';
import klu from './vendor/klu-js.mjs';
import {KLU_WASM_BASE64} from './vendor/klu-wasm-data';

interface KluCommon {ordering:number;free():void}
interface KluBindings {
  initSync(input:{module:Uint8Array}):unknown;
  klu_defaults():KluCommon;
  klu_analyze(n:number,ap:Int32Array,ai:Int32Array,common:KluCommon):object;
  klu_factor(ap:Int32Array,ai:Int32Array,ax:Float64Array,symbolic:object,common:KluCommon):object;
  klu_solve(symbolic:object,numeric:object,ldim:number,nrhs:number,b:Float64Array,common:KluCommon):number;
  klu_free_numeric(numeric:object,common:KluCommon):number;
  klu_free_symbolic(symbolic:object,common:KluCommon):number;
}
const binding=klu as unknown as KluBindings;

export interface SparseDirectDiagnostics {
  backend:'KLU_WASM'; dimension:number;nnz:number;ordering:'KLU_AMD';
  cscConversionMs:number;symbolicFactorMs:number;numericFactorMs:number;factorMs:number;
  solveMs:number;rhsCount:number;factorizations:number;
  /**
   * Where the direct backend stopped. The solver falls back to an iterative method when
   * this is not `NONE`, so the reason must survive rather than being swallowed.
   */
  failureStage:'NONE'|'FACTORIZE_THREW'|'SOLVE_THREW'|'SOLVE_STATUS_NONZERO';
  failureMessage:string|null;
}
export interface SparseDirectSolution {x:Float64Array|null;trueResidual:number|null;solveMs:number;success:boolean}
export interface SparseDirectFactorization {
  factorize(matrix:SparseMatrix):void;
  solve(rhs:Float64Array):SparseDirectSolution;
  solveMany(rhsList:readonly Float64Array[]):SparseDirectSolution[];
  dispose():void;
  readonly diagnostics:SparseDirectDiagnostics;
}

let initialized=false;
/** The pinned wasm-bindgen package ships classic-script glue; our vendored ESM copy only adds an export. */
export function initializeSparseDirect():void {
  if(initialized)return;
  const binary=Uint8Array.from(atob(KLU_WASM_BASE64),char=>char.charCodeAt(0));
  binding.initSync({module:binary});initialized=true;
}

function toCsc(matrix:SparseMatrix):{ap:Int32Array;ai:Int32Array;ax:Float64Array} {
  const n=matrix.N,nnz=matrix.colIdx.length,ap=new Int32Array(n+1),ai=new Int32Array(nnz),ax=new Float64Array(nnz);
  if(matrix.rowPtr.length!==n+1||matrix.values.length!==nnz)throw Error('SPARSE_DIRECT_INVALID_CSR');
  for(let k=0;k<nnz;k++){const col=matrix.colIdx[k];if(col<0||col>=n)throw Error('SPARSE_DIRECT_INVALID_COLUMN');ap[col+1]++;}
  for(let col=0;col<n;col++)ap[col+1]+=ap[col];
  const cursor=Int32Array.from(ap);
  for(let row=0;row<n;row++)for(let k=matrix.rowPtr[row];k<matrix.rowPtr[row+1];k++){const at=cursor[matrix.colIdx[k]]++;ai[at]=row;ax[at]=matrix.values[k];}
  return{ap,ai,ax};
}
function relativeResidual(matrix:SparseMatrix,rhs:Float64Array,x:Float64Array):number {
  const ax=new Float64Array(matrix.N);csrMatVec(matrix,x,ax);let difference=0,bnorm=0;
  for(let i=0;i<matrix.N;i++){const delta=rhs[i]-ax[i];difference+=delta*delta;bnorm+=rhs[i]*rhs[i];}
  return Math.sqrt(difference)/Math.max(1e-14,Math.sqrt(bnorm));
}

export class KluSparseDirectFactorization implements SparseDirectFactorization {
  readonly diagnostics:SparseDirectDiagnostics={backend:'KLU_WASM',dimension:0,nnz:0,ordering:'KLU_AMD',cscConversionMs:0,symbolicFactorMs:0,numericFactorMs:0,factorMs:0,solveMs:0,rhsCount:0,factorizations:0,failureStage:'NONE',failureMessage:null};
  private matrix:SparseMatrix|null=null;
  private common:KluCommon|null=null;
  private symbolic:object|null=null;
  private numeric:object|null=null;
  factorize(matrix:SparseMatrix):void {
    if(this.matrix)throw Error('SPARSE_DIRECT_ALREADY_FACTORIZED');
    initializeSparseDirect();const started=performance.now(),csc=toCsc(matrix),afterCsc=performance.now();
    this.diagnostics.dimension=matrix.N;this.diagnostics.nnz=matrix.colIdx.length;this.diagnostics.cscConversionMs=afterCsc-started;
    try{
      this.common=binding.klu_defaults();this.common.ordering=0;
      this.symbolic=binding.klu_analyze(matrix.N,csc.ap,csc.ai,this.common);
      const afterSymbolic=performance.now();this.diagnostics.symbolicFactorMs=afterSymbolic-afterCsc;
      this.numeric=binding.klu_factor(csc.ap,csc.ai,csc.ax,this.symbolic,this.common);
      this.diagnostics.numericFactorMs=performance.now()-afterSymbolic;
      this.diagnostics.factorMs=this.diagnostics.symbolicFactorMs+this.diagnostics.numericFactorMs;
      this.diagnostics.factorizations=1;this.matrix=matrix;
    }catch(error){
      // The caller falls back to an iterative solve, so the stage is recorded rather than
      // discarded: a silently swallowed failure would be indistinguishable from success.
      this.diagnostics.failureStage='FACTORIZE_THREW';
      this.diagnostics.failureMessage=error instanceof Error?error.message:String(error);
      this.dispose();throw error;}
  }
  solve(rhs:Float64Array):SparseDirectSolution {return this.solveMany([rhs])[0];}
  solveMany(rhsList:readonly Float64Array[]):SparseDirectSolution[] {
    const matrix=this.matrix;if(!matrix||!this.common||!this.symbolic||!this.numeric)throw Error('SPARSE_DIRECT_NOT_FACTORIZED');
    if(!rhsList.length)return[];
    const n=matrix.N,packed=new Float64Array(n*rhsList.length);
    rhsList.forEach((rhs,index)=>{if(rhs.length!==n)throw Error('SPARSE_DIRECT_RHS_SIZE');packed.set(rhs,index*n);});
    const started=performance.now();let status=0;
    try{status=binding.klu_solve(this.symbolic,this.numeric,n,rhsList.length,packed,this.common);}
    catch(error){status=0;this.diagnostics.failureStage='SOLVE_THREW';this.diagnostics.failureMessage=error instanceof Error?error.message:String(error);}
    if(status!==1&&this.diagnostics.failureStage==='NONE'){this.diagnostics.failureStage='SOLVE_STATUS_NONZERO';this.diagnostics.failureMessage=`klu_solve returned status ${status}`;}
    const solveMs=performance.now()-started;this.diagnostics.solveMs+=solveMs;this.diagnostics.rhsCount+=rhsList.length;
    return rhsList.map((rhs,index)=>{
      const x=status===1?Float64Array.from(packed.subarray(index*n,(index+1)*n)):null;
      const trueResidual=x?relativeResidual(matrix,rhs,x):null;
      const success=x!=null&&trueResidual!=null&&Number.isFinite(trueResidual)&&trueResidual<=1e-6;
      return{x:success?x:null,trueResidual,solveMs:solveMs/rhsList.length,success};
    });
  }
  dispose():void {
    if(this.numeric&&this.common)binding.klu_free_numeric(this.numeric,this.common);
    if(this.symbolic&&this.common)binding.klu_free_symbolic(this.symbolic,this.common);
    this.common?.free();this.numeric=null;this.symbolic=null;this.common=null;this.matrix=null;
  }
}
