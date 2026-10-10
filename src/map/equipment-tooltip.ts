import type {AppContext} from '../app/contracts';
import type {Site,Line,Transformer2W} from '../domain/model/network';
import type {BusResult,BranchResult,CalculationResult} from '../domain/results/types';
import {element} from '../ui/components/dom';
import {currentMapLf,representativeStationBus,angleHasReference,matchedVoltageKv,transformerFromIsHv,finiteNumber,mapPresentationGate,mapReferenceRows,selectedN1Presentation,selectedScPresentation,buildMapPresentationData} from './layer-policy';
import {workspaceMapSelection} from '../domain/results/workspace';
import {solutionCompleteness} from '../domain/results/diagnostics';
export type TooltipEquipment=Site|Line|Transformer2W;
export interface EquipmentCard {title:string;context:string;status:string;headers:string[];rows:string[][];note:string}
export const engineeringNumber=(v:unknown,signed=false)=>finiteNumber(v)?(signed&&v>0?'+':'')+v.toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2}):'—';
const validCell=(r:ReturnType<typeof mapReferenceRows>[number]|undefined)=>r&&r.pf.availability!=='INVALID'&&!r.pf.qualityFlags.includes('SENTINEL_CANDIDATE');
const referenceCache=new WeakMap<AppContext,{key:string;benchmark:unknown;result:unknown;rows:Map<string,ReturnType<typeof mapReferenceRows>>}>();
function referenceRows(ctx:AppContext,metric:string){
  const selection=ctx.benchmarkMap??workspaceMapSelection(ctx),r=currentMapLf(ctx),key=JSON.stringify([selection,ctx.scenario.revision,ctx.analysisSettings.value]);let c=referenceCache.get(ctx);
  if(!c||c.key!==key||c.benchmark!==ctx.benchmark||c.result!==r){c={key,benchmark:ctx.benchmark,result:r,rows:new Map()};referenceCache.set(ctx,c);}
  if(!c.rows.has(metric))c.rows.set(metric,mapReferenceRows(ctx,{...selection,metric}));return c.rows.get(metric)!;
}
function endpointBus(ctx:AppContext,r:CalculationResult|null,id:string):BusResult|null{
  const nominal=ctx.network?.buses.find(b=>b.id===id)?.vnKv,rows=r?.buses.filter(b=>b.terms.includes(id)&&b.vnKv===nominal&&b.terms.every(t=>ctx.network?.buses.find(b=>b.id===t)?.vnKv===nominal))??[];
  return rows.length===1?rows[0]:null;
}
export function equipmentCard(ctx:AppContext,e:TooltipEquipment):EquipmentCard{
  const v=ctx.resultView,selection=ctx.benchmarkMap??workspaceMapSelection(ctx),source=selection.source==='EXPLORATORY_DELTA'?'GA−PF TANISAL':selection.source==='SCENARIO_DELTA'?'GA SENARYO−BAZ':selection.source==='DELTA'?'GA−PF DOĞRULANMIŞ':v.source;
  const card:EquipmentCard={title:e.name,context:`${source} · ${ctx.scenario.selectedId} · ${v.analysis}`,status:'NOT_RECORDED',headers:[],rows:[],note:'Ayrıntı / provenance: ekipmanı seçin; Analizler veya dışa aktarım.'};
  if(!ctx.network)return card;
  if(v.analysis!=='LF'&&selection.source!=='GA'){
    const gate=mapPresentationGate(ctx,selection);card.status=gate.enabled?'PF_REFERENCE_ONLY':'BLOCKED';if(!gate.enabled){card.note=gate.reason;return card;}
    const cls=e.sourceClass==='ElmSite'?'ElmTerm':e.sourceClass,ids=e.sourceClass==='ElmSite'?ctx.network.buses.filter(b=>b.siteIds.includes(e.id)).map(b=>b.id):[e.sourceId];
    const value=(metric:string)=>{const rows=referenceRows(ctx,metric).filter(r=>r.sourceClass===cls&&ids.includes(r.fid)&&(!ctx.resultView.faultId||v.analysis!=='SC'||r.fid===v.faultId));return rows.length===1&&validCell(rows[0])?selection.source==='PF'?rows[0].pf.value:selection.source==='EXPLORATORY_DELTA'&&rows[0].identityMatched?rows[0].diagnosticDelta??null:null:null;};
    card.context+=v.analysis==='SC'?' · PF 3PH MAX':' · PF kayıtlı extrema · '+v.phase;card.headers=v.analysis==='SC'?['Ikss (kA)','Skss (MVA)']:['Kayıtlı POST P (MW)','Q (MVAr)'];card.rows=v.analysis==='SC'?[[engineeringNumber(value('ikssKa')),engineeringNumber(value('skssMva'))]]:[[engineeringNumber(value('postPmw'),true),engineeringNumber(value('postQmvar'),true)]];
    card.note='Yalnız eşleşen kaynak hücreleri; yöntem/POST paritesi ve GA−PF yüzdesi doğrulanmadı.';return card;
  }
  if(v.analysis==='N1'){
    const p=selectedN1Presentation(ctx);card.context+=` · ${p.method} · ${v.phase}`;card.status=p.status;
    if(!p.post&&['ISLANDING','UNSUPPORTED_STATION_CONTROL','UNSUPPORTED_CONTROL_CONFIGURATION','NOT_RUN'].includes(p.status)){card.note=p.status+' · Bu kesinti için AC POST kaydı yok; Analizler > N-1.';return card;}
    if(e.sourceClass!=='ElmSite'){
      const b=p.post?.post.branches.find(b=>b.sourceClass===e.sourceClass&&b.fid===e.sourceId),d=p.candidate?.topImpacts.find(b=>b.equipmentId===e.id&&b.sourceClass===e.sourceClass);
      card.headers=b?['Uç','P (MW)','Q (MVAr)']:['Faz','P (MW)','Tahmini yük (%)'];
      if(b){const trafo=e.sourceClass==='ElmTr2',t=e as Transformer2W,hv=trafo?transformerFromIsHv(ctx.network,t.from,t.to,Math.max(t.vnKv,t.lvKv),Math.min(t.vnKv,t.lvKv)):true;
        const cell=(metric:string,side:string)=>buildMapPresentationData(ctx,{...selection,metric,side}).branches.get(e.sourceClass+':'+e.id)?.value;
        const rows=[['Baş',engineeringNumber(trafo&&hv===null?null:cell('postPmw','FROM'),true),engineeringNumber(trafo&&hv===null?null:cell('postQmvar','FROM'),true)],['Son',engineeringNumber(trafo&&hv===null?null:cell('postPmw','TO'),true),engineeringNumber(trafo&&hv===null?null:cell('postQmvar','TO'),true)]];card.rows=hv===false?rows.reverse():rows;if(trafo){card.rows[0][0]=hv===null?'YG ?':'YG';card.rows[1][0]=hv===null?'AG ?':'AG';}}
      else card.rows=[['PRE',engineeringNumber(d?.baseFlowMw,true),engineeringNumber(d?.baseEstimatedLoadingPct)],['POST',engineeringNumber(d?.postFlowMw,true),engineeringNumber(d?.postEstimatedLoadingPct)]];
    }
    else if(p.post){const value=buildMapPresentationData(ctx,{...selection,metric:'voltageKv'}).sites.get(e.id);card.headers=['Nominal (kV)','U (kV)','Açı (°)'];card.rows=[[engineeringNumber(representativeStationBus(ctx,e.id,null).nominal),engineeringNumber(value?.value),'—']];}
    card.note=p.post?'Mevcut Full AC post-vaka kaydı; aynı kesinti ve senaryo.':'DC P-only · Q/U ve AC ihlal: NOT_RUN';return card;
  }
  if(v.analysis==='SC'){
    const p=selectedScPresentation(ctx),f=p.fault,relevant=e.sourceClass==='ElmSite'&&(f?.physicalTerminalFids.length?f.physicalTerminalFids:[f?.physicalTerminalFid]).some(id=>ctx.network?.buses.find(b=>b.id===id)?.siteIds.includes(e.id));
    card.context+=` · 3PH ${p.sc?.profile.calculateMode??'—'}`;card.status=relevant?p.status:'NOT_RECORDED';
    card.headers=['Ikss (kA)','Skss (MVA)','Nominal (kV)'];card.rows=[[engineeringNumber(relevant?f?.ikssKa:null),engineeringNumber(relevant?f?.skssMva:null),engineeringNumber(relevant?f?.nominalKv:null)]];
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
    const cls=e.sourceClass==='ElmSite'?'ElmTerm':e.sourceClass,fid=e.sourceClass==='ElmSite'?ctx.network.buses.find(b=>b.siteIds.includes(e.id))?.id:e.sourceId;
    const rows=referenceRows(ctx,selection.metric).filter(row=>row.sourceClass===cls&&row.fid===fid);
    card.headers=['PF','GA','Δ','Birim'];const row=rows.length===1?rows[0]:null,delta=row?pf(selection.metric,cls,fid??''):null;
    card.rows=[[engineeringNumber(row?.pf.value),engineeringNumber(row?.ga),engineeringNumber(delta,true),row?.pf.unit??'—']];card.note='GA−PF TANISAL · yöntem paritesi doğrulanmadı; eşleşmeyen hücre null.';return card;
  }
  if(e.sourceClass==='ElmSite'){
    const selected=representativeStationBus(ctx,e.id,r),nominal=selected.nominal;let bus=selected.bus,u=matchedVoltageKv(bus?.vmPu,bus?.vnKv,nominal),a=angleHasReference(r,bus)?bus!.angleRad*180/Math.PI:null,name=bus?.name??'—';
    if(!isGa&&!scenarioDelta){const candidates=ctx.network.buses.filter(b=>b.siteIds.includes(e.id)&&b.vnKv===nominal).map(b=>({b,u:pf('voltageKv','ElmTerm',b.id,nominal)})).filter(x=>finiteNumber(x.u)).sort((a,b)=>b.u!-a.u!);const selected=candidates[0];u=selected?.u??null;a=selected?pf('angleDeg','ElmTerm',selected.b.id,nominal):null;name=selected?.b.name??'—';}
    if(scenarioDelta){const before=ctx.resultStore.getSnapshot(ctx.resultStore.comparisonScenarioId,'powerFlow')?.buses.find(b=>b.vnKv===bus?.vnKv&&[...b.terms].sort().join('|')===[...bus?.terms??[]].sort().join('|'));u=before&&u!==null?u-before.vmPu*before.vnKv:null;a=before&&a!==null&&before.islandId===bus?.islandId?a-before.angleRad*180/Math.PI:null;}
    card.title+=` · ${engineeringNumber(nominal)} kV`;card.headers=['Nominal (kV)','U (kV)','Açı (°)'];card.rows=[[engineeringNumber(nominal),engineeringNumber(u),engineeringNumber(a,true)]];
    card.note=`YG bara: ${name} · aynı baranın U/açı kaydı${selected.count>1?' · +'+(selected.count-1)+' diğer bara':''}. Ayrıntı: ekipmanı seçin.`;return card;
  }
  const entity=e as Line|Transformer2W,row=r?.branches.find(b=>b.id===e.id&&b.sourceClass===e.sourceClass),old=scenarioDelta?ctx.resultStore.getSnapshot(ctx.resultStore.comparisonScenarioId,'powerFlow')?.branches.find(b=>b.id===e.id&&b.sourceClass===e.sourceClass):null;
  const ga=(key:keyof BranchResult)=>{const value=row?.[key],before=old?.[key];return finiteNumber(value)?scenarioDelta?finiteNumber(before)?value-before:null:value:null;};
  const trafo=e.sourceClass==='ElmTr2',fromHv=trafo?transformerFromIsHv(ctx.network,entity.from,entity.to,Math.max(entity.vnKv,(e as Transformer2W).lvKv),Math.min(entity.vnKv,(e as Transformer2W).lvKv)):true;
  const endpoint=(from:boolean)=>{const b=endpointBus(ctx,r,from?entity.from:entity.to),nominal=ctx.network!.buses.find(b=>b.id===(from?entity.from:entity.to))?.vnKv;
    const p=isGa||scenarioDelta?ga(from?'pf':'pt'):pf(trafo?(from===fromHv?'pHvMw':'pLvMw'):from?'pFromMw':'pToMw',e.sourceClass,e.sourceId);
    const q=isGa||scenarioDelta?ga(from?'qf':'qt'):pf(trafo?(from===fromHv?'qHvMvar':'qLvMvar'):from?'qFromMvar':'qToMvar',e.sourceClass,e.sourceId);
    const u=isGa?matchedVoltageKv(b?.vmPu,b?.vnKv,nominal):scenarioDelta?null:pf('voltageKv','ElmTerm',from?entity.from:entity.to,nominal);
    const a=isGa&&angleHasReference(r,b)?b!.angleRad*180/Math.PI:!isGa&&!scenarioDelta?pf('angleDeg','ElmTerm',from?entity.from:entity.to,nominal):null;
    return [from?(trafo?'YG':'Baş'):(trafo?'AG':'Son'),engineeringNumber(trafo&&fromHv===null?null:p,true),engineeringNumber(trafo&&fromHv===null?null:q,true),engineeringNumber(u),engineeringNumber(a,true)];};
  card.headers=['Uç','P (MW)','Q (MVAr)','U (kV)','Açı (°)'];card.rows=trafo&&fromHv===false?[endpoint(false),endpoint(true)]:[endpoint(true),endpoint(false)];if(trafo){card.rows[0][0]='YG';card.rows[1][0]='AG';}
  const pLoss=isGa||scenarioDelta?ga('pLoss'):pf('pLossMw',e.sourceClass,e.sourceId),qLoss=isGa||scenarioDelta?ga('qLoss'):pf('qLossMvar',e.sourceClass,e.sourceId);
  const on=trafo?ctx.scenario.current.transformerStatus[e.id]??e.inService:ctx.scenario.current.lineStatus[e.id]??e.inService;
  card.title+=trafo?` · ${engineeringNumber(Math.max(entity.vnKv,(e as Transformer2W).lvKv))}/${engineeringNumber(Math.min(entity.vnKv,(e as Transformer2W).lvKv))} kV`:` · ${engineeringNumber(entity.vnKv)} kV`;
  card.note=`P kayıp ${engineeringNumber(pLoss)} MW · Q kayıp ${engineeringNumber(qLoss)} MVAr · ${on?'Serviste':'Servis dışı'}${trafo?' · Tap '+engineeringNumber((e as Transformer2W).tapPosition):''}${trafo&&fromHv===null?' · HV/LV: BLOCKED':''}. Ayrıntı: ekipmanı seçin.`;
  return card;
}
export function renderEquipmentCard(host:HTMLElement,card:EquipmentCard){
  const head=element('header'),title=element('strong','',card.title),context=element('small','',card.context),state=element('p','ga-equipment-status',card.status),table=element('table','ga-equipment-table');head.append(title,context);host.replaceChildren(head,state);
  if(card.headers.length){const tr=element('tr');for(const h of card.headers)tr.append(element('th','',h));table.append(tr);for(const row of card.rows){const tr=element('tr');for(const value of row)tr.append(element('td','',value));table.append(tr);}host.append(table);}
  host.append(element('p','ga-equipment-note',card.note));host.dataset.status=card.status;
}
export function tooltipPosition(x:number,y:number,width:number,height:number,viewportWidth:number,viewportHeight:number){return {left:Math.max(8,Math.min(x+14,viewportWidth-width-8)),top:Math.max(8,Math.min(y+14,viewportHeight-height-8))};}
