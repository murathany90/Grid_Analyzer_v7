import {createWorkspaceResults} from './workspace-results';
import {activeResultId} from '../../domain/results/workspace';
import type {AppContext,Feature} from '../../app/contracts';
import {element,button,downloadText} from '../../ui/components/dom';
import {formatEngineering} from '../../ui/components/engineering-format';
import {createAnalysisView} from './analysis-view';
import {createQualityN1View} from '../quality-n1/quality-n1-view';
import {createModelView} from '../model/model-view';
import {createCalculationActions} from '../comparison/calculation-actions';
import {studyEvidence} from './study-evidence';
import {studyLabel,studyStatusHelp} from '../../ui/components/study-labels';
import {createYtmStudyView} from './ytm-study-view';

export function createModelLanding(ctx:AppContext):Feature{
  const model=createModelView(ctx),quality=createQualityN1View(ctx,'quality');model.element.append(quality.element);
  return {element:model.element,render(){model.render();quality.render();}};
}

/** Views and controls retain their lifetime; only their placement/visibility changes. */
export function createAnalysisWorkspace(ctx:AppContext):Feature{
  const root=element('section','ga-analysis-workspace'),tabs=element('nav','ga-analysis-tabs'),context=element('div','ga-analysis-context'),lf=createAnalysisView(ctx),dc=createQualityN1View(ctx,'n1'),method=element('select');
  const panels={} as Record<'LF'|'N1'|'SC',HTMLElement>,options={} as Record<'LF'|'N1'|'SC',HTMLElement>,centers={} as Record<'LF'|'N1'|'SC',HTMLElement>,tabButtons=new Map<string,HTMLButtonElement>();
  tabs.setAttribute('aria-label','Analiz türü');context.setAttribute('aria-label','Ortak analiz bağlamı');
  const familyMetrics=new Map<string,string>();
  for(const [key,label] of [['LF','Yük Akışı Analizi'],['N1','Kısıt Analizi (N-1)'],['SC','Kısa Devre Analizi']] as const){
    const panel=element('section','ga-analysis-layout'),left=element('aside','ga-analysis-options'),center=element('div','ga-analysis-center');panels[key]=panel;options[key]=left;centers[key]=center;panel.id='ga-analysis-'+key;panel.append(left,center);left.setAttribute('aria-label',label+' seçenekleri');
    const b=button(label,()=>{if(ctx.resultView.analysis!==key){familyMetrics.set(ctx.resultView.analysis,ctx.resultView.metric);ctx.resultView.metric=familyMetrics.get(key)??(key==='SC'?'ikssKa':key==='N1'?'postLoadingPercent':'pFromMw');ctx.benchmarkMap=null;}ctx.analysisTab=key;ctx.resultView.analysis=key;ctx.notify();});b.setAttribute('aria-controls',panel.id);tabButtons.set(key,b);tabs.append(b);
  }
  const evidence=element('aside','ga-analysis-evidence'),verdicts=element('div','ga-study-verdicts'),coverage=element('p','ga-study-coverage'),residual=element('p','ga-study-residual'),details=element('details'),log=element('pre');details.append(element('summary','','Yöntem / kontrol / kapsam kanıtı'),log);evidence.append(element('h3','','Yöntem ve kanıt'),verdicts,coverage,residual,details,button('Kanıt JSON',()=>downloadText(JSON.stringify(studyEvidence(ctx),null,2),'GA_Analysis_Evidence.local.json','application/json')),button('PF–GA karşılaştırması',()=>ctx.setView('comparison')));
  const lfMode=element('select');lfMode.setAttribute('aria-label','LF sonuç görünümü');lfMode.innerHTML='<option value="DETAILS">Özet / ayrıntılar</option><option value="COMMON">Ortak sonuç tablosu</option>';lfMode.title='Mevcut özet, üretici, topoloji ve tanı sekmeleri korunur. Ortak tabloda YTM/TM filtreleri, çoklu sıralama ve sütun düzeni seçilebilir.';lfMode.onchange=()=>render();
  options.LF.append(element('h3','','Yük akışı seçenekleri'),lfMode);const lfControls=lf.element.querySelector<HTMLElement>('.ga-analysis-controls');if(lfControls)options.LF.append(lfControls);centers.LF.append(lf.element);
  method.setAttribute('aria-label','N-1 hesap yöntemi');method.innerHTML='<option value="DC">DC tarama — yalnız aktif güç</option><option value="HYBRID">DC tarama → seçili Full AC doğrulama</option>';method.title='DC tarama Q/U ve tam AC termik güvenlik kanıtı değildir. Hibrit yöntemde bütçe içindeki seçili/riskli vakalar Full AC çözülür.';options.N1.append(element('h3','','N-1 seçenekleri'),method);
  const calculations=createCalculationActions(ctx,()=>ctx.analysisTab,()=>ctx.comparisonOutage),manual=element('details'),manualInfo=element('p');
  const manualPolicy=element('select');manualPolicy.setAttribute('aria-label','Seçili Full AC kontrol doğruluğu');manualPolicy.innerHTML='<option value="STRICT">Kontrollerin tam desteği gerekir</option><option value="ALLOW_PARTIAL">Aynı ayarlar · eksik kontrol PARTIAL · PF paritesi yok</option>';
  const ac=button('Seçili vaka: GA Full AC doğrula',()=>{if(ctx.comparisonOutage)void ctx.runN1AcValidation([ctx.comparisonOutage],manualPolicy.value as 'STRICT'|'ALLOW_PARTIAL');}),screen=button('Seçili vaka: GA DC screening',()=>{const o=ctx.comparisonOutage;if(!o)return;const e=(o.sourceClass==='ElmLne'?ctx.network?.lines:ctx.network?.transformers)?.find(e=>e.sourceId===o.fid);if(e)void ctx.runN1Screen({candidateTypes:[o.sourceClass],selectedCandidateIds:[`${o.sourceClass}:${e.id}`],analysisScope:'scenario'});});
  manual.append(element('summary','','Referanstan seçilen tek vaka'),manualInfo,manualPolicy,screen,ac,button('Seçili AC vaka JSON',()=>downloadText(JSON.stringify(ctx.n1AcResults,null,2),'GA_N1_AC.local.json','application/json')),button('Vaka ayrıntıları / karşılaştırma',()=>ctx.setView('comparison')));options.N1.append(manual);centers.N1.append(dc.element);
  const shared=createWorkspaceResults(ctx,true),ytm=createYtmStudyView(ctx);root.append(ytm.element,tabs,context,panels.LF,panels.N1,panels.SC);let lastOutage=ctx.comparisonOutage;method.onchange=()=>render();
  function render(){
    ytm.render();
    const selected=ctx.analysisTab??'LF',proof=studyEvidence(ctx);root.dataset.scenarioId=ctx.scenario.selectedId;root.dataset.resultId=activeResultId(ctx)??'NOT_RUN';root.dataset.evidenceStatus=proof.numerical;
    for(const key of ['LF','N1','SC'] as const){panels[key].hidden=key!==selected;tabButtons.get(key)!.setAttribute('aria-pressed',String(key===selected));}
    if(evidence.parentElement!==panels[selected])panels[selected].append(evidence);if(shared.element.parentElement!==centers[selected])centers[selected].prepend(shared.element);shared.element.hidden=selected==='LF'&&ctx.resultView.source==='GA'&&lfMode.value==='DETAILS'||selected==='N1'&&method.value==='DC';if(!shared.element.hidden)shared.render();
    lf.element.hidden=selected!=='LF'||!shared.element.hidden;dc.element.hidden=selected!=='N1'||method.value!=='DC';
    if(lastOutage!==ctx.comparisonOutage){lastOutage=ctx.comparisonOutage;manual.open=!!lastOutage;}
    if(selected==='LF')lf.render();else{
      if(calculations.element.parentElement!==options[selected])options[selected].append(calculations.element);calculations.element.hidden=selected==='N1'&&method.value==='DC';if(!calculations.element.hidden)calculations.render();if(selected==='N1'&&method.value==='DC')dc.render();
      manualInfo.textContent=ctx.comparisonOutage?`${ctx.comparisonOutage.caseId} · ${ctx.n1AcResults.map(r=>r.status+' · '+r.reason).join('; ')}`:'Karşılaştırmadan bir kesinti seçin.';ac.disabled=screen.disabled=ctx.busy||!ctx.comparisonOutage;
    }
    const area=ctx.network?.sites.find(s=>s.areaId===ctx.filters.areaId)?.areaName??'Tüm YTM',scope=area+' · '+([...ctx.filters.voltages].join(' / ')||'tüm gerilimler');
    const pairs=[['Model',ctx.network?.name??'Model yüklenmedi'],['Senaryo',ctx.scenario.selected.name],['Kapsam',scope],['Yöntem',selected==='LF'?ctx.resultStore.analysisType:selected==='N1'?(proof.recordSource==='NOT_RUN'?method.value:proof.recordSource):ctx.scResult?.method??'NOT_CALCULATED'],['Sayısal',proof.numerical],['Hesaplanan',String(proof.numbers)],['Süre',formatEngineering(proof.elapsedMs,0)+' ms'],['İşlem',ctx.busy?'Çalışıyor':ctx.status]];
    context.replaceChildren(...pairs.map(([label,value])=>{const card=element('div','ga-analysis-context-card'),technical=label==='Yöntem'||label==='Sayısal';card.append(element('small','',label),element('strong','',technical?studyLabel(value):value));if(technical)card.dataset.code=value;card.title=technical?studyStatusHelp(value):value;return card;}));
    const explanations:Record<string,string>={ENGINE_CALCULATED:'Hesap motoru sayısal sonuç üretti. Kaynak, kontrol ve yöntem doğruluğu ayrı değerlendirilir.',SOURCE_VERIFIED:'Kaynak parametreleri bağımsız kanıtla doğrulandı.',METHOD_VERIFIED:'Yöntem bağımsız referans örneklerle doğrulandı.',NETWORK_APPROXIMATION:'Pozitif bileşen ağ yaklaşımı. IEC 60909 ve PF paritesi doğrulanmadı.',EXPLORATORY_ONLY:'Eksik kaynak, kontrol veya yöntem kanıtı nedeniyle yalnız tanısal kullanım.',BLOCKED:'Gerekli hesap veya yöntem kanıtı eksik. Sonuç sıfır kabul edilmez.',NOT_CALCULATED:'Bu analiz için sonuç hesaplanmadı.',STALE_RESULT:'Sonuç farklı model, senaryo veya ayarlara ait; güncel hesap olarak kullanılamaz.'};
    verdicts.replaceChildren(...[['Sayısal çözüm',proof.numerical],['Kaynak doğrulaması',proof.source],['Yöntem doğrulaması',proof.method],['PF karşılaştırması',proof.pf]].map(([label,state])=>{const row=element('div','ga-study-verdict');row.dataset.status=state;row.append(element('span','',label),element('strong','',studyLabel(state)));row.title=studyStatusHelp(state)+' '+explanations[state];return row;}));
    const counts=proof.runCoverage??proof.coverage;coverage.hidden=selected!=='N1'||!counts;coverage.textContent=counts?`${proof.runCoverage?'Hibrit çalışma':'Seçili vaka'} · DC taranan ${counts.DC_SCREENED??0} · AC denenen ${counts.AC_ATTEMPTED??0} · sayısal ${counts.AC_NUMERICALLY_SOLVED??0} · tam doğrulanan ${counts.AC_VERIFIED??0} · kapsam dışı ${counts.excludedCatalog??0}`:'';coverage.title=proof.recordSource+' · '+(proof.caseId??'çalışma kapsamı');
    residual.hidden=selected==='SC'||proof.residualMw===null;residual.textContent='Sayısal residual: '+(proof.residualMw===null?'—':proof.residualMw.toExponential(3))+' MW';residual.title='Nodal residual kaynak/kontrol doğruluğu veya PF paritesi anlamına gelmez.';
    log.textContent=JSON.stringify({...proof,liveStatus:ctx.status},null,2);log.title='Eksik kanıt başarı olarak gösterilmez.';
  }
  return {element:root,render};
}
