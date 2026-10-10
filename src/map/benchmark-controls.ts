import type {AppContext} from '../app/contracts';
import {element} from '../ui/components/dom';
import {benchmarkMapGate,type BenchmarkMapSelection} from '../domain/benchmark/map-layer';
import {METRICS} from '../domain/benchmark/comparison';
import {rowObject} from '../domain/benchmark/types';
import {mapMetricLabel} from './layer-policy';
import type {Settings} from '../persistence/settings';

export function mapControl(label:string,field:HTMLElement){
  const root=element('label','ga-map-control');root.append(element('span','ga-control-label',label),field);return root;
}
export function createBenchmarkMapControls(ctx:AppContext){
  const root=element('details','ga-map-menu ga-map-options'),summary=element('summary','','Ölçüm'),body=element('div','ga-map-menu-body');
  root.append(summary,body);summary.dataset.helpId='map.metric';
  const analysis=element('select'),source=element('select'),metric=element('select'),cases=element('select'),layer=element('select'),side=element('select'),voltage=element('select'),diagnostic=element('input'),reason=element('p','ga-map-source-status');
  const consent=element('label','ga-check');diagnostic.type='checkbox';diagnostic.setAttribute('aria-label','Tanısal harita farklarını onayla');diagnostic.dataset.helpId='compare.diagnosticDelta';consent.append(diagnostic,document.createTextNode('Tanısal farkı açıkça onayla'));
  analysis.setAttribute('aria-label','Benchmark harita analizi');analysis.dataset.helpId='map.analysis';
  source.setAttribute('aria-label','Benchmark harita kaynağı');source.dataset.helpId='map.source';
  metric.setAttribute('aria-label','Benchmark harita metriği');metric.dataset.helpId='map.metric';
  cases.setAttribute('aria-label','Benchmark harita kesintisi');cases.dataset.helpId='map.case';
  layer.setAttribute('aria-label','N1 BASE POST CHANGE NEW_CONSTRAINTS');layer.dataset.helpId='map.phase';
  side.setAttribute('aria-label','Benchmark harita ucu');side.dataset.helpId='map.side';
  voltage.setAttribute('aria-label','Benchmark harita gerilim katmanı');voltage.dataset.helpId='map.voltages';
  const add=(select:HTMLSelectElement,value:string,label:string)=>{const option=element('option','',label);option.value=value;select.append(option);};
  for(const [value,label] of [['','Nominal şebeke'],['LF','Yük Akışı'],['N1','Kısıt (N-1)'],['SC','Kısa Devre']])add(analysis,value,label);
  for(const [value,label] of [['GA','GA'],['PF','PF'],['SCENARIO_DELTA','Senaryo − Baz'],['EXPLORATORY_DELTA','GA−PF tanısal'],['DELTA','GA−PF doğrulanmış']])add(source,value,label);
  for(const [value,label] of [['BASE','Önce'],['POST','Sonra'],['CHANGE','Değişim'],['NEW_CONSTRAINTS','Yeni kısıtlar']])add(layer,value,label);layer.value='POST';
  for(const [value,label] of [['FROM','Giriş / HV'],['TO','Çıkış / LV']])add(side,value,label);
  const sideControl=mapControl('Uç',side),voltageControl=mapControl('Sayısal katman',voltage);
  body.append(sideControl,voltageControl,consent,reason);
  const analysisControl=mapControl('Analiz',analysis),sourceControl=mapControl('Kaynak',source),metricControl=mapControl('Metrik',metric),caseControl=element('div','ga-map-case');
  caseControl.append(cases,layer);
  const nominal:Record<string,string>={nominal:'Nominal gerilim',p:'Aktif güç akışı P',loading:'Yüklenme P (%)',q:'Yüklenme Q (%)',v:'Bara gerilimi (pu)',angle:'Bara açısı (°)',delta:'Senaryo farkı',island:'Elektrik adası'};
  let previousFamily=ctx.resultView.analysis,previousAnalysis='?',previousBenchmark=ctx.benchmark,previousHybrid=ctx.hybridResult,previousAc=ctx.n1AcResults,previousDc=ctx.n1Result,previousSc=ctx.scResult,previousSelection=ctx.benchmarkMap;
  function selected():BenchmarkMapSelection|null{
    return analysis.value?{analysis:analysis.value as BenchmarkMapSelection['analysis'],source:source.value as BenchmarkMapSelection['source'],metric:metric.value,table:analysis.value==='LF'?'GA_Reference_Raw':analysis.value==='N1'?'N1_RecordedExtrema_Raw':'SC_BusResults_Raw',caseId:cases.value,n1Layer:layer.value as BenchmarkMapSelection['n1Layer'],diagnostic:diagnostic.checked,side:side.value,voltageKv:voltage.value?Number(voltage.value):undefined}:null;
  }
  function commit(){
    if(!analysis.value){
      ctx.benchmarkMap=null;ctx.analysisTab=ctx.resultView.analysis='LF';ctx.resultView.source='GA';ctx.resultStore.analysisType='powerFlow';
      ctx.settings.update({displayMode:metric.value as Settings['displayMode']});
    }else if(analysis.value==='N1'&&['islands','thermalRisk'].includes(metric.value)){
      ctx.resultView.analysis=ctx.analysisTab='N1';ctx.resultView.metric=metric.value;ctx.benchmarkMap=null;
      ctx.settings.update({displayMode:metric.value==='islands'?'n1-island':'n1-risk'});
    }else{
      ctx.benchmarkMap=selected();
      if(ctx.benchmarkMap){
        const s=ctx.benchmarkMap;ctx.analysisTab=ctx.resultView.analysis=s.analysis;
        ctx.resultView.source=s.source==='SCENARIO_DELTA'?'Senaryo−Baz':s.source==='PF'?'PF':['DELTA','EXPLORATORY_DELTA'].includes(s.source)?'GA−PF':'GA';
        ctx.resultView.metric=s.metric;ctx.resultView.caseId=s.caseId;if(s.analysis==='SC')ctx.resultView.faultId=cases.value;
        ctx.resultView.phase=s.n1Layer==='BASE'?'PRE':s.n1Layer==='CHANGE'?'CHANGE':'POST';ctx.resultView.side=s.side;
        if(s.analysis==='LF')ctx.resultStore.analysisType='powerFlow';
        ctx.settings.update({displayMode:'nominal'});
      }
    }
    previousFamily=ctx.resultView.analysis;previousSelection=ctx.benchmarkMap;ctx.notify();
  }
  function render(){
    if(previousFamily!==ctx.resultView.analysis){previousFamily=ctx.resultView.analysis;analysis.value=previousFamily;source.value='GA';previousAnalysis='?';}
    const external=ctx.benchmarkMap!==previousSelection?ctx.benchmarkMap:null;
    if(ctx.benchmarkMap!==previousSelection){previousSelection=ctx.benchmarkMap;if(external){analysis.value=external.analysis;source.value=external.source;layer.value=external.n1Layer??'POST';side.value=external.side??'FROM';diagnostic.checked=external.diagnostic??false;}else analysis.value='';}
    const active=analysis.value;
    caseControl.hidden=active==='LF'||!active;layer.hidden=active!=='N1'||source.value!=='GA';sideControl.hidden=active!=='N1';voltageControl.hidden=consent.hidden=!active;
    source.disabled=!active;
    if(ctx.network&&voltage.dataset.model!==ctx.network.modelHash){
      voltage.dataset.model=ctx.network.modelHash;voltage.replaceChildren();add(voltage,'','Tüm katmanlar');
      for(const v of [...new Set(ctx.network.buses.map(b=>b.vnKv))].sort((a,b)=>b-a))add(voltage,String(v),v+' kV');
    }
    if(active!==previousAnalysis){
      previousAnalysis=active;metric.replaceChildren();
      const fields=!active?Object.keys(nominal):active==='LF'?Object.keys(METRICS.GA_Reference_Raw):active==='SC'?Object.keys(METRICS.SC_BusResults_Raw):['postLoadingPercent','postPmw','postQmvar','postMva','postVoltagePu','voltageKv','postCurrentA','postCurrentLoadingPercent','postApparentLoadingPercent','islands','thermalRisk'];
      for(const field of fields)add(metric,field,nominal[field]??mapMetricLabel(field));
      if(!active)metric.value=ctx.settings.value.displayMode in nominal?ctx.settings.value.displayMode:'nominal';
    }
    if(active==='SC'&&(previousSc!==ctx.scResult||cases.dataset.family!=='SC'||!cases.options.length)){
      previousSc=ctx.scResult;cases.replaceChildren();
      for(const fault of ctx.scResult?.faults??[])add(cases,fault.physicalTerminalFid,fault.physicalTerminalFid+' · '+fault.status);
    }
    if(active==='N1'&&(ctx.benchmark!==previousBenchmark||ctx.hybridResult!==previousHybrid||ctx.n1AcResults!==previousAc||ctx.n1Result!==previousDc||cases.dataset.family!=='N1')){
      previousBenchmark=ctx.benchmark;previousHybrid=ctx.hybridResult;previousAc=ctx.n1AcResults;previousDc=ctx.n1Result;
      const old=cases.value;cases.replaceChildren();const table=ctx.benchmark?.groups.N1.tables.N1_Cases_Raw;
      for(const row of table?.rows||[]){const r=rowObject(table!,row);add(cases,String(r.caseId),String(r.outageName||r.caseId)+' · '+r.outageFid);}
      for(const c of [...ctx.hybridResult?.cases??[],...ctx.n1AcResults.map(c=>({outage:c.outage,status:c.status}))])if(![...cases.options].some(o=>o.value===c.outage.caseId))add(cases,c.outage.caseId,c.outage.caseId+' · '+c.status);
      for(const c of ctx.n1Result?.candidates??[]){const e=[...ctx.network?.lines??[],...ctx.network?.transformers??[]].find(e=>e.id===c.equipmentId),id='N1:'+c.sourceClass+':'+(e?.sourceId??c.equipmentId);if(![...cases.options].some(o=>o.value===id))add(cases,id,e?.name??id);}
      if([...cases.options].some(o=>o.value===old))cases.value=old;
    }
    if(active==='SC')cases.value=ctx.resultView.faultId??cases.value;
    cases.dataset.family=active;
    if(external){metric.value=external.metric;if(external.analysis!=='SC')cases.value=external.caseId??'';voltage.value=external.voltageKv?String(external.voltageKv):'';}
    if(active&&!metric.value)metric.selectedIndex=0;
    for(const option of source.options){
      const s=selected(),gate=s&&['islands','thermalRisk'].includes(s.metric)?{enabled:option.value==='GA',reason:'GA_DC_SCREEN_TOPOLOGY_ONLY'}:s?benchmarkMapGate(ctx,{...s,source:option.value as BenchmarkMapSelection['source']}):{enabled:true,reason:''};
      option.disabled=!gate.enabled;option.title=gate.reason;
    }
    const s=selected(),gate=s?benchmarkMapGate(ctx,s):{enabled:true,reason:''};
    reason.textContent=gate.enabled?'Eksik sayılar renk üretmez; nominal topoloji korunur.':gate.reason;
    source.dataset.helpDetail=gate.enabled?'':gate.reason;metric.dataset.helpDetail='Alan: '+metric.value;
    cases.disabled=ctx.busy||!cases.options.length;
    cases.setAttribute('aria-label',active==='SC'?'Harita kısa devre arızası':'Benchmark harita kesintisi');
  }
  analysis.onchange=()=>{source.value='GA';previousSc=null;render();commit();};
  source.onchange=metric.onchange=layer.onchange=side.onchange=voltage.onchange=diagnostic.onchange=()=>{render();commit();};
  cases.onchange=()=>{if(analysis.value==='SC'){commit();render();}else if(analysis.value==='N1'&&source.value==='GA')void ctx.loadHybridCaseDetail(cases.value).then(()=>{render();commit();});else{render();commit();}};
  return {element:root,analysisControl,sourceControl,metricControl,caseControl,render};
}
