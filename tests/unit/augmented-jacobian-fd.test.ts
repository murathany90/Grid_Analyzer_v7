import assert from 'node:assert/strict';
import test from 'node:test';
import type {NumericalModel,IntegratedStationControl} from '../../src/analysis/power-flow/js/types';
import {buildY} from '../../src/analysis/power-flow/js/ybus';
import {calcPQ,fillJacobian,makeLayout} from '../../src/analysis/power-flow/js/jacobian';

test('augmented Newton Jacobian matches directional finite differences in Va, Vm and control Dq',()=>{
  const n=5,model:NumericalModel={n,baseMVA:100,slack:0,slackVm:1,
    pSpec:Float64Array.from([0,.3,.4,-.45,-.2].map(v=>100*v)),
    qSpec:Float64Array.from([0,.1,.15,-.22,-.08].map(v=>100*v)),
    busType:Int8Array.from([2,0,0,0,1]),vmSet:Float64Array.from([1,1,1,1,1.01]),
    shuntG:new Float64Array(n),shuntB:new Float64Array(n),qMinNet:Array(n).fill(null),qMaxNet:Array(n).fill(null),
    branches:[[0,1],[0,2],[1,3],[2,3],[3,4],[1,2]].map(([i,j],k)=>({i,j,r:.008+k*.001,x:.09+k*.005,bch:.01,tap:1,phase:0}))};
  const control:IntegratedStationControl={remoteBus:3,targetVmPu:1.02,actuators:[{bus:1,participation:.3},{bus:2,participation:.7}]};
  const controls=[control],Y=buildY(model),L=makeLayout(Y,model.busType,model.slack,controls),vm=Float64Array.from([1,1.015,.99,1.02,1.01]),va=Float64Array.from([0,.018,-.013,.007,-.025]);
  assert.equal(L.N,7);assert.equal(L.vIndex[3],-1);assert.equal(L.controlIndex.length,1);
  const q0=.045,base=100;
  // Newton solves J dx = spec - calc. Its stored J differentiates
  // G = calc - spec, including G_Q = Qcalc - Qspec - participation*Dq.
  const residual=(V:Float64Array,A:Float64Array,dq:number)=>{
    const P=new Float64Array(n),Q=new Float64Array(n),r=new Float64Array(L.N);calcPQ(Y,V,A,P,Q);
    L.ang.forEach((bus,k)=>{r[k]=P[bus]-model.pSpec[bus]/base;});
    L.pq.forEach((bus,k)=>{r[L.nang+k]=Q[bus]-model.qSpec[bus]/base-controls.reduce((sum,c)=>sum+c.actuators.filter(a=>a.bus===bus).reduce((s,a)=>s+a.participation*dq,0),0);});
    return r;
  };
  const P=new Float64Array(n),Q=new Float64Array(n),values=new Float64Array(L.colIdx.length);calcPQ(Y,vm,va,P,Q);fillJacobian(Y,L,vm,va,P,Q,values,controls);
  assert.equal(values[L.pos[L.qIndex[1]].get(L.controlIndex[0])!],-.3);
  assert.equal(values[L.pos[L.qIndex[2]].get(L.controlIndex[0])!],-.7);
  const directions=[
    Float64Array.from({length:L.N},(_,i)=>i<L.nang?.2+i*.03:0),
    Float64Array.from({length:L.N},(_,i)=>i>=L.nang&&i<L.controlIndex[0]?.3-i*.02:0),
    Float64Array.from({length:L.N},(_,i)=>i===L.controlIndex[0]?.4:0),
    Float64Array.from({length:L.N},(_,i)=>(i%2?-.17:.23)+i*.01),
  ];
  const initial=residual(vm,va,q0),eps=1e-7;let maxRelativeError=0;
  for(const d of directions){const vp=Float64Array.from(vm),ap=Float64Array.from(va);
    L.ang.forEach((bus,k)=>{ap[bus]+=eps*d[k];});
    L.vm.forEach(bus=>{vp[bus]+=eps*d[L.vIndex[bus]];});
    const shifted=residual(vp,ap,q0+eps*d[L.controlIndex[0]]);
    const fd:Float64Array=shifted.map((v,i)=>(v-initial[i])/eps);
    const jd:Float64Array=new Float64Array(L.N);
    for(let row=0;row<L.N;row++)for(let p=L.rowPtr[row];p<L.rowPtr[row+1];p++)jd[row]+=values[p]*d[L.colIdx[p]];
    const relativeError:number=Math.hypot(...fd.map((v,i)=>v-jd[i]))/Math.max(1,Math.hypot(...fd));
    maxRelativeError=Math.max(maxRelativeError,relativeError);assert.ok(relativeError<1e-6,`directional relative error ${relativeError}`);
  }
  console.log(`JACOBIAN_FD_MAX_RELATIVE_ERROR=${maxRelativeError}`);
});
