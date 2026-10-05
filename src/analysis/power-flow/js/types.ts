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
  /** External-grid reactive limits aggregated with fixed injections at each bus. */
  referenceQMinNet?: ArrayLike<number | null>;
  referenceQMaxNet?: ArrayLike<number | null>;
  activeBalanceParticipation?:ArrayLike<number>;
  activeBalanceEligibleLoadMw?:ArrayLike<number>;
  activeBalanceEligibilityComplete?:boolean;
  referencePMw?:number;
  branches: readonly NumericalBranch[];
}
export interface IntegratedStationControl {
  readonly id?:string;
  readonly remoteBus: number;
  readonly targetVmPu: number;
  readonly actuators: readonly { readonly bus: number; readonly participation: number }[];
  readonly droopQmvar?:number;
  readonly measurementQmvar?:number;
  readonly measurementParticipation?:number;
  readonly minDqPu?:number;
  readonly maxDqPu?:number;
}
export interface AdmittanceMatrix { n:number; rowPtr:Int32Array; colIdx:Int32Array; g:Float64Array; b:Float64Array; }
export interface JacobianLayout { N:number; nang:number; ang:Int32Array; pq:Int32Array; vm:Int32Array; angIndex:Int32Array; vIndex:Int32Array; qIndex:Int32Array; controlIndex:Int32Array; rowPtr:Int32Array; colIdx:Int32Array; pos:Map<number,number>[]; diagPos:Int32Array;
  explicitControlEquations?:boolean;controlRow?:Int32Array;alphaIndex?:number;alphaRow?:number;slack?:number;
}
export interface SparseMatrix { N:number; rowPtr:Int32Array; colIdx:Int32Array; values:Float64Array; pos:Map<number,number>[]; diagPos:Int32Array; }
export interface ILU0Factor { lu:Float64Array; diag:Int32Array; minPivot:number|null; minPivotBeforeRegularization?:number|null; minPivotAfterRegularization?:number|null; regularizedPivotCount?:number; rowPtr?:Int32Array; colIdx?:Int32Array; }
export interface LinearSolution { x:Float64Array; iterations:number; residual:number; method?:string; }
export interface IterativeSolveDiagnostics {iterations:number;trueResidual:number|null}
export interface LinearSolveDiagnostics { minPivot:number|null; stage:string;minPivotBeforeRegularization?:number|null;minPivotAfterRegularization?:number|null;regularizedPivotCount?:number;pivotSource?:'ILU_CLEAN'|'ILU_REGULARIZED'|'RCM_ILU' }
export interface NumericalFailureDiagnostic {
  failureStage:'NO_SLACK'|'YBUS_BUILD'|'LINEAR_SOLVE'|'LINE_SEARCH'|'NEWTON_ITERATION'|'Q_LIMIT';
  iteration:number|null; controlRound:number; maxMismatchMw:number|null; minPivot:number|null;
  islandCount:number; unsuppliedBusCount:number; referenceBus:number|null; message:string;
  linearStage?:string; pivotSource?:'ILU_CLEAN'|'ILU_REGULARIZED'|'RCM_ILU';
  lineSearchAccepted?:boolean;
  lineSearchStepCap?:number; lineSearchBestNormRatio?:number;
  maxDxVm?:number; maxDxVmBus?:number; maxDxVmBusId?:string|null;
  maxDxTheta?:number; maxDxThetaBus?:number; maxDxThetaBusId?:string|null;
  maxDxControlDq?:number; maxDxControlIndex?:number; maxDxControlId?:string|null;
  oldMinVm?:number; oldMaxVm?:number;
  firstInvalidCandidate?:{bus:number;busId:string|null;oldVm:number;candidateVm:number;scale:number;stateUpdated:boolean};
}
export interface PowerFlowBranchResult { index:number; pf:number; qf:number; pt:number; qt:number; }
export interface QLimitRoundDiagnostic {round:number;changedUnits:number;limitedUnits:number;releasedUnits:number;maxBusMismatchKva:number|null;maxModelEquationErrorPercent:number|null}
export interface PowerFlowResult { status:string; converged:boolean; iterations:number; rounds:number; maxMismatchMW:number|null; linear?:LinearSolution|null; failure?:NumericalFailureDiagnostic; elapsedMs:number; pvToPq?:Array<{bus:number;qRequired:number;qLimit:number;state?:'QMIN_LIMITED'|'QMAX_LIMITED'}>;qLimitRounds?:QLimitRoundDiagnostic[];Vm?:number[]; Va?:number[]; P?:number[]; Q?:number[]; controlDqPu?:number[];alphaMw?:number;boundControlIndex?:number; branches?:PowerFlowBranchResult[]; minV?:number; maxV?:number; warnings?:string[];activeBalanceIterations?:number;activeBalanceMismatchMw?:number|null;activeBalanceLoadAdjustmentsMw?:number[]; }
export type ProgressCallback=(stage:string,data?:Record<string,number>)=>void;
export interface SelfTestResult { name:string; pass:boolean; status:string; value:number|null; }
