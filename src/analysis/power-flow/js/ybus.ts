import type { AdmittanceMatrix, NumericalModel } from './types';
import { finite } from './math';
import { MIN_BRANCH_IMPEDANCE_PU } from '../preparation';

export function buildY(model: NumericalModel): AdmittanceMatrix {
  const n=model.n, rows=Array.from({length:n},():Map<number,[number,number]>=>new Map());
  const put=(i:number,j:number,g:number,b:number)=>{let z=rows[i].get(j);if(z){z[0]+=g;z[1]+=b;}else rows[i].set(j,[g,b]);};
  for(const e of model.branches){
   const r=+e.r,x=+e.x,bch=+e.bch||0,tap=+e.tap||1,ph=+e.phase||0;
   // One shared near-zero-impedance policy. The previous `den > 1e-18` test was tighter
   // than the preparation threshold, so a branch that preparation accepted could still be
   // rejected here as INVALID_BRANCH. The bound is a singularity guard: below it the branch
   // models an unbounded current.
   const den=r*r+x*x;if(!(Math.hypot(r,x)>=MIN_BRANCH_IMPEDANCE_PU&&finite(den)&&tap>0&&finite(tap)))throw Error('INVALID_BRANCH');
  const g=r/den, b=-x/den, c=Math.cos(ph),s=Math.sin(ph),t2=tap*tap;
  // y/t* with complex phase: Yft = -y/conj(t), Ytf=-y/t
  // (g+jb)*(c+js)/tap for -y/conj(t)
  const yftG=-(g*c-b*s)/tap, yftB=-(g*s+b*c)/tap;
  const ytfG=-(g*c+b*s)/tap, ytfB=-(-g*s+b*c)/tap;
  put(e.i,e.i,g/t2,(b+bch/2)/t2);
  put(e.i,e.j,yftG,yftB);
  put(e.j,e.i,ytfG,ytfB);
  put(e.j,e.j,g,b+bch/2);
 }
 for(let i=0;i<n;i++){
  const g=model.shuntG?.[i]||0,b=model.shuntB?.[i]||0;if(g||b)put(i,i,g,b);
  if(!rows[i].has(i))rows[i].set(i,[0,0]);
 }
 const rowPtr=new Int32Array(n+1), cols=[],gre=[],bim=[];
 for(let i=0;i<n;i++){
  rowPtr[i]=cols.length;
  const ent=[...rows[i].entries()].sort((a,b)=>a[0]-b[0]);
  for(const [j,z] of ent){cols.push(j);gre.push(z[0]);bim.push(z[1]);}
 }
 rowPtr[n]=cols.length;
 return {n,rowPtr,colIdx:Int32Array.from(cols),g:Float64Array.from(gre),b:Float64Array.from(bim)};
}
