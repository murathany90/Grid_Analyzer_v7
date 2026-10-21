import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ScenarioStore,emptyScenario,scenarioSignature} from '../../src/domain/scenario/overlay';
import {ResultStore} from '../../src/domain/results/store';
import {WorkspaceResultCache} from '../../src/domain/results/workspace';
import {identity} from '../../src/domain/calculation/identity';
import type {CalculationResult} from '../../src/domain/results/types';
import {helpEntry} from '../../src/help/registry';
const result=(s=emptyScenario(),opts={}):CalculationResult=>({identity:identity('model',s,'powerFlow',opts),status:'CONVERGED',converged:true,iterations:1,rounds:1,maxMismatchMw:0,elapsedMs:1,buses:[],branches:[],generators:[],diagnostics:{},warnings:[],quality:{numericalStatus:'CONVERGED',controlFidelity:'PARTIAL',referenceValidation:'NOT_AVAILABLE'}});
test('three maneuvers accumulate in one workspace while base and earlier values remain immutable',()=>{
  const store=new ScenarioStore('model','case'),id=store.selectedId;
  store.setStatus('lineStatus','H1',false,true);const first=store.selected;
  store.setStatus('transformerStatus','TR2',false,true);store.setStatus('switchState','SW',false,true);
  assert.equal(store.selectedId,id);assert.equal(store.snapshots.length,2);assert.deepEqual(store.snapshots.map(s=>s.name),['Baz','Senaryo']);
  assert.deepEqual(store.current.lineStatus,{H1:false});assert.deepEqual(store.current.transformerStatus,{TR2:false});assert.deepEqual(store.current.switchState,{SW:false});
  assert.equal(store.snapshots[0].scenarioHash,scenarioSignature(emptyScenario()));assert.equal(store.selected.events.length,3);assert.equal(store.historyLength,3);
  assert.throws(()=>{(first.overlay.lineStatus as Record<string,boolean>).H1=true;});assert.equal(first.events.length,1);
});

test('undo restores one atomic feeder operation, persists undo history, and reset retires all history',()=>{
  const store=new ScenarioStore('model');store.setStatus('lineStatus','H1',false,true);
  store.setSwitchStates([{id:'SW1',source:true},{id:'SW2',source:true}],false);
  assert.equal(store.selected.events.length,3);assert.equal(store.selected.events[1].operationId,store.selected.events[2].operationId);
  const restored=new ScenarioStore('model');assert.equal(restored.restoreState(structuredClone(store.exportState())),true);restored.undo();
  assert.deepEqual(restored.current.switchState,{});assert.deepEqual(restored.current.lineStatus,{H1:false});assert.equal(restored.selected.events.length,1);
  restored.undo();assert.deepEqual(restored.current.lineStatus,{});assert.equal(restored.canUndo,false);
  store.reset();assert.equal(store.canUndo,false);assert.equal(store.historyLength,0);assert.equal(store.selected.events.length,0);assert.equal(store.snapshots.length,2);
  const clean=new ScenarioStore('model');assert.equal(clean.restoreState(structuredClone(store.exportState())),true);assert.deepEqual(clean.current,emptyScenario());assert.equal(clean.canUndo,false);
  assert.equal(new ScenarioStore('other').restoreState(store.exportState()),false);assert.equal(clean.restoreState({...store.exportState(),version:1}),false);
});

test('scenario results are independent from base; settings, model and maneuver identity reject stale replies',()=>{
  const store=new ResultStore(),a=result(),overlay={...emptyScenario(),lineStatus:{H1:false}},b=result(overlay);
  store.expect('base',a.identity);store.accept('base',a);store.expect('scenario',b.identity);assert.equal(store.accept('scenario',a),false);assert.equal(store.accept('scenario',b),true);
  assert.strictEqual(store.get('base'),a);assert.strictEqual(store.get('scenario'),b);store.expect('scenario',result(overlay,{changed:true}).identity);assert.equal(store.get('scenario'),null);
  store.expect('scenario',{...b.identity,modelHash:'other'});assert.equal(store.accept('scenario',b),false);
  store.clearScenario();store.expect('scenario',a.identity);assert.equal(store.get('scenario'),null);assert.strictEqual(store.get('base'),a);
});

test('Workspace LRU shares large result references and evicts only the oldest entry',()=>{const cache=new WorkspaceResultCache(2),entry={n1:null,ac:[],hybrid:null,sc:null,scContext:null};cache.set('A',entry);cache.set('B',entry);assert.strictEqual(cache.get('A'),entry);cache.set('C',entry);assert.equal(cache.get('B'),undefined);assert.strictEqual(cache.get('A'),entry);});
test('Each voltage and map flag resolves to a distinct explicit help entry',()=>{const ids=['400','220','154','66','low'].map(v=>'map.voltage.'+v);assert.equal(new Set(ids.map(id=>helpEntry(id)?.shortText)).size,5);for(const id of [...ids,'map.flow','map.sites','map.labels','map.route'])assert.ok(helpEntry(id));});
