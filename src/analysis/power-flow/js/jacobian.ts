import { finite } from './math';
import type { AdmittanceMatrix, JacobianLayout } from './types';

export function calcPQ(Y: AdmittanceMatrix, Vm: Float64Array, Va: Float64Array, P: Float64Array, Q: Float64Array): void {
 const {n,rowPtr,colIdx,g,b}=Y;
 for(let i=0;i<n;i++){
  let p=0,q=0;
  for(let k=rowPtr[i];k<rowPtr[i+1];k++){
   const j=colIdx[k],d=Va[i]-Va[j],c=Math.cos(d),s=Math.sin(d),v=Vm[i]*Vm[j],G=g[k],B=b[k];
   p+=v*(G*c+B*s);q+=v*(G*s-B*c);
  }
  P[i]=p;Q[i]=q;
 }
}

export function makeLayout(Y: AdmittanceMatrix, busType: ArrayLike<number>, slack: number): JacobianLayout {
 const n=Y.n,angIndex=new Int32Array(n).fill(-1),vIndex=new Int32Array(n).fill(-1),ang=[],pq=[];
 for(let i=0;i<n;i++)if(i!==slack){angIndex[i]=ang.length;ang.push(i);}
 const nang=ang.length;
 for(let i=0;i<n;i++)if(i!==slack&&busType[i]===0){vIndex[i]=nang+pq.length;pq.push(i);}
 const N=nang+pq.length;
 const rowSets=Array.from({length:N},():Set<number>=>new Set());
 for(let ri=0;ri<ang.length;ri++){
  const i=ang[ri];rowSets[ri].add(ri);
  for(let k=Y.rowPtr[i];k<Y.rowPtr[i+1];k++){
   const j=Y.colIdx[k],aj=angIndex[j],vj=vIndex[j];if(aj>=0)rowSets[ri].add(aj);if(vj>=0)rowSets[ri].add(vj);
  }
 }
 for(let qi=0;qi<pq.length;qi++){
  const i=pq[qi],row=nang+qi;rowSets[row].add(row);
  for(let k=Y.rowPtr[i];k<Y.rowPtr[i+1];k++){
   const j=Y.colIdx[k],aj=angIndex[j],vj=vIndex[j];if(aj>=0)rowSets[row].add(aj);if(vj>=0)rowSets[row].add(vj);
  }
 }
 const rowPtr=new Int32Array(N+1),col:number[]=[],pos=Array.from({length:N},():Map<number,number>=>new Map());
 for(let i=0;i<N;i++){
  rowPtr[i]=col.length;const ar=[...rowSets[i]].sort((a,b)=>a-b);
  for(const j of ar){pos[i].set(j,col.length);col.push(j);}
 }
 rowPtr[N]=col.length;
 const diagPos=new Int32Array(N).fill(-1);for(let i=0;i<N;i++)diagPos[i]=pos[i].get(i)??-1;
 return {angIndex,vIndex,ang:Int32Array.from(ang),pq:Int32Array.from(pq),nang,N,rowPtr,colIdx:Int32Array.from(col),pos,diagPos};
}

export function fillJacobian(Y: AdmittanceMatrix, L: JacobianLayout, Vm: Float64Array, Va: Float64Array, P: Float64Array, Q: Float64Array, values: Float64Array): void {
 values.fill(0);const {g,b,rowPtr,colIdx}=Y;
 const put=(r:number,c:number,v:number)=>{if(r<0||c<0||!finite(v))return;const p=L.pos[r].get(c);if(p!==undefined)values[p]+=v;};
 for(let i=0;i<Y.n;i++){
  const ai=L.angIndex[i],vi=L.vIndex[i],v=Vm[i],v2=v*v;
  let Gii=0,Bii=0;
  for(let k=rowPtr[i];k<rowPtr[i+1];k++)if(colIdx[k]===i){Gii=g[k];Bii=b[k];break;}
  if(ai>=0){put(ai,ai,-Q[i]-Bii*v2);if(vi>=0)put(ai,vi,P[i]/Math.max(v,1e-9)+Gii*v);}
  if(vi>=0){put(vi,ai,P[i]-Gii*v2);put(vi,vi,Q[i]/Math.max(v,1e-9)-Bii*v);}
  for(let k=rowPtr[i];k<rowPtr[i+1];k++){
   const j=colIdx[k];if(j===i)continue;const aj=L.angIndex[j],vj=L.vIndex[j],G=g[k],B=b[k],d=Va[i]-Va[j],c=Math.cos(d),s=Math.sin(d),vv=v*Vm[j];
   if(ai>=0){if(aj>=0)put(ai,aj,vv*(G*s-B*c));if(vj>=0)put(ai,vj,v*(G*c+B*s));}
   if(vi>=0){if(aj>=0)put(vi,aj,-vv*(G*c+B*s));if(vj>=0)put(vi,vj,v*(G*s-B*c));}
  }
 }
}
