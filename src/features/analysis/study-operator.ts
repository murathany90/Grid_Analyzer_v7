import type {AppContext} from '../../app/contracts';
import type {StudyRow} from './study-result-rows';
import {scenarioSignature} from '../../domain/scenario/overlay';
import {DEFAULT_HYBRID_POLICY} from '../../analysis/contingency-hybrid';
import {operationalLimits} from '../../analysis/contingency-hybrid/limits';
import {n1ControlEvidence} from '../../analysis/contingency-ac/control-evidence';
import {n1CaseCounts} from '../../analysis/contingency-hybrid/case-summary';
import {currentMapLf,currentN1Metadata,mapCaseOptions,angleHasReference} from '../../map/layer-policy';
import {modelPresentationIndex} from '../../map/presentation-index';
import {resolveN1Post} from '../../domain/benchmark/post-result-source';
import {postResultAssembler,postBranchMetric,type PostMapResults} from '../../analysis/contingency-ac/post-results';
import {rowObject} from '../../domain/benchmark/types';
import type {Cell} from './xlsx-export';

/** Presentation values live beside StudyRow, never inside the canonical JSON/export row. */
export interface StudyTriple {pre:number|null;post:number|null;delta:number|null;unit:string;reason:string}
export interface OperatorRow {row:StudyRow;values:Record<string,StudyTriple>}
const finite=(v:unknown):number|null=>typeof v==='number'&&Number.isFinite(v)?v:null;
const triple=(pre:unknown,post:unknown,unit:string,reason=''):StudyTriple=>({pre:finite(pre),post:finite(post),delta:reason||finite(pre)===null||finite(post)===null?null:Number(post)-Number(pre),unit,reason});
function metadata(ctx:AppContext,cls:string,fid:string,name?:string):StudyRow{
  const index=ctx.network?modelPresentationIndex(ctx.network):null,e=index?.equipmentByKey.get(cls+':'+fid)??index?.equipmentByFid.get(cls+':'+fid)??index?.physicalTerminalById.get(fid),sites=e?.siteIds.map(id=>index?.siteById.get(id))??[];
  fid=e?.sourceId??fid;
  return {id:cls+':'+fid,cls,fid,name:e?.name??name??fid,tm:sites.map(s=>s?.name).filter(Boolean).join(' / '),ytm:[...new Set(sites.map(s=>s?.areaName??s?.areaId).filter(Boolean))].join(' / '),nominal:e&&'vnKv' in e?e.vnKv:null,pre:null,post:null,delta:null,unit:'—',status:'NOT_RUN',reason:'',ikss:null,skss:null,pfIkss:null,pfSkss:null,preQ:null,postQ:null,postLoading:null,deltaLoading:null,unsupplied:null,outage:'',metadata:true};
}
/** Case rows describe the cut equipment. They contain no invented post-case numbers. */
export function n1CaseRows(ctx:AppContext):StudyRow[]{
  const current=currentN1Metadata(ctx),ac=new Map(current.ac.map(c=>[c.outage.caseId,c])),hybrid=new Map(current.hybrid?.cases.map(c=>[c.outage.caseId,c])??[]),dc=new Map(current.dc?.candidates.map(c=>{const e=ctx.network?modelPresentationIndex(ctx.network).equipmentByKey.get(c.sourceClass+':'+c.equipmentId):null;return ['N1:'+c.sourceClass+':'+(e?.sourceId??c.equipmentId),c] as const;})??[]),table=ctx.benchmark?.groups.N1.tables.N1_Cases_Raw,raw=new Map(table?.rows.map(v=>{const r=rowObject(table,v);return [String(r.caseId),r] as const;})??[]);
  return mapCaseOptions(ctx,'N1').map(([id,label])=>{const r=raw.get(id),parts=id.split(':'),a=ac.get(id),h=hybrid.get(id),d=dc.get(id),cls=a?.outage.sourceClass??h?.outage.sourceClass??String(r?.outageClass??parts[1]),fid=a?.outage.fid??h?.outage.fid??String(r?.outageFid??parts.slice(2).join(':')),row=metadata(ctx,cls,fid,String(r?.outageName??label));row.id=id;row.outage=id;row.status=a?.status??h?.status??d?.status??'NOT_RUN';row.reason=a?.reason??h?.reason??(d?'DC_P_ONLY; AC_POST_NOT_RUN':'AC_POST_NOT_RUN');return row;});
}
function terminalIndex(buses:PostMapResults['buses']){const map=new Map<string,PostMapResults['buses'][number]|null>();for(const b of buses)for(const term of b.terms)map.set(term,map.has(term)?null:b);return map;}
const partition=(b:PostMapResults['buses'][number]|null|undefined)=>b?JSON.stringify([b.vnKv,[...b.terms].sort()]):'';
function dcOperatorRows(ctx:AppContext,candidate:NonNullable<AppContext['n1Result']>['candidates'][number],caseId:string):OperatorRow[]{
  return candidate.topImpacts.map(impact=>{const row=metadata(ctx,impact.sourceClass,impact.equipmentId);row.status='GA_DC_SCREEN · '+candidate.status+' · UNVERIFIED';row.reason='DC_P_ONLY; Q_V_AC_LOADING_NOT_VERIFIED';row.outage=caseId;const p=triple(impact.baseFlowMw,impact.postFlowMw,'MW');p.delta=finite(impact.deltaPMw);return {row,values:{p,q:triple(null,null,'MVAr',row.reason),loading:triple(null,null,'%',row.reason)}};});
}
/** Build the five operator metrics together once for a current, selected snapshot pair. */
export function n1OperatorRows(ctx:AppContext,caseId=ctx.resultView.caseId):OperatorRow[]{
  const n=ctx.network;if(!n)return [];
  const options={network:n,scenario:ctx.scenario.current,settings:ctx.analysisSettings.value,ac:ctx.n1AcResults,hybrid:ctx.hybridResult},resolved=resolveN1Post(options,caseId??''),current=currentN1Metadata(ctx),lf=currentMapLf(ctx),manual=current.ac.find(c=>c.outage.caseId===caseId),candidate=current.dc?.candidates.find(c=>{const e=modelPresentationIndex(n).equipmentByKey.get(c.sourceClass+':'+c.equipmentId);return caseId==='N1:'+c.sourceClass+':'+(e?.sourceId??c.equipmentId);}),rows:OperatorRow[]=[];
  if(!resolved){
    // A current manual/hybrid rejection shadows a DC record for that same case.
    if(manual||current.hybrid?.cases.some(c=>c.outage.caseId===caseId)||!candidate)return rows;
    return dcOperatorRows(ctx,candidate,caseId??'');
  }
  const base=resolved.source==='HYBRID_FULL_AC'?current.hybrid?.basePost:lf?postResultAssembler(n,lf,'nominal'):undefined,post=resolved.post,beforeTerms=terminalIndex(base?.buses??[]),afterTerms=terminalIndex(post.buses),beforeBranches=new Map(base?.branches.map(b=>[b.sourceClass+':'+b.fid,b])??[]),afterBranches=new Map(post.branches.map(b=>[b.sourceClass+':'+b.fid,b])),side=ctx.resultView.side??'FROM';
  const incompatible=manual?.result&&lf&&(manual.result.identity.modelHash!==n.modelHash||manual.result.identity.engine!==lf.identity.engine||manual.result.identity.engineVersion!==lf.identity.engineVersion||manual.result.identity.analysisType!==lf.identity.analysisType)?'ENGINE_MISMATCH':'';
  for(const e of [...n.lines,...n.transformers]){
    const key=e.sourceClass+':'+e.sourceId,a=beforeBranches.get(key),b=afterBranches.get(key);if(!a&&!b)continue;
    let reason=incompatible||(!a?'BASE_NOT_RECORDED':!b?'POST_NOT_RECORDED':'');
    if(!reason&&(a!.from!==b!.from||a!.to!==b!.to||!a!.from||!a!.to||!partition(beforeTerms.get(a!.from))||partition(beforeTerms.get(a!.from))!==partition(afterTerms.get(b!.from!))||partition(beforeTerms.get(a!.to))!==partition(afterTerms.get(b!.to!))))reason='PARTITION_OR_ENDPOINT_MISMATCH';
    const values:Record<string,StudyTriple>={};for(const [id,metric,unit] of [['p','postPmw','MW'],['q','postQmvar','MVAr'],['loading','postLoadingPercent','%']]){
      let why=reason;if(id==='loading'&&!why){const x=a!.loading,y=b!.loading;if(['basis','season','fromLimitA','toLimitA','ratingMva','source'].some(k=>x[k as keyof typeof x]!==y[k as keyof typeof y]))why='LOADING_DENOMINATOR_UNVERIFIED';}
      values[id]=triple(a?postBranchMetric(a,metric,side):null,b?postBranchMetric(b,metric,side):null,unit,why);if(id==='loading'&&(values[id].pre===null||values[id].post===null))values[id].reason||='UNKNOWN_RATING';
    }
    const row=metadata(ctx,e.sourceClass,e.sourceId);row.preQ=values.q.pre;row.postQ=values.q.post;row.postLoading=values.loading.post;row.deltaLoading=values.loading.delta;row.outage=caseId??'';row.status=resolved.source+' · '+resolved.status+(resolved.status==='PARTIAL_SOLUTION'||current.hybrid?.studyProfile==='NATIVE_PARTIAL_CONTROLS'?' · DIAGNOSTIC_NOT_PF_PARITY':'');if(values.loading.post!==null&&values.loading.post>=100)row.status+=' · THERMAL_LIMIT_100';row.reason=[...new Set(Object.values(values).map(v=>v.reason).filter(Boolean))].join('; ');rows.push({row,values});
  }
  const islandMembers=(r:typeof lf)=>{const groups=new Map<string,string[]>();for(const bus of r?.buses??[]){const id=bus.islandId??'',terms=groups.get(id)??[];terms.push(...bus.terms);groups.set(id,terms);}return new Map([...groups].map(([id,terms])=>[id,terms.sort().join('|')]));},oldMembers=islandMembers(lf),newMembers=islandMembers(manual?.result??null);
  const rawBefore=new Map(lf?.buses.flatMap(b=>b.terms.map(t=>[t,b] as const))??[]),rawPost=new Map(manual?.result?.buses.flatMap(b=>b.terms.map(t=>[t,b] as const))??[]);
  for(const t of n.buses){
    const a=beforeTerms.get(t.id),b=afterTerms.get(t.id);if(!a&&!b)continue;const row=metadata(ctx,'ElmTerm',t.sourceId),why=incompatible||(!a?'BASE_NOT_RECORDED':!b?'POST_NOT_RECORDED':a.vnKv!==t.vnKv||b.vnKv!==t.vnKv||partition(a)!==partition(b)?'PARTITION_NOT_1_TO_1':'');
    const voltage=triple(a&&a.vnKv===t.vnKv?a.vmPu*t.vnKv:null,b&&b.vnKv===t.vnKv?b.vmPu*t.vnKv:null,'kV',why),x=rawBefore.get(t.id),y=rawPost.get(t.id),ref=(r:typeof lf,island?:string)=>Array.isArray(r?.diagnostics.islands)?r.diagnostics.islands.find(i=>i.islandId===island)?.referenceSource:null;
    const angleWhy=why||(!angleHasReference(lf,x??null)||!angleHasReference(manual?.result??null,y??null)?'ANGLE_REFERENCE_UNVERIFIED':ref(lf,x?.islandId)!==ref(manual?.result??null,y?.islandId)||x?.islandId!==y?.islandId||oldMembers.get(x?.islandId??'')!==newMembers.get(y?.islandId??'')?'ANGLE_REFERENCE_MISMATCH':'');
    const angle=triple(a?.angleDeg,b?.angleDeg,'°',angleWhy);row.outage=caseId??'';row.status=resolved.source+' · '+resolved.status+(resolved.status==='PARTIAL_SOLUTION'||current.hybrid?.studyProfile==='NATIVE_PARTIAL_CONTROLS'?' · DIAGNOSTIC_NOT_PF_PARITY':'');row.reason=[why,angleWhy].filter(Boolean).join('; ');rows.push({row,values:{voltage,angle}});
  }
  return rows;
}
export const studyEquipmentType=(r:StudyRow)=>r.cls==='ElmLne'?'line':r.cls==='ElmTr2'?'trafo':['ElmSite','ElmTerm'].includes(r.cls)?'bus':'other';
export function studyConstraintTypes(r:StudyRow){const s=r.status;return [s.includes('NOT_RUN')?'not-run':'',/BLOCKED|UNSUPPORTED|NOT_COMPUTABLE/.test(s)?'blocked':'',/PARTIAL/.test(s)?'partial':'',/THERMAL|VIOLATION|RISK/.test(s)&&!s.includes('UNVERIFIED')?'violation':'',/ISLAND|UNSUPPLIED/.test(s)?'island':'',/DC_|SCREENED|CAPACITY_UNAVAILABLE/.test(s)?'dc':'',/CONVERGED|CALCULATED|APPROXIMATION/.test(s)?'calculated':'',s.includes('UNVERIFIED')?'unverified':''].filter(Boolean);}

