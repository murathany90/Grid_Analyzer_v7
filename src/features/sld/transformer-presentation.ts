import type {Transformer2W} from '../../domain/model/network';
import type {StationSourceRow} from '../../domain/model/station-topology';
export interface TransformerWinding {side:'HV'|'MV'|'LV';terminalId:string|null;cubicleId:string|null;nominalKv:number|null;tapSide:boolean}
const number=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?v:null;
/** Source ports remain a visual projection. A 3W source never becomes a fabricated 2W solver branch. */
export function transformerPresentation(raw:StationSourceRow|null,type:StationSourceRow|null,cubicles:readonly StationSourceRow[],canonical?:Transformer2W){
  const three=!canonical&&!!raw?.attributes.busmv,fields=three?[['HV','bushv','utrn_h'],['MV','busmv','utrn_m'],['LV','buslv','utrn_l']]:[['HV','bushv','utrn_h'],['LV','buslv','utrn_l']];
  const windings:TransformerWinding[]=fields.map(([side,field,kv],i)=>{const cubId=String(raw?.attributes[field]??''),cub=cubicles.find(c=>c.id===cubId);return {side:side as TransformerWinding['side'],cubicleId:cubId||null,terminalId:cub?String(cub.attributes.fold_id??'')||null:canonical?(i===0?canonical.from:canonical.to):null,nominalKv:number(type?.attributes[kv]),tapSide:number(type?.attributes.tap_side)===i};});
  // The current DGS profile has no verified autotransformer discriminator.
  return {kind:three?'THREE_WINDING':'TWO_WINDING',typeVerification:'AUTOTRANSFORMER_CLASSIFICATION_UNVERIFIED',calculationSupport:three||!canonical?'UNSUPPORTED':'CANONICAL_2W_PARTIAL_SOURCE_FIDELITY',windings,ratingMva:number(type?.attributes.strn)??canonical?.ratingMva??null,tapPosition:number(raw?.attributes.nntap)??canonical?.tapPosition??null,tapRange:[number(type?.attributes.ntpmn),number(type?.attributes.ntpmx)],vectorGroup:[type?.attributes.tr2cn_h??null,type?.attributes.tr2cn_l??null],sourceTypeId:type?.id??null};
}
