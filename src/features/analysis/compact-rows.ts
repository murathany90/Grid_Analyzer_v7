import type {AppContext} from '../../app/contracts';
import type {HybridCase} from '../../analysis/contingency-hybrid';
import {ytmN1Rows,ytmScRows,ytmReferenceRows,type StudyExportRow} from '../../analysis/ytm-study/export';
import {currentScResult} from '../../domain/results/sc-selection';
import {metricRows,preflightBenchmark} from '../../domain/benchmark/comparison';
import {rowObject} from '../../domain/benchmark/types';
import {preflightPowerFactoryReference} from '../../analysis/validation/powerfactory-preflight';
import {comparePowerFactoryReference} from '../../analysis/validation/powerfactory-reference';
import {emptyScenario,scenarioSignature} from '../../domain/scenario/overlay';
import {mapLoadingValues} from '../../domain/results/loading-presentation';
import {currentHybrid,currentLf,currentStudy,studyOwnsSc,scFaultsInScope} from './presentation-scope';

export interface Triple {ga:number|null;pf:number|null;delta:number|null;reason:string}
export interface Overload {caseId:string;fid:string;name:string;cls:string;percent:number;source:'GA_AC'|'GA_DC'|'PF';ytm:string;boundary:boolean;kv:number|null}
export interface CompactRow {
 key:string;fid:string;name:string;tm:string;ytm:string;kv:number|null;cls:string;caseId?:string;faultId?:string;
 status:string;dcLabel?:string;acLabel?:string;loading?:number|null;loadingSource?:string;overloads?:Overload[];missingDetail?:string;
 metrics:Record<string,Triple>;raw:StudyExportRow;detail:unknown;searchText:string;
}
const finite=(v:unknown):number|null=>typeof v==='number'&&Number.isFinite(v)?v:null;
const pair=(ga:number|null,pf:number|null,delta:number|null=null,reason='')=>({ga:finite(ga),pf:finite(pf),delta:finite(delta),reason});
export function acStatus(c:Pick<HybridCase,'status'|'acSolved'|'retainedFromPrior'|'controlEvidence'>|undefined){
 if(!c)return 'Denenmedi';
 const labels:Record<string,string>={AC_DIVERGED:'Yakınsamadı',ISLAND_UNSUPPLIED:'Beslemesiz ada',TOPOLOGY_ISLANDING:'Ada ayrılması',BLOCKED:'Bloke',CANCELLED:'İptal edildi',NOT_RUN_BUDGET:'Denenmedi · süre',NOT_EVALUATED_BUDGET:'Denenmedi · süre',DC_UNSCREENABLE:'DC desteklemiyor · AC denenmedi',DC_SCREEN_ONLY:'Denenmedi · DC yaklaşık',DC_CLEAR_NOT_AC_VERIFIED:'Denenmedi · DC yaklaşık'};
 return c.acSolved?'Sayısal · '+(c.controlEvidence?.fidelity==='CONTROL_VERIFIED'&&['AC_CONVERGED_WITHIN_LIMIT','AC_CONVERGED_VIOLATION'].includes(c.status)?'vaka kontrol kanıtı var':'doğrulanmadı')+(c.retainedFromPrior?' · önceki kayıt':''):labels[c.status]??'Denenmedi';
}
const indices=new WeakMap<NonNullable<AppContext['network']>,ReturnType<typeof buildIndex>>();
function buildIndex(n:NonNullable<AppContext['network']>){
 const sites=new Map(n.sites.map(s=>[s.id,s])),equipment=new Map<string,(typeof n.lines)[number]|(typeof n.transformers)[number]>([...n.lines,...n.transformers].flatMap(e=>[e.id,e.sourceId].map(id=>[e.sourceClass+':'+id,e] as const))),terminals=new Map(n.buses.flatMap(t=>[t.id,t.sourceId].map(id=>[id,t] as const)));
 const places=(ids:readonly string[])=>({tm:ids.map(id=>sites.get(id)?.name??id).join(' / '),ytm:[...new Set(ids.map(id=>sites.get(id)?.areaName??sites.get(id)?.areaId??''))].join(' / ')});
 return {sites,equipment,terminals,places};
}
function index(n:NonNullable<AppContext['network']>){let i=indices.get(n);if(!i){i=buildIndex(n);indices.set(n,i);}return i;}
const finish=(r:Omit<CompactRow,'searchText'>):CompactRow=>({...r,searchText:[r.name,r.fid,r.tm,r.ytm,r.caseId,r.status,r.acLabel,r.dcLabel,JSON.stringify(r.raw)].join(' ').toLocaleLowerCase('tr-TR')});

