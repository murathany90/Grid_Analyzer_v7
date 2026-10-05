import type {CanonicalNetwork,StationController} from '../../domain/model/network';
import {defaultAnalysisSettings,type FullAcSettings} from '../../domain/calculation/analysis-settings';
import type {StationControlImplementation,StationControlMode} from '../api/engine';
import type {PreparedModel,NumericModel} from './preparation';
import type {PowerFlowResult,NumericalFailureDiagnostic,AdmittanceMatrix,JacobianLayout,IntegratedStationControl} from './js/types';
import {buildY} from './js/ybus';
import {solveNR} from './js/newton';
import {type SensitivityFailure,type SensitivityProbe} from './js/sensitivity';
import {probeAdjointSensitivities} from './js/sensitivity-interleaved';
import type {SensitivitySolverDiagnostic} from './js/sensitivity-interleaved';
import {allocateReactiveDelta,activeParticipation,dispatchedPWeights,interiorParticipation,stationParticipation,type ReactiveAllocation,type ReactiveUnitState} from './station-participation';

type Mapping={id:string;islandId:string|null;solverBusIndex:number|null};
export type ControlStatus='PENDING'|'SATISFIED'|'SATURATED_QMIN'|'SATURATED_QMAX'|'NO_REACTIVE_HEADROOM'|'ROLLED_BACK_TO_LOCAL_PV'|'REMOTE_CONTROL_CONFLICT'|'Q_LIMITS_UNAVAILABLE'|'UNSUPPORTED_PROFILE'|'UNSUPPORTED_DISTRIBUTION'|'UNSUPPORTED_DROOP'|'REMOTE_BUS_UNRESOLVED'|'NO_REFERENCE_ISLAND'|'LOCAL_PV_CONFLICT'|'CONTROL_SOLVE_FAILED'|'MAX_OUTER_ROUNDS'|'STAGNATED_TRIAL'|'BASELINE_LOCAL_PV'|'OWNERSHIP_ONLY'|'CONTROL_RESIDUAL_AFTER_FINAL_BALANCE';
export interface ControlDiagnostic {
  id:string;controllerId:string;remoteBus:string;islandId:string|null;targetVpu:number;initialVpu:number|null;finalVpu:number|null;voltageResidualPu:number|null;
  initialQ:number|null;finalQ:number|null;qMin:number|null;qMax:number|null;outerRounds:number;status:ControlStatus;supported:boolean;unitIds:string[];actuatorBus:number|null;actuatorBuses:number[];remoteBusIndex:number|null;
  participationKi:Record<string,number>;jacobianDimension:number|null;linearMethod:string|null;linearIterations:number|null;linearResidual:number|null;iluMinimumPivot:number|null;effectiveSlope:number|null;individualDvDqi:Record<string,number|null>;elapsedSensitivityMs:number|null;failureReason:SensitivityFailure|null;controlSolveFailure?:string|null;ownershipUnallocatedMvar?:number;
  qDistributionSource?:'SOURCE_CVQQ'|'DERIVED_DISPATCHED_ACTIVE_POWER'|null;
}
export interface ControlTimings {baseNrMs:number;controllerClassificationMs:number;jacobianBuildMs:number;rcmReorderMs:number;ilu1FactorMs:number;ilu2FactorMs:number;iluFactorMs:number;sensitivityIterativeSolveMs:number;cscConversionMs:number;symbolicFactorMs:number;numericFactorMs:number;directRhsSolveMs:number;sensitivitySolveMs:number;classificationNrMs:number;outerTrialNrMs:number;finalNrMs:number;controlLimitRestartNrMs:number;fullNrSolves:number;totalNewtonIterations:number;kluNewtonFactorizations:number;finalBalanceCorrections:number}
export interface CoupledSystemDiagnostic {conditionEstimate:number|null;regularization:number;activeControllers:string[];objectiveRows:number;freeColumns:number;fixedControllers:number;rank:number;solveStatus:'SOLVED'|'REGULARIZED'|'SINGULAR'|'BOUNDED_ITERATIVE';activeControllerCount?:number;zeroDroopCount?:number;droopCount?:number;boundedSweeps?:number;projectedGradientNorm?:number;relativeProjectedGradient?:number;maxControllerAllowedMove?:number;objectiveStart?:number;objectiveEnd?:number;objectiveAtSweeps?:Record<string,number|null>;objectiveRatio?:number|null;interiorVariableCount?:number;atLowerBoundCount?:number;atUpperBoundCount?:number;zeroMoveCount?:number;columnNormRatio?:number|null;activeSetPolishIterations?:number;activeSetPolishConverged?:boolean;activeSetPolishFreeVariables?:number;activeSetPolishDeferredVariables?:number;activeSetPolishConditionEstimate?:number|null;activeSetPolishRegularization?:number;activeSetPolishRejectedObjectiveIncrease?:boolean;converged?:boolean;directionRebuilds?:number;directionConsistent?:boolean;matrixValid?:boolean}
export interface ControllerTrialDiagnostic {round:number;zeroDroopActive:number;droopActive:number;newlySatisfied:number;newlySaturated:number;stagnatedSubsetCount?:number;stagnationReason?:'NO_DIRECTIONAL_HEADROOM'|'CONSTRAINED_KKT_STATIONARY'|'NO_DESCENT_AFTER_REFRESH';trustFraction:number;proposalKind:'COUPLED'|'GRADIENT';status:string;accepted:boolean;rejectedReason:string|null;activeControllerCount:number;freeControllerCount:number;saturatedControllerCount:number;denseDimension:number;objectiveRows:number;freeColumns:number;fixedControllers:number;regularization:number;conditionEstimate:number|null;rank:number;oldNorm:number;predictedNorm:number;predictedReduction:number;newNorm:number|null;actualReduction:number|null;rho:number|null;maxRequestedDeltaQ:number;maxAppliedDeltaQ:number;sumAbsDeltaQ:number;nrIterations:number|null;failureIteration:number|null;failureMismatchMw:number|null;linearResidual:number|null}
export interface ControllerResidualSnapshot {satisfied:number;saturated:number;movableResidual:number;residualRmsPu:number;residualMaxPu:number}
interface Control {source:StationController;row:ControlDiagnostic;units:ReactiveUnitState[];remote:number;droopQ:number|null;sourceWeights?:ReadonlyMap<string,number>}
export interface ControlledIslandV73 {prepared:PreparedModel;result:PowerFlowResult;controllers:ControlDiagnostic[];outerRounds:number;unitOverrides:Map<string,{qMvar:number|null;qState:string}>;timings:ControlTimings;resultProvenance?:'LOCAL_PV'|'OWNERSHIP'|'SENSITIVITY_STATION_CONTROL'|'INTEGRATED_STATION_CONTROL'|'BASELINE_FALLBACK';integratedFailure?:NumericalFailureDiagnostic;sensitivitySolverDiagnostics?:SensitivitySolverDiagnostic[];classificationPasses?:number;classificationStable?:boolean;integratedControllers?:number;controlLimitRestarts?:number;coupledSystems?:CoupledSystemDiagnostic[];trialAttempts?:ControllerTrialDiagnostic[];stagnatedSubsetCount?:number;
/** Outcome of revalidating controller states after the final distributed-P correction. */
finalRevalidation?:{revalidatedControllerCount:number;controlResidualCount:number;entries:string[];before?:ControllerResidualSnapshot;after?:ControllerResidualSnapshot;causeCounts?:{CONTROL_RESIDUAL_BEFORE_FINAL_BALANCE:number;FINAL_ACTIVE_BALANCE_MOVED_REMOTE_VOLTAGE:number}}}
const now=()=>performance.now(),finite=(x:unknown):x is number=>typeof x==='number'&&Number.isFinite(x),EPS=1e-8;
export function classifyMonotoneActiveSet<T>(initial:readonly T[],probe:(active:readonly T[],pass:number)=>readonly T[],removeAndResolve:(failed:readonly T[])=>boolean,maxPasses=4):{active:T[];passes:number;stable:boolean;nrFailed:boolean} {
  let active=[...initial],passes=0,stable=active.length===0,nrFailed=false;
  for(let pass=1;pass<=maxPasses&&active.length;pass++){
    passes=pass;const failed=probe(active,pass),removed=new Set(failed);
    if(removed.size!==failed.length||failed.some(item=>!active.includes(item)))throw Error('CLASSIFICATION_NONMONOTONE');
    if(!failed.length){stable=true;break;}
    active=active.filter(item=>!removed.has(item));
    if(!removeAndResolve(failed)){nrFailed=true;break;}
    if(!active.length){stable=true;break;}
  }
  return{active,passes,stable,nrFailed};
}
export function droopTarget(usetp:number,qMeas:number,srated:number,ddroop:number):number {return usetp+qMeas/(srated*100/ddroop);}
export function activeControlRms(rows:readonly {status:ControlStatus;residual:number}[]):number|null {const active=rows.filter(row=>row.status==='PENDING'&&Number.isFinite(row.residual));return active.length?Math.sqrt(active.reduce((sum,row)=>sum+row.residual*row.residual,0)/active.length):null;}
/** Preserve the coupled direction while fitting every directional Q and trust bound. */
export function scaleCoupledProposal(raw:readonly number[],bounds:readonly number[]):number[] {
  if(raw.length!==bounds.length||raw.some(value=>!finite(value))||bounds.some(value=>!finite(value)||value<0))throw Error('CONTROLLER_PROPOSAL_INVALID');
  let scale=1;for(let i=0;i<raw.length;i++)if(bounds[i]>EPS&&Math.abs(raw[i])>EPS)scale=Math.min(scale,bounds[i]/Math.abs(raw[i]));
  return raw.map((value,i)=>bounds[i]<=EPS?0:value*scale);
}
/** The NR callback is unreachable for a proposal that cannot reduce the linear objective. */
export function runPredictedDescentTrial<T>(oldNorm:number,predictedNorm:number,solve:()=>T):{predictedReduction:number;result:T|null} {
  const predictedReduction=oldNorm-predictedNorm;
  return{predictedReduction,result:finite(predictedReduction)&&predictedReduction>1e-12?solve():null};
}
export function solveCoupledLeastSquares(sensitivity:readonly (readonly number[])[],residual:readonly number[],scales:readonly number[]):{solution:number[]|null;conditionEstimate:number|null;regularization:number;rank:number;solveStatus:'SOLVED'|'REGULARIZED'|'SINGULAR'} {
  const n=scales.length,m=sensitivity.length;if(!n||!m||residual.length!==m||sensitivity.some(row=>row.length!==n))return{solution:null,conditionEstimate:null,regularization:0,rank:0,solveStatus:'SINGULAR'};
  const scale=scales.map(value=>finite(value)&&value>1?value:1),gram=Array.from({length:n},()=>new Float64Array(n)),rhs=new Float64Array(n);
  for(let i=0;i<n;i++)for(let j=0;j<n;j++){let sum=0;for(let row=0;row<m;row++)sum+=(sensitivity[row][i]*scale[i])*(sensitivity[row][j]*scale[j]);gram[i][j]=sum;}
  for(let i=0;i<n;i++){let sum=0;for(let row=0;row<m;row++)sum+=sensitivity[row][i]*scale[i]*residual[row];rhs[i]=sum;}
  const maxDiagonal=Math.max(...gram.map((row,i)=>Math.abs(row[i])));if(!finite(maxDiagonal)||maxDiagonal<=0)return{solution:null,conditionEstimate:null,regularization:0,rank:0,solveStatus:'SINGULAR'};
  const factor=(regularization:number)=>{const lower=Array.from({length:n},()=>new Float64Array(n)),pivots:number[]=[];let rank=0,min=Infinity,max=0;
    for(let i=0;i<n;i++){for(let j=0;j<=i;j++){let value=gram[i][j]+(i===j?regularization:0);for(let k=0;k<j;k++)value-=lower[i][k]*lower[j][k];if(i===j){if(!finite(value)||value<=maxDiagonal*Number.EPSILON)return{lower,pivots,rank,minPivot:0,maxPivot:Math.max(max,maxDiagonal),ok:false};lower[i][j]=Math.sqrt(value);pivots.push(value);min=Math.min(min,value);max=Math.max(max,value);rank++;}else lower[i][j]=value/lower[j][j];}}return{lower,pivots,rank,minPivot:min,maxPivot:max,ok:true};};
  let factored=factor(0),conditionEstimate:number|null=factored.ok?factored.maxPivot/factored.minPivot:Infinity,regularization=0,solveStatus:'SOLVED'|'REGULARIZED'|'SINGULAR'='SOLVED';const originalRank=factored.rank;
  const targetCondition=1/Math.sqrt(Number.EPSILON);
  if(!factored.ok||conditionEstimate>targetCondition){const minimum=factored.ok?factored.minPivot:0;regularization=Math.max(0,(factored.maxPivot-targetCondition*minimum)/(targetCondition-1));if(regularization<=maxDiagonal*Number.EPSILON)regularization=maxDiagonal/(targetCondition-1);factored=factor(regularization);conditionEstimate=factored.ok?(factored.maxPivot/factored.minPivot):null;solveStatus='REGULARIZED';}
  if(!factored.ok)return{solution:null,conditionEstimate,regularization,rank:originalRank,solveStatus:'SINGULAR'};
  const y=new Float64Array(n),z=new Float64Array(n),solution=new Array<number>(n);
  for(let i=0;i<n;i++){let value=rhs[i];for(let j=0;j<i;j++)value-=factored.lower[i][j]*y[j];y[i]=value/factored.lower[i][i];}
  for(let i=n-1;i>=0;i--){let value=y[i];for(let j=i+1;j<n;j++)value-=factored.lower[j][i]*z[j];z[i]=value/factored.lower[i][i];}
  for(let i=0;i<n;i++)solution[i]=z[i]*scale[i];
  return{solution,conditionEstimate,regularization,rank:originalRank,solveStatus};
}
/** Fixed Q effects change every objective row; only movable controllers supply columns. */
export function solveActiveControllerObjective(matrix:readonly (readonly number[])[],residual:readonly number[],freeIndices:readonly number[],fixedEffects:readonly number[],scales:readonly number[]) {
  const width=matrix[0]?.length??0;
  if(residual.length!==matrix.length||fixedEffects.length!==matrix.length||freeIndices.length!==scales.length||freeIndices.some(index=>index<0||index>=width)||matrix.some(row=>row.length!==width))return solveCoupledLeastSquares([],[],[]);
  return solveCoupledLeastSquares(matrix.map(row=>freeIndices.map(index=>row[index])),residual.map((value,index)=>value-fixedEffects[index]),scales);
}
export interface BoundedControllerObjectiveResult {solution:number[];sweeps:number;predictedNorm:number;projectedGradientNorm:number;relativeProjectedGradient:number;maxControllerAllowedMove:number;objectiveStart:number;objectiveEnd:number;objectiveAtSweeps:Record<string,number|null>;objectiveRatio:number|null;interiorVariableCount:number;atLowerBoundCount:number;atUpperBoundCount:number;zeroMoveCount:number;columnNormRatio:number|null;activeSetPolishIterations:number;activeSetPolishConverged:boolean;activeSetPolishFreeVariables:number;activeSetPolishDeferredVariables:number;activeSetPolishConditionEstimate:number|null;activeSetPolishRegularization:number;activeSetPolishRejectedObjectiveIncrease:boolean;converged:boolean}
export interface BoundedActiveSetPolishResult {solution:number[];iterations:number;converged:boolean;freeVariables:number;deferredVariables:number;conditionEstimate:number|null;regularization:number;rejectedObjectiveIncrease:boolean}
/** Refines the coordinate solution on the strongest remaining coupled columns. */
export function solveBoundedActiveSetPolish(matrix:readonly (readonly number[])[],residual:readonly number[],lower:readonly number[],upper:readonly number[],initial:readonly number[],maxFreeVariables=96):BoundedActiveSetPolishResult {
  const n=lower.length,m=matrix.length;
  if(initial.length!==n||upper.length!==n||residual.length!==m||matrix.some(row=>row.length!==n)||lower.some((value,i)=>!finite(value)||!finite(upper[i])||value>0||upper[i]<0))throw Error('BOUNDED_ACTIVE_SET_POLISH_INVALID');
  const solution=initial.map((value,i)=>Math.max(lower[i],Math.min(upper[i],value))),squared=Array.from({length:n},(_,j)=>matrix.reduce((sum,row)=>sum+row[j]*row[j],0));
  const remaining=()=>matrix.map((row,i)=>residual[i]-row.reduce((sum,value,j)=>sum+value*solution[j],0));
  const projectedMoves=()=>{const r=remaining();return Array.from({length:n},(_,j)=>{if(squared[j]<=1e-18)return 0;let gradient=0;for(let i=0;i<m;i++)gradient+=matrix[i][j]*r[i];return Math.max(lower[j],Math.min(upper[j],solution[j]+gradient/squared[j]))-solution[j];});};
  const allowed=Array.from({length:n},(_,j)=>Math.max(Math.abs(lower[j]),Math.abs(upper[j]))),scores=projectedMoves().map((move,j)=>Math.abs(move)/Math.max(1e-12,allowed[j]));
  const candidates=Array.from({length:n},(_,j)=>j).filter(j=>scores[j]>1e-10&&squared[j]>1e-18).sort((a,b)=>scores[b]-scores[a]).slice(0,Math.max(1,Math.floor(maxFreeVariables)));
  const deferredVariables=Array.from({length:n},(_,j)=>j).filter(j=>scores[j]>1e-10&&squared[j]>1e-18).length-candidates.length;
  const state=new Map<number,'LOWER'|'UPPER'|'FREE'>(),boundTol=(j:number)=>1e-8*Math.max(1,allowed[j]);
  for(const j of candidates){const tol=boundTol(j);state.set(j,Math.abs(solution[j]-lower[j])<=tol?'LOWER':Math.abs(solution[j]-upper[j])<=tol?'UPPER':'FREE');}
  let iterations=0,activeSetChanges=0,converged=!candidates.length,conditionEstimate:number|null=null,regularization=0;
  const changeLimit=candidates.length+4;
  for(;iterations<changeLimit&&candidates.length;){
    iterations++;
    const free=candidates.filter(j=>state.get(j)==='FREE'),freeSet=new Set(free),fixedEffects=matrix.map(row=>row.reduce((sum,value,j)=>sum+(freeSet.has(j)?0:value*solution[j]),0));
    if(free.length){
      const scales=free.map(j=>Math.max(1,upper[j]-lower[j])),fit=solveActiveControllerObjective(matrix,residual,free,fixedEffects,scales);
      if(fit.conditionEstimate!=null)conditionEstimate=Math.max(conditionEstimate??0,fit.conditionEstimate);regularization=Math.max(regularization,fit.regularization);
      if(!fit.solution)break;
      const violated:Array<{index:number;value:number;side:'LOWER'|'UPPER'}>=[];
      free.forEach((j,k)=>{const value=fit.solution![k],tol=boundTol(j);if(value<lower[j]-tol)violated.push({index:j,value:lower[j],side:'LOWER'});else if(value>upper[j]+tol)violated.push({index:j,value:upper[j],side:'UPPER'});});
      if(violated.length){if(activeSetChanges+violated.length>changeLimit)break;for(const change of violated){solution[change.index]=change.value;state.set(change.index,change.side);}activeSetChanges+=violated.length;continue;}
      free.forEach((j,k)=>solution[j]=Math.max(lower[j],Math.min(upper[j],fit.solution![k])));
    }
    const moves=projectedMoves(),release=candidates.filter(j=>{const side=state.get(j),score=Math.abs(moves[j])/Math.max(1e-12,allowed[j]);return(side==='LOWER'&&moves[j]>0||side==='UPPER'&&moves[j]<0)&&score>1e-7;});
    if(release.length){if(activeSetChanges+release.length>changeLimit)break;for(const j of release)state.set(j,'FREE');activeSetChanges+=release.length;continue;}
    converged=true;break;
  }
  const objective=(values:readonly number[])=>matrix.reduce((sum,row,i)=>{const error=residual[i]-row.reduce((total,value,j)=>total+value*values[j],0);return sum+error*error;},0),warmObjective=objective(initial),polishedObjective=objective(solution),rejectedObjectiveIncrease=polishedObjective>warmObjective+1e-12*Math.max(1,warmObjective);
  return{solution:rejectedObjectiveIncrease?[...initial]:solution,iterations,converged:converged&&!rejectedObjectiveIncrease,freeVariables:candidates.length,deferredVariables,conditionEstimate,regularization,rejectedObjectiveIncrease};
}
/** Coupled least squares with per-controller directional Q bounds and a projected KKT stop. */
export function solveBoundedControllerObjective(matrix:readonly (readonly number[])[],residual:readonly number[],lower:readonly number[],upper:readonly number[],maxSweeps=80):BoundedControllerObjectiveResult {
  const n=lower.length,m=matrix.length;
  if(!n||upper.length!==n||residual.length!==m||matrix.some(row=>row.length!==n)||lower.some((value,i)=>!finite(value)||!finite(upper[i])||value>0||upper[i]<0))throw Error('BOUNDED_CONTROLLER_OBJECTIVE_INVALID');
  const solution=new Array<number>(n).fill(0),remaining=Array.from(residual),squared=Array.from({length:n},(_,j)=>matrix.reduce((sum,row)=>sum+row[j]*row[j],0));
  const objectiveAtSweeps:Record<string,number|null>={1:null,5:null,10:null,20:null,40:null,80:null};
  const objectiveStart=remaining.reduce((sum,value)=>sum+value*value,0),projectedGradient=()=>{
    let largest=0;for(let j=0;j<n;j++){if(squared[j]<=1e-18)continue;let projection=0;for(let i=0;i<m;i++)projection+=matrix[i][j]*remaining[i];largest=Math.max(largest,Math.abs(Math.max(lower[j],Math.min(upper[j],solution[j]+projection/squared[j]))-solution[j]));}return largest;
  };
  let sweeps=0,converged=false,previousObjective=objectiveStart,projectedGradientNorm=projectedGradient();
  for(;sweeps<maxSweeps;){
    let largestChange=0;
    for(let j=0;j<n;j++){
      if(squared[j]<=1e-18)continue;
      let projection=0;for(let i=0;i<m;i++)projection+=matrix[i][j]*remaining[i];
      const next=Math.max(lower[j],Math.min(upper[j],solution[j]+projection/squared[j])),change=next-solution[j];
      if(Math.abs(change)<=1e-10)continue;
      solution[j]=next;largestChange=Math.max(largestChange,Math.abs(change));
      for(let i=0;i<m;i++)remaining[i]-=matrix[i][j]*change;
    }
    sweeps++;
    const objective=remaining.reduce((sum,value)=>sum+value*value,0);if(Object.hasOwn(objectiveAtSweeps,String(sweeps)))objectiveAtSweeps[String(sweeps)]=objective;
    const scale=Math.max(1,...solution.map(Math.abs));projectedGradientNorm=projectedGradient();
    if(projectedGradientNorm<=1e-6*scale){converged=true;break;}
    if(largestChange<=1e-7*scale&&previousObjective-objective<=1e-10*Math.max(objectiveStart,1e-18))break;
    previousObjective=objective;
  }
  const polish=solveBoundedActiveSetPolish(matrix,residual,lower,upper,solution),finalSolution=polish.solution,finalRemaining=matrix.map((row,i)=>residual[i]-row.reduce((sum,value,j)=>sum+value*finalSolution[j],0));
  const objectiveEnd=finalRemaining.reduce((sum,value)=>sum+value*value,0),maxControllerAllowedMove=Math.max(0,...Array.from({length:n},(_,j)=>Math.max(Math.abs(lower[j]),Math.abs(upper[j]))));
  let finalGradient=0;for(let j=0;j<n;j++){if(squared[j]<=1e-18)continue;let projection=0;for(let i=0;i<m;i++)projection+=matrix[i][j]*finalRemaining[i];finalGradient=Math.max(finalGradient,Math.abs(Math.max(lower[j],Math.min(upper[j],finalSolution[j]+projection/squared[j]))-finalSolution[j]));}
  const boundTolerance=(j:number)=>1e-7*Math.max(1,Math.abs(lower[j]),Math.abs(upper[j]));let atLowerBoundCount=0,atUpperBoundCount=0,interiorVariableCount=0,zeroMoveCount=0;
  for(let j=0;j<n;j++){const atLower=Math.abs(finalSolution[j]-lower[j])<=boundTolerance(j),atUpper=Math.abs(finalSolution[j]-upper[j])<=boundTolerance(j);if(atLower)atLowerBoundCount++;else if(atUpper)atUpperBoundCount++;else interiorVariableCount++;if(Math.abs(finalSolution[j])<=1e-8*Math.max(1,maxControllerAllowedMove))zeroMoveCount++;}
  const columnNorms=squared.map(value=>Math.sqrt(value)).filter(value=>value>1e-12),columnNormRatio=columnNorms.length?Math.max(...columnNorms)/Math.min(...columnNorms):null;
  return{solution:finalSolution,sweeps,predictedNorm:Math.sqrt(objectiveEnd/Math.max(1,m)),projectedGradientNorm:finalGradient,relativeProjectedGradient:finalGradient/Math.max(1e-12,maxControllerAllowedMove),maxControllerAllowedMove,objectiveStart,objectiveEnd,objectiveAtSweeps,objectiveRatio:objectiveStart>1e-18?objectiveEnd/objectiveStart:null,interiorVariableCount,atLowerBoundCount,atUpperBoundCount,zeroMoveCount,columnNormRatio,activeSetPolishIterations:polish.iterations,activeSetPolishConverged:polish.converged,activeSetPolishFreeVariables:polish.freeVariables,activeSetPolishDeferredVariables:polish.deferredVariables,activeSetPolishConditionEstimate:polish.conditionEstimate,activeSetPolishRegularization:polish.regularization,activeSetPolishRejectedObjectiveIncrease:polish.rejectedObjectiveIncrease,converged:finalGradient<=1e-6*Math.max(1,...finalSolution.map(Math.abs))};
}
/** Rebuilds columns when the bounded Q direction changes which units can participate. */
export function solveDirectionConsistentBoundedObjective(residual:readonly number[],preferred:readonly (1|-1)[],build:(directions:readonly (1|-1)[])=>{matrix:number[][];lower:number[];upper:number[]},maxRebuilds=3){
  const directions=[...preferred];let directionRebuilds=0,totalPolishIterations=0,polishRejectedObjectiveIncrease=false;
  for(;;){const system=build(directions),bounded=solveBoundedControllerObjective(system.matrix,residual,system.lower,system.upper);totalPolishIterations+=bounded.activeSetPolishIterations;polishRejectedObjectiveIncrease||=bounded.activeSetPolishRejectedObjectiveIncrease;
    const mismatched=bounded.solution.flatMap((delta,j)=>Math.abs(delta)>1e-7&&Math.sign(delta)!==directions[j]?[j]:[]);
    if(!mismatched.length||directionRebuilds>=maxRebuilds)return{...bounded,activeSetPolishIterations:totalPolishIterations,activeSetPolishRejectedObjectiveIncrease:polishRejectedObjectiveIncrease,directions,directionRebuilds,directionConsistent:!mismatched.length};
    for(const j of mismatched)directions[j]=directions[j]===1?-1:1;
    directionRebuilds++;
  }
}
export function partitionControllerDescent<T>(active:readonly T[],proposal:ReadonlyMap<T,number>):{movable:T[];stationary:T[]} {
  return{movable:active.filter(control=>Math.abs(proposal.get(control)??0)>EPS),stationary:active.filter(control=>Math.abs(proposal.get(control)??0)<=EPS)};
}
export function mergeControllerAllocations<T>(fixed:ReadonlyMap<T,ReactiveAllocation>,free:ReadonlyMap<T,ReactiveAllocation>):Map<T,ReactiveAllocation> {
  const combined=new Map(fixed);for(const [control,move]of free){if(combined.has(control))throw Error('CONTROLLER_FIXED_AND_FREE');combined.set(control,move);}return combined;
}
/** One common line minimizer keeps correlated gradient columns from overshooting. */
export function globalGradientStep(matrix:readonly (readonly number[])[],residual:readonly number[]):number[] {
  const n=matrix[0]?.length??0;if(!n||matrix.length!==residual.length||matrix.some(row=>row.length!==n))return[];
  const gradient=Array.from({length:n},(_,column)=>matrix.reduce((sum,row,index)=>sum+row[column]*residual[index],0));
  const effect=matrix.map(row=>row.reduce((sum,value,index)=>sum+value*gradient[index],0));
  const numerator=effect.reduce((sum,value,index)=>sum+value*residual[index],0),denominator=effect.reduce((sum,value)=>sum+value*value,0);
  const alpha=denominator>1e-18?Math.max(0,numerator/denominator):0;return gradient.map(value=>alpha*value);
}
const cloneModel=(base:NumericModel):NumericModel=>({...base,pSpec:Float64Array.from(base.pSpec),qSpec:Float64Array.from(base.qSpec),busType:Int8Array.from(base.busType),vmSet:Float64Array.from(base.vmSet),qMinNet:[...base.qMinNet],qMaxNet:[...base.qMaxNet],referenceQMinNet:base.referenceQMinNet?[...base.referenceQMinNet]:undefined,referenceQMaxNet:base.referenceQMaxNet?[...base.referenceQMaxNet]:undefined,activeBalanceParticipation:base.activeBalanceParticipation?Float64Array.from(base.activeBalanceParticipation):undefined,activeBalanceEligibleLoadMw:base.activeBalanceEligibleLoadMw?Float64Array.from(base.activeBalanceEligibleLoadMw):undefined});
/**
 * Effective loop bounds come from typed Full AC settings.
 *
 * These were previously internal constants that `maxOuterIterations` did not control,
 * so a UI value of 50 silently behaved as 12. The defaults below reproduce the previous
 * internal behaviour exactly and are now reported in calculation provenance.
 */
