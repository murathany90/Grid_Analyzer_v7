import { finite } from './math';
import type { AdmittanceMatrix, IntegratedStationControl, JacobianLayout } from './types';

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

export function makeLayout(Y: AdmittanceMatrix, busType: ArrayLike<number>, slack: number, controls:readonly IntegratedStationControl[]=[]): JacobianLayout {
 const n=Y.n,angIndex=new Int32Array(n).fill(-1),vIndex=new Int32Array(n).fill(-1),qIndex=new Int32Array(n).fill(-1),ang=[],pq:number[]=[],vm:number[]=[];
 for(let i=0;i<n;i++)if(i!==slack){angIndex[i]=ang.length;ang.push(i);}
 const nang=ang.length;
 const remote=new Set(controls.map(control=>control.remoteBus));
 if(remote.size!==controls.length||controls.some(control=>control.remoteBus===slack||busType[control.remoteBus]!==0))throw Error('INTEGRATED_REMOTE_LAYOUT_INVALID');
 for(let i=0;i<n;i++)if(busType[i]===0){pq.push(i);if(!remote.has(i)){vIndex[i]=nang+vm.length;vm.push(i);}}
 if(controls.length){
  // Match each Q equation to a structurally nonzero Vm/controller column.
  // The remote Q row often has no direct controller coefficient; preserving
  // the bus order would put a zero on ILU's diagonal even for a valid system.
  const buses=[...pq],ordinal=new Int32Array(n).fill(-1);buses.forEach((bus,index)=>{ordinal[bus]=index;});
  const columns=vm.length+controls.length,rowOwner=new Int32Array(buses.length).fill(-1),columnRow=new Int32Array(columns).fill(-1);
  const candidates:Array<number[]>=[];
  vm.forEach((bus,col)=>{const rows=[ordinal[bus]];for(let k=Y.rowPtr[bus];k<Y.rowPtr[bus+1];k++){const row=ordinal[Y.colIdx[k]];if(row>=0&&row!==ordinal[bus])rows.push(row);}candidates[col]=rows;rowOwner[ordinal[bus]]=col;columnRow[col]=ordinal[bus];});
  controls.forEach((control,index)=>{const rows=[...new Set(control.actuators.filter(item=>item.participation>0).map(item=>ordinal[item.bus]).filter(row=>row>=0))];if(!rows.length)throw Error('INTEGRATED_ACTUATOR_LAYOUT_INVALID');candidates[vm.length+index]=rows;});
  for(let start=vm.length;start<columns;start++){
   const queue=[start],seenColumns=new Uint8Array(columns),seenRows=new Uint8Array(buses.length),parentColumn=new Int32Array(buses.length).fill(-1);seenColumns[start]=1;let freeRow=-1;
   for(let head=0;head<queue.length&&freeRow<0;head++)for(const row of candidates[queue[head]]){if(seenRows[row])continue;seenRows[row]=1;parentColumn[row]=queue[head];const owner=rowOwner[row];if(owner<0){freeRow=row;break;}if(!seenColumns[owner]){seenColumns[owner]=1;queue.push(owner);}}
   if(freeRow<0)throw Error('INTEGRATED_Q_MATCHING_FAILED');
   for(let row=freeRow;row>=0;){const column=parentColumn[row],previous=columnRow[column];rowOwner[row]=column;columnRow[column]=row;row=previous;}
  }
  pq.splice(0,pq.length,...Array.from(columnRow,row=>buses[row]));
 }
 pq.forEach((bus,index)=>{qIndex[bus]=nang+index;});
 const controlIndex=Int32Array.from(controls,(_,index)=>nang+vm.length+index),N=nang+pq.length;
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
 controls.forEach((control,index)=>{for(const actuator of control.actuators){const row=qIndex[actuator.bus];if(row<0)throw Error('INTEGRATED_ACTUATOR_LAYOUT_INVALID');rowSets[row].add(controlIndex[index]);}});
 const rowPtr=new Int32Array(N+1),col:number[]=[],pos=Array.from({length:N},():Map<number,number>=>new Map());
 for(let i=0;i<N;i++){
  rowPtr[i]=col.length;const ar=[...rowSets[i]].sort((a,b)=>a-b);
  for(const j of ar){pos[i].set(j,col.length);col.push(j);}
 }
 rowPtr[N]=col.length;
 const diagPos=new Int32Array(N).fill(-1);for(let i=0;i<N;i++)diagPos[i]=pos[i].get(i)??-1;
 return {angIndex,vIndex,qIndex,controlIndex,ang:Int32Array.from(ang),pq:Int32Array.from(pq),vm:Int32Array.from(vm),nang,N,rowPtr,colIdx:Int32Array.from(col),pos,diagPos};
}

