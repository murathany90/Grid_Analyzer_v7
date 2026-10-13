import assert from 'node:assert/strict';

/** Expected edges/order come from a separately supplied source circuit, never
 * renderer contact metadata or the layout's output. Inspect actual SVG geometry. */
export async function verifySeriesSvg(page,golden){
 const proof=await page.locator('.ga-sld-svg').evaluate((root,gold)=>{
  const errors=[],rows=[],inverse=root.getScreenCTM().inverse(),world=(e,x,y)=>new DOMPoint(x,y).matrixTransform(inverse.multiply(e.getScreenCTM())),coords=e=>{const n=e.getAttribute('d').match(/-?\d+(?:\.\d+)?(?:e[-+]?\d+)?/gi).map(Number),p=[];for(let i=0;i<n.length;i+=2){const q=world(e,n[i],n[i+1]);p.push([q.x,q.y]);}return p;},point=e=>world(e,Number(e.getAttribute('cx')),Number(e.getAttribute('cy')));
  const node=id=>[...root.querySelectorAll('[data-port]')].find(g=>g.dataset.port===id),term=id=>{const g=node(id);if(!g)return null;const c=g.querySelector('circle');if(c){const p=point(c);return [p.x,p.y];}return null;};
  for(const f of gold.feeders){
   const centers=[];
   for(const edge of [...f.main,...f.branches]){
    const all=[...root.querySelectorAll('[data-physical-switch]')].filter(g=>g.dataset.physicalSwitch===edge.sourceClass+'|'+edge.id),g=all[0];if(all.length!==1){errors.push(edge.id+' identity');continue;}
    if(![edge.from,edge.to].every(id=>[g.dataset.from,g.dataset.to].includes(id)))errors.push(edge.id+' native endpoints');
    const glyph=g.querySelector('[data-device-glyph]'),contacts=[...glyph.querySelectorAll('[data-symbol-contact]')].map(point),center={x:(contacts[0].x+contacts[1].x)/2,y:(contacts[0].y+contacts[1].y)/2},paths=[...g.querySelectorAll('path[data-connection]')].map(p=>({terminal:p.dataset.nativeTerminal,p:coords(p)}));
    const kind={cbk:'breaker',dct:'isolator',sdc:'load-break-disconnector',swt:'load-switch'}[edge.usage]??'switch';if(g.dataset.deviceKind!==kind)errors.push(edge.id+' wrong DGS device kind');
    if(edge.unresolved){if(g.dataset.chainOrdering!=='SOURCE_ORDER_UNAVAILABLE'||paths.length)errors.push(edge.id+' invented cubicle sequence');rows.push({feeder:f.id,switch:edge.id,kind:g.dataset.semantic,native:[edge.from,edge.to],contacts:contacts.map(p=>[p.x,p.y]),state:g.dataset.state,status:'SOURCE_ORDER_UNAVAILABLE'});continue;}
    for(const t of [edge.from,edge.to]){const p=paths.find(p=>p.terminal===t)?.p;if(!p){errors.push(edge.id+' missing lead '+t);continue;}const atStart=t===g.dataset.from,end=p.at(atStart?-1:0),source=p.at(atStart?0:-1);if(!contacts.some(c=>Math.hypot(c.x-end[0],c.y-end[1])<.01))errors.push(edge.id+' detached fixed contact');const native=term(t);if(native&&Math.hypot(native[0]-source[0],native[1]-source[1])>.01)errors.push(edge.id+' detached native terminal');}
    if(f.main.some(e=>e.id===edge.id)){
     centers.push({...center,id:edge.id});
     const horizontal=gold.orientation==='horizontal';for(const path of paths){const bar=node(path.terminal)?.dataset.semantic==='busbar-section';if(bar&&gold.orientation!=='horizontal')continue;for(const p of path.p)if(Math.abs((horizontal?p[1]:p[0])-(horizontal?center.y:center.x))>.01)errors.push(edge.id+' false external bypass / off-axis conductor');}
    }
    const fixed=contacts.map(c=>[c.x,c.y]),open=g.dataset.state==='OPEN';
    if(open){const midpoint=[center.x,center.y],radius=5;for(const p of root.querySelectorAll('path[data-connection]')){const q=coords(p);for(let i=1;i<q.length;i++){const a=q[i-1],b=q[i],vertical=Math.abs(a[0]-b[0])<.01;if(vertical?Math.abs(a[0]-midpoint[0])<radius&&Math.max(a[1],b[1])>midpoint[1]-radius&&Math.min(a[1],b[1])<midpoint[1]+radius:Math.abs(a[1]-midpoint[1])<radius&&Math.max(a[0],b[0])>midpoint[0]-radius&&Math.min(a[0],b[0])<midpoint[0]+radius)errors.push(edge.id+' open gap crossed');}}
     if(g.querySelector('[data-conducting-bridge]'))errors.push(edge.id+' open bridge');
    }else if(g.dataset.state==='CLOSED'&&['cbk','dct','sdc'].includes(edge.usage)&&!g.querySelector('[data-conducting-bridge]'))errors.push(edge.id+' closed bridge absent');
    rows.push({feeder:f.id,switch:edge.id,kind:g.dataset.semantic,native:[edge.from,edge.to],contacts:fixed,state:g.dataset.state,status:'PASS'});
   }
   const horizontal=gold.orientation==='horizontal',axis=centers[0]?.[horizontal?'y':'x'];if(centers.some(c=>Math.abs(c[horizontal?'y':'x']-axis)>.01))errors.push(f.id+' serial devices have different axes');
   const values=centers.map(c=>c[horizontal?'x':'y']),d=values.length>1?Math.sign(values[1]-values[0]):0;if(values.some((v,i)=>i&&Math.sign(v-values[i-1])!==d))errors.push(f.id+' source series order reversed');
   const actual=[...root.querySelectorAll('[data-physical-switch]')].filter(g=>g.dataset.bay===f.id).map(g=>g.dataset.id),expected=[...f.main,...f.branches].map(e=>e.id);if(actual.length!==expected.length||actual.some(id=>!expected.includes(id)))errors.push(f.id+' invented or omitted branch');
  }
  // A bar selector must now detour outside a foreign rail. A coincident crossing
  // cannot be repaired by hiding a hop or deduplicating a false junction.
  let unrelatedRailCrossings=0;
  for(const wire of root.querySelectorAll('path[data-native-terminal]')){const p=coords(wire);for(const rail of root.querySelectorAll('[data-semantic="busbar-section"]')){const id=rail.dataset.id??rail.dataset.sourceReference;if(id===wire.dataset.nativeTerminal)continue;const q=coords(rail.querySelector('path[data-connection]'));for(let i=1;i<p.length;i++){
   const a=p[i-1],b=p[i];if(Math.abs(a[0]-b[0])>.01||!(q[0][1]>Math.min(a[1],b[1])+.01&&q[0][1]<Math.max(a[1],b[1])-.01)||a[0]<=Math.min(q[0][0],q[1][0])||a[0]>=Math.max(q[0][0],q[1][0]))continue;unrelatedRailCrossings++;
   for(const c of root.querySelectorAll('circle[data-junction]')){const v=point(c);if(Math.hypot(v.x-a[0],v.y-q[0][1])<.01)errors.push('False junction on unrelated rail '+id);}
  }}}
  if(gold.orientation!=='horizontal'&&unrelatedRailCrossings)errors.push('Foreign native conductors cross real rails: '+unrelatedRailCrossings);return {rows,errors,unrelatedRailCrossings};
 },golden);
 assert.deepEqual(proof.errors,[]);return proof;
}

