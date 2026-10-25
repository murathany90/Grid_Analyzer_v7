import {createNetworkModelWorkspace} from '../features/model/network-model-workspace';
import {isModelWorkspace} from '../features/model/workspace-state';
import {activeResultId} from '../domain/results/workspace';
import {createScenarioWorkspace} from '../ui/components/scenario-workspace';
import type {AppContext,Feature} from './contracts';
import {element,button,configureFormat} from '../ui/components/dom';
import {createAnalysisWorkspace} from '../features/analysis/analysis-workspace';
import {createSldView} from '../features/sld/sld-view';
import {createMapView} from '../map/map-view';
import {createSettingsView} from '../features/settings/settings-view';
import {createHelpView} from '../features/help/registry-view';
import {APP_VERSION} from '../version';
import {createBenchmarkComparisonView} from '../features/comparison/comparison-view';
import {decorateContextHelp} from '../help/context-help';
export function mountShell(ctx:AppContext,host:HTMLElement){
  document.title=`Grid Analyzer | Şebeke Analiz Sistemi v${APP_VERSION}`;
  const header=element('header','ga-app-head'),name=element('h1','','Grid Analyzer · Şebeke Analiz Sistemi v'+APP_VERSION),model=element('span','ga-head-model'),nav=element('nav','ga-nav'),main=element('main','ga-shell'),footer=element('footer','ga-footer'),status=element('span'),busy=element('span','ga-busy','İşleniyor…');header.append(name,model);footer.append(status,busy);status.setAttribute('role','status');status.setAttribute('aria-live','polite');host.append(header,nav,main,footer);
  const workspace=createScenarioWorkspace(ctx);main.append(workspace.element);
  const definitions:[string,string,(ctx:AppContext)=>Feature][]=[['model','Şebeke Modeli',createNetworkModelWorkspace],['map','Harita',createMapView],['sld','Tek Hat Şeması',createSldView],['analysis','Analizler',createAnalysisWorkspace],['comparison','Karşılaştırma',createBenchmarkComparisonView],['help','Yardım',createHelpView],['settings','Ayarlar',createSettingsView]];
  const features=new Map<string,Feature>();for(const[key,label,create]of definitions){const b=button(label,()=>ctx.setView(key));b.dataset.view=key;nav.append(b);try{const feature=create(ctx);feature.element.dataset.view=key;feature.element.hidden=true;features.set(key,feature);main.append(feature.element);}catch(error){const fallback=element('section','ga-notice',`${label} görünümü hazırlanamadı.`);main.append(fallback);console.error(error);}}
  let lastView='';
  const activeView=()=>isModelWorkspace(ctx.view)?'model':ctx.view;
  function render(){workspace.element.hidden=!ctx.network||!['sld','analysis','operating'].includes(ctx.view);workspace.render();main.dataset.activeView=ctx.view;configureFormat(ctx.settings.value.precision);document.body.classList.toggle('ga-light',ctx.settings.value.theme==='light');model.textContent=ctx.psseInspection?`${ctx.psseInspection.source.name} · PSS/E ${ctx.psseInspection.completeness} · analizler BLOCKED`:ctx.network?`${ctx.network.name} · ${ctx.network.sites.length.toLocaleString('tr-TR')} TM`:'';status.textContent=ctx.status;busy.hidden=!ctx.busy;nav.querySelectorAll<HTMLButtonElement>('button').forEach(b=>b.setAttribute('aria-current',b.dataset.view===activeView()?'page':'false'));
    footer.hidden=ctx.view==='map';for(const[key,feature]of features){feature.element.dataset.scenarioId=ctx.scenario.selectedId;feature.element.dataset.resultId=activeResultId(ctx)??'NOT_RUN';feature.element.hidden=key!==activeView();if(key===activeView()){try{feature.render();decorateContextHelp(feature.element,ctx);}catch(error){console.error(error);status.textContent='Bu görünüm yenilenemedi; diğer sekmeler kullanılabilir.';}}else if(lastView===key&&(key==='map'||key==='model'))feature.render();}lastView=activeView();status.title=ctx.status;
  }
  nav.querySelectorAll<HTMLButtonElement>('button').forEach(b=>b.dataset.helpId='app.navigation');decorateContextHelp(nav,ctx);decorateContextHelp(workspace.element,ctx);
  const observer=new MutationObserver(()=>{const active=features.get(activeView());if(active)decorateContextHelp(active.element,ctx);});observer.observe(main,{childList:true,subtree:true});ctx.subscribe(render);render();
}
