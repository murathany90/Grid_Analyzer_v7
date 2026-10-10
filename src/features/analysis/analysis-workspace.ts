import {createWorkspaceResults} from './workspace-results';
import {activeResultId} from '../../domain/results/workspace';
import type {AppContext,Feature} from '../../app/contracts';
import {element,button} from '../../ui/components/dom';
import {createAnalysisView} from './analysis-view';
import {createQualityN1View} from '../quality-n1/quality-n1-view';
import {createModelView} from '../model/model-view';
import {createCalculationActions} from '../comparison/calculation-actions';
import {downloadText} from '../../ui/components/dom';

export function createModelLanding(ctx:AppContext):Feature{
  const model=createModelView(ctx),quality=createQualityN1View(ctx,'quality');model.element.append(quality.element);
  return {element:model.element,render(){model.render();quality.render();}};
}

/** Views live for the whole session: changing tabs never disposes workers or controls. */
export function createAnalysisWorkspace(ctx:AppContext):Feature{
  const root=element('section','ga-analysis-workspace'),tabs=element('nav','ga-analysis-tabs'),lf=createAnalysisView(ctx),dc=createQualityN1View(ctx,'n1'),n1=element('section'),sc=element('section'),method=element('select');
  const panels={LF:lf.element,N1:n1,SC:sc},tabButtons=new Map<string,HTMLButtonElement>();
  tabs.setAttribute('aria-label','Analiz türü');
  for(const [key,label] of [['LF','Yük Akışı Analizi'],['N1','Kısıt Analizi (N-1)'],['SC','Kısa Devre Analizi']] as const){const b=button(label,()=>{ctx.analysisTab=key;ctx.resultView.analysis=key;ctx.notify();});b.setAttribute('aria-controls','ga-analysis-'+key);tabButtons.set(key,b);tabs.append(b);panels[key].id='ga-analysis-'+key;}
  method.setAttribute('aria-label','N-1 hesap yöntemi');method.innerHTML='<option value="DC">DC tarama</option><option value="HYBRID">Hibrit DC → Full AC</option>';
  const calculations=createCalculationActions(ctx,()=>ctx.analysisTab,()=>ctx.comparisonOutage),manual=element('details'),manualInfo=element('p');
  const ac=button('Seçili vaka: GA Full AC doğrula',()=>{if(ctx.comparisonOutage)void ctx.runN1AcValidation([ctx.comparisonOutage]);}),screen=button('Seçili vaka: GA DC screening',()=>{const o=ctx.comparisonOutage;if(!o)return;const e=(o.sourceClass==='ElmLne'?ctx.network?.lines:ctx.network?.transformers)?.find(e=>e.sourceId===o.fid);if(e)void ctx.runN1Screen({candidateTypes:[o.sourceClass],selectedCandidateIds:[`${o.sourceClass}:${e.id}`],analysisScope:'scenario'});});
  manual.append(element('summary','','Referanstan seçilen tek vaka'),manualInfo,screen,ac,button('Seçili AC vaka JSON',()=>downloadText(JSON.stringify(ctx.n1AcResults,null,2),'GA_N1_AC.local.json','application/json')),button('Vaka ayrıntıları / karşılaştırma',()=>ctx.setView('comparison')));
  const shared=createWorkspaceResults(ctx);root.append(shared.element);
  let lastOutage=ctx.comparisonOutage;
  n1.append(method,dc.element,manual);root.append(tabs,lf.element,n1,sc);method.onchange=()=>render();
  function render(){root.dataset.scenarioId=ctx.scenario.selectedId;root.dataset.resultId=activeResultId(ctx)??'NOT_RUN';shared.element.hidden=ctx.analysisTab==='LF';if(!shared.element.hidden)shared.render();if(lastOutage!==ctx.comparisonOutage){lastOutage=ctx.comparisonOutage;manual.open=!!lastOutage;}const selected=ctx.analysisTab??'LF';for(const key of ['LF','N1','SC'] as const){panels[key].hidden=key!==selected;tabButtons.get(key)!.setAttribute('aria-pressed',String(key===selected));}
    if(selected==='LF')lf.render();else{const target=selected==='SC'?sc:n1;if(calculations.element.parentElement!==target)target.append(calculations.element);calculations.element.hidden=selected==='N1'&&method.value==='DC';if(selected==='SC'||method.value==='HYBRID')calculations.render();dc.element.hidden=method.value!=='DC';if(selected==='N1'&&method.value==='DC')dc.render();manualInfo.textContent=ctx.comparisonOutage?`${ctx.comparisonOutage.caseId} · ${ctx.comparisonOutage.sourceClass}:${ctx.comparisonOutage.fid} · ${ctx.n1AcResults.map(r=>r.status+' · '+r.reason).join('; ')}`:'Karşılaştırma → N-1 ham vaka satırını seçin. AC doğrulama PF paritesi değildir.';ac.disabled=screen.disabled=ctx.busy||!ctx.comparisonOutage;}
  }
  return {element:root,render};
}