const ACTIVE_BALANCE_MAX_CORRECTIONS=8;
const STATION_CONTROL_MAX_CORRECTIONS=12;
const activeBalanceCorrectionLimit=(settings:FullAcSettings|undefined)=>Math.max(1,Math.floor(settings?.maxActiveBalanceCorrections??ACTIVE_BALANCE_MAX_CORRECTIONS));
const stationControlCorrectionLimit=(settings:FullAcSettings|undefined)=>Math.max(1,Math.floor(settings?.maxStationControlCorrections??STATION_CONTROL_MAX_CORRECTIONS));
export interface ActiveBalanceCapture {model?:NumericModel;adjustmentsMw?:Float64Array;iterations?:number}

export function solveNRWithActiveBalance(model:NumericModel,progress:((stage:string,detail?:Record<string,number>)=>void)|undefined,settings:FullAcSettings|undefined,options:Parameters<typeof solveNR>[2]={},capture?:ActiveBalanceCapture):PowerFlowResult{
  const weights=model.activeBalanceParticipation,totalLoad=Array.from(model.activeBalanceEligibleLoadMw||[]).reduce((sum,value)=>sum+value,0);
  if(settings?.activeBalancingMode!=='DISTRIBUTED_ADJUSTABLE_LOADS'||model.activeBalanceEligibilityComplete!==true||!weights||!weights.some(value=>value>0))return solveNR(model,progress,{...options,settings});
  const working=cloneModel(model),targetP=working.referencePMw??0,toleranceMva=(settings.nodalToleranceKva/1000),maxOuter=activeBalanceCorrectionLimit(settings),loadAdjustments=new Float64Array(model.n);let last:PowerFlowResult|null=null,mismatch=Infinity,eligibleLoadsExhausted=false,iterations=0;
  for(let iteration=1;iteration<=maxOuter;iteration++){
    iterations=iteration;
    last=solveNR(working,progress,{...options,initialVm:last?.Vm??options.initialVm,initialVa:last?.Va??options.initialVa,initialLimitedBuses:last?.pvToPq??options.initialLimitedBuses,settings});if(!last.converged||!last.P)return last;
    const fixedAtReference=working.pSpec[working.slack]-targetP,externalP=last.P[working.slack]-fixedAtReference;mismatch=externalP-targetP;
    progress?.('ACTIVE_BALANCE_ITERATION',{round:iteration,externalGridPMw:externalP,mismatchMw:mismatch});
    if(Math.abs(mismatch)<=toleranceMva){if(capture){capture.model=working;capture.adjustmentsMw=loadAdjustments;capture.iterations=iteration;}return{...last,activeBalanceIterations:iteration,activeBalanceMismatchMw:mismatch,activeBalanceLoadAdjustmentsMw:Array.from(loadAdjustments)};}
    const remainingEligibleLoad=Math.max(0,totalLoad+loadAdjustments.reduce((sum,value)=>sum+value,0));
    if(iteration===maxOuter||(mismatch>0&&remainingEligibleLoad<=toleranceMva)){eligibleLoadsExhausted=mismatch>0&&remainingEligibleLoad<=toleranceMva;break;}
    // Positive mismatch means reduce eligible load to lower external-grid P;
    // negative mismatch means increase eligible load to raise external-grid P.
    // Limit reductions to sourced initial load so no load is reversed.
    const adjustment=mismatch>0?Math.min(mismatch,remainingEligibleLoad):mismatch;
    for(let bus=0;bus<working.n;bus++){const busAdjustment=(weights[bus]||0)*adjustment;working.pSpec[bus]+=busAdjustment;loadAdjustments[bus]-=busAdjustment;}
  }
  if(capture){capture.model=working;capture.adjustmentsMw=loadAdjustments;capture.iterations=iterations;}
  return last?{...last,activeBalanceIterations:iterations,activeBalanceMismatchMw:mismatch,activeBalanceLoadAdjustmentsMw:Array.from(loadAdjustments),warnings:[...(last.warnings||[]),'DISTRIBUTED_ACTIVE_BALANCE_NOT_CONVERGED',...(eligibleLoadsExhausted?['DISTRIBUTED_ACTIVE_BALANCE_ELIGIBLE_LOADS_EXHAUSTED']:[])]}:solveNR(model,progress,{...options,settings});
}