export function compactN1Rows(ctx:AppContext):CompactRow[]{
 const n=ctx.network,h=currentHybrid(ctx),study=currentStudy(ctx);if(!n||!h)return [];
 const i=index(n),cases=new Map(h.cases.map(c=>[c.candidateId,c])),raw=new Map(study?ytmN1Rows(study).map(r=>[String(r.caseId),r]):[]),pf=ctx.benchmark?.groups.N1,table=pf?.tables.N1_RecordedExtrema_Raw;
 const reference=table&&pf?.identity.studyCase===n.studyCase&&scenarioSignature(ctx.scenario.current)===scenarioSignature(emptyScenario())?table.rows.map(v=>rowObject(table,v)):[];
 const catalogs=study?.catalog??h.cases.map(c=>({candidateId:c.candidateId,equipmentId:c.outage.fid,sourceClass:c.outage.sourceClass,name:c.metadata?.name??c.outage.fid,vnKv:c.metadata?.voltageKv??null}));
 return catalogs.map(cat=>{
  const c=cases.get(cat.candidateId),caseId=c?.outage.caseId??`N1:${cat.sourceClass}:${cat.equipmentId}`,fid=c?.outage.fid??cat.equipmentId,e=i.equipment.get(cat.sourceClass+':'+fid),place=i.places(e?.siteIds??[]),overloads=new Map<string,Overload>();
  const add=(source:Overload['source'],cls:string,id:string,value:unknown)=>{const percent=finite(value);if(percent===null||percent<=100||!['ElmLne','ElmTr2'].includes(cls))return;const equipment=i.equipment.get(cls+':'+id),p=i.places(equipment?.siteIds??[]);overloads.set(source+'|'+cls+'|'+id,{caseId,source,cls,fid:equipment?.sourceId??id,name:equipment?.name??id,percent,ytm:p.ytm,kv:equipment?.vnKv??null,boundary:!!ctx.filters.areaId&&!!equipment?.siteIds.some(id=>i.sites.get(id)?.areaId!==ctx.filters.areaId)});};
  if(c?.acSolved){for(const b of c.mapResults?.branches??[])add('GA_AC',b.sourceClass,b.fid,b.loading.operationalPercent);for(const v of c.constraintChanges??[])if(v.metric==='postLoadingPercent')add('GA_AC',v.sourceClass,v.fid,v.post);for(const v of c.observations)if(v.metric==='postLoadingPercent')add('GA_AC',v.sourceClass,v.fid,v.value);}
  for(const v of c?.dcResult?.violationImpacts??c?.dcResult?.topImpacts??[])add('GA_DC',v.sourceClass,v.equipmentId,v.postEstimatedLoadingPct);
  for(const v of reference)if(v.caseId===caseId)add('PF',String(v.affectedClass),String(v.affectedFid),v.postLoadingPercent);
  const rawRow=raw.get(caseId)??{caseId,FID:fid,name:cat.name,status:c?.status??'NOT_RUN',quality:c?.quality??null,modelHash:h.identity.modelHash,scenarioHash:h.identity.scenarioHash};
  return finish({key:caseId,caseId,fid,name:cat.name,cls:cat.sourceClass,kv:cat.vnKv,...place,status:c?.status??'NOT_RUN',dcLabel:c?.dcResult?'Tarandı · yaklaşık':'Taranmadı',acLabel:acStatus(c),loading:c?.acSolved?finite(c.maxLoadingPercent):finite(c?.dcResult?.maxEstimatedLoadingPct),loadingSource:c?.acSolved?'AC':c?.dcResult?'~DC':'',overloads:[...overloads.values()],missingDetail:c?.mapResults?'':c?.acSolved?'Tam POST ayrıntısı yok':'AC değerlendirmesi yok',metrics:{},raw:rawRow,detail:{summary:rawRow,case:c??null,base:h.base,basePostAvailable:!!h.basePost,overloads:[...overloads.values()],post:c?.mapResults??null,referenceStatus:'REFERENCE_EXTREMA_ONLY; PF full POST matrix unavailable'}});
 });
}

