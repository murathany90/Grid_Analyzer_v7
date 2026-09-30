/** Synthetic sparse-direct probe only; reads no DGS, ZIP, XLSX or real-model data. */
import {KluSparseDirectFactorization} from '../src/analysis/power-flow/js/sparse-direct';
import type {SparseMatrix} from '../src/analysis/power-flow/js/types';

const width=90,n=width*width,rowPtr=new Int32Array(n+1),colIdx:number[]=[],values:number[]=[],pos:Array<Map<number,number>>=[],diagPos=new Int32Array(n).fill(-1);
for(let row=0;row<n;row++){
  const x=row%width,y=Math.floor(row/width),entries:Array<[number,number]>=[[row,8]];
  if(x>0)entries.push([row-1,-1.05]);if(x<width-1)entries.push([row+1,-.95]);
  if(y>0)entries.push([row-width,-1.03]);if(y<width-1)entries.push([row+width,-.97]);
  if(row%5<4&&x>0&&y>0)entries.push([row-width-1,-.12]);
  if(row%5<4&&x<width-1&&y<width-1)entries.push([row+width+1,-.10]);
  entries.sort((a,b)=>a[0]-b[0]);const positions=new Map<number,number>();
  for(const [col,value] of entries){const at=colIdx.length;colIdx.push(col);values.push(value);positions.set(col,at);if(col===row)diagPos[row]=at;}
  pos.push(positions);rowPtr[row+1]=colIdx.length;
}
const matrix:SparseMatrix={N:n,rowPtr,colIdx:Int32Array.from(colIdx),values:Float64Array.from(values),pos,diagPos};
const factor=new KluSparseDirectFactorization();
try{
  factor.factorize(matrix);
  const batches=[1,32,158].map(count=>{
    const rhs=Array.from({length:count},(_,index)=>{const vector=new Float64Array(n);vector[(index*47+23)%n]=1;return vector;});
    const start=performance.now(),solutions=factor.solveMany(rhs),wallMs=performance.now()-start;
    return{rhsCount:count,wallMs,maxTrueResidual:Math.max(...solutions.map(row=>row.trueResidual??Infinity)),success:solutions.every(row=>row.success)};
  });
  console.log(JSON.stringify({matrix:{dimension:n,nnz:matrix.colIdx.length},factor:factor.diagnostics,batches},null,2));
}finally{factor.dispose();}