/** Q-control trials keep the initially balanced P specification; only the final loss change is corrected. */
export function finalizeActiveBalanceAfterControls(model:NumericModel,initial:PowerFlowResult,capture:ActiveBalanceCapture,progress:((stage:string,detail?:Record<string,number>)=>void)|undefined,settings:FullAcSettings|undefined,options:Parameters<typeof solveNR>[2]={}):PowerFlowResult{
  const weights=model.activeBalanceParticipation;
  if(settings?.activeBalancingMode!=='DISTRIBUTED_ADJUSTABLE_LOADS'||model.activeBalanceEligibilityComplete!==true||!weights||!weights.some(value=>value>0)||!initial.converged||!initial.P)return initial;
  const adjustments=Float64Array.from(capture.adjustmentsMw??new Float64Array(model.n)),totalLoad=Array.from(model.activeBalanceEligibleLoadMw||[]).reduce((sum,value)=>sum+value,0),targetP=model.referencePMw??0,toleranceMw=settings.nodalToleranceKva/1000,maxCorrections=settings.maxFinalActiveBalanceCorrections??defaultAnalysisSettings().powerFlow.maxFinalActiveBalanceCorrections;
  const referenceMismatch=(result:PowerFlowResult,operatingModel:NumericModel=model)=>result.P![model.slack]-(operatingModel.pSpec[model.slack]-targetP)-targetP;
  let result=initial,mismatch=referenceMismatch(result),corrections=0,lastFailure:string|null=null;
  while(Math.abs(mismatch)>toleranceMw&&corrections<maxCorrections){
    const remaining=Math.max(0,totalLoad+adjustments.reduce((sum,value)=>sum+value,0)),change=mismatch>0?Math.min(mismatch,remaining):mismatch;
    if(Math.abs(change)<=toleranceMw)break;
    let accepted=false;
    for(const fraction of [1,.5,.25,.125]){
      const step=change*fraction,trial=cloneModel(model);
      for(let bus=0;bus<trial.n;bus++)trial.pSpec[bus]+=(weights[bus]||0)*step;
      // Resolve each P trial more tightly than the outer P gate, as for Q-control trials.
      const solved=solveNR(trial,progress,{...options,initialVm:result.Vm,initialVa:result.Va,initialLimitedBuses:result.pvToPq,settings:{...settings,nodalToleranceKva:Math.min(settings.nodalToleranceKva,.1)}});
      if(!solved.converged||!solved.P){lastFailure=solved.status;continue;}
      const nextMismatch=referenceMismatch(solved,trial);
      if(Math.abs(nextMismatch)>=Math.abs(mismatch)){lastFailure='NO_ACTIVE_BALANCE_PROGRESS';continue;}
      model.pSpec.set(trial.pSpec);for(let bus=0;bus<model.n;bus++)adjustments[bus]-=(weights[bus]||0)*step;
      result=solved;corrections++;mismatch=nextMismatch;accepted=true;break;
    }
    if(!accepted)break;
    progress?.('ACTIVE_BALANCE_ITERATION',{round:(capture.iterations??0)+corrections,externalGridPMw:targetP+mismatch,mismatchMw:mismatch});
  }
  const warnings=Math.abs(mismatch)>toleranceMw?[...(result.warnings||[]),'DISTRIBUTED_ACTIVE_BALANCE_NOT_CONVERGED',...(lastFailure?[`ACTIVE_BALANCE_FINAL_CORRECTION_FAILED:${lastFailure}`]:[])]:result.warnings;
  return{...result,activeBalanceIterations:(capture.iterations??0)+corrections,activeBalanceMismatchMw:mismatch,activeBalanceLoadAdjustmentsMw:Array.from(adjustments),warnings};
}

