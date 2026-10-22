/** Numerical origin and accuracy are separate from legacy workflow/control statuses. */
export type ResultQuality='REFERENCE_VALIDATED'|'NATIVE_COMPUTED'|'ENGINEERING_APPROX'|'DC_SCREEN_ONLY'|'NOT_COMPUTABLE'|'REFERENCE_ONLY';
export interface EngineeringAssumption {id:string;value:number|string;unit:string;source:string;affects:string[];reason:string}
export const RESULT_QUALITY_LABELS:Record<ResultQuality,string>={REFERENCE_VALIDATED:'Referansla doğrulandı',NATIVE_COMPUTED:'Modelden hesaplandı',ENGINEERING_APPROX:'Mühendislik yaklaşımı',DC_SCREEN_ONLY:'Yalnız DC tarama',NOT_COMPUTABLE:'Hesaplanamadı',REFERENCE_ONLY:'Yalnız referans'};
