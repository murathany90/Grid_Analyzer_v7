import {element} from './dom';
export interface HeaderSort {key:string;descending:boolean;change:(key:string)=>void}
export function sortableHeader(label:string,key:string,state:HeaderSort){
 const th=element('th'),active=state.key===key,button=element('button','ga-column-sort',label),arrow=element('span','ga-sort-arrow',active?(state.descending?' ↓':' ↑'):'');
 th.dataset.column=key;th.setAttribute('aria-sort',active?(state.descending?'descending':'ascending'):'none');button.type='button';button.dataset.sortKey=key;button.setAttribute('aria-label',label+' sırala');button.append(arrow);button.onclick=()=>state.change(key);th.append(button);return th;
}
