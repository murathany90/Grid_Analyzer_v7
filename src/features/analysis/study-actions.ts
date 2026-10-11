import type {AppContext} from '../../app/contracts';
import {element,button} from '../../ui/components/dom';
import {createCalculationActions} from '../comparison/calculation-actions';
import {syncMapCase} from '../../map/layer-policy';

/** Compact controls delegate to the existing scope, policy, assumption and worker actions. */
export function createStudyActions(ctx:AppContext){
  const root=element('div','ga-study-actions'),mode=element('select'),advanced=element('details','ga-study-actions-options');
  mode.setAttribute('aria-label','Harita N-1 yöntemi');mode.innerHTML='<option value="HYBRID">Hibrit DC → AC</option><option value="DC">DC P-only</option><option value="AC">Seçili Full AC</option>';
  const calculations=createCalculationActions(ctx,()=>ctx.resultView.analysis,()=>ctx.comparisonOutage,true);
  advanced.append(element('summary','','Kapsam / ayarlar'),calculations.element);
  const start=()=>{syncMapCase(ctx);if(ctx.resultView.analysis==='N1'&&mode.value==='DC')calculations.screen();else if(ctx.resultView.analysis==='N1'&&mode.value==='AC'){if(ctx.comparisonOutage)void ctx.runN1AcValidation([ctx.comparisonOutage]);else ctx.setMessage('Full AC için bir kesinti seçin.');}else calculations.start();};
  const run=button('Başlat',start),stop=button('Durdur',()=>ctx.cancel()),resume=button('Devam',()=>calculations.resume()),results=button('Sonuçlar',()=>ctx.setView('analysis:'+ctx.resultView.analysis));root.append(mode,run,stop,resume,results,advanced);
  function render(){const family=ctx.resultView.analysis;root.hidden=family==='LF';mode.hidden=family!=='N1';run.textContent=family==='SC'?'Hesapla':'Başlat';run.setAttribute('aria-label','Harita '+family+' '+run.textContent);stop.setAttribute('aria-label','Harita '+family+' Durdur');resume.setAttribute('aria-label','Harita '+family+' Devam');run.disabled=ctx.busy||!ctx.network;stop.disabled=!ctx.busy;resume.disabled=ctx.busy||!ctx.network||family==='N1'&&!ctx.hybridResult;calculations.render();}
  return {element:root,render,start};
}