export function compactScRows(ctx:AppContext):CompactRow[]{
 const sc=currentScResult(ctx),n=ctx.network,study=currentStudy(ctx);if(!sc||!n||studyOwnsSc(ctx,sc)&&!study)return [];
 const i=index(n),mode=sc.profile.calculateMode,reference=ctx.benchmark?.groups.SC.tables.SC_BusResults_Raw?ytmReferenceRows({identity:{modelHash:sc.identity.modelHash,scenarioHash:sc.identity.scenarioHash,optionsHash:sc.identity.profileHash},scMax:mode==='MAX'?sc:null,scMin:mode==='MIN'?sc:null},n,ctx.benchmark):[],fullRows=new Map(study&&(sc===study.scMax||sc===study.scMin)?ytmScRows(study,n).map(r=>[String(r.FID),r]):[]);
 const refs=new Map(reference.map(r=>[String(r.FID),r])),groups=new Map<string,typeof sc.faults>();
 for(const f of scFaultsInScope(ctx,sc)){const key=f.electricalBusId??'UNRESOLVED:'+f.physicalTerminalFid,list=groups.get(key)??[];list.push(f);groups.set(key,list);}
 const scenarioKnown=scenarioSignature(ctx.scenario.current)===scenarioSignature(emptyScenario());
 return [...groups].map(([electrical,aliases])=>{
  const f=aliases.find(f=>typeof refs.get(f.physicalTerminalFid)?.delta_kA==='number')??aliases.find(f=>typeof refs.get(f.physicalTerminalFid)?.PF_Ikss_kA==='number')??aliases[0],r=refs.get(f.physicalTerminalFid),t=i.terminals.get(f.physicalTerminalFid),place=i.places(t?.siteIds??[]),pf=finite(r?.PF_Ikss_kA),delta=scenarioKnown?finite(r?.delta_kA):null,ga=f.status==='CALCULATED_NETWORK_APPROXIMATION'?finite(f.ikssKa):null;
  const raw={...fullRows.get(f.physicalTerminalFid),FID:f.physicalTerminalFid,electricalBusId:electrical,physicalAliases:JSON.stringify([...new Set(aliases.flatMap(v=>v.physicalTerminalFids))]),TM:place.tm,YTM:place.ytm,kV:f.nominalKv,mode,GA_Ikss_kA:ga,PF_Ikss_kA:pf,delta_kA:delta,Skss_MVA:f.skssMva,Zkk_R_ohm:f.zkkOhm?.re??null,Zkk_X_ohm:f.zkkOhm?.im??null,ip_kA:f.ipKa,Ib_kA:f.ibKa,Ith_kA:f.ithKa,quality:f.quality??null,status:f.status,reason:f.reasons.join('; '),referenceStatus:r?.status??'PF_NOT_RECORDED',standardBasis:'IEC60909-0:2016',IEC_VERIFIED:'false',modelHash:sc.identity.modelHash,scenarioHash:sc.identity.scenarioHash,sourceHash:sc.identity.sourceHash,profileHash:sc.identity.profileHash};
  return finish({key:electrical,fid:f.physicalTerminalFid,faultId:f.physicalTerminalFid,name:t?.name??f.physicalTerminalFid,cls:'ElmTerm',kv:f.nominalKv,...place,status:f.status,metrics:{ikss:pair(ga,pf,delta,r?.reason?String(r.reason):'PF eşleşmesi/yöntemi doğrulanmadı')},raw,detail:{...raw,mode,physicalTerminalFids:[...new Set(aliases.flatMap(v=>v.physicalTerminalFids))],fault:f,sourceOmissions:f.sourceOmissions??[],assumptions:sc.assumptions,methodEvidence:sc.methodEvidence,comparison:r??null,identity:sc.identity,ip:f.ipKa,Ib:f.ibKa,Ith:f.ithKa}});
 }).sort((a,b)=>a.tm.localeCompare(b.tm,'tr')||a.name.localeCompare(b.name,'tr'));
}

