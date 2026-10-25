import type { DgsRawData } from '../dgs';
import type { ShortCircuitReadiness,SourceReadiness } from '../../domain/benchmark/readiness';

const groups:Record<string,{required:string[];method?:boolean}>={
  TypLne:{required:['rline','xline']},
  TypTr2:{required:['uktr','urtr','strn','utrn_h','utrn_l']},
  TypSym:{required:['xdss','cosn','sgn','ugn']},
  ElmVac:{required:['r1','x1'],method:true},
  ElmXnet:{required:['ikss','rntxn','bus1'],method:true},
  ElmGenStat:{required:['typ_id','bus1'],method:true},
  ElmGenstat:{required:['typ_id','bus1'],method:true},
  ElmLne:{required:['typ_id','dline','bus1','bus2']},
  ElmTr2:{required:['typ_id','bushv','buslv'],method:true},
  ElmSym:{required:['typ_id','bus1'],method:true},
};
/** Evidence audit only: unknown units, IEC factors and source models are never guessed. */
export function auditShortCircuitReadiness(raw:DgsRawData):ShortCircuitReadiness{
  const rows:SourceReadiness[]=[],counts:ShortCircuitReadiness['counts']={};
  for(const [sourceClass,spec] of Object.entries(groups)){
    const table=raw[sourceClass] as {Attributes:string[];Values:unknown[][]}|undefined;if(!table)continue;
    for(const values of table.Values){
      const record=Object.fromEntries(table.Attributes.map((k,i)=>[k,values[i]])),availableFields=spec.required.filter(k=>record[k]!=null&&record[k]!==''),missingFields=spec.required.filter(k=>record[k]==null||record[k]==='');
      const sentinels=spec.required.filter(k=>typeof record[k]==='number'&&(!Number.isFinite(record[k])||Math.abs(record[k] as number)>=99999));
      let status:SourceReadiness['status']='PARTIAL_SOURCE';const reasons:string[]=[];
      if(sentinels.length){status='INVALID_SOURCE';reasons.push(`INVALID_OR_SENTINEL: ${sentinels.join(', ')}`);}
      else if(missingFields.length){status=sourceClass.startsWith('Elm')&&missingFields.includes('typ_id')?'MISSING_SOURCE_MODEL':'PARTIAL_SOURCE';reasons.push(`MISSING_ATTRIBUTES: ${missingFields.join(', ')}`);}
      else if(spec.method){status='METHOD_UNVERIFIED';reasons.push('SOURCE_METHOD_UNITS_AND_IEC_CORRECTION_FACTORS_UNVERIFIED');}
      else reasons.push('POSITIVE_SEQUENCE_FIELDS_PRESENT; UNITS_AND_IEC_FACTORS_REQUIRE_VERIFICATION');
      const state=record.outserv;rows.push({sourceClass:sourceClass==='ElmGenstat'?'ElmGenStat':sourceClass,fid:String(record.FID??''),status,reasons,availableFields,missingFields,subset:sourceClass==='ElmGenStat'||sourceClass==='ElmGenstat'?'UNSUPPORTED':'3PH_POSITIVE_SEQUENCE',inService:state===0?true:state===1?false:null});counts[status]=(counts[status]??0)+1;
    }
  }
  return {method:'GA_IEC60909_READINESS',edition:null,status:'NOT_COMPUTABLE',reasons:['IEC_EDITION_AND_CORRECTION_FACTORS_UNVERIFIED','CONVERTER_AND_MACHINE_CONTRIBUTION_MODELS_NOT_VERIFIED','NO_DEFAULT_EQUIVALENT_SOURCES'],rows,counts};
}
