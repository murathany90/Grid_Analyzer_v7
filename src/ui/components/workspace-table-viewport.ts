/** Fit the scroll surface below its actual toolbar, including browser/CSS zoom.
 * Source rows stay paged; this only adjusts the desktop viewport. */
export function workspaceTableViewport(table:HTMLElement){
 let queued=false;
 const fit=()=>{queued=false;if(!table.getClientRects().length)return;const zoom=Number.parseFloat(getComputedStyle(document.documentElement).zoom)||1,top=(table.getBoundingClientRect().top+scrollY)/zoom;table.style.maxHeight=Math.max(100,innerHeight/zoom-top-60)+'px';};
 const schedule=()=>{if(!queued){queued=true;requestAnimationFrame(fit);}};
 window.addEventListener('resize',schedule);new ResizeObserver(schedule).observe(table);return schedule;
}

