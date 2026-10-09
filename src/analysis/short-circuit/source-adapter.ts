export interface ScAuditField {sourceClass:string;fid:string;inService:boolean|null;field:string;actualValue:unknown;unit:string;physicalValidation:string;sourceRef:string;IECRequirement:string;status:string;reason:string}
export interface ScSource {sourceClass:string;fid:string;bus:string;additionalBuses?:string[];inService:boolean;rOhm:number|null;xOhm:number|null;reason:string;sourceRef:string}
export interface ScSourceContext {modelHash:string;sources:ScSource[];audit:ScAuditField[];invalidBranches:{sourceClass:string;fid:string;reason:string}[]}
