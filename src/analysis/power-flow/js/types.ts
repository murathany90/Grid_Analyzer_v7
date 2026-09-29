import type { NumericBranch } from '../preparation';

export type NumericalBranch = NumericBranch;
export interface NumericalModel {
  n: number;
  baseMVA?: number;
  slack: number;
  slackVm?: number;
  pSpec: ArrayLike<number>;
  qSpec: ArrayLike<number>;
  busType: ArrayLike<number>;
  vmSet?: ArrayLike<number>;
  shuntG?: ArrayLike<number>;
  shuntB?: ArrayLike<number>;
  qMinNet?: ArrayLike<number | null>;
  qMaxNet?: ArrayLike<number | null>;
  branches: readonly NumericalBranch[];
}
export interface IntegratedStationControl {
  readonly remoteBus: number;
  readonly targetVmPu: number;
  readonly actuators: readonly { readonly bus: number; readonly participation: number }[];
}
export interface AdmittanceMatrix { n:number; rowPtr:Int32Array; colIdx:Int32Array; g:Float64Array; b:Float64Array; }
export interface JacobianLayout { N:number; nang:number; ang:Int32Array; pq:Int32Array; vm:Int32Array; angIndex:Int32Array; vIndex:Int32Array; qIndex:Int32Array; controlIndex:Int32Array; rowPtr:Int32Array; colIdx:Int32Array; pos:Map<number,number>[]; diagPos:Int32Array; }
export interface SparseMatrix { N:number; rowPtr:Int32Array; colIdx:Int32Array; values:Float64Array; pos:Map<number,number>[]; diagPos:Int32Array; }
export interface ILU0Factor { lu:Float64Array; diag:Int32Array; minPivot:number|null; rowPtr?:Int32Array; colIdx?:Int32Array; }
export interface LinearSolution { x:Float64Array; iterations:number; residual:number; method?:string; }
export interface LinearSolveDiagnostics { minPivot:number|null; stage:string; }
export interface NumericalFailureDiagnostic {
  failureStage:'NO_SLACK'|'YBUS_BUILD'|'LINEAR_SOLVE'|'LINE_SEARCH'|'NEWTON_ITERATION'|'Q_LIMIT';
  iteration:number|null; controlRound:number; maxMismatchMw:number|null; minPivot:number|null;
  islandCount:number; unsuppliedBusCount:number; referenceBus:number|null; message:string;
  linearStage?:string; pivotSource?:'ILU0_PRE_REGULARIZATION';
  lineSearchAccepted?:boolean;
  lineSearchStepCap?:number; lineSearchBestNormRatio?:number;
}
export interface PowerFlowBranchResult { index:number; pf:number; qf:number; pt:number; qt:number; }
export interface PowerFlowResult { status:string; converged:boolean; iterations:number; rounds:number; maxMismatchMW:number|null; linear?:LinearSolution|null; failure?:NumericalFailureDiagnostic; elapsedMs:number; pvToPq?:Array<{bus:number;qRequired:number;qLimit:number}>; Vm?:number[]; Va?:number[]; P?:number[]; Q?:number[]; controlDqPu?:number[]; branches?:PowerFlowBranchResult[]; minV?:number; maxV?:number; warnings?:string[]; }
export type ProgressCallback=(stage:string,data?:Record<string,number>)=>void;
export interface SelfTestResult { name:string; pass:boolean; status:string; value:number|null; }
