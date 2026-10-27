import {PSSE_ENGINE_VERSION,psseCalculationIdentity,psseTopologyHash,type PsseCalculationIdentity} from './identity';
import type {PsseBusBranchNetwork} from './network';
import type {PsseScenario} from './scenario';
import type {PsseFinding} from '../../importers/psse/types';
export type PsseCalculationClassification='SOLVED_FULL'|'SOLVED_APPROXIMATE'|'NOT_CONVERGED'|'INVALID_MODEL'|'UNSUPPORTED_PHYSICS';
export function psseCalculationClassification(result:{status:PsseCalculationResult['status'];physicsCoverage:PsseCalculationResult['physicsCoverage'];findings:readonly PsseFinding[]}):PsseCalculationClassification{if(result.status==='CONVERGED')return result.physicsCoverage==='SUPPORTED'?'SOLVED_FULL':'SOLVED_APPROXIMATE';if(result.status==='BLOCKED'){if(result.findings.some(f=>f.severity==='ERROR'&&(/UNSUPPORTED|UNIMPLEMENTED|NO_IMPLEMENTED|NOT_IMPLEMENTED/.test(f.code))))return'UNSUPPORTED_PHYSICS';return'INVALID_MODEL';}return'NOT_CONVERGED';}
export interface PsseCalculationResult {schema:'ga.psse.calculation.v1';id:string;identity:PsseCalculationIdentity;method:'NR_POLAR'|'FDNS_XB'|'LOSSLESS_DC';status:'CONVERGED'|'NON_CONVERGED'|'BLOCKED'|'CANCELLED'|'ERROR';classification:PsseCalculationClassification;physicsCoverage:'SUPPORTED'|'PARTIAL'|'BLOCKED';referenceComparisonStatus:'NOT_COMPARED'|'MATCHED'|'DIFFERENT_CASE';source:'GA_PSSE_CALCULATED';baseMva:number;iterations:number;outerRounds:number;elapsedMs:number;maxPMismatchPu:number|null;maxQMismatchPu:number|null;busResults:PsseBusResult[];branchResults:PsseBranchResult[];generatorResults:PsseGeneratorResult[];unsolvedIslands:string[];diagnostics:Record<string,unknown>;findings:PsseFinding[]}
export type PssePublicationStatus=PsseCalculationResult['status']|'LIMITED_PROFILE';
export function pssePublicationStatus(result:Pick<PsseCalculationResult,'status'|'physicsCoverage'>):PssePublicationStatus{return result.status==='CONVERGED'&&result.physicsCoverage!=='SUPPORTED'?'LIMITED_PROFILE':result.status;}
export function pssePublicationMessage(result:Pick<PsseCalculationResult,'status'|'physicsCoverage'|'method'>):string{return pssePublicationStatus(result)==='LIMITED_PROFILE'?`Sayısal artık eşiği ${result.method} yöntemi için sağlandı; doğrulanan profil kapsamı PARTIAL. Sonuç bu seçili yöntem ve profil için geçerlidir.`:result.status==='CONVERGED'?'Sayısal artık eşiği sağlandı; fizik kapsamı SUPPORTED.':`Sayısal sonuç durumu: ${result.status}; fizik kapsamı ${result.physicsCoverage}.`;}
export function psseCalculationExport(result:PsseCalculationResult){return {...result,numericalStatus:result.status,classification:result.classification,publicationStatus:pssePublicationStatus(result),publicationMessage:pssePublicationMessage(result)};}
export interface PsseBusResult {id:string;connectionKey:string;vmPu:number|null;vaDeg:number|null;pGenerationMw:number|null;qGenerationMvar:number|null;sourceEquipmentId:string|null}
export interface PsseBranchResult {id:string;sourceEquipmentId:string;terminalFrom:string;terminalTo:string;pFromMw:number|null;qFromMvar:number|null;pToMw:number|null;qToMvar:number|null;pLossMw:number|null;qLossMvar:number|null;sFromMva?:number|null;sToMva?:number|null;iFromA?:number|null;iToA?:number|null;iFromLimitA?:number|null;iToLimitA?:number|null;loadingFromPct?:number|null;loadingToPct?:number|null;ratingBasis?:'MVA'|'CURRENT_EXPRESSED_AS_MVA'|'UNKNOWN';ratingsFromSource?:readonly (number|null)[];ratingsToSource?:readonly (number|null)[];loadingBasis?:'MVA'|'CURRENT_EXPRESSED_AS_MVA'|'UNAVAILABLE'}
export interface PsseGeneratorResult {id:string;sourceEquipmentId:string;pMw:number|null;qMvar:number|null;limitState:'FREE'|'FIXED_Q'|'QMIN'|'QMAX'|'UNAVAILABLE'}
export interface PsseReferenceSnapshot {source:'PSSE_REFERENCE';sourceSha256:string;method:string;optionsHash:string;version:string;converged:boolean;values:unknown}

/** Admission/publication guard; effectiveNetwork must be the applied current scenario. */
export function isCurrentPsseResult(result:PsseCalculationResult|null|undefined,current:{sourceSha256:string;network:PsseBusBranchNetwork;effectiveNetwork:PsseBusBranchNetwork;scenario:PsseScenario;method?:PsseCalculationResult['method'];optionsHash?:string}):result is PsseCalculationResult{
 try{
  if(!result||result.schema!=='ga.psse.calculation.v1'||result.source!=='GA_PSSE_CALCULATED')return false;
  const i=result.identity,n=current.network,s=current.scenario;
  if(!i||i.schema!=='ga.psse.calculation-identity.v1'||i.mode!=='PSSE'||i.engineVersion!==PSSE_ENGINE_VERSION||s.networkHash!==n.modelHash)return false;
  if(current.sourceSha256!==n.sourceSha256||i.sourceSha256!==current.sourceSha256||i.modelHash!==n.modelHash||i.normalizedModelHash!==n.modelHash||i.normalizedRevision!==n.revision||i.scenarioHash!==s.hash)return false;
  if(current.effectiveNetwork.modelHash!==n.modelHash||i.topologyHash!==psseTopologyHash(current.effectiveNetwork))return false;
  if(!['NR_POLAR','FDNS_XB','LOSSLESS_DC'].includes(result.method)||i.solver!==result.method||i.algorithmId!==result.method||current.method!==undefined&&current.method!==result.method)return false;
  if(i.resultSchemaRevision!=='psse-result-1'||!/^[a-f0-9]{64}$/.test(i.optionsHash)||current.optionsHash!==undefined&&i.optionsHash!==current.optionsHash||result.id!==i.id)return false;
  const {schema:identitySchema,id:identityId,...body}=i;void identitySchema;
  return identityId===psseCalculationIdentity(body).id;
 }catch{return false;}
}
