import {SaxesParser} from 'saxes';
const point=s=>s.split(',').map(Number),near=(a,b)=>a&&b&&Math.hypot(a[0]-b[0],a[1]-b[1])<.01;
// Read actual SVG subpaths: an M is an optical break, never an inferred line.
export function segmentsOf(d){let prior=null;const segments=[];for(const m of d.matchAll(/([ML])([\d.-]+),([\d.-]+)/g)){const p=[+m[2],+m[3]];if(m[1]==='L'&&prior&&!near(prior,p))segments.push([prior,p]);prior=p;}return segments;}
export function inspectPilotSvg(xml,graph,scope='400'){
 const parser=new SaxesParser(),stack=[],paths=[],switches=[],ports=new Map(),leaves=[],hops=[],equipment=[];
 parser.on('opentag',tag=>{const a=tag.attributes,parent=stack.at(-1),owner=a['data-id']?a:parent?.owner,semantic=a['data-semantic']??parent?.semantic;stack.push({owner,semantic,attrs:a});
  if(a['data-physical-switch'])switches.push(a);
  if(a['data-equipment-center'])equipment.push(a);
  if(a['data-source-leaf-caption'])leaves.push(a['data-source-leaf-caption']);
  if(a['data-hop-over'])hops.push(a);
  if(tag.name==='circle'&&parent?.attrs['data-port'])ports.set(parent.attrs['data-port'],[+a.cx,+a.cy]);
  if(tag.name==='path'&&a['data-connection']&&a['data-native-terminal'])paths.push({owner:owner?.['data-id'],semantic,a,terminal:a['data-native-terminal'],segments:segmentsOf(a.d)});
 });parser.on('closetag',()=>stack.pop());parser.write(xml).close();
 const rails=paths.filter(p=>p.semantic==='busbar-section').map(p=>({id:p.terminal,x1:p.segments[0][0][0],x2:p.segments[0][1][0],y:p.segments[0][0][1]})),native=new Map(graph.switches.map(s=>[s.id,s])),pilotOwners=new Set(graph.feeders.filter(f=>scope==='all'||f.voltageKv>=300).flatMap(f=>f.switchIds)),pilotTerminals=new Set(graph.terminals.filter(t=>scope==='all'||t.vnKv>=300).map(t=>t.id));
 const errors=[],pilotErrors=[],record=(message,owner)=>{errors.push(message);if(pilotOwners.has(owner))pilotErrors.push(message);},ledger=[];
 for(const s of switches){const id=s['data-id'],source=native.get(id),own=paths.filter(p=>p.owner===id),a=own.find(p=>p.a['data-contact-side']==='FROM'),b=own.find(p=>p.a['data-contact-side']==='TO');
  if(!source||source.from!==s['data-from']||source.to!==s['data-to'])record('Source endpoint mismatch '+id,id);
  for(const [p,terminal,contact,side]of[[a,source?.from,s['data-contact-in'],'FROM'],[b,source?.to,s['data-contact-out'],'TO']]){
   if(!p||!contact){record('Missing contact conductor '+id,id);continue;}
   const raw=p.a['data-source-conductor']??p.a.d,pts=[...raw.matchAll(/[ML]([\d.-]+),([\d.-]+)/g)].map(m=>[+m[1],+m[2]]),node=side==='FROM'?pts[0]:pts.at(-1),tip=side==='FROM'?pts.at(-1):pts[0],rail=rails.find(r=>r.id===terminal);
   if(p.terminal!==terminal||!near(tip,point(contact)))record('Detached contact '+id+' '+side,id);
   if(rail?node[1]!==rail.y||node[0]<rail.x1||node[0]>rail.x2:!near(node,ports.get(terminal)))record('Detached source terminal '+id+' '+terminal,id);
   ledger.push({owner:id,terminal,side,state:s['data-state'],pilot:pilotOwners.has(id),path:p.a.d});
  }
  if(s['data-state']==='OPEN'){
   const a=point(s['data-contact-in']),b=point(s['data-contact-out']),center=[(a[0]+b[0])/2,(a[1]+b[1])/2];
   for(const p of paths)for(const [u,v]of p.segments){const vertical=u[0]===v[0],bridged=vertical?Math.abs(u[0]-center[0])<4&&Math.max(u[1],v[1])>center[1]-4&&Math.min(u[1],v[1])<center[1]+4:Math.abs(u[1]-center[1])<4&&Math.max(u[0],v[0])>center[0]-4&&Math.min(u[0],v[0])<center[0]+4;if(bridged)record('Open gap bridged '+id+' by '+p.owner,id);}
  }
 }
 // Every declared source centerline interval must exist in the visible same-net
 // union, apart from an independently validated optical rail passage.
 for(const p of paths.filter(p=>p.a['data-source-conductor']))for(const [a,b]of segmentsOf(p.a['data-source-conductor'])){
  const v=a[0]===b[0],axis=v?1:0,fixed=v?0:1,lo=Math.min(a[axis],b[axis]),hi=Math.max(a[axis],b[axis]),ranges=paths.filter(q=>q.terminal===p.terminal).flatMap(q=>q.segments).filter(([u,w])=>u[fixed]===a[fixed]&&w[fixed]===a[fixed]).map(([u,w])=>[Math.min(u[axis],w[axis]),Math.max(u[axis],w[axis])]);
  if(v)for(const pass of JSON.parse(p.a['data-rail-passes']??'[]'))if(pass.x===a[0])ranges.push([pass.y-6,pass.y+6]);
  let cursor=lo;for(const [l,h]of ranges.sort((x,y)=>x[0]-y[0]))if(l<=cursor+.01&&h>cursor)cursor=h;
  if(cursor<hi-.01)record('Missing shared source interval '+p.owner+' '+p.terminal,p.owner);
 }
 const overlap=[],foreignTouches=[],segments=paths.flatMap(p=>p.segments.map(([a,b])=>({...p,a,b})));
 for(let i=0;i<segments.length;i++)for(let j=i+1;j<segments.length;j++){
  const a=segments[i],b=segments[j],v=a.a[0]===a.b[0]&&b.a[0]===b.b[0]&&a.a[0]===b.a[0],h=a.a[1]===a.b[1]&&b.a[1]===b.b[1]&&a.a[1]===b.a[1];
  const on=(p,s)=>Math.abs((s.a[0]===s.b[0]?p[0]-s.a[0]:p[1]-s.a[1]))<.01&&p[0]>=Math.min(s.a[0],s.b[0])-.01&&p[0]<=Math.max(s.a[0],s.b[0])+.01&&p[1]>=Math.min(s.a[1],s.b[1])-.01&&p[1]<=Math.max(s.a[1],s.b[1])+.01;
  if(a.terminal!==b.terminal&&([a.a,a.b].some(p=>on(p,b))||[b.a,b.b].some(p=>on(p,a))))foreignTouches.push({owners:[a.owner,b.owner],terminals:[a.terminal,b.terminal],pilot:pilotTerminals.has(a.terminal)||pilotTerminals.has(b.terminal)});
  if(!v&&!h)continue;
  const axis=v?1:0,len=Math.min(Math.max(a.a[axis],a.b[axis]),Math.max(b.a[axis],b.b[axis]))-Math.max(Math.min(a.a[axis],a.b[axis]),Math.min(b.a[axis],b.b[axis]));
  if(len>.1)overlap.push({owners:[a.owner,b.owner],terminals:[a.terminal,b.terminal],length:len,pilot:pilotTerminals.has(a.terminal)||pilotTerminals.has(b.terminal)});
 }
 let railPasses=0;
 for(const p of paths)for(const pass of JSON.parse(p.a['data-rail-passes']??'[]')){
  railPasses++;const rail=rails.find(r=>r.id===pass.railId);
  if(!rail||rail.id===p.terminal||rail.y!==pass.y||pass.x<=rail.x1||pass.x>=rail.x2)record('Unproven rail pass '+p.owner,p.owner);
  if(p.segments.some(([a,b])=>a[0]===pass.x&&b[0]===pass.x&&Math.min(a[1],b[1])<pass.y&&Math.max(a[1],b[1])>pass.y))record('Uninsulated rail pass '+p.owner,p.owner);
 }
 const bank=equipment.filter(e=>e['data-transformer-type']==='AUTOTRANSFORMER').map(e=>({id:e['data-id'],hv:e['data-hv-terminal'],lv:e['data-lv-terminal'],x:point(e['data-equipment-center'])[0]})).sort((a,b)=>a.x-b.x);
 const leafReport=leaves.map(id=>({id,name:graph.terminals.find(t=>t.id===id)?.name,edges:graph.switches.filter(s=>s.from===id||s.to===id).map(s=>s.id),equipment:graph.equipment.filter(e=>e.terminals.includes(id)).map(e=>e.id)}));
 return {switches:switches.length,uniqueSwitches:new Set(switches.map(s=>s['data-physical-switch'])).size,sourceBays:graph.sourceFeederCount,bars:rails.length,transformers:equipment.filter(e=>e['data-semantic']==='transformer').length,railPasses,pilotErrors,errors,overlap,pilotOverlaps:overlap.filter(o=>o.pilot),foreignTouches,pilotForeignTouches:foreignTouches.filter(o=>o.pilot),bank,leafReport,ledger};
}
