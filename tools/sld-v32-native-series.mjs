import assert from 'node:assert/strict';
/** Independent incidence-walk oracle. It checks real maximal degree-two source
 * chains, not the production longest-path choice or its assigned coordinates. */
export async function nativeSeriesEvidence(page,fixture){
 const proof=await page.locator('.ga-sld-svg').evaluate((svg,f)=>{
  const errors=[],ledger=[],chains=[],inv=svg.getScreenCTM().inverse(),point=(e,x,y)=>new DOMPoint(x,y).matrixTransform(inv.multiply(e.getScreenCTM())),wire=e=>{const n=e.getAttribute('d').match(/-?\d+(?:\.\d+)?(?:e[-+]?\d+)?/g).map(Number),p=[];for(let i=0;i<n.length;i+=2){const q=point(e,n[i],n[i+1]);p.push([q.x,q.y]);}return p;},groups=new Map([...svg.querySelectorAll('[data-physical-switch]')].map(g=>[g.dataset.physicalSwitch,g])),center=g=>{const c=[...g.querySelectorAll('[data-symbol-contact]')].map(e=>point(e,+e.getAttribute('cx'),+e.getAttribute('cy')));return {x:(c[0].x+c[1].x)/2,y:(c[0].y+c[1].y)/2,contacts:c};};
  const allWires=[...svg.querySelectorAll('path[data-native-terminal]')].map(w=>({terminal:w.dataset.nativeTerminal,p:wire(w)}));
  for(const s of f.graph.switches){const g=groups.get(s.sourceClass+'|'+s.sourceId);if(!g){errors.push('Omitted '+s.id);continue;}const c=center(g),paths=[...g.querySelectorAll('path[data-native-terminal]')].map(w=>({side:w.dataset.contactSide,p:wire(w)})),input=paths.find(p=>p.side==='FROM')?.p.at(-1),output=paths.find(p=>p.side==='TO')?.p[0];
   if(g.dataset.chainOrdering!=='SOURCE_ORDER_UNAVAILABLE')for(const p of [input,output])if(!p||!c.contacts.some(q=>Math.hypot(q.x-p[0],q.y-p[1])<.01))errors.push('Detached contact '+s.id);
   if(g.dataset.state==='OPEN')for(const w of allWires)for(let i=1;i<w.p.length;i++){const a=w.p[i-1],b=w.p[i];if(Math.abs(a[0]-b[0])<.01?Math.abs(a[0]-c.x)<5&&Math.max(a[1],b[1])>c.y-5&&Math.min(a[1],b[1])<c.y+5:Math.abs(a[1]-c.y)<5&&Math.max(a[0],b[0])>c.x-5&&Math.min(a[0],b[0])<c.x+5)errors.push('Open gap bridged '+s.id);}
   ledger.push({feeder:s.bayId??'SOURCE_BAY_UNAVAILABLE',switch:s.sourceId,sourceClass:s.sourceClass,cubicle:g.dataset.cubicle,kind:g.dataset.deviceKind,native:[s.from,s.to],contactIN:input??null,contactOUT:output??null,fixedContacts:c.contacts.map(p=>[p.x,p.y]),state:g.dataset.state,status:g.dataset.chainOrdering==='SOURCE_ORDER_UNAVAILABLE'?'SOURCE_ORDER_UNAVAILABLE':'PASS'});
  }
  const bars=new Set(f.graph.busSections.map(b=>b.id));
  for(const feeder of f.graph.feeders){const edges=f.graph.switches.filter(s=>feeder.switchIds.includes(s.id)&&s.from!==s.to&&!bars.has(s.from)&&!bars.has(s.to)),at=new Map();for(const e of edges)for(const id of [e.from,e.to])at.set(id,[...(at.get(id)??[]),e]);const visited=new Set();
   for(const [start,list]of at)if(list.length!==2)for(const first of list){if(visited.has(first.id))continue;const ids=[],nodes=[start];let e=first,id=start;
    while(e){visited.add(e.id);ids.push(e.id);id=e.from===id?e.to:e.from;nodes.push(id);const next=at.get(id)??[];if(next.length!==2)break;e=next.find(e=>!visited.has(e.id));}
    if(ids.length<2)continue;const gs=ids.map(id=>groups.get(f.graph.switches.find(s=>s.id===id).sourceClass+'|'+id)),cs=gs.map(center),vertical=cs.every(c=>Math.abs(c.x-cs[0].x)<.01),horizontal=cs.every(c=>Math.abs(c.y-cs[0].y)<.01);
    if(!vertical&&!horizontal)errors.push(feeder.id+' series axis '+ids.join(','));
    const values=cs.map(c=>vertical?c.y:c.x),sign=Math.sign(values[1]-values[0]);if(values.some((v,i)=>i&&Math.sign(v-values[i-1])!==sign))errors.push(feeder.id+' source order '+ids.join(','));
    for(let i=1;i<nodes.length-1;i++)for(const g of [gs[i-1],gs[i]])for(const w of g.querySelectorAll(`path[data-native-terminal="${nodes[i]}"]`))for(const p of wire(w))if(Math.abs((vertical?p[0]:p[1])-(vertical?cs[0].x:cs[0].y))>.01)errors.push(feeder.id+' intermediate false bypass '+nodes[i]);
    chains.push({feeder:feeder.id,terminals:nodes,switches:ids,status:'PASS'});
   }
  }
  return {ledger,chains,errors};
 },fixture);assert.deepEqual(proof.errors,[]);return proof;
}