export type LfList='lines'|'transformers'|'buses';
export function compactLfRows(ctx:AppContext,kind:LfList):CompactRow[]{
 const n=ctx.network,r=currentLf(ctx);if(!n||!r||!r.converged)return [];
 const i=index(n),table=ctx.benchmark?.groups.LF.tables.GA_Reference_Raw,pf=new Map<string,ReturnType<typeof metricRows>[number]>();
 if(table&&ctx.benchmark){const gate=preflightBenchmark(ctx.benchmark,n,r,ctx.powerFactoryControlContextNumericFile);for(const v of metricRows(table,gate,undefined,{network:n,lfResult:r,scenario:ctx.resultStore.role==='base'?emptyScenario():ctx.scenario.current,settings:ctx.analysisSettings.value,diagnostic:true}))pf.set(v.sourceClass+':'+v.fid+':'+v.metric,v);}
 const legacy=new Map<string,Triple>();
 if(!table&&ctx.powerFactoryReference){const gate=preflightPowerFactoryReference(ctx.powerFactoryReference,n,r,ctx.powerFactoryControlContextNumericFile),report=comparePowerFactoryReference(gate.reference,r,gate.context);for(const v of report.rows)if(v.status==='MATCHED'&&v.matchMethod!=='EXACT_NAME'){const cls=v.kind==='bus'?'ElmTerm':v.kind==='transformer'?'ElmTr2':'ElmLne';for(const [metric,p] of Object.entries(v.metrics))if(p)for(const fid of [v.gridAnalyzerId,v.powerFactoryFid].filter(Boolean))legacy.set(cls+':'+fid+':'+metric,pair(p.gridAnalyzer,p.powerFactory,gate.status==='COMPATIBLE'&&p.comparable?p.delta:null,p.semantics));}}
 const match=(cls:string,fid:string,metric:string,ga:number|null)=>{const v=pf.get(cls+':'+fid+':'+metric),old=legacy.get(cls+':'+fid+':'+metric),projection=old??pair(v?.ga??null,v?.pf.value??null,v?.identityMatched?v.delta??v.diagnosticDelta??null:null,v?.reason??'PF kayıt yok'),same=ga!==null&&projection.ga!==null&&Math.abs(ga-projection.ga)<=Math.max(1e-9,Math.abs(ga)*1e-9);return pair(ga,projection.pf,same?projection.delta:null,!same&&projection.delta!==null?'ENDPOINT_OR_GA_PROJECTION_MISMATCH':projection.reason);};
 const inScope=(ids:readonly string[])=>!ctx.filters.areaId&&!ctx.filters.siteId||ids.some(id=>(!ctx.filters.siteId||id===ctx.filters.siteId)&&(!ctx.filters.areaId||i.sites.get(id)?.areaId===ctx.filters.areaId));
 if(kind==='buses')return r.buses.filter(b=>b.vnKv>=66&&inScope(b.siteIds)).map(b=>{const fid=b.terms[0]??b.id,m=match('ElmTerm',fid,'voltageKv',b.vnKv*b.vmPu),place=i.places(b.siteIds);return finish({key:b.id,fid,name:b.name,cls:'ElmTerm',kv:b.vnKv,...place,status:'NUMERICAL_PARTIAL_CONTROL',metrics:{voltage:m},raw:{...b,terms:JSON.stringify(b.terms),siteIds:JSON.stringify(b.siteIds),FID:fid,GA_kV:m.ga,PF_kV:m.pf,delta_kV:m.delta,modelHash:r.identity.modelHash,scenarioHash:r.identity.scenarioHash},detail:{bus:b,identity:r.identity,comparison:m,quality:r.quality}});});
 const loading=mapLoadingValues(n,r);
 return r.branches.filter(b=>b.sourceClass===(kind==='lines'?'ElmLne':'ElmTr2')&&inScope(b.siteIds)).map(b=>{
  const e=i.equipment.get(b.sourceClass+':'+b.id),fid=e?.sourceId??b.id,place=i.places(b.siteIds),transformer=e&&'lvKv' in e?e:null,fromKv=i.terminals.get(e?.from??b.from)?.vnKv,toKv=i.terminals.get(e?.to??b.to)?.vnKv,hvFrom=transformer?fromKv!==undefined&&toKv!==undefined&&fromKv!==toKv?fromKv>toKv:null:true;
  const p=match(b.sourceClass,fid,transformer?'pHvMw':'pFromMw',hvFrom===null?null:hvFrom?b.pf:b.pt),q=match(b.sourceClass,fid,transformer?'qHvMvar':'qFromMvar',hvFrom===null?null:hvFrom?b.qf:b.qt),l=match(b.sourceClass,fid,'loadingPercent',loading.get(b.sourceClass+':'+b.id)?.maximum??null);
  return finish({key:b.sourceClass+':'+fid,fid,name:e?.name??b.name,cls:b.sourceClass,kv:transformer?Math.max(transformer.vnKv,transformer.lvKv):b.vnKv,...place,status:'NUMERICAL_PARTIAL_CONTROL',metrics:{p,q,loading:l},raw:{...b,siteIds:JSON.stringify(b.siteIds),FID:fid,PF_P:p.pf,delta_P:p.delta,PF_Q:q.pf,delta_Q:q.delta,GA_loading:l.ga,PF_loading:l.pf,delta_loading:l.delta,modelHash:r.identity.modelHash,scenarioHash:r.identity.scenarioHash},detail:{branch:b,equipment:e,orientation:transformer?'HV':'FROM',hvFrom,loading:loading.get(b.sourceClass+':'+b.id),comparison:{p,q,loading:l},identity:r.identity,quality:r.quality}});
 });
}
export function sortCompactRows(rows:readonly CompactRow[],key:string,descending=false){
 const value=(r:CompactRow):string|number|null=>key==='kv'?r.kv:key==='loading'?r.loading??r.metrics.loading?.ga??null:key==='delta'?r.metrics.ikss?.delta??r.metrics.voltage?.delta??r.metrics.p?.delta??null:key==='ga'?r.metrics.ikss?.ga??r.metrics.voltage?.ga??r.metrics.p?.ga??null:key==='pf'?r.metrics.ikss?.pf??r.metrics.voltage?.pf??r.metrics.p?.pf??null:key==='p'||key==='q'?r.metrics[key]?.ga??null:key==='ac'?r.acLabel??r.status:key==='tm'?r.tm:r.name;
 return [...rows].sort((a,b)=>{const x=value(a),y=value(b);if(x===null||y===null)return Number(x===null)-Number(y===null)||a.key.localeCompare(b.key);return (typeof x==='number'&&typeof y==='number'?x-y:String(x).localeCompare(String(y),'tr',{numeric:true}))*(descending?-1:1)||a.key.localeCompare(b.key);});
}
