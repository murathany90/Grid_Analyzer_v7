import type {AppContext} from '../app/contracts';
import {element} from '../ui/components/dom';
import {helpEntry,helpForField} from './registry';
const decorated=new WeakSet<HTMLElement>();
/** One floating preview per view; controls and labels keep their original layout/actions. */
export function decorateContextHelp(root:HTMLElement,ctx:AppContext){
  if(decorated.has(root))return;
  decorated.add(root);
  const preview=element('span','ga-help-preview');preview.hidden=true;
  preview.setAttribute('role','tooltip');preview.id='ga-help-'+crypto.randomUUID();root.append(preview);
  let target:HTMLElement|null=null,suppressHover=false;
  const hide=()=>{if(target){const ids=(target.getAttribute('aria-describedby')??'').split(' ').filter(id=>id&&id!==preview.id);if(ids.length)target.setAttribute('aria-describedby',ids.join(' '));else target.removeAttribute('aria-describedby');}target=null;preview.hidden=true;};
  const control=(node:EventTarget|null)=>{
    if(!(node instanceof Element))return null;
    const closest=node.closest<HTMLElement>('input:not([type="hidden"]),select,textarea,button,summary,[data-help-id],label');
    if(!closest||!root.contains(closest)||closest.closest('tr,.ga-help-entry')||closest===preview)return null;
    return closest.matches('label')?closest.querySelector<HTMLElement>('input,select,textarea')??closest:closest;
  };
  const show=(field:HTMLElement|null)=>{
    if(!field||field.hidden||field.closest('[hidden]'))return hide();
    hide();target=field;
    const label=field.dataset.helpLabel||field.getAttribute('aria-label')||field.closest('label')?.textContent||field.getAttribute('placeholder')||field.textContent||'',view=field.closest<HTMLElement>('[data-view]')?.dataset.view??ctx.view,screen=field.closest<HTMLElement>('[data-help-screen]')?.dataset.helpScreen??(view==='analysis'?'analysis:'+(field.closest('#ga-analysis-SC')?'SC':field.closest('#ga-analysis-N1')?'N1':'LF'):view);
    const help=helpEntry(field.dataset.helpId||'')??helpForField(label,screen);field.removeAttribute('title');
    preview.textContent=help.shortText+(field.dataset.helpDetail?' '+field.dataset.helpDetail:'');preview.dataset.helpId=help.id;
    field.setAttribute('aria-describedby',((field.getAttribute('aria-describedby')??'')+' '+preview.id).trim());preview.hidden=false;
    const box=(field.closest('label')??field).getBoundingClientRect(),tip=preview.getBoundingClientRect();
    preview.style.left=Math.max(8,Math.min(box.left,innerWidth-tip.width-8))+'px';
    preview.style.top=Math.max(8,Math.min(box.bottom+tip.height+8<innerHeight?box.bottom+4:box.top-tip.height-4,innerHeight-tip.height-8))+'px';
  };
  root.addEventListener('pointerover',e=>{const field=control(e.target);if(!suppressHover&&field!==target)show(field);});
  root.addEventListener('pointermove',e=>{if(suppressHover&&(e.movementX||e.movementY)){suppressHover=false;show(control(e.target));}});
  root.addEventListener('pointerout',e=>{if(control(e.relatedTarget)!==target)hide();});
  root.addEventListener('focusin',e=>{if(!suppressHover)show(control(e.target));});
  root.addEventListener('focusout',hide);
  root.addEventListener('pointerdown',()=>{suppressHover=false;hide();});
  root.addEventListener('keydown',e=>{if(e.key==='Escape'){suppressHover=true;hide();}else if(e.key==='Tab')suppressHover=false;});
  root.addEventListener('scroll',hide,true);
  window.addEventListener('resize',hide);
  document.addEventListener('pointerdown',e=>{if(!root.contains(e.target as Node))hide();});
  document.addEventListener('visibilitychange',hide);
}
