import type {ScResult} from '../../analysis/short-circuit';
import {SC_ENGINE_REVISION,scProfileHash,scSourceContextHash} from '../../analysis/short-circuit';
import type {ScSourceContext} from '../../analysis/short-circuit/source-adapter';
import type {YtmStudyResult} from '../../analysis/ytm-study';
import {finishYtmStudy} from '../../analysis/ytm-study';
import type {ScenarioResults} from './workspace';
import {stableJson} from '../calculation/identity';
const pick=(input:unknown,fields:readonly string[])=>{const obj=input as Record<string,unknown>;return Object.fromEntries(Object.keys(obj??{}).filter(k=>fields.includes(k)).map(k=>[k,obj[k]]));};
const resultFields=['engineRevision','sourceOptions','workspaceScope','calculationStandard','sourceModelInputs','timings','schemaVersion','method','methodEvidence','identity','profile','faults','componentEvidence','assumptions','sourceCounts','counts','factorizations','rhsCount','reusedDrivingPoints','dimensions','elapsedMs'];
const faultFields=['quality','sourceOmissions','physicalTerminalFid','electricalBusId','physicalTerminalFids','nominalKv','componentId','status','reasons','quantitySupport','zkkOhm','ikssKa','skssMva','ipKa','ibKa','ithKa','residual'];
const only=(input:unknown,fields:readonly string[])=>Object.keys(input??{}).every(k=>fields.includes(k));
export function cleanScResult(input:ScResult|null|undefined):ScResult|null{
 if(!input||input.profile?.faultType!=='3PH'||!['GA_POSITIVE_SEQUENCE_3PH_MAX','GA_POSITIVE_SEQUENCE_3PH_MIN','GA_IEC60909_2016_PREFLIGHT'].includes(input.method))return null;
 if(only(input,resultFields)&&Array.isArray(input.faults)&&input.faults.every(f=>only(f,faultFields))&&(!input.methodEvidence||only(input.methodEvidence.sequenceEvidence,['positive','faultTypes'])&&only(input.methodEvidence.sequenceEvidence.faultTypes,['3PH'])))return input;
 const result=pick(input,resultFields) as unknown as ScResult;
 result.faults=Array.isArray(input.faults)?input.faults.map(f=>pick(f,faultFields) as unknown as ScResult['faults'][number]):[];
 if(result.methodEvidence)result.methodEvidence={...result.methodEvidence,sequenceEvidence:{positive:'NETWORK_APPROXIMATION_ONLY',faultTypes:{'3PH':'NETWORK_APPROXIMATION_ONLY'}}};
 return result;
}
const contextFields=['modelHash','sources','audit','calculateMode','allowMixedNominalKv','assumptions','adapterOptions','invalidBranches'];
export function cleanScContext(input:ScSourceContext|null):ScSourceContext|null{return input?only(input,contextFields)?input:pick(input,contextFields) as unknown as ScSourceContext:null;}
export function cleanStudy(input:YtmStudyResult|null|undefined):YtmStudyResult|null{
 if(!input)return null;
 if(only(input,['schemaVersion','identity','options','status','catalog','n1','scMax','scMin','faultTargets','electricalTargets','stageMs','elapsedMs','qualityCounts','assumptions','messages','pendingCounts'])&&cleanScResult(input.scMax)===input.scMax&&cleanScResult(input.scMin)===input.scMin&&(!input.pendingCounts||only(input.pendingCounts,['N1','SC_MAX','SC_MIN'])))return input;
 const result=pick(input,['schemaVersion','identity','options','status','catalog','n1','scMax','scMin','faultTargets','electricalTargets','stageMs','elapsedMs','qualityCounts','assumptions','messages','pendingCounts']) as unknown as YtmStudyResult;
 result.scMax=cleanScResult(input.scMax);result.scMin=cleanScResult(input.scMin);
 if(input.pendingCounts)result.pendingCounts=pick(input.pendingCounts,['N1','SC_MAX','SC_MIN']) as unknown as YtmStudyResult['pendingCounts'];
 return Array.isArray(result.faultTargets)&&Array.isArray(result.catalog)&&result.options?finishYtmStudy(result):result;
}
export function cleanWorkspace(input:ScenarioResults):ScenarioResults{
 const sc=cleanScResult(input.sc),scContext=cleanScContext(input.scContext),ytm=cleanStudy(input.ytm);
 if(only(input,['n1','ac','hybrid','studyOptions','sc','scContext','ytm'])&&sc===input.sc&&scContext===input.scContext&&ytm===(input.ytm??null))return input;
 return {...pick(input,['n1','ac','hybrid','studyOptions']),sc,scContext,ytm} as ScenarioResults;
}
/** Upgrade only a known historical 3PH engine with unchanged native positive-source inputs and profile. */
export function upgradeLegacyThreePhase(result:ScResult,context:ScSourceContext):boolean{
 if(result.engineRevision!=='sequence-safety-20261024'||result.profile?.faultType!=='3PH'||!result.identity||!/^[a-f0-9]{64}$/.test(result.identity.sourceHash)||result.identity.profileHash!==scProfileHash(result.profile)||stableJson(result.sourceModelInputs)!==stableJson(context.sources)||stableJson(result.sourceOptions)!==stableJson(context.adapterOptions))return false;
 result.identity={...result.identity,sourceHash:scSourceContextHash(context)};result.engineRevision=SC_ENGINE_REVISION;return true;
}
