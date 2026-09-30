import assert from 'node:assert/strict';
import test from 'node:test';
import type {AdmittanceMatrix,IntegratedStationControl,NumericalModel} from '../../src/analysis/power-flow/js/types';
import {buildY} from '../../src/analysis/power-flow/js/ybus';
import {calcPQ,fillJacobian,makeLayout} from '../../src/analysis/power-flow/js/jacobian';
import {solveNR} from '../../src/analysis/power-flow/js/newton';

const model:NumericalModel={n:4,baseMVA:100,slack:0,slackVm:1,
  pSpec:Float64Array.from([0,35,-25,-12]),qSpec:Float64Array.from([0,4,-9,-5]),
  busType:Int8Array.from([2,0,0,0]),vmSet:Float64Array.from([1,1,1,1]),
  shuntG:new Float64Array(4),shuntB:new Float64Array(4),qMinNet:[null,null,null,null],qMaxNet:[null,null,null,null],
  branches:[[0,1],[1,2],[2,3],[0,3],[1,3]].map(([i,j],k)=>({i,j,r:.012+k*.001,x:.1+k*.007,bch:.008,tap:1,phase:0}))};
const control:IntegratedStationControl={remoteBus:3,targetVmPu:1.025,actuators:[{bus:1,participation:1}]};

// Independent dense P/PQV reference: bus 1 is P (free Q and Vm), bus 3 is
// PQV (fixed Vm, retained P and Q), and bus 2 is PQ. No controlDq unknown.
function physicalPQ(Y:AdmittanceMatrix,vm:Float64Array,va:Float64Array){
  const p=new Float64Array(Y.n),q=new Float64Array(Y.n);
  for(let i=0;i<Y.n;i++)for(let k=Y.rowPtr[i];k<Y.rowPtr[i+1];k++){
    const j=Y.colIdx[k],d=va[i]-va[j],c=Math.cos(d),s=Math.sin(d),v=vm[i]*vm[j];
    p[i]+=v*(Y.g[k]*c+Y.b[k]*s);q[i]+=v*(Y.g[k]*s-Y.b[k]*c);
  }
  return{p,q};
}
function referenceState(x:Float64Array){return{va:Float64Array.from([0,x[0],x[1],x[2]]),vm:Float64Array.from([1,x[3],x[4],control.targetVmPu])};}
function referenceResidual(Y:AdmittanceMatrix,x:Float64Array){
  const{vm,va}=referenceState(x),{p,q}=physicalPQ(Y,vm,va),base=model.baseMVA!;
  return Float64Array.from([p[1]-model.pSpec[1]/base,p[2]-model.pSpec[2]/base,p[3]-model.pSpec[3]/base,q[2]-model.qSpec[2]/base,q[3]-model.qSpec[3]/base]);
}
function denseJacobian(f:(x:Float64Array)=>Float64Array,x:Float64Array){
  const h=1e-6,n=x.length,j=Array.from({length:n},()=>new Float64Array(n));
  for(let col=0;col<n;col++){const plus=Float64Array.from(x),minus=Float64Array.from(x);plus[col]+=h;minus[col]-=h;
    const a=f(plus),b=f(minus);for(let row=0;row<n;row++)j[row][col]=(a[row]-b[row])/(2*h);
  }return j;
}
function denseSolve(matrix:readonly Float64Array[],rhs:Float64Array){
  const n=rhs.length,a=matrix.map((row,i)=>Float64Array.from([...row,rhs[i]]));
  for(let col=0;col<n;col++){let pivot=col;for(let row=col+1;row<n;row++)if(Math.abs(a[row][col])>Math.abs(a[pivot][col]))pivot=row;
    assert.ok(Math.abs(a[pivot][col])>1e-12,`singular dense reference column ${col}`);
    [a[col],a[pivot]]=[a[pivot],a[col]];
    for(let row=col+1;row<n;row++){const m=a[row][col]/a[col][col];for(let k=col;k<=n;k++)a[row][k]-=m*a[col][k];}
  }
  const x=new Float64Array(n);for(let row=n-1;row>=0;row--){let value=a[row][n];for(let col=row+1;col<n;col++)value-=a[row][col]*x[col];x[row]=value/a[row][row];}return x;
}
function solveReference(Y:AdmittanceMatrix){
  let x=Float64Array.from([0,0,0,1,1]);
  for(let it=0;it<20;it++){const r=referenceResidual(Y,x),norm=Math.hypot(...r);if(norm<1e-11)return x;
    const dx=denseSolve(denseJacobian(z=>referenceResidual(Y,z),x),Float64Array.from(r,v=>-v));
    let accepted=false;for(let scale=1;scale>=1/1024;scale/=2){const trial=Float64Array.from(x,(v,i)=>v+scale*dx[i]);
      if(trial[3]<=.35||trial[4]<=.35||trial[3]>=1.85||trial[4]>=1.85)continue;
      if(Math.hypot(...referenceResidual(Y,trial))<norm){x=trial;accepted=true;break;}}
    assert.ok(accepted,`dense reference line search failed at ${it}`);
  }assert.fail('dense P/PQV reference did not converge');
}

