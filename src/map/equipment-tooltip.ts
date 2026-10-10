import type {AppContext} from '../app/contracts';
import type {Site,Line,Transformer2W} from '../domain/model/network';
import type {BusResult,BranchResult,CalculationResult} from '../domain/results/types';
import {element} from '../ui/components/dom';
import {formatEngineering} from '../ui/components/engineering-format';
import {voltageMatches} from '../domain/model/voltage-band';
import {mapLoadingValues} from './loading-presentation';
import {mapTopologyPresentation} from './topology-presentation';
import {currentMapLf,representativeStationBus,representativeReferenceBySite,angleHasReference,matchedVoltageKv,transformerFromIsHv,finiteNumber,mapPresentationGate,mapReferenceRows,selectedN1Presentation,selectedScPresentation,buildMapPresentationData} from './layer-policy';
import {workspaceMapSelection} from '../domain/results/workspace';
import {solutionCompleteness} from '../domain/results/diagnostics';
import {modelPresentationIndex,resultPresentationIndex,solutionPresentationIndex,partitionKey} from './presentation-index';
import {postBranchMetric} from '../analysis/contingency-ac/post-results';
export type TooltipEquipment=Site|Line|Transformer2W;
export interface EquipmentCard {title:string;context:string;status:string;headers:string[];rows:string[][];note:string}
export const engineeringNumber=(v:unknown,signed=false,precision=1)=>formatEngineering(v,precision,{signed});
/** Canonical endpoint convention: positive means injection from that terminal into the branch. */
export function verifiedPowerDirection(from:unknown,to:unknown):'FROM_TO'|'TO_FROM'|'UNKNOWN'{return finiteNumber(from)&&finiteNumber(to)?from>0&&to<0?'FROM_TO':from<0&&to>0?'TO_FROM':'UNKNOWN':'UNKNOWN';}
export function endpointStationLabel(ctx:AppContext,id:string,side:'A'|'B'){
  const index=ctx.network?modelPresentationIndex(ctx.network):null,bus=index?.physicalTerminalById.get(id),ids=[...new Set(bus?.siteIds??[])],sites=ids.map(id=>index?.siteById.get(id)).filter(s=>!!s);
  return ids.length===1&&sites.length===1?{label:sites[0]!.name,status:'VERIFIED',fid:id}:{label:`Uç ${side} • ${id}`,status:'TM_BELIRSIZ',fid:id};
}
const validCell=(r:ReturnType<typeof mapReferenceRows>[number]|undefined)=>r&&r.pf.availability!=='INVALID'&&!r.pf.qualityFlags.includes('SENTINEL_CANDIDATE');
const referenceCache=new WeakMap<AppContext,{key:string;benchmark:unknown;result:unknown;rows:Map<string,ReturnType<typeof mapReferenceRows>>}>();
function referenceRows(ctx:AppContext,metric:string){
  const selection=ctx.benchmarkMap??workspaceMapSelection(ctx),r=currentMapLf(ctx),key=JSON.stringify([selection,ctx.scenario.revision,ctx.analysisSettings.value]);let c=referenceCache.get(ctx);
  if(!c||c.key!==key||c.benchmark!==ctx.benchmark||c.result!==r){c={key,benchmark:ctx.benchmark,result:r,rows:new Map()};referenceCache.set(ctx,c);}
  if(!c.rows.has(metric))c.rows.set(metric,mapReferenceRows(ctx,{...selection,metric}));return c.rows.get(metric)!;
}
function endpointBus(ctx:AppContext,r:CalculationResult|null,id:string):BusResult|null{
  return ctx.network&&r?resultPresentationIndex(ctx.network,r).solution.byTerminal.get(id)??null:null;
}
export function equipmentCard(ctx:AppContext,e:TooltipEquipment):EquipmentCard{
  const number=(v:unknown,signed=false)=>engineeringNumber(v,signed,ctx.settings.value.precision);
  const v=ctx.resultView,selection=ctx.benchmarkMap??workspaceMapSelection(ctx),source=selection.source==='EXPLORATORY_DELTA'?'GA−PF TANISAL':selection.source==='SCENARIO_DELTA'?'GA SENARYO−BAZ':selection.source==='DELTA'?'GA−PF DOĞRULANMIŞ':v.source;
  const card:EquipmentCard={title:e.name,context:`${source} • ${ctx.scenario.selectedId} • ${v.analysis}`,status:'NOT_RECORDED',headers:[],rows:[],note:'Tam ayrıntı: seçin / ⚡ / Analizler / XLSX.'};
  if(!ctx.network)return card;
  if(selection.analysis==='LF'&&selection.source==='GA'&&selection.metric==='island'){
    const topology=mapTopologyPresentation(ctx),stations=e.sourceClass==='ElmSite'?topology?.bySite.get(e.id)?.filter(s=>voltageMatches(s.voltageKv,ctx.filters.voltages))??[]:[],on=e.sourceClass==='ElmLne'?ctx.scenario.current.lineStatus[e.id]??e.inService:e.sourceClass==='ElmTr2'?ctx.scenario.current.transformerStatus[e.id]??e.inService:true;
    card.context='GA • '+ctx.scenario.selectedId+' • Yapısal topoloji';card.status=on?'Serviste':'Servis dışı';card.headers=['Kuplaj','Bağlı bileşen','Güven'];card.rows=stations.slice(0,2).map(s=>['Açık · '+number(s.voltageKv)+' kV',s.sameConnectedComponent?'Başka yoldan aynı ada':'Ayrı elektrik adaları',s.confidence]);card.note=stations.length?stations.some(s=>s.sameConnectedComponent)?'SAME_COMPONENT_VIA_ALTERNATE_PATH · Açık kuplaj, beslemesiz ada değildir.':'SEPARATE_COMPONENTS · Referans/kaynak durumunu ayrıntıda inceleyin.':'Açık 154 kV kuplaj işareti yok; ada rengi bağlı bileşeni gösterir.';return card;
  }
  if(v.analysis!=='LF'&&selection.source!=='GA'){
    const gate=mapPresentationGate(ctx,selection);card.status=gate.enabled?'PF_REFERENCE_ONLY':'BLOCKED';if(!gate.enabled){card.note=gate.reason;return card;}
    const cls=e.sourceClass==='ElmSite'?'ElmTerm':e.sourceClass,ids=e.sourceClass==='ElmSite'?modelPresentationIndex(ctx.network).busIdsBySite.get(e.id)??[]:[e.sourceId];
    const value=(metric:string)=>{const rows=referenceRows(ctx,metric).filter(r=>r.sourceClass===cls&&ids.includes(r.fid)&&(!ctx.resultView.faultId||v.analysis!=='SC'||r.fid===v.faultId));return rows.length===1&&validCell(rows[0])?selection.source==='PF'?rows[0].pf.value:selection.source==='EXPLORATORY_DELTA'&&rows[0].identityMatched?rows[0].diagnosticDelta??null:null:null;};
    card.context+=v.analysis==='SC'?' · PF 3PH MAX':' · PF kayıtlı extrema · '+v.phase;card.headers=v.analysis==='SC'?['Ikss (kA)','Skss (MVA)']:['Kayıtlı POST P (MW)','Q (MVAr)'];card.rows=v.analysis==='SC'?[[number(value('ikssKa')),number(value('skssMva'))]]:[[number(value('postPmw'),true),number(value('postQmvar'),true)]];
    card.note='Yalnız eşleşen kaynak hücreleri; yöntem/POST paritesi ve GA−PF yüzdesi doğrulanmadı.';return card;
  }
  if(v.analysis==='N1'){
    const p=selectedN1Presentation(ctx);card.context+=` · ${p.method} · ${v.phase}`;card.status=p.status;
    if(!p.post&&['ISLANDING','UNSUPPORTED_STATION_CONTROL','UNSUPPORTED_CONTROL_CONFIGURATION','NOT_RUN'].includes(p.status)){card.note=p.status+' · Bu kesinti için AC POST kaydı yok; Analizler > N-1.';return card;}
    if(e.sourceClass!=='ElmSite'){
      const b=p.post?.post.branches.find(b=>b.sourceClass===e.sourceClass&&b.fid===e.sourceId),d=p.candidate?.topImpacts.find(b=>b.equipmentId===e.id&&b.sourceClass===e.sourceClass);
      card.headers=b?['TM / Uç','P (MW)','Q (MVAr)','Yük (%)','U (kV)','Açı (°)']:['Faz','P (MW)','Tahmini yük (%)'];
      if(b){const trafo=e.sourceClass==='ElmTr2',t=e as Transformer2W,hv=trafo?transformerFromIsHv(ctx.network,t.from,t.to,Math.max(t.vnKv,t.lvKv),Math.min(t.vnKv,t.lvKv)):true;
        const cell=(metric:string,side:string)=>buildMapPresentationData(ctx,{...selection,metric,side}).branches.get(e.sourceClass+':'+e.id)?.value;
        const post=solutionPresentationIndex(ctx.network,p.post!.post.buses,JSON.stringify([ctx.hybridResult?.identity,ctx.n1AcResults.map(c=>c.identity)])),lf=currentMapLf(ctx),base=p.post?.source==='HYBRID_FULL_AC'&&ctx.hybridResult?.basePost?solutionPresentationIndex(ctx.network,ctx.hybridResult.basePost.buses,JSON.stringify(ctx.hybridResult.identity)):lf?resultPresentationIndex(ctx.network,lf).solution:null;
        const endpoint=(from:boolean)=>{const id=from?t.from:t.to,after=post.byTerminal.get(id),before=base?.byTerminal.get(id),term=modelPresentationIndex(ctx.network!).physicalTerminalById.get(id),pu=v.phase==='PRE'?before?.vmPu:after?.vmPu,nominal=v.phase==='PRE'?before?.vnKv:after?.vnKv,u=matchedVoltageKv(pu,nominal,term?.vnKv),voltage=v.phase==='CHANGE'?u!==null&&before&&after&&partitionKey(before)===partitionKey(after)?u-before.vmPu*before.vnKv:null:u;
          const rating=b.loading.basis==='CURRENT_A'?(from?b.loading.fromLimitA:b.loading.toLimitA):b.loading.ratingMva,numerator=b.loading.basis==='CURRENT_A'?(from?b.ifA:b.itA):postBranchMetric(b,'postMva',from?'FROM':'TO'),load=v.phase==='POST'&&finiteNumber(rating)&&rating>0&&finiteNumber(numerator)&&numerator>=0?100*numerator/rating:null,label=endpointStationLabel(ctx,id,from?'A':'B').label;
          return [(trafo?(hv===null?'YG/AG ?':from===hv?'YG':'AG'):'')+' '+label,number(trafo&&hv===null?null:cell('postPmw',from?'FROM':'TO'),true),number(trafo&&hv===null?null:cell('postQmvar',from?'FROM':'TO'),true),number(load),number(mapPresentationGate(ctx,{...selection,metric:'voltageKv'}).enabled?voltage:null),'—'];};
        card.rows=hv===false?[endpoint(false),endpoint(true)]:[endpoint(true),endpoint(false)];}
      else card.rows=[['PRE',number(d?.baseFlowMw,true),number(d?.baseEstimatedLoadingPct)],['POST',number(d?.postFlowMw,true),number(d?.postEstimatedLoadingPct)]];
    }
    else if(p.post){const value=buildMapPresentationData(ctx,{...selection,metric:'voltageKv'}).sites.get(e.id);card.headers=['Nominal (kV)','U (kV)','Açı (°)'];card.rows=[[number(representativeStationBus(ctx,e.id,null).nominal),number(value?.value),'—']];}
    card.note=p.post?'Mevcut Full AC post-vaka kaydı; aynı kesinti ve senaryo.':'DC P-only · Q/U ve AC ihlal: NOT_RUN';return card;
  }
  if(v.analysis==='SC'){
    const p=selectedScPresentation(ctx),f=p.fault,relevant=e.sourceClass==='ElmSite'&&(f?.physicalTerminalFids.length?f.physicalTerminalFids:[f?.physicalTerminalFid]).some(id=>id&&modelPresentationIndex(ctx.network!).physicalTerminalById.get(id)?.siteIds.includes(e.id));
    card.context+=` · 3PH ${p.sc?.profile.calculateMode??'—'}`;card.status=relevant?p.status:'NOT_RECORDED';
    card.headers=['Ikss (kA)','Skss (MVA)','Nominal (kV)'];card.rows=[[number(relevant?f?.ikssKa:null),number(relevant?f?.skssMva:null),number(relevant?f?.nominalKv:null)]];
    card.note=relevant&&p.status.includes('APPROXIMATION')?'NETWORK_APPROXIMATION · IEC eşdeğeri değil · Ip/Ib/Ith: desteklenmiyor.':p.reason+' · Analizler > Kısa Devre';return card;
  }
  const gate=mapPresentationGate(ctx,selection);if(!gate.enabled){card.status='BLOCKED';card.note=gate.reason+' · Analizler / referans ayrıntısı.';return card;}
  const r=currentMapLf(ctx),isGa=selection.source==='GA',isDelta=['DELTA','EXPLORATORY_DELTA'].includes(selection.source),scenarioDelta=selection.source==='SCENARIO_DELTA';
  if(isGa){const completeness=solutionCompleteness(r);card.status=r?completeness.fullSolution?'FULL_AC':'FULL_AC_PARTIAL':'NOT_RUN';card.context+=' · GA Tam AC';}
  else card.status=scenarioDelta?'GA_SCENARIO_MINUS_GA_REFERENCE':isDelta?'TANISAL / yöntem doğrulanmadı':'PF_REFERENCE';
  const pf=(metric:string,cls:string,fid:string,nominal?:number|null)=>{
    const rows=referenceRows(ctx,metric).filter(row=>row.sourceClass===cls&&row.fid===fid&&(nominal===undefined||row.nominalKv===nominal));
    if(rows.length!==1||!validCell(rows[0]))return null;const row=rows[0];
    return selection.source==='EXPLORATORY_DELTA'?row.identityMatched?row.diagnosticDelta??null:null:selection.source==='DELTA'?row.delta:row.pf.value;
  };
  if(isDelta){
    const cls=e.sourceClass==='ElmSite'?'ElmTerm':e.sourceClass,fid=e.sourceClass==='ElmSite'?modelPresentationIndex(ctx.network).busIdsBySite.get(e.id)?.[0]:e.sourceId;
    const rows=referenceRows(ctx,selection.metric).filter(row=>row.sourceClass===cls&&row.fid===fid);
    card.headers=['PF','GA','Δ','Birim'];const row=rows.length===1?rows[0]:null,delta=row?pf(selection.metric,cls,fid??''):null;
    card.rows=[[number(row?.pf.value),number(row?.ga),number(delta,true),row?.pf.unit??'—']];card.note='GA−PF TANISAL · yöntem paritesi doğrulanmadı; eşleşmeyen hücre null.';return card;
  }
  if(e.sourceClass==='ElmSite'){
    const selected=representativeStationBus(ctx,e.id,r),nominal=selected.nominal;let bus=selected.bus,u=matchedVoltageKv(bus?.vmPu,bus?.vnKv,nominal),a=angleHasReference(r,bus)?bus!.angleRad*180/Math.PI:null,name=bus?.name??'—';
    if(!isGa&&!scenarioDelta){const selected=representativeReferenceBySite(ctx,selection).get(e.id);u=selected?.pf.value??null;a=selected?pf('angleDeg','ElmTerm',selected.fid,nominal):null;name=selected?modelPresentationIndex(ctx.network).physicalTerminalById.get(selected.fid)?.name??'—':'—';}
    if(scenarioDelta){const old=ctx.resultStore.getSnapshot(ctx.resultStore.comparisonScenarioId,'powerFlow'),before=old&&bus?resultPresentationIndex(ctx.network,old).solution.byPartition.get(partitionKey(bus)):null;u=before&&u!==null?u-before.vmPu*before.vnKv:null;a=before&&a!==null&&before.islandId===bus?.islandId?a-before.angleRad*180/Math.PI:null;}
    card.title+=` · ${number(nominal)} kV`;card.headers=['Nominal (kV)','U (kV)','Açı (°)'];card.rows=[[number(nominal),number(u),number(a,true)]];
    card.note=`YG bara: ${name} · aynı baranın U/açı kaydı${selected.count>1?' · +'+(selected.count-1)+' diğer bara':''}. Ayrıntı: ekipmanı seçin.`;return card;
  }
  const entity=e as Line|Transformer2W,row=r?resultPresentationIndex(ctx.network,r).branchByKey.get(e.sourceClass+':'+e.id):null,baseline=scenarioDelta?ctx.resultStore.getSnapshot(ctx.resultStore.comparisonScenarioId,'powerFlow'):null,old=baseline?resultPresentationIndex(ctx.network,baseline).branchByKey.get(e.sourceClass+':'+e.id):null;
  const ga=(key:keyof BranchResult)=>{const value=row?.[key],before=old?.[key];return finiteNumber(value)?scenarioDelta?finiteNumber(before)?value-before:null:value:null;};
  const trafo=e.sourceClass==='ElmTr2',fromHv=trafo?transformerFromIsHv(ctx.network,entity.from,entity.to,Math.max(entity.vnKv,(e as Transformer2W).lvKv),Math.min(entity.vnKv,(e as Transformer2W).lvKv)):true;
  const aLabel=endpointStationLabel(ctx,entity.from,'A'),bLabel=endpointStationLabel(ctx,entity.to,'B'),loading=isGa&&r?mapLoadingValues(ctx.network,r).get(e.sourceClass+':'+e.id):null;
  const endpoint=(from:boolean)=>{const b=endpointBus(ctx,r,from?entity.from:entity.to),nominal=modelPresentationIndex(ctx.network!).physicalTerminalById.get(from?entity.from:entity.to)?.vnKv;
    const p=isGa||scenarioDelta?ga(from?'pf':'pt'):pf(trafo?(from===fromHv?'pHvMw':'pLvMw'):from?'pFromMw':'pToMw',e.sourceClass,e.sourceId);
    const q=isGa||scenarioDelta?ga(from?'qf':'qt'):pf(trafo?(from===fromHv?'qHvMvar':'qLvMvar'):from?'qFromMvar':'qToMvar',e.sourceClass,e.sourceId);
    const u=isGa?matchedVoltageKv(b?.vmPu,b?.vnKv,nominal):scenarioDelta?null:pf('voltageKv','ElmTerm',from?entity.from:entity.to,nominal);
    const a=isGa&&angleHasReference(r,b)?b!.angleRad*180/Math.PI:!isGa&&!scenarioDelta?pf('angleDeg','ElmTerm',from?entity.from:entity.to,nominal):null;
    const label=(from?aLabel:bLabel).label,load=isGa?(from?loading?.from:loading?.to):null;
    return [(trafo?(fromHv===null?'YG/AG ?':from===fromHv?'YG':'AG')+' · ':'')+(from?'A':'B')+' · '+label,number(trafo&&fromHv===null?null:p,true),number(trafo&&fromHv===null?null:q,true),number(load),number(u),number(a,true)];};
  card.headers=['TM / Uç','P (MW)','Q (MVAr)','Yük (%)','U (kV)','Açı (°)'];card.rows=trafo&&fromHv===false?[endpoint(false),endpoint(true)]:[endpoint(true),endpoint(false)];
  const pLoss=isGa||scenarioDelta?ga('pLoss'):pf('pLossMw',e.sourceClass,e.sourceId),qLoss=isGa||scenarioDelta?ga('qLoss'):pf('qLossMvar',e.sourceClass,e.sourceId);
  const on=trafo?ctx.scenario.current.transformerStatus[e.id]??e.inService:ctx.scenario.current.lineStatus[e.id]??e.inService;
  card.title+=trafo?` · ${number(Math.max(entity.vnKv,(e as Transformer2W).lvKv))}/${number(Math.min(entity.vnKv,(e as Transformer2W).lvKv))} kV`:` · ${number(entity.vnKv)} kV`;
  const direction=isGa?verifiedPowerDirection(row?.pf,row?.pt):'UNKNOWN',flow=direction==='FROM_TO'?'A → B':direction==='TO_FROM'?'B → A':'Yön belirsiz',capacity=loading?.maximum!=null?`${loading.basis} • ${loading.season}`:isGa?'UNKNOWN_CAPACITY':'Yük: NOT_RECORDED',maximum=isGa?loading?.maximum:scenarioDelta?null:pf('loadingPercent',e.sourceClass,e.sourceId);
  if(!trafo){card.rows[0][0]='A · '+card.rows[0][0];card.rows[1][0]='B · '+card.rows[1][0];}
  card.note=`P: ${flow} · Kayıp P/Q (MW/MVAr): ${number(pLoss)}/${number(qLoss)} · ${on?'Serviste':'Servis dışı'}${trafo?' · Tap '+number((e as Transformer2W).tapPosition):''} · ${capacity}${loading?.from==null&&loading?.to==null&&maximum!=null?' · Maks yük '+number(maximum)+'%':''}${aLabel.status==='TM_BELIRSIZ'||bLabel.status==='TM_BELIRSIZ'?' · TM_BELIRSIZ':''}${trafo&&fromHv===null?' · HV/LV: BLOCKED':''}`;
  return card;
}
export function renderEquipmentCard(host:HTMLElement,card:EquipmentCard){
  const head=element('header'),title=element('strong','',card.title),context=element('small','',card.context),state=element('p','ga-equipment-status',card.status),table=element('table','ga-equipment-table');head.append(title,context);host.replaceChildren(head,state);
  if(card.headers.length){const tr=element('tr');for(const h of card.headers)tr.append(element('th','',h));table.append(tr);for(const row of card.rows){const tr=element('tr');for(const value of row)tr.append(element('td','',value));table.append(tr);}host.append(table);}
  host.append(element('p','ga-equipment-note',card.note));host.dataset.status=card.status;
}
export function tooltipPosition(x:number,y:number,width:number,height:number,viewportWidth:number,viewportHeight:number){return {left:Math.max(8,Math.min(x+14,viewportWidth-width-8)),top:Math.max(8,Math.min(y+14,viewportHeight-height-8))};}
