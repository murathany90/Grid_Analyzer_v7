import type {AppContext} from '../../app/contracts';
import {element,button,escapeHtml as h} from './dom';
import {activeResultId,workspaceMapSelection} from '../../domain/results/workspace';
import {scenarioChanged} from '../../domain/scenario/overlay';
export function createScenarioWorkspace(ctx:AppContext,embedded=false){
  const root=element('div','ga-scenario-workspace'+(embedded?' ga-scenario-embedded':'')),select=element('select'),name=element('input'),compare=element('select'),log=element('details','ga-scenario-log'),events=element('ol'),state=element('small');
  select.setAttribute('aria-label','Aktif senaryo');compare.setAttribute('aria-label','Senaryo farkının referansı');name.setAttribute('aria-label','Senaryo adı');name.placeholder='Senaryo adı';
  select.dataset.helpId=name.dataset.helpId='map.scenario';compare.dataset.helpId='map.scenarioDelta';
  select.onchange=()=>void ctx.selectScenario(select.value);
  compare.onchange=()=>{ctx.resultStore.comparisonScenarioId=compare.value;ctx.resultStore.role='delta';ctx.resultStore.analysisType='powerFlow';ctx.analysisTab='LF';Object.assign(ctx.resultView,{analysis:'LF',source:'Senaryo−Baz',phase:'CHANGE',metric:'pFromMw'});ctx.benchmarkMap=workspaceMapSelection(ctx);ctx.notify();};
  const rename=button('Adlandır',()=>{ctx.scenario.rename(ctx.scenario.selectedId,name.value);ctx.notify();}),branch=button('Dallan',()=>ctx.branchScenario(name.value||undefined)),undo=button('Geri al',()=>ctx.undoScenario()),reset=button('Sıfırla',()=>ctx.resetScenario());
  const label=(text:string,control:HTMLElement)=>{const host=element('label','ga-field');host.append(element('span','',text),control);return host;};
  const nameRow=element('div','ga-scenario-name'),actions=element('div','ga-actions');nameRow.append(name,rename,branch);actions.append(undo,reset);
  const logSummary=element('summary','','Manevra günlüğü');logSummary.dataset.helpId='map.scenario';log.append(logSummary,events);
  const drawer=element('details','ga-scenario-drawer');drawer.append(element('summary','','Senaryolar'),nameRow,label('Karşılaştırma referansı',compare),actions,log);
  if(embedded)root.append(label('Aktif senaryo',select),state,nameRow,label('Karşılaştırma referansı',compare),actions,log);else root.append(select,state,drawer);
  let revision=-1,selectedId='',signature='';
  function render(){
    const current=ctx.scenario.selected,options=ctx.scenario.snapshots.map(s=>'<option value="'+h(s.id)+'">'+h(s.name)+' ('+h(s.id)+')</option>').join('');
    if(options!==signature){signature=options;select.innerHTML=compare.innerHTML=options;}
    select.value=current.id;compare.value=ctx.resultStore.comparisonScenarioId;root.dataset.scenarioId=current.id;root.dataset.resultId=activeResultId(ctx)||'NOT_RUN';
    state.textContent=current.id+' · '+ctx.resultView.analysis+' · '+(activeResultId(ctx)?'Kayıtlı çalışma':'NOT_RUN / STALE');
    if(revision!==ctx.scenario.revision||selectedId!==current.id){revision=ctx.scenario.revision;selectedId=current.id;events.replaceChildren();for(const e of current.events)events.append(element('li','',e.order+'. '+e.source+' · '+e.action+' · '+e.equipmentId+' · '+(JSON.stringify(e.before)??'kaynak')+' → '+(JSON.stringify(e.after)??'kaynak')+' · '+e.timestamp));}
    select.disabled=compare.disabled=rename.disabled=branch.disabled=ctx.busy||!ctx.network;
    undo.disabled=ctx.busy||!ctx.scenario.canUndo;reset.disabled=ctx.busy||!scenarioChanged(ctx.scenario.current);
    if(ctx.view==='map'&&!embedded)drawer.open=false;
  }
  return{element:root,render};
}