function runIntegratedStationControls(part:PreparedModel,controls:Control[],rows:ControlDiagnostic[],times:ControlTimings,progress?:(stage:string,detail?:Record<string,number>)=>void,settings?:FullAcSettings):ControlledIslandV73 {
  const base=part.model,Y=buildY(base),equationTolerance=(settings?.modelEquationTolerancePercent??.01)/100,maxOuterIterations=Math.min(settings?.maxOuterIterations??4,stationControlCorrectionLimit(settings)),initialBalance:ActiveBalanceCapture={},baseStart=now(),baseline=solveNRWithActiveBalance(base,progress,settings,{admittance:Y,workCounters:times},initialBalance);times.baseNrMs=now()-baseStart;
  if(!baseline.converged){for(const c of controls){c.row.status='CONTROL_SOLVE_FAILED';c.row.controlSolveFailure=`BASELINE_${baseline.status}`;}return{prepared:part,result:baseline,controllers:rows,outerRounds:0,unitOverrides:new Map(),timings:times,resultProvenance:'BASELINE_FALLBACK',integratedControllers:0,controlLimitRestarts:0};}
  const states=controls.map(control=>({control,fixed:new Map<string,number>(),weights:new Map(Object.entries(control.row.participationKi)),initialDqPu:0}));
  for(const state of states)state.control.row.initialVpu=baseline.Vm![state.control.remote];
  // baseline.Q is the solved net bus injection in MVAr, as is model.qSpec.
  // Preserve fixed load and other injections by allocating only the difference
  // from the original net specification among the station-owned generators.
  const operatingModel=cloneModel(initialBalance.model??base);
  for(const state of states){const c=state.control;let unallocated=0;
    for(const bus of c.row.actuatorBuses){const local=c.units.filter(unit=>unit.bus===bus),delta=baseline.Q![bus]-base.qSpec[bus],allocation=allocateReactiveDelta(local,delta,c.sourceWeights);
      for(const unit of local)unit.qMvar=allocation.qByUnit.get(unit.id)!;
      unallocated+=Math.abs(allocation.remainingDelta);operatingModel.qSpec[bus]=baseline.Q![bus];
    }
    c.row.initialQ=c.units.reduce((sum,unit)=>sum+unit.qMvar,0);c.row.ownershipUnallocatedMvar=unallocated;
  }
  let previous=baseline,model=cloneModel(operatingModel),restarts=0,integrated=0;
  while(true){
    model=cloneModel(operatingModel);const active:typeof states=[],specs:IntegratedStationControl[]=[];
    for(const state of states){const c=state.control;for(const bus of c.row.actuatorBuses){model.busType[bus]=0;model.qMinNet[bus]=null;model.qMaxNet[bus]=null;}
      model.busType[c.remote]=0;model.qMinNet[c.remote]=null;model.qMaxNet[c.remote]=null;
      for(const unit of c.units){const fixed=state.fixed.get(unit.id);if(fixed!=null)model.qSpec[unit.bus]+=fixed-unit.qMvar;}
      const actuators=c.units.filter(unit=>!state.fixed.has(unit.id)).map(unit=>({bus:unit.bus,participation:state.weights.get(unit.id)||0})).filter(unit=>unit.participation>0);
      if(actuators.length){active.push(state);specs.push({remoteBus:c.remote,targetVmPu:c.source.vmSet,actuators});}
    }
    if(restarts===0)integrated=specs.length;
    const start=now();let solved=solveNR(model,progress,{initialVm:previous.Vm,initialVa:previous.Va,initialLimitedBuses:previous.pvToPq,initialControlDqPu:active.map(state=>state.initialDqPu),stationControls:specs,admittance:Y,linearFill:specs.length?1:0,busIds:part.buses.map(bus=>bus.id),controlIds:active.map(state=>state.control.row.id),settings,workCounters:times});
    if(restarts===0)times.finalNrMs+=now()-start;else times.controlLimitRestartNrMs+=now()-start;
    if(!solved.converged){for(const state of states){state.control.row.status='CONTROL_SOLVE_FAILED';state.control.row.controlSolveFailure=`${solved.status} iteration=${solved.failure?.iteration??'—'} mismatchMw=${solved.failure?.maxMismatchMw??'—'} stage=${solved.failure?.linearStage??'—'} pivot=${solved.failure?.minPivot??'—'} stepCap=${solved.failure?.lineSearchStepCap??'—'} bestNormRatio=${solved.failure?.lineSearchBestNormRatio??'—'}: ${solved.failure?.message||''}`;}return{prepared:part,result:baseline,controllers:rows,outerRounds:restarts,unitOverrides:new Map(),timings:times,resultProvenance:'BASELINE_FALLBACK',integratedFailure:solved.failure,integratedControllers:0,controlLimitRestarts:restarts};}
    previous=solved;let anyControllerChanged=false;
    for(let index=0;index<active.length;index++){const state=active[index],c=state.control,dqPu=solved.controlDqPu?.[index]??0,dqMvar=dqPu*base.baseMVA;state.initialDqPu=dqPu;
      let controllerChanged=false;
      for(const unit of c.units){if(state.fixed.has(unit.id))continue;const q=unit.qMvar+(state.weights.get(unit.id)||0)*dqMvar;
        if(q<unit.qMin-1e-4||q>unit.qMax+1e-4){const limit=q<unit.qMin?unit.qMin:unit.qMax;state.fixed.set(unit.id,limit);state.initialDqPu-=(limit-unit.qMvar)/base.baseMVA;controllerChanged=true;}}
      if(controllerChanged){anyControllerChanged=true;const eligible=c.units.filter(unit=>!state.fixed.has(unit.id)),total=eligible.reduce((sum,unit)=>sum+(c.row.participationKi[unit.id]||0),0);
        state.weights=total>EPS?new Map(eligible.map(unit=>[unit.id,(c.row.participationKi[unit.id]||0)/total])):new Map();
        if(!state.weights.size){const limits=[...state.fixed].map(([id,q])=>({unit:c.units.find(unit=>unit.id===id)!,q}));c.row.status=limits.length&&limits.every(({unit,q})=>q===unit.qMax)?'SATURATED_QMAX':limits.length&&limits.every(({unit,q})=>q===unit.qMin)?'SATURATED_QMIN':'NO_REACTIVE_HEADROOM';}
      }
    }
    if(!anyControllerChanged){const overrides=new Map<string,{qMvar:number|null;qState:string}>();let activeIndex=0;
      const finalBalanceStart=now();solved=finalizeActiveBalanceAfterControls(model,solved,initialBalance,progress,settings,{admittance:Y,linearFill:1,stationControls:specs,initialControlDqPu:solved.controlDqPu,workCounters:times});times.finalNrMs+=now()-finalBalanceStart;times.finalBalanceCorrections=Math.max(0,(solved.activeBalanceIterations??0)-(initialBalance.iterations??0));
      for(const state of states){const c=state.control,hasActive=state.weights.size>0,dqMvar=hasActive?(solved.controlDqPu?.[activeIndex++]??0)*base.baseMVA:0;
        if(hasActive)c.row.status=Math.abs(c.source.vmSet-solved.Vm![c.remote])<=equationTolerance?'SATISFIED':'CONTROL_SOLVE_FAILED';
        c.row.finalVpu=solved.Vm![c.remote];c.row.voltageResidualPu=c.source.vmSet-solved.Vm![c.remote];c.row.finalQ=0;c.row.jacobianDimension=solved.linear?model.n-1+Array.from(model.busType).filter(type=>type===0).length:null;c.row.linearMethod=solved.linear?.method??null;c.row.linearIterations=solved.linear?.iterations??null;c.row.linearResidual=solved.linear?.residual??null;c.row.participationKi=Object.fromEntries(state.weights);
        for(const unit of c.units){const q=state.fixed.get(unit.id)??unit.qMvar+(state.weights.get(unit.id)||0)*dqMvar;c.row.finalQ+=q;overrides.set(unit.id,{qMvar:q,qState:c.row.status});}
      }
      return{prepared:{...part,model,stationControlUnitResults:overrides},result:solved,controllers:rows,outerRounds:restarts,unitOverrides:overrides,timings:times,resultProvenance:'INTEGRATED_STATION_CONTROL',integratedControllers:integrated,controlLimitRestarts:restarts};
    }
    if(restarts>=maxOuterIterations){for(const state of states){state.control.row.status='CONTROL_SOLVE_FAILED';state.control.row.controlSolveFailure='CONTROL_LIMIT_MAX_ROUNDS';}return{prepared:part,result:baseline,controllers:rows,outerRounds:restarts,unitOverrides:new Map(),timings:times,resultProvenance:'BASELINE_FALLBACK',integratedControllers:0,controlLimitRestarts:restarts};}
    restarts++;progress?.('STATION_CONTROL_LIMIT',{round:restarts});
  }
}

