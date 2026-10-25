/** Layout geometry uses viewport coordinates throughout. offsetWidth/DOMRect
 * supplies the actual CSS scale; browser zoom must never be applied twice. */
export function workspaceViewportHeight(height:number,top:number,scale:number,reserved:number){
 const zoom=Number.isFinite(scale)&&scale>0?scale:1;
 return Math.max(80,Math.floor((height-Math.max(0,top)-Math.max(0,reserved))/zoom));
}
export function workspaceTableViewport(surface:HTMLElement){
 let queued=false;
 const fit=()=>{queued=false;if(!surface.getClientRects().length)return;const rect=surface.getBoundingClientRect(),scale=surface.offsetWidth?rect.width/surface.offsetWidth:1,pager=surface.parentElement?.querySelector<HTMLElement>('.ga-pager'),footer=document.querySelector<HTMLElement>('.ga-footer'),shell=surface.closest<HTMLElement>('.ga-shell'),panel=surface.closest<HTMLElement>('.ga-feature');
  const padding=(e:HTMLElement|null|undefined)=>e?Number.parseFloat(getComputedStyle(e).paddingBottom)||0:0;
  const reserve=(pager?.getBoundingClientRect().height??0)+(footer&&!footer.hidden?footer.getBoundingClientRect().height:0)+(padding(panel)+padding(shell)+8)*scale;
  const height=workspaceViewportHeight(window.visualViewport?.height??innerHeight,rect.top,scale,reserve),next=height+'px';if(surface.style.maxHeight!==next)surface.style.maxHeight=next;
  const table=surface.querySelector<HTMLTableElement>('table');if(!table)return;
  for(const cell of table.querySelectorAll<HTMLElement>('.ga-pinned-identity')){cell.classList.remove('ga-pinned-identity');cell.style.left='';}
  const pinned=['hierarchy.area','area','hierarchy.site','site','equipment','name','FID','fid'];let left=0;
  for(const head of table.querySelectorAll<HTMLElement>('thead th')){if(!pinned.includes(head.dataset.column??''))continue;const index=(head as HTMLTableCellElement).cellIndex,width=head.getBoundingClientRect().width/scale;if(left+width>surface.clientWidth*.7)continue;
   for(const row of table.rows){const cell=row.cells[index];if(cell){cell.classList.add('ga-pinned-identity');cell.style.left=left+'px';}}left+=width;
  }
 };
 const schedule=()=>{if(!queued){queued=true;requestAnimationFrame(fit);}};
 window.addEventListener('resize',schedule);window.addEventListener('scroll',schedule,{passive:true});window.visualViewport?.addEventListener('resize',schedule);
 const observer=new ResizeObserver(schedule);observer.observe(surface);const panel=surface.closest('.ga-feature');if(panel)observer.observe(panel);return schedule;
}
