import {KluSparseDirectFactorization} from '../power-flow/js/sparse-direct';
import type {SparseMatrix} from '../power-flow/js/types';
export interface Complex {re:number;im:number}
export interface SequenceBranch {a:number;b:number;rPu:number;xPu:number;tap:number;phaseRad:number}
export interface SequenceSource {bus:number;rPu:number;xPu:number}
/** Independent complex series Y1. Two-real-block sparse KLU, no dense inverse. */
export function factorPositiveSequence(n:number,branches:SequenceBranch[],sources:SequenceSource[]){
  const rows=Array.from({length:2*n},()=>new Map<number,number>());
  const add=(a:number,b:number,v:number)=>{rows[a].set(b,(rows[a].get(b)??0)+v);};
  const stamp=(a:number,b:number,re:number,im:number)=>{add(a,b,re);add(a,b+n,-im);add(a+n,b,im);add(a+n,b+n,re);};
  const y=(r:number,x:number)=>{if(!Number.isFinite(r)||!Number.isFinite(x)||r<0||Math.hypot(r,x)<=0)throw Error('SC_INVALID_IMPEDANCE');const d=r*r+x*x;return {re:r/d,im:-x/d};};
  for(const b of branches){if(!(b.tap>0&&Number.isFinite(b.tap))||!Number.isFinite(b.phaseRad))throw Error('SC_INVALID_TAP');const v=y(b.rPu,b.xPu),c=Math.cos(b.phaseRad)/b.tap,s=Math.sin(b.phaseRad)/b.tap;
    stamp(b.a,b.a,v.re/(b.tap*b.tap),v.im/(b.tap*b.tap));stamp(b.b,b.b,v.re,v.im);
    stamp(b.a,b.b,-(v.re*c-v.im*s),-(v.re*s+v.im*c));stamp(b.b,b.a,-(v.re*c+v.im*s),-(-v.re*s+v.im*c));
  }
  for(const source of sources){const v=y(source.rPu,source.xPu);stamp(source.bus,source.bus,v.re,v.im);}
  const rowPtr=new Int32Array(2*n+1),cols:number[]=[],values:number[]=[],pos=rows.map(()=>new Map<number,number>()),diagPos=new Int32Array(2*n);
  rows.forEach((row,r)=>{for(const [c,v]of [...row].sort(([a],[b])=>a-b)){if(v===0&&r!==c)continue;pos[r].set(c,values.length);if(r===c)diagPos[r]=values.length;cols.push(c);values.push(v);}rowPtr[r+1]=values.length;});
  const matrix:SparseMatrix={N:2*n,rowPtr,colIdx:Int32Array.from(cols),values:Float64Array.from(values),pos,diagPos};
  const factor=new KluSparseDirectFactorization();factor.factorize(matrix);
  return {dimension:2*n,nnz:cols.length,diagnostics:factor.diagnostics,solveInjection(injections:{bus:number;re:number;im:number}[]){const rhs=new Float64Array(2*n);for(const i of injections){rhs[i.bus]+=i.re;rhs[i.bus+n]+=i.im;}const solve=factor.solve(rhs);if(!solve.success||!solve.x)throw Error('SC_NUMERICAL_RESIDUAL');return {voltageRe:solve.x.slice(0,n),voltageIm:solve.x.slice(n),residual:solve.trueResidual!};},drivingPoint(bus:number){const rhs=new Float64Array(2*n);rhs[bus]=1;const solve=factor.solve(rhs);if(!solve.success||!solve.x)throw Error('SC_NUMERICAL_RESIDUAL');return {zPu:{re:solve.x[bus],im:solve.x[bus+n]},residual:solve.trueResidual!};},dispose:()=>factor.dispose()};
}
