import type {AppContext} from '../../app/contracts';
import {element,button} from '../../ui/components/dom';
import {createCalculationActions} from '../comparison/calculation-actions';
import {syncMapCase} from '../../map/layer-policy';
import {scBatchProgress,cancelScBatch} from './sc-study-state';

/** Compact controls delegate to the existing scope, policy, assumption and worker actions. */
export function createStudyActions(ctx:AppContext,compact=false){
  const root=element('div','ga-study-actions'),mode=element('select'),advanced=element('details','ga-study-actions-options');
  mode.setAttribute('aria-label','Harita N-1 yöntemi');mode.innerHTML='<option value="HYBRID">Hibrit DC → AC</option><option value="DC">DC P-only</option><option value="AC">Seçili Full AC</option>';
  const calculations=createCalculationActions(ctx,()=>ctx.resultView.analysis,()=>ctx.comparisonOutage,true);
  advanced.append(element('summary','','Kapsam / ayarlar'),calculations.element);
  const start=()=>{syncMapCase(ctx);if(ctx.resultView.analysis==='N1'&&mode.value==='DC')calculations.screen();else if(ctx.resultView.analysis==='N1'&&mode.value==='AC')calculations.validate();else calculations.start();};
  const run=button('Başlat',start),stop=button('Durdur',()=>{if(ctx.resultView.analysis==='SC')cancelScBatch(ctx);ctx.cancel();}),resume=button('Devam',()=>calculations.resume()),results=button('Sonuçlar',()=>ctx.setView('analysis:'+ctx.resultView.analysis)),progress=element('span','ga-study-progress');root.append(run,stop,resume,results,progress,advanced);if(compact)calculations.element.prepend(mode);else root.prepend(mode);
  function prepareSettings(open=advanced.open){if(!compact)return;const family=ctx.resultView.analysis,n1=calculations.element.querySelector<HTMLElement>('[data-help-screen="analysis:N1"]');n1?.classList.toggle('ga-n1-flat-settings',family==='N1');if(family==='N1'&&open)for(const d of n1?.querySelectorAll('details')??[]){d.open=true;d.querySelector('summary')!.tabIndex=-1;}}
  advanced.querySelector('summary')!.addEventListener('click',()=>prepareSettings(!advanced.open));
  const fit=()=>{if(!compact||!advanced.open)return;const panel=root.closest('.ga-lightning')?.getBoundingClientRect();if(panel)calculations.element.style.maxHeight=Math.max(80,root.getBoundingClientRect().top-panel.top-110)+'px';};advanced.ontoggle=render;
  function render(){const family=ctx.resultView.analysis;root.hidden=family==='LF';mode.hidden=family!=='N1';progress.hidden=family!=='SC';const p=family==='SC'?scBatchProgress(ctx):null;if(p){progress.textContent=compact?`${p.processed}/${p.targets}`:`${p.processed}/${p.targets} · GA ${p.calculated} · bloke ${p.blocked} · kalan ${p.remaining}`;progress.title=`Hedef ${p.targets} · işlenen ${p.processed} · başarılı ${p.calculated} · bloke ${p.blocked} · iptal ${p.cancelled} · kalan ${p.remaining} · çalışan batch ${p.batch}`;}run.textContent=family==='SC'?'Hesapla':'Başlat';run.setAttribute('aria-label','Harita '+family+' '+run.textContent);stop.setAttribute('aria-label','Harita '+family+' Durdur');resume.setAttribute('aria-label','Harita '+family+' Devam');run.disabled=ctx.busy||!ctx.network;stop.disabled=!ctx.busy;resume.disabled=ctx.busy||!ctx.network||family==='N1'&&!ctx.hybridResult||family==='SC'&&!p?.remaining;prepareSettings();calculations.render();fit();}
  return {element:root,render,start};
}
