import assert from 'node:assert/strict';
import test from 'node:test';
import type {SparseMatrix} from '../../src/analysis/power-flow/js/types';
import {csrMatVec,gmres,iluFill} from '../../src/analysis/power-flow/js/linear-solver';
import {permuteSparseMatrix,permuteVector,reverseCuthillMcKee,structuralBandwidth,symmetricPattern,unpermuteVector} from '../../src/analysis/power-flow/js/ordering';

function matrix(rows:readonly (readonly [number,number][])[]):SparseMatrix {
  const N=rows.length,rowPtr=new Int32Array(N+1),columns:number[]=[],values:number[]=[],pos:Array<Map<number,number>>=[],diagPos=new Int32Array(N).fill(-1);
  rows.forEach((row,i)=>{const entries=[...row].map(([col,value])=>({col,value})).sort((a,b)=>a.col-b.col),map=new Map<number,number>();
    for(const entry of entries){const at=columns.length;columns.push(entry.col);values.push(entry.value);map.set(entry.col,at);if(entry.col===i)diagPos[i]=at;}
    pos.push(map);rowPtr[i+1]=columns.length;
  });
  return{N,rowPtr,colIdx:Int32Array.from(columns),values:Float64Array.from(values),pos,diagPos};
}
function matVec(A:SparseMatrix,x:Float64Array){const out=new Float64Array(A.N);csrMatVec(A,x,out);return out;}
function relativeResidual(A:SparseMatrix,x:Float64Array,b:Float64Array){const ax=matVec(A,x);return Math.hypot(...ax.map((v,i)=>v-b[i]))/Math.max(1e-14,Math.hypot(...b));}

test('RCM builds a valid inverse bijection from the symmetric pattern of nonsymmetric disconnected CSR',()=>{
  const A=matrix([
    [[0,4],[2,-1]],[[1,4]],[[2,4],[3,-1]],[[3,4]],
    [[4,4],[5,-1]],[[5,4]],
  ]);
  const graph=symmetricPattern(A);assert.ok(graph[0].includes(2));assert.ok(graph[2].includes(0));assert.ok(graph[4].includes(5));assert.ok(graph[5].includes(4));
  const p=reverseCuthillMcKee(A),again=reverseCuthillMcKee(A);
  assert.deepEqual([...p.newToOld],[...again.newToOld]);
  assert.deepEqual([...p.newToOld].sort((a,b)=>a-b),[0,1,2,3,4,5]);
  p.newToOld.forEach((old,i)=>assert.equal(p.oldToNew[old],i));
  const AP=permuteSparseMatrix(A,p),x=Float64Array.from([1,2,3,4,5,6]);
  assert.deepEqual([...matVec(AP,permuteVector(x,p))],[...permuteVector(matVec(A,x),p)]);
  assert.deepEqual([...unpermuteVector(permuteVector(x,p),p)],[...x]);
});

test('full P A P^T and RHS/solution permutation preserve a sparse nonsymmetric solve and true residual',()=>{
  const n=14,order=Array.from({length:n},(_,i)=>i%2===0?i/2:n-1-(i-1)/2),position=new Int32Array(n);order.forEach((node,i)=>{position[node]=i;});
  const physical=Array.from({length:n},(_,i)=>new Map<number,number>([[i,5]]));
  for(let i=0;i<n-1;i++){physical[i].set(i+1,-1.1);physical[i+1].set(i,-.8);}
  physical[2].set(8,-.2);physical[9].set(4,.15); // one-sided structural edges
  const rows:Array<Array<[number,number]>>=Array.from({length:n},()=>[]);
  for(let physicalRow=0;physicalRow<n;physicalRow++)for(const[col,value]of physical[physicalRow])rows[position[physicalRow]].push([position[col],value]);
  const A=matrix(rows),p=reverseCuthillMcKee(A),AP=permuteSparseMatrix(A,p),truth=Float64Array.from({length:n},(_,i)=>1+i*.1),b=matVec(A,truth),bp=permuteVector(b,p);
  assert.ok(structuralBandwidth(AP)<structuralBandwidth(A),`bandwidth ${structuralBandwidth(A)} -> ${structuralBandwidth(AP)}`);
  const natural=gmres(A,b,iluFill(A,1),1e-8,20,3),ordered=gmres(AP,bp,iluFill(AP,1),1e-8,20,3);
  assert.ok(natural&&ordered);
  const restored=unpermuteVector(ordered.x,p);
  assert.ok(relativeResidual(A,natural.x,b)<1e-6);
  assert.ok(relativeResidual(A,restored,b)<1e-6);
  assert.ok(Math.max(...restored.map((v,i)=>Math.abs(v-natural.x[i])))<1e-7);
  assert.ok(Math.max(...restored.map((v,i)=>Math.abs(v-truth[i])))<1e-7);
});
