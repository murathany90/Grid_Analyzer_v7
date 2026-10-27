import {sha256} from '@noble/hashes/sha2.js';
import type {PsseBusBranchNetwork} from './network';
export interface PsseScenarioOperation {equipmentId:string;action:'STATUS'|'GENERATOR_P'|'LOAD_SCALE'|'FIXED_TAP'|'FIXED_PHASE'|'FIXED_SHUNT';value:number|boolean}
export interface PsseScenario {schema:'ga.psse.scenario.v1';networkHash:string;operations:readonly PsseScenarioOperation[];hash:string}
const digest=(s:string)=>Array.from(sha256(new TextEncoder().encode(s)),x=>x.toString(16).padStart(2,'0')).join('');
/** Build a sorted immutable set of only the scenario operations the solvers actually apply. */
export function createPsseScenario(network:PsseBusBranchNetwork,operations:readonly PsseScenarioOperation[]=[]):PsseScenario{
 if(!Array.isArray(operations))throw Error('PSSE_SCENARIO_OPERATIONS_INVALID');
 const sorted=operations.map((op,index)=>{if(!op||typeof op!=='object'||typeof op.equipmentId!=='string'||!op.equipmentId.trim())throw Error(`PSSE_SCENARIO_OPERATION_INVALID:${index}`);return {equipmentId:op.equipmentId,action:op.action,value:op.value};}).sort((a,b)=>a.equipmentId.localeCompare(b.equipmentId)||a.action.localeCompare(b.action));
 const seen=new Set<string>();
 for(const op of sorted){const key=`${op.equipmentId}\u0000${op.action}`;if(seen.has(key))throw Error(`PSSE_SCENARIO_DUPLICATE_OPERATION:${op.equipmentId}:${op.action}`);seen.add(key);
  if(op.action==='STATUS'){const exists=[...network.branches,...network.generators,...network.loads,...network.shunts].some(x=>x.sourceEquipmentId===op.equipmentId);if(!exists)throw Error(`PSSE_SCENARIO_UNKNOWN_EQUIPMENT:${op.equipmentId}`);if(typeof op.value==='boolean')continue;if(typeof op.value!=='number'||!Number.isInteger(op.value)||![0,1].includes(op.value))throw Error('PSSE_SCENARIO_STATUS_RANGE');}
  else if(op.action==='GENERATOR_P'){const units=network.generators.filter(g=>g.sourceEquipmentId===op.equipmentId);if(!units.length)throw Error(`PSSE_SCENARIO_ACTION_TARGET_MISMATCH:GENERATOR_P:${op.equipmentId}`);if(typeof op.value!=='number'||!Number.isFinite(op.value))throw Error('PSSE_SCENARIO_GENERATOR_P_VALUE');if(units.length!==1)throw Error(`PSSE_SCENARIO_AMBIGUOUS_GENERATOR_TARGET:${op.equipmentId}`);const g=units[0];if(g.pMinMw!==null&&op.value<g.pMinMw-1e-8||g.pMaxMw!==null&&op.value>g.pMaxMw+1e-8)throw Error(`PSSE_SCENARIO_GENERATOR_P_RANGE:${op.equipmentId}`);}
  else if(op.action==='LOAD_SCALE'){const loads=network.loads.filter(load=>load.sourceEquipmentId===op.equipmentId);if(!loads.length)throw Error(`PSSE_SCENARIO_ACTION_TARGET_MISMATCH:LOAD_SCALE:${op.equipmentId}`);if(typeof op.value!=='number'||!Number.isFinite(op.value)||op.value<0)throw Error('PSSE_SCENARIO_LOAD_SCALE_RANGE');}
  else throw Error(`PSSE_SCENARIO_ACTION_UNSUPPORTED:${op.action}`);
 }
 const frozen=Object.freeze(sorted.map(op=>Object.freeze({...op}))),body={schema:'ga.psse.scenario.v1' as const,networkHash:network.modelHash,operations:frozen},hash=digest(JSON.stringify(body));return Object.freeze({...body,hash});
}