/** Inventory is independent of numerical results and user table filters. */
export function n1InventoryRows(ctx:AppContext):StudyRow[]{return ctx.network?[...ctx.network.lines,...ctx.network.transformers,...ctx.network.buses].map(e=>metadata(ctx,e.sourceClass,e.sourceId)):[];}
const catalogRequests=new WeakMap<AppContext,string>();
export function ensureOperatorCatalog(ctx:AppContext){
  if(!ctx.network||ctx.busy||typeof ctx.loadN1Catalog!=='function')return;
  const key=ctx.network.modelHash+'|'+scenarioSignature(ctx.scenario.current),id=ctx.n1CatalogIdentity;if(ctx.n1CatalogResult&&id?.modelHash===ctx.network.modelHash&&id.scenarioHash===scenarioSignature(ctx.scenario.current)&&id.includeAllVoltages)return;
  if(catalogRequests.get(ctx)===key)return;catalogRequests.set(ctx,key);
  queueMicrotask(()=>{if(ctx.busy||!ctx.network||ctx.network.modelHash+'|'+scenarioSignature(ctx.scenario.current)!==key){catalogRequests.delete(ctx);return;}void ctx.loadN1Catalog('scenario','nominal',true).catch(()=>{});});
}
export interface OperatorCase extends OperatorRow {caseId:string;caseName:string;method:string;verified:boolean;violation:boolean;newWorsened:boolean;severity:number}
export interface OperatorGroup extends OperatorRow {cases:OperatorCase[];critical:OperatorCase}
const rankOperatorCases=(a:OperatorCase,b:OperatorCase)=>Number(b.violation)-Number(a.violation)||Number(b.verified)-Number(a.verified)||b.severity-a.severity||(b.values.loading?.post??-Infinity)-(a.values.loading?.post??-Infinity)||a.caseId.localeCompare(b.caseId);
/** Groups retain whole case pairs. No component-wise maxima are combined. */
export function groupN1Cases(ctx:AppContext,cases:readonly StudyRow[]):OperatorGroup[]{
  const current=currentN1Metadata(ctx),names=new Map(cases.map(c=>[c.id,c.name])),groups=new Map<string,OperatorCase[]>(),manual=new Map(current.ac.map(c=>[c.outage.caseId,c])),hybrid=new Map(current.hybrid?.cases.map(c=>[c.outage.caseId,c])??[]);
  const index=ctx.network?modelPresentationIndex(ctx.network):null,dc=new Map(current.dc?.candidates.map(c=>['N1:'+c.sourceClass+':'+(index?.equipmentByKey.get(c.sourceClass+':'+c.equipmentId)?.sourceId??c.equipmentId),c])??[]),lf=currentMapLf(ctx),baseVerified=!!(lf&&ctx.network&&n1ControlEvidence(ctx.network,lf,ctx.analysisSettings.value).fidelity==='CONTROL_VERIFIED');
  const ids=new Set([...manual.keys(),...hybrid.keys(),...dc.keys()]);
  for(const caseId of ids){
    const a=manual.get(caseId),h=hybrid.get(caseId),d=dc.get(caseId),method=a?'MANUAL_FULL_AC':h?'HYBRID_FULL_AC':'GA_DC_SCREEN',verified=!!(a?baseVerified&&a.controlEvidence?.numericalSolved&&a.controlEvidence.fidelity==='CONTROL_VERIFIED'&&a.status==='CONVERGED':h?.controlEvidence?.numericalSolved&&h.controlEvidence.fidelity==='CONTROL_VERIFIED'&&current.hybrid?.base?.controlEvidence?.fidelity==='CONTROL_VERIFIED'&&['AC_CONVERGED_WITHIN_LIMIT','AC_CONVERGED_VIOLATION'].includes(h.status));
    for(const entry of !a&&!h&&d?dcOperatorRows(ctx,d,caseId):n1OperatorRows(ctx,caseId)){
      if(entry.row.fid===(a?.outage.fid??h?.outage.fid))continue;
      const e=index?.equipmentByFid.get(entry.row.cls+':'+entry.row.fid)??index?.physicalTerminalById.get(entry.row.fid),ytms=e?.siteIds.flatMap(id=>index?.siteById.get(id)?.areaId??[])??[];
      const v=entry.values,limits=operationalLimits(current.hybrid?.policy??DEFAULT_HYBRID_POLICY,current.hybrid?.policy.limitProfiles,entry.row.nominal??NaN,ytms),before=v.loading?.pre,after=v.loading?.post,min=limits.voltageMinPu*(entry.row.nominal??0),max=limits.voltageMaxPu*(entry.row.nominal??0),deviation=(x:number)=>Math.max(min-x,x-max,0)/Math.max(1,entry.row.nominal??0)*100;
      const severity=entry.row.cls==='ElmTerm'?v.voltage?.post===null||v.voltage?.post===undefined?0:deviation(v.voltage.post):after==null?0:Math.max(0,after-limits.operationalLoadingLimitPercent),baseSeverity=entry.row.cls==='ElmTerm'?v.voltage?.pre==null?null:deviation(v.voltage.pre):before==null?null:Math.max(0,before-limits.operationalLoadingLimitPercent),paired=finite(entry.row.cls==='ElmTerm'?v.voltage?.delta:v.loading?.delta)!==null;
      if(!severity&&!Object.values(v).some(t=>t.delta!==null&&Math.abs(t.delta)>1e-7||t.pre!==null&&t.post===null))continue;
      const item:OperatorCase={...entry,row:{...entry.row,outage:caseId,status:(entry.row.status.replace(/ · THERMAL_LIMIT_100/g,''))+(verified&&severity>0?' · VIOLATION':'')+(!verified?' · UNVERIFIED':'')},caseId,caseName:names.get(caseId)??caseId,method,verified,violation:verified&&severity>0,newWorsened:verified&&paired&&baseSeverity!==null&&severity>baseSeverity+1e-9,severity};
      let list=groups.get(entry.row.id);if(!list){list=[];groups.set(entry.row.id,list);}list.push(item);
    }
    // Evicted numerical details remain discoverable without inventing paired values.
    if(h&&!h.mapResults)for(const key of new Set([...(h.violationKeys??[]),...(h.affectedKeys??[])])){const match=/^(ElmLne|ElmTr2|ElmTerm):(.+):(voltagePu|postLoadingPercent)$/.exec(key);if(!match)continue;const row=metadata(ctx,match[1],match[2]);row.outage=caseId;row.status=h.status+' · DETAIL_NOT_LOADED'+(!verified?' · UNVERIFIED':'');row.reason='CASE_DETAIL_NOT_LOADED';const blank=triple(null,null,'','CASE_DETAIL_NOT_LOADED'),item:OperatorCase={row,values:row.cls==='ElmTerm'?{voltage:{...blank,unit:'kV'},angle:{...blank,unit:'°'}}:{p:{...blank,unit:'MW'},q:{...blank,unit:'MVAr'},loading:{...blank,unit:'%'}},caseId,caseName:names.get(caseId)??caseId,method,verified,violation:verified&&(h.violationKeys??[]).includes(key),newWorsened:false,severity:0};let list=groups.get(row.id);if(!list){list=[];groups.set(row.id,list);}if(!list.some(c=>c.caseId===caseId))list.push(item);}
  }
  const rank=rankOperatorCases;
  return [...groups.values()].map(list=>{list.sort(rank);const critical=list[0];return {row:critical.row,values:critical.values,cases:list,critical};}).sort((a,b)=>rank(a.critical,b.critical)||a.row.name.localeCompare(b.row.name,'tr'));
}
/** Filter cases before choosing a critical pair, preserving OR within each group. */
export function filterOperatorGroups(groups:readonly OperatorGroup[],methods:readonly string[],states:readonly string[],scope:string){
  return groups.flatMap(g=>{const cases=g.cases.filter(c=>(!methods.length||methods.includes(c.method))&&(!states.length||studyConstraintTypes(c.row).some(s=>states.includes(s)))&&(scope==='all'||scope==='violations'&&c.violation||scope==='worsened'&&c.newWorsened||scope==='unverified'&&!c.verified));const critical=cases[0];return critical?[{...g,cases,critical,row:critical.row,values:critical.values}]:[];}).sort((a,b)=>rankOperatorCases(a.critical,b.critical)||a.row.name.localeCompare(b.row.name,'tr'));
}
export function operatorMetricKeys(row:StudyRow,branchMode:string,busMode:string){
  const mode=studyEquipmentType(row)==='bus'?busMode:branchMode;
  return mode==='pq-loading'?['p','q','loading']:mode==='p-loading'?['p','loading']:mode==='pq'?['p','q']:mode==='voltage-angle'?['voltage','angle']:[mode];
}
export function operatorReason(code:string){
  if(!code)return '';
  const text=/DC_P_ONLY|Q_V_AC/.test(code)?'DC yalnız P üretir; Q, gerilim ve AC yüklenmesi doğrulanmadı.':/UNKNOWN_RATING/.test(code)?'Kaynak kapasitesi eksik; yüklenme hesaplanamaz.':/DENOMINATOR/.test(code)?'Kapasite paydaları uyumsuz; yük farkı gösterilmez.':/PARTITION|ENDPOINT|ENGINE_MISMATCH/.test(code)?'Baz ve sonrası model/uç eşleşmesi uyumsuz; fark gösterilmez.':/ANGLE_REFERENCE/.test(code)?'Açı referansı doğrulanmadı; açı farkı gösterilmez.':/BASE_NOT_RECORDED/.test(code)?'Uyumlu baz sonucu yok; baz hesabını çalıştırın.':/POST_NOT_RECORDED/.test(code)?'Kesinti sonrası sonuç yok; vakayı hesaplayın.':/CASE_DETAIL_NOT_LOADED/.test(code)?'Sayısal vaka ayrıntısını önbellekten yükleyin.':'Doğrulama ayrıntısını Teknik Tanı bölümünde inceleyin.';
  return text+' ('+code+')';
}
/** A distinct view projection; canonical raw StudyRow exports keep their existing schema. */
export function operatorExportRows(rows:readonly StudyRow[],groups:ReadonlyMap<string,OperatorGroup>,keys:(row:StudyRow)=>string[],identity:{model?:string;scenario?:string;source:string}) :Cell[][]{
  return [['Ekipman','TM','FID','Sınıf','Vaka','Kesilen ekipman','Metrik','Birim','Fark birimi','Önce','Sonra','Fark','Kaynak','Yöntem','Durum','Gerekçe','Model','Senaryo'],...rows.flatMap(row=>{
    const g=groups.get(row.id);return (g?keys(row):['katalog']).map(key=>{const v=g?.values[key];return [row.name,row.tm,row.fid,row.cls,g?.critical.caseId??row.outage,g?.critical.caseName??row.name,key,v?.unit??null,key==='loading'?'pp':v?.unit??null,v?.pre??null,v?.post??null,v?.delta??null,identity.source,g?.critical.method??'CATALOG',row.status,v?.reason||row.reason,identity.model??null,identity.scenario??null];});
  })];
}
export function n1OperatorDiagnosis(ctx:AppContext){
  const h=currentN1Metadata(ctx).hybrid,lf=currentMapLf(ctx),e=h?.base?.controlEvidence??(lf&&ctx.network?n1ControlEvidence(ctx.network,lf,ctx.analysisSettings.value):null),partial=h?.studyProfile==='NATIVE_PARTIAL_CONTROLS'||h?.studyProfile==='GA_APPROX_STATION_OFF'||currentN1Metadata(ctx).ac.some(c=>c.status==='PARTIAL_SOLUTION');
  const reasons=[...new Set([...(e?.reasons??[]),h?.reason??''])].join('; ');let message='AC POST henüz yok · katalog ve DC taraması kullanılabilir.';
  if(h?.status==='BLOCKED'||e&&e.fidelity!=='CONTROL_VERIFIED')message=e?.numericalSolved?'AC yakınsadı; kontrol/kaynak doğrulanmadı. DC kullanın veya kaynak verisini kontrol edin.':'AC doğrulanamadı. Teknik tanıya bakın; katalog ve DC taraması kullanılabilir.';
  else if(e?.fidelity==='CONTROL_VERIFIED')message='Kontrol/model doğrulandı · kısıt sonuçlarını inceleyin.';
  if(partial&&e?.numericalSolved)message='Tanısal — PF paritesi doğrulanmadı';
  const counts=n1CaseCounts(n1CaseRows(ctx));
  return {message,counts,technical:{identity:h?.identity??lf?.identity??null,profile:h?.studyProfile??'CURRENT_SETTINGS',hybridStatus:h?.status??'NOT_RUN',reason:reasons,newtonStatus:h?.base?.status??lf?.status??'NOT_RUN',evidence:e,convergence:e?.convergence??null,stationSummary:e?.stationSupport??null,baseControlSupport:h?.base?.controlSupport??null,
    // A partial-profile hybrid base is distinct from the independently cached working LF.
    workingLf:lf?{identity:lf.identity,status:lf.status,sourceFidelity:lf.diagnostics.sourceFidelity??null,stationControls:lf.diagnostics.stationControllerResults??null,stationMappings:lf.diagnostics.stationControllerMappings??null,voltageControl:lf.diagnostics.finalControlRevalidation??null}:null}};
}
