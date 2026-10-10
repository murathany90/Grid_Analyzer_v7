import type {AppContext,Feature} from '../../app/contracts';
import {element,button} from '../../ui/components/dom';
import {helpRegistry} from '../../help/registry';
export function createHelpView(ctx:AppContext):Feature{
  const root=element('section','ga-panel ga-help-view'),search=element('input'),section=element('select'),body=element('div');search.type='search';search.placeholder='Parametre, yöntem veya konu ara';search.setAttribute('aria-label','Yardımda ara');section.setAttribute('aria-label','Yardım bölümü');
  for(const key of ['',...new Set(helpRegistry.map(e=>e.section))]){const o=element('option','',key||'Tüm bölümler');o.value=key;section.append(o);}root.append(element('h2','','Yardım'),element('p','ga-muted','Model Yükle → kalite denetimi → Analizler → karşılaştırma. Ekrandaki ⓘ açıklamaları bu sözlüğü kullanır.'),search,section,body);search.oninput=section.onchange=()=>{ctx.helpId=null;render();};
  function render(){if(ctx.helpId){search.value='';section.value='';}const q=search.value.toLocaleLowerCase('tr-TR');body.replaceChildren();for(const e of helpRegistry.filter(e=>(!section.value||e.section===section.value)&&(!q||[e.title,e.shortText,e.fullText,...e.tags].join(' ').toLocaleLowerCase('tr-TR').includes(q)))){const card=element('details','ga-help-entry');card.dataset.helpEntry=e.id;card.open=ctx.helpId===e.id;card.append(element('summary','',e.title),element('p','',e.shortText),element('p','',e.fullText));if(e.methodCaveat)card.append(element('p','ga-notice',e.methodCaveat));card.append(button('İlgili ekranı aç',()=>ctx.setView(e.relatedScreen)));body.append(card);}if(ctx.helpId)body.querySelector<HTMLElement>(`[data-help-entry="${ctx.helpId}"]`)?.scrollIntoView({block:'nearest'});}
  return{element:root,render};
}
