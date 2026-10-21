import {button} from '../../ui/components/dom';

/** One scrollable layer, anchored inside the existing panel, without resizing the list. */
export function createStudyPopups(root:HTMLElement,enabled:()=>boolean){
  const entries=new Map<HTMLDetailsElement,HTMLElement>();
  const close=(except?:HTMLDetailsElement)=>{let closed=false;for(const d of entries.keys())if(d!==except&&d.open){d.open=false;closed=true;}return closed;};
  function fit(d:HTMLDetailsElement,body:HTMLElement){
    const panel=root.closest('.ga-lightning');if(!panel)return;
    const p=panel.getBoundingClientRect(),r=root.getBoundingClientRect(),s=d.querySelector('summary')!.getBoundingClientRect(),top=s.top<r.top+r.height/2?s.bottom+3:r.top+3,bottom=s.top<r.top+r.height/2?r.bottom-3:s.top-3;
    Object.assign(body.style,{position:'fixed',left:p.left+7+'px',top:top+'px',bottom:'auto',right:'auto',width:p.width-14+'px',maxHeight:Math.max(60,bottom-top)+'px'});
  }
  function register(d:HTMLDetailsElement,body:HTMLElement){
    entries.set(d,body);body.append(button('Kapat',()=>{d.open=false;d.querySelector<HTMLElement>('summary')?.focus();}));
    d.addEventListener('toggle',()=>{if(enabled()&&d.open){close(d);fit(d,body);}});
  }
  root.addEventListener('pointerdown',e=>{if(!enabled())return;const target=e.target as Node;for(const d of entries.keys())if(d.open&&!d.contains(target))d.open=false;});
  return {register,close:()=>enabled()&&close(),render:()=>{for(const [d,body] of entries){body.classList.toggle('ga-n1-popup',enabled());if(!enabled()){for(const key of ['position','left','top','bottom','right','width','max-height'])body.style.removeProperty(key);}else if(d.open)fit(d,body);}}};
}