/** Full sparse AC, station equations and distributed P-balance in one system. */
export function makeExplicitLayout(Y:AdmittanceMatrix,busType:ArrayLike<number>,slack:number,controls:readonly IntegratedStationControl[],activeBalance=false,weights?:ArrayLike<number>):JacobianLayout {
 const base=makeLayout(Y,busType,slack),c=controls.length,alpha=activeBalance?1:0,N=base.N+c+alpha;
 const controlIndex=Int32Array.from(controls,(_,i)=>base.N+i),controlRow=Int32Array.from(controls,(_,i)=>base.N+i),alphaIndex=activeBalance?N-1:-1,alphaRow=alphaIndex;
 const rowSets=Array.from({length:N},(_,row)=>new Set<number>(row<base.N?Array.from(base.colIdx.slice(base.rowPtr[row],base.rowPtr[row+1])):[]));
 controls.forEach((control,index)=>{
  const remoteV=base.vIndex[control.remoteBus];if(remoteV<0)throw Error('EXPLICIT_CONTROL_REMOTE_VM_MISSING');
  rowSets[controlRow[index]].add(remoteV);rowSets[controlRow[index]].add(controlIndex[index]);
  for(const actuator of control.actuators){const qRow=base.qIndex[actuator.bus];if(qRow<0)throw Error('EXPLICIT_CONTROL_ACTUATOR_Q_MISSING');rowSets[qRow].add(controlIndex[index]);}
 });
 if(activeBalance){
  if(!weights||weights.length!==Y.n)throw Error('EXPLICIT_ACTIVE_BALANCE_WEIGHTS_INVALID');
  for(let i=0;i<Y.n;i++)if(weights[i]!==0){const row=i===slack?alphaRow:base.angIndex[i];if(row>=0)rowSets[row].add(alphaIndex);}
  rowSets[alphaRow].add(alphaIndex);
  for(let k=Y.rowPtr[slack];k<Y.rowPtr[slack+1];k++){const bus=Y.colIdx[k],a=base.angIndex[bus],v=base.vIndex[bus];if(a>=0)rowSets[alphaRow].add(a);if(v>=0)rowSets[alphaRow].add(v);}
 }
 const rowPtr=new Int32Array(N+1),col:number[]=[],pos=Array.from({length:N},():Map<number,number>=>new Map());
 for(let row=0;row<N;row++){rowPtr[row]=col.length;for(const column of [...rowSets[row]].sort((a,b)=>a-b)){pos[row].set(column,col.length);col.push(column);}}
 rowPtr[N]=col.length;const diagPos=Int32Array.from({length:N},(_,row)=>pos[row].get(row)??-1);
 return {...base,N,controlIndex,controlRow,alphaIndex,alphaRow,slack,explicitControlEquations:true,rowPtr,colIdx:Int32Array.from(col),pos,diagPos};
}

export function fillJacobian(Y: AdmittanceMatrix, L: JacobianLayout, Vm: Float64Array, Va: Float64Array, P: Float64Array, Q: Float64Array, values: Float64Array, controls:readonly IntegratedStationControl[]=[],baseMva=100,activeBalanceWeights?:ArrayLike<number>): void {
 values.fill(0);const {g,b,rowPtr,colIdx}=Y;
 const put=(r:number,c:number,v:number)=>{if(r<0||c<0||!finite(v))return;const p=L.pos[r].get(c);if(p!==undefined)values[p]+=v;};
 for(let i=0;i<Y.n;i++){
  const ai=L.angIndex[i],pi=i===L.slack&&L.alphaRow!=null?L.alphaRow:ai,vi=L.vIndex[i],qi=L.qIndex[i],v=Vm[i],v2=v*v;
  let Gii=0,Bii=0;
  for(let k=rowPtr[i];k<rowPtr[i+1];k++)if(colIdx[k]===i){Gii=g[k];Bii=b[k];break;}
  if(pi>=0){if(ai>=0)put(pi,ai,-Q[i]-Bii*v2);if(vi>=0)put(pi,vi,P[i]/Math.max(v,1e-9)+Gii*v);}
  if(qi>=0){put(qi,ai,P[i]-Gii*v2);if(vi>=0)put(qi,vi,Q[i]/Math.max(v,1e-9)-Bii*v);}
  for(let k=rowPtr[i];k<rowPtr[i+1];k++){
   const j=colIdx[k];if(j===i)continue;const aj=L.angIndex[j],vj=L.vIndex[j],G=g[k],B=b[k],d=Va[i]-Va[j],c=Math.cos(d),s=Math.sin(d),vv=v*Vm[j];
   if(pi>=0){if(aj>=0)put(pi,aj,vv*(G*s-B*c));if(vj>=0)put(pi,vj,v*(G*c+B*s));}
   if(qi>=0){if(aj>=0)put(qi,aj,-vv*(G*c+B*s));if(vj>=0)put(qi,vj,v*(G*s-B*c));}
  }
 }
 controls.forEach((control,index)=>{for(const actuator of control.actuators)put(L.qIndex[actuator.bus],L.controlIndex[index],-actuator.participation);});
 if(L.explicitControlEquations){controls.forEach((control,index)=>{const row=L.controlRow![index];put(row,L.vIndex[control.remoteBus],1);if(control.droopQmvar)put(row,L.controlIndex[index],-(control.measurementParticipation??1)*baseMva/control.droopQmvar);});}
 if(L.alphaIndex!=null&&L.alphaIndex>=0&&activeBalanceWeights)for(let bus=0;bus<Y.n;bus++){const row=bus===L.slack?L.alphaRow!:L.angIndex[bus];if(row>=0&&activeBalanceWeights[bus])put(row,L.alphaIndex,-activeBalanceWeights[bus]/baseMva);}
}
