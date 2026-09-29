import type {SparseMatrix} from './types';

export interface SparsePermutation {newToOld:Int32Array;oldToNew:Int32Array}

/** The structural graph of A + A^T, including one-sided nonzeros. */
export function symmetricPattern(A:SparseMatrix):number[][] {
  const neighbors=Array.from({length:A.N},()=>new Set<number>());
  for(let row=0;row<A.N;row++)for(let k=A.rowPtr[row];k<A.rowPtr[row+1];k++){
    const col=A.colIdx[k];if(col===row)continue;
    neighbors[row].add(col);neighbors[col].add(row);
  }
  return neighbors.map(set=>[...set].sort((a,b)=>a-b));
}

/** Deterministic reverse Cuthill-McKee, with degree ties by original index. */
export function reverseCuthillMcKee(A:SparseMatrix):SparsePermutation {
  const graph=symmetricPattern(A),degree=graph.map(row=>row.length),seen=new Uint8Array(A.N),order:number[]=[];
  const byDegree=(a:number,b:number)=>degree[a]-degree[b]||a-b;
  while(order.length<A.N){let start=-1;
    for(let i=0;i<A.N;i++)if(!seen[i]&&(start<0||byDegree(i,start)<0))start=i;
    const queue=[start],component:number[]=[];seen[start]=1;
    for(let head=0;head<queue.length;head++){
      const node=queue[head];component.push(node);
      for(const next of [...graph[node]].sort(byDegree))if(!seen[next]){seen[next]=1;queue.push(next);}
    }
    order.push(...component.reverse());
  }
  const newToOld=Int32Array.from(order),oldToNew=new Int32Array(A.N);
  newToOld.forEach((old,index)=>{oldToNew[old]=index;});
  return{newToOld,oldToNew};
}

/** Apply one permutation to rows and columns: A' = P A P^T. */
export function permuteSparseMatrix(A:SparseMatrix,permutation:SparsePermutation):SparseMatrix {
  const{newToOld,oldToNew}=permutation,n=A.N,rowPtr=new Int32Array(n+1),columns:number[]=[],values:number[]=[],pos:Array<Map<number,number>>=[],diagPos=new Int32Array(n).fill(-1);
  if(newToOld.length!==n||oldToNew.length!==n)throw Error('ORDERING_SIZE_MISMATCH');
  const seen=new Uint8Array(n);for(let i=0;i<n;i++){const old=newToOld[i];if(old<0||old>=n||seen[old]||oldToNew[old]!==i)throw Error('ORDERING_NOT_BIJECTIVE');seen[old]=1;}
  for(let row=0;row<n;row++){
    const oldRow=newToOld[row],entries:Array<{column:number;value:number}>=[];
    for(let k=A.rowPtr[oldRow];k<A.rowPtr[oldRow+1];k++)entries.push({column:oldToNew[A.colIdx[k]],value:A.values[k]});
    entries.sort((a,b)=>a.column-b.column);const positions=new Map<number,number>();
    for(const entry of entries){const at=columns.length;columns.push(entry.column);values.push(entry.value);positions.set(entry.column,at);if(entry.column===row)diagPos[row]=at;}
    pos.push(positions);rowPtr[row+1]=columns.length;
  }
  return{N:n,rowPtr,colIdx:Int32Array.from(columns),values:Float64Array.from(values),pos,diagPos};
}
export function permuteVector(vector:Float64Array,permutation:SparsePermutation):Float64Array {
  return Float64Array.from(permutation.newToOld,old=>vector[old]);
}
export function unpermuteVector(vector:Float64Array,permutation:SparsePermutation):Float64Array {
  const original=new Float64Array(vector.length);permutation.newToOld.forEach((old,index)=>{original[old]=vector[index];});return original;
}
export function structuralBandwidth(A:SparseMatrix):number {
  let bandwidth=0;for(let row=0;row<A.N;row++)for(let k=A.rowPtr[row];k<A.rowPtr[row+1];k++)bandwidth=Math.max(bandwidth,Math.abs(row-A.colIdx[k]));return bandwidth;
}
