import {createPlatform} from '../../core/platform.js';
import {createHostAdapter} from '../../core/host-adapter.js';
import {createRuntime as createEngine} from './engine-runtime.js';
import {createRuntime as createStudio} from './studio-runtime.js';
import {PsseController} from './controller.js';
import {createSettings} from './ui/settings.js';
import {createScenarioWorkspace} from './ui/scenario-workspace.js';
import {createSolveView} from './analysis/solve-view.js';
import reference from './ui/reference.gz.b64';
/** Host boundary: never accepts a DGS model or mutates its stores. */
export function mount(container,host={}) {
  if(!(container instanceof HTMLElement))throw Error('PSSE_MOUNT_CONTAINER_REQUIRED');
  host=createHostAdapter(host);
  const root=document.createElement('div');root.className='psse-module v8-mode-custom';container.append(root);
  root.innerHTML='<header id="v8-head"><div id="v8-brand"><span id="v8-logo">GA</span><strong>Grid Analyzer · PSS/E Studio</strong></div><span id="v8-mode">PSS/E MODU</span><span id="v8-model-file">Model yüklenmedi</span><span id="v8-model-counts"></span><button id="v8-upload" class="v8-primary">＋ Model yükle</button><button id="v8-export">GA JSON</button></header><nav id="v8-nav"></nav><nav id="v8-subnav"></nav><div class="psse-scenario-host"></div><div id="pse-root"></div><div id="app"><main class="ga-shell"></main></div><footer class="psse-status" role="status"></footer>';
  const ref=document.createElement('script');ref.type='application/octet-stream';ref.id='pse-reference';ref.textContent=reference;root.append(ref);
  const platform=createPlatform(root,host),engine=createEngine(platform),controller=new PsseController(engine,host);platform.window.__GA_BRIDGE__=controller;
  const studio=createStudio(platform),features=new Map(),main=root.querySelector('.ga-shell'),old=root.querySelector('#pse-root'),sub=root.querySelector('#v8-subnav'),nav=root.querySelector('#v8-nav'),scenario=createScenarioWorkspace(controller);
  root.querySelector('.psse-scenario-host').append(scenario.element);
  const factories={map:engine.py,sld:engine.wy,analysis:()=>createSolveView(controller,studio),settings:()=>createSettings(controller),help:()=>{const feature=engine.Ey(controller),license=document.createElement('details');license.innerHTML='<summary>Harita kaynak ve lisansı</summary><p>Türkiye ülke/il sınırları: geoBoundaries gbOpen, OpenStreetMap katkıcıları, snapshot 9469f09. Basitleştirilmiş türev coğrafi veri: CC BY-SA 2.0. Uygulama kodundan ayrı lisanslanır.</p><a href="https://creativecommons.org/licenses/by-sa/2.0/" target="_blank" rel="noopener">CC BY-SA 2.0</a>';feature.element.append(license);return feature;}};
  const routes=[['model','Şebeke Modeli'],['map','Harita'],['sld','Tek Hat Şeması'],['analysis','Analizler'],['compare','Karşılaştırma'],['settings','Ayarlar'],['help','Yardım']];
  let route='model',section='nd',raf=0,disposed=false,lastKey='',lastFile='';
  for(const[key,label]of routes){const b=document.createElement('button');b.textContent=label;b.dataset.route=key;b.onclick=()=>navigate(key);nav.append(b);}
  function navigate(next,child){
    if(!routes.some(([key])=>key===next))return;
    route=next;section=child??(next==='model'?'nd':next==='analysis'?'solve':next==='compare'?'gares':next);controller.setView(section==='engine'?'analysis':next);render();host.onNavigate?.(next);
  }
  const sections={model:[['nd','Network Data'],['nr','Network Results'],['others','Network Others']]};
  function render(){
    if(disposed)return;
    const start=performance.now(),custom=['model','compare'].includes(route);root.dataset.route=route;root.querySelector('.psse-scenario-host').hidden=route!=='analysis';
    old.hidden=!custom;root.querySelector('#app').hidden=custom;root.classList.toggle('v8-mode-custom',custom);root.classList.toggle('v8-mode-native',!custom);root.classList.toggle('ga-light',controller.settings.value.theme==='light');
    nav.querySelectorAll('button').forEach(b=>b.setAttribute('aria-current',String(b.dataset.route===route?'page':'false')));
    const key=route+'|'+section,changed=key!==lastKey;if(changed){
      lastKey=key;sub.replaceChildren();for(const[id,label]of sections[route]??[]){const b=document.createElement('button');b.textContent=label;b.dataset.sub=id;b.setAttribute('aria-pressed',String(section===id));b.onclick=()=>navigate(route,id);sub.append(b);}sub.hidden=!sub.children.length;
      if(custom){studio.main=section;studio.tabIndex=0;studio.page=0;studio.renderNavigation();}
    }
    for(const[key,feature]of features)feature.element.hidden=key!==route;
    if(!custom){
      if(!features.has(route)){const feature=factories[route](controller);features.set(route,feature);main.append(feature.element);}
      const feature=features.get(route);feature.element.hidden=false;if(changed||!['map','sld'].includes(route))feature.render();
    }
    const source=controller.psseInspection?.source;root.querySelector('#v8-model-file').textContent=source?.name??'Model yüklenmedi';root.querySelector('#v8-model-file').title=source?.sha256??'';
    if(lastFile!==source?.sha256){lastFile=source?.sha256;const counts={};for(const eq of controller.psseInspection?.equipment??[])counts[eq.kind]=(counts[eq.kind]??0)+1;root.querySelector('#v8-model-counts').textContent=source?`${counts.substation??0} TM · ${counts.bus??0} bara · ${counts.line??0} hat · ${counts.transformer??0} trafo`:'';}
    root.querySelector('.psse-status').textContent=controller.status;scenario.render();
    controller.metrics.push({action:'render',route,ms:performance.now()-start});if(controller.metrics.length>1000)controller.metrics.splice(0,500);
  }
  const unsubscribe=controller.subscribe(()=>{if(raf)return;raf=platform.window.requestAnimationFrame(()=>{raf=0;render();});});
  root.querySelector('#v8-upload').onclick=()=>old.querySelector('#pse-file').click();root.querySelector('#v8-export').onclick=()=>old.querySelector('#ga-json-download').click();
  const setView=controller.setView.bind(controller);controller.setView=view=>{setView(view);if(routes.some(([r])=>r===view)&&route!==view)navigate(view);};
  navigate('model');
  return {version:'13.0.0',mode:'PSSE',controller,navigate,loadFiles:files=>controller.loadFiles(files),calculate:(method,options)=>controller.runPsseCalculation(method,options),getState:()=>controller.snapshot(),getMetrics:()=>structuredClone(controller.metrics),
    unmount(){if(disposed)return;disposed=true;studio.xlsxJob?.cancel();unsubscribe();for(const feature of features.values())feature.dispose?.();features.clear();scenario.dispose();studio.reference=studio.corpus=studio.ga=null;studio.currentRows=[];studio.otherCache.clear();main.replaceChildren();old.replaceChildren();controller.dispose();platform.dispose();root.replaceChildren();root.remove();}};
}
