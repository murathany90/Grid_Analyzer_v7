import type {AppContext} from '../app/contracts';
import {element} from '../ui/components/dom';
import {helpEntry,helpForField} from './registry';
export const HELP_HOVER_DELAY_MS=550;
const decorated=new WeakSet<HTMLElement>();
let preview:HTMLElement|undefined,target:HTMLElement|null=null,timer:ReturnType<typeof setTimeout>|undefined,keyboard=false;
function hide(){if(timer)clearTimeout(timer);timer=undefined;if(target){const ids=(target.getAttribute('aria-describedby')??'').split(' ').filter(id=>id&&id!==preview?.id);if(ids.length)target.setAttribute('aria-describedby',ids.join(' '));else target.removeAttribute('aria-describedby');}target=null;if(preview)preview.hidden=true;}
/** Only short label text is eligible; native controls keep their mouse/focus behavior. */
export function decorateContextHelp(root:HTMLElement,ctx:AppContext){
  for(const label of root.querySelectorAll<HTMLLabelElement>('label')){
    if(label.closest('tr,.ga-help-entry'))continue;const field=label.querySelector<HTMLElement>('input,select,textarea'),span=label.querySelector<HTMLElement>(':scope>span');
    if(span){if(!span.dataset.helpLabel){span.dataset.helpId=field?.dataset.helpId??helpForField(span.textContent??'',ctx.view).id;span.dataset.helpLabel=span.textContent??'';span.tabIndex=0;}}
    else for(const node of [...label.childNodes])if(node.nodeType===Node.TEXT_NODE&&node.textContent?.trim()){const text=element('span','ga-help-label',node.textContent);text.dataset.helpId=field?.dataset.helpId??helpForField(text.textContent??'',ctx.view).id;text.dataset.helpLabel=text.textContent??'';text.tabIndex=0;node.replaceWith(text);}
  }
  if(decorated.has(root))return;decorated.add(root);
  if(!preview){preview=element('span','ga-help-preview');preview.hidden=true;preview.setAttribute('role','tooltip');preview.id='ga-label-help';document.body.append(preview);document.addEventListener('pointerdown',()=>{keyboard=false;hide();});document.addEventListener('keydown',e=>{if(e.key==='Tab')keyboard=true;if(e.key==='Escape')hide();});document.addEventListener('scroll',hide,true);window.addEventListener('resize',hide);document.addEventListener('visibilitychange',hide);}
  const label=(node:EventTarget|null)=>node instanceof Element?node.closest<HTMLElement>('[data-help-label][data-help-id]'):null;
  const show=(field:HTMLElement)=>{
    if(!field.isConnected||field.closest('[hidden]'))return hide();hide();target=field;const entry=helpEntry(field.dataset.helpId??'');if(!entry)return;
    preview!.textContent=entry.shortText;preview!.dataset.helpId=entry.id;preview!.hidden=false;field.setAttribute('aria-describedby',((field.getAttribute('aria-describedby')??'')+' '+preview!.id).trim());
    const box=field.getBoundingClientRect(),tip=preview!.getBoundingClientRect();preview!.style.left=Math.max(8,Math.min(box.left,innerWidth-tip.width-8))+'px';preview!.style.top=Math.max(8,Math.min(box.bottom+tip.height+8<innerHeight?box.bottom+5:box.top-tip.height-5,innerHeight-tip.height-8))+'px';
  };
  root.addEventListener('pointerover',e=>{const field=label(e.target);if(!field||!root.contains(field)||field===label(e.relatedTarget))return;hide();timer=setTimeout(()=>show(field),HELP_HOVER_DELAY_MS);});
  root.addEventListener('pointerout',e=>{if(label(e.target)!==label(e.relatedTarget))hide();});
  root.addEventListener('focusin',e=>{const field=label(e.target);if(keyboard&&field&&field===e.target)show(field);});root.addEventListener('focusout',hide);
}
