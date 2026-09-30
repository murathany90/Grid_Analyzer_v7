import { abs, finite } from './math';
import type { ILU0Factor, IterativeSolveDiagnostics, LinearSolution, LinearSolveDiagnostics, SparseMatrix } from './types';

const dot=(a:ArrayLike<number>,b:ArrayLike<number>):number=>{let z=0;for(let i=0;i<a.length;i++)z+=a[i]*b[i];return z;};
const norm=(a:ArrayLike<number>):number=>Math.sqrt(Math.max(0,dot(a,a)));

export function csrMatVec(A: SparseMatrix, x: Float64Array, out: Float64Array): void {for(let i=0;i<A.N;i++){let z=0;for(let k=A.rowPtr[i];k<A.rowPtr[i+1];k++)z+=A.values[k]*x[A.colIdx[k]];out[i]=z;}}

export function ilu0(A: SparseMatrix): ILU0Factor {
 const n=A.N,lu=Float64Array.from(A.values),diag=Int32Array.from(A.diagPos),pos=A.pos;let minPivot=Infinity,minAfter=Infinity,invalidRaw=false,regularizedPivotCount=0;
 for(let i=0;i<n;i++){
  const rs=A.rowPtr[i],re=A.rowPtr[i+1];
  for(let pk=rs;pk<re;pk++){
   const j=A.colIdx[pk];if(j>=i)break;
   let d=lu[diag[j]];if(!finite(d)||abs(d)<1e-10)d=(d<0?-1:1)*1e-10;
   const lij=lu[pk]/d;lu[pk]=lij;
   for(let q=diag[j]+1;q<A.rowPtr[j+1];q++){
    const c=A.colIdx[q],loc=pos[i].get(c);if(loc!==undefined)lu[loc]-=lij*lu[q];
   }
  }
  const dp=diag[i];if(dp<0)throw Error('ILU_DIAGONAL_MISSING');
   if(finite(lu[dp]))minPivot=Math.min(minPivot,abs(lu[dp]));else invalidRaw=true;
   if(!finite(lu[dp])||abs(lu[dp])<1e-10){lu[dp]=(lu[dp]<0?-1:1)*1e-10;regularizedPivotCount++;}
   minAfter=Math.min(minAfter,abs(lu[dp]));
  }
  const before=invalidRaw?null:Number.isFinite(minPivot)?minPivot:null;
  return {lu,diag,minPivot:before,minPivotBeforeRegularization:before,minPivotAfterRegularization:Number.isFinite(minAfter)?minAfter:null,regularizedPivotCount,rowPtr:A.rowPtr,colIdx:A.colIdx};
}

/** One symbolic fill level, used for station-control sensitivities only. */
export function iluFill(A:SparseMatrix,fillLevel:1|2):ILU0Factor {
 const n=A.N,levels:Array<Map<number,number>>=Array.from({length:n},()=>new Map()),rowPtr=new Int32Array(n+1),cols:number[]=[],values:number[]=[],pos:Array<Map<number,number>>=[],diagPos=new Int32Array(n).fill(-1);
 for(let i=0;i<n;i++){
  const row=levels[i];for(let k=A.rowPtr[i];k<A.rowPtr[i+1];k++)row.set(A.colIdx[k],0);
  for(let j=0;j<i;j++){const lij=row.get(j);if(lij==null)continue;
   for(const [k,ljk]of levels[j]){if(k<=j||lij+ljk+1>fillLevel)continue;const existing=row.get(k);if(existing==null||existing>lij+ljk+1)row.set(k,lij+ljk+1);}
  }
  const map=new Map<number,number>();for(const col of [...row.keys()].sort((a,b)=>a-b)){const at=cols.length;cols.push(col);values.push(A.pos[i].has(col)?A.values[A.pos[i].get(col)!]:0);map.set(col,at);if(col===i)diagPos[i]=at;}
  pos.push(map);rowPtr[i+1]=cols.length;
 }
 return ilu0({N:n,rowPtr,colIdx:Int32Array.from(cols),values:Float64Array.from(values),pos,diagPos});
}

