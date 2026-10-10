import type {AppContext} from '../app/contracts';
import {element,button} from '../ui/components/dom';
import {helpForField} from './registry';
export function decorateContextHelp(root:HTMLElement,ctx:AppContext){
  for(const field of root.querySelectorAll<HTMLElement>('input:not([type="hidden"]),select,textarea,button[data-help-label]')){
    if(field.dataset.helpId){const wrapper=field.closest<HTMLElement>('.ga-help-field');if(wrapper)wrapper.hidden=field.hidden;continue;}
    if(field.hidden||field.closest('.ga-context-help,tr')||field.classList.contains('ga-visually-hidden')||!field.parentElement)continue;
    const label=field.dataset.helpLabel||field.getAttribute('aria-label')||field.closest('label')?.firstChild?.textContent||field.getAttribute('placeholder')||'',view=field.closest<HTMLElement>('[data-view]')?.dataset.view??ctx.view,screen=field.closest<HTMLElement>('[data-help-screen]')?.dataset.helpScreen??(view==='analysis'?'analysis:'+(field.closest('#ga-analysis-SC')?'SC':field.closest('#ga-analysis-N1')?'N1':'LF'):view);
    const help=helpForField(label,screen),details=element('details','ga-context-help'),summary=element('summary','','ⓘ'),preview=element('span','ga-help-preview',help.shortText),body=element('div','ga-help-body');
    field.dataset.helpId=help.id;summary.setAttribute('aria-label',`Bilgi: ${help.title}`);summary.title=help.shortText;preview.setAttribute('role','tooltip');preview.id='ga-help-'+crypto.randomUUID();summary.setAttribute('aria-describedby',preview.id);
    body.append(element('strong','',help.title),element('p','',help.shortText),element('p','ga-muted',help.methodCaveat||''),button('Yardımda aç',()=>{ctx.helpId=help.id;ctx.setView('help');}));details.append(summary,preview,body);details.onkeydown=e=>{if(e.key==='Escape'){details.open=false;summary.focus();}};
    const labelElement=field.closest('label'),target=labelElement&&root.contains(labelElement)?labelElement:field,wrapper=element('span','ga-help-field');target.before(wrapper);wrapper.append(target,details);
  }
}
