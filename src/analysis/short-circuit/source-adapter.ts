export interface ScAuditField {sourceClass:string;fid:string;inService:boolean|null;field:string;actualValue:unknown;unit:string;physicalValidation:string;sourceRef:string;IECRequirement:string;status:string;reason:string}
export interface ScSource {sourceClass:string;fid:string;bus:string;additionalBuses?:string[];inService:boolean;rOhm:number|null;xOhm:number|null;reason:string;sourceRef:string;currentKa?:number;currentAngleDeg?:number}
export interface ScSourceContext {modelHash:string;sources:ScSource[];audit:ScAuditField[];calculateMode?:'MAX'|'MIN';allowMixedNominalKv?:boolean;assumptions?:string[];invalidBranches:{sourceClass:string;fid:string;reason:string}[]}

export interface ScAdapterOptions {
  mode?:'MAX'|'MIN';
  missingMachineXdssPu?:number;missingMachineRPu?:number;
  externalGridFactor?:import('../../importers/powerfactory-benchmark/external-grid-equivalent').ExternalGridFactor;
  converterAngleDeg?:number;converterTerminalBasis?:boolean;
  allowMixedNominalKv?:boolean;provenance?:string;
  overrides?:{sourceClass:string;fid:string;rOhm:number;xOhm:number;provenance:string}[];
}
