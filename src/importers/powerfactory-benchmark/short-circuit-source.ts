import {externalGridEquivalent,type ExternalGridFactor} from './external-grid-equivalent';
import type {DgsRawData} from '../dgs';
import type {ScAuditField,ScSource,ScSourceContext,ScAdapterOptions} from '../../analysis/short-circuit/source-adapter';
import type {CanonicalNetwork} from '../../domain/model/network';
const fields:Record<string,Record<string,string>>={TypLne:{rline:'ohm/km',xline:'ohm/km'},TypTr2:{uktr:'%',urtr:'%',pcutr:'kW',strn:'MVA',utrn_h:'kV',utrn_l:'kV'},TypSym:{rstr:'pu (machine base)',xdss:'pu (machine base)',sgn:'MVA',ugn:'kV',cosn:'1'},ElmVac:{R1:'ohm',X1:'ohm',r1:'ohm',x1:'ohm',usetp:'pu'},ElmXnet:{ikss:'kA (native input)',ikssmin:'kA (native input)',snss:'MVA (native input)',snssmin:'MVA (native input)',rntxn:'R/X',rntxnmin:'R/X'},ElmLnesec:{typ_id:'FID',fold_id:'FID',dline:'km'},ElmTr2:{typ_id:'FID',nntap:'tap position'},ElmGenStat:{Ikss3PF:'kA (native current input)',psutype:'enum',typ_id:'FID',sgn:'MVA',ugn:'kV',cosn:'1',kpf:'1',ikss:'kA (native input; mode unverified)'},ElmSym:{typ_id:'FID'}};
const tables=(raw:DgsRawData,cls:string)=>{const t=raw[cls] as {Attributes:string[];Values:unknown[][]}|undefined;return t?.Values.map(v=>Object.fromEntries(t.Attributes.map((a,i)=>[a,v[i]??null])))??[];};
const valid=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)!==99999&&Math.abs(v)!==999999;
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
  const cubicles=new Map(tables(raw,'StaCubic').map(r=>[String(r.FID),String(r.fold_id??'')])),cubicObj=new Map(tables(raw,'StaCubic').map(r=>[String(r.FID),String(r.obj_id??'')])),busIds=new Set(network.buses.map(b=>b.sourceId)),kvById=new Map(network.buses.map(b=>[b.sourceId,b.vnKv]));
  const physical=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v!==99999&&v!==999999;
  const factor=options.externalGridFactor??externalGridFactor;
  const endpoint=(v:unknown)=>{const id=String(v??'');return cubicles.get(id)??(busIds.has(id)?id:'');};
  const resolveNeutral=(v:unknown)=>{if(!v||String(v)==='null')return null;const s=String(v);return cubicObj.get(s)||cubicles.get(s)||s;};
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
      const absent=(v:unknown)=>v===null||v===undefined||v===''||v===99999;
      if(t&&(!absent(t.rstr)&&!physical(t.rstr)||!absent(t.xdss)&&(!physical(t.xdss)||t.xdss===0))){source.reason='INVALID_UNIT: MACHINE_R_X';}
      else if(t&&physical(t.rstr)&&physical(t.xdss)&&t.xdss>0&&physical(t.sgn)&&t.sgn>0&&physical(t.ugn)&&t.ugn>0&&typeof count==='number'&&Number.isInteger(count)&&count>0){
        const base=t.ugn**2/t.sgn/count;source.rOhm=t.rstr*base;source.xOhm=t.xdss*base;source.reason='';source.sourceRef=`DGS:ElmSym:${row.FID}/TypSym:${row.typ_id}:rstr,xdss pu; ugn kV,sgn MVA,ngnum; uncorrected KG/KKW`;
      }else if(t&&physical(t.sgn)&&t.sgn>0&&physical(t.ugn)&&t.ugn>0&&typeof count==='number'&&Number.isInteger(count)&&count>0&&(physical(t.rstr)||physical(options.missingMachineRPu))&&(physical(t.xdss)&&t.xdss>0||physical(options.missingMachineXdssPu)&&options.missingMachineXdssPu>0)&&options.provenance?.trim()){
        const base=t.ugn**2/t.sgn/count,r=physical(t.rstr)?t.rstr:options.missingMachineRPu!,x=physical(t.xdss)&&t.xdss>0?t.xdss:options.missingMachineXdssPu!;source.rOhm=r*base;source.xOhm=x*base;source.reason='';source.sourceRef=`EXPLICIT_MISSING_MACHINE_PU_ASSUMPTION:${options.provenance}; r=${r},xdss=${x}; retained available native fields; TypSym:${row.typ_id}:ugn/sgn and ElmSym:ngnum`;
      }
    }
    if((cls==='ElmGenStat'||cls==='ElmGenstat')&&row.psutype==='fsce'&&row.ngnum===1&&physical(row.Ikss3PF)&&options.converterTerminalBasis===true&&Number.isFinite(options.converterAngleDeg)&&options.provenance?.trim()){
      source.currentKa=options.mode==='MIN'?0:row.Ikss3PF as number;source.currentAngleDeg=options.converterAngleDeg;source.reason='';source.rOhm=null;source.xOhm=null;
      source.sourceRef=`DGS:${cls}:${row.FID}:Ikss3PF native input kA, ngnum=1; ${options.mode??'MAX'}; ${options.mode==='MIN'?'explicit MIN exclusion per PF 2024 §4.1.5':'current injection'}; CONNECTED_TERMINAL basis and angle assumed: ${options.provenance}`;
    }
    if((cls==='ElmGenStat'||cls==='ElmGenstat')&&row.psutype==='fsce'&&row.ngnum===1&&row.Ikss3PF===0){
      source.currentKa=0;source.currentAngleDeg=0;source.rOhm=null;source.xOhm=null;source.reason='';source.sourceRef=`DGS:${cls}:${row.FID}:Ikss3PF=0 kA native recorded value; ngnum=1; zero contribution independent of phase or voltage basis`;
    }
    const override=options.overrides?.find(o=>o.sourceClass===source.sourceClass&&o.fid===source.fid);
    if(override){if(!physical(override.rOhm)||!physical(override.xOhm)||override.xOhm<=0||!override.provenance.trim())throw Error('SC_INVALID_SOURCE_OVERRIDE');source.rOhm=override.rOhm;source.xOhm=override.xOhm;source.currentKa=undefined;source.reason='';source.sourceRef=`EXPLICIT_USER_R_X_OHM:${override.provenance}`;}
    if(row.outserv!==0&&row.outserv!==1)source.reason='MISSING_SOURCE_MODEL: UNKNOWN_SERVICE_STATE';
    if(source.reason===''&&!bus)source.reason='MISSING_SOURCE_MODEL: UNRESOLVED_SOURCE_BUS';
    source.parameterStatus=source.reason?'UNSUPPORTED':/EXPLICIT|assumed|source c=/i.test(source.sourceRef)?'ASSUMED':'NATIVE';
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
  if(options.sourcePolicy==='ENGINEERING_PARTIAL'&&!options.provenance?.trim())throw Error('SC_PARTIAL_SOURCE_PROVENANCE_REQUIRED');
  
  // Extract sequence data for negative and zero sequence calculations
  const seqLines=new Map<string,import('../../analysis/short-circuit/sequence-network').ScZeroSequenceLine>();
  for(const l of network.lines){
    const row=lineRows.get(l.sourceId),parts=sections.get(l.sourceId)??(row?[row]:[]);
    let r0=0,x0=0,ok=parts.length>0;
    for(const part of parts){
      const type=typeLines.get(String(part.typ_id));
      if(!type||!physical(type.rline0)||!physical(type.xline0)||!physical(part.dline)||Number(type.xline0)===99999||Number(type.xline0)===999999){ok=false;break;}
      r0+=Number(type.rline0)*Number(part.dline);x0+=Number(type.xline0)*Number(part.dline);
    }
    if(ok&&Math.hypot(r0,x0)>0)seqLines.set(l.sourceId,{lineId:l.sourceId,r0Ohm:r0,x0Ohm:x0});
  }
  const seqTrafos=new Map<string,import('../../analysis/short-circuit/sequence-network').ScZeroSequenceTransformer>();
  for(const t of network.transformers){
    const row=transformerRows.get(t.sourceId),type=row?typeTransformers.get(String(row.typ_id)):null;
    if(type){
      const vgHv=type.tr2cn_h?String(type.tr2cn_h):undefined;
      const vgLv=type.tr2cn_l?String(type.tr2cn_l):undefined;
      const uk0tr=physical(type.uk0tr)&&Number(type.uk0tr)>0&&Number(type.uk0tr)!==99999&&Number(type.uk0tr)!==999999?Number(type.uk0tr):undefined;
      const ur0tr=physical(type.ur0tr)&&Number(type.ur0tr)!==99999&&Number(type.ur0tr)!==999999?Number(type.ur0tr):undefined;
      const cneutcon=row?.cneutcon!==undefined&&row?.cneutcon!==null?Number(row.cneutcon):undefined;
      const bushvn=resolveNeutral(row?.bushvn);
      const buslvn=resolveNeutral(row?.buslvn);
      seqTrafos.set(t.sourceId,{
        transformerId:t.sourceId,vectorGroupHv:vgHv,vectorGroupLv:vgLv,
        uk0tr,ur0tr,x0tor0:physical(type.x0tor0)&&Number(type.x0tor0)!==99999&&Number(type.x0tor0)!==999999?Number(type.x0tor0):undefined,
        cneutcon,bushvn,buslvn,
        re0tr_h:physical(row?.re0tr_h)?Number(row!.re0tr_h):undefined,
        re0tr_l:physical(row?.re0tr_l)?Number(row!.re0tr_l):undefined
      });
    }
  }
  const groundCompensators:import('../../analysis/short-circuit/sequence-network').ScZeroSequenceGroundCompensator[]=[];
  for(const row of tables(raw,'ElmNec')){
    if(row.outserv===1)continue;
    const r0=row.outserv===0&&physical(row.R0)&&Number(row.R0)!==99999&&Number(row.R0)!==999999?Number(row.R0):NaN;
    const x0=row.outserv===0&&physical(row.X0)&&Number(row.X0)!==99999&&Number(row.X0)!==999999?Number(row.X0):NaN;
    {
      const b=endpoint(row.bus1);
      groundCompensators.push({fid:String(row.FID),bus:b||String(row.bus1??''),r0Ohm:r0,x0Ohm:x0,inService:row.outserv!==1});
    }
  }
  const negativeSources=new Map<string,import('../../analysis/short-circuit/sequence-network').ScNegativeSequenceSource>();
  for(const row of tables(raw,'ElmSym')){
    if(row.outserv===1)continue;
    const t=machineTypes.get(String(row.typ_id)),count=row.ngnum;
    if(t&&physical(t.x2sy)&&Number(t.x2sy)>0&&Number(t.x2sy)!==99999&&physical(t.sgn)&&physical(t.ugn)&&typeof count==='number'&&count>0){
      const base=t.ugn**2/t.sgn/count;
      let r2:number|null=null;
      if(physical(t.r2sy)&&Number(t.r2sy)>=0&&Number(t.r2sy)!==99999){r2=Number(t.r2sy)*base;}
      else if(physical(options.missingMachineRPu)&&options.provenance?.trim()){r2=options.missingMachineRPu*base;}
      if(r2!==null){
        negativeSources.set(String(row.FID),{fid:String(row.FID),sourceClass:'ElmSym',bus:endpoint(row.bus1),r2Ohm:r2,x2Ohm:Number(t.x2sy)*base});
      }
    }
  }
  for(const row of tables(raw,'ElmVac')){
    if(row.outserv===1)continue;
    const r2=physical(row.R2)&&Number(row.R2)!==99999?Number(row.R2):null;
    const x2=physical(row.X2)&&Number(row.X2)!==99999?Number(row.X2):null;
    if(r2!==null&&x2!==null&&(r2>0||x2>0)){
      negativeSources.set(String(row.FID),{fid:String(row.FID),sourceClass:'ElmVac',bus:endpoint(row.bus1),r2Ohm:r2,x2Ohm:x2});
    }
  }
  const zeroSources=new Map<string,{bus:string;r0Ohm:number;x0Ohm:number}>();
  for(const row of tables(raw,'ElmVac')){
    if(row.outserv===1)continue;
    const r0=physical(row.R0)&&Number(row.R0)!==99999?Number(row.R0):null;
    const x0=physical(row.X0)&&Number(row.X0)!==99999?Number(row.X0):null;
    if(r0!==null&&x0!==null&&(r0>0||x0>0)){
      zeroSources.set(String(row.FID),{bus:endpoint(row.bus1),r0Ohm:r0,x0Ohm:x0});
    }
  }
  const sequenceData:import('../../analysis/short-circuit/sequence-network').ScSequenceData={
    lines:seqLines,transformers:seqTrafos,groundCompensators,negativeSources,zeroSources
  };
  return {modelHash:network.modelHash,sources,audit,invalidBranches,sequenceData,calculateMode:options.mode??'MAX',allowMixedNominalKv:options.allowMixedNominalKv,assumptions:options.provenance?[options.provenance]:[],adapterOptions:structuredClone({...options,externalGridFactor:factor,mode:options.mode??'MAX'})};
}
