import type {CanonicalNetwork} from '../../domain/model/network';
import type {CalculationResult} from '../../domain/results/types';
import {emptyScenario,scenarioSignature} from '../../domain/scenario/overlay';
import {buildTopology} from '../../topology/electrical-topology';
import {powerFactoryLoadFlowSettings,type ComparisonContext,type PowerFactoryReference} from './powerfactory-reference';

export interface ReferencePreflight {
  status:'COMPATIBLE'|'BLOCKED';reasons:string[];context:ComparisonContext;reference:PowerFactoryReference;
  topology:{physicalTerminalsTotal:number;resultBearingPhysicalTerminals:number;physicalTerminalsChecked:number;uniqueCalculationBuses:number;electricalBusesChecked:number;branchEndpointsChecked:number;missingTerminals:number;missingTerminalIds:string[];inactiveStubTerminals:number;busPartitionConflicts:number;missingBranches:number;branchEndpointConflicts:number};
  studyTimeProvenance:'STUDY_CASE_NAME'|'UNAVAILABLE';
}

/** The source fixture has no topology digest; compare its terminal partition and every result branch endpoint directly. */
export function preflightPowerFactoryReference(reference:PowerFactoryReference,network:CanonicalNetwork,result:CalculationResult|null,controlContextNumericFile?:string|null):ReferencePreflight {
  const reasons:string[]=[],modelId=network.name.replace(/\.(json|zip)$/i,''),studyCase=network.studyCase||modelId;
  const time=/^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(?:_|$)/.exec(studyCase);
  const studyTime=time?`${time[1]}-${time[2]}-${time[3]} ${time[4]}:${time[5]}:00`:undefined;
  if(!reference.metadata.modelId||reference.metadata.modelId!==modelId)reasons.push('Model kimliği uyuşmuyor veya eksik.');
  if(!reference.metadata.studyCase||reference.metadata.studyCase!==studyCase)reasons.push('Study case uyuşmuyor veya eksik.');
  if(!studyTime||reference.metadata.studyTime!==studyTime)reasons.push('Study time doğrulanamadı veya uyuşmuyor.');
  if(controlContextNumericFile&&reference.metadata.sourceFile!==controlContextNumericFile)reasons.push('ControlContext ile sayısal PowerFactory referans dosyası uyuşmuyor.');
  if(!result?.converged)reasons.push('Yakınsamış Tam AC sonucu gerekli.');
  if(result&&result.identity.modelHash!==network.modelHash)reasons.push('Hesap sonucu farklı model hash’ine ait.');
  if(result&&result.identity.scenarioHash!==scenarioSignature(emptyScenario()))reasons.push('PF referansı baz topolojiye ait; senaryo sonucu sayısal karşılaştırılamaz.');
  const topology=buildTopology(network),pfBusRows=reference.records.filter(row=>row.kind==='bus'&&(row.electricalBusKey||row.calculationBusKey)),pfKeyToGa=new Map<string,number>(),gaToPfKey=new Map<number,string>();
  const active=[...network.lines,...network.transformers,...network.seriesCompensators].filter(row=>row.inService&&!topology.blockedEquipment.has(row.id)),byId=new Map(active.map(row=>[row.id,row]));
  const activeTerminals=new Set(active.flatMap(row=>[row.from,row.to]));for(const row of [...network.generators,...network.loads,...network.shunts,...network.externalGrids,...network.internationalConnections])if(row.inService&&!topology.blockedEquipment.has(row.id))activeTerminals.add(row.bus);
  let missingTerminals=0,busPartitionConflicts=0,physicalTerminalsChecked=0;const missingTerminalIds:string[]=[],missingRows:{terminal:string;key:string}[]=[];
  const terminalCount=pfBusRows.reduce((sum,row)=>sum+(row.physicalTerminalFids?.length??(row.physicalTerminalFid?1:0)),0),resultBearingPhysicalTerminals=pfBusRows.reduce((sum,row)=>sum+(row.resultBearingPhysicalTerminalCount??(row.resultAvailable===true?1:0)),0);
  for(const row of pfBusRows)for(const terminal of row.physicalTerminalFids??(row.physicalTerminalFid?[row.physicalTerminalFid]:[])){const key=row.electricalBusKey||row.calculationBusKey!,index=topology.terminalToBus.get(terminal);if(index==null){missingTerminals++;missingRows.push({terminal,key});if(missingTerminalIds.length<20)missingTerminalIds.push(terminal);continue;}physicalTerminalsChecked++;const priorGa=pfKeyToGa.get(key),priorPf=gaToPfKey.get(index);if(priorGa!==undefined&&priorGa!==index||priorPf!==undefined&&priorPf!==key)busPartitionConflicts++;pfKeyToGa.set(key,index);gaToPfKey.set(index,key);}
  const inactiveStubTerminals=missingRows.filter(row=>!activeTerminals.has(row.terminal)&&pfKeyToGa.has(row.key)).length,criticalMissingTerminals=missingTerminals-inactiveStubTerminals;
  let branchEndpointsChecked=0,missingBranches=0,branchEndpointConflicts=0;
  for(const row of reference.records.filter(row=>(row.kind==='line'||row.kind==='transformer')&&row.resultAvailable!==false)){
    const branch=byId.get(row.fid||'');if(!branch){missingBranches++;continue;}branchEndpointsChecked++;if(!row.fromBusFid||!row.toBusFid||branch.from!==row.fromBusFid||branch.to!==row.toBusFid)branchEndpointConflicts++;
  }
  if(!pfBusRows.length||physicalTerminalsChecked+inactiveStubTerminals!==terminalCount||criticalMissingTerminals||busPartitionConflicts||gaToPfKey.size!==topology.buses.length)reasons.push('Aktif fiziksel terminal → elektriksel bara eşdeğerliği uyuşmuyor.');
  if(!branchEndpointsChecked||missingBranches||branchEndpointConflicts||result&&branchEndpointsChecked!==result.branches.length)reasons.push('Dal uçları veya dal sayısı PF referansıyla uyuşmuyor.');
  if(result&&result.buses.length!==topology.buses.length)reasons.push('Sonuçtaki elektriksel bara sayısı topolojiyle uyuşmuyor.');
  const topologyValid=!criticalMissingTerminals&&!busPartitionConflicts&&!missingBranches&&!branchEndpointConflicts&&physicalTerminalsChecked+inactiveStubTerminals===terminalCount&&gaToPfKey.size===topology.buses.length&&!!branchEndpointsChecked&&(!result||branchEndpointsChecked===result.branches.length&&result.buses.length===topology.buses.length);
  // This token is issued only after all partition and endpoint equalities above have been checked.
  const topologyHash=topologyValid?`verified:${network.modelHash}:${gaToPfKey.size}:${branchEndpointsChecked}`:undefined;
  const balance=result?.diagnostics.activeBalancing as {effectiveActiveBalancingMode?:string;effectiveMode?:string}|undefined;
  const context:ComparisonContext={modelId,modelHash:network.modelHash,studyCase,studyTime,topologyHash,scenarioHash:result?.identity.scenarioHash,calculationSettingsSemanticsAvailable:Object.keys(powerFactoryLoadFlowSettings(reference).semantic).length>0,activeBalanceEligibilityAvailable:network.loads.filter(load=>load.inService).every(load=>load.activeBalanceEligibility!==undefined),effectiveActiveBalancingMode:balance?.effectiveActiveBalancingMode??balance?.effectiveMode,controlContextReferenceMatched:controlContextNumericFile?reference.metadata.sourceFile===controlContextNumericFile:undefined};
  return{status:reasons.length?'BLOCKED':'COMPATIBLE',reasons,context,reference:{...reference,metadata:{...reference.metadata,topologyHash}},topology:{physicalTerminalsTotal:terminalCount,resultBearingPhysicalTerminals,physicalTerminalsChecked,uniqueCalculationBuses:pfBusRows.length,electricalBusesChecked:gaToPfKey.size,branchEndpointsChecked,missingTerminals,missingTerminalIds,inactiveStubTerminals,busPartitionConflicts,missingBranches,branchEndpointConflicts},studyTimeProvenance:studyTime?'STUDY_CASE_NAME':'UNAVAILABLE'};
}
