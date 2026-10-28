import type {PsseBranch,PsseBus} from '../../domain/psse/network';
import type {PsseBranchResult,PsseBusResult,PsseCalculationResult} from '../../domain/psse/results';

export type PsseBusDisplayValues=Pick<PsseBusResult,'vmPu'|'vaDeg'|'pGenerationMw'|'qGenerationMvar'>;
export type PsseBranchDisplayValues=Pick<PsseBranchResult,'pFromMw'|'qFromMvar'|'pToMw'|'qToMvar'|'iFromA'|'iToA'|'loadingFromPct'|'loadingToPct'>;
const emptyBus=():PsseBusDisplayValues=>({vmPu:null,vaDeg:null,pGenerationMw:null,qGenerationMvar:null});
const emptyBranch=():PsseBranchDisplayValues=>({pFromMw:null,qFromMvar:null,pToMw:null,qToMvar:null,iFromA:null,iToA:null,loadingFromPct:null,loadingToPct:null});
const finite=(value:number|null|undefined)=>typeof value==='number'&&Number.isFinite(value)?value:null;

/** Read already-admitted results by full source-terminal identity; never fill missing values.
 * Current model/scenario admission belongs to getPsseDiagramSnapshot. The local status
 * check also prevents accidental failed-result publication by an independent consumer.
 */
export function createPsseResultValues(candidate:PsseCalculationResult|null|undefined){
 const result=candidate?.status==='CONVERGED'&&candidate.physicsCoverage!=='BLOCKED'?candidate:null,dc=result?.method==='LOSSLESS_DC',buses=new Map(result?.busResults.map(row=>[row.connectionKey,row])??[]),branches=new Map(result?.branchResults.map(row=>[row.id,row])??[]);
 return{
  bus(bus:PsseBus):PsseBusDisplayValues{const row=buses.get(bus.connectionKey);if(!row||row.id!==bus.id||row.sourceEquipmentId!==bus.sourceEquipmentId)return emptyBus();return{vmPu:dc?null:finite(row.vmPu),vaDeg:finite(row.vaDeg),pGenerationMw:finite(row.pGenerationMw),qGenerationMvar:dc?null:finite(row.qGenerationMvar)};},
  branch(branch:PsseBranch):PsseBranchDisplayValues{const row=branches.get(branch.id);if(!row||row.sourceEquipmentId!==branch.sourceEquipmentId||row.terminalFrom!==branch.terminalFrom||row.terminalTo!==branch.terminalTo)return emptyBranch();return{pFromMw:finite(row.pFromMw),qFromMvar:dc?null:finite(row.qFromMvar),pToMw:finite(row.pToMw),qToMvar:dc?null:finite(row.qToMvar),iFromA:dc?null:finite(row.iFromA),iToA:dc?null:finite(row.iToA),loadingFromPct:dc?null:finite(row.loadingFromPct),loadingToPct:dc?null:finite(row.loadingToPct)};},
 };
}
