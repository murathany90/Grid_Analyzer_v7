/** Original browser-native PSS/E inspection contract. Source values are never solver results. */
export type PsseKind='substation'|'bus'|'line'|'transformer'|'generator'|'load'|'shunt'|'switch'|'node'|'terminal'|'dc'|'facts'|'other';
export const psseKinds:PsseKind[]=['substation','bus','line','transformer','generator','load','shunt','switch','node','terminal','dc','facts','other'];
export interface SourceValue {value:number|string|boolean|null; provenance:'SOURCE_SAVED'|'SOURCE_INPUT'|'DERIVED_FROM_SOURCE'; field:string; offset?:number; unit?:string}
export interface PsseEquipment {id:string;kind:PsseKind;name:string;buses:number[];status:number|null;nominalKv:number|null;fields:Record<string,unknown>;operating:Record<string,SourceValue>}
export interface PsseFinding {severity:'ERROR'|'WARNING'|'INFO';code:string;message:string;equipment?:string}
export interface PsseBinaryArray {type:string;count:number;offset:number;values:(number|string|number[])[]}
export interface PsseModel {
 schema:'ga.psse.native.v1';
 source:{name:string;format:'SAV'|'RAW'|'RAWX';byteLength:number;sha256:string;revision:number};
 case:{baseMva:number;frequencyHz:number|null;title:string[];[key:string]:unknown};
 equipment:PsseEquipment[];
 /** Unmapped source records/arrays remain available for inspection/export. */
 sourceTables:Record<string,unknown>;
 binaryArrays?:Record<string,PsseBinaryArray>;
 findings:PsseFinding[];
 completeness:'COMPLETE'|'PARTIAL';
 analyses:{powerFlow:'BLOCKED';shortCircuit:'BLOCKED';n1:'BLOCKED'};
 sourceResults:{type:string;evidence:string;values:unknown}[];
 timing:{decodeMs:number};
}
export interface PsseProgress {phase:string;fraction:number}