export function iluSolve(A: SparseMatrix, M: ILU0Factor, b: Float64Array, out: Float64Array): Float64Array {
 const n=A.N,lu=M.lu,diag=M.diag,rowPtr=M.rowPtr??A.rowPtr,colIdx=M.colIdx??A.colIdx;
 for(let i=0;i<n;i++){let z=b[i];for(let k=rowPtr[i];k<diag[i];k++)z-=lu[k]*out[colIdx[k]];out[i]=z;}
 for(let i=n-1;i>=0;i--){let z=out[i];for(let k=diag[i]+1;k<rowPtr[i+1];k++)z-=lu[k]*out[colIdx[k]];out[i]=z/lu[diag[i]];}
 return out;
}

export function gmres(A: SparseMatrix, b: Float64Array, M: ILU0Factor, relTol=1e-8, restart=36, maxOuter=5,diagnostics?:IterativeSolveDiagnostics): LinearSolution | null {
 const n=A.N,x=new Float64Array(n),Ax=new Float64Array(n),r=new Float64Array(n),z=new Float64Array(n),tmp=new Float64Array(n),w=new Float64Array(n);
 const bnorm=Math.max(1e-14,norm(b));let total=0;
 for(let outer=0;outer<maxOuter;outer++){
  csrMatVec(A,x,Ax);for(let i=0;i<n;i++)r[i]=b[i]-Ax[i];iluSolve(A,M,r,z);const beta=norm(z),trueResidual=norm(r)/bnorm;
   if(diagnostics){diagnostics.iterations=total;diagnostics.trueResidual=trueResidual;}
   if(trueResidual<=relTol)return {x,iterations:total,residual:trueResidual};
  if(beta<=1e-20)return null;
  const V=[Float64Array.from(z,v=>v/beta)],H=Array.from({length:restart+1},()=>new Float64Array(restart)),cs=new Float64Array(restart),sn=new Float64Array(restart),g=new Float64Array(restart+1);g[0]=beta;let used=0;
  for(let j=0;j<restart;j++){
   csrMatVec(A,V[j],tmp);iluSolve(A,M,tmp,w);
   for(let k=0;k<=j;k++){const h=dot(w,V[k]);H[k][j]=h;for(let i=0;i<n;i++)w[i]-=h*V[k][i];}
   H[j+1][j]=norm(w);V.push(H[j+1][j]>1e-14?Float64Array.from(w,v=>v/H[j+1][j]):new Float64Array(n));
   for(let k=0;k<j;k++){const q=cs[k]*H[k][j]+sn[k]*H[k+1][j];H[k+1][j]=-sn[k]*H[k][j]+cs[k]*H[k+1][j];H[k][j]=q;}
   const den=Math.hypot(H[j][j],H[j+1][j]);if(den<1e-20)break;cs[j]=H[j][j]/den;sn[j]=H[j+1][j]/den;H[j][j]=den;H[j+1][j]=0;g[j+1]=-sn[j]*g[j];g[j]=cs[j]*g[j];used=j+1;total++;
   if(abs(g[j+1])<=relTol*bnorm)break;
  }
  if(!used)return null;const y=new Float64Array(used);
  for(let i=used-1;i>=0;i--){let z0=g[i];for(let j=i+1;j<used;j++)z0-=H[i][j]*y[j];if(abs(H[i][i])<1e-20)return null;y[i]=z0/H[i][i];}
  for(let j=0;j<used;j++){const yy=y[j];for(let i=0;i<n;i++)x[i]+=yy*V[j][i];}
 }
  csrMatVec(A,x,Ax);for(let i=0;i<n;i++)r[i]=b[i]-Ax[i];const rr=norm(r)/bnorm;if(diagnostics){diagnostics.iterations=total;diagnostics.trueResidual=rr;}return rr<1e-5?{x,iterations:total,residual:rr}:null;
}

