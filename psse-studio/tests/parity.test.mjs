import test from 'node:test';import assert from 'node:assert/strict';
import {flowArrows} from '../src/modules/psse/map/flow-layer.js';
import {stationState} from '../src/modules/psse/map/station-state.js';
import {metricChoices,resultColumns,sortRows,groupLoading} from '../src/modules/psse/ui/result-columns.js';
import {loadingAtTerminals} from '../src/modules/psse/calculations/rating.js';
import {motionPolicy} from '../src/modules/psse/map/motion-policy.js';
import {ScenarioStore} from '../src/modules/psse/scenarios/store.js';
test('system reduced motion defaults off; explicit app permission and data gates remain independent',()=>{
  const config={requested:true,reduced:true,available:true};assert.equal(motionPolicy(config).enabled,false);assert.equal(motionPolicy({...config,permission:'allow'}).enabled,true);assert.equal(motionPolicy({...config,permission:'allow',requested:false}).enabled,false);assert.equal(motionPolicy({...config,permission:'allow',layer:'saved'}).enabled,false);assert.equal(motionPolicy({...config,permission:'allow',available:false}).enabled,false);assert.equal(motionPolicy({...config,reduced:false}).enabled,true);
});
test('scenario CRUD preserves the base, independent copies and round-trip history',()=>{
  const network={modelHash:'n'},make=(n,operations=[])=>({networkHash:n.modelHash,operations:structuredClone(operations),hash:JSON.stringify(operations)}),book=new ScenarioStore(network,make,'source');
  const original=book.create('Original',[]);book.apply({equipmentId:'line:1',action:'STATUS',value:0});const copy=book.create('Copy');book.apply({equipmentId:'load:1',action:'LOAD_SCALE',value:.9});assert.equal(book.items.get(original).operations.length,1);assert.equal(book.item.operations.length,2);book.undo();book.redo();book.rename(copy,'Renamed');const restored=new ScenarioStore(network,make,'source');restored.restore(book.serialize());assert.equal(restored.item.name,'Renamed');assert.equal(restored.item.operations.length,2);restored.remove(copy);assert.equal(restored.selected,'base');for(const action of [()=>book.rename('base','changed'),()=>book.remove('base'),()=>book.create(' ')])assert.throws(action);assert.equal(book.items.get('base').operations.length,0);
});
const line={id:'line:a',a:{x:0,y:0},b:{x:300,y:0},status:1,kv:400,pFrom:100,pTo:-99,qFrom:10,qTo:5,loading:50};
test('current-expressed MVA RATE uses nominal terminal kV and current, independently of voltage magnitude',()=>{
  const network={buses:[{baseKv:400,source:true},{baseKv:154,source:true}]},branch={from:0,to:1,status:1,ratingBasis:'CURRENT_EXPRESSED_AS_MVA',ratingsFromSource:[100,200,0],ratingsToSource:[100,200,0]},row={pFromMw:110,qFromMvar:0,pToMw:-90,qToMvar:0,iFromA:100000/(Math.sqrt(3)*400),iToA:100000/(Math.sqrt(3)*154)};
  assert(Math.abs(loadingAtTerminals(branch,row,0,network).from-100)<1e-10);assert(Math.abs(loadingAtTerminals(branch,row,1,network).to-50)<1e-10);assert.equal(loadingAtTerminals(branch,row,2,network).from,null);assert.equal(loadingAtTerminals(branch,row,0).from,null);assert.equal(loadingAtTerminals({...branch,ratingsFromSource:[0,200]},row,1,network).from,50);assert.equal(loadingAtTerminals({...branch,ratingBasis:'MVA'},row,0,network).from,110);
});
test('GA P arrows: ceil count, signed direction, speed, thresholds and cell density',()=>{
  const frame=flowArrows([line],{time:100,density:4});assert.equal(frame.length,2);assert(frame.every(a=>a.angle===0));assert(flowArrows([{...line,pFrom:-100,pTo:101}],{time:100})[0].angle===Math.PI);
  assert(flowArrows([line],{time:200})[0].x>frame[0].x);assert(flowArrows([line],{time:100,speed:'fast'})[0].x>flowArrows([line],{time:100,speed:'slow'})[0].x);
  for(const bad of [{pFrom:.1},{pTo:2},{status:0},{kv:66},{b:{x:30,y:0}}])assert.equal(flowArrows([{...line,...bad}]).length,0);
  assert(flowArrows([line,{...line,id:'b'}],{time:100,density:1}).length<flowArrows([line,{...line,id:'b'}],{time:100,density:8}).length);
});
test('Q endpoints move independently, including to-only and both injection directions',()=>{
  assert.equal(flowArrows([line],{mode:'q',zoom:1}).length,0);const frame=flowArrows([line],{mode:'q',zoom:3,time:0});assert.equal(frame.length,2);assert.equal(frame[0].angle,0);assert.equal(frame[1].angle,Math.PI);
  const toOnly=flowArrows([{...line,qFrom:null,qTo:-5}],{mode:'q',zoom:3,time:400});assert.equal(toOnly.length,1);assert.equal(toOnly[0].q,-5);assert.equal(toOnly[0].angle,0);
  const later=flowArrows([line],{mode:'q',zoom:3,time:500});assert(later[0].x>frame[0].x);assert(later[1].x<frame[1].x);
});
test('arrows follow each segment of separated paths rather than a straight chord',()=>{
  const arrows=flowArrows([{...line,path:[{x:0,y:0},{x:80,y:80},{x:300,y:80}]}],{time:100});assert(arrows.some(a=>a.y>0));for(const a of arrows)assert(Math.abs(a.x-a.y)<1e-8||Math.abs(a.y-80)<1e-8);
});
test('display modes alter columns independently from signed sort, nulls last, ID tie-break',()=>{
  assert.deepEqual(metricChoices('buses').map(x=>x[0]),['voltage','angle','voltage-angle']);assert(!resultColumns('lines','pq').some(c=>c.key==='loading'));assert(resultColumns('transformers','p-loading').every(c=>!c.secondary));assert.deepEqual(resultColumns('buses','angle').map(c=>c.key),['name','angle','status']);
  const rows=[{id:'b',p:2},{id:'d',p:null},{id:'e',p:NaN},{id:'a',p:-10},{id:'c',p:2}];assert.deepEqual(sortRows([...rows],{key:'p',desc:false}).map(r=>r.id),['a','b','c','d','e']);assert.deepEqual(sortRows([...rows],{key:'p',desc:true}).map(r=>r.id),['b','c','a','d','e']);
});
test('three-winding loading difference is difference of maxima',()=>{
  const group=[{id:'a'},{id:'b'},{id:'c'}],before=new Map([['a',90],['b',50],['c',40]]),after=new Map([['a',80],['b',80],['c',40]]);assert.equal(groupLoading(group,after,before,(_,r)=>r,true),-10);after.set('b',null);assert.equal(groupLoading(group,after,before,(_,r)=>r,true),null);
});
test('multi-bus TM aggregates service, topology and result coverage with identity checks',()=>{
  const buses=[0,1,2].map(i=>({id:'b'+i,connectionKey:'k'+i,sourceEquipmentId:'s'+i,source:true,status:i===2?0:1,baseKv:i?154:400})),network={buses,branches:[{from:0,to:1,status:1}],generators:[],loads:[],shunts:[]},rows=buses.map(b=>({...b,vmPu:1,vaDeg:0})),full={busResults:rows};
  const state=stationState(network,[0,1,2],{result:full});assert.equal(state.service,'PARTIAL');assert.equal(state.numeric,2);assert.deepEqual(state.kv,[400,154]);assert.equal(stationState(network,[0,1],{}).coverage,'NO_RESULT');assert.equal(stationState(network,[0,1],{result:{busResults:[rows[0]]}}).coverage,'PARTIAL');assert.equal(stationState(network,[0],{result:{busResults:[{...rows[0],id:'wrong'}]}}).numeric,0);assert.equal(stationState(network,[2],{result:full}).status,'Devre dışı');
});
