import type {AppContext} from '../../app/contracts';
import type {StudyRow} from './study-result-rows';
import {currentMapLf,currentN1Metadata,mapCaseOptions,angleHasReference} from '../../map/layer-policy';
import {modelPresentationIndex} from '../../map/presentation-index';
import {resolveN1Post} from '../../domain/benchmark/post-result-source';
import {postResultAssembler,postBranchMetric,type PostMapResults} from '../../analysis/contingency-ac/post-results';
import {rowObject} from '../../domain/benchmark/types';

/** Presentation values live beside StudyRow, never inside the canonical JSON/export row. */
export interface StudyTriple {pre:number|null;post:number|null;delta:number|null;unit:string;reason:string}
export interface OperatorRow {row:StudyRow;values:Record<string,StudyTriple>}
const finite=(v:unknown):number|null=>typeof v==='number'&&Number.isFinite(v)?v:null;
const triple=(pre:unknown,post:unknown,unit:string,reason=''):StudyTriple=>({pre:finite(pre),post:finite(post),delta:reason||finite(pre)===null||finite(post)===null?null:Number(post)-Number(pre),unit,reason});
function metadata(ctx:AppContext,cls:string,fid:string,name?:string):StudyRow{
  const index=ctx.network?modelPresentationIndex(ctx.network):null,e=index?.equipmentByKey.get(cls+':'+fid)??index?.equipmentByFid.get(cls+':'+fid)??index?.physicalTerminalById.get(fid),sites=e?.siteIds.map(id=>index?.siteById.get(id))??[];
  return {id:cls+':'+fid,cls,fid,name:e?.name??name??fid,tm:sites.map(s=>s?.name).filter(Boolean).join(' / '),ytm:[...new Set(sites.map(s=>s?.areaName??s?.areaId).filter(Boolean))].join(' / '),nominal:e&&'vnKv' in e?e.vnKv:null,pre:null,post:null,delta:null,unit:'—',status:'NOT_RUN',reason:'',ikss:null,skss:null,pfIkss:null,pfSkss:null,preQ:null,postQ:null,postLoading:null,deltaLoading:null,unsupplied:null,outage:'',metadata:true};
}
/** Case rows describe the cut equipment. They contain no invented post-case numbers. */
export function n1CaseRows(ctx:AppContext):StudyRow[]{
  const current=currentN1Metadata(ctx),ac=new Map(current.ac.map(c=>[c.outage.caseId,c])),hybrid=new Map(current.hybrid?.cases.map(c=>[c.outage.caseId,c])??[]),dc=new Map(current.dc?.candidates.map(c=>{const e=ctx.network?modelPresentationIndex(ctx.network).equipmentByKey.get(c.sourceClass+':'+c.equipmentId):null;return ['N1:'+c.sourceClass+':'+(e?.sourceId??c.equipmentId),c] as const;})??[]),table=ctx.benchmark?.groups.N1.tables.N1_Cases_Raw,raw=new Map(table?.rows.map(v=>{const r=rowObject(table,v);return [String(r.caseId),r] as const;})??[]);
  return mapCaseOptions(ctx,'N1').map(([id,label])=>{const r=raw.get(id),parts=id.split(':'),a=ac.get(id),h=hybrid.get(id),d=dc.get(id),cls=a?.outage.sourceClass??h?.outage.sourceClass??String(r?.outageClass??parts[1]),fid=a?.outage.fid??h?.outage.fid??String(r?.outageFid??parts.slice(2).join(':')),row=metadata(ctx,cls,fid,String(r?.outageName??label));row.id=id;row.outage=id;row.status=a?.status??h?.status??d?.status??'NOT_RUN';row.reason=a?.reason??h?.reason??(d?'DC_P_ONLY; AC_POST_NOT_RUN':'AC_POST_NOT_RUN');return row;});
}
function terminalIndex(buses:PostMapResults['buses']){const map=new Map<string,PostMapResults['buses'][number]|null>();for(const b of buses)for(const term of b.terms)map.set(term,map.has(term)?null:b);return map;}
const partition=(b:PostMapResults['buses'][number]|null|undefined)=>b?JSON.stringify([b.vnKv,[...b.terms].sort()]):'';
/** Build the five operator metrics together once for a current, selected snapshot pair. */
export function n1OperatorRows(ctx:AppContext):OperatorRow[]{
  const n=ctx.network;if(!n)return [];
  const options={network:n,scenario:ctx.scenario.current,settings:ctx.analysisSettings.value,ac:ctx.n1AcResults,hybrid:ctx.hybridResult},resolved=resolveN1Post(options,ctx.resultView.caseId??''),current=currentN1Metadata(ctx),lf=currentMapLf(ctx),manual=current.ac.find(c=>c.outage.caseId===ctx.resultView.caseId),candidate=current.dc?.candidates.find(c=>{const e=modelPresentationIndex(n).equipmentByKey.get(c.sourceClass+':'+c.equipmentId);return ctx.resultView.caseId==='N1:'+c.sourceClass+':'+(e?.sourceId??c.equipmentId);}),rows:OperatorRow[]=[];
  if(!resolved){
    // A current manual/hybrid rejection shadows a DC record for that same case.
    if(manual||current.hybrid?.cases.some(c=>c.outage.caseId===ctx.resultView.caseId)||!candidate)return rows;
    for(const impact of candidate.topImpacts){const row=metadata(ctx,impact.sourceClass,impact.equipmentId);row.status='GA_DC_SCREEN · '+candidate.status;row.reason='DC_P_ONLY; Q_V_AC_LOADING_NOT_VERIFIED';row.outage=ctx.resultView.caseId??'';const p=triple(impact.baseFlowMw,impact.postFlowMw,'MW');p.delta=finite(impact.deltaPMw);rows.push({row,values:{p,q:triple(null,null,'MVAr',row.reason),loading:triple(null,null,'%',row.reason)}});}return rows;
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
    const row=metadata(ctx,e.sourceClass,e.sourceId);row.preQ=values.q.pre;row.postQ=values.q.post;row.postLoading=values.loading.post;row.deltaLoading=values.loading.delta;row.status=resolved.source+' · '+resolved.status;if(values.loading.post!==null&&values.loading.post>=100)row.status+=' · THERMAL_LIMIT_100';row.reason=[...new Set(Object.values(values).map(v=>v.reason).filter(Boolean))].join('; ');rows.push({row,values});
  }
  const islandMembers=(r:typeof lf)=>{const groups=new Map<string,string[]>();for(const bus of r?.buses??[]){const id=bus.islandId??'',terms=groups.get(id)??[];terms.push(...bus.terms);groups.set(id,terms);}return new Map([...groups].map(([id,terms])=>[id,terms.sort().join('|')]));},oldMembers=islandMembers(lf),newMembers=islandMembers(manual?.result??null);
  const rawBefore=new Map(lf?.buses.flatMap(b=>b.terms.map(t=>[t,b] as const))??[]),rawPost=new Map(manual?.result?.buses.flatMap(b=>b.terms.map(t=>[t,b] as const))??[]);
  for(const t of n.buses){
    const a=beforeTerms.get(t.id),b=afterTerms.get(t.id);if(!a&&!b)continue;const row=metadata(ctx,'ElmTerm',t.sourceId),why=incompatible||(!a?'BASE_NOT_RECORDED':!b?'POST_NOT_RECORDED':a.vnKv!==t.vnKv||b.vnKv!==t.vnKv||partition(a)!==partition(b)?'PARTITION_NOT_1_TO_1':'');
    const voltage=triple(a&&a.vnKv===t.vnKv?a.vmPu*t.vnKv:null,b&&b.vnKv===t.vnKv?b.vmPu*t.vnKv:null,'kV',why),x=rawBefore.get(t.id),y=rawPost.get(t.id),ref=(r:typeof lf,island?:string)=>Array.isArray(r?.diagnostics.islands)?r.diagnostics.islands.find(i=>i.islandId===island)?.referenceSource:null;
    const angleWhy=why||(!angleHasReference(lf,x??null)||!angleHasReference(manual?.result??null,y??null)?'ANGLE_REFERENCE_UNVERIFIED':ref(lf,x?.islandId)!==ref(manual?.result??null,y?.islandId)||x?.islandId!==y?.islandId||oldMembers.get(x?.islandId??'')!==newMembers.get(y?.islandId??'')?'ANGLE_REFERENCE_MISMATCH':'');
    const angle=triple(a?.angleDeg,b?.angleDeg,'°',angleWhy);row.status=resolved.source+' · '+resolved.status;row.reason=[why,angleWhy].filter(Boolean).join('; ');rows.push({row,values:{voltage,angle}});
  }
  return rows;
}
export const studyEquipmentType=(r:StudyRow)=>r.cls==='ElmLne'?'line':r.cls==='ElmTr2'?'trafo':['ElmSite','ElmTerm'].includes(r.cls)?'bus':'other';
export function studyConstraintTypes(r:StudyRow){const s=r.status;return [s.includes('NOT_RUN')?'not-run':'',/BLOCKED|UNSUPPORTED|NOT_COMPUTABLE/.test(s)?'blocked':'',/PARTIAL/.test(s)?'partial':'',/THERMAL|VIOLATION|RISK/.test(s)?'violation':'',/ISLAND|UNSUPPLIED/.test(s)?'island':'',/DC_|SCREENED|CAPACITY_UNAVAILABLE/.test(s)?'dc':'',/CONVERGED|CALCULATED|APPROXIMATION/.test(s)?'calculated':''].filter(Boolean);}
