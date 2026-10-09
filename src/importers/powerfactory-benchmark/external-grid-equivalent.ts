export interface ExternalGridInputs {ikss:unknown;snss:unknown;rntxn:unknown;nominalKv:number}
export interface ExternalGridFactor {value:number;provenance:string}
/** Only native ElmXnet INPUT fault levels, never solved SC workbook results.
 * PF 2024 ElmXnet technical reference, section 3.1 equations (4)/(5).
 * The separately supplied source c is an assumption unless independently verified.
 */
export function externalGridEquivalent(input:ExternalGridInputs,factor?:ExternalGridFactor):{rOhm:number|null;xOhm:number|null;reason:string} {
  const valid=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<99999;
  if(!factor||!Number.isFinite(factor.value)||factor.value<=0||!factor.provenance.trim())return {rOhm:null,xOhm:null,reason:'MISSING_IEC_FACTOR: EXTERNAL_GRID_SOURCE_C_NOT_SUPPLIED'};
  if(!valid(input.rntxn)||!(input.nominalKv>0&&Number.isFinite(input.nominalKv)))return {rOhm:null,xOhm:null,reason:'INVALID_UNIT: EXTERNAL_GRID_RATIO_OR_KV'};
  const current=valid(input.ikss)&&input.ikss>0?input.ikss:null,power=valid(input.snss)&&input.snss>0?input.snss:null;
  if(current===null&&power===null)return {rOhm:null,xOhm:null,reason:'MISSING_SOURCE_MODEL: NATIVE_INPUT_FAULT_LEVEL'};
  const fromCurrent=current===null?null:Math.sqrt(3)*input.nominalKv*current;
  if(power!==null&&fromCurrent!==null&&Math.abs(power/fromCurrent-1)>1e-6)return {rOhm:null,xOhm:null,reason:'MISSING_SOURCE_MODEL: AMBIGUOUS_NATIVE_FAULT_LEVEL_MODE'};
  const xOhm=factor.value*input.nominalKv**2/((power??fromCurrent!)*Math.sqrt(1+input.rntxn**2));
  return {rOhm:input.rntxn*xOhm,xOhm,reason:''};
}