test('single-actuator augmented and independent dense P/PQV solve the same physical problem',()=>{
  const Y=buildY(model),augmented=solveNR(model,undefined,{stationControls:[control],admittance:Y});
  assert.equal(augmented.converged,true,augmented.status);
  const reference=solveReference(Y),{vm,va}=referenceState(reference),ref=physicalPQ(Y,vm,va),actual=physicalPQ(Y,Float64Array.from(augmented.Vm!),Float64Array.from(augmented.Va!));
  const stateError=Math.max(...vm.map((v,i)=>Math.abs(v-augmented.Vm![i])),...va.map((v,i)=>Math.abs(v-augmented.Va![i])));
  assert.ok(stateError<=1e-7,`state difference ${stateError}`);
  assert.ok(Math.abs(ref.q[1]-actual.q[1])<=1e-7);
  assert.ok(Math.abs(augmented.Q![1]/100-model.qSpec[1]/100-augmented.controlDqPu![0])<=1e-7);
  assert.ok(Math.abs(vm[3]-control.targetVmPu)<=1e-12);
  assert.ok(Math.abs(augmented.Vm![3]-control.targetVmPu)<=1e-12);
  assert.ok(Math.max(...referenceResidual(Y,reference).map(Math.abs))<=1e-7);
  for(const bus of [1,2,3])assert.ok(Math.abs(ref.p[bus]-model.pSpec[bus]/100)<=1e-7);
  for(const bus of [2,3])assert.ok(Math.abs(ref.q[bus]-model.qSpec[bus]/100)<=1e-7);
  assert.ok(Math.abs(ref.p.reduce((a,b)=>a+b,0)-actual.p.reduce((a,b)=>a+b,0))<=1e-7);
  assert.ok(Math.abs(ref.q.reduce((a,b)=>a+b,0)-actual.q.reduce((a,b)=>a+b,0))<=1e-7);
});