function runIntegratedStationControlsV2(part:PreparedModel,controls:Control[],rows:ControlDiagnostic[],times:ControlTimings,progress?:(stage:string,detail?:Record<string,number>)=>void,settings?:FullAcSettings):ControlledIslandV73 {
  const base=part.model,Y=buildY(base),start=now(),baseline=solveNR(base,progress,{admittance:Y,settings,workCounters:times});times.baseNrMs=now()-start;
  if(!baseline.converged||!baseline.Q){for(const c of controls){c.row.status='CONTROL_SOLVE_FAILED';c.row.controlSolveFailure=`BASELINE_${baseline.status}`;}return{prepared:part,result:baseline,controllers:rows,outerRounds:0,unitOverrides:new Map(),timings:times,resultProvenance:'BASELINE_FALLBACK'};}
  type State={control:Control;fixed:Map<string,number>;weights:Map<string,number>;releaseCount:Map<string,number>};
  const states:State[]=controls.map(control=>({control,fixed:new Map(),weights:new Map(),releaseCount:new Map()})),working=cloneModel(base);
  for(const state of states){const c=state.control;c.row.initialVpu=baseline.Vm![c.remote];let unallocated=0;
    // Station equations are anchored at immutable qgini dispatch. The local-PV
    // solution is used only as a voltage/angle warm start.
    c.row.initialQ=c.units.reduce((sum,unit)=>sum+unit.qMvar,0);c.row.ownershipUnallocatedMvar=unallocated;
    for(const unit of c.units){const feasibleQ=Math.max(unit.qMin,Math.min(unit.qMax,unit.qMvar));
      if(feasibleQ!==unit.qMvar){working.qSpec[unit.bus]+=feasibleQ-unit.qMvar;unit.qMvar=feasibleQ;}
      if(unit.qMax-unit.qMin<1e-8||unit.qMvar<=unit.qMin+1e-5||unit.qMvar>=unit.qMax-1e-5)state.fixed.set(unit.id,unit.qMvar);
    }
  }
  let previous=baseline,solved=baseline,integrated=0;
  const maxRestarts=128;
  const equationTolerance=(settings?.modelEquationTolerancePercent??.2)/100;
  for(let restart=0;restart<=maxRestarts;restart++){
    const model=cloneModel(working),active:State[]=[],specs:IntegratedStationControl[]=[];
    for(const state of states){const c=state.control;
      for(const bus of c.row.actuatorBuses){model.busType[bus]=0;model.qMinNet[bus]=null;model.qMaxNet[bus]=null;}
      model.busType[c.remote]=0;model.qMinNet[c.remote]=null;model.qMaxNet[c.remote]=null;
      const free=c.units.filter(unit=>!state.fixed.has(unit.id)),weightSum=free.reduce((sum,unit)=>sum+(c.sourceWeights?.get(unit.id)??0),0);
      state.weights=weightSum>EPS?new Map(free.map(unit=>[unit.id,(c.sourceWeights?.get(unit.id)??0)/weightSum])):new Map();
      if(state.weights.size){
        const actuators=free.map(unit=>({bus:unit.bus,participation:state.weights.get(unit.id)??0})).filter(row=>row.participation>0);
        const minDqPu=Math.max(...free.map(unit=>(unit.qMin-unit.qMvar)/(state.weights.get(unit.id)??1)))/base.baseMVA;
        const maxDqPu=Math.min(...free.map(unit=>(unit.qMax-unit.qMvar)/(state.weights.get(unit.id)??1)))/base.baseMVA;
        active.push(state);specs.push({id:c.row.id,remoteBus:c.remote,targetVmPu:c.source.vmSet,droopQmvar:c.droopQ??undefined,measurementQmvar:c.droopQ?c.units[0].qMvar:undefined,measurementParticipation:c.droopQ?1:undefined,actuators,minDqPu,maxDqPu});
      }
    }
    if(restart===0)integrated=specs.length;
    const solveStart=now();solved=solveNR(model,progress,{admittance:Y,stationControls:specs,integratedEquations:true,integratedActiveBalance:settings?.activeBalancingMode==='DISTRIBUTED_ADJUSTABLE_LOADS',initialVm:previous.Vm,initialVa:previous.Va,initialLimitedBuses:previous.pvToPq,initialControlDqPu:new Float64Array(specs.length),initialAlphaMw:previous.alphaMw??0,settings:{...settings,nodalToleranceKva:Math.min(settings?.nodalToleranceKva??5,.1)},busIds:part.buses.map(bus=>bus.id),controlIds:active.map(state=>state.control.row.id),workCounters:times});
    if(restart===0)times.finalNrMs+=now()-solveStart;else times.controlLimitRestartNrMs+=now()-solveStart;
    const boundHit=solved.status==='CONTROL_BOUND_HIT'&&solved.boundControlIndex!=null;
    if(!solved.converged&&!boundHit){for(const c of controls){c.row.status='CONTROL_SOLVE_FAILED';c.row.controlSolveFailure=`${solved.status}: ${solved.failure?.message??''}`;}return{prepared:part,result:solved,controllers:rows,outerRounds:restart,unitOverrides:new Map(),timings:times,resultProvenance:'BASELINE_FALLBACK',integratedFailure:solved.failure,integratedControllers:integrated,controlLimitRestarts:restart};}
    let changed=boundHit,activeIndex=0;
    for(const state of states){const c=state.control,hasFree=state.weights.size>0,dqMvar=hasFree?(solved.controlDqPu?.[activeIndex++]??0)*base.baseMVA:0;
      // Recenter at each solved state. The next restart starts at dQ=0 and the
      // same physical Q/V/angle state; only membership changes.
      for(const unit of c.units){if(state.fixed.has(unit.id))continue;
        const requested=unit.qMvar+(state.weights.get(unit.id)??0)*dqMvar,q=Math.max(unit.qMin,Math.min(unit.qMax,requested));
        working.qSpec[unit.bus]+=q-unit.qMvar;unit.qMvar=q;
        if(Math.abs(requested-q)>1e-5||boundHit&&activeIndex-1===solved.boundControlIndex&&(q<=unit.qMin+1e-5||q>=unit.qMax-1e-5)){state.fixed.set(unit.id,q);changed=true;}
      }
      const sourceDelta=c.units.reduce((sum,unit)=>sum+unit.qMvar-(unit.qDispatchMvar??unit.qMvar),0);
      const residual=c.source.vmSet+(c.droopQ?c.units[0].qMvar/c.droopQ:0)-solved.Vm![c.remote];
      const direction=hasFree?Math.sign(sourceDelta):Math.sign(residual);
      if(!boundHit&&Math.abs(direction)>0&&Math.abs(hasFree?sourceDelta:residual)>1e-4){
        for(const unit of c.units){const limit=state.fixed.get(unit.id);if(limit==null||unit.qMax-unit.qMin<1e-8||(state.releaseCount.get(unit.id)??0)>=2)continue;
          if(direction>0&&Math.abs(limit-unit.qMin)<1e-7||direction<0&&Math.abs(limit-unit.qMax)<1e-7){state.fixed.delete(unit.id);state.releaseCount.set(unit.id,(state.releaseCount.get(unit.id)??0)+1);changed=true;}
        }
      }
    }
    previous=solved;
    progress?.('STATION_CONTROL_LIMIT',{round:restart+1,active:active.length,changed:changed?1:0});
    if(changed){if(restart<maxRestarts)continue;for(const c of controls){c.row.status='CONTROL_SOLVE_FAILED';c.row.controlSolveFailure='CONTROL_LIMIT_MAX_ROUNDS';}return{prepared:part,result:solved,controllers:rows,outerRounds:restart+1,unitOverrides:new Map(),timings:times,resultProvenance:'BASELINE_FALLBACK',integratedControllers:integrated,controlLimitRestarts:restart+1};}
    const overrides=new Map<string,{qMvar:number|null;qState:string}>(part.stationControlUnitResults);
    for(const state of states){const c=state.control,qTotal=c.units.reduce((sum,unit)=>sum+unit.qMvar,0),residual=c.source.vmSet+(c.droopQ?qTotal/c.droopQ:0)-solved.Vm![c.remote],allFixed=state.fixed.size===c.units.length;
      c.row.status=allFixed?(Math.abs(qTotal-(c.row.qMin??Infinity))<.001?'SATURATED_QMIN':Math.abs(qTotal-(c.row.qMax??Infinity))<.001?'SATURATED_QMAX':'NO_REACTIVE_HEADROOM'):Math.abs(residual)<=equationTolerance?'SATISFIED':'CONTROL_SOLVE_FAILED';
      c.row.finalVpu=solved.Vm![c.remote];c.row.voltageResidualPu=residual;c.row.finalQ=qTotal;c.row.outerRounds=restart;c.row.jacobianDimension=model.n-1+Array.from(model.busType).filter(type=>type===0).length+specs.length+(solved.activeBalanceIterations?1:0);c.row.linearMethod=solved.linear?.method??null;c.row.linearIterations=solved.linear?.iterations??null;c.row.linearResidual=solved.linear?.residual??null;c.row.participationKi=Object.fromEntries(state.weights);
      for(const unit of c.units)overrides.set(unit.id,{qMvar:unit.qMvar,qState:Math.abs(unit.qMvar-unit.qMin)<.001?'QMIN_LIMITED':Math.abs(unit.qMvar-unit.qMax)<.001?'QMAX_LIMITED':c.row.status});
    }
    const finalModel=cloneModel(working);
    return{prepared:{...part,model:finalModel,stationControlUnitResults:overrides},result:solved,controllers:rows,outerRounds:restart,unitOverrides:overrides,timings:times,resultProvenance:'INTEGRATED_STATION_CONTROL',integratedControllers:integrated,controlLimitRestarts:restart};
  }
  throw Error('INTEGRATED_ACTIVE_SET_UNREACHABLE');
}

