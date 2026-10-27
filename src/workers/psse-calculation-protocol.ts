import type {PsseModel} from '../importers/psse/types';
import type {PsseBusBranchNetwork} from '../domain/psse/network';
import type {PsseScenario} from '../domain/psse/scenario';
import type {PsseCalculationResult} from '../domain/psse/results';
export type PsseMethod='NR_POLAR'|'FDNS_XB'|'LOSSLESS_DC';
export interface PsseCalculationRequest {id:number;type:'RUN';model:PsseModel;network:PsseBusBranchNetwork;scenario:PsseScenario;method:PsseMethod;options:Record<string,unknown>}
export type PsseCalculationResponse={id:number;type:'PROGRESS';phase:string;iteration:number;residualPu:number|null}|{id:number;type:'RESULT';result:PsseCalculationResult}|{id:number;type:'ERROR';error:string};
