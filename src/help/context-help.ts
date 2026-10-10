import type {AppContext} from '../app/contracts';
import {element} from '../ui/components/dom';
import {helpEntry,helpForField} from './registry';
export function decorateContextHelp(root:HTMLElement,ctx:AppContext){
  for(const field of root.querySelectorAll<HTMLElement>('input:not([type="hidden"]),select,textarea,button[data-help-label]')){
    if(field.closest('.ga-help-field')){field.closest<HTMLElement>('.ga-help-field')!.hidden=field.hidden;continue;}
    if(field.hidden||field.closest('.ga-context-help,tr')||field.classList.contains('ga-visually-hidden')||!field.parentElement)continue;
    const label=field.dataset.helpLabel||field.getAttribute('aria-label')||field.closest('label')?.firstChild?.textContent||field.getAttribute('placeholder')||'',view=field.closest<HTMLElement>('[data-view]')?.dataset.view??ctx.view,screen=field.closest<HTMLElement>('[data-help-screen]')?.dataset.helpScreen??(view==='analysis'?'analysis:'+(field.closest('#ga-analysis-SC')?'SC':field.closest('#ga-analysis-N1')?'N1':'LF'):view);
    const help=helpEntry(field.dataset.helpId||'')??helpForField(label,screen),details=element('span','ga-context-help'),summary=element('button','','ⓘ'),preview=element('span','ga-help-preview',help.shortText);summary.type='button';
    field.dataset.helpId=help.id;summary.setAttribute('aria-label',`Bilgi: ${help.title}`);preview.setAttribute('role','tooltip');preview.id='ga-help-'+crypto.randomUUID();summary.setAttribute('aria-describedby',preview.id);
    const show=()=>{preview.hidden=false;preview.style.display='block';const box=summary.getBoundingClientRect(),width=preview.getBoundingClientRect().width,height=preview.getBoundingClientRect().height;preview.style.left=Math.max(8,Math.min(box.left,innerWidth-width-8))+'px';preview.style.top=(box.bottom+height+8<innerHeight?box.bottom+4:Math.max(8,box.top-height-4))+'px';};
    const hide=()=>{preview.hidden=true;preview.style.display='none';};hide();summary.onmouseenter=show;summary.onfocus=show;summary.onmouseleave=()=>{if(document.activeElement!==summary)hide();};summary.onblur=hide;summary.onclick=e=>e.preventDefault();summary.onkeydown=e=>{if(e.key==='Escape'){hide();summary.blur();}};details.append(summary,preview);
    const labelElement=field.closest('label'),target=labelElement&&root.contains(labelElement)?labelElement:field,wrapper=element('span','ga-help-field');target.before(wrapper);wrapper.append(target,details);
  }
}
