import type {ScSourceContext} from './source-adapter';

/** Missing evidence for this implementation's gates; never synthesizes electrical inputs. */
export function scEvidenceReport(context:ScSourceContext|null){
  const missing=new Map<string,{sourceClass:string;field:string;unit:string;count:number}>();
  for(const row of context?.audit??[])if(['MISSING','NEGATIVE_NONFINITE_OR_SENTINEL'].includes(row.physicalValidation)){
    const key=row.sourceClass+':'+row.field,entry=missing.get(key)??{sourceClass:row.sourceClass,field:row.field,unit:row.unit,count:0};entry.count++;missing.set(key,entry);
  }
  const blocked=new Map<string,number>();for(const source of context?.sources??[])if(source.inService&&source.reason)blocked.set(source.reason,(blocked.get(source.reason)??0)+1);
  return {status:context?'IEC_PF_PARITY_UNVERIFIED':'MODEL_SOURCE_CONTEXT_MISSING',missingOrInvalidNativeFields:[...missing.values()],activeSourceBlockers:[...blocked].map(([reason,count])=>({reason,count})),requiredIndependentExports:[
    'SC run manifest: model/scenario identity, IEC edition, 3PH MAX/MIN, cmax/cmin and source method',
    'Source equivalents with physical terminal FID, service state, R/X ohm or machine rstr/xdss pu with ugn/sgn/ngnum and correction provenance',
    'Converter native current, MAX/MIN contribution, angle and physical terminal/nominal basis',
    'Transformer KT and machine KG/KKW evidence for the selected IEC method',
    'Complete SC_CalculationBus_Raw physical terminal membership and nominal kV for each PF fault partition',
  ],assumptions:context?.assumptions??[],adapterOptions:context?.adapterOptions??null};
}