export function bicgstab(A: SparseMatrix, b: Float64Array, M: ILU0Factor, relTol=1e-8, maxIter=800,diagnostics?:IterativeSolveDiagnostics): LinearSolution | null {
 const n=A.N,x=new Float64Array(n),r=Float64Array.from(b),r0=Float64Array.from(b),p=new Float64Array(n),v=new Float64Array(n),s=new Float64Array(n),t=new Float64Array(n),ph=new Float64Array(n),sh=new Float64Array(n),Ax=new Float64Array(n);
 const bnorm=Math.max(1e-14,norm(b));let rho=1,alpha=1,omega=1;
 for(let k=0;k<maxIter;k++){
   const rn=norm(r)/bnorm;if(diagnostics){diagnostics.iterations=k;diagnostics.trueResidual=rn;}if(rn<relTol)return {x,iterations:k,residual:rn};const rho1=dot(r0,r);if(!finite(rho1)||abs(rho1)<1e-30)return null;const beta=(rho1/rho)*(alpha/omega);rho=rho1;
  for(let i=0;i<n;i++)p[i]=r[i]+beta*(p[i]-omega*v[i]);iluSolve(A,M,p,ph);csrMatVec(A,ph,v);const den=dot(r0,v);if(abs(den)<1e-30)return null;alpha=rho/den;
   for(let i=0;i<n;i++)s[i]=r[i]-alpha*v[i];if(norm(s)/bnorm<relTol){for(let i=0;i<n;i++)x[i]+=alpha*ph[i];if(diagnostics){diagnostics.iterations=k+1;diagnostics.trueResidual=norm(s)/bnorm;}return {x,iterations:k+1,residual:norm(s)/bnorm};}
  iluSolve(A,M,s,sh);csrMatVec(A,sh,t);const tt=dot(t,t);if(tt<1e-30)return null;omega=dot(t,s)/tt;if(!finite(omega)||abs(omega)<1e-30)return null;
  for(let i=0;i<n;i++){x[i]+=alpha*ph[i]+omega*sh[i];r[i]=s[i]-omega*t[i];}
 }
  csrMatVec(A,x,Ax);for(let i=0;i<n;i++)r[i]=b[i]-Ax[i];const rr=norm(r)/bnorm;if(diagnostics){diagnostics.iterations=maxIter;diagnostics.trueResidual=rr;}return rr<1e-5?{x,iterations:maxIter,residual:rr}:null;
}

export function solveLinear(A: SparseMatrix, b: Float64Array, diagnostics?: LinearSolveDiagnostics): LinearSolution | null {
  const M=ilu0(A);if(diagnostics){diagnostics.minPivot=M.minPivot;diagnostics.minPivotBeforeRegularization=M.minPivotBeforeRegularization;diagnostics.minPivotAfterRegularization=M.minPivotAfterRegularization;diagnostics.regularizedPivotCount=M.regularizedPivotCount;diagnostics.pivotSource=M.regularizedPivotCount?'ILU_REGULARIZED':'ILU_CLEAN';diagnostics.stage='ILU0_READY';}
 if(diagnostics)diagnostics.stage='ILU0_GMRES';let r=gmres(A,b,M,1e-8,38,5);if(r)return {...r,method:'ILU0-GMRES'};
 if(diagnostics)diagnostics.stage='ILU0_BICGSTAB';r=bicgstab(A,b,M,1e-8,Math.min(1200,Math.max(200,A.N)));if(r)return {...r,method:'ILU0-BiCGSTAB'};return null;
}
export function solveLinearFill1(A:SparseMatrix,b:Float64Array,diagnostics?:LinearSolveDiagnostics):LinearSolution|null {
  const M=iluFill(A,1);if(diagnostics){diagnostics.minPivot=M.minPivot;diagnostics.minPivotBeforeRegularization=M.minPivotBeforeRegularization;diagnostics.minPivotAfterRegularization=M.minPivotAfterRegularization;diagnostics.regularizedPivotCount=M.regularizedPivotCount;diagnostics.pivotSource=M.regularizedPivotCount?'ILU_REGULARIZED':'ILU_CLEAN';diagnostics.stage='ILU1_READY';}
 let r=gmres(A,b,M,1e-8,38,5);if(r)return{...r,method:'ILU1-GMRES'};
 r=bicgstab(A,b,M,1e-8,Math.min(1200,Math.max(200,A.N)));if(r)return{...r,method:'ILU1-BiCGSTAB'};
 if(diagnostics)diagnostics.stage='ILU1_LINEAR_FAILED';return null;
}
