import type {BenchmarkMapSelection,BenchmarkMapValue} from '../domain/benchmark/map-layer';
import {benchmarkLayerColor} from '../domain/benchmark/map-layer';
import type {CalculationResult} from '../domain/results/types';
import type {Settings} from '../persistence/settings';
import type {AppContext} from '../app/contracts';
import type {BusResult} from '../domain/results/types';
import type {CanonicalNetwork} from '../domain/model/network';
import {buildBenchmarkMapData,benchmarkMapGate,type BenchmarkMapData} from '../domain/benchmark/map-layer';
import {metricRows,preflightBenchmark} from '../domain/benchmark/comparison';
import {scenarioSignature,emptyScenario} from '../domain/scenario/overlay';
import {voltageMatches} from '../domain/model/voltage-band';
import {lfSnapshotIsCurrent,resolveN1Post} from '../domain/benchmark/post-result-source';
import {solutionCompleteness} from '../domain/results/diagnostics';
import {rowObject} from '../domain/benchmark/types';

const labels:Record<string,string>={voltagePu:'Bara gerilimi (pu)',voltageKv:'Bara gerilimi (kV)',angleDeg:'Bara açısı (°)',pFromMw:'Hat P giriş (MW)',qFromMvar:'Hat Q giriş (MVAr)',sFromMva:'Hat S giriş (MVA)',pToMw:'Hat P çıkış (MW)',qToMvar:'Hat Q çıkış (MVAr)',sToMva:'Hat S çıkış (MVA)',pHvMw:'Trafo P yüksek gerilim (MW)',qHvMvar:'Trafo Q yüksek gerilim (MVAr)',sHvMva:'Trafo S yüksek gerilim (MVA)',pLvMw:'Trafo P alçak gerilim (MW)',qLvMvar:'Trafo Q alçak gerilim (MVAr)',sLvMva:'Trafo S alçak gerilim (MVA)',iFromA:'Hat akımı giriş (A)',iToA:'Hat akımı çıkış (A)',loadingPercent:'Termik yüklenme (%)',pLossMw:'Aktif kayıp (MW)',qLossMvar:'Reaktif kayıp (MVAr)',pResultMw:'Ekipman P (MW)',qResultMvar:'Ekipman Q (MVAr)',postLoadingPercent:'Kesinti sonrası tahmini yük (%)',postPmw:'Kesinti sonrası P (MW)',postQmvar:'Kesinti sonrası Q (MVAr)',postMva:'Kesinti sonrası S (MVA)',postVoltagePu:'Kesinti sonrası bara gerilimi (pu)',postCurrentA:'Kesinti sonrası akım (A)',postCurrentLoadingPercent:'Kesinti sonrası akım yükü (%)',postApparentLoadingPercent:'Kesinti sonrası görünür güç yükü (%)',islands:'Kesinti sonrası elektrik adaları',thermalRisk:'Kesinti sonrası termik risk (%)',ikssKa:'Başlangıç kısa devre akımı (kA)',skssMva:'Kısa devre gücü (MVA)',ipKa:'Tepe kısa devre akımı (kA)',ibKa:'Kesme akımı (kA)',ithKa:'Termik kısa devre akımı (kA)'};
export const mapMetricLabel=(metric:string)=>labels[metric]??metric;

