import {element,button} from './dom';

export interface ColumnChoice {key:string;label:string;required?:boolean}
/** Column preferences belong to a class/profile, never to a model's source data. */
export function createColumnSelector(change:()=>void){
 const root=element('div','ga-column-tools'),profile=element('select'),menu=element('details','ga-column-menu'),body=element('div','ga-column-options');
 profile.setAttribute('aria-label','Mühendislik alan profili');menu.append(element('summary','','Kolonlar'),body);root.append(profile,menu);
 const preferences=new Map<string,{profile:string;keys:Set<string>}>();let context='',choices:readonly ColumnChoice[]=[],profiles:Record<string,readonly string[]>={};
 const state=()=>preferences.get(context)!;
 function draw(){const s=state();body.replaceChildren(...choices.map(c=>{const label=element('label','ga-check'),input=element('input');input.type='checkbox';input.checked=c.required||s.keys.has(c.key);input.disabled=!!c.required;input.setAttribute('aria-label','Sütun '+c.label);input.onchange=()=>{if(input.checked)s.keys.add(c.key);else s.keys.delete(c.key);change();};label.append(input,document.createTextNode(c.label));return label;}),button('Profil varsayılanları',()=>{s.keys=new Set(profiles[s.profile]);draw();change();}));profile.value=s.profile;}
 profile.onchange=()=>{const s=state();s.profile=profile.value;s.keys=new Set(profiles[s.profile]);draw();change();};
 return {element:root,set(key:string,columns:readonly ColumnChoice[],definitions:Record<string,readonly string[]>){const stamp=key+'|'+columns.map(c=>c.key).join('|');if(context===stamp)return;context=stamp;choices=columns;profiles=definitions;if(!preferences.has(context))preferences.set(context,{profile:Object.keys(profiles)[0],keys:new Set(Object.values(profiles)[0])});profile.replaceChildren(...Object.keys(profiles).map(p=>new Option(p,p)));draw();},visible<T extends ColumnChoice>(all:readonly T[]):T[]{return all.filter(c=>c.required||state().keys.has(c.key));}};
}

export function createRecordDialog(root:HTMLElement,label:string){
 const dialog=element('dialog','ga-record-dialog'),detail=element('section','ga-detail');dialog.setAttribute('aria-label',label);
 const close=button('Kapat',()=>dialog.close());dialog.append(close,detail);root.append(dialog);
 return{detail,show(){if(!dialog.open)dialog.showModal();},close(){if(dialog.open)dialog.close();},get open(){return dialog.open;}};
}
