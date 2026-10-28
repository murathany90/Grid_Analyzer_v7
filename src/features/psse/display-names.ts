import type {PsseBranch,PsseBus,PsseBusBranchNetwork} from '../../domain/psse/network';
import type {PsseEquipment,PsseModel} from '../../importers/psse/types';
import {normalizeSourceAlias} from './geography';

export interface PsseDisplayNames {
 bus(bus:PsseBus):string;
 station(bus:PsseBus):string|null;
 branch(branch:PsseBranch):string;
 equipment(id:string):string;
 busTitle(bus:PsseBus):string;
 branchTitle(branch:PsseBranch):string;
 busSearchText(bus:PsseBus):string;
}
const cache=new WeakMap<PsseModel,WeakMap<PsseBusBranchNetwork,PsseDisplayNames>>();
const text=(value:unknown)=>typeof value==='string'?value.trim():'';
/** A source label is never decoded from a technical ID or inferred from a nearby city. */
function sourceName(equipment:PsseEquipment|undefined):string{
 if(!equipment)return'';
 const technical=new Set([equipment.id,String(equipment.fields.connectionKey??''),String(equipment.fields.ibus??''),String(equipment.fields.packedNumbus??'')]);
 return[text(equipment.fields.name),text(equipment.name)].find(name=>name&&!technical.has(name))??'';
}
function stationId(value:unknown):string|null{if(typeof value==='number'&&Number.isSafeInteger(value)&&value>=0)return String(value);if(typeof value==='string'&&/^\d+$/.test(value.trim()))return String(Number(value.trim()));return null;}

/** Cached exact source names and source ISUB/name associations, independent of coordinate availability. */
export function createPsseDisplayNames(model:PsseModel,network:PsseBusBranchNetwork):PsseDisplayNames{
 let byNetwork=cache.get(model);if(!byNetwork){byNetwork=new WeakMap();cache.set(model,byNetwork);}const previous=byNetwork.get(network);if(previous)return previous;
 const equipmentById=new Map(model.equipment.map(equipment=>[equipment.id,equipment])),busByKey=new Map(network.buses.map(bus=>[bus.connectionKey,bus])),stationById=new Map<string,PsseEquipment[]>(),stationsByName=new Map<string,PsseEquipment[]>();
 for(const equipment of model.equipment){if(equipment.kind!=='substation')continue;const id=stationId(equipment.fields.isub)??stationId(equipment.id),name=normalizeSourceAlias(sourceName(equipment));if(id!==null)stationById.set(id,[...(stationById.get(id)??[]),equipment]);if(name)stationsByName.set(name,[...(stationsByName.get(name)??[]),equipment]);}
 const source=(bus:PsseBus)=>bus.sourceEquipmentId?equipmentById.get(bus.sourceEquipmentId):undefined;
 const station=(bus:PsseBus):string|null=>{if(!bus.source)return null;const equipment=source(bus);if(!equipment)return null;const raw=equipment.fields.isub,explicit=raw!==null&&raw!==undefined&&raw!=='',id=stationId(raw),candidates=explicit?(id===null?[]:stationById.get(id)??[]):stationsByName.get(normalizeSourceAlias(sourceName(equipment)))??[];return candidates.length===1?sourceName(candidates[0])||null:null;};
 const bus=(item:PsseBus):string=>{if(!item.source)return'3 sargılı trafo ortak düğümü';const name=sourceName(source(item)),technical=new Set([item.id,item.connectionKey,String(item.externalNumber??'')]);return(name&&!technical.has(name)?name:'')||station(item)||'Adı kayıtlı olmayan bara';};
 const kv=(value:number|null)=>value!==null&&Number.isFinite(value)&&value>0?`${value.toLocaleString('tr-TR',{maximumFractionDigits:2})} kV`:'';
 const endpoints=(branch:PsseBranch)=>[busByKey.get(branch.fromKey)??network.buses[branch.from],busByKey.get(branch.toKey)??network.buses[branch.to]].map(item=>item?[station(item)||bus(item),kv(item.baseKv)].filter(Boolean).join(' '):'Kaynak ucu eşleşmedi').join(' → ');
 const branch=(item:PsseBranch):string=>{const record=equipmentById.get(item.sourceEquipmentId),name=sourceName(record),kind=item.kind==='line'?'Hat':item.kind==='transformer'?'Trafo':'3 sargılı trafo',circuit=record?.fields.ckt??(item.kind==='three-winding-leg'?null:item.windingId),parts=[name,endpoints(item),kind,circuit!==null&&circuit!==undefined&&String(circuit).trim()?`Devre ${String(circuit).trim()}`:'',item.kind==='three-winding-leg'?`Sargı ${item.windingId}`:''];return parts.filter(Boolean).join(' · ');};
 const equipment=(id:string):string=>{const item=equipmentById.get(id),normalized=network.branches.find(branch=>branch.sourceEquipmentId===id);if(normalized)return branch(normalized);const busItem=network.buses.find(bus=>bus.sourceEquipmentId===id);if(busItem)return bus(busItem);const name=sourceName(item);if(name)return name;const key=String(item?.fields.connectionKey??item?.buses[0]??''),at=busByKey.get(key),kind=item?.kind==='generator'?'Jeneratör':item?.kind==='load'?'Yük':item?.kind==='shunt'?'Şönt':item?.kind==='switch'?'Anahtar':'Ekipman';return at?`${kind} · ${bus(at)}`:'Adı kayıtlı olmayan ekipman';};
 const result:PsseDisplayNames={bus,station,branch,equipment,busTitle:item=>`${bus(item)} · ${item.id} · bağlantı ${item.connectionKey}${item.externalNumber===null?'':` · bara ${item.externalNumber}`}`,branchTitle:item=>`${branch(item)} · ${item.id} · kaynak ${item.sourceEquipmentId} · ${item.terminalFrom} → ${item.terminalTo}`,busSearchText:item=>{const record=source(item);return[bus(item),station(item),item.id,item.connectionKey,item.externalNumber,record?.fields.name,record?.name].filter(value=>value!==null&&value!==undefined).join(' · ');}};
 byNetwork.set(network,result);return result;
}
