import type {PsseBusBranchNetwork} from './network';
import {createPsseScenario} from './scenario';
import {isCurrentPsseResult,type PsseCalculationResult} from './results';

/** A scenario solve must never replace the empty-scenario comparison baseline. */
export function retainPsseBaseCalculation(previous:PsseCalculationResult|null|undefined,candidate:PsseCalculationResult|null|undefined,network:PsseBusBranchNetwork,sourceSha256:string):PsseCalculationResult|null{
 const scenario=createPsseScenario(network);
 const admissible=(result:PsseCalculationResult|null|undefined):result is PsseCalculationResult=>!!result&&result.status==='CONVERGED'&&result.physicsCoverage!=='BLOCKED'&&isCurrentPsseResult(result,{sourceSha256,network,effectiveNetwork:network,scenario});
 return admissible(candidate)?candidate:admissible(previous)?previous:null;
}