test('eliminating the augmented actuator Q row and Dq column yields P/PQV residual and Jacobian direction',()=>{
  const Y=buildY(model),L=makeLayout(Y,model.busType,0,[control]),x=Float64Array.from([.014,-.011,.006,1.012,.982]),{vm,va}=referenceState(x),p=new Float64Array(4),q=new Float64Array(4),values=new Float64Array(L.colIdx.length);
  calcPQ(Y,vm,va,p,q);fillJacobian(Y,L,vm,va,p,q,values,[control]);
  const rows=[L.angIndex[1],L.angIndex[2],L.angIndex[3],L.qIndex[2],L.qIndex[3]],cols=[L.angIndex[1],L.angIndex[2],L.angIndex[3],L.vIndex[1],L.vIndex[2]],dense=denseJacobian(z=>referenceResidual(Y,z),x);
  assert.equal(L.N,6);assert.equal(L.vIndex[3],-1);
  assert.equal(values[L.pos[L.qIndex[1]].get(L.controlIndex[0])!],-1);
  const reduced=rows.map(row=>Float64Array.from(cols,col=>values[L.pos[row].get(col)!]));
  let maxError=0;for(let i=0;i<5;i++)for(let j=0;j<5;j++)maxError=Math.max(maxError,Math.abs(reduced[i][j]-dense[i][j]));
  assert.ok(maxError<1e-7,`reduced Jacobian difference ${maxError}`);
  const direction=denseSolve(reduced,Float64Array.from(referenceResidual(Y,x),v=>-v));
  const referenceDirection=denseSolve(dense,Float64Array.from(referenceResidual(Y,x),v=>-v));
  assert.ok(Math.max(...direction.map((v,i)=>Math.abs(v-referenceDirection[i])))<1e-7);
});

test('multi-actuator elimination retains the participation-sharing Q relation',()=>{
  const five:NumericalModel={...model,n:5,pSpec:Float64Array.from([0,35,12,-25,-20]),qSpec:Float64Array.from([0,4,2,-9,-5]),busType:Int8Array.from([2,0,0,0,0]),vmSet:Float64Array.from([1,1,1,1,1]),shuntG:new Float64Array(5),shuntB:new Float64Array(5),qMinNet:Array(5).fill(null),qMaxNet:Array(5).fill(null),branches:[...model.branches,{i:2,j:4,r:.014,x:.11,bch:.008,tap:1,phase:0}]};
  const multi:IntegratedStationControl={remoteBus:4,targetVmPu:1.02,actuators:[{bus:1,participation:.25},{bus:2,participation:.75}]},Y=buildY(five),L=makeLayout(Y,five.busType,0,[multi]),vm=Float64Array.from([1,1.01,.99,.98,1.02]),va=Float64Array.from([0,.01,-.008,-.015,-.02]),p=new Float64Array(5),q=new Float64Array(5),values=new Float64Array(L.colIdx.length);
  calcPQ(Y,vm,va,p,q);fillJacobian(Y,L,vm,va,p,q,values,[multi]);
  const row1=L.qIndex[1],row2=L.qIndex[2],column=L.controlIndex[0],ratio=.75/.25;
  assert.equal(values[L.pos[row1].get(column)!],-.25);assert.equal(values[L.pos[row2].get(column)!],-.75);
  const reducedQ=(q[2]-five.qSpec[2]/100)-ratio*(q[1]-five.qSpec[1]/100);
  for(let col=0;col<L.N;col++)if(col!==column){
    const derivative=(values[L.pos[row2].get(col)!]??0)-ratio*(values[L.pos[row1].get(col)!]??0);
    const h=1e-7,plusVm=Float64Array.from(vm),minusVm=Float64Array.from(vm),plusVa=Float64Array.from(va),minusVa=Float64Array.from(va);
    const angleBus=[...L.ang].find(bus=>L.angIndex[bus]===col),voltageBus=[...L.vm].find(bus=>L.vIndex[bus]===col);
    if(angleBus!=null){plusVa[angleBus]+=h;minusVa[angleBus]-=h;}else if(voltageBus!=null){plusVm[voltageBus]+=h;minusVm[voltageBus]-=h;}else continue;
    const qp=new Float64Array(5),qm=new Float64Array(5),scratch=new Float64Array(5);
    calcPQ(Y,plusVm,plusVa,scratch,qp);calcPQ(Y,minusVm,minusVa,scratch,qm);
    const fd=((qp[2]-ratio*qp[1])-(qm[2]-ratio*qm[1]))/(2*h);
    assert.ok(Math.abs(derivative-fd)<1e-7,`sharing derivative col ${col}`);
  }
  assert.ok(Number.isFinite(reducedQ));
});
