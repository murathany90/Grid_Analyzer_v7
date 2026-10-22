import {studyFamilies,ytmStudyIsCurrent} from '../../analysis/ytm-study';
import {selectScMode} from '../../domain/results/sc-selection';
import type {AppContext} from '../../app/contracts';
import {element,button} from '../../ui/components/dom';
import {createCalculationActions} from '../comparison/calculation-actions';
import {syncMapCase} from '../../map/layer-policy';
import {scBatchProgress,cancelScBatch} from './sc-study-state';

/** Compact controls delegate to the existing scope, policy, assumption and worker actions. */
export function createStudyActions(ctx:AppContext,compact=false){
  const root=element('div','ga-study-actions'),mode=element('select'),advanced=element('details','ga-study-actions-options');
  const combined=button('Analiz sekmesini aç',()=>{ctx.setView('analysis:'+ctx.resultView.analysis);});combined.title='Aynı vaka / fault kimliği ile mevcut analiz sekmesini aç';root.append(combined);
  mode.setAttribute('aria-label','Harita N-1 yöntemi');mode.innerHTML='<option value="HYBRID">Hibrit DC → AC</option><option value="DC">DC P-only</option><option value="AC">Seçili Full AC</option>';
  const calculations=createCalculationActions(ctx,()=>ctx.resultView.analysis,()=>ctx.comparisonOutage,true);
  advanced.append(element('summary','','Kapsam / ayarlar'),calculations.element);
  const start=()=>{syncMapCase(ctx);const ytmId=ctx.filters.areaId||ctx.network?.sites.find(s=>s.areaId)?.areaId;if(ctx.runYtmStudy&&ytmId&&(ctx.resultView.analysis==='SC'||mode.value==='HYBRID')){void ctx.runYtmStudy({...ctx.studyOptions,ytmId,profile:ctx.studyOptions?.profile??'BALANCED',families:[ctx.resultView.analysis==='SC'?'SC':'N1']});return;}if(ctx.resultView.analysis==='N1'&&mode.value==='DC')calculations.screen();else if(ctx.resultView.analysis==='N1'&&mode.value==='AC')calculations.validate();else calculations.start();};
  const canResumeStudy=()=>!!(ctx.ytmStudy&&ctx.network&&ctx.studyResumeAvailable!==false&&studyFamilies(ctx.ytmStudy.options).includes(ctx.resultView.analysis==='SC'?'SC':'N1')&&ytmStudyIsCurrent(ctx.ytmStudy,ctx.network,ctx.scenario.current,ctx.analysisSettings.value,ctx.studyOptions));
  const run=button('Başlat',start),stop=button('Durdur',()=>{if(ctx.resultView.analysis==='SC')cancelScBatch(ctx);ctx.cancel();}),resume=button('Devam',()=>{if(ctx.ytmStudy){if(canResumeStudy()&&ctx.runYtmStudy)void ctx.runYtmStudy(ctx.ytmStudy.options,true);}else calculations.resume();}),results=button('Sonuçlar',()=>ctx.setView('analysis:'+ctx.resultView.analysis)),progress=element('span','ga-study-progress');root.append(run,stop,resume,results,progress,advanced);if(compact)calculations.element.prepend(mode);else root.prepend(mode);
  function prepareSettings(open=advanced.open){if(!compact)return;const family=ctx.resultView.analysis,n1=calculations.element.querySelector<HTMLElement>('[data-help-screen="analysis:N1"]');n1?.classList.toggle('ga-n1-flat-settings',family==='N1');if(family==='N1'&&open)for(const d of n1?.querySelectorAll('details')??[]){d.open=true;d.querySelector('summary')!.tabIndex=-1;}}
  advanced.querySelector('summary')!.addEventListener('click',()=>prepareSettings(!advanced.open));
  const fit=()=>{if(!compact||!advanced.open)return;const panel=root.closest('.ga-lightning')?.getBoundingClientRect();if(panel)calculations.element.style.maxHeight=Math.max(80,root.getBoundingClientRect().top-panel.top-110)+'px';};advanced.ontoggle=render;
  const scMode=element('select');scMode.setAttribute('aria-label','Harita SC MAX MIN');scMode.innerHTML='<option>MAX</option><option>MIN</option>';scMode.onchange=()=>{if(!selectScMode(ctx,scMode.value as 'MAX'|'MIN'))ctx.setMessage('Seçilen SC modu için güncel sonuç yok');ctx.notify();};root.prepend(scMode);
  function render(){scMode.hidden=ctx.resultView.analysis!=='SC';if(ctx.scResult)scMode.value=ctx.scResult.profile.calculateMode;const family=ctx.resultView.analysis;root.hidden=family==='LF';mode.hidden=family!=='N1';progress.hidden=family!=='SC';const p=family==='SC'?scBatchProgress(ctx):null;if(p){progress.textContent=compact?`${p.processed}/${p.targets}`:`${p.processed}/${p.targets} · GA ${p.calculated} · bloke ${p.blocked} · kalan ${p.remaining}`;progress.title=`Hedef ${p.targets} · işlenen ${p.processed} · başarılı ${p.calculated} · bloke ${p.blocked} · iptal ${p.cancelled} · kalan ${p.remaining} · çalışan batch ${p.batch}`;}run.textContent=family==='SC'?'Hesapla':'Başlat';run.setAttribute('aria-label','Harita '+family+' '+run.textContent);stop.setAttribute('aria-label','Harita '+family+' Durdur');resume.setAttribute('aria-label','Harita '+family+' Devam');run.disabled=ctx.busy||!ctx.network;stop.disabled=!ctx.busy;resume.disabled=ctx.busy||!ctx.network||(ctx.ytmStudy?!canResumeStudy():family==='N1'?!ctx.hybridResult:!p?.remaining);prepareSettings();calculations.render();fit();}
  return {element:root,render,start};
}
