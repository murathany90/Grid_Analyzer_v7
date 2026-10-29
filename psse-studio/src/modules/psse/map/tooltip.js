/** One owner for all geographic hover cards. Avoid controls, selection, results and legend. */
export function createMapTooltip(stage,content){
  const element=document.createElement('aside');element.className='ga-map-hover';element.hidden=true;element.setAttribute('role','tooltip');stage.append(element);
  const abort=new AbortController();let target=null;
  const hide=()=>{target=null;element.hidden=true;};
  function move(event){
    const node=event.target instanceof Element?event.target.closest('[data-v12-title]'):null;
    if(!node||!stage.contains(node)||event.buttons){hide();return;}
    if(node!==target){target=node;const data=content(node);if(!data){hide();return;}element.replaceChildren();const title=document.createElement('strong');title.textContent=data.title;element.append(title);for(const text of data.lines){const span=document.createElement('span');span.textContent=text;element.append(span);}if(data.columns?.length&&data.rows?.length){const table=document.createElement('table'),head=document.createElement('tr');for(const label of data.columns){const th=document.createElement('th');th.textContent=label;head.append(th);}table.append(head);for(const values of data.rows){const row=document.createElement('tr');for(const value of values){const cell=document.createElement('td');cell.textContent=value;row.append(cell);}table.append(row);}element.append(table);}}
    element.hidden=false;const bounds=stage.getBoundingClientRect(),w=element.offsetWidth,h=element.offsetHeight,pad=8;
    const obstacles=[...stage.closest('.ga-psse-map').querySelectorAll('.ga-map-selection,.ga-psse-lightning,.ga-psse-diagram-legend,details[open],details[open]>.ga-map-menu-body')].filter(e=>!e.hidden).map(e=>e.getBoundingClientRect());
    const x=event.clientX-bounds.left,y=event.clientY-bounds.top,candidates=[[x+16,y+16],[x-w-16,y+16],[x+16,y-h-16],[x-w-16,y-h-16],[bounds.width-w-pad,pad],[pad,bounds.height-h-pad]];
    let placed=false;for(let [left,top]of candidates){left=Math.max(pad,Math.min(bounds.width-w-pad,left));top=Math.max(pad,Math.min(bounds.height-h-pad,top));const rect={left:left+bounds.left,top:top+bounds.top,right:left+bounds.left+w,bottom:top+bounds.top+h};if(obstacles.some(o=>rect.left<o.right+4&&rect.right>o.left-4&&rect.top<o.bottom+4&&rect.bottom>o.top-4))continue;element.style.left=left+'px';element.style.top=top+'px';placed=true;break;}element.hidden=!placed;
  }
  stage.addEventListener('pointermove',move,{signal:abort.signal});stage.addEventListener('pointerleave',hide,{signal:abort.signal});stage.addEventListener('pointerdown',hide,{signal:abort.signal});
  return {hide,dispose(){abort.abort();element.remove();}};
}
