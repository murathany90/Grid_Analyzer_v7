import assert from 'node:assert/strict';
import test from 'node:test';
import {KluSparseDirectFactorization} from '../../src/analysis/power-flow/js/sparse-direct';
import type {SparseMatrix} from '../../src/analysis/power-flow/js/types';

const matrix:SparseMatrix={
  N:3,rowPtr:Int32Array.from([0,2,5,7]),colIdx:Int32Array.from([0,1,0,1,2,1,2]),
  values:Float64Array.from([4,1,2,5,1,3,6]),
  pos:[new Map([[0,0],[1,1]]),new Map([[0,2],[1,3],[2,4]]),new Map([[1,5],[2,6]])],
  diagPos:Int32Array.from([0,3,6]),
};
test('KLU adapter solves a nonsymmetric sparse system with checked true residual',()=>{
  const factor=new KluSparseDirectFactorization();
  try{factor.factorize(matrix);const result=factor.solve(Float64Array.from([6,15,24]));
    assert.equal(result.success,true);assert.ok(result.trueResidual!<1e-12);
    result.x!.forEach((value,index)=>assert.ok(Math.abs(value-(index+1))<1e-12));
    assert.equal(factor.diagnostics.factorizations,1);assert.equal(factor.diagnostics.rhsCount,1);
  }finally{factor.dispose();}
});
test('a KLU failure records its stage instead of being swallowed',()=>{
  // A CSR matrix whose column index is out of range makes the CSC conversion throw. The
  // solver falls back to an iterative method, so the stage must survive for diagnostics.
  const broken:SparseMatrix={N:2,rowPtr:Int32Array.from([0,1,2]),colIdx:Int32Array.from([0,7]),values:Float64Array.from([1,1]),pos:[new Map([[0,0]]),new Map([[1,1]])],diagPos:Int32Array.from([0,1])};
  const factor=new KluSparseDirectFactorization();
  try{factor.factorize(broken);assert.fail('expected the invalid column index to throw');}
  catch(error){assert.match(String((error as Error).message),/INVALID_COLUMN/);}
  finally{factor.dispose();}
  // A successful solve leaves no failure recorded.
  const clean=new KluSparseDirectFactorization();
  try{clean.factorize(matrix);assert.equal(clean.diagnostics.failureStage,'NONE');assert.equal(clean.diagnostics.failureMessage,null);
    const result=clean.solve(Float64Array.from([6,15,24]));assert.equal(result.success,true);assert.equal(clean.diagnostics.failureStage,'NONE');
  }finally{clean.dispose();}
});

test('one KLU factorization solves multiple RHS without changing the matrix',()=>{
  const factor=new KluSparseDirectFactorization();
  try{factor.factorize(matrix);const rows=factor.solveMany([Float64Array.from([6,15,24]),Float64Array.from([11,3,9])]);
    assert.equal(rows.length,2);assert.deepEqual(rows.map(row=>row.success),[true,true]);
    assert.ok(rows.every(row=>row.trueResidual!<1e-12));
    assert.ok(Math.abs(rows[1].x![0]-3)<1e-12);assert.ok(Math.abs(rows[1].x![1]+1)<1e-12);assert.ok(Math.abs(rows[1].x![2]-2)<1e-12);
    assert.equal(factor.diagnostics.factorizations,1);assert.equal(factor.diagnostics.rhsCount,2);
  }finally{factor.dispose();}
});
