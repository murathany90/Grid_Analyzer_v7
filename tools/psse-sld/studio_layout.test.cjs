const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, 'studio_layout.js'), 'utf8');
const context = vm.createContext({});
vm.runInContext(source, context);
const clone = x => JSON.parse(JSON.stringify(x));
function fixture() {
  return {components:[
    {id:1,t:'Symbol',stype:'Busbar',pos:[0,0],rot:90,len:3,ends:[[-1.5,0],[1.5,0]],locked:true},
    {id:2,t:'Symbol',stype:'Branch',pos:[3,2],rot:0},
    {id:3,t:'Symbol',stype:'Busbar',pos:[6,4],rot:90,len:3,ends:[[4.5,4],[7.5,4]]},
    {id:4,t:'Symbol',stype:'Branch',pos:[3,-2],rot:0},
    {id:5,t:'Symbol',stype:'Radial',pos:[8,1]},
    {id:10,t:'Label',owner:1,pos:[-1,0.4],text:'locked bus',fh:8},
    {id:11,t:'Label',owner:2,pos:[3,2],text:'branch one',fh:8},
    {id:12,t:'Label',owner:4,pos:[3,-2],text:'branch two',fh:8},
    {id:20,t:'Link',p1:{sym:1,idx:0,pos:[-0.7,0]},p2:{sym:2,idx:0,pos:[3,2.18]},knees:[]},
    {id:21,t:'Link',p1:{sym:2,idx:1,pos:[3,1.82]},p2:{sym:3,idx:0,pos:[5.4,4]},knees:[]},
    {id:22,t:'Link',p1:{sym:1,idx:1,pos:[0.7,0]},p2:{sym:4,idx:0,pos:[3,-1.82]},knees:[]},
    {id:23,t:'Link',p1:{sym:4,idx:1,pos:[3,-2.18]},p2:{sym:3,idx:1,pos:[6.6,4]},knees:[]},
    {id:24,t:'Link',p1:{sym:3,idx:2,pos:[7,4]},p2:{sym:5,idx:0,pos:[8,1]},knees:[]}
  ]};
}
function topology(doc){return doc.components.map(c=>[c.id,c.t,c.owner,c.p1?.sym,c.p1?.idx,c.p2?.sym,c.p2?.idx]);}
test('layout preserves topology and locked symbol and its label, with orthogonal routes',()=>{
  const doc=fixture(), before=clone(doc), ids=topology(doc), m=context.applyMetroLayout(doc);
  assert.deepEqual(topology(doc),ids);
  assert.deepEqual(doc.components[0],before.components[0]);
  assert.deepEqual(doc.components[5],before.components[5]);
  assert.equal(m.nonOrthogonalSegments,0);
  assert.equal(m.symbolCollisions,0);
  assert.ok(m.totalEdgeLength>0);
  for(const c of doc.components.filter(c=>c.t==='Link')) {
    for(const p of [c.p1,c.p2]) {const s=doc.components.find(x=>x.id===p.sym),o=before.components.find(x=>x.id===p.sym),op=before.components.find(x=>x.id===c.id)[p===c.p1?'p1':'p2']; if(s.stype==='Busbar'&&!s.locked)continue; assert.ok(Math.abs((p.pos[0]-s.pos[0])-(op.pos[0]-o.pos[0]))<1e-8);assert.ok(Math.abs((p.pos[1]-s.pos[1])-(op.pos[1]-o.pos[1]))<1e-8);}
  }
});
test('placement and routes are deterministic, also with preserved positions',()=>{
  for(const options of [{},{preservePositions:true}]) {const a=fixture(),b=fixture();context.applyMetroLayout(a,options);context.applyMetroLayout(b,options);assert.deepEqual(a,b);assert.equal(context.measureMetroLayout(a).nonOrthogonalSegments,0);if(options.preservePositions) for(const c of a.components.filter(c=>c.t==='Symbol'))assert.deepEqual(c.pos,fixture().components.find(x=>x.id===c.id).pos);}
});
test('measurement identifies crossing, overlapping labels and non-orthogonal segments',()=>{
 const d={components:[{id:1,t:'Label',pos:[0,0],text:'long text'},{id:2,t:'Label',pos:[0,0],text:'long text'},{id:3,t:'Link',p1:{pos:[-1,0]},p2:{pos:[1,0]}},{id:4,t:'Link',p1:{pos:[0,-1]},p2:{pos:[0,1]}},{id:5,t:'Link',p1:{pos:[3,3]},p2:{pos:[4,4]}}]};const m=context.measureMetroLayout(d);assert.equal(m.edgeCrossings,1);assert.equal(m.labelCollisions,1);assert.equal(m.nonOrthogonalSegments,1);
});
test('grid search routes around a symbol blocking the direct path',()=>{
 const d={components:[{id:1,t:'Symbol',stype:'Radial',pos:[0,0]},{id:2,t:'Symbol',stype:'Radial',pos:[6,0]},{id:3,t:'Symbol',stype:'Busbar',pos:[3,0],rot:0,len:3},{id:4,t:'Link',p1:{sym:1,idx:0,pos:[0,0]},p2:{sym:2,idx:0,pos:[6,0]},knees:[]}]};
 context.applyMetroLayout(d,{preservePositions:true});const l=d.components[3],pts=[l.p1.pos,...l.knees,l.p2.pos];
 assert.equal(context.measureMetroLayout(d).nonOrthogonalSegments,0);
 for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i];const x1=Math.min(a[0],b[0]),x2=Math.max(a[0],b[0]),y1=Math.min(a[1],b[1]),y2=Math.max(a[1],b[1]);assert.ok(!(x1<3.07&&x2>2.93&&y1<1.5&&y2>-1.5),'route intersects blocker');}
});
test('labels are routing obstacles and forced fallback is exposed',()=>{
 const make=()=>({components:[{id:1,t:'Symbol',stype:'Radial',pos:[0,0]},{id:2,t:'Symbol',stype:'Radial',pos:[8,0]},{id:3,t:'Label',pos:[3,0.5],text:'obstacle',locked:true},{id:4,t:'Link',p1:{sym:1,pos:[0,0]},p2:{sym:2,pos:[8,0]},knees:[]}]});
 const options={preservePositions:true,measureText:()=>({width:2,height:1})},d=make();let m=context.applyMetroLayout(d,options);assert.equal(m.edgeLabelCollisions,0);assert.equal(m.routingFailures,0);assert.equal(m.fallbackCount,0);
 const fallback=make();m=context.applyMetroLayout(fallback,{...options,maxRouteNodes:1});assert.equal(m.fallbackCount,1);assert.equal(m.routingFailures,0);assert.equal(m.edgeLabelCollisions,0);assert.equal(m.nonOrthogonalSegments,0);
});
test('busbar ports grow and distribute in stable destination order, pinned bars stay intact',()=>{
 const d={components:[{id:1,t:'Symbol',stype:'Busbar',pos:[0,0],rot:90,len:1,ends:[[-0.5,0],[0.5,0]]},{id:2,t:'Symbol',stype:'Busbar',pos:[0,10],rot:90,len:1,ends:[[-0.5,10],[0.5,10]],manual:true},...Array.from({length:6},(_,i)=>({id:10+i,t:'Symbol',stype:'Radial',pos:[i*2-5,5]})),...Array.from({length:6},(_,i)=>({id:20+i,t:'Link',p1:{sym:1,idx:i,pos:[0,0]},p2:{sym:10+i,idx:0,pos:[i*2-5,5]},knees:[]})),{id:40,t:'Link',p1:{sym:2,idx:3,pos:[0.1,10]},p2:{sym:10,idx:1,pos:[-5,5]},knees:[]}]};
 const old=clone(d.components[1]),oldPort=clone(d.components.at(-1).p1);context.applyMetroLayout(d,{preservePositions:true,portPitch:0.6});assert.ok(d.components[0].len>=4.6);assert.deepEqual(d.components[1],old);assert.deepEqual(d.components.at(-1).p1,oldPort);
 const ports=d.components.filter(c=>c.t==='Link'&&c.p1.sym===1).map(c=>c.p1.pos[0]);assert.equal(new Set(ports).size,6);for(let i=1;i<ports.length;i++)assert.ok(ports[i]>ports[i-1]);for(const l of d.components.filter(c=>c.t==='Link'&&c.p1.sym===1)){const p=l.knees[0]||l.p2.pos;assert.ok(Math.abs(p[0]-l.p1.pos[0])<1e-7);}
});
test('parallel links use separate lanes when space permits',()=>{
 const d={components:[{id:1,t:'Symbol',stype:'Busbar',pos:[0,0],rot:90,len:3},{id:2,t:'Symbol',stype:'Busbar',pos:[0,6],rot:90,len:3},{id:3,t:'Link',p1:{sym:1,idx:0,pos:[0,0]},p2:{sym:2,idx:0,pos:[0,6]},knees:[]},{id:4,t:'Link',p1:{sym:1,idx:1,pos:[0,0]},p2:{sym:2,idx:1,pos:[0,6]},knees:[]}]};
 const m=context.applyMetroLayout(d,{preservePositions:true});assert.equal(m.laneCongestion,0);assert.equal(m.routingFailures,0);assert.notDeepEqual(d.components[2].p1.pos,d.components[3].p1.pos);
});
test('hard collisions include link intersections with unrelated symbols',()=>{
 const d={components:[{id:1,t:'Symbol',stype:'Radial',pos:[0,0]},{id:2,t:'Symbol',stype:'Radial',pos:[4,0]},{id:3,t:'Symbol',stype:'Radial',pos:[2,0]},{id:4,t:'Link',p1:{sym:1,pos:[0,0]},p2:{sym:2,pos:[4,0]},knees:[]}]};const m=context.measureMetroLayout(d);assert.equal(m.edgeSymbolCollisions,1);assert.equal(m.hardCollisions,1);assert.equal(m.symbolCollisions,0);
});
test('station metadata keeps clusters together even when graph edges cross clusters',()=>{
 const d={components:[{id:1,t:'Symbol',stype:'Radial',pos:[0,0]},{id:2,t:'Symbol',stype:'Radial',pos:[1,0]},{id:3,t:'Symbol',stype:'Radial',pos:[2,0]},{id:4,t:'Symbol',stype:'Radial',pos:[3,0]},...[[1,2],[2,3],[3,4]].map(([a,b],i)=>({id:10+i,t:'Link',p1:{sym:a,pos:[a-1,0]},p2:{sym:b,pos:[b-1,0]},knees:[]}))]};
 context.applyMetroLayout(d,{clusterById:{1:'A',3:'A',2:'B',4:'B'}});const p=id=>d.components.find(c=>c.id===id).pos[1];assert.ok(Math.max(p(1),p(3))<Math.min(p(2),p(4)));
});
test('bounded routing can retain a better original route when search falls back',()=>{
 const d={components:[{id:1,t:'Symbol',stype:'Radial',pos:[0,0]},{id:2,t:'Symbol',stype:'Radial',pos:[8,0]},{id:3,t:'Label',pos:[3,0.5],text:'obstacle',locked:true},{id:4,t:'Link',p1:{sym:1,pos:[0,0]},p2:{sym:2,pos:[8,0]},knees:[[0,2],[8,2]]}]};
 const before=context.measureMetroLayout(d,{measureText:()=>({width:2,height:1})}),m=context.applyMetroLayout(d,{preservePositions:true,preserveBusPorts:true,retainBetterRoutes:true,constrainBounds:true,maxRouteNodes:1,measureText:()=>({width:2,height:1})});assert.equal(m.fallbackCount,1);assert.equal(m.edgeLabelCollisions,0);assert.equal(m.nonOrthogonalSegments,0);assert.ok(m.boundingBoxArea<=before.boundingBoxArea+1e-8);
});
test('local symbol clearance respects pins and translates attached ports',()=>{
 const d={components:[{id:1,t:'Symbol',stype:'Radial',pos:[0,0],locked:true},{id:2,t:'Symbol',stype:'Radial',pos:[0,0]},{id:3,t:'Symbol',stype:'Radial',pos:[-4,-3],locked:true},{id:4,t:'Symbol',stype:'Radial',pos:[4,3],locked:true},{id:5,t:'Label',owner:1,pos:[0,1],text:'pinned'},{id:6,t:'Link',p1:{sym:2,idx:0,pos:[0,0]},p2:{sym:4,idx:0,pos:[4,3]},knees:[]}]};
 const pinned=clone(d.components[0]),label=clone(d.components[4]);const m=context.applyMetroLayout(d,{preservePositions:true,preserveBusPorts:true,resolveSymbolCollisions:true,constrainBounds:true,maxRouteNodes:3000});assert.deepEqual(d.components[0],pinned);assert.deepEqual(d.components[4],label);assert.notDeepEqual(clone(d.components[1].pos),[0,0]);assert.deepEqual(clone(d.components[5].p1.pos),clone(d.components[1].pos));assert.equal(m.symbolCollisions,0);assert.equal(m.nonOrthogonalSegments,0);
});
test('global route refinement remains deterministic, orthogonal, and preserves topology',()=>{
 const a=fixture(),b=fixture(),top=topology(a),options={preservePositions:true,preserveBusPorts:true,retainBetterRoutes:true,constrainBounds:true,resolveSymbolCollisions:true,refineRoutes:true,crossingWeight:25,maxRouteNodes:500};const x=context.applyMetroLayout(a,options),y=context.applyMetroLayout(b,options);assert.deepEqual(a,b);assert.deepEqual(topology(a),top);assert.equal(x.nonOrthogonalSegments,0);assert.equal(y.nonOrthogonalSegments,0);
});
test('compressed visibility search avoids an obstacle after grid search is capped',()=>{
 const d={components:[{id:1,t:'Symbol',stype:'Radial',pos:[0,0]},{id:2,t:'Symbol',stype:'Radial',pos:[8,0]},{id:3,t:'Symbol',stype:'Busbar',pos:[4,0],rot:0,len:3},{id:4,t:'Symbol',stype:'Radial',pos:[0,4]},{id:5,t:'Symbol',stype:'Radial',pos:[8,-4]},{id:6,t:'Link',p1:{sym:1,pos:[0,0]},p2:{sym:2,pos:[8,0]},knees:[]}]};
 const m=context.applyMetroLayout(d,{preservePositions:true,preserveBusPorts:true,constrainBounds:true,compressedFallback:true,maxRouteNodes:1});assert.equal(m.gridFailures,1);assert.equal(m.compressedSuccesses,1);assert.equal(m.fallbackCount,0);assert.equal(m.hardCollisions,0);assert.equal(m.routingFailures,0);assert.equal(m.nonOrthogonalSegments,0);
});
test('compressed search detours around a locked label without moving it',()=>{
 const make=()=>({components:[{id:1,t:'Symbol',stype:'Radial',pos:[0,0]},{id:2,t:'Symbol',stype:'Radial',pos:[8,0]},{id:3,t:'Label',pos:[3,.5],text:'obstacle',locked:true},{id:4,t:'Symbol',stype:'Radial',pos:[0,4]},{id:5,t:'Symbol',stype:'Radial',pos:[8,-4]},{id:6,t:'Link',p1:{sym:1,pos:[0,0]},p2:{sym:2,pos:[8,0]},knees:[]}]});const a=make(),b=make(),original=clone(a.components[2]),options={preservePositions:true,preserveBusPorts:true,constrainBounds:true,compressedFallback:true,maxRouteNodes:1,measureText:()=>({width:2,height:1})};const m=context.applyMetroLayout(a,options);context.applyMetroLayout(b,options);assert.deepEqual(a,b);assert.deepEqual(a.components[2],original);assert.equal(m.compressedSuccesses,1);assert.equal(m.fallbackCount,0);assert.equal(m.edgeLabelCollisions,0);assert.equal(m.routingFailures,0);assert.equal(m.nonOrthogonalSegments,0);
});