export async function exportFeederCloseups(page,browser,svgText,feeders,out,label){
 const fs=await import('node:fs/promises'),path=await import('node:path');await fs.mkdir(out,{recursive:true});
 const p=await browser.newPage();try{await p.setContent('<body style="margin:0;background:white">'+svgText+'</body>');
  const full=await p.locator('svg').evaluate(e=>e.outerHTML);
  for(const f of feeders){await p.setContent('<body style="margin:0;background:white">'+full+'</body>');const dimensions=await p.locator('svg').evaluate((svg,id)=>{const gs=[...svg.querySelectorAll('[data-physical-switch]')].filter(g=>g.dataset.bay===id);const bs=gs.map(g=>g.getBBox()),x=Math.min(...bs.map(b=>b.x))-28,y=Math.min(...bs.map(b=>b.y))-28,w=Math.max(...bs.map(b=>b.x+b.width))-x+28,h=Math.max(...bs.map(b=>b.y+b.height))-y+28;svg.setAttribute('viewBox',[x,y,w,h].join(' '));svg.setAttribute('width',w*4);svg.setAttribute('height',h*4);svg.style.width=w*4+'px';svg.style.minWidth='';svg.style.height=h*4+'px';return {width:Math.ceil(w*4),height:Math.ceil(h*4)};},f.id);await p.setViewportSize(dimensions);await p.locator('svg').screenshot({path:path.resolve(out,label+'-'+f.id+'-4x.png')});await fs.writeFile(path.resolve(out,label+'-'+f.id+'-4x.svg'),await p.locator('svg').evaluate(e=>new XMLSerializer().serializeToString(e)));}
 }finally{await p.close();}
}