/** UI choices do not change canonical metric/export schemas. */
export const LF_MAP_METRICS=[
  {metric:'voltageKv',label:'Bara Gerilimi (kV)',target:'ElmTerm'},
  {metric:'angleDeg',label:'Bara Açısı (°)',target:'ElmTerm'},
  {metric:'pFromMw',label:'Hat Aktif Güç (MW)',target:'ElmLne'},
  {metric:'qFromMvar',label:'Hat Reaktif Güç (MVAr)',target:'ElmLne'},
  {metric:'pHvMw',label:'Trafo Aktif Güç (MW)',target:'ElmTr2'},
  {metric:'qHvMvar',label:'Trafo Reaktif Güç (MVAr)',target:'ElmTr2'},
] as const;
export const finiteNumber=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
export function matchedVoltageKv(pu:unknown,nominal:unknown,otherNominal:unknown):number|null{
  return finiteNumber(pu)&&finiteNumber(nominal)&&nominal>0&&nominal===otherNominal?pu*nominal:null;
}
export const lfMapTarget=(metric:string)=>LF_MAP_METRICS.find(m=>m.metric===metric)?.target;
export function currentMapLf(ctx:AppContext){const r=ctx.resultStore.get(ctx.scenario.selectedId==='B0'?'base':'scenario','powerFlow');return lfSnapshotIsCurrent(r,ctx.network,ctx.scenario.current,ctx.analysisSettings.value)?r:null;}
export function representativeStationBus(ctx:AppContext,siteId:string,result:CalculationResult|null){
  const nominals=ctx.network?.buses.filter(b=>b.siteIds.includes(siteId)&&voltageMatches(b.vnKv,ctx.filters.voltages)).map(b=>b.vnKv)??[],nominal=nominals.length?Math.max(...nominals):null;
  const terms=new Map(ctx.network?.buses.map(b=>[b.id,b]));
  const buses=result?.buses.filter(b=>b.siteIds.includes(siteId)&&b.vnKv===nominal&&b.terms.length>0&&b.terms.every(t=>terms.get(t)?.vnKv===nominal)&&finiteNumber(b.vmPu))??[];
  return {nominal,bus:buses.sort((a,b)=>b.vmPu-a.vmPu||a.id.localeCompare(b.id))[0]??null,count:buses.length};
}
export function angleHasReference(result:CalculationResult|null,bus:BusResult|null):boolean{
  const islands=result?.diagnostics.islands;
  return !!bus?.islandId&&finiteNumber(bus.angleRad)&&Array.isArray(islands)&&islands.some(i=>i.islandId===bus.islandId&&typeof i.referenceSource==='string'&&i.referenceSource.length>0&&!['NO_REFERENCE','NO_RESULT'].includes(i.status));
}
export function transformerFromIsHv(n:CanonicalNetwork,from:string,to:string,hv:number,lv:number):boolean|null{
  const a=n.buses.find(b=>b.id===from)?.vnKv,b=n.buses.find(b=>b.id===to)?.vnKv;
  return hv>lv&&a===hv&&b===lv?true:hv>lv&&a===lv&&b===hv?false:null;
}
export function mapPresentationGate(ctx:AppContext,s:BenchmarkMapSelection){
  if(s.analysis==='LF'&&['PF','DELTA','EXPLORATORY_DELTA'].includes(s.source)&&scenarioSignature(ctx.scenario.current)!==scenarioSignature(emptyScenario()))return {enabled:false,reason:'PF_SCENARIO_IDENTITY_UNVERIFIED'};
  const metric=s.analysis==='LF'&&s.source==='GA'&&lfMapTarget(s.metric)==='ElmTr2'?(s.metric==='pHvMw'?'pFromMw':'qFromMvar'):s.metric;
  const gate=benchmarkMapGate(ctx,{...s,metric});
  if(gate.enabled&&s.analysis==='N1'&&s.source==='GA'){const p=selectedN1Presentation(ctx);if(!p.post&&['ISLANDING','UNSUPPORTED_STATION_CONTROL','UNSUPPORTED_CONTROL_CONFIGURATION'].includes(p.status))return {enabled:false,reason:p.status+'; AC POST: NOT_RUN'};}
  if(gate.enabled&&s.analysis==='SC'&&s.source==='GA'){const p=selectedScPresentation(ctx);if(ctx.resultView.faultId&&!p.fault)return {enabled:false,reason:'FAULT_OR_PARTITION_IDENTITY_UNVERIFIED'};if(p.sc?.profile.faultType!=='3PH')return {enabled:false,reason:'SC_FAULT_PROFILE_UNVERIFIED'};}
  if(gate.enabled&&s.analysis==='LF'&&s.source==='DELTA'){
    const rows=mapReferenceRows(ctx,s);if(!rows.some(r=>r.delta!==null))return {enabled:false,reason:'LF_METHOD_OR_CELL_PARITY_UNVERIFIED'};
  }
  return gate;
}
export function mapCaseOptions(ctx:AppContext,analysis:'N1'|'SC'):string[][]{
  const rows:string[][]=[];
  if(analysis==='N1'){
    const table=ctx.benchmark?.groups.N1.tables.N1_Cases_Raw;for(const row of table?.rows??[]){const r=rowObject(table!,row);rows.push([String(r.caseId),String(r.outageName||r.caseId)]);}
    for(const c of [...ctx.n1AcResults,...ctx.hybridResult?.cases??[]])if(!rows.some(r=>r[0]===c.outage.caseId))rows.push([c.outage.caseId,c.outage.caseId+' · '+c.status]);
    for(const c of ctx.n1Result?.candidates??[]){const e=[...ctx.network?.lines??[],...ctx.network?.transformers??[]].find(e=>e.id===c.equipmentId&&e.sourceClass===c.sourceClass),id=`N1:${c.sourceClass}:${e?.sourceId??c.equipmentId}`;if(!rows.some(r=>r[0]===id))rows.push([id,(e?.name??id)+' · '+c.status]);}
  }else{
    for(const f of ctx.scResult?.faults??[])rows.push([f.physicalTerminalFid,(ctx.network?.buses.find(b=>b.id===f.physicalTerminalFid)?.name??f.physicalTerminalFid)+' · '+f.status]);
    const table=ctx.benchmark?.groups.SC.tables.SC_BusResults_Raw;for(const row of table?.rows??[]){const r=rowObject(table!,row),id=String(r.physicalTerminalFid??r.fid??'');if(id&&!rows.some(row=>row[0]===id))rows.push([id,String(r.physicalTerminalName??r.name??id)+' · PF 3PH MAX']);}
  }return rows;
}
export function mapReferenceRows(ctx:AppContext,s:BenchmarkMapSelection){
  const table=ctx.benchmark?.groups[s.analysis].tables[s.table];if(!table||!ctx.network)return [];
  const r=ctx.resultStore.get('base','powerFlow');
  const mode=selectedScPresentation(ctx).sc?.profile.calculateMode??'MAX';
  const faults=s.analysis==='SC'?table.rows.map(row=>rowObject(table,row)).filter(row=>['3PH','3-Phase Short-Circuit'].includes(String(row.faultType))&&row.calculateMode===mode):[];
  return metricRows(table,preflightBenchmark(ctx.benchmark!,ctx.network,r,ctx.powerFactoryControlContextNumericFile),s.metric,{lfResult:r,network:ctx.network,scenario:ctx.scenario.current,settings:ctx.analysisSettings.value,diagnostic:s.diagnostic,ac:ctx.n1AcResults,hybrid:ctx.hybridResult,sc:ctx.scResult,benchmark:ctx.benchmark}).filter(r=>(s.analysis!=='N1'||r.caseId===s.caseId)&&(s.analysis!=='SC'||faults.some(f=>String(f.physicalTerminalFid??f.fid)===r.fid&&Number(f.nominalKv)===r.nominalKv)));
}
/** A view-only projection: canonical domain maps, solver values and caches stay intact. */
export function buildMapPresentationData(ctx:AppContext,s:BenchmarkMapSelection):BenchmarkMapData{
  const gate=mapPresentationGate(ctx,s),empty:BenchmarkMapData={...gate,branches:new Map(),sites:new Map(),outage:null,noGeometry:0,numericValues:0};if(!gate.enabled)return empty;
  const target=s.analysis==='LF'?lfMapTarget(s.metric):undefined;
  const transformed=s.source==='GA'&&target==='ElmTr2'?{...s,metric:s.metric==='pHvMw'?'pFromMw':'qFromMvar'}:s;
  const data=buildBenchmarkMapData(ctx,transformed),result=currentMapLf(ctx),n=ctx.network;
  if(!n)return data;
  if(s.analysis==='N1'&&s.source==='GA'&&s.n1Layer==='NEW_CONSTRAINTS'){
    const post=buildBenchmarkMapData(ctx,{...s,n1Layer:'POST'}),changes=ctx.hybridResult?.cases.find(c=>c.outage.caseId===s.caseId)?.constraintChanges?.filter(c=>['NEW','WORSENED'].includes(c.state))??[];
    const equipment=new Map([...n.lines,...n.transformers].map(e=>[e.sourceClass+':'+e.id,e])),thermal=new Map(changes.filter(c=>c.metric==='postLoadingPercent').map(c=>[c.sourceClass+':'+c.fid,c]));
    data.branches.clear();data.sites.clear();for(const [key,value] of post.branches){const e=equipment.get(key),change=e?thermal.get(e.sourceClass+':'+e.sourceId):undefined;if(change)data.branches.set(key,{...value,status:change.state});}
  }
  if(s.analysis==='SC'&&s.source!=='GA'){
    data.sites.clear();data.branches.clear();for(const r of mapReferenceRows(ctx,s).filter(r=>r.fid===ctx.resultView.faultId)){
      const term=n.buses.find(b=>b.id===r.fid);if(!term||r.nominalKv!==term.vnKv)continue;const value=s.source==='PF'?r.pf.value:s.source==='EXPLORATORY_DELTA'&&r.identityMatched?r.diagnosticDelta??null:null;
      for(const id of term.siteIds)data.sites.set(id,{value:r.pf.availability==='INVALID'||r.pf.qualityFlags.includes('SENTINEL_CANDIDATE')?null:value,unit:r.pf.unit,status:s.source==='PF'?'PF_REFERENCE_ONLY':r.status,details:[],representativeFid:r.fid});
    }
  }
  if(target==='ElmLne'||target==='ElmTr2'){
    data.branches=new Map([...data.branches].filter(([k])=>k.startsWith(target+':')));
    if(target==='ElmLne')data.sites.clear();
    if(target==='ElmTr2'&&s.source==='GA'){
      data.sites.clear();for(const t of n.transformers){const row=result?.branches.find(b=>b.sourceClass==='ElmTr2'&&b.id===t.id),fromHv=transformerFromIsHv(n,t.from,t.to,Math.max(t.vnKv,t.lvKv),Math.min(t.vnKv,t.lvKv));
        const value=row&&fromHv!==null?(s.metric==='pHvMw'?(fromHv?row.pf:row.pt):(fromHv?row.qf:row.qt)):null;
        const v={value:finiteNumber(value)?value:null,unit:s.metric==='pHvMw'?'MW':'MVAr',status:fromHv===null?'HV_LV_IDENTITY_UNVERIFIED':'GA_FULL_AC',details:[]};data.branches.set('ElmTr2:'+t.id,v);for(const site of t.siteIds)if(v.value!==null)data.sites.set(site,v);
      }
    }
  }
  if(s.analysis==='LF'&&s.source==='GA'&&target==='ElmTerm'){
    data.sites.clear();for(const site of n.sites){const selected=representativeStationBus(ctx,site.id,result),bus=selected.bus;
      const value=s.metric==='voltageKv'?matchedVoltageKv(bus?.vmPu,bus?.vnKv,selected.nominal):angleHasReference(result,bus)?bus!.angleRad*180/Math.PI:null;
      data.sites.set(site.id,{value,unit:s.metric==='voltageKv'?'kV':'deg',status:bus?value===null?'ANGLE_REFERENCE_UNKNOWN':'GA_FULL_AC':'NOT_RECORDED',details:[],representativeFid:bus?.terms[0],nominalKv:selected.nominal} as BenchmarkMapValue);
    }
  }
  if(s.analysis==='LF'&&s.source==='PF'&&target==='ElmTerm'){
    data.sites.clear();const rows=mapReferenceRows(ctx,s),voltages=s.metric==='angleDeg'?mapReferenceRows(ctx,{...s,metric:'voltageKv'}):rows;for(const site of n.sites){const nominal=representativeStationBus(ctx,site.id,null).nominal,values=voltages.filter(r=>r.sourceClass==='ElmTerm'&&r.nominalKv===nominal&&n.buses.find(b=>b.id===r.fid&&b.vnKv===nominal)?.siteIds.includes(site.id)&&finiteNumber(r.pf.value)&&r.pf.availability!=='INVALID'&&!r.pf.qualityFlags.includes('SENTINEL_CANDIDATE'));
      const bus=values.sort((a,b)=>b.pf.value!-a.pf.value!)[0],row=s.metric==='angleDeg'?rows.find(r=>r.fid===bus?.fid&&r.nominalKv===nominal):bus;if(row)data.sites.set(site.id,{value:finiteNumber(row.pf.value)?row.pf.value:null,unit:row.pf.unit,status:'PF_REFERENCE',details:[],nominalKv:nominal} as BenchmarkMapValue);
    }
  }
  if(s.analysis==='N1'&&s.source==='GA'&&s.metric==='voltageKv'){
    data.sites.clear();const p=selectedN1Presentation(ctx),base=p.post?.source==='HYBRID_FULL_AC'?ctx.hybridResult?.basePost?.buses:result?.buses,post=p.post?.post.buses;
    for(const site of n.sites){const nominal=representativeStationBus(ctx,site.id,null).nominal,valid=(b:{terms:string[];vnKv:number;vmPu:number})=>b.vnKv===nominal&&b.terms.length>0&&b.terms.every(id=>n.buses.find(t=>t.id===id)?.vnKv===nominal)&&b.terms.some(id=>n.buses.find(t=>t.id===id)?.siteIds.includes(site.id))&&finiteNumber(b.vmPu);
      const candidates=(s.n1Layer==='BASE'?base:post)?.filter(valid).sort((a,b)=>b.vmPu-a.vmPu)??[],b=candidates[0],before=base?.find(a=>a.vnKv===b?.vnKv&&[...a.terms].sort().join('|')===[...b?.terms??[]].sort().join('|'));
      if(s.n1Layer==='NEW_CONSTRAINTS'&&!ctx.hybridResult?.cases.find(c=>c.outage.caseId===s.caseId)?.constraintChanges?.some(c=>['NEW','WORSENED'].includes(c.state)&&c.metric==='voltagePu'&&c.physicalTerminalFids?.some(fid=>b?.terms.includes(fid))))continue;
      const u=matchedVoltageKv(b?.vmPu,b?.vnKv,nominal),value=s.n1Layer==='CHANGE'?u!==null&&before?u-before.vmPu*before.vnKv:null:u;
      data.sites.set(site.id,{value,unit:'kV',status:p.status,details:[],representativeFid:b?.terms[0],nominalKv:nominal} as BenchmarkMapValue);
    }
  }
  data.numericValues=[...data.branches.values(),...data.sites.values()].filter(v=>finiteNumber(v.value)).length;
  if(data.enabled&&!data.numericValues)data.reason='NO_DATA';return data;
}
export function selectedN1Presentation(ctx:AppContext){
  const id=ctx.resultView.caseId??'',post=resolveN1Post({network:ctx.network,scenario:ctx.scenario.current,settings:ctx.analysisSettings.value,ac:ctx.n1AcResults,hybrid:ctx.hybridResult},id);
  const dc=ctx.n1Result,valid=dc?.identity.modelHash===ctx.network?.modelHash&&dc?.identity.scenarioHash===scenarioSignature(ctx.scenario.current);
  const candidate=valid?dc?.candidates.find(c=>{const e=[...ctx.network?.lines??[],...ctx.network?.transformers??[]].find(e=>e.id===c.equipmentId&&e.sourceClass===c.sourceClass);return id===`N1:${c.sourceClass}:${e?.sourceId??c.equipmentId}`;}):undefined;
  const recorded=ctx.n1AcResults.find(c=>c.outage.caseId===id&&c.identity.modelHash===ctx.network?.modelHash&&c.identity.baseScenarioHash===scenarioSignature(ctx.scenario.current));
  return {post,candidate,method:post?.source??(candidate?'GA_DC_SCREEN':'NOT_RUN'),status:post?.status??recorded?.status??candidate?.status??'NOT_RUN'};
}
/** Select an existing row without requesting the N-1 detail worker. */
export function syncMapCase(ctx:AppContext){
  if(ctx.resultView.analysis!=='N1')return;
  const p=selectedN1Presentation(ctx);ctx.selectedN1CandidateId=p.candidate?.candidateId??null;
  const table=ctx.benchmark?.groups.N1.tables.N1_Cases_Raw,row=table?.rows.map(row=>rowObject(table,row)).find(r=>r.caseId===ctx.resultView.caseId),[,cls,...fid]=(ctx.resultView.caseId??'').split(':'),outage=p.post?.outage??(row?{caseId:ctx.resultView.caseId!,sourceClass:String(row.outageClass),fid:String(row.outageFid)}:{caseId:ctx.resultView.caseId!,sourceClass:cls,fid:fid.join(':')});
  ctx.comparisonOutage=['ElmLne','ElmTr2'].includes(outage.sourceClass)&&outage.fid?{...outage,sourceClass:outage.sourceClass as 'ElmLne'|'ElmTr2'}:null;
}
export function selectedScPresentation(ctx:AppContext){
  const sc=ctx.scResult,current=!!sc&&sc.identity.modelHash===ctx.network?.modelHash&&sc.identity.scenarioHash===scenarioSignature(ctx.scenario.current);
  const exact=current?sc.faults.filter(f=>f.physicalTerminalFid===ctx.resultView.faultId):[],matches=exact.length?exact:current?sc.faults.filter(f=>f.physicalTerminalFids.includes(ctx.resultView.faultId??'')):[];
  const fault=matches.length===1?matches[0]:null;return {sc:current?sc:null,fault,status:fault?.status??(current&&!ctx.resultView.faultId?'NOT_RUN':'BLOCKED'),reason:fault?.reasons.slice(0,3).join('; ')??'Gerekli IEC kaynak/partition kanıtı yok'};
}
export function mapStatusText(ctx:AppContext):string{
  const v=ctx.resultView,base=ctx.scenario.selectedId==='B0'?'Baz':'Senaryo';
  if(v.analysis==='N1'){if(v.source==='PF')return `N-1 · PF kayıtlı extrema · ${ctx.scenario.selectedId} · ${v.phase} · GA−PF paritesi doğrulanmadı`;const p=selectedN1Presentation(ctx);return `N-1 · ${ctx.scenario.selectedId} · ${p.method} · ${p.status}${p.post?'':' · AC POST: NOT_RUN; DC yalnız P/tahmini yük'}`;}
  if(v.analysis==='SC'){if(v.source==='PF')return `SC · PF 3PH MAX referansı · ${ctx.scenario.selectedId} · GA paritesi doğrulanmadı`;const p=selectedScPresentation(ctx);return `SC · ${ctx.scenario.selectedId} · 3PH · ${p.status} · IEC eşdeğerliği doğrulanmadı`;}
  if(v.source!=='GA')return `LF · ${v.source==='GA−PF'?'GA−PF TANISAL / yöntem doğrulanmadı':v.source} · ${ctx.scenario.selectedId} · ${mapPresentationGate(ctx,ctx.benchmarkMap??{analysis:'LF',source:'PF',metric:v.metric,table:'GA_Reference_Raw'}).reason||'Kayıtlı referans'}`;
  const r=currentMapLf(ctx);if(!r)return `LF · ${base} ${ctx.scenario.selectedId} · NOT_RUN / STALE`;
  const c=solutionCompleteness(r),label=r.identity.analysisType==='dc'?'DC P-only':r.identity.analysisType==='fastAc'?'Hızlı yaklaşık AC':'Tam AC';
  const issue=c.reason==='ACTIVE_BALANCE_PARTIAL'?'P dengesi kısmi; tam çözüm değil':c.reason==='STATION_CONTROL_FALLBACK'?'istasyon kontrolü kısmi; tam çözüm değil':c.reason==='NEWTON_NOT_CONVERGED'?r.status:'';
  return `${label} · ${base} ${ctx.scenario.selectedId} · ${r.converged?'NR yakınsadı':r.status}${issue?' ('+issue+')':''} · ${(r.elapsedMs/1000).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2})} sn`;
}

