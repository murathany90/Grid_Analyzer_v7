import type {DgsRawData} from '../dgs';
import type {ScAuditField,ScSource,ScSourceContext} from '../../analysis/short-circuit/source-adapter';
import type {CanonicalNetwork} from '../../domain/model/network';
const fields:Record<string,Record<string,string>>={TypLne:{rline:'ohm/km',xline:'ohm/km'},TypTr2:{uktr:'%',urtr:'%',pcutr:'kW',strn:'MVA',utrn_h:'kV',utrn_l:'kV'},TypSym:{xdss:'pu (machine base)',sgn:'MVA',ugn:'kV',cosn:'1'},ElmVac:{r1:'ohm',x1:'ohm',usetp:'pu'},ElmXnet:{ikss:'kA',rntxn:'R/X'},ElmSym:{typ_id:'FID'},ElmGenStat:{typ_id:'FID'}};
const tables=(raw:DgsRawData,cls:string)=>{const t=raw[cls] as {Attributes:string[];Values:unknown[][]}|undefined;return t?.Values.map(v=>Object.fromEntries(t.Attributes.map((a,i)=>[a,v[i]??null])))??[];};
const valid=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<99999;
/** Native model attributes only. Never consumes any PF result sheet or result-package number. */
export function adaptShortCircuitSources(raw:DgsRawData,network:CanonicalNetwork):ScSourceContext {
  const audit:ScAuditField[]=[],sources:ScSource[]=[],invalidBranches:ScSourceContext['invalidBranches']=[];
  const normalizedRaw={...raw,ElmGenStat:raw.ElmGenStat??raw.ElmGenstat};
  for(const [cls,spec] of Object.entries(fields))for(const row of tables(normalizedRaw,cls))for(const [field,unit] of Object.entries(spec)){
    const v=row[field],missing=v===null||v===undefined||v==='',positive=['xline','uktr','strn','utrn_h','utrn_l','xdss','sgn','ugn','x1','ikss'].includes(field),bad=unit!=='FID'&&(!valid(v)||(typeof v==='number'&&(v<0||positive&&v===0||field==='cosn'&&v>1))),zero=typeof v==='number'&&v===0;
    const status=missing?'MISSING_SOURCE_MODEL':bad?'INVALID_UNIT':cls==='ElmGenStat'?'UNSUPPORTED_CONVERTER':cls==='TypLne'?'READY_VERIFIED_SUBSET':'MISSING_IEC_FACTOR';
    audit.push({sourceClass:cls,fid:String(row.FID??''),inService:row.outserv===0?true:row.outserv===1?false:null,field,actualValue:v??null,unit,physicalValidation:missing?'MISSING':bad?'NEGATIVE_NONFINITE_OR_SENTINEL':zero?'RECORDED_ZERO':'PRESENT',sourceRef:`DGS:${cls}:${row.FID}:${field}`,IECRequirement:'Positive sequence model / independently verified corrections',status,reason:status==='READY_VERIFIED_SUBSET'?'ATTRIBUTE_ONLY; NOT_NETWORK_READINESS':status});
  }
  const cubicles=new Map(tables(raw,'StaCubic').map(r=>[String(r.FID),String(r.fold_id??'')])),busIds=new Set(network.buses.map(b=>b.sourceId));
  const endpoint=(v:unknown)=>{const id=String(v??'');return cubicles.get(id)??(busIds.has(id)?id:'');};
  for(const cls of ['ElmXnet','ElmSym','ElmGenStat','ElmGenstat','ElmVac','ElmAsm','ElmVacbi','ElmVsc','ElmVscmono','ElmSvs','ElmTr3','ElmShnt'])for(const row of tables(raw,cls)){
    if(cls==='ElmGenstat'&&raw.ElmGenStat)continue;
    // Shunts are explicitly excluded from this series network approximation (documented in result).
    if(cls==='ElmShnt')continue;
    const bus=endpoint(row.bus1??row.bushv),additionalBuses=['bus2','busmv','buslv'].map(k=>endpoint(row[k])).filter(Boolean),isVac=cls==='ElmVac',r=isVac&&valid(row.r1)?Number(row.r1):null,x=isVac&&valid(row.x1)?Number(row.x1):null;
    const reason=!bus?'MISSING_SOURCE_MODEL: UNRESOLVED_SOURCE_BUS':!isVac?cls==='ElmGenStat'||cls==='ElmGenstat'||cls.startsWith('ElmVsc')?'UNSUPPORTED_CONVERTER':'MISSING_SOURCE_MODEL: CORRECTED_SOURCE_EQUIVALENT_UNAVAILABLE':r===null||x===null||r<0||x<=0?'INVALID_UNIT: SOURCE_R_X':!valid(row.usetp)||Number(row.usetp)<=1e-6?'MISSING_SOURCE_MODEL: NON_ENERGIZING_VOLTAGE_SOURCE':'';
    sources.push({sourceClass:cls==='ElmGenstat'?'ElmGenStat':cls,fid:String(row.FID??''),bus,additionalBuses,inService:row.outserv!==1,rOhm:r,xOhm:x,reason:row.outserv!==0&&row.outserv!==1?'MISSING_SOURCE_MODEL: UNKNOWN_SERVICE_STATE':reason,sourceRef:isVac?`DGS:${cls}:${row.FID}:r1/x1 (PowerFactory 2024 AC Voltage Source technical reference, section 2)`:`DGS:${cls}:${row.FID}:unsupported native source/element model`});
  }
  const typeLines=new Map(tables(raw,'TypLne').map(r=>[String(r.FID),r])),typeTransformers=new Map(tables(raw,'TypTr2').map(r=>[String(r.FID),r]));
  const lineRows=new Map(tables(raw,'ElmLne').map(r=>[String(r.FID),r])),transformerRows=new Map(tables(raw,'ElmTr2').map(r=>[String(r.FID),r]));
  for(const l of network.lines){const row=lineRows.get(l.sourceId),type=row?typeLines.get(String(row.typ_id)):null;
    if(!row||!type||!valid(type.rline)||Number(type.rline)<0||!valid(type.xline)||Number(type.xline)<=0||!valid(row.dline)||Number(row.dline)<=0||l.sections>0)invalidBranches.push({sourceClass:l.sourceClass,fid:l.sourceId,reason:'INVALID_UNIT_OR_UNVERIFIED_LINE_SECTIONS'});
  }
  for(const t of network.transformers){const row=transformerRows.get(t.sourceId),type=row?typeTransformers.get(String(row.typ_id)):null;
    if(!type||!['uktr','strn','utrn_h','utrn_l'].every(k=>valid(type[k])&&Number(type[k])>0)||!valid(type.pcutr)||Number(type.pcutr)<0||!Number.isFinite(t.xPu)||t.xPu<=0||t.tapResolution?.startsWith('FALLBACK')||Math.abs(Number(type.utrn_h)/t.vnKv-1)>.05||Math.abs(Number(type.utrn_l)/t.lvKv-1)>.05)invalidBranches.push({sourceClass:t.sourceClass,fid:t.sourceId,reason:'INVALID_UNIT_OR_UNVERIFIED_TRANSFORMER_BASE_TAP'});
  }
  return {modelHash:network.modelHash,sources,audit,invalidBranches};
}
