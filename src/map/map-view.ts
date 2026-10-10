import {activeResultId} from '../domain/results/workspace';
import {deltaLabels,deltaMaximum} from './delta-style';
import type {Settings} from '../persistence/settings';
import type {Line} from '../domain/model/network';
import {requestedRole} from '../ui/components/calculation-controls';
import {mapStatusText} from './layer-policy';
import {fullAcDiagnostics} from '../domain/results/diagnostics';
import {createVoltageFilter} from '../ui/components/voltage-filter';
import {capacitySession,setCapacitySeason,type CapacitySeason} from '../domain/model/capacity';
import type {AppContext,Feature} from '../app/contracts';
import {element,button,escapeHtml as h} from '../ui/components/dom';
import {CanvasMapRenderer} from './canvas-renderer';
import {createLightningPanel} from './lightning-panel';
import {createBenchmarkMapControls,mapControl} from './benchmark-controls';

export function createMapView(ctx:AppContext):Feature{
  const root=element('section','ga-map-view'),bar=element('div','ga-map-toolbar'),scope=element('div','ga-map-toolbar-row ga-map-scope-row'),tools=element('div','ga-map-toolbar-row ga-map-tools-row'),wrap=element('div','ga-map-wrap'),baseCanvas=element('canvas','ga-basemap-canvas'),selectionCanvas=element('canvas','ga-selection-canvas'),canvas=element('canvas','ga-network-canvas'),overlay=element('canvas','ga-flow-canvas'),tooltip=element('div','ga-map-tooltip'),legend=element('aside','ga-map-legend'),detail=element('div','ga-map-selection'),empty=element('div','ga-map-empty','Haritayı görmek için en az bir gerilim grubu seçin.');
  tooltip.hidden=true;empty.hidden=true;canvas.id='networkCanvas';bar.append(scope,tools);wrap.append(baseCanvas,canvas,selectionCanvas,overlay,tooltip,legend,detail,empty);root.append(bar,wrap);
  const renderer=new CanvasMapRenderer(ctx,canvas,overlay,tooltip,baseCanvas,selectionCanvas),panel=createLightningPanel(ctx),benchmarkControls=createBenchmarkMapControls(ctx),statusBar=element('div','ga-map-status'),statusText=element('span'),statusDetails=element('details','ga-map-status-details'),statusSummary=element('summary','','Ayrıntı'),statusBody=element('div');statusText.setAttribute('role','status');statusDetails.append(statusSummary,statusBody);statusBar.append(statusText,statusDetails);
  wrap.append(panel.element);root.append(statusBar);
  const lightning=button('⚡',()=>panel.toggle(),'Elektriksel Sonuçlar');lightning.className+=' ga-lightning-toggle';lightning.dataset.helpId='map.results';wrap.append(lightning);
  const area=element('select'),layout=element('select'),role=element('select'),search=element('input'),capacity=element('select'),deltaMetric=element('select');
  area.setAttribute('aria-label','YTM filtresi');area.id='mapArea';area.dataset.helpId='map.area';
  layout.setAttribute('aria-label','Hat yerleşimi');layout.dataset.helpId='map.layout';layout.innerHTML='<option value="standard">Standart</option><option value="separated">Ayrık hatlar</option>';
  role.setAttribute('aria-label','Sonuç göster');role.dataset.helpId='map.scenario';role.innerHTML='<option value="base">Baz</option><option value="scenario">Senaryo</option><option value="delta">Fark</option>';
  capacity.setAttribute('aria-label','Harita kapasite sınırı');capacity.dataset.helpId='map.capacity';capacity.innerHTML='<option value="nominal">DGS nominal kapasite</option><option value="summer">Yaz kapasitesi</option><option value="winter">Kış kapasitesi</option><option value="operational">İşletme adayı (doğrulanmamış)</option>';
  deltaMetric.setAttribute('aria-label','Fark metriği');deltaMetric.dataset.helpId='map.scenarioDelta';deltaMetric.innerHTML='<option value="p">Fark: ΔP</option><option value="q">Fark: ΔQ</option><option value="v">Fark: ΔV</option><option value="loading">Fark: ΔYük %</option>';
  search.placeholder='Hat adı / FID';search.setAttribute('aria-label','Haritada hat ara');search.dataset.helpId='map.search';search.type='search';
  const flag=(text:string,checked:boolean,action:(v:boolean)=>void)=>{const label=element('label','ga-check'),input=element('input');input.type='checkbox';input.checked=checked;input.onchange=()=>action(input.checked);label.append(input,document.createTextNode(text));return{label,input};};
  const flow=flag('Akış',ctx.settings.value.flowDefault,value=>{ctx.settings.update({flowDefault:value});ctx.notify();}),sites=flag('TM',true,value=>{renderer.showSites=value;renderer.render();}),labels=flag('Etiketler',false,value=>{renderer.showLabels=value;renderer.render();}),simple=flag('Sade güzergâh',false,value=>{renderer.simple=value;renderer.render();});
  flow.input.dataset.helpId='map.flow';sites.input.dataset.helpId='map.sites';labels.input.dataset.helpId='map.labels';simple.input.dataset.helpId='map.route';
  const voltageFilter=createVoltageFilter(ctx,'Harita gerilim grupları',true),lineMenu=element('details','ga-map-menu ga-map-line-menu'),lineSummary=element('summary'),lineTitle=element('span','','Hatlar'),lineValue=element('span'),lineBody=element('div','ga-map-menu-body'),deltaControl=mapControl('Fark metriği',deltaMetric);lineTitle.dataset.helpId='map.layout';lineTitle.dataset.helpLabel='Hatlar';lineTitle.tabIndex=0;lineSummary.append(lineTitle,lineValue);
  lineBody.append(mapControl('Hat yerleşimi',layout),mapControl('LF görünümü',role));benchmarkControls.body.append(mapControl('Kapasite',capacity),deltaControl);lineMenu.append(lineSummary,lineBody);
  const scenarioChip=button('B0',()=>panel.open('SCENARIOS'),'Senaryoları aç');scenarioChip.className+=' ga-map-scenario-chip';scenarioChip.dataset.helpId='map.scenario';
  scope.append(mapControl('YTM',area),voltageFilter.element,lineMenu,benchmarkControls.analysisControl,benchmarkControls.sourceControl,scenarioChip);
  const calc=button('Hesapla',()=>{if(ctx.resultView.analysis==='LF'){if(ctx.resultStore.active)panel.open('RESULTS');else void ctx.run('powerFlow',requestedRole(ctx));}else if(activeResultId(ctx))panel.open('RESULTS');else ctx.setView('analysis:'+ctx.resultView.analysis);}),refresh=button('↻',()=>ctx.resultView.analysis==='LF'?void ctx.run('powerFlow',requestedRole(ctx)):ctx.setView('analysis:'+ctx.resultView.analysis),'Yeniden hesapla'),fit=button('Sığdır',()=>renderer.reset()),fullscreen=button('Tam ekran',()=>{if(document.fullscreenElement===root)void document.exitFullscreen();else void root.requestFullscreen();});
  calc.dataset.helpId=refresh.dataset.helpId='map.calculate';fit.dataset.helpId='map.fit';fullscreen.dataset.helpId='map.fullscreen';
  const find=button('Bul',()=>{const q=search.value.trim().toLocaleLowerCase('tr-TR'),line=ctx.network?.lines.find(l=>q&&[l.name,l.id,l.sourceId].join(' ').toLocaleLowerCase('tr-TR').includes(q));if(line){ctx.select(line.id,'ElmLne');renderer.focus(line.id,'ElmLne');closeMenus();}else ctx.setMessage('Hat bulunamadı.');});find.dataset.helpId='map.search';
  const searchGroup=element('div','ga-map-search');searchGroup.append(search,find);
  tools.append(benchmarkControls.metricControl,benchmarkControls.caseControl,flow.label,sites.label,labels.label,simple.label,searchGroup,calc,refresh,fit,fullscreen,benchmarkControls.element);
  search.onkeydown=e=>{if(e.key==='Enter')find.click();};
  area.onchange=()=>{ctx.filters.areaId=area.value;ctx.filters.siteId='';ctx.selection=null;panel.table.page=0;ctx.notify();};
  layout.onchange=()=>{ctx.settings.update({layoutMode:layout.value as 'standard'|'separated'});ctx.notify();};
  capacity.onchange=()=>{if(ctx.network){setCapacitySeason(ctx.network.modelHash,capacity.value as CapacitySeason);ctx.notify();}};
  role.onchange=()=>{ctx.resultStore.role=role.value as 'base'|'scenario'|'delta';ctx.benchmarkMap=null;ctx.resultView.analysis=ctx.analysisTab='LF';ctx.notify();};
  deltaMetric.onchange=()=>{ctx.settings.update({deltaMetric:deltaMetric.value as Settings['deltaMetric']});ctx.notify();};
  function closeMenus(){root.querySelectorAll<HTMLDetailsElement>('.ga-map-menu[open]').forEach(menu=>{menu.open=false;});}
  const outside=(e:PointerEvent)=>{if(!(e.target as Element).closest('.ga-map-menu'))closeMenus();},escape=(e:KeyboardEvent)=>{if(e.key==='Escape')closeMenus();};
  root.addEventListener('toggle',e=>{const opened=e.target as HTMLDetailsElement;if(opened.classList.contains('ga-map-menu')&&opened.open)root.querySelectorAll<HTMLDetailsElement>('.ga-map-menu[open]').forEach(menu=>{if(menu!==opened)menu.open=false;});},true);
  document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);
  legend.addEventListener('click',event=>{const choice=(event.target as HTMLElement).closest<HTMLElement>('[data-n1-island]');if(choice){const islandId=choice.dataset.n1Island||null;ctx.selectN1Island(ctx.selectedN1IslandId===islandId?null:islandId);}});
  let modelHash='',lastSelection='',lastN1Candidate='';
  function fitViewport(){if(document.fullscreenElement===root){wrap.style.height=Math.max(240,innerHeight-bar.getBoundingClientRect().height-46)+'px';return;}wrap.style.height=Math.max(240,innerHeight-wrap.getBoundingClientRect().top-38)+'px';}
  const resize=()=>{if(ctx.view==='map'){fitViewport();renderer.render();}},fullscreenChanged=()=>{fullscreen.textContent=document.fullscreenElement===root?'Çık':'Tam ekran';fullscreen.setAttribute('aria-label',fullscreen.textContent);fullscreen.title=fullscreen.textContent;resize();renderer.render();};
  window.addEventListener('resize',resize);document.addEventListener('fullscreenchange',fullscreenChanged);
  function render(){
    root.dataset.scenarioId=ctx.scenario.selectedId;root.dataset.resultId=activeResultId(ctx)??'NOT_RUN';
    if(ctx.view!=='map'){closeMenus();panel.close();renderer.render();return;}
    const n=ctx.network;benchmarkControls.render();
    if(n?.modelHash!==modelHash){modelHash=n?.modelHash||'';const areas=new Map(n?.sites.map(s=>[s.areaId,s.areaName])||[]);area.innerHTML='<option value="">Tüm YTM</option>'+[...areas].sort((a,b)=>a[1].localeCompare(b[1],'tr')).map(([id,name])=>'<option value="'+h(id)+'">'+h(name)+'</option>').join('');renderer.reset();}
    statusText.textContent=ctx.busy?'İşleniyor… · '+ctx.status:mapStatusText(ctx);statusBar.dataset.analysis=ctx.resultView.analysis;statusBody.replaceChildren(element('p','',ctx.status));if(ctx.resultView.analysis==='LF'){const r=ctx.resultStore.active;if(r){const p=fullAcDiagnostics(r);statusBody.append(element('p','',`Newton toplam: ${p.newtonIterations??'—'} · Son tur: ${p.finalNewtonIterations??'—'} · NR çözümü: ${p.fullNrSolves??'—'}`));for(const warning of r.warnings.slice(0,6))statusBody.append(element('p','',warning));}}fitViewport();voltageFilter.render();area.value=ctx.filters.areaId;
    capacity.value=n?capacitySession(n.modelHash).season:'nominal';layout.value=ctx.settings.value.layoutMode;role.value=ctx.resultStore.role;flow.input.checked=ctx.settings.value.flowDefault;
    lineValue.textContent=layout.value==='separated'?'Ayrık':'Standart';
    scenarioChip.textContent=ctx.scenario.selectedId+' · '+(activeResultId(ctx)?ctx.resultView.analysis:'Sonuç yok');
    scenarioChip.disabled=!n;deltaControl.hidden=ctx.settings.value.displayMode!=='delta';deltaMetric.value=ctx.settings.value.deltaMetric;empty.hidden=ctx.filters.voltages.size>0;
    calc.textContent=activeResultId(ctx)?'Sonuçlar':ctx.resultView.analysis==='LF'?'LF hesapla':ctx.resultView.analysis==='N1'?'N-1 seç':'SC seç';
    calc.setAttribute('aria-label',calc.textContent);calc.dataset.helpDetail=ctx.scenario.selectedId+' · '+ctx.resultView.analysis;calc.disabled=refresh.disabled=ctx.busy||!n;
    const settings=ctx.settings.value;legend.hidden=!settings.legend;renderer.render();
    const n1Detail=ctx.n1Detail?.candidate.candidateId===ctx.selectedN1CandidateId?ctx.n1Detail:null,n1Mode=settings.displayMode==='n1-island'||settings.displayMode==='n1-risk';if(n1Mode&&n1Detail&&lastN1Candidate!==n1Detail.candidateId){lastN1Candidate=n1Detail.candidateId;renderer.focus(n1Detail.outage.equipmentId,n1Detail.outage.sourceClass);}
    const delta=deltaLabels[settings.deltaMetric];const modes={nominal:'Nominal gerilim',loading:'Yüklenme P (%)',p:'Aktif güç akışı P',q:'Yüklenme Q (%)',v:'Bara gerilimi V',angle:'Bara açısı θ',delta:'Senaryo farkı',island:'Elektrik adası','n1-island':'N-1 adaları','n1-risk':'N-1 termik risk'};
    legend.innerHTML=`<b>${modes[settings.displayMode]}</b>`+(settings.displayMode==='island'?renderer.islandLegendMarkup(settings.colorNoResult):settings.displayMode==='n1-island'?renderer.n1IslandLegendMarkup(settings.colorNoResult):settings.displayMode==='n1-risk'?renderer.n1RiskLegendMarkup(settings.colorNoResult):settings.displayMode==='delta'?`<span><i style="background:${settings.deltaUp}"></i>${delta.name} artışı +${delta.unit}</span><span><i style="background:${settings.deltaDown}"></i>${delta.name} azalışı −${delta.unit}</span><span><i style="background:${settings.deltaNeutral}"></i>Nötr</span><span>Görsel maksimum: ±${deltaMaximum(settings)} ${delta.unit}</span>`:settings.displayMode==='v'?`<span class="ga-gradient-key" style="background:linear-gradient(90deg,${settings.voltageLowColor},${settings.voltageNeutralColor},${settings.voltageHighColor})"></span><span>${settings.voltageMin.toFixed(2)} – ${settings.voltageNeutral.toFixed(2)} – ${settings.voltageMax.toFixed(2)} pu</span><span>TM: en büyük |V − 1|</span>`:settings.displayMode==='angle'?`<span class="ga-gradient-key" style="background:linear-gradient(90deg,${settings.angleNegativeColor},${settings.angleNeutralColor},${settings.anglePositiveColor})"></span><span>${settings.angleMin}° – ${settings.angleNeutral}° – ${settings.angleMax}°</span><span>TM: ≥66 kV bara medyanı · ada referansına bağlı</span>`:settings.displayMode==='loading'?`<span>max |P uçları| / nominal MVA</span><span>Eşikler: ${settings.thresholds.join(' / ')} %</span>`:settings.displayMode==='q'?`<span>max |Q uçları| / Q-baz</span><span>400 kV: ${settings.qBase400Mvar} MVAr · 154 kV: ${settings.qBase154Mvar} MVAr</span><span>Eşikler: ${settings.qThresholds.join(' / ')} %</span><span>Hareketli uç okları MVAr yönünü ayrı gösterir</span><span>Değer için çizgiye gelin; sabit etiket yakın zoomda</span>`:`<span><i style="background:${settings.color400}"></i>400 kV</span><span><i style="background:${settings.color220}"></i>220 kV</span><span><i style="background:${settings.color154}"></i>154 kV</span><span><i style="background:${settings.color66}"></i>66 kV</span><span><i style="background:${settings.colorLow}"></i>≤36 kV</span>`)+`<span>Gri: sonuç yok · ┄ servis dışı</span><small>Altlık: geoBoundaries / OSM · CC BY-SA 2.0</small>`;
    const benchmarkLegend=renderer.benchmarkLegendMarkup();if(benchmarkLegend)legend.innerHTML=benchmarkLegend;
    const selected=ctx.selection,entity=selected?(selected.sourceClass==='ElmSite'?n?.sites:selected.sourceClass==='ElmLne'?n?.lines:selected.sourceClass==='ElmTr2'?n?.transformers:n?.buses)?.find(e=>e.id===selected.id):null;
    detail.replaceChildren();if(entity){detail.append(element('strong','',entity.name),element('small','ga-muted',`${entity.sourceClass} · ${entity.id}`));
      if(entity.sourceClass==='ElmLne'){const line=entity as Line,on=ctx.scenario.current.lineStatus[line.id]??line.inService;
        detail.append(element('span','',`${line.vnKv} kV · Kaynak: ${line.inService?'Serviste':'Servis dışı'} · Senaryo: ${on?'Serviste':'Servis dışı'}`));
        const toggle=button(on?'Servis dışı':'Servise al',()=>void ctx.setStatus('lineStatus',line.id,!on,line.inService)),calculate=button(`Değiştir + Senaryo Full AC hesapla`,()=>void ctx.setStatus('lineStatus',line.id,!on,line.inService,true));toggle.disabled=calculate.disabled=ctx.busy;detail.append(toggle,calculate,button('Sonuçlar',()=>{panel.open('RESULTS');panel.table.kind='line';panel.table.search=line.id;panel.table.expanded=line.id;panel.render();}));
        if(line.id in ctx.scenario.current.lineStatus||ctx.scenario.current.energizations?.[line.id])detail.append(button('Kaynağa dön',()=>void ctx.setStatus('lineStatus',line.id,line.inService,line.inService)));
        if(settings.displayMode!=='nominal')detail.append(element('small','ga-flow-detail',renderer.detailText(line)));
      }
      if(entity.sourceClass==='ElmTr2'){const trafo=entity as import('../domain/model/network').Transformer2W,on=ctx.scenario.current.transformerStatus[trafo.id]??trafo.inService;detail.append(button(on?'Servis dışı':'Servise al',()=>void ctx.setStatus('transformerStatus',trafo.id,!on,trafo.inService)),button('Değiştir + Senaryo Full AC hesapla',()=>void ctx.setStatus('transformerStatus',trafo.id,!on,trafo.inService,true)));}
      if(entity.sourceClass==='ElmSite'&&(settings.displayMode==='v'||settings.displayMode==='angle'||settings.displayMode==='island'||settings.displayMode==='delta'&&settings.deltaMetric==='v'))detail.append(element('small','ga-flow-detail',renderer.detailText(entity as import('../domain/model/network').Site)));
      detail.append(button('Tek Hat',()=>ctx.select(entity.id,entity.sourceClass,'sld')),button('Temizle',()=>{ctx.selection=null;ctx.notify();}));
    }else detail.textContent='TM veya hat seçin · Tekerlek: yakınlaştır · Sürükle: kaydır';
    const selectionKey=selected?`${selected.sourceClass}|${selected.id}`:'';if(selectionKey!==lastSelection){lastSelection=selectionKey;if(selected&&selected.sourceClass!=='ElmTerm')renderer.focus(selected.id,selected.sourceClass);}
    panel.render();
  }
  return{element:root,render,dispose:()=>{window.removeEventListener('resize',resize);document.removeEventListener('fullscreenchange',fullscreenChanged);document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);panel.dispose();renderer.dispose();}};
}
