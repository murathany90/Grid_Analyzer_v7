import {sha256} from '@noble/hashes/sha2.js';
import {bytesToHex} from '@noble/hashes/utils.js';
import type {PsseModel,PsseEquipment,PsseKind,SourceValue} from './types';
export type SourceRow=Record<string,unknown>;
export const n=(v:unknown,label='number'):number=>{if(v===null||v===undefined||v==='')throw Error(`Missing ${label}`);const a=typeof v==='number'?v:Number(String(v).replace(/[dD]/g,'E'));if(!Number.isFinite(a))throw Error(`Invalid ${label}: ${String(v).slice(0,80)}`);return a;};
export const integer=(v:unknown,label='integer'):number=>{const a=n(v,label);if(!Number.isSafeInteger(a))throw Error(`Invalid ${label}`);return a;};
export const optional=(v:unknown):number|null=>v===null||v===undefined||v===''?null:n(v);
export const s=(v:unknown)=>v===null||v===undefined?'':String(v).trim();
export const value=(v:number|string|boolean|null,field:string,unit?:string,derived=false,offset?:number):SourceValue=>({value:v,field,unit,provenance:derived?'DERIVED_FROM_SOURCE':'SOURCE_SAVED',...(offset===undefined?{}:{offset})});
export function newModel(bytes:Uint8Array,name:string,format:PsseModel['source']['format'],revision:number,baseMva:number,frequencyHz:number|null,title:string[]):PsseModel {
 if(!(baseMva>0))throw Error('Invalid system MVA base');
 return {schema:'ga.psse.native.v1',source:{name,format,revision,byteLength:bytes.length,sha256:bytesToHex(sha256(bytes))},case:{baseMva,frequencyHz,title},equipment:[],sourceTables:{},findings:[],completeness:'COMPLETE',analyses:{powerFlow:'BLOCKED',shortCircuit:'BLOCKED',n1:'BLOCKED'},sourceResults:[],timing:{decodeMs:0}};
}
export function addEquipment(model:PsseModel,kind:PsseKind,id:string,fields:SourceRow,buses:number[],status:number|null,name='',operating:PsseEquipment['operating']={}):PsseEquipment {
 const e:PsseEquipment={kind,id:`${kind}:${id}`,name,buses,status,nominalKv:null,fields,operating};model.equipment.push(e);return e;
}
/** Validate the inspection model without certifying any analysis. Never silently repair source IDs. */
export function validatePsse(model:PsseModel):void {
 const buses=new Map<number,PsseEquipment>(),ids=new Set<string>();
 const finding=(code:string,message:string,equipment?:string)=>model.findings.push({severity:'ERROR',code,message,equipment});
 for(const e of model.equipment){
  if(ids.has(e.id))throw Error(`DUPLICATE_EQUIPMENT_ID: ${e.id}`);ids.add(e.id);
  if(e.kind==='bus'){const b=integer(e.fields.connectionKey??e.fields.ibus,'bus identity');if(b<=0||buses.has(b))throw Error(`DUPLICATE_OR_INVALID_BUS: ${b}`);buses.set(b,e);e.nominalKv=n(e.fields.baskv,'bus base kV');if(e.nominalKv<0)throw Error(`Invalid base kV: ${b}`);if(e.nominalKv===0)model.findings.push({severity:'WARNING',code:'UNSPECIFIED_BASE_KV',message:`${b}: kaynak nominal gerilimi 0; gerilim tabanı türetilmedi.`,equipment:e.id});}
 }
 if(!buses.size)throw Error('NO_ELECTRICAL_BUSES');
 for(const e of model.equipment){
  for(const b of e.buses)if(!buses.has(b))throw Error(`MISSING_TERMINAL_BUS: ${e.id} -> ${b}`);
  if(e.nominalKv===null&&e.buses.length)e.nominalKv=buses.get(e.buses[0])!.nominalKv;
 }
 const activeGenerators=new Set(model.equipment.filter(e=>e.kind==='generator'&&e.status===1).flatMap(e=>e.buses));
 const slack=new Set([...buses].filter(([b,e])=>n(e.fields.ide)===3&&e.status===1&&activeGenerators.has(b)).map(([b])=>b));
 if(!slack.size)finding('NO_ACTIVE_SLACK','Aktif referans bara ve o baraya bağlı devrede jeneratör bulunamadı.');
 for(const [b,e]of buses)if(n(e.fields.ide)===3&&!activeGenerators.has(b))finding('SLACK_WITHOUT_ACTIVE_GENERATOR',`Referans bara ${b} üzerinde devrede jeneratör yok.`,e.id);
 const adjacency=new Map<number,number[]>();for(const b of buses.keys())adjacency.set(b,[]);
 for(const e of model.equipment)if(['line','transformer','switch'].includes(e.kind)&&e.status!==0&&e.buses.length>1){
  // Three-winding status 2/3/4 disconnects winding 2/3/1 respectively (RAW contract).
  const disconnected=e.kind==='transformer'&&e.buses.length===3&&e.status!==1?({2:1,3:2,4:0} as Record<number,number>)[e.status??0]:undefined;
  const active=e.buses.filter((_,i)=>i!==disconnected&&buses.get(e.buses[i])!.status===1);
  for(let i=1;i<active.length;i++){adjacency.get(active[0])!.push(active[i]);adjacency.get(active[i])!.push(active[0]);}
 }
 const visited=new Set<number>();let islands=0,noSlack=0;
 for(const [b,e]of buses){if(e.status!==1||e.fields.threeWindingStar===true||visited.has(b))continue;islands++;const queue=[b];visited.add(b);let reference=false;for(let i=0;i<queue.length;i++){const current=queue[i];reference||=slack.has(current);for(const next of adjacency.get(current)!)if(!visited.has(next)&&buses.get(next)!.status===1){visited.add(next);queue.push(next);}}if(!reference)noSlack++;}
 model.case.activeIslands=islands;if(noSlack)finding('ISLAND_WITHOUT_ACTIVE_SLACK',`${noSlack}/${islands} aktif adada doğrulanmış aktif referans kaynak yok.`);
 const nodeIds=new Set(model.equipment.filter(e=>e.kind==='node').map(e=>`${e.fields.isub}:${e.fields.inode}`));
 for(const e of model.equipment){
  if(e.kind==='terminal'&&!nodeIds.has(`${e.fields.isub}:${e.fields.inode}`))throw Error(`MISSING_NODE_TERMINAL: ${e.id}`);
  if(e.kind==='switch'&&e.fields.isub!==undefined){for(const key of ['inode','jnode'])if(!nodeIds.has(`${e.fields.isub}:${e.fields[key]}`))throw Error(`MISSING_SWITCH_NODE: ${e.id}`);}
 }
 model.findings.push({severity:'INFO',code:'INSPECTION_ONLY',message:'Kaynak envanteri ve kayıtlı işletme noktası. GA yük akışı, kısa devre ve N-1 hesaplanmadı; analizler BLOCKED.'});
 if(model.findings.some(f=>f.severity==='ERROR'||f.code==='UNSUPPORTED_SOURCE_MODEL'||f.code==='UNSPECIFIED_BASE_KV'))model.completeness='PARTIAL';
}