export function mapMetricTarget(metric:string):'site'|'branch'{
  return /voltage|angle|ikss|skss|ipKa|ibKa|ithKa/i.test(metric)?'site':'branch';
}
/** Missing or inapplicable numbers never erase the nominal electrical geography. */
export function resultLayerColor(nominal:string,target:'site'|'branch',selection:BenchmarkMapSelection,value:BenchmarkMapValue|undefined,enabled:boolean,scale?:number):string{
  if(!enabled||mapMetricTarget(selection.metric)!==target||value?.value==null||!Number.isFinite(value.value))return nominal;
  if(selection.analysis==='LF'&&selection.source==='GA'&&/^[pq](From|To|Hv|Lv)M(w|var)$/.test(selection.metric))return nominal;
  const kv=(value as BenchmarkMapValue&{nominalKv?:number}).nominalKv;
  if(value.unit==='kV'&&finiteNumber(kv)&&kv>0&&!['DELTA','EXPLORATORY_DELTA','SCENARIO_DELTA'].includes(selection.source))return benchmarkLayerColor({...value,value:value.value/kv,unit:'pu'});
  return benchmarkLayerColor(value,selection.n1Layer==='CHANGE'||['DELTA','EXPLORATORY_DELTA','SCENARIO_DELTA'].includes(selection.source),scale);
}
export function mapFlowMetric(selection:BenchmarkMapSelection|null,mode:Settings['displayMode'],result:CalculationResult|null,current:boolean):'p'|'q'|null{
  if(!current||!result?.converged||result.identity.analysisType!=='powerFlow')return null;
  if(selection){if(selection.analysis!=='LF'||selection.source!=='GA')return null;return /^(qFromMvar|qToMvar)$/.test(selection.metric)?'q':/^(pFromMw|pToMw|sFromMva|sToMva|loadingPercent|iFromA|iToA)$/.test(selection.metric)?'p':null;}
  return mode==='q'?'q':['nominal','p','loading'].includes(mode)?'p':null;
}
