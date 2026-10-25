import {element,button} from '../../ui/components/dom';

/** One native dialog, Escape and focus return. No nested scrolling surface. */
export function analysisDialog(title:string){
 const elementDialog=element('dialog','ga-analysis-dialog'),header=element('header'),body=element('div','ga-analysis-dialog-body');let opener:HTMLElement|null=null;
 const close=()=>elementDialog.close(),closeButton=button('×',close,title+' kapat');header.append(element('h2','',title),closeButton);elementDialog.setAttribute('aria-label',title);elementDialog.append(header,body);
 elementDialog.addEventListener('close',()=>{if(opener?.isConnected)opener.focus();});
 elementDialog.addEventListener('keydown',e=>{if(e.key==='Escape')e.stopPropagation();});
 const open=()=>{const zoom=Number(getComputedStyle(document.documentElement).zoom)||1,limit=Math.max(180,innerHeight/zoom-40);elementDialog.style.maxHeight=limit+'px';elementDialog.style.maxWidth=Math.max(240,innerWidth/zoom-32)+'px';body.style.maxHeight=(limit-60)+'px';opener=document.activeElement instanceof HTMLElement?document.activeElement:null;for(const d of document.querySelectorAll<HTMLDialogElement>('.ga-analysis-dialog[open]'))if(d!==elementDialog)d.close();elementDialog.showModal();closeButton.focus();};
 return {element:elementDialog,body,open,close};
}
