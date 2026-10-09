import {externalGridEquivalent,type ExternalGridFactor} from './external-grid-equivalent';
import type {DgsRawData} from '../dgs';
import type {ScAuditField,ScSource,ScSourceContext,ScAdapterOptions} from '../../analysis/short-circuit/source-adapter';
import type {CanonicalNetwork} from '../../domain/model/network';
const fields:Record<string,Record<string,string>>={TypLne:{rline:'ohm/km',xline:'ohm/km'},TypTr2:{uktr:'%',urtr:'%',pcutr:'kW',strn:'MVA',utrn_h:'kV',utrn_l:'kV'},TypSym:{rstr:'pu (machine base)',xdss:'pu (machine base)',sgn:'MVA',ugn:'kV',cosn:'1'},ElmVac:{R1:'ohm',X1:'ohm',r1:'ohm',x1:'ohm',usetp:'pu'},ElmXnet:{ikss:'kA (native input)',ikssmin:'kA (native input)',snss:'MVA (native input)',snssmin:'MVA (native input)',rntxn:'R/X',rntxnmin:'R/X'},ElmLnesec:{typ_id:'FID',fold_id:'FID',dline:'km'},ElmTr2:{typ_id:'FID',nntap:'tap position'},ElmGenStat:{Ikss3PF:'kA (native current input)',psutype:'enum',typ_id:'FID',sgn:'MVA',ugn:'kV',cosn:'1',kpf:'1',ikss:'kA (native input; mode unverified)'},ElmSym:{typ_id:'FID'}};
const tables=(raw:DgsRawData,cls:string)=>{const t=raw[cls] as {Attributes:string[];Values:unknown[][]}|undefined;return t?.Values.map(v=>Object.fromEntries(t.Attributes.map((a,i)=>[a,v[i]??null])))??[];};
const valid=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)!==99999;
/** Native model attributes only. Never consumes any PF result sheet or result-package number. */
export function adaptShortCircuitSources(raw:DgsRawData,network:CanonicalNetwork,externalGridFactor?:ExternalGridFactor,options:ScAdapterOptions={}):ScSourceContext {
  const audit:ScAuditField[]=[],sources:ScSource[]=[],invalidBranches:ScSourceContext['invalidBranches']=[];
  const normalizedRaw={...raw,ElmGenStat:raw.ElmGenStat??raw.ElmGenstat};
  for(const [cls,spec] of Object.entries(fields))for(const row of tables(normalizedRaw,cls))for(const [field,unit] of Object.entries(spec)){
    const v=row[field],missing=v===null||v===undefined||v==='',positive=['xline','uktr','strn','utrn_h','utrn_l','xdss','sgn','ugn','x1','ikss'].includes(field),bad=unit!=='FID'&&unit!=='enum'&&(!valid(v)||(typeof v==='number'&&(v<0&&field!=='nntap'||positive&&v===0||field==='cosn'&&v>1))),zero=typeof v==='number'&&v===0;
    const status=missing?'MISSING_SOURCE_MODEL':bad?'INVALID_UNIT':cls==='ElmGenStat'?'UNSUPPORTED_CONVERTER':cls==='TypLne'?'READY_VERIFIED_SUBSET':'MISSING_IEC_FACTOR';
    audit.push({sourceClass:cls,fid:String(row.FID??''),inService:row.outserv===0?true:row.outserv===1?false:null,field,actualValue:v??null,unit,physicalValidation:missing?'MISSING':bad?'NEGATIVE_NONFINITE_OR_SENTINEL':zero?'RECORDED_ZERO':'PRESENT',sourceRef:`DGS:${cls}:${row.FID}:${field}`,IECRequirement:'Positive sequence model / independently verified corrections',status,reason:status==='READY_VERIFIED_SUBSET'?'ATTRIBUTE_ONLY; NOT_NETWORK_READINESS':status});
  }
  const machineTypes=new Map(tables(raw,'TypSym').map(r=>[String(r.FID),r]));
  const cubicles=new Map(tables(raw,'StaCubic').map(r=>[String(r.FID),String(r.fold_id??'')])),busIds=new Set(network.buses.map(b=>b.sourceId)),kvById=new Map(network.buses.map(b=>[b.sourceId,b.vnKv]));
  const physical=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v!==99999;
  const factor=options.externalGridFactor??externalGridFactor;
  const endpoint=(v:unknown)=>{const id=String(v??'');return cubicles.get(id)??(busIds.has(id)?id:'');};
  for(const cls of ['ElmXnet','ElmSym','ElmGenStat','ElmGenstat','ElmVac','ElmAsm','ElmVacbi','ElmVsc','ElmVscmono','ElmSvs','ElmTr3','ElmShnt'])for(const row of tables(raw,cls)){
    if(cls==='ElmGenstat'&&raw.ElmGenStat)continue;
    // Shunts are explicitly excluded from this series network approximation (documented in result).
    if(cls==='ElmShnt')continue;
    const bus=endpoint(row.bus1??row.bushv),additionalBuses=['bus2','busmv','buslv'].map(k=>endpoint(row[k])).filter(Boolean),isVac=cls==='ElmVac',r=isVac&&physical(row.R1??row.r1)?Number(row.R1??row.r1):null,x=isVac&&physical(row.X1??row.x1)?Number(row.X1??row.x1):null;
    const equivalent=cls==='ElmXnet'?externalGridEquivalent({ikss:options.mode==='MIN'?row.ikssmin:row.ikss,snss:options.mode==='MIN'?row.snssmin:row.snss,rntxn:options.mode==='MIN'?row.rntxnmin:row.rntxn,nominalKv:kvById.get(bus)??NaN},factor):null;
    const reason=!bus?'MISSING_SOURCE_MODEL: UNRESOLVED_SOURCE_BUS':equivalent?equivalent.reason:!isVac?cls==='ElmGenStat'||cls==='ElmGenstat'||cls.startsWith('ElmVsc')?'UNSUPPORTED_CONVERTER':'MISSING_SOURCE_MODEL: CORRECTED_SOURCE_EQUIVALENT_UNAVAILABLE':r===null||x===null||r<0||x<=0?'INVALID_UNIT: SOURCE_R_X':!valid(row.usetp)||Number(row.usetp)<=1e-6?'MISSING_SOURCE_MODEL: NON_ENERGIZING_VOLTAGE_SOURCE':'';
    const sourceRef=equivalent?`DGS:ElmXnet:${row.FID}:native ikss/snss,rntxn; PF 2024 ElmXnet sec3.1 eq4/5; source c=${factor?.value??'MISSING'} (${factor?.provenance??'NOT_SUPPLIED'})`:isVac?`DGS:${cls}:${row.FID}:R1/X1 or legacy r1/x1 (PowerFactory 2024 AC Voltage Source technical reference, section 2)`:`DGS:${cls}:${row.FID}:unsupported native source/element model`;
    sources.push({sourceClass:cls==='ElmGenstat'?'ElmGenStat':cls,fid:String(row.FID??''),bus,additionalBuses,inService:row.outserv!==1,rOhm:equivalent?.rOhm??r,xOhm:equivalent?.xOhm??x,reason:row.outserv!==0&&row.outserv!==1?'MISSING_SOURCE_MODEL: UNKNOWN_SERVICE_STATE':reason,sourceRef});
    const source=sources.at(-1)!;
    if(cls==='ElmSym'){
      const t=machineTypes.get(String(row.typ_id)),count=row.ngnum;
      if(t&&physical(t.rstr)&&physical(t.xdss)&&t.xdss>0&&physical(t.sgn)&&t.sgn>0&&physical(t.ugn)&&t.ugn>0&&typeof count==='number'&&Number.isInteger(count)&&count>0){
        const base=t.ugn**2/t.sgn/count;source.rOhm=t.rstr*base;source.xOhm=t.xdss*base;source.reason='';source.sourceRef=`DGS:ElmSym:${row.FID}/TypSym:${row.typ_id}:rstr,xdss pu; ugn kV,sgn MVA,ngnum; uncorrected KG/KKW`;
      }else if(t&&physical(t.sgn)&&t.sgn>0&&physical(t.ugn)&&t.ugn>0&&typeof count==='number'&&Number.isInteger(count)&&count>0&&physical(options.missingMachineXdssPu)&&options.missingMachineXdssPu>0&&physical(options.missingMachineRPu)&&options.provenance?.trim()){
        const base=t.ugn**2/t.sgn/count;source.rOhm=options.missingMachineRPu*base;source.xOhm=options.missingMachineXdssPu*base;source.reason='';source.sourceRef=`EXPLICIT_MISSING_MACHINE_PU_ASSUMPTION:${options.provenance}; r=${options.missingMachineRPu},xdss=${options.missingMachineXdssPu}; native TypSym:${row.typ_id}:ugn/sgn and ElmSym:ngnum`;
      }
    }
    if((cls==='ElmGenStat'||cls==='ElmGenstat')&&row.psutype==='fsce'&&row.ngnum===1&&physical(row.Ikss3PF)&&options.converterTerminalBasis===true&&Number.isFinite(options.converterAngleDeg)&&options.provenance?.trim()){
      source.currentKa=options.mode==='MIN'?0:row.Ikss3PF as number;source.currentAngleDeg=options.converterAngleDeg;source.reason='';source.rOhm=null;source.xOhm=null;
      source.sourceRef=`DGS:${cls}:${row.FID}:Ikss3PF native input kA, ngnum=1; ${options.mode??'MAX'}; ${options.mode==='MIN'?'explicit MIN exclusion per PF 2024 §4.1.5':'current injection'}; CONNECTED_TERMINAL basis and angle assumed: ${options.provenance}`;
    }
    const override=options.overrides?.find(o=>o.sourceClass===source.sourceClass&&o.fid===source.fid);
    if(override){if(!physical(override.rOhm)||!physical(override.xOhm)||override.xOhm<=0||!override.provenance.trim())throw Error('SC_INVALID_SOURCE_OVERRIDE');source.rOhm=override.rOhm;source.xOhm=override.xOhm;source.currentKa=undefined;source.reason='';source.sourceRef=`EXPLICIT_USER_R_X_OHM:${override.provenance}`;}
    if(row.outserv!==0&&row.outserv!==1)source.reason='MISSING_SOURCE_MODEL: UNKNOWN_SERVICE_STATE';
    if(source.reason===''&&!bus)source.reason='MISSING_SOURCE_MODEL: UNRESOLVED_SOURCE_BUS';
    if(source.reason==='')audit.push({sourceClass:source.sourceClass,fid:source.fid,inService:source.inService,field:'equivalent',actualValue:{rOhm:source.rOhm,xOhm:source.xOhm,currentKa:source.currentKa},unit:source.currentKa!==undefined?'kA':'ohm',physicalValidation:'NATIVE_OR_EXPLICIT_PARAMETER',sourceRef:source.sourceRef,IECRequirement:'KG/KT/KKW and edition still unverified',status:'APPROXIMATION_SOURCE_EQUIVALENT',reason:'NETWORK_APPROXIMATION; NOT_IEC_CERTIFICATION'});
    if(equivalent)audit.push({sourceClass:cls,fid:String(row.FID),inService:row.outserv===0,field:'sourceVoltageFactor',actualValue:factor?.value??null,unit:'1',physicalValidation:factor?'EXPLICIT_INPUT':'MISSING',sourceRef,IECRequirement:'Verified external-grid cmax or explicit approximation assumption',status:equivalent.reason?'MISSING_IEC_FACTOR':'APPROXIMATION_SOURCE_EQUIVALENT',reason:equivalent.reason||'NETWORK_APPROXIMATION; NOT_IEC_CERTIFICATION'});
  }
  const typeLines=new Map(tables(raw,'TypLne').map(r=>[String(r.FID),r])),typeTransformers=new Map(tables(raw,'TypTr2').map(r=>[String(r.FID),r]));
  const lineRows=new Map(tables(raw,'ElmLne').map(r=>[String(r.FID),r])),transformerRows=new Map(tables(raw,'ElmTr2').map(r=>[String(r.FID),r]));
  const sections=new Map<string,Record<string,unknown>[]>();for(const row of tables(raw,'ElmLnesec')){const key=String(row.fold_id),group=sections.get(key)??[];group.push(row);sections.set(key,group);}
  for(const l of network.lines){const row=lineRows.get(l.sourceId),parts=sections.get(l.sourceId)??(row?[row]:[]);let r=0,x=0,ok=parts.length>0;
    for(const part of parts){const type=typeLines.get(String(part.typ_id));if(!type||!physical(type.rline)||!physical(type.xline)||!physical(part.dline)){ok=false;continue;}r+=type.rline*part.dline;x+=type.xline*part.dline;}
    if(l.sections>0&&parts.length!==l.sections||!ok||x<=0||Math.abs(r-l.rOhm)>1e-8*Math.max(1,r)||Math.abs(x-l.xOhm)>1e-8*Math.max(1,x))invalidBranches.push({sourceClass:l.sourceClass,fid:l.sourceId,reason:'INVALID_UNIT_OR_UNVERIFIED_LINE_SECTIONS'});
  }
  for(const t of network.transformers){const row=transformerRows.get(t.sourceId),type=row?typeTransformers.get(String(row.typ_id)):null;
    if(!type||!['uktr','strn','utrn_h','utrn_l'].every(k=>valid(type[k])&&Number(type[k])>0)||!valid(type.pcutr)||Number(type.pcutr)<0||!Number.isFinite(t.xPu)||t.xPu<=0||t.tapResolution?.startsWith('FALLBACK'))invalidBranches.push({sourceClass:t.sourceClass,fid:t.sourceId,reason:'INVALID_UNIT_OR_UNVERIFIED_TRANSFORMER_BASE_TAP'});
  }
  if(options.overrides?.some(o=>!sources.some(s=>s.sourceClass===o.sourceClass&&s.fid===o.fid)))throw Error('SC_UNKNOWN_OVERRIDE_FID');
  if(options.allowMixedNominalKv&&!options.provenance?.trim())throw Error('SC_NOMINAL_NORMALIZATION_PROVENANCE_REQUIRED');
  return {modelHash:network.modelHash,sources,audit,invalidBranches,calculateMode:options.mode??'MAX',allowMixedNominalKv:options.allowMixedNominalKv,assumptions:options.provenance?[options.provenance]:[]};
}
