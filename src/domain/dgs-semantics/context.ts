export interface ContextRef { id:string; name:string; sourceClass:string }
export interface EngineeringContext {
  sites:ContextRef[]; areas:ContextRef[]; groups:ContextRef[]; bays:ContextRef[]; terminals:ContextRef[];
  connectedEquipment:ContextRef[]; connectedEquipmentCount:number|null;
  voltageKv:number|null; lvKv:number|null; ratingMva:number|null; typeName:string|null;
  fromSite:string|null; toSite:string|null;
  sourceRefs:{field:string;id:string;sourceClass:string|null}[];
}
