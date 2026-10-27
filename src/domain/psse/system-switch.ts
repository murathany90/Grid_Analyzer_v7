import type {PsseModel} from '../../importers/psse/types';
import type {PsseBranch,PsseBusBranchNetwork} from './network';

export interface PsseSwitchThreshold {
 valuePu:number;
 source:string;
 scalarPrecision:'F32'|'F64';
}
export interface PsseGeneralScalar {value:number|null;source:string;scalarPrecision:'F32'|'F64';explicit:boolean}

const finite=(value:unknown):number|null=>{const parsed=typeof value==='number'?value:typeof value==='string'&&value.trim()?Number(value):Number.NaN;return Number.isFinite(parsed)?parsed:null;};
function record(value:unknown):Record<string,unknown>|null{return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:null;}

/** Reads an explicitly retained PSS/E GENERAL scalar without changing the native decoder contract. */
export function psseGeneralScalar(model:PsseModel,key:string,savHeadreIndex?:number,defaultValue=Number.NaN):PsseGeneralScalar{
 const wanted=key.toUpperCase();
 if(model.source.format==='SAV'&&savHeadreIndex!==undefined){const values=model.binaryArrays?.Headre?.values;if(values&&savHeadreIndex<values.length){const parsed=finite(values[savHeadreIndex]);return{value:parsed,source:`SAV.Headre[${savHeadreIndex+1}]`,scalarPrecision:'F32',explicit:true};}}
 const sources:[unknown,string][]=[[model.case.general,'source case GENERAL'],[(model.sourceTables.GENERAL as Record<string,unknown>[]|undefined)?.[0],'sourceTables.GENERAL'],[model.case,'source case']];
 for(const [candidate,source]of sources){const row=record(candidate);if(!row)continue;for(const [field,value]of Object.entries(row))if(field.toUpperCase()===wanted||(wanted==='THRSHZ'&&field.toUpperCase()==='THRESHZ'))return{value:finite(value),source:`${source}.${field}`,scalarPrecision:'F64',explicit:true};}
 const systemWide=model.sourceTables.SYSTEM_WIDE;if(Array.isArray(systemWide))for(const candidate of systemWide){const row=record(candidate);if(!row)continue;const tokens=Array.isArray(row.sourceTokens)?row.sourceTokens:[];const header=String(tokens[0]??row.sourceField1??'').trim().toUpperCase();if(header!=='GENERAL')continue;for(const token of tokens){const match=typeof token==='string'?token.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i):null;if(match&&match[1]!.toUpperCase()===wanted)return{value:finite(match[2]),source:`RAW.SYSTEM_WIDE.GENERAL.${wanted}`,scalarPrecision:'F64',explicit:true};}}
 return{value:Number.isFinite(defaultValue)?defaultValue:null,source:`PSS/E 36.5 default ${wanted}`,scalarPrecision:'F64',explicit:false};
}

/** PSS/E 36 switch threshold, retaining the saved scalar precision used by the source. */
export function psseZeroImpedanceThreshold(model:PsseModel):PsseSwitchThreshold{
 const scalar=psseGeneralScalar(model,'THRSHZ',11,.0001);return{valuePu:scalar.value??Number.NaN,source:scalar.source,scalarPrecision:scalar.scalarPrecision};
}

/** Source system switches with zero R and |X| at/below THRSHZ use the PSS/E ideal-switch contract. */
export function psseBypassFlag(model:PsseModel,equipment:PsseModel['equipment'][number]):number|null{
 if(equipment.kind!=='line'&&equipment.kind!=='switch')return 0;const raw=equipment.fields.bp??equipment.fields.bypass;if(raw===null||raw===undefined||raw==='')return model.source.format==='SAV'?null:0;const value=typeof raw==='boolean'?(raw?1:0):Number(raw);return Number.isFinite(value)?value:null;
}

export function isPsseContractibleZeroImpedanceLink(model:PsseModel,branch:PsseBranch,threshold=psseZeroImpedanceThreshold(model),equipmentById?:ReadonlyMap<string,PsseModel['equipment'][number]>) {
 const equipment=equipmentById?equipmentById.get(branch.sourceEquipmentId):model.equipment.find(item=>item.id===branch.sourceEquipmentId);if(!equipment||(equipment.kind!=='switch'&&equipment.kind!=='line')||branch.rPu!==0||!Number.isFinite(branch.xPu)||threshold.valuePu<0||psseBypassFlag(model,equipment)!==0)return false;
 if(threshold.valuePu===0)return false;
 if(threshold.scalarPrecision==='F32')return Math.fround(Math.abs(branch.xPu))<=Math.fround(threshold.valuePu);
 return Math.abs(branch.xPu)<=threshold.valuePu;
}

export function psseSystemSwitchBySource(network:PsseBusBranchNetwork){return new Map(network.branches.filter(branch=>branch.sourceEquipmentId).map(branch=>[branch.sourceEquipmentId,branch] as const));}

export function activePsseBypassBranches(model:PsseModel,network:PsseBusBranchNetwork){const active=new Set(network.branches.filter(branch=>branch.status===1).map(branch=>branch.sourceEquipmentId));return model.equipment.filter(equipment=>(equipment.kind==='line'||equipment.kind==='switch')&&active.has(equipment.id)&&psseBypassFlag(model,equipment)!==0).map(equipment=>equipment.id);}
