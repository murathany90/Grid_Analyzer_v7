import type {PsseEquipment,PsseModel} from '../../importers/psse/types';
import {psseTopologyHash} from './identity';
import type {PsseBus,PsseBusBranchNetwork,PsseBranch} from './network';
import {createPsseScenario} from './scenario';
import type {PsseCalculationResult,PsseBranchResult} from './results';

export type PsseReferenceComparisonStatus='NOT_READY'|'SOURCE_MISMATCH'|'METHOD_MISMATCH'|'REFERENCE_NOT_SOLVED'|'INCOMPLETE_COMPARISON'|'MATCHED'|'DIFFERENT';
export interface PsseReferenceComparison {
 status:PsseReferenceComparisonStatus;
 sourceSha256:string|null;
 method:string|null;
 counts:{buses:number;branches:number;windings:number;generators:number;compared:number;missing:number};
 maximumAbsoluteError:{voltagePu:number|null;angleDeg:number|null;powerMvar:number|null};
 details:string[];
}

type Row=Record<string,unknown>;
type Columns=Record<string,unknown[]>;
type Reference=Row;
type Scope='AC'|'DC';
const HASH=/^[0-9a-f]{64}$/i;
const AC_LIMITS={voltagePu:1e-4,angleDeg:.05,powerMvar:.5} as const;
const EMPTY_COUNTS=()=>({buses:0,branches:0,windings:0,generators:0,compared:0,missing:0});
const EMPTY_ERRORS=()=>({voltagePu:null as number|null,angleDeg:null as number|null,powerMvar:null as number|null});
const record=(value:unknown):Row|null=>value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Row:null;
const finite=(value:unknown):number|null=>typeof value==='number'&&Number.isFinite(value)?value:null;
const integer=(value:unknown):number|null=>{const n=finite(value);return n!==null&&Number.isInteger(n)?n:null;};
const text=(value:unknown):string|null=>typeof value==='string'?value.trim():null;
const keyText=(value:unknown):string=>String(value??'').trim();
const angleDelta=(a:number,b:number)=>((a-b+180)%360+360)%360-180;
const setMax=(a:number|null,b:number)=>a===null?b:Math.max(a,b);
const table=(ref:Reference,key:string):Columns|null=>record(ref[key]) as Columns|null;
function empty(status:PsseReferenceComparisonStatus,sourceSha256:string|null,method:string|null,...details:string[]):PsseReferenceComparison{return{status,sourceSha256,method,counts:EMPTY_COUNTS(),maximumAbsoluteError:EMPTY_ERRORS(),details};}
function methodInfo(method:string):{method:string;solver:PsseCalculationResult['method'];scope:Scope}|null{
 const normalized=method.trim().toLowerCase();
 if(['fnsl','fullnewton'].includes(normalized))return{method:normalized,solver:'NR_POLAR',scope:'AC'};
 if(['fdns','fdns_xb'].includes(normalized))return{method:normalized,solver:'FDNS_XB',scope:'AC'};
 if(['dclf','dclf_2'].includes(normalized))return{method:normalized,solver:'LOSSLESS_DC',scope:'DC'};
 return null;
}
function rowColumns(cols:Columns|null,required:string[],optional:string[]=[]):string|null{
 if(!cols)return'column table is missing or malformed';
 const names=[...required,...optional.filter(name=>cols[name]!==undefined)];
 for(const name of names)if(!Array.isArray(cols[name]))return`column ${name} is missing or malformed`;
 const lengths=names.map(name=>cols[name]!.length);
 if(lengths.some(length=>length!==lengths[0]))return`columns ${names.join(', ')} have inconsistent row counts`;
 return null;
}
function col(cols:Columns,key:string,index:number):unknown{return cols[key]?.[index];}
function equipmentIndex(model:PsseModel){const map=new Map<string,PsseEquipment[]>();for(const item of model.equipment){const rows=map.get(item.id)??[];rows.push(item);map.set(item.id,rows);}return map;}
function diagnosticText(result:PsseCalculationResult,key:string):unknown{return result.diagnostics?.[key];}

/**
 * Compare a loaded PSS/E reference only when it identifies this exact, base-case
 * normalized model and the supplied calculation is a successful result for the
 * same model. A reference options hash is intentionally not compared with the
 * GA options hash: they identify different engines and option encodings.
 */
