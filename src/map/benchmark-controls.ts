import {SC_NODE_LABELS} from '../domain/results/sc-node';
import type {AppContext} from '../app/contracts';
import {element,button} from '../ui/components/dom';
import type {BenchmarkMapSelection} from '../domain/benchmark/map-layer';
import {LF_MAP_METRICS,mapPresentationGate,selectedN1Presentation,selectedScPresentation,mapCaseOptions,syncMapCase} from './layer-policy';
import type {Settings} from '../persistence/settings';
import {selectScMode,currentScResult} from '../domain/results/sc-selection';
export function mapControl(label:string,field:HTMLElement){
  const root=element('label','ga-map-control'),text=element('span','ga-control-label',label);text.dataset.helpId=field.dataset.helpId??'map.metric';text.dataset.helpLabel=label;text.tabIndex=0;root.append(text,field);return root;
}
export function createBenchmarkMapControls(ctx:AppContext){
  const root=element('details','ga-map-menu ga-map-options'),summary=element('summary','','Ölçüm'),body=element('div','ga-map-menu-body');root.append(summary,body);
  const node=element('select');node.setAttribute('aria-label','Harita SC düğüm sınıfı');node.append(new Option('Tüm düğümler',''),...Object.entries(SC_NODE_LABELS).map(([v,label])=>new Option(label,v)));node.onchange=()=>commit();
  const analysis=element('select'),source=element('select'),metric=element('select'),cases=element('select'),phase=element('select'),side=element('select'),voltage=element('select'),topology=element('select'),diagnostic=element('input'),reason=element('p','ga-map-source-status');
  const setup=(field:HTMLElement,label:string,help:string)=>{field.setAttribute('aria-label',label);field.dataset.helpId=help;};
  setup(analysis,'Benchmark harita analizi','map.analysis');setup(source,'Benchmark harita kaynağı','map.source');setup(metric,'Benchmark harita metriği','map.metric');setup(cases,'Benchmark harita kesintisi','map.case');setup(phase,'N1 BASE POST CHANGE NEW_CONSTRAINTS','map.phase');setup(side,'Benchmark harita ucu','map.side');setup(voltage,'Benchmark harita gerilim katmanı','map.voltages');
  diagnostic.type='checkbox';diagnostic.setAttribute('aria-label','Tanısal harita farklarını onayla');diagnostic.dataset.helpId='compare.diagnosticDelta';const consent=element('label','ga-check');consent.append(diagnostic,document.createTextNode('Tanısal farkı açıkça onayla'));
  const add=(select:HTMLSelectElement,value:string,label:string)=>{const option=element('option','',label);option.value=value;select.append(option);};
  for(const [v,l] of [['','Nominal şebeke'],['LF','Yük Akışı'],['N1','Kısıt (N-1)'],['SC','Kısa Devre']])add(analysis,v,l);
  for(const [v,l] of [['GA','GA'],['PF','PF'],['SCENARIO_DELTA','Senaryo − Baz'],['EXPLORATORY_DELTA','GA−PF tanısal'],['DELTA','GA−PF doğrulanmış']])add(source,v,l);
  for(const [v,l] of [['BASE','PRE'],['POST','POST'],['CHANGE','POST−PRE'],['NEW_CONSTRAINTS','Yeni/kötüleşen ihlal']])add(phase,v,l);
  for(const [v,l] of [['FROM','Baş / HV'],['TO','Son / LV']])add(side,v,l);
  setup(topology,'N-1 topoloji görünümü','map.metric');add(topology,'','Sayısal sonuç');add(topology,'n1-island','N-1 adaları');add(topology,'n1-risk','N-1 termik risk');
  const topologyControl=mapControl('Topoloji',topology),sideControl=mapControl('Uç',side),phaseControl=mapControl('Faz',phase),voltageControl=mapControl('Sayısal katman',voltage);body.append(mapControl('Düğüm sınıfı',node),topologyControl,phaseControl,sideControl,voltageControl,consent,reason,button('Renk / ölçek / altlık ayarları',()=>ctx.setView('settings')));
  const analysisControl=mapControl('Analiz',analysis),sourceControl=mapControl('Kaynak',source),metricControl=mapControl('Metrik',metric),caseControl=mapControl('Kesinti',cases);caseControl.classList.add('ga-map-case');const faultSearch=element('input');faultSearch.type='search';faultSearch.placeholder='Arıza adı / FID ara';faultSearch.setAttribute('aria-label','Harita arıza seçiminde ara');faultSearch.style.maxWidth='135px';caseControl.append(faultSearch);faultSearch.oninput=()=>{caseKey='';render();};
  const nominal:Record<string,string>={nominal:'Nominal gerilim',p:'Aktif güç akışı P',loading:'Yüklenme P (%)',q:'Yüklenme Q (%)',v:'Bara gerilimi (kV)',angle:'Bara açısı (°)',delta:'Senaryo farkı',island:'Elektrik adası','n1-island':'N-1 adaları','n1-risk':'N-1 termik risk'};
  let family='?',caseKey='',voltageKey='';analysis.value=ctx.benchmarkMap?.analysis??'';
  function selection():BenchmarkMapSelection|null{
    if(!analysis.value)return null;
    const isSc=analysis.value==='SC';
    return {analysis:analysis.value as 'LF'|'N1'|'SC',source:source.value as BenchmarkMapSelection['source'],metric:metric.value==='postDeltaPmw'?'postPmw':metric.value==='newConstraints'?'postLoadingPercent':metric.value,table:analysis.value==='LF'?'GA_Reference_Raw':analysis.value==='N1'?'N1_RecordedExtrema_Raw':'SC_BusResults_Raw',caseId:cases.value,n1Layer:isSc?undefined:(metric.value==='postDeltaPmw'?'CHANGE':metric.value==='newConstraints'?'NEW_CONSTRAINTS':phase.value as BenchmarkMapSelection['n1Layer']),scMode:isSc?(phase.value==='MIN'?'MIN':'MAX'):undefined,diagnostic:diagnostic.checked,side:side.value,nodeKind:isSc?node.value||undefined:undefined,voltageKv:voltage.value?Number(voltage.value):undefined};
  }
  function commit(){
    if(analysis.value==='SC'&&source.value==='GA'&&['MAX','MIN'].includes(phase.value)){
      const curMode=currentScResult(ctx)?.profile.calculateMode??'MAX';
      if(phase.value!==curMode){
        const ok=selectScMode(ctx,phase.value as 'MAX'|'MIN');
        if(!ok){
          phase.value=curMode;
          ctx.setMessage?.('Seçilen kısa devre modu ('+phase.value+') mevcut değil veya hesaplanmamış.');
        }
      }
    }
    const s=selection();ctx.benchmarkMap=s;
    if(!s){ctx.analysisTab=ctx.resultView.analysis='LF';ctx.resultView.source='GA';ctx.resultStore.analysisType='powerFlow';ctx.settings.update({displayMode:metric.value as Settings['displayMode']});}
    else{ctx.analysisTab=ctx.resultView.analysis=s.analysis;ctx.resultView.source=s.source==='PF'?'PF':s.source==='SCENARIO_DELTA'?'Senaryo−Baz':['DELTA','EXPLORATORY_DELTA'].includes(s.source)?'GA−PF':'GA';ctx.resultView.metric=s.metric;ctx.resultView.caseId=s.caseId;ctx.resultView.phase=s.n1Layer==='BASE'?'PRE':s.n1Layer==='CHANGE'?'CHANGE':'POST';ctx.resultView.side=s.side;if(s.analysis==='SC')ctx.resultView.faultId=cases.value;if(s.analysis==='LF'){ctx.resultStore.analysisType='powerFlow';if(s.source==='SCENARIO_DELTA')ctx.resultStore.role='delta';else if(s.source==='GA'&&ctx.resultStore.role==='delta')ctx.resultStore.role='scenario';}ctx.settings.update({displayMode:s.analysis==='LF'&&s.metric==='island'?'island':'nominal'});}
    syncMapCase(ctx);ctx.notify();
  }
  function populate(){
    if(family===analysis.value)return;family=analysis.value;metric.replaceChildren();phase.replaceChildren();
    if(family==='SC'){
      add(phase,'MAX','MAX Arıza');add(phase,'MIN','MIN Arıza');
      const curMode=currentScResult(ctx)?.profile.calculateMode??'MAX';
      phase.value=curMode;
    }else{
      for(const [v,l] of [['BASE','PRE'],['POST','POST'],['CHANGE','POST−PRE'],['NEW_CONSTRAINTS','Yeni/kötüleşen ihlal']])add(phase,v,l);
      phase.value='POST';
    }
    const options=family==='LF'?LF_MAP_METRICS.map(m=>[m.metric,m.label]):family==='N1'?[['postPmw','Kesinti sonrası P (MW)'],['postLoadingPercent','Yüklenme (%)'],['postDeltaPmw','POST−PRE ΔP (MW)'],['postQmvar','Q (MVAr) · Full AC'],['voltageKv','U (kV) · Full AC'],['angleDeg','Bara açısı (°) · Full AC'],['postMva','S (MVA) · Full AC'],['postCurrentA','Akım (A) · Full AC'],['postAngleDifferenceDeg','Uç açı farkı (°) · Full AC'],['postPLossMw','Aktif kayıp (MW) · Full AC'],['postQLossMvar','Reaktif kayıp (MVAr) · Full AC'],['postTapPosition','Trafo kademesi · Full AC'],['newConstraints','Yeni/kötüleşen ihlal']]:family==='SC'?[['maxIkssKa','TM Maksimum Bara Akımı (kA)'],['ikss3FKa','3F Bara Akımı (kA)'],['skssMva','Skss (MVA)']]:Object.entries(nominal);
    if(family==='LF'){const electrical=document.createElement('optgroup'),topology=document.createElement('optgroup');electrical.label='Elektriksel büyüklükler';topology.label='Topoloji';for(const [v,l] of options){const o=document.createElement('option');o.value=v;o.textContent=l;(v==='island'?topology:electrical).append(o);}metric.append(electrical,topology);}else for(const [v,l] of options)add(metric,v,l);metric.value=family==='LF'?'pFromMw':family==='N1'?'postPmw':family==='SC'?'maxIkssKa':ctx.settings.value.displayMode in nominal?ctx.settings.value.displayMode:'nominal';
  }
  function render(){
    const external=ctx.benchmarkMap;
    if(external){analysis.value=external.analysis;source.value=external.source;if(external.analysis==='LF'&&!LF_MAP_METRICS.some(m=>m.metric===external.metric)){external.metric=/voltage/.test(external.metric)?'voltageKv':/^[qs].*(Hv|Lv)/.test(external.metric)?external.metric.startsWith('q')?'qHvMvar':'pHvMw':/^[ps].*(Hv|Lv)/.test(external.metric)?'pHvMw':external.metric.startsWith('q')?'qFromMvar':'pFromMw';ctx.resultView.metric=external.metric;}}else if(ctx.resultView.analysis!=='LF'){analysis.value=ctx.resultView.analysis;source.value=ctx.resultView.source==='PF'?'PF':'GA';}
    populate();
    if(external){const selected=external.analysis==='N1'&&external.n1Layer==='CHANGE'&&external.metric==='postPmw'?'postDeltaPmw':external.n1Layer==='NEW_CONSTRAINTS'?'newConstraints':external.metric;metric.value=[...metric.options].some(o=>o.value===selected)?selected:external.analysis==='LF'&&selected==='voltagePu'?'voltageKv':metric.options[0]?.value??'';phase.value=external.analysis==='SC'?(external.scMode??'MAX'):(external.n1Layer??'POST');side.value=external.side??'FROM';voltage.value=external.voltageKv?String(external.voltageKv):'';diagnostic.checked=external.diagnostic===true;}
    node.parentElement!.hidden=analysis.value!=='SC';const active=analysis.value;topologyControl.hidden=active!=='N1';topology.value=!external&&ctx.settings.value.displayMode.startsWith('n1-')?ctx.settings.value.displayMode:'';source.disabled=!active;caseControl.hidden=active!=='N1'&&active!=='SC';
    sideControl.hidden=active!=='N1';phaseControl.hidden=active!=='N1'&&active!=='SC';
    if(active==='SC'){phaseControl.querySelector('span')!.textContent='Mod';const curMode=external?.scMode??(currentScResult(ctx)?.profile.calculateMode??'MAX');phase.value=curMode;}else phaseControl.querySelector('span')!.textContent='Faz';
    voltageControl.hidden=consent.hidden=!active;
    if(ctx.network&&voltageKey!==ctx.network.modelHash){voltageKey=ctx.network.modelHash;voltage.replaceChildren();add(voltage,'','Tüm katmanlar');for(const v of [...new Set(ctx.network.buses.map(b=>b.vnKv))].sort((a,b)=>b-a))add(voltage,String(v),v+' kV');}
    const rows=active==='N1'||active==='SC'?mapCaseOptions(ctx,active):[];
    faultSearch.hidden=active!=='SC'&&active!=='N1';const needle=faultSearch.value.trim().toLocaleLowerCase('tr-TR'),selected=active==='SC'?ctx.resultView.faultId:ctx.resultView.caseId,visible=active==='SC'||active==='N1'?rows.filter(r=>!needle||r.join(' ').toLocaleLowerCase('tr-TR').includes(needle)).slice(0,49):rows;if((active==='SC'||active==='N1')&&selected&&!visible.some(r=>r[0]===selected)){const chosen=rows.find(r=>r[0]===selected);if(chosen)visible.push(chosen);}const key=JSON.stringify(visible);if(caseKey!==active+key){caseKey=active+key;cases.replaceChildren();add(cases,'','Vaka / arıza seçin');for(const [v,l] of visible)add(cases,v,l);}
    cases.value=active==='SC'?ctx.resultView.faultId??'':ctx.resultView.caseId??'';cases.disabled=ctx.busy||rows.length===0;cases.setAttribute('aria-label',active==='SC'?'Harita kısa devre arızası':'Benchmark harita kesintisi');caseControl.querySelector('span')!.textContent=active==='SC'?'Arıza':'Kesinti';
    for(const option of source.options){const s=selection(),gate=s?mapPresentationGate(ctx,{...s,source:option.value as BenchmarkMapSelection['source']}):{enabled:true,reason:''};option.disabled=!gate.enabled;option.dataset.reason=gate.reason;}
    if(active==='N1'){const post=selectedN1Presentation(ctx).post;for(const o of metric.options){o.disabled=o.value==='newConstraints'?post?.source!=='HYBRID_FULL_AC'||!(ctx.hybridResult?.cases.find(c=>c.outage.caseId===ctx.resultView.caseId)?.constraintChanges?.length):['postQmvar','voltageKv'].includes(o.value)&&!post;o.textContent=o.value==='postLoadingPercent'?(post?'Hesaplanan yüklenme (%)':'Tahmini yüklenme (%)'):o.textContent;}}
    if(active==='SC'){const sc=currentScResult(ctx);for(const o of metric.options){o.disabled=source.value==='GA'&&(!sc||!sc.faults.length);if(source.value==='PF'&&(o.value==='skssMva'))o.disabled=true;}}
    const s=selection(),gate=s?mapPresentationGate(ctx,s):{enabled:true,reason:''};reason.textContent=gate.enabled?'Eksik sayılar renk üretmez; nominal topoloji korunur.':gate.reason;
  }
  analysis.onchange=()=>{ctx.benchmarkMap=null;source.value='GA';ctx.resultView.analysis=analysis.value as 'LF'|'N1'|'SC'||'LF';populate();commit();};
  source.onchange=()=>{if(analysis.value==='SC'&&source.value==='PF'){if(phase.value==='MIN')phase.value='MAX';if(metric.value==='skssMva')metric.value='maxIkssKa';}commit();};
  for(const field of [metric,phase,side,voltage,diagnostic])field.onchange=commit;
  cases.onchange=()=>{commit();if(analysis.value==='N1'&&source.value==='GA')void ctx.loadHybridCaseDetail(cases.value);};
  topology.onchange=()=>{if(!topology.value){commit();return;}ctx.benchmarkMap=null;ctx.analysisTab=ctx.resultView.analysis='N1';ctx.resultView.source='GA';ctx.resultView.metric=topology.value==='n1-island'?'islands':'thermalRisk';ctx.settings.update({displayMode:topology.value as Settings['displayMode']});ctx.notify();};
  return {element:root,body,analysisControl,sourceControl,metricControl,caseControl,render};
}
