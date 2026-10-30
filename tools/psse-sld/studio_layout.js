/* Deterministic, topology-preserving metro layout for ga-sld-v1 documents.
 * Mutates geometry only. Set preservePositions to route an already arranged drawing.
 * Symbol locks: locked, manual, layoutLocked, or options.lockedIds (Set/array).
 * measureText(label) may return {width,height} in diagram units.
 */
function metroIsLocked(c, opt) {
  const ids = opt.lockedIds;
  return !!(c.locked || c.manual || c.layoutLocked || (ids && (typeof ids.has === 'function' ? ids.has(c.id) : ids.includes(c.id))));
}
function metroBox(s, pad=0) {
  let w=0.64,h=0.64;
  if(s.stype==='Busbar') {
    const horizontal=s.ends ? Math.abs(s.ends[1][0]-s.ends[0][0])>=Math.abs(s.ends[1][1]-s.ends[0][1]) : Math.abs((Number(s.rot)||0)%180)>45;
    w=horizontal?Number(s.len)||2:0.14; h=horizontal?0.14:Number(s.len)||2;
  }
  return [s.pos[0]-w/2-pad,s.pos[1]-h/2-pad,s.pos[0]+w/2+pad,s.pos[1]+h/2+pad];
}
function metroOverlap(a,b) { return a[0]<b[2]-1e-8 && a[2]>b[0]+1e-8 && a[1]<b[3]-1e-8 && a[3]>b[1]+1e-8; }
function metroLabelBox(c,opt) {
  const lines=String(c.text||'').split(/\r?\n/), measured=opt.measureText && opt.measureText(c);
  const h=measured && Number(measured.height)>0?Number(measured.height):Math.max(0.22,(Number(c.fh)||9)*0.027)*lines.length*1.15;
  const w=measured && Number(measured.width)>0?Number(measured.width):Math.max(0.25,Math.max(...lines.map(x=>x.length))*Math.max(0.025,(Number(c.fh)||9)*0.014));
  return [c.pos[0],c.pos[1]-h,c.pos[0]+w,c.pos[1]];
}
function metroSegs(link) {
  if(!link.p1?.pos || !link.p2?.pos)return [];
  const pts=[link.p1.pos,...(link.knees||[]),link.p2.pos], seg=[];
  for(let i=1;i<pts.length;i++)if(Math.abs(pts[i][0]-pts[i-1][0])+Math.abs(pts[i][1]-pts[i-1][1])>1e-8)seg.push([pts[i-1],pts[i]]);
  return seg;
}
function metroSegmentHitsBox(a,b,r) {
  // Liang-Barsky clipping detects diagonal as well as orthogonal intersections.
  const dx=b[0]-a[0],dy=b[1]-a[1],p=[-dx,dx,-dy,dy],q=[a[0]-r[0],r[2]-a[0],a[1]-r[1],r[3]-a[1]];
  let lo=0,hi=1;
  for(let i=0;i<4;i++){if(Math.abs(p[i])<1e-12){if(q[i]<=0)return false;}else{const t=q[i]/p[i];if(p[i]<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);if(lo>=hi)return false;}}
  return hi>1e-8&&lo<1-1e-8;
}
function measureMetroLayout(doc, options={}) {
  const start=Date.now(), comps=doc?.components||[], syms=comps.filter(c=>c.t==='Symbol'&&c.pos), labels=comps.filter(c=>c.t==='Label'&&c.pos&&c.text&&c.vis!==false), links=comps.filter(c=>c.t==='Link');
  let symbolCollisions=0,edgeSymbolCollisions=0,edgeLabelCollisions=0,labelCollisions=0,nonOrthogonalSegments=0,edgeCrossings=0,laneCongestion=0,totalEdgeLength=0;
  for(let i=0;i<syms.length;i++)for(let j=i+1;j<syms.length;j++)if(metroOverlap(metroBox(syms[i]),metroBox(syms[j])))symbolCollisions++;
  const boxes=labels.map(c=>metroLabelBox(c,options));
  for(let i=0;i<labels.length;i++) {
    for(let j=i+1;j<labels.length;j++)if(metroOverlap(boxes[i],boxes[j]))labelCollisions++;
    for(const s of syms)if(metroOverlap(boxes[i],metroBox(s)))labelCollisions++;
  }
  for(const l of links) {
    const segments=metroSegs(l);
    for(const s of syms)if(s.id!==l.p1?.sym&&s.id!==l.p2?.sym&&segments.some(([a,b])=>metroSegmentHitsBox(a,b,metroBox(s))))edgeSymbolCollisions++;
    for(let i=0;i<labels.length;i++)if(segments.some(([a,b])=>metroSegmentHitsBox(a,b,boxes[i])))edgeLabelCollisions++;
  }
  const hardCollisions=symbolCollisions+edgeSymbolCollisions;
  const all=[];
  for(const l of links)for(const [a,b] of metroSegs(l)) { const dx=Math.abs(a[0]-b[0]),dy=Math.abs(a[1]-b[1]); totalEdgeLength+=dx+dy; if(dx>1e-7&&dy>1e-7)nonOrthogonalSegments++; all.push({a,b,id:l.id}); }
  for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++) {
    const x=all[i],y=all[j]; if(x.id===y.id)continue;
    const xh=Math.abs(x.a[1]-x.b[1])<1e-7, yh=Math.abs(y.a[1]-y.b[1])<1e-7;
    if(xh!==yh) {const h=xh?x:y,v=xh?y:x; if(v.a[0]>Math.min(h.a[0],h.b[0])+1e-7&&v.a[0]<Math.max(h.a[0],h.b[0])-1e-7&&h.a[1]>Math.min(v.a[1],v.b[1])+1e-7&&h.a[1]<Math.max(v.a[1],v.b[1])-1e-7)edgeCrossings++;}
    else if(xh && Math.abs(x.a[1]-y.a[1])<1e-7 && Math.min(Math.max(x.a[0],x.b[0]),Math.max(y.a[0],y.b[0]))>Math.max(Math.min(x.a[0],x.b[0]),Math.min(y.a[0],y.b[0]))+1e-7)laneCongestion++;
    else if(!xh && Math.abs(x.a[0]-y.a[0])<1e-7 && Math.min(Math.max(x.a[1],x.b[1]),Math.max(y.a[1],y.b[1]))>Math.max(Math.min(x.a[1],x.b[1]),Math.min(y.a[1],y.b[1]))+1e-7)laneCongestion++;
  }
  const bounds=[...syms.map(s=>metroBox(s)),...boxes,...all.map(s=>[Math.min(s.a[0],s.b[0]),Math.min(s.a[1],s.b[1]),Math.max(s.a[0],s.b[0]),Math.max(s.a[1],s.b[1])])];
  const boundingBoxArea=bounds.length?(Math.max(...bounds.map(x=>x[2]))-Math.min(...bounds.map(x=>x[0])))*(Math.max(...bounds.map(x=>x[3]))-Math.min(...bounds.map(x=>x[1]))):0;
  return {hardCollisions,symbolCollisions,edgeSymbolCollisions,edgeLabelCollisions,routingFailures:doc?._metroRoutingFailures||0,fallbackCount:doc?._metroFallbackCount||0,gridFailures:doc?._metroGridFailures||0,compressedSuccesses:doc?._metroCompressedSuccesses||0,edgeCrossings,labelCollisions,nonOrthogonalSegments,laneCongestion,boundingBoxArea,totalEdgeLength,runtimeMs:Date.now()-start};
}
function applyMetroLayout(doc, options={}) {
  const started=Date.now(); if(!doc || !Array.isArray(doc.components))return measureMetroLayout({components:[]},options);
  const comps=doc.components, syms=comps.filter(c=>c.t==='Symbol'&&c.pos).sort((a,b)=>a.id-b.id), links=comps.filter(c=>c.t==='Link'&&c.p1?.pos&&c.p2?.pos).sort((a,b)=>a.id-b.id), labels=comps.filter(c=>c.t==='Label'&&c.pos&&c.text&&c.vis!==false).sort((a,b)=>a.id-b.id), map=new Map(syms.map(s=>[s.id,s])), adj=new Map(syms.map(s=>[s.id,[]]));
  for(const l of links)if(adj.has(l.p1.sym)&&adj.has(l.p2.sym)&&l.p1.sym!==l.p2.sym){adj.get(l.p1.sym).push(l.p2.sym);adj.get(l.p2.sym).push(l.p1.sym);}
  for(const a of adj.values())a.sort((x,y)=>x-y);
  const old=new Map(syms.map(s=>[s.id,[...s.pos]]));
  const originalBounds=[...syms.map(s=>metroBox(s)),...labels.map(l=>metroLabelBox(l,options)),...links.flatMap(l=>metroSegs(l).map(([a,b])=>[Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[0],b[0]),Math.max(a[1],b[1])]))];
  const bounds=originalBounds.length?[Math.min(...originalBounds.map(r=>r[0])),Math.min(...originalBounds.map(r=>r[1])),Math.max(...originalBounds.map(r=>r[2])),Math.max(...originalBounds.map(r=>r[3]))]:null;
  const busPorts=new Map();
  for(const l of links)for(const [p,other] of [[l.p1,l.p2],[l.p2,l.p1]]){const s=map.get(p.sym);if(s?.stype==='Busbar'){if(!busPorts.has(s.id))busPorts.set(s.id,[]);busPorts.get(s.id).push({p,other,link:l});}}
  const pitch=Math.max(0.1,Number(options.portPitch)||0.55);
  for(const [id,ports] of busPorts){const s=map.get(id);if(options.preserveBusPorts||metroIsLocked(s,options))continue;const box=metroBox(s),horizontal=box[2]-box[0]>box[3]-box[1];s.len=Math.max(2.4,ports.length*pitch+1);const half=s.len/2;s.ends=horizontal?[[s.pos[0]-half,s.pos[1]],[s.pos[0]+half,s.pos[1]]]:[[s.pos[0],s.pos[1]+half],[s.pos[0],s.pos[1]-half]];}
  if(!options.preservePositions){
    const seen=new Set(), groups=[];
    for(const seed of syms){if(seen.has(seed.id))continue; const group=[],queue=[seed.id];seen.add(seed.id);for(let i=0;i<queue.length;i++){const id=queue[i];group.push(id);for(const n of adj.get(id))if(!seen.has(n)){seen.add(n);queue.push(n);}}groups.push(group);}
    // Metadata-backed station groups are used when the generator supplies them.
    const clusterId=s=>{const c=options.clusterById;return (c&&(typeof c.get==='function'?c.get(s.id):c[s.id]))??s.stationId;};
    if(syms.some(s=>clusterId(s)!=null)) {
      const keyed=new Map(),remaining=[];
      for(const s of syms){const id=clusterId(s);if(id==null)remaining.push([s.id]);else{const k=String(id);if(!keyed.has(k))keyed.set(k,[]);keyed.get(k).push(s.id);}}
      groups.splice(0,groups.length,...[...keyed.keys()].sort().map(k=>keyed.get(k)),...remaining);
    }
    let baseY=0;
    for(const group of groups){
      const root=[...group].sort((a,b)=>(map.get(b).stype==='Busbar')-(map.get(a).stype==='Busbar')||adj.get(b).length-adj.get(a).length||a-b)[0], rank=new Map([[root,0]]),q=[root];
      for(let i=0;i<q.length;i++)for(const n of adj.get(q[i]))if(!rank.has(n)){rank.set(n,rank.get(q[i])+1);q.push(n);}
      const layers=[],ranks=[...new Set(group.map(id=>rank.get(id)||0))].sort((a,b)=>a-b); for(const id of group){const r=ranks.indexOf(rank.get(id)||0);(layers[r]||(layers[r]=[])).push(id);}
      for(let pass=0;pass<8;pass++){const forward=pass%2===0,indices=layers.map((_,i)=>i);if(!forward)indices.reverse();for(const r of indices){const neighbor=layers[r+(forward?-1:1)];if(!neighbor)continue;const order=new Map(neighbor.map((x,i)=>[x,i]));const bary=id=>{const ns=adj.get(id).filter(x=>order.has(x));return ns.length?ns.reduce((v,x)=>v+order.get(x),0)/ns.length:layers[r].indexOf(id);};const scores=new Map(layers[r].map(id=>[id,bary(id)]));layers[r].sort((a,b)=>scores.get(a)-scores.get(b)||a-b);}}
      let x=0,groupHeight=0;
      for(const layer of layers){let maxW=0,y=baseY;for(const id of layer){const s=map.get(id),box=metroBox(s);maxW=Math.max(maxW,box[2]-box[0]);const h=box[3]-box[1];if(!metroIsLocked(s,options))s.pos=[x,y+h/2];y+=h+1.5;}groupHeight=Math.max(groupHeight,y-baseY);x+=maxW+2.8;}
      baseY+=groupHeight+2;
    }
    const placed=syms.filter(s=>metroIsLocked(s,options));
    for(const s of syms){if(metroIsLocked(s,options))continue;const origin=[...s.pos];let k=0;while(placed.some(p=>metroOverlap(metroBox(s,0.3),metroBox(p,0.3)))&&k<1000){k++;s.pos=[origin[0]+Math.floor((k+1)/2)*0.8,origin[1]+(k%2?1:-1)*Math.ceil(k/2)*0.8];}placed.push(s);}
  }
  if(options.resolveSymbolCollisions){
    // Move only overlapping movable symbols. Small devices are considered before bars.
    const ordered=[...syms].sort((a,b)=>{const aa=metroBox(a),bb=metroBox(b);return (aa[2]-aa[0])*(aa[3]-aa[1])-(bb[2]-bb[0])*(bb[3]-bb[1])||a.id-b.id;});
    const pad=Math.max(0,Number(options.symbolClearance)||0.08);
    for(let pass=0;pass<20;pass++){let moved=false;
      for(const s of ordered){if(metroIsLocked(s,options))continue;const origin=[...s.pos],box=metroBox(s),over=syms.filter(o=>o!==s&&metroOverlap(box,metroBox(o)));if(!over.length)continue;
        const candidates=[];for(const o of over){const b=metroBox(o),left=b[0]-(box[2]-origin[0])-pad,right=b[2]+(origin[0]-box[0])+pad,bottom=b[1]-(box[3]-origin[1])-pad,top=b[3]+(origin[1]-box[1])+pad;candidates.push([left,origin[1]],[right,origin[1]],[origin[0],bottom],[origin[0],top],[left,bottom],[left,top],[right,bottom],[right,top]);}
        if(s.stype==='Branch'){const neighbors=adj.get(s.id).map(id=>map.get(id)).filter(Boolean);if(neighbors.length>=2)candidates.push([neighbors.reduce((v,n)=>v+n.pos[0],0)/neighbors.length,neighbors.reduce((v,n)=>v+n.pos[1],0)/neighbors.length]);}
        let best=null,bestCount=over.length,bestDistance=Infinity;
        for(const p of candidates){s.pos=p;const b=metroBox(s);if(bounds&&(b[0]<bounds[0]||b[1]<bounds[1]||b[2]>bounds[2]||b[3]>bounds[3]))continue;const count=syms.reduce((v,o)=>v+(o!==s&&metroOverlap(b,metroBox(o))?1:0),0),distance=Math.abs(p[0]-origin[0])+Math.abs(p[1]-origin[1]);if(count<bestCount||(count===bestCount&&count<over.length&&distance<bestDistance)){best=[...p];bestCount=count;bestDistance=distance;}}
        s.pos=best||origin;if(best)moved=true;
      }
      if(!moved)break;
    }
  }
  for(const s of syms)if(!metroIsLocked(s,options)&&s.ends){const dx=s.pos[0]-old.get(s.id)[0],dy=s.pos[1]-old.get(s.id)[1];if(dx||dy)s.ends=s.ends.map(p=>[p[0]+dx,p[1]+dy]);}
  for(const l of labels){const s=map.get(l.owner);if(!metroIsLocked(l,options)&&!(s&&metroIsLocked(s,options))&&s){l.pos=[l.pos[0]+s.pos[0]-old.get(s.id)[0],l.pos[1]+s.pos[1]-old.get(s.id)[1]];}}
  const placedLabels=labels.filter(l=>metroIsLocked(l,options)||(map.has(l.owner)&&metroIsLocked(map.get(l.owner),options)));
  const offsets=[[0,0]];for(let ring=1;ring<=14;ring++)for(let x=-ring;x<=ring;x++)for(let y=-ring;y<=ring;y++)if(Math.max(Math.abs(x),Math.abs(y))===ring)offsets.push([x*0.3,y*0.3]);
  for(const l of labels){if(placedLabels.includes(l))continue;const original=[...l.pos];let best=[...original],bestScore=Infinity;for(const [dx,dy] of offsets){l.pos=[original[0]+dx,original[1]+dy];const b=metroLabelBox(l,options);if(options.constrainBounds&&bounds&&(b[0]<bounds[0]||b[1]<bounds[1]||b[2]>bounds[2]||b[3]>bounds[3]))continue;let score=0;for(const x of placedLabels)if(metroOverlap(b,metroLabelBox(x,options)))score++;for(const s of syms)if(metroOverlap(b,metroBox(s,0.05)))score++;if(score<bestScore){bestScore=score;best=[...l.pos];if(!score)break;}}l.pos=best;placedLabels.push(l);}
  // Translate endpoint coordinates by the exact displacement of their owning symbol.
  for(const l of links)for(const p of [l.p1,l.p2]){const s=map.get(p.sym),o=old.get(p.sym);if(s&&o&&(s.pos[0]!==o[0]||s.pos[1]!==o[1]))p.pos=[p.pos[0]+s.pos[0]-o[0],p.pos[1]+s.pos[1]-o[1]];}
  // Keep the electrical port index/reference; only redistribute unlocked busbar geometry.
  for(const [id,ports] of busPorts){const s=map.get(id);if(options.preserveBusPorts||metroIsLocked(s,options))continue;const box=metroBox(s),horizontal=box[2]-box[0]>box[3]-box[1],axis=horizontal?0:1;
    ports.sort((a,b)=>{const aa=map.get(a.other.sym)?.pos||a.other.pos,bb=map.get(b.other.sym)?.pos||b.other.pos;return aa[axis]-bb[axis]||a.link.id-b.link.id;});
    ports.forEach((entry,i)=>{const offset=(i-(ports.length-1)/2)*pitch;entry.p.pos=horizontal?[s.pos[0]+offset,s.pos[1]]:[s.pos[0],s.pos[1]+offset];entry.p.offsetRatio=offset/s.len;});
  }
  let routingFailures=0,fallbackCount=0,gridFailures=0,compressedSuccesses=0;
  const step=Math.max(0.15,Number(options.gridSize)||0.35), occupied=new Map(), dirs=[[1,0],[0,1],[-1,0],[0,-1]],key=(x,y)=>x+','+y;
  const spatialSize=Math.max(1.4,step*4), obstacleBins=new Map(), allObstacles=[...syms.map(s=>({id:s.id,box:metroBox(s,options.symbolRoutingPadding==null?step*0.35:Math.max(0,Number(options.symbolRoutingPadding)))})),...labels.map(c=>{const r=metroLabelBox(c,options),p=options.labelRoutingPadding==null?step*0.35:Math.max(0,Number(options.labelRoutingPadding));return {box:[r[0]-p,r[1]-p,r[2]+p,r[3]+p]};})];
  for(const item of allObstacles){const r=item.box;for(let x=Math.floor(r[0]/spatialSize);x<=Math.floor(r[2]/spatialSize);x++)for(let y=Math.floor(r[1]/spatialSize);y<=Math.floor(r[3]/spatialSize);y++){const k=key(x,y);if(!obstacleBins.has(k))obstacleBins.set(k,[]);obstacleBins.get(k).push(item);}}
  const routeAlternatives=new Map();
  function metroRouteScore(l){const segs=metroSegs(l);let score=0;
    for(const [u,v] of segs){const dx=Math.abs(u[0]-v[0]),dy=Math.abs(u[1]-v[1]);score+=(dx+dy)*0.01;if(dx>1e-7&&dy>1e-7)score+=10000;}
    for(const s of syms)if(s.id!==l.p1.sym&&s.id!==l.p2.sym&&segs.some(([u,v])=>metroSegmentHitsBox(u,v,metroBox(s))))score+=Number(options.symbolCollisionWeight)||100;
    for(const label of labels)if(segs.some(([u,v])=>metroSegmentHitsBox(u,v,metroLabelBox(label,options))))score+=8;
    for(const other of links)if(other!==l)for(const [u,v] of segs)for(const [c,d] of metroSegs(other)){const h=Math.abs(u[1]-v[1])<1e-7,j=Math.abs(c[1]-d[1])<1e-7;if(h!==j){const H=h?[u,v]:[c,d],V=h?[c,d]:[u,v];if(V[0][0]>Math.min(H[0][0],H[1][0])+1e-7&&V[0][0]<Math.max(H[0][0],H[1][0])-1e-7&&H[0][1]>Math.min(V[0][1],V[1][1])+1e-7&&H[0][1]<Math.max(V[0][1],V[1][1])-1e-7)score+=Number(options.crossingWeight)||2;}else if(h&&Math.abs(u[1]-c[1])<1e-7&&Math.min(Math.max(u[0],v[0]),Math.max(c[0],d[0]))>Math.max(Math.min(u[0],v[0]),Math.min(c[0],d[0]))+1e-7)score+=1;else if(!h&&Math.abs(u[0]-c[0])<1e-7&&Math.min(Math.max(u[1],v[1]),Math.max(c[1],d[1]))>Math.max(Math.min(u[1],v[1]),Math.min(c[1],d[1]))+1e-7)score+=1;}
    return score;}
  function compressedRoute(start,finish,l){
    // Rectilinear visibility graph: each axis uses exact ports and obstacle edges.
    // Every edge is checked against the expanded obstacles, including outside the corridor.
    const limit=Math.max(500,Number(options.maxCompressedNodes)||20000), eps=Math.max(0.005,step*0.04);
    for(const margin of [2,5,12]){
      const left=Math.max(bounds?.[0]??-Infinity,Math.min(start[0],finish[0])-margin),right=Math.min(bounds?.[2]??Infinity,Math.max(start[0],finish[0])+margin),bottom=Math.max(bounds?.[1]??-Infinity,Math.min(start[1],finish[1])-margin),top=Math.min(bounds?.[3]??Infinity,Math.max(start[1],finish[1])+margin);
      if(left>Math.min(start[0],finish[0])||right<Math.max(start[0],finish[0])||bottom>Math.min(start[1],finish[1])||top<Math.max(start[1],finish[1]))continue;
      const relevant=allObstacles.filter(o=>o.id!==l.p1.sym&&o.id!==l.p2.sym&&o.box[2]>=left&&o.box[0]<=right&&o.box[3]>=bottom&&o.box[1]<=top);
      if(relevant.some(o=>[start,finish].some(p=>p[0]>o.box[0]&&p[0]<o.box[2]&&p[1]>o.box[1]&&p[1]<o.box[3])))continue;
      const xs=[start[0],finish[0],left,right],ys=[start[1],finish[1],bottom,top];
      for(const o of relevant){const r=o.box;for(const x of [r[0]-eps,r[2]+eps])if(x>left&&x<right)xs.push(x);for(const y of [r[1]-eps,r[3]+eps])if(y>bottom&&y<top)ys.push(y);}
      const unique=a=>[...new Set(a.map(v=>Math.round(v*1000000)/1000000))].sort((x,y)=>x-y),X=unique(xs),Y=unique(ys),ix=v=>X.indexOf(Math.round(v*1000000)/1000000),iy=v=>Y.indexOf(Math.round(v*1000000)/1000000),A=[ix(start[0]),iy(start[1])],B=[ix(finish[0]),iy(finish[1])];
      function isBlocked(a,b){const x0=Math.floor(Math.min(a[0],b[0])/spatialSize),x1=Math.floor(Math.max(a[0],b[0])/spatialSize),y0=Math.floor(Math.min(a[1],b[1])/spatialSize),y1=Math.floor(Math.max(a[1],b[1])/spatialSize);for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++)for(const o of obstacleBins.get(key(x,y))||[])if(o.id!==l.p1.sym&&o.id!==l.p2.sym&&metroSegmentHitsBox(a,b,o.box))return true;return false;}
      const heap=[];function push(n){heap.push(n);let i=heap.length-1;while(i){const p=(i-1)>>1;if(heap[p].f<=n.f)break;heap[i]=heap[p];i=p;}heap[i]=n;}function pop(){const n=heap[0],last=heap.pop();if(heap.length){let i=0;while(true){let j=i*2+1;if(j>=heap.length)break;if(j+1<heap.length&&heap[j+1].f<heap[j].f)j++;if(heap[j].f>=last.f)break;heap[i]=heap[j];i=j;}heap[i]=last;}return n;}
      const best=new Map();for(let d=0;d<4;d++)push({x:A[0],y:A[1],d,g:0,f:(Math.abs(start[0]-finish[0])+Math.abs(start[1]-finish[1]))/step,prev:null});let end=null,count=0;
      while(heap.length&&count++<limit){const n=pop(),k=key(n.x,n.y)+','+n.d;if(best.has(k)&&best.get(k)<=n.g)continue;best.set(k,n.g);if(n.x===B[0]&&n.y===B[1]){end=n;break;}
        for(let d=0;d<4;d++){const x=n.x+dirs[d][0],y=n.y+dirs[d][1];if(x<0||x>=X.length||y<0||y>=Y.length)continue;const a=[X[n.x],Y[n.y]],b=[X[x],Y[y]];if(isBlocked(a,b))continue;const len=Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1]),mx=Math.round((a[0]+b[0])/2/step),my=Math.round((a[1]+b[1])/2/step),occ=occupied.get(key(mx,my))||0,parallel=occ&(d%2?2:1),cross=occ&(d%2?1:2),g=n.g+len/step+(d===n.d?0:2.2)+(parallel?(Number(options.lanePenalty)||7):0)+(cross?(Number(options.routeCrossingPenalty)||3):0),h=(Math.abs(b[0]-finish[0])+Math.abs(b[1]-finish[1]))/step;push({x,y,d,g,f:g+h,prev:n});}
      }
      if(end){const path=[];for(let n=end;n;n=n.prev)path.push([X[n.x],Y[n.y]]);return path.reverse();}
    }
    return null;
  }
  function route(l){
    const a=l.p1.pos,b=l.p2.pos,sa=map.get(l.p1.sym),sb=map.get(l.p2.sym),oldKnees=(l.knees||[]).map(p=>[...p]);
    function direction(s,p,t){if(s?.stype==='Busbar'){const box=metroBox(s);if(box[2]-box[0]>box[3]-box[1])return [0,t[1]>=p[1]?1:-1];return [t[0]>=p[0]?1:-1,0];}if(s?.stype==='Branch'){const dx=p[0]-s.pos[0],dy=p[1]-s.pos[1];if(Math.abs(dx)>Math.abs(dy))return [dx>=0?1:-1,0];if(Math.abs(dy)>1e-7)return [0,dy>=0?1:-1];}return Math.abs(t[0]-p[0])>=Math.abs(t[1]-p[1])?[t[0]>=p[0]?1:-1,0]:[0,t[1]>=p[1]?1:-1];}
    const obstacles=allObstacles.filter(item=>item.id!==l.p1.sym&&item.id!==l.p2.sym).map(item=>item.box);
    function chooseStub(s,p,t,isStart) {const d=direction(s,p,t),choices=[d];if(s?.stype==='Busbar')choices.push([-d[0],-d[1]]);else if(s?.stype!=='Branch')for(const dir of dirs)if(dir[0]!==d[0]||dir[1]!==d[1])choices.push(dir);let best=null;
      for(const dir of choices)for(const length of [Math.max(step*2,0.7),step,step*0.5,step*3,step*4]) {const point=[p[0]+dir[0]*length,p[1]+dir[1]*length],grid=[Math.round(point[0]/step)*step,Math.round(point[1]/step)*step],corner=isStart?(dir[0]?[grid[0],point[1]]:[point[0],grid[1]]):(dir[0]?[point[0],grid[1]]:[grid[0],point[1]]);let hits=0;for(const r of obstacles){if(metroSegmentHitsBox(p,point,r))hits++;if(metroSegmentHitsBox(point,corner,r))hits++;if(metroSegmentHitsBox(corner,grid,r))hits++;if(grid[0]>r[0]&&grid[0]<r[2]&&grid[1]>r[1]&&grid[1]<r[3])hits++;}if(options.constrainBounds&&bounds&&(grid[0]<bounds[0]||grid[0]>bounds[2]||grid[1]<bounds[1]||grid[1]>bounds[3]))hits+=5;const score=hits*1000+Math.abs(point[0]-t[0])+Math.abs(point[1]-t[1]);if(!best||score<best.score)best={dir,point,score};}
      return best;
    }
    const as=chooseStub(sa,a,b,true),bs=chooseStub(sb,b,a,false),da=as.dir,db=bs.dir,pa=as.point,pb=bs.point;
    const A=[Math.round(pa[0]/step),Math.round(pa[1]/step)],B=[Math.round(pb[0]/step),Math.round(pb[1]/step)];
    const minX=options.constrainBounds&&bounds?Math.ceil(bounds[0]/step):Math.min(A[0],B[0])-20,maxX=options.constrainBounds&&bounds?Math.floor(bounds[2]/step):Math.max(A[0],B[0])+20,minY=options.constrainBounds&&bounds?Math.ceil(bounds[1]/step):Math.min(A[1],B[1])-20,maxY=options.constrainBounds&&bounds?Math.floor(bounds[3]/step):Math.max(A[1],B[1])+20;
    const blocked=(x,y,px,py)=>{const a=[px*step,py*step],b=[x*step,y*step],minX=Math.floor(Math.min(a[0],b[0])/spatialSize),maxX=Math.floor(Math.max(a[0],b[0])/spatialSize),minY=Math.floor(Math.min(a[1],b[1])/spatialSize),maxY=Math.floor(Math.max(a[1],b[1])/spatialSize);for(let bx=minX;bx<=maxX;bx++)for(let by=minY;by<=maxY;by++)for(const item of obstacleBins.get(key(bx,by))||[])if(item.id!==l.p1.sym&&item.id!==l.p2.sym&&metroSegmentHitsBox(a,b,item.box))return true;return false;};
    const heap=[];function push(n){heap.push(n);let i=heap.length-1;while(i){const p=(i-1)>>1;if(heap[p].f<=n.f)break;heap[i]=heap[p];i=p;}heap[i]=n;}function pop(){const top=heap[0],last=heap.pop();if(heap.length){let i=0;while(true){let c=i*2+1;if(c>=heap.length)break;if(c+1<heap.length&&heap[c+1].f<heap[c].f)c++;if(heap[c].f>=last.f)break;heap[i]=heap[c];i=c;}heap[i]=last;}return top;}
    const best=new Map();for(let d=0;d<4;d++)push({x:A[0],y:A[1],d,g:0,f:Math.abs(A[0]-B[0])+Math.abs(A[1]-B[1]),prev:null});let end=null,count=0;
    while(heap.length&&count++<(options.maxRouteNodes||45000)){const n=pop(),k=key(n.x,n.y)+','+n.d;if(best.has(k)&&best.get(k)<=n.g)continue;best.set(k,n.g);if(n.x===B[0]&&n.y===B[1]){end=n;break;}for(let d=0;d<4;d++){const x=n.x+dirs[d][0],y=n.y+dirs[d][1];if(x<minX||x>maxX||y<minY||y>maxY||blocked(x,y,n.x,n.y))continue;const occ=occupied.get(key(x,y))||0, parallel=occ&(d%2?2:1),cross=occ&(d%2?1:2),g=n.g+1+(d===n.d?0:2.2)+(parallel?(Number(options.lanePenalty)||7):0)+(cross?(Number(options.routeCrossingPenalty)||3):0),h=Math.abs(x-B[0])+Math.abs(y-B[1]);push({x,y,d,g,f:g+h,prev:n});}}
    let cells=[],compressed=null;if(end){for(let n=end;n;n=n.prev)cells.push([n.x,n.y]);cells.reverse();for(let i=1;i<cells.length;i++){const c=cells[i],p=cells[i-1],bit=c[0]===p[0]?2:1;occupied.set(key(c[0],c[1]),(occupied.get(key(c[0],c[1]))||0)|bit);}}else {gridFailures++;if(options.compressedFallback)compressed=compressedRoute(pa,pb,l);if(compressed)compressedSuccesses++;else {fallbackCount++;cells=[[...A],[B[0],A[1]],[...B]];}}
    const pts=[a,pa];function connect(p,preferX){const last=pts[pts.length-1];if(Math.abs(last[0]-p[0])>1e-8&&Math.abs(last[1]-p[1])>1e-8)pts.push(preferX?[p[0],last[1]]:[last[0],p[1]]);pts.push(p);}
    if(compressed){for(let i=1;i<compressed.length;i++)connect(compressed[i],true);}else {connect([A[0]*step,A[1]*step],!!da[0]);for(let i=1;i<cells.length;i++)connect([cells[i][0]*step,cells[i][1]*step],true);}connect(pb,!db[0]);connect(b,true);
    const clean=[];for(const p of pts){const pt=p.map(x=>Math.round(x*100000)/100000);if(clean.length&&Math.abs(clean[clean.length-1][0]-pt[0])+Math.abs(clean[clean.length-1][1]-pt[1])<1e-7)continue;while(clean.length>=2){const u=clean[clean.length-2],v=clean[clean.length-1];if((Math.abs(u[0]-v[0])<1e-7&&Math.abs(v[0]-pt[0])<1e-7)||(Math.abs(u[1]-v[1])<1e-7&&Math.abs(v[1]-pt[1])<1e-7))clean.pop();else break;}clean.push(pt);}l.knees=clean.slice(1,-1);
    if(options.retainBetterRoutes&&options.preservePositions&&options.preserveBusPorts){
      const movedA=sa&&(sa.pos[0]!==old.get(sa.id)[0]||sa.pos[1]!==old.get(sa.id)[1]),movedB=sb&&(sb.pos[0]!==old.get(sb.id)[0]||sb.pos[1]!==old.get(sb.id)[1]);let oldCandidate=oldKnees;
      if(movedA||movedB){const previousA=movedA?[a[0]-sa.pos[0]+old.get(sa.id)[0],a[1]-sa.pos[1]+old.get(sa.id)[1]]:a,previousB=movedB?[b[0]-sb.pos[0]+old.get(sb.id)[0],b[1]-sb.pos[1]+old.get(sb.id)[1]]:b;const p=[a];function append(q,preferX){const last=p[p.length-1];if(Math.abs(last[0]-q[0])>1e-7&&Math.abs(last[1]-q[1])>1e-7)p.push(preferX?[q[0],last[1]]:[last[0],q[1]]);p.push(q);}if(movedA){append(pa,!!da[0]);append(previousA,!!da[0]);}for(const q of oldKnees)append(q,true);append(previousB,true);if(movedB)append(pb,!db[0]);append(b,true);oldCandidate=p.slice(1,-1);}
      const candidate=l.knees,cost=metroRouteScore(l);l.knees=oldCandidate;const segments=metroSegs(l),perpendicular=(s,seg)=>{if(s?.stype!=='Busbar'||!seg)return true;const box=metroBox(s),horizontal=box[2]-box[0]>box[3]-box[1];return Math.abs(horizontal?seg[0][0]-seg[1][0]:seg[0][1]-seg[1][1])<1e-7;},inside=(!options.constrainBounds||!bounds||segments.every(([u,v])=>[u,v].every(p=>p[0]>=bounds[0]-1e-7&&p[0]<=bounds[2]+1e-7&&p[1]>=bounds[1]-1e-7&&p[1]<=bounds[3]+1e-7)))&&perpendicular(sa,segments[0])&&perpendicular(sb,segments[segments.length-1]);if(!inside||metroRouteScore(l)>cost)l.knees=candidate;routeAlternatives.set(l,inside?[oldCandidate,candidate]:[candidate]);
    }
  }
  for(const l of links)route(l);
  if(options.refineRoutes)for(let pass=0;pass<2;pass++)for(const [l,alternatives] of routeAlternatives){let chosen=l.knees,best=metroRouteScore(l);for(const k of alternatives){l.knees=k;const score=metroRouteScore(l);if(score<best-1e-8){chosen=k;best=score;}}l.knees=chosen;}
  for(const l of links){const obstacles=allObstacles.filter(item=>item.id!==l.p1.sym&&item.id!==l.p2.sym);if(metroSegs(l).some(([u,v])=>obstacles.some(item=>metroSegmentHitsBox(u,v,item.box))))routingFailures++;}
  Object.defineProperty(doc,'_metroRoutingFailures',{value:routingFailures,writable:true,configurable:true,enumerable:false});
  Object.defineProperty(doc,'_metroFallbackCount',{value:fallbackCount,writable:true,configurable:true,enumerable:false});
  Object.defineProperty(doc,'_metroGridFailures',{value:gridFailures,writable:true,configurable:true,enumerable:false});
  Object.defineProperty(doc,'_metroCompressedSuccesses',{value:compressedSuccesses,writable:true,configurable:true,enumerable:false});
  const metrics=measureMetroLayout(doc,options);metrics.runtimeMs=Date.now()-started;return metrics;
}