export function comparePsseReference(raw:unknown,model:PsseModel,network:PsseBusBranchNetwork,result:PsseCalculationResult):PsseReferenceComparison{
 const ref=record(raw),emptyCounts=EMPTY_COUNTS(),emptyErrors=EMPTY_ERRORS();
 if(!ref||ref.schema!=='ga.psse.reference.v1'||ref.provenance!=='PSSE_REFERENCE')return empty('NOT_READY',null,null,'Invalid or unsupported reference schema/provenance.');
 const source=record(ref.source),spec=record(ref.spec),sourceSha256=typeof source?.sha256==='string'?source.sha256:null,rawMethod=typeof spec?.method==='string'?spec.method:null,info=rawMethod?methodInfo(rawMethod):null,method=info?.method??(rawMethod?.trim().toLowerCase()||null);
 const resultShell=(status:PsseReferenceComparisonStatus,...details:string[]):PsseReferenceComparison=>({status,sourceSha256,method,counts:emptyCounts,maximumAbsoluteError:emptyErrors,details});
 if(!sourceSha256||!HASH.test(sourceSha256))return resultShell('NOT_READY','Reference source SHA-256 is missing or malformed.');
 if(sourceSha256!==model.source.sha256||network.sourceSha256!==model.source.sha256)return resultShell('SOURCE_MISMATCH','Reference, source model, and normalized network must have the same source SHA-256.');
 if(!info)return resultShell('METHOD_MISMATCH',`Unsupported or missing reference method: ${method??'unknown'}.`);
 if(info.solver!==result.method)return resultShell('METHOD_MISMATCH',`Reference method ${method} requires ${info.solver}, but the result method is ${result.method}.`);
 if(result.schema!=='ga.psse.calculation.v1'||result.source!=='GA_PSSE_CALCULATED'||result.status!=='CONVERGED')return resultShell('NOT_READY',`A CONVERGED GA_PSSE_CALCULATED result is required (status=${String(result.status)}, source=${String(result.source)}).`);
 const identity=result.identity;
 if(!identity||identity.schema!=='ga.psse.calculation-identity.v1'||identity.mode!=='PSSE'||identity.id!==result.id||identity.solver!==result.method||identity.algorithmId!==result.method)return resultShell('NOT_READY','Calculation identity is incomplete or inconsistent with the result.');
 if(identity.sourceSha256!==model.source.sha256||identity.modelHash!==network.modelHash||identity.normalizedModelHash!==network.modelHash||identity.normalizedRevision!==network.revision||identity.topologyHash!==psseTopologyHash(network))return resultShell('NOT_READY','Calculation identity does not match the loaded normalized model and topology.');
 let baseScenarioHash:string;try{baseScenarioHash=createPsseScenario(network).hash;}catch{return resultShell('NOT_READY','The base PSS/E scenario identity could not be verified.');}
 if(identity.scenarioHash!==baseScenarioHash)return resultShell('NOT_READY','Reference comparison is available only for the matching base scenario; the calculation scenario hash differs.');
 if(!HASH.test(identity.optionsHash)||!identity.controlPolicyId||!identity.controlPolicyRevision||!identity.algorithmRevision||!identity.engineVersion||!identity.resultSchemaRevision)return resultShell('NOT_READY','Calculation identity is missing required policy or version fields.');
 if(spec?.profile!=='fixed-controls-v1'||integer(spec.harnessVersion)===null||integer(spec.harnessVersion)!<2||integer(spec.iterations)===null||integer(spec.iterations)!<0||finite(spec.toleranceMva)===null||finite(spec.toleranceMva)!<=0)return resultShell('NOT_READY','Reference profile, harness version, iteration count, or tolerance is unsupported or malformed.');
 if(typeof ref.optionsHash!=='string'||!HASH.test(ref.optionsHash))return resultShell('NOT_READY','Reference optionsHash is missing or malformed. It is not compared with the GA options hash.');
 if(finite(ref.loadError)!==0||finite(ref.ierr)!==0)return resultShell('REFERENCE_NOT_SOLVED',`Reference load/solver error must be zero (loadError=${String(ref.loadError)}, ierr=${String(ref.ierr)}).`);
 if(integer(ref.solved)===null)return resultShell('NOT_READY',`Reference solved flag is malformed (${String(ref.solved)}).`);
 if(info.scope==='AC'&&ref.solved!==0)return resultShell('REFERENCE_NOT_SOLVED',`AC reference solver must report solved=0 and ierr=0 (solved=${String(ref.solved)}, ierr=${String(ref.ierr)}).`);
 if(!Array.isArray(ref.exportErrors)||ref.exportErrors.length>0)return resultShell('INCOMPLETE_COMPARISON',`Reference exportErrors must be present and empty (count=${Array.isArray(ref.exportErrors)?ref.exportErrors.length:'unknown'}).`);
 const options=spec.options;
 if(!Array.isArray(options)||Array.from({length:options.length},(_,index)=>integer(options[index])!==null).some(valid=>!valid))return resultShell('NOT_READY','Reference spec.options must be a complete array of finite integers.');
 if(info.scope==='AC'){
  if(options.length!==8||options.slice(0,5).some(value=>value!==0)||![0,1].includes(options[5] as number)||![-1,0].includes(options[6] as number)||![0,1].includes(options[7] as number))return resultShell('NOT_READY','AC reference options must be the supported eight-entry PSS/E profile with the first five flags fixed at zero.');
  const warmFlag=identity.initialVoltagePolicy==='SOURCE_SAVED'?0:identity.initialVoltagePolicy==='FLAT'?1:null;
  if(warmFlag===null||options[5]!==warmFlag)return resultShell('NOT_READY','AC reference initialization option does not match the calculation initial-voltage policy.');
  const qFlag=identity.controlPolicyId==='FIXED_CONTROLS_NO_Q_LIMITS'?-1:identity.controlPolicyId==='FIXED_CONTROLS_Q_LIMITS'?0:null;
  if(qFlag===null||options[6]!==qFlag||identity.controlPolicyRevision!=='fixed-controls-1')return resultShell('NOT_READY','AC reference Q-limit option is incompatible with the calculation control policy.');
 }else{
  const dcOptions=[0,0,1,1,0,1];
  if(options.length!==dcOptions.length||options.some((value,index)=>value!==dcOptions[index]))return resultShell('NOT_READY','DC reference requires the validated six-entry DCLF profile [0,0,1,1,0,1], including saving base-case DC bus angles.');
  const d=result.diagnostics;
  const dcPolicyOk=diagnosticText(result,'approximation')==='LOSSLESS_DC'&&diagnosticText(result,'voltageMagnitudePu')===1&&diagnosticText(result,'tapPolicy')==='PSSE36_DCLF_COMPAT'&&diagnosticText(result,'reactanceTapConvention')==='b=1/xPu, PSS/E 36.5 DCLF reference profile'&&diagnosticText(result,'loadVoltagePolicy')==='SOURCE_SAVED'&&diagnosticText(result,'realShuntConsumptionIncluded')===true&&diagnosticText(result,'terminalConductanceConsumptionIncluded')===true&&diagnosticText(result,'realShuntVoltagePolicy')==='SOURCE_SAVED'&&['FLAT_REFERENCE','SOURCE_REFERENCE_ANGLE'].includes(identity.initialVoltagePolicy)&&diagnosticText(result,'seriesResistanceAndLosses')==='OMITTED_BY_LOSSLESS_DC'&&identity.controlPolicyId==='FIXED_CONTROLS';
  if(!dcPolicyOk)return resultShell('NOT_READY','DC comparison requires the PSS/E 36.5 DCLF tap profile, zero loss estimate/fixed phase options, source-saved load and real-shunt voltages, included real-shunt consumption, unit voltage magnitude, and explicit lossless diagnostics.');
 }

 const buses=table(ref,'buses');
 const busErr=rowColumns(buses,info.scope==='AC'?['NUMBER','TYPE','PU']:['NUMBER','TYPE'],['STATUS','ANGLE','ANGLED']);
 const angleColumn=buses?.ANGLED!==undefined?'ANGLED':buses?.ANGLE!==undefined?'ANGLE':null;
 if(busErr||!angleColumn)return resultShell('INCOMPLETE_COMPARISON',`Reference bus table is incomplete: ${busErr??'both ANGLE and ANGLED columns are absent'}.`);
 const busCount=buses!.NUMBER!.length;
 if((info.scope==='AC'&&buses!.PU!.length!==busCount)||buses![angleColumn]!.length!==busCount)return resultShell('INCOMPLETE_COMPARISON','Reference bus table has inconsistent voltage or angle arrays.');
 const referenceBusActive=(index:number)=>{const status=buses!.STATUS?integer(col(buses!,'STATUS',index)):null,type=integer(col(buses!,'TYPE',index));return(type===1||type===2||type===3)&&(buses!.STATUS?status===1:true);};
 const branchCols=table(ref,'branches'),windingCols=table(ref,'windings');
 const branchErr=info.scope==='AC'?rowColumns(branchCols,['FROMNUMBER','TONUMBER','ID','STATUS','P','Q']):null;
 const windingErr=info.scope==='AC'?rowColumns(windingCols,['WIND1NUMBER','WIND2NUMBER','WIND3NUMBER','WNDNUM','ID','STATUS','P','Q']):null;
 const genCols=info.scope==='AC'?table(ref,'generators'):null;
 const generatorErr=info.scope==='AC'?rowColumns(genCols,['NUMBER','ID','STATUS','PGEN','QGEN']):null;
 if(branchErr)return resultShell('INCOMPLETE_COMPARISON',`Reference branch table is incomplete: ${branchErr}.`);
 if(windingErr)return resultShell('INCOMPLETE_COMPARISON',`Reference winding table is incomplete: ${windingErr}.`);
 if(generatorErr)return resultShell('INCOMPLETE_COMPARISON',`Reference generator table is incomplete: ${generatorErr}.`);

 const counts=EMPTY_COUNTS(),maximumAbsoluteError=EMPTY_ERRORS(),details:string[]=[],missingNotes:string[]=[];
 const missing=(scope:string,key:string,reason:string)=>{counts.missing++;if(missingNotes.length<12)missingNotes.push(`${scope} ${key}: ${reason}`);};
 const comparePower=(actual:number,expected:number)=>{maximumAbsoluteError.powerMvar=setMax(maximumAbsoluteError.powerMvar,Math.abs(actual-expected));};
 const angleAt=(index:number)=>{if(angleColumn==='ANGLED'){const degrees=finite(col(buses!,'ANGLED',index));if(degrees!==null)return degrees;}const radians=finite(col(buses!,'ANGLE',index));return radians===null?null:radians*180/Math.PI;};
 const externalBus=(bus:PsseBus)=>bus.externalNumber!==null&&Number.isInteger(bus.externalNumber)?bus.externalNumber:null;
 const networkBusMap=new Map<number,number>(),networkBusAmbiguous=new Set<number>();
 for(let i=0;i<network.buses.length;i++){const bus=network.buses[i];if(!bus.source)continue;const number=externalBus(bus);if(number===null)continue;if(networkBusMap.has(number))networkBusAmbiguous.add(number);else networkBusMap.set(number,i);}
 const refBusMap=new Map<number,number>(),refBusAmbiguous=new Set<number>();
 for(let i=0;i<busCount;i++){const number=integer(col(buses!,'NUMBER',i));if(number===null){missing('bus table',`row ${i+1}`,'external bus number is not a finite integer');continue;}if(refBusMap.has(number))refBusAmbiguous.add(number);else refBusMap.set(number,i);}
 for(const number of networkBusAmbiguous)missing('network bus',String(number),'external bus number is ambiguous in the normalized model');
 for(const number of refBusAmbiguous)missing('reference bus',String(number),'external bus number is duplicated in the reference');

 const resultBusMap=new Map<string,typeof result.busResults[number]>(),duplicateResultBuses=new Set<string>();
 for(const item of result.busResults){if(resultBusMap.has(item.connectionKey))duplicateResultBuses.add(item.connectionKey);else resultBusMap.set(item.connectionKey,item);}
 const activePhysicalBuses=network.buses.map((bus,index)=>({bus,index})).filter(({bus})=>bus.source&&bus.status===1&&bus.type!==4);
 const activePhysicalNums=new Set(activePhysicalBuses.map(({bus})=>externalBus(bus)).filter((value):value is number=>value!==null));
 const refActiveNums=new Set<number>();
 for(let i=0;i<busCount;i++)if(referenceBusActive(i)){const n=integer(col(buses!,'NUMBER',i));if(n!==null)refActiveNums.add(n);}
 for(const number of refActiveNums)if(!activePhysicalNums.has(number))missing('reference bus',String(number),'active source row has no active normalized physical bus');

 // Angle references are independent for each electrical island; align each
 // island to its normalized type-3 bus before comparing AC or DC angles.
 const componentOf=new Int32Array(network.buses.length).fill(-1),adj=network.buses.map(()=>[] as number[]);
 for(const branch of network.branches)if(branch.status===1&&network.buses[branch.from]?.status===1&&network.buses[branch.to]?.status===1){adj[branch.from]!.push(branch.to);adj[branch.to]!.push(branch.from);}
 let component=0;
 for(let i=0;i<network.buses.length;i++){if(network.buses[i]!.status!==1||componentOf[i]!==-1)continue;const stack=[i];componentOf[i]=component;while(stack.length){const n=stack.pop()!;for(const next of adj[n]!)if(componentOf[next]===-1){componentOf[next]=component;stack.push(next);}}component++;}
 const angleOffsets=new Map<number,number>(),missingAngleComponents=new Set<number>();
 for(let c=0;c<component;c++){
  const candidates=network.buses.map((bus,index)=>({bus,index})).filter(({bus,index})=>bus.source&&bus.status===1&&bus.type===3&&componentOf[index]===c).sort((a,b)=>(a.bus.externalNumber??0)-(b.bus.externalNumber??0));
  if(!candidates.length){missingAngleComponents.add(c);continue;}
  const refBus=candidates[0]!,number=externalBus(refBus.bus),row=number===null?undefined:refBusMap.get(number),ga=resultBusMap.get(refBus.bus.connectionKey),refAngle=row===undefined?null:angleAt(row),gaAngle=finite(ga?.vaDeg);
  if(row===undefined||refBusAmbiguous.has(number!)||duplicateResultBuses.has(refBus.bus.connectionKey)||refAngle===null||gaAngle===null){missingAngleComponents.add(c);continue;}
  angleOffsets.set(c,gaAngle-refAngle);
 }
 for(const {bus,index} of activePhysicalBuses){
  const number=externalBus(bus),key=number===null?bus.connectionKey:String(number),row=number===null?undefined:refBusMap.get(number),ga=resultBusMap.get(bus.connectionKey),componentId=componentOf[index]!;
  if(number===null){missing('bus',key,'normalized bus has no external source number');continue;}
  if(networkBusAmbiguous.has(number)||refBusAmbiguous.has(number)){missing('bus',key,'external bus identity is ambiguous');continue;}
  if(row===undefined||!referenceBusActive(row)){missing('bus',key,'active physical bus is missing or inactive in the reference');continue;}
  if(duplicateResultBuses.has(bus.connectionKey)||!ga){missing('bus',key,'calculation result row is missing or duplicated');continue;}
  const vm=info.scope==='AC'?finite(col(buses!,'PU',row)):1,gaVm=info.scope==='AC'?finite(ga.vmPu):1,refAngle=angleAt(row),gaAngle=finite(ga.vaDeg),offset=angleOffsets.get(componentId);
  let complete=true;
  if(info.scope==='AC'){
   if(vm===null||gaVm===null){missing('bus',key,'Vm is absent or non-finite');complete=false;}else maximumAbsoluteError.voltagePu=setMax(maximumAbsoluteError.voltagePu,Math.abs(gaVm-vm));
  }
  if(refAngle===null||gaAngle===null||offset===undefined){missing('bus',key,missingAngleComponents.has(componentId)?'island reference angle is unavailable or ambiguous':'Va is absent or non-finite');complete=false;}else maximumAbsoluteError.angleDeg=setMax(maximumAbsoluteError.angleDeg,Math.abs(angleDelta(gaAngle,refAngle+offset)));
  if(complete){counts.buses++;counts.compared++;}
 }

 if(info.scope==='AC'){
  const activeGenNums=new Set<number>();
  for(let i=0;i<genCols!.NUMBER!.length;i++)if(integer(col(genCols!,'STATUS',i))===1){const n=integer(col(genCols!,'NUMBER',i));if(n!==null)activeGenNums.add(n);}
  const resultGens=new Map<string,typeof result.generatorResults[number]>(),duplicateResults=new Set<string>();
  for(const item of result.generatorResults){if(resultGens.has(item.sourceEquipmentId))duplicateResults.add(item.sourceEquipmentId);else resultGens.set(item.sourceEquipmentId,item);}
  const modelEquipment=equipmentIndex(model),networkGens=network.generators.filter(gen=>gen.status===1);
  const expectedGenKeys=new Set<string>();
  for(const gen of networkGens){
   const bus=network.buses[gen.bus],number=externalBus(bus),equipmentRows=modelEquipment.get(gen.sourceEquipmentId)??[],equipment=equipmentRows.length===1?equipmentRows[0]:undefined,machineId=equipment?keyText(equipment.fields.machid??equipment.fields.id):'',key=`${number??'?'}/${machineId}`;
   if(!equipment||equipmentRows.length!==1||number===null||!machineId){missing('generator',key,'source machine identity is missing or ambiguous');continue;}
   const sourceKey=`${number}/${machineId}`;expectedGenKeys.add(sourceKey);
   const rows:number[]=[];for(let i=0;i<genCols!.NUMBER!.length;i++)if(integer(col(genCols!,'NUMBER',i))===number&&keyText(col(genCols!,'ID',i))===machineId&&integer(col(genCols!,'STATUS',i))===1)rows.push(i);
   const resultGen=resultGens.get(gen.sourceEquipmentId);
   if(rows.length!==1||!resultGen||duplicateResults.has(gen.sourceEquipmentId)){missing('generator',key,rows.length>1?'reference machine identity is duplicated':!resultGen||duplicateResults.has(gen.sourceEquipmentId)?'calculation machine row is missing or duplicated':'active machine row is missing from the reference');continue;}
   const pg=finite(col(genCols!,'PGEN',rows[0]!)),qg=finite(col(genCols!,'QGEN',rows[0]!)),gaP=finite(resultGen.pMw),gaQ=finite(resultGen.qMvar);
   if(pg===null||qg===null||gaP===null||gaQ===null){missing('generator',key,'Pg or Qg is absent or not determined');continue;}
   comparePower(gaP,pg);comparePower(gaQ,qg);counts.generators++;counts.compared++;
  }
  for(let i=0;i<genCols!.NUMBER!.length;i++)if(integer(col(genCols!,'STATUS',i))===1){const n=integer(col(genCols!,'NUMBER',i)),id=keyText(col(genCols!,'ID',i));if(n!==null&&!expectedGenKeys.has(`${n}/${id}`))missing('reference generator',`${n}/${id}`,'active source machine row has no normalized generator');}

  const refBranches=new Map<string,number[]>();
  for(let i=0;i<branchCols!.FROMNUMBER!.length;i++){
   if(integer(col(branchCols!,'STATUS',i))!==1)continue;
   const from=integer(col(branchCols!,'FROMNUMBER',i)),to=integer(col(branchCols!,'TONUMBER',i)),id=keyText(col(branchCols!,'ID',i));
   if(from===null||to===null||!id){missing('reference branch',`row ${i+1}`,'endpoint or circuit identity is malformed');continue;}
   const key=`${from}|${to}|${id}`,rows=refBranches.get(key)??[];rows.push(i);refBranches.set(key,rows);
  }
  const refWindings=new Map<string,number[]>();
  for(let i=0;i<windingCols!.WNDNUM!.length;i++){
   if(integer(col(windingCols!,'STATUS',i))!==1)continue;
   const w1=integer(col(windingCols!,'WIND1NUMBER',i)),w2=integer(col(windingCols!,'WIND2NUMBER',i)),w3=integer(col(windingCols!,'WIND3NUMBER',i)),w=integer(col(windingCols!,'WNDNUM',i)),id=keyText(col(windingCols!,'ID',i));
   if(w1===null||w2===null||w3===null||w===null||w<1||w>3||!id){missing('reference winding',`row ${i+1}`,'bus, winding, or circuit identity is malformed');continue;}
   const key=`${w1}|${w2}|${w3}|${id}|${w}`,rows=refWindings.get(key)??[];rows.push(i);refWindings.set(key,rows);
  }
  const resultBranches=new Map<string,PsseBranchResult[]>();
  for(const item of result.branchResults){const rows=resultBranches.get(item.id)??[];rows.push(item);resultBranches.set(item.id,rows);}
  const equipmentMap=equipmentIndex(model),expectedRefBranchKeys=new Set<string>(),expectedRefWindingKeys=new Set<string>();
  const activeBranches=network.branches.filter(branch=>branch.status===1&&network.buses[branch.from]?.status===1&&network.buses[branch.to]?.status===1);
  for(const branch of activeBranches){
   const equipmentRows=equipmentMap.get(branch.sourceEquipmentId)??[],sourceEquipment=equipmentRows.length===1?equipmentRows[0]:undefined,gaRows=resultBranches.get(branch.id)??[],ga=gaRows.length===1?gaRows[0]:undefined;
   if(!sourceEquipment||equipmentRows.length!==1||!ga||ga.sourceEquipmentId!==branch.sourceEquipmentId||ga.terminalFrom!==branch.terminalFrom||ga.terminalTo!==branch.terminalTo){missing(branch.kind==='three-winding-leg'?'winding':'branch',branch.id,'source/result terminal identity is missing, duplicated, or stale');continue;}
   if(branch.kind==='three-winding-leg'){
    const w=integer(Number(branch.windingId)),numbers=[sourceEquipment.fields.ibus,sourceEquipment.fields.jbus,sourceEquipment.fields.kbus].map(integer),from=externalBus(network.buses[branch.from]!);
    if(w===null||w<1||w>3||numbers.some(n=>n===null)||from===null||numbers[w-1]!==from){missing('winding',branch.id,'normalized source winding does not map to its exact external terminal');continue;}
    const key=`${numbers[0]}|${numbers[1]}|${numbers[2]}|${keyText(sourceEquipment.fields.ckt??'1')}|${w}`;expectedRefWindingKeys.add(key);const rows=refWindings.get(key)??[];
    if(rows.length!==1){missing('winding',branch.id,rows.length?'reference winding identity is duplicated':'reference winding row is missing');continue;}
    const i=rows[0]!,rp=finite(col(windingCols!,'P',i)),rq=finite(col(windingCols!,'Q',i)),ap=finite(ga.pFromMw),aq=finite(ga.qFromMvar);
    if(rp===null||rq===null||ap===null||aq===null){missing('winding',branch.id,'external winding P/Q is absent or non-finite');continue;}
    comparePower(ap,rp);comparePower(aq,rq);counts.windings++;counts.compared++;
    continue;
   }
   const from=externalBus(network.buses[branch.from]!),to=externalBus(network.buses[branch.to]!);
   if(from===null||to===null){missing('branch',branch.id,'normalized branch endpoint has no external bus number');continue;}
   const circuit=keyText(sourceEquipment.fields.ckt??'1'),forward=`${from}|${to}|${circuit}`,reverse=`${to}|${from}|${circuit}`;expectedRefBranchKeys.add(forward);expectedRefBranchKeys.add(reverse);
   const forwardRows=refBranches.get(forward)??[],reverseRows=refBranches.get(reverse)??[];
   if(forwardRows.length!==1||reverseRows.length!==1){missing('branch',branch.id,forwardRows.length>1||reverseRows.length>1?'directed circuit identity is duplicated':'both directed reference terminal rows are required');continue;}
   const pFrom=finite(col(branchCols!,'P',forwardRows[0]!)),qFrom=finite(col(branchCols!,'Q',forwardRows[0]!)),pTo=finite(col(branchCols!,'P',reverseRows[0]!)),qTo=finite(col(branchCols!,'Q',reverseRows[0]!)),apFrom=finite(ga.pFromMw),aqFrom=finite(ga.qFromMvar),apTo=finite(ga.pToMw),aqTo=finite(ga.qToMvar);
   if(pFrom===null||qFrom===null||pTo===null||qTo===null||apFrom===null||aqFrom===null||apTo===null||aqTo===null){missing('branch',branch.id,'both-end P/Q values are required and must be finite');continue;}
   comparePower(apFrom,pFrom);comparePower(aqFrom,qFrom);comparePower(apTo,pTo);comparePower(aqTo,qTo);counts.branches+=2;counts.compared+=2;
  }
  for(const [key,rows] of refBranches){if(!expectedRefBranchKeys.has(key))missing('reference branch',key,'active reference row has no normalized physical branch');else if(rows.length>1)missing('reference branch',key,'parallel circuit key is duplicated; circuit ID is required to disambiguate');}
  for(const [key,rows] of refWindings){if(!expectedRefWindingKeys.has(key))missing('reference winding',key,'active reference row has no normalized external winding');else if(rows.length>1)missing('reference winding',key,'source winding identity is duplicated');}
 }else{
  const report=record(ref.dcReport),rawFlows=report?.flows;
  if(!report||!Array.isArray(rawFlows)||!Array.isArray(report.unparsedRows)||report.unparsedRows.length!==0||finite(report.flowResolutionMw)===null||finite(report.flowResolutionMw)!<=0)return resultShell('INCOMPLETE_COMPARISON','DC reference requires a parsed dcReport with finite flow resolution and no unparsed rows.');
  type DcFlow={from:number;to:number|null;circuit:string;p:number;winding:number|null};
  const flows:DcFlow[]=[],flowMap=new Map<string,DcFlow[]>();
  for(let i=0;i<rawFlows.length;i++){
   const item=record(rawFlows[i]),from=integer(item?.from),to=item?.to===null?null:integer(item?.to),circuit=typeof item?.circuit==='string'?item.circuit.trim():null,p=finite(item?.pMw),winding=item?.winding===undefined?null:integer(item.winding);
   if(from===null||circuit===null||!circuit||p===null||(item?.to!==null&&to===null)||(winding!==null&&(winding<1||winding>3))){missing('DC flow',`row ${i+1}`,'flow record is incomplete or non-finite');continue;}
   if((winding===null&&to===null)||(winding!==null&&to!==null)){missing('DC flow',`row ${i+1}`,'ordinary line and winding flow identities must be explicit');continue;}
   const flow={from,to,circuit,p,winding};flows.push(flow);const key=winding===null?`${from}|${to}|${circuit}`:`${from}|${circuit}|${winding}`,rows=flowMap.get(key)??[];rows.push(flow);flowMap.set(key,rows);
  }
  const resultBranches=new Map<string,PsseBranchResult[]>();for(const item of result.branchResults){const rows=resultBranches.get(item.id)??[];rows.push(item);resultBranches.set(item.id,rows);}
  const equipmentMap=equipmentIndex(model),expectedFlowKeys=new Set<string>();
  const activeBranches=network.branches.filter(branch=>branch.status===1&&network.buses[branch.from]?.status===1&&network.buses[branch.to]?.status===1);
  for(const branch of activeBranches){
   const equipmentRows=equipmentMap.get(branch.sourceEquipmentId)??[],equipment=equipmentRows.length===1?equipmentRows[0]:undefined,gaRows=resultBranches.get(branch.id)??[],ga=gaRows.length===1?gaRows[0]:undefined;
   if(!equipment||equipmentRows.length!==1||!ga||ga.sourceEquipmentId!==branch.sourceEquipmentId||ga.terminalFrom!==branch.terminalFrom||ga.terminalTo!==branch.terminalTo){missing(branch.kind==='three-winding-leg'?'winding':'DC flow',branch.id,'source/result terminal identity is missing, duplicated, or stale');continue;}
   const circuit=keyText(equipment.fields.ckt??'1'),from=externalBus(network.buses[branch.from]!);
   if(from===null){missing(branch.kind==='three-winding-leg'?'winding':'DC flow',branch.id,'normalized source terminal has no external bus number');continue;}
   if(branch.kind==='three-winding-leg'){
    const w=integer(Number(branch.windingId)),busNumbers=[equipment.fields.ibus,equipment.fields.jbus,equipment.fields.kbus].map(integer);
    if(w===null||w<1||w>3||busNumbers.some(n=>n===null)||busNumbers[w-1]!==from){missing('winding',branch.id,'normalized winding does not map to its exact external terminal');continue;}
    const key=`${from}|${circuit}|${w}`,rows=flowMap.get(key)??[];expectedFlowKeys.add(key);
    if(rows.length!==1){missing('winding',branch.id,rows.length?'DC winding flow is ambiguous':'DC winding flow is missing');continue;}
    const actual=finite(ga.pFromMw);if(actual===null){missing('winding',branch.id,'calculated external winding P is unavailable');continue;}
    comparePower(actual,rows[0]!.p);counts.windings++;counts.compared++;continue;
   }
   const to=externalBus(network.buses[branch.to]!);if(to===null){missing('branch',branch.id,'normalized destination has no external bus number');continue;}
   const forward=`${from}|${to}|${circuit}`,reverse=`${to}|${from}|${circuit}`,rowsFrom=flowMap.get(forward)??[],rowsTo=flowMap.get(reverse)??[];expectedFlowKeys.add(forward);expectedFlowKeys.add(reverse);
   if(rowsFrom.length!==1||rowsTo.length!==1){missing('DC flow',branch.id,rowsFrom.length>1||rowsTo.length>1?'directed circuit flow is ambiguous':'both directed DC flow rows are required');continue;}
   const actualFrom=finite(ga.pFromMw),actualTo=finite(ga.pToMw);if(actualFrom===null||actualTo===null){missing('DC flow',branch.id,'both calculated terminal P flows are required');continue;}
   comparePower(actualFrom,rowsFrom[0]!.p);comparePower(actualTo,rowsTo[0]!.p);counts.branches+=2;counts.compared+=2;
  }
  for(const [key,rows] of flowMap){if(!expectedFlowKeys.has(key))missing('DC flow',key,'active reference flow has no normalized physical branch or winding');else if(rows.length>1)missing('DC flow',key,'directed circuit flow identity is duplicated');}
  // DCLF has no supported Vm, Q, or per-machine dispatch comparison. The AC
  // branch P/Q arrays are intentionally not read in this scope.
 }

 const activeExpected=activePhysicalBuses.length>0;
 if(!activeExpected||counts.compared===0){details.push('No required reference quantities were successfully compared.');}
 details.push(`Scope: ${info.scope==='AC'?'active physical bus Vm/Va, active machine Pg/Qg, both-end ordinary branch P/Q, and external 3W winding P/Q':'active physical bus Va and P-only directed ordinary branch/3W winding DC flows'}; inactive rows, internal 3W stars, and unsupported DC Vm/Q/machine values are excluded.`);
 details.push(`Compared ${counts.compared} complete records: ${counts.buses} buses, ${counts.branches} directed ordinary branch terminals, ${counts.windings} external 3W windings, ${counts.generators} machines; ${counts.missing} required rows or values are missing or ambiguous.`);
 details.push(`Maximum absolute error: voltage ${maximumAbsoluteError.voltagePu??'n/a'} pu; angle ${maximumAbsoluteError.angleDeg??'n/a'} degrees; P/Q or DC P ${maximumAbsoluteError.powerMvar??'n/a'} MW/Mvar.`);
 details.push(`Acceptance gates: |ΔVm| ≤ ${AC_LIMITS.voltagePu} pu, |ΔVa| ≤ ${AC_LIMITS.angleDeg}°, |ΔP/Q| ≤ ${AC_LIMITS.powerMvar} MW/Mvar; DC P uses the same ${AC_LIMITS.powerMvar} MW contract gate.`);
 if(missingNotes.length)details.push(`Missing details: ${missingNotes.join('; ')}${counts.missing>missingNotes.length?`; plus ${counts.missing-missingNotes.length} more`:''}.`);
 details.push(`GA physics coverage: ${result.physicsCoverage}. Reference optionsHash is treated as reference provenance and is not compared with the GA optionsHash.`);
 const complete=counts.missing===0&&counts.compared>0&&activeExpected;
 const withinLimits=(maximumAbsoluteError.voltagePu===null||maximumAbsoluteError.voltagePu<=AC_LIMITS.voltagePu)&&(maximumAbsoluteError.angleDeg===null||maximumAbsoluteError.angleDeg<=AC_LIMITS.angleDeg)&&(maximumAbsoluteError.powerMvar===null||maximumAbsoluteError.powerMvar<=AC_LIMITS.powerMvar);
 const status:PsseReferenceComparisonStatus=!complete?'INCOMPLETE_COMPARISON':withinLimits?'MATCHED':'DIFFERENT';
 return{status,sourceSha256,method,counts,maximumAbsoluteError,details};
}