export function runStationControlledIslandV73(network:CanonicalNetwork,part:PreparedModel,mappings:readonly Mapping[],mode:StationControlMode='zeroDroop',progress?:(stage:string,detail?:Record<string,number>)=>void,implementation:StationControlImplementation='SENSITIVITY',settings?:FullAcSettings):ControlledIslandV73 {
  const equationTolerance=(settings?.modelEquationTolerancePercent??.01)/100,maxOuterIterations=Math.min(settings?.maxOuterIterations??4,stationControlCorrectionLimit(settings));
  const times:ControlTimings={baseNrMs:0,controllerClassificationMs:0,jacobianBuildMs:0,rcmReorderMs:0,ilu1FactorMs:0,ilu2FactorMs:0,iluFactorMs:0,sensitivityIterativeSolveMs:0,cscConversionMs:0,symbolicFactorMs:0,numericFactorMs:0,directRhsSolveMs:0,sensitivitySolveMs:0,classificationNrMs:0,outerTrialNrMs:0,finalNrMs:0,controlLimitRestartNrMs:0,fullNrSolves:0,totalNewtonIterations:0,kluNewtonFactorizations:0,finalBalanceCorrections:0};
  const started=now(),byId=new Map(mappings.map(row=>[row.id,row])),generators=new Map(part.generators.map(g=>[g.id,g]));
  const all=network.stationControllers.filter(c=>c.inService),island=all.filter(c=>byId.get(c.id)?.islandId===part.islandId),zeroUnitOwners=new Map<string,number>(),allUnitOwners=new Map<string,number>(),zeroBusOwners=new Map<number,number>(),allBusOwners=new Map<number,number>();
  for(const c of all)for(const id of c.unitIds){allUnitOwners.set(id,(allUnitOwners.get(id)||0)+1);if(c.droopModeRaw===0)zeroUnitOwners.set(id,(zeroUnitOwners.get(id)||0)+1);}
  for(const c of island){const buses=new Set(c.unitIds.map(id=>generators.get(id)?.index).filter((i):i is number=>i!=null));for(const bus of buses){allBusOwners.set(bus,(allBusOwners.get(bus)||0)+1);if(c.droopModeRaw===0)zeroBusOwners.set(bus,(zeroBusOwners.get(bus)||0)+1);}}
  const rows:ControlDiagnostic[]=[],controls:Control[]=[];
  for(const c of island){const remote=byId.get(c.id)?.solverBusIndex??null,active=c.unitIds.map(id=>generators.get(id)).filter((g):g is NonNullable<typeof g>=>!!g&&g.inService),buses=[...new Set(active.map(g=>g.index))],units=active.map(g=>({id:g.id,bus:g.index,pMw:g.pDispatchMw??g.pMw,qMvar:g.qDispatchMvar??g.qMvar,qDispatchMvar:g.qDispatchMvar??g.qMvar,qMin:g.qMin??-Infinity,qMax:g.qMax??Infinity})),cvqq=c.qParticipationRaw?active.map(g=>c.qParticipationRaw![c.unitIds.indexOf(g.id)]??null):undefined,weights=stationParticipation(units,cvqq),droop=c.droopModeRaw===1;
    const qMin=active.length&&active.every(g=>finite(g.qMin))?active.reduce((s,g)=>s+g.qMin!,0):null,qMax=active.length&&active.every(g=>finite(g.qMax))?active.reduce((s,g)=>s+g.qMax!,0):null,qInitial=active.length?active.reduce((s,g)=>s+g.qMvar,0):null;
    let status:ControlStatus='PENDING';
    if(mode==='off')status='BASELINE_LOCAL_PV';
    else if(remote==null)status='REMOTE_BUS_UNRESOLVED';
    else if(c.modeSemantics==='UNSUPPORTED'||(c.controlModeRaw!=null&&c.controlModeRaw!==0)||(c.selectedBusModeRaw!=null&&c.selectedBusModeRaw!==0)||(c.distributionModeRaw!=null&&c.distributionModeRaw!==0)||(c.qOrientationRaw!=null&&c.qOrientationRaw!==0)||(c.qSetpointRaw!=null&&c.qSetpointRaw!==0))status='UNSUPPORTED_PROFILE';
    else if(c.droopModeRaw!==0&&c.droopModeRaw!==1)status='UNSUPPORTED_PROFILE';
    else if(droop&&mode!=='droop')status='UNSUPPORTED_DROOP';
    else if(!active.length)status='NO_REACTIVE_HEADROOM';
    else if(new Set(c.unitIds).size!==c.unitIds.length||active.some(g=>((droop?allUnitOwners:zeroUnitOwners).get(g.id)||0)>1||((droop?allBusOwners:zeroBusOwners).get(g.index)||0)>1))status='UNSUPPORTED_DISTRIBUTION';
    else if(!finite(c.vmSet)||c.vmSet<.5||c.vmSet>1.5)status='UNSUPPORTED_PROFILE';
    else if(qMin!=null&&qMax!=null&&qMin>qMax)status='Q_LIMITS_UNAVAILABLE';
    else if(droop&&(!c.measurementSelfCubicle||active.length!==1||active[0].sourceClass!=='ElmGenStat'||!finite(c.ratedPowerRaw)||c.ratedPowerRaw<=0||!finite(c.droopValueRaw)||Math.abs(c.droopValueRaw)<EPS))status='UNSUPPORTED_DROOP';
    else if(!weights)status='UNSUPPORTED_DISTRIBUTION';
    else if(remote===part.model.slack||buses.some(bus=>bus===part.model.slack||part.generators.some(g=>g.index===bus&&g.voltageControl&&!c.unitIds.includes(g.id)))||part.generators.some(g=>g.index===remote&&g.voltageControl&&!c.unitIds.includes(g.id)))status='LOCAL_PV_CONFLICT';
    else if(qMin!=null&&qMax!=null&&qMax-qMin<EPS)status='NO_REACTIVE_HEADROOM';
    const row:ControlDiagnostic={id:c.id,controllerId:c.id,remoteBus:c.remoteBus,islandId:part.islandId??null,targetVpu:c.vmSet,initialVpu:null,finalVpu:null,voltageResidualPu:null,initialQ:qInitial,finalQ:qInitial,qMin,qMax,outerRounds:0,status,supported:status==='PENDING',unitIds:active.map(g=>g.id),actuatorBus:buses.length===1?buses[0]:null,actuatorBuses:buses,remoteBusIndex:remote,participationKi:Object.fromEntries(weights?.weights||[]),qDistributionSource:weights?.source??null,jacobianDimension:null,linearMethod:null,linearIterations:null,linearResidual:null,iluMinimumPivot:null,effectiveSlope:null,individualDvDqi:{},elapsedSensitivityMs:null,failureReason:null};rows.push(row);
    if(status==='PENDING'&&remote!=null)controls.push({source:c,row,units,remote,droopQ:droop?c.ratedPowerRaw!*100/c.droopValueRaw!:null,sourceWeights:weights?.weights});
  }
  times.controllerClassificationMs=now()-started;
  const fixedLimitRows=rows.filter(row=>row.status==='NO_REACTIVE_HEADROOM'&&row.unitIds.length===1&&row.qMin!=null&&row.qMin===row.qMax);
  if(fixedLimitRows.length){const fixedModel=cloneModel(part.model),fixedOverrides=new Map(part.stationControlUnitResults);
    for(const row of fixedLimitRows){const unit=part.generators.find(g=>g.id===row.unitIds[0])!;fixedModel.qSpec[unit.index]+=row.qMin!-unit.qMvar;fixedModel.busType[unit.index]=0;fixedModel.qMinNet[unit.index]=null;fixedModel.qMaxNet[unit.index]=null;fixedOverrides.set(unit.id,{qMvar:row.qMin!,qState:row.status});row.finalQ=row.qMin;}
    part={...part,model:fixedModel,stationControlUnitResults:fixedOverrides};
  }
  if((mode==='zeroDroop'||mode==='droop')&&controls.length&&implementation==='INTEGRATED')return runIntegratedStationControlsV2(part,controls,rows,times,progress,settings);
  if(mode==='zeroDroop'&&controls.length&&implementation==='INTEGRATED_EXPERIMENTAL')return runIntegratedStationControls(part,controls,rows,times,progress,settings);
  const solve=(model:NumericModel,warm?:PowerFlowResult,Y?:AdmittanceMatrix,layouts?:Map<string,JacobianLayout>,trial=false)=>solveNR(model,progress,{initialVm:warm?.Vm,initialVa:warm?.Va,initialLimitedBuses:warm?.pvToPq,admittance:Y,layoutCache:layouts,linearFill:model===part.model?0:1,settings:trial?{...settings,nodalToleranceKva:Math.min(settings?.nodalToleranceKva??5,.1)}:settings,workCounters:times});
  if(mode==='off'||!controls.length){const t=now(),result=solveNRWithActiveBalance(part.model,progress,settings,{workCounters:times});times.baseNrMs=now()-t;return{prepared:part,result,controllers:rows,outerRounds:0,unitOverrides:new Map(),timings:times,resultProvenance:'LOCAL_PV'};}
  const model=cloneModel(part.model),Y=buildY(model),layouts=new Map<string,JacobianLayout>();
  const applyOwnership=(c:Control)=>{for(const bus of c.row.actuatorBuses){model.busType[bus]=0;model.qMinNet[bus]=null;model.qMaxNet[bus]=null;}};
  const restoreOwnership=(c:Control)=>{for(const bus of c.row.actuatorBuses){model.busType[bus]=part.model.busType[bus];model.qMinNet[bus]=part.model.qMinNet[bus];model.qMaxNet[bus]=part.model.qMaxNet[bus];}for(const unit of c.units){model.qSpec[unit.bus]+=part.generators.find(g=>g.id===unit.id)!.qMvar-unit.qMvar;unit.qMvar=part.generators.find(g=>g.id===unit.id)!.qMvar;}};
  for(const c of controls)applyOwnership(c);
  const initialBalance:ActiveBalanceCapture={},baseStart=now(),baseline=solveNRWithActiveBalance(part.model,progress,settings,{admittance:Y,workCounters:times},initialBalance);times.baseNrMs=now()-baseStart;
  if(initialBalance.model)model.pSpec.set(initialBalance.model.pSpec);
  if(baseline.converged)for(const limited of baseline.pvToPq||[])if(model.busType[limited.bus]===1){model.busType[limited.bus]=0;model.qSpec[limited.bus]=limited.qLimit;model.qMinNet[limited.bus]=null;model.qMaxNet[limited.bus]=null;}
  // Transfer ownership at the solved local-PV operating point. This leaves the first
  // PQ solve at the same physical Q state instead of resetting 158 buses to raw Q.
  if(mode!=='ownership'&&baseline.converged&&baseline.Q)for(const c of controls){
    const desiredDelta=c.row.actuatorBuses.reduce((sum,bus)=>sum+baseline.Q![bus]-model.qSpec[bus],0);
    const allocation=allocateReactiveDelta(c.units,desiredDelta,c.sourceWeights);
    for(const unit of c.units){const next=allocation.qByUnit.get(unit.id)!;model.qSpec[unit.bus]+=next-unit.qMvar;unit.qMvar=next;}
    c.row.initialQ=c.units.reduce((sum,u)=>sum+u.qMvar,0);c.row.ownershipUnallocatedMvar=Math.abs(allocation.remainingDelta);
  }
  const firstStart=now();let solved=solve(model,baseline.converged?baseline:undefined,Y,layouts);times.finalNrMs=now()-firstStart;
  if(!solved.converged){for(const c of controls){c.row.status='CONTROL_SOLVE_FAILED';c.row.controlSolveFailure=`${solved.status}: ${solved.failure?.message||''}`;}return{prepared:part,result:baseline,controllers:rows,outerRounds:0,unitOverrides:new Map(),timings:times,resultProvenance:'BASELINE_FALLBACK'};}
  for(const c of controls)c.row.initialVpu=solved.Vm![c.remote];
  if(mode==='ownership'){for(const c of controls)c.row.status='OWNERSHIP_ONLY';return{prepared:{...part,model},result:solved,controllers:rows,outerRounds:0,unitOverrides:new Map(),timings:times,resultProvenance:'OWNERSHIP'};}
  const target=(c:Control)=>c.droopQ==null?c.source.vmSet:droopTarget(c.source.vmSet,c.units[0].qMvar,c.source.ratedPowerRaw!,c.source.droopValueRaw!);
  const residual=(c:Control,r:PowerFlowResult)=>target(c)-r.Vm![c.remote];
  const pending=()=>controls.filter(c=>c.row.status==='PENDING');
  let sensitivityByRemote=new Map<Control,Map<number,number>|null>();const sensitivitySolverDiagnostics:SensitivitySolverDiagnostic[]=[];
  const probe=(active:Control[])=>{const batch=probeAdjointSensitivities(model,solved,active.map(c=>({remoteBus:c.remote,actuators:c.units.map(u=>({bus:u.bus,weight:c.row.participationKi[u.id]||0}))})),Y);times.jacobianBuildMs+=batch.jacobianBuildMs;times.rcmReorderMs+=batch.orderingMs??0;times.ilu1FactorMs+=batch.ilu1FactorMs??0;times.ilu2FactorMs+=batch.ilu2FactorMs??0;times.iluFactorMs+=batch.iluFactorMs;times.sensitivityIterativeSolveMs+=batch.iterativeSolveMs??0;times.cscConversionMs+=batch.cscConversionMs??0;times.symbolicFactorMs+=batch.symbolicFactorMs??0;times.numericFactorMs+=batch.numericFactorMs??0;times.directRhsSolveMs+=batch.directSolveMs??0;times.sensitivitySolveMs+=batch.sensitivitySolveMs;sensitivitySolverDiagnostics.push(batch.solverDiagnostics);sensitivityByRemote=new Map();
    active.forEach((c,i)=>{const p:SensitivityProbe=batch.probes[i];sensitivityByRemote.set(c,batch.busSensitivityByRemote[i]);Object.assign(c.row,{jacobianDimension:p.jacobianDimension,linearMethod:p.linearMethod,linearIterations:p.linearIterations,linearResidual:p.linearResidual,iluMinimumPivot:p.iluMinPivot,effectiveSlope:p.slope,individualDvDqi:Object.fromEntries(c.units.map((u,j)=>[u.id,p.individualSlopes[j]])),elapsedSensitivityMs:p.elapsedMs,failureReason:p.reason});});return batch.probes;};
  const classification=classifyMonotoneActiveSet(controls,
    active=>{let probes:SensitivityProbe[];try{probes=probe([...active]);}catch{probes=active.map(()=>({reason:'SENSITIVITY_LINEAR_SOLVE_FAILED' as const,slope:null,individualSlopes:[],jacobianDimension:0,linearMethod:null,linearIterations:null,linearResidual:null,iluMinPivot:null,elapsedMs:0}));}
      return active.filter((control,index)=>{const reason=probes[index].reason;if(!reason)return false;control.row.failureReason=reason;return true;});},
    failed=>{for(const control of failed){control.row.status='ROLLED_BACK_TO_LOCAL_PV';restoreOwnership(control);}const t=now();solved=solve(model,solved,Y,layouts);times.classificationNrMs+=now()-t;return solved.converged;});
  if(!classification.stable&&solved.converged){for(const control of classification.active){control.row.status='CONTROL_SOLVE_FAILED';control.row.failureReason='SENSITIVITY_RECLASSIFICATION_LIMIT';}return{prepared:part,result:baseline,controllers:rows,outerRounds:0,unitOverrides:new Map(),timings:times,resultProvenance:'BASELINE_FALLBACK',sensitivitySolverDiagnostics,classificationPasses:classification.passes,classificationStable:false};}
  if(!solved.converged){for(const c of pending()){c.row.status='ROLLED_BACK_TO_LOCAL_PV';c.row.failureReason='SENSITIVITY_LINEAR_SOLVE_FAILED';}return{prepared:part,result:baseline,controllers:rows,outerRounds:0,unitOverrides:new Map(),timings:times,resultProvenance:'BASELINE_FALLBACK',sensitivitySolverDiagnostics,classificationPasses:classification.passes,classificationStable:false};}
  let rounds=0,trustFraction=.25,controlCycles=0,failedRefreshes=0,activeSubset:Set<Control>|null=null,stagnatedSubsetCount=0,qLimitSignature=JSON.stringify((solved.pvToPq||[]).map(row=>[row.bus,row.qLimit]).sort((a,b)=>a[0]-b[0]));const coupledSystems:CoupledSystemDiagnostic[]=[],trialAttempts:ControllerTrialDiagnostic[]=[],seenTrialSignatures=new Set<string>();
  const controlScale=(c:Control)=>Math.max(1,c.row.qMax!-c.row.qMin!);
  const buildMatrix=(rows:Control[],cols:Control[],directions:Map<Control,1|-1|null>)=>rows.map(output=>cols.map(input=>{const busSensitivity=sensitivityByRemote.get(output);if(!busSensitivity)return null;const direction=directions.get(input),weights=direction==null?(input.sourceWeights??dispatchedPWeights(input.units)):activeParticipation(input.units,direction,input.sourceWeights);if(!weights)return 0;let value=0;for(const unit of input.units)value+=(weights.get(unit.id)||0)*(busSensitivity.get(unit.bus)||0);if(output===input&&output.droopQ!=null)value-=1/output.droopQ;return finite(value)?value:null;}));
  const norm=(rows:Control[],result:PowerFlowResult)=>rows.length?Math.sqrt(rows.reduce((sum,c)=>sum+residual(c,result)**2,0)/rows.length):0;
  const refresh=(active:Control[])=>{let probes:SensitivityProbe[];try{probes=probe(active);}catch{probes=active.map(()=>({reason:'SENSITIVITY_LINEAR_SOLVE_FAILED' as const,slope:null,individualSlopes:[],jacobianDimension:0,linearMethod:null,linearIterations:null,linearResidual:null,iluMinPivot:null,elapsedMs:0}));}
    let changed=false;active.forEach((c,i)=>{const p=probes[i];if(p.reason){c.row.status='ROLLED_BACK_TO_LOCAL_PV';c.row.failureReason=p.reason;restoreOwnership(c);changed=true;}});if(changed){const t=now();solved=solve(model,solved,Y,layouts);times.finalNrMs+=now()-t;if(solved.converged){const survivors=pending();if(survivors.length)probe(survivors);}}return changed;};
  const headroom=(c:Control,delta:number)=>c.units.reduce((sum,u)=>sum+((c.sourceWeights?(c.sourceWeights.get(u.id)??0)>EPS:u.pMw>0)?(delta>0?Math.max(0,u.qMax-u.qMvar):Math.max(0,u.qMvar-u.qMin)):0),0);
  const reactivateMovable=()=>{for(const c of controls){if(!['SATISFIED','SATURATED_QMIN','SATURATED_QMAX'].includes(c.row.status))continue;const error=residual(c,solved);if(Math.abs(error)<=equationTolerance)continue;const direction:1|-1=error>=0?1:-1;if(activeParticipation(c.units,direction,c.sourceWeights))c.row.status='PENDING';}};
  const runFinalBalance=()=>{const t=now();solved=finalizeActiveBalanceAfterControls(model,solved,initialBalance,progress,settings,{admittance:Y,layoutCache:layouts,linearFill:1,workCounters:times});times.finalNrMs+=now()-t;times.finalBalanceCorrections=Math.max(0,(solved.activeBalanceIterations??0)-(initialBalance.iterations??0));};
  const maxCoordinationRounds=Math.min(2,Math.max(0,(settings?.maxOuterIterations??maxOuterIterations+2)-maxOuterIterations));let coordinated=false,roundBudget=maxOuterIterations;
  while(controlCycles<(maxOuterIterations+maxCoordinationRounds)*2){controlCycles++;reactivateMovable();for(const c of pending())if(Math.abs(residual(c,solved))<=equationTolerance)c.row.status='SATISFIED';
    if(!coordinated&&maxCoordinationRounds&&(rounds>=maxOuterIterations||!pending().length)){
      runFinalBalance();coordinated=true;roundBudget=rounds+maxCoordinationRounds;reactivateMovable();
      if(pending().length)probe(pending());
    }
    let active=pending();if(activeSubset){const subset=active.filter(c=>activeSubset!.has(c));if(subset.length)active=subset;else activeSubset=null;}if(!active.length||rounds>=roundBudget)break;
    const unitMoveEffect=(output:Control,input:Control,allocation:ReturnType<typeof allocateReactiveDelta>)=>{const busSensitivity=sensitivityByRemote.get(output);if(!busSensitivity)return 0;let effect=0;for(const unit of input.units)effect+=(busSensitivity.get(unit.bus)||0)*(allocation.qByUnit.get(unit.id)!-unit.qMvar);if(output===input&&output.droopQ!=null)effect-=allocation.appliedDelta/output.droopQ;return effect;};
    const solveDenseDirection=()=>{
      const directions=new Map<Control,1|-1|null>(active.map(c=>{const preferred:1|-1=residual(c,solved)>=0?1:-1;return[c,activeParticipation(c.units,preferred,c.sourceWeights)?preferred:(preferred===1?-1:1)] as const;}));
      const free=active.filter(c=>activeParticipation(c.units,1,c.sourceWeights)||activeParticipation(c.units,-1,c.sourceWeights));
      const rawDeltas=new Map<Control,number>(),fixedMoves=new Map<Control,ReactiveAllocation>();
      if(!free.length)return{rawDeltas,fixedMoves,denseFailed:false,lastDense:null as CoupledSystemDiagnostic|null};
      const preferred=free.map(c=>directions.get(c)! as 1|-1),lower=free.map(c=>-Math.min(controlScale(c)*trustFraction,headroom(c,-1))),upper=free.map(c=>Math.min(controlScale(c)*trustFraction,headroom(c,1)));
      let matrixInvalid=false;
      const direction=solveDirectionConsistentBoundedObjective(active.map(c=>residual(c,solved)),preferred,chosen=>{
        chosen.forEach((value,j)=>directions.set(free[j],value));const matrix=buildMatrix(active,free,directions);matrixInvalid=matrix.some(row=>row.some(value=>value==null));
        return{matrix:matrix as number[][],lower,upper};
      });
      const lastDense:CoupledSystemDiagnostic={conditionEstimate:direction.activeSetPolishConditionEstimate,regularization:direction.activeSetPolishRegularization,activeControllers:free.map(c=>c.row.id),objectiveRows:active.length,freeColumns:free.length,fixedControllers:0,rank:0,solveStatus:'BOUNDED_ITERATIVE',activeControllerCount:active.length,zeroDroopCount:active.filter(c=>c.droopQ==null).length,droopCount:active.filter(c=>c.droopQ!=null).length,boundedSweeps:direction.sweeps,projectedGradientNorm:direction.projectedGradientNorm,relativeProjectedGradient:direction.relativeProjectedGradient,maxControllerAllowedMove:direction.maxControllerAllowedMove,objectiveStart:direction.objectiveStart,objectiveEnd:direction.objectiveEnd,objectiveAtSweeps:direction.objectiveAtSweeps,objectiveRatio:direction.objectiveRatio,interiorVariableCount:direction.interiorVariableCount,atLowerBoundCount:direction.atLowerBoundCount,atUpperBoundCount:direction.atUpperBoundCount,zeroMoveCount:direction.zeroMoveCount,columnNormRatio:direction.columnNormRatio,activeSetPolishIterations:direction.activeSetPolishIterations,activeSetPolishConverged:direction.activeSetPolishConverged,activeSetPolishFreeVariables:direction.activeSetPolishFreeVariables,activeSetPolishDeferredVariables:direction.activeSetPolishDeferredVariables,activeSetPolishConditionEstimate:direction.activeSetPolishConditionEstimate,activeSetPolishRegularization:direction.activeSetPolishRegularization,activeSetPolishRejectedObjectiveIncrease:direction.activeSetPolishRejectedObjectiveIncrease,converged:direction.converged,directionRebuilds:direction.directionRebuilds,directionConsistent:direction.directionConsistent,matrixValid:!matrixInvalid};coupledSystems.push(lastDense);
      if(matrixInvalid||!direction.directionConsistent)return{rawDeltas,fixedMoves,denseFailed:true,lastDense};
      direction.solution.forEach((delta,i)=>rawDeltas.set(free[i],delta));
      return{rawDeltas,fixedMoves,denseFailed:false,lastDense};
    };
    const oldNorm=norm(active,solved);
    const makeProposal=(raw:Map<Control,number>,fixed:Map<Control,ReturnType<typeof allocateReactiveDelta>>,kind:ControllerTrialDiagnostic['proposalKind'])=>{
      const entries=[...raw].filter(([,delta])=>Math.abs(delta)>EPS),bounds=entries.map(([c,delta])=>Math.min(controlScale(c)*trustFraction,headroom(c,delta))),requested=kind==='COUPLED'?entries.map(([,delta],i)=>Math.sign(delta)*Math.min(Math.abs(delta),bounds[i])):scaleCoupledProposal(entries.map(([,delta])=>delta),bounds),freeAllocations=new Map<Control,ReactiveAllocation>();
      entries.forEach(([c],i)=>{if(Math.abs(requested[i])>EPS)freeAllocations.set(c,allocateReactiveDelta(c.units,requested[i],c.sourceWeights));});
      const allocations=mergeControllerAllocations(new Map([...fixed].filter(([,move])=>Math.abs(move.appliedDelta)>EPS)),freeAllocations);
      const predicted=active.map(rowControl=>{let value=residual(rowControl,solved);for(const [columnControl,move]of allocations)value-=unitMoveEffect(rowControl,columnControl,move);return value;}),predictedNorm=Math.sqrt(predicted.reduce((sum,value)=>sum+value*value,0)/active.length),predictedReduction=oldNorm-predictedNorm;
      const saturatedControllerCount=active.filter(c=>{const move=allocations.get(c);return move?.saturated||(!activeParticipation(c.units,1,c.sourceWeights)&&!activeParticipation(c.units,-1,c.sourceWeights));}).length;
      return{kind,allocations,predictedNorm,predictedReduction,maxRequestedDeltaQ:Math.max(0,...requested.map(Math.abs),...[...fixed.values()].map(a=>Math.abs(a.appliedDelta))),maxAppliedDeltaQ:Math.max(0,...[...allocations.values()].map(a=>Math.abs(a.appliedDelta))),sumAbsDeltaQ:[...allocations.values()].reduce((sum,a)=>sum+Math.abs(a.appliedDelta),0),freeControllerCount:raw.size,saturatedControllerCount};
    };
    const gradientDeltas=()=>{const output=new Map<Control,number>(),r=active.map(c=>residual(c,solved)),directions=new Map<Control,number[]>();
      for(const c of active){let best=0,selected:number[]|null=null;for(const direction of [1,-1] as const){if(!activeParticipation(c.units,direction,c.sourceWeights))continue;const column=buildMatrix(active,[c],new Map([[c,direction]])).map(row=>row[0]);if(column.some(value=>value==null))continue;let gradient=0,squared=0;for(let i=0;i<active.length;i++){const value=column[i]!;gradient+=value*r[i];squared+=value*value;}if(squared<=1e-18||gradient*direction<=0)continue;const gain=gradient*gradient/squared;if(gain>best){best=gain;selected=column as number[];}}if(selected)directions.set(c,selected);}
      const columns=[...directions],steps=globalGradientStep(r.map((_,row)=>columns.map(([,column])=>column[row])),r);
      columns.forEach(([c],index)=>{if(Math.abs(steps[index])>EPS)output.set(c,steps[index]);});
      return output;};
    const dense=solveDenseDirection();let accepted=false,refreshRequired=false;
    for(let attempt=0;attempt<4;attempt++){
      let proposal=makeProposal(dense.rawDeltas,dense.fixedMoves,'COUPLED');
      if(dense.denseFailed||!(proposal.predictedReduction>1e-12))proposal=makeProposal(gradientDeltas(),new Map(),'GRADIENT');
      const record=(status:string,reason:string|null,result:PowerFlowResult|null,newNorm:number|null,actualReduction:number|null,rho:number|null,acceptedTrial:boolean):ControllerTrialDiagnostic=>({round:rounds+1,zeroDroopActive:active.filter(c=>c.droopQ==null).length,droopActive:active.filter(c=>c.droopQ!=null).length,newlySatisfied:0,newlySaturated:0,trustFraction,proposalKind:proposal.kind,status,accepted:acceptedTrial,rejectedReason:reason,activeControllerCount:active.length,freeControllerCount:proposal.freeControllerCount,saturatedControllerCount:proposal.saturatedControllerCount,denseDimension:dense.lastDense?.freeColumns??0,objectiveRows:active.length,freeColumns:dense.lastDense?.freeColumns??0,fixedControllers:dense.fixedMoves.size,regularization:dense.lastDense?.regularization??0,conditionEstimate:dense.lastDense?.conditionEstimate??null,rank:dense.lastDense?.rank??0,oldNorm,predictedNorm:proposal.predictedNorm,predictedReduction:proposal.predictedReduction,newNorm,actualReduction,rho,maxRequestedDeltaQ:proposal.maxRequestedDeltaQ,maxAppliedDeltaQ:proposal.maxAppliedDeltaQ,sumAbsDeltaQ:proposal.sumAbsDeltaQ,nrIterations:result?.iterations??null,failureIteration:result?.failure?.iteration??null,failureMismatchMw:result?.failure?.maxMismatchMw??null,linearResidual:result?.linear?.residual??null});
      if(!(proposal.predictedReduction>1e-12)){
        trialAttempts.push(record('SKIPPED_NON_DESCENT','PREDICTED_NON_DESCENT',null,null,null,null,false));
        proposal=makeProposal(gradientDeltas(),new Map(),'GRADIENT');
      }
      if(!(proposal.predictedReduction>1e-12)){trialAttempts.push(record('SKIPPED_NON_DESCENT','PREDICTED_NON_DESCENT',null,null,null,null,false));trustFraction=Math.max(1/32,trustFraction*.5);continue;}
      const trial=cloneModel(model);for(const [c,move]of proposal.allocations)for(const u of c.units)trial.qSpec[u.bus]+=move.qByUnit.get(u.id)!-u.qMvar;
      const signature=JSON.stringify([...new Set(active.flatMap(c=>c.row.actuatorBuses))].sort((a,b)=>a-b).map(bus=>[bus,trial.qSpec[bus]]));
      if(seenTrialSignatures.has(signature)){trialAttempts.push(record('SKIPPED_DUPLICATE','DUPLICATE_Q_VECTOR',null,null,null,null,false));trustFraction=Math.max(1/32,trustFraction*.5);continue;}
      seenTrialSignatures.add(signature);
      const t=now(),guarded=runPredictedDescentTrial(oldNorm,proposal.predictedNorm,()=>solve(trial,solved,Y,layouts,true));times.outerTrialNrMs+=now()-t;
      const result=guarded.result;if(!result){trialAttempts.push(record('SKIPPED_NON_DESCENT','PREDICTED_NON_DESCENT',null,null,null,null,false));trustFraction=Math.max(1/32,trustFraction*.5);continue;}
      const newNorm=result.converged&&result.Vm?norm(active,result):null,actualReduction=newNorm==null?null:oldNorm-newNorm,rho=actualReduction!=null?actualReduction/guarded.predictedReduction:null,accept=result.converged&&actualReduction!=null&&actualReduction>1e-8&&rho!=null&&rho>=.1;
      const rejectedReason=accept?null:!result.converged?result.status:actualReduction==null||actualReduction<=1e-8?'NO_ACTUAL_REDUCTION':'INSUFFICIENT_RHO';
      const trialRecord=record(result.status,rejectedReason,result,newNorm,actualReduction,rho,accept);trialAttempts.push(trialRecord);
      if(accept){const satisfiedBefore=controls.filter(c=>c.row.status==='SATISFIED').length,saturatedBefore=controls.filter(c=>c.row.status==='SATURATED_QMIN'||c.row.status==='SATURATED_QMAX').length;model.qSpec=trial.qSpec;solved=result;for(const [c,move]of proposal.allocations){for(const u of c.units)u.qMvar=move.qByUnit.get(u.id)!;if(Math.abs(move.appliedDelta)>EPS)c.row.outerRounds++;const direction:1|-1=move.appliedDelta>=0?1:-1,weights=interiorParticipation(c.units,c.sourceWeights)??activeParticipation(c.units,direction,c.sourceWeights);if(weights)c.row.participationKi=Object.fromEntries(weights);else c.row.status=direction>0?'SATURATED_QMAX':'SATURATED_QMIN';}
        reactivateMovable();for(const c of pending())if(Math.abs(residual(c,solved))<=equationTolerance)c.row.status='SATISFIED';trialRecord.newlySatisfied=controls.filter(c=>c.row.status==='SATISFIED').length-satisfiedBefore;trialRecord.newlySaturated=controls.filter(c=>c.row.status==='SATURATED_QMIN'||c.row.status==='SATURATED_QMAX').length-saturatedBefore;rounds++;accepted=true;seenTrialSignatures.clear();const nextQLimitSignature=JSON.stringify((result.pvToPq||[]).map(row=>[row.bus,row.qLimit]).sort((a,b)=>a[0]-b[0]));refreshRequired=activeSubset!=null||rho==null||rho<.75||[...proposal.allocations.values()].some(move=>move.saturated)||nextQLimitSignature!==qLimitSignature||rounds%3===0;activeSubset=null;failedRefreshes=0;qLimitSignature=nextQLimitSignature;if(rho!=null&&rho>.75)trustFraction=Math.min(1,trustFraction*1.5);else if(rho!=null&&rho<.25)trustFraction=Math.max(1/32,trustFraction*.5);progress?.('STATION_CONTROL',{round:rounds,maxResidualPu:Math.max(0,...pending().map(c=>Math.abs(residual(c,solved))))});break;}
      trustFraction=Math.max(1/32,trustFraction*.5);
    }
    if(!accepted){failedRefreshes++;
      if(failedRefreshes===1){refresh(pending());if(!solved.converged)break;continue;}
      const partition=partitionControllerDescent(active,gradientDeltas());
      if(partition.movable.length&&partition.stationary.length&&activeSubset==null){activeSubset=new Set(partition.movable);failedRefreshes=1;refresh(pending());if(!solved.converged)break;continue;}
      if(failedRefreshes<3){refresh(pending());if(!solved.converged)break;continue;}
      let newlyStagnated=0,noDirectionalHeadroom=0;for(const c of active){const direction=residual(c,solved)>=0?1:-1;
        c.row.status=activeParticipation(c.units,direction,c.sourceWeights)?'STAGNATED_TRIAL':direction>0?'SATURATED_QMAX':'SATURATED_QMIN';if(c.row.status==='STAGNATED_TRIAL')newlyStagnated++;else noDirectionalHeadroom++;
      }
      const stagnationReason:ControllerTrialDiagnostic['stagnationReason']=newlyStagnated===0||noDirectionalHeadroom===active.length?'NO_DIRECTIONAL_HEADROOM':dense.lastDense?.converged?'CONSTRAINED_KKT_STATIONARY':'NO_DESCENT_AFTER_REFRESH';
      stagnatedSubsetCount+=newlyStagnated;trialAttempts.push({...trialAttempts[trialAttempts.length-1],status:'STAGNATED_SUBSET',accepted:false,rejectedReason:stagnationReason,stagnationReason,stagnatedSubsetCount:newlyStagnated});
      activeSubset=null;failedRefreshes=0;if(pending().length){refresh(pending());if(!solved.converged)break;continue;}break;
    }
    const remaining=pending();if(remaining.length&&rounds<roundBudget&&refreshRequired){refresh(remaining);if(!solved.converged){for(const c of controls){c.row.status='CONTROL_SOLVE_FAILED';c.row.controlSolveFailure=`REFRESH_${solved.status}`;}return{prepared:part,result:baseline,controllers:rows,outerRounds:0,unitOverrides:new Map(),timings:times,resultProvenance:'BASELINE_FALLBACK',sensitivitySolverDiagnostics,classificationPasses:classification.passes,classificationStable:classification.stable,coupledSystems,trialAttempts};}}
  }
  if(!solved.converged){for(const c of controls){c.row.status='CONTROL_SOLVE_FAILED';c.row.controlSolveFailure=`REFRESH_${solved.status}`;}return{prepared:part,result:baseline,controllers:rows,outerRounds:0,unitOverrides:new Map(),timings:times,resultProvenance:'BASELINE_FALLBACK',sensitivitySolverDiagnostics,classificationPasses:classification.passes,classificationStable:classification.stable,coupledSystems,trialAttempts,stagnatedSubsetCount};}
  const beforeFinalBalanceResiduals=new Map(controls.map(c=>[c,residual(c,solved)]));
  const snapshot=(result:PowerFlowResult):ControllerResidualSnapshot=>{const active=controls.filter(c=>c.row.status!=='ROLLED_BACK_TO_LOCAL_PV'),errors=active.map(c=>residual(c,result)),satisfied=errors.filter(error=>Math.abs(error)<=equationTolerance).length,saturated=active.filter(c=>Math.abs(residual(c,result))>equationTolerance&&!activeParticipation(c.units,residual(c,result)>=0?1:-1,c.sourceWeights)).length,movableResidual=active.length-satisfied-saturated;return{satisfied,saturated,movableResidual,residualRmsPu:errors.length?Math.sqrt(errors.reduce((sum,error)=>sum+error*error,0)/errors.length):0,residualMaxPu:errors.length?Math.max(...errors.map(Math.abs)):0};};
  const beforeSnapshot=snapshot(solved);
  runFinalBalance();
const overrides=new Map<string,{qMvar:number|null;qState:string}>(part.stationControlUnitResults);
   // The final distributed-P correction moves load injections, so every remote voltage
   // residual must be recomputed and every controller status revalidated here. A
   // controller that satisfied its target before the correction must not keep SATISFIED
   // when the corrected operating point leaves it outside tolerance.
   const finalRevalidated:string[]=[];
   for(const c of controls){if(c.row.status==='ROLLED_BACK_TO_LOCAL_PV')continue;const error=residual(c,solved),withinTolerance=Math.abs(error)<=equationTolerance;
     const revalidated=c.row.status!=='PENDING';
     if(!withinTolerance){
       const direction:1|-1=error>=0?1:-1;
       c.row.status=activeParticipation(c.units,direction,c.sourceWeights)?'CONTROL_RESIDUAL_AFTER_FINAL_BALANCE':direction>0?'SATURATED_QMAX':'SATURATED_QMIN';
       c.row.controlSolveFailure=c.row.status==='CONTROL_RESIDUAL_AFTER_FINAL_BALANCE'?(Math.abs(beforeFinalBalanceResiduals.get(c)??Infinity)>equationTolerance?'CONTROL_RESIDUAL_BEFORE_FINAL_BALANCE':'FINAL_ACTIVE_BALANCE_MOVED_REMOTE_VOLTAGE'):c.row.controlSolveFailure;
     }else if(c.row.status==='PENDING'||c.row.status==='MAX_OUTER_ROUNDS'||c.row.status==='STAGNATED_TRIAL'||c.row.status==='CONTROL_RESIDUAL_AFTER_FINAL_BALANCE'){
       c.row.status='SATISFIED';
     }
     if(revalidated)finalRevalidated.push(`${c.row.id || c.row.controllerId}:${c.row.status}`);
     c.row.finalVpu=solved.Vm![c.remote];c.row.voltageResidualPu=error;c.row.finalQ=c.units.reduce((s,u)=>s+u.qMvar,0);for(const u of c.units)overrides.set(u.id,{qMvar:u.qMvar,qState:c.row.status});}
   const controlResidualCount=controls.filter(c=>c.row.status==='CONTROL_RESIDUAL_AFTER_FINAL_BALANCE').length;
  const activeControls=controls.filter(c=>c.row.status!=='ROLLED_BACK_TO_LOCAL_PV');
const stationApplied=rounds>0||(activeControls.length>0&&activeControls.every(c=>['SATISFIED','SATURATED_QMIN','SATURATED_QMAX'].includes(c.row.status)));
   const causeCounts={CONTROL_RESIDUAL_BEFORE_FINAL_BALANCE:controls.filter(c=>c.row.status==='CONTROL_RESIDUAL_AFTER_FINAL_BALANCE'&&c.row.controlSolveFailure==='CONTROL_RESIDUAL_BEFORE_FINAL_BALANCE').length,FINAL_ACTIVE_BALANCE_MOVED_REMOTE_VOLTAGE:controls.filter(c=>c.row.status==='CONTROL_RESIDUAL_AFTER_FINAL_BALANCE'&&c.row.controlSolveFailure==='FINAL_ACTIVE_BALANCE_MOVED_REMOTE_VOLTAGE').length};
   return{prepared:{...part,model,stationControlUnitResults:overrides},result:solved,controllers:rows,outerRounds:rounds,unitOverrides:overrides,timings:times,resultProvenance:stationApplied&&controlResidualCount===0?'SENSITIVITY_STATION_CONTROL':'BASELINE_FALLBACK',sensitivitySolverDiagnostics,classificationPasses:classification.passes,classificationStable:classification.stable,coupledSystems,trialAttempts,stagnatedSubsetCount,finalRevalidation:{revalidatedControllerCount:finalRevalidated.length,controlResidualCount,entries:finalRevalidated,before:beforeSnapshot,after:snapshot(solved),causeCounts}};
}
