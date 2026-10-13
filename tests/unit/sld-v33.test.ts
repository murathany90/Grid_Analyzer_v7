import test from 'node:test';import assert from 'node:assert/strict';
import {sourceCircuit} from '../helpers/sld-v32-circuits';
import {ytbsFixture} from '../helpers/sld-ytbs-fixture';
import {feederOperation} from '../../src/features/sld/feeder-operation';
import {feederAreaUnits,packFeederRows,isModelFeeder} from '../../src/features/sld/feeder-packing';
import {assignYtbsSlot} from '../../src/features/sld/ytbs-slotting';
import {connectedStationLayout} from '../../src/features/sld/physical-layout';
import {allVoltageBands} from '../../src/domain/model/voltage-band';
import {ScenarioStore,effectiveNetwork} from '../../src/domain/scenario/overlay';
import {wireCrossings} from '../../src/features/sld/wire-crossings';
import {acNetwork} from '../helpers/ac-network';
import {buildStationTopologyGraph} from '../../src/domain/model/station-topology';

test('Feeder operation takes the actual DS-CB-DS main circuit and excludes the source transfer bypass',()=>{
 const f=sourceCircuit('bypass'),before=structuredClone(f.graph),plan=feederOperation(f.graph,f.graph.feeders.find(f=>f.id==='F')!);
 assert.equal(plan.ready,true);assert.deepEqual(plan.switches.map(s=>s.id),['SW0','SW1','SW2']);assert.deepEqual(plan.excludedSwitchIds,['ALTERNATE']);assert.deepEqual(f.graph,before);
});
test('Ambiguous multiple breakers and unknown source positions cannot be operated as one feeder',()=>{
 const f=sourceCircuit('isolator-breaker-isolator'),feeder=f.graph.feeders[0];f.graph.switches[0].kind='breaker';assert.equal(feederOperation(f.graph,feeder).ready,false);
 f.graph.switches[0].kind='isolator';f.graph.switches[2].stateKnown=false;assert.equal(feederOperation(f.graph,feeder).ready,false);
});
test('A bus-to-bus coupler without a unique outgoing terminal cannot silently operate only half its path',()=>{const f=sourceCircuit('coupler');assert.equal(feederOperation(f.graph,f.graph.feeders[0]).ready,false);});
test('Batch feeder operation is one immutable scenario, one undo step and three device events',()=>{
 const f=sourceCircuit('bypass'),before=structuredClone(f.network),store=new ScenarioStore(f.network.modelHash),members=f.network.switches.filter(s=>['SW0','SW1','SW2'].includes(s.id)).map(s=>({id:s.id,source:s.closed}));
 store.setSwitchStates(members,false);assert.equal(store.selectedId,'S1');assert.equal(store.revision,1);assert.equal(store.historyLength,1);assert.equal(store.selected.events.length,3);assert.equal(store.selected.parentId,'B0');
 assert.ok(effectiveNetwork(f.network,store.current).switches.every(s=>!s.closed));
 const identity=store.selected.scenarioHash;store.setStatus('switchState','SW1',true,true);assert.notEqual(store.selected.scenarioHash,identity);assert.deepEqual(store.current.switchState,{SW0:false,SW2:false});
 store.setSwitchStates(members,true);assert.deepEqual(store.current.switchState,{});assert.deepEqual(f.network,before);assert.equal(store.snapshots[0].scenarioHash,store.selected.scenarioHash);
 store.setSwitchStates(members,true);assert.equal(store.selectedId,'S3','Repeated identical command creates no extra scenario');
});
test('Packing uses four area units at 400/154 and one at 36/33, balances both sides and retains every feeder',()=>{
 assert.deepEqual([400,154,36,33].map(feederAreaUnits),[4,4,1,1]);const f=ytbsFixture();for(let i=0;i<24;i++)f.line('D'+i,33);const g=f.graph(),slots=assignYtbsSlot(g,g.feeders.filter(f=>f.voltageKv===33)),rows=packFeederRows(slots,new Map());
 assert.ok(rows[0].upper.length>2);assert.ok(rows[0].lower.length>2);assert.equal(rows.flatMap(r=>[...r.upper,...r.lower]).length,slots.length);assert.ok(rows.every(r=>r.upperWidth<=1180&&r.lowerWidth<=1180));
});
test('Rail span adapts to actual occupied cells and reserves uniform feeder compartment regions',()=>{
 const f=ytbsFixture();f.line('A',33);const small=connectedStationLayout(f.graph(),allVoltageBands()),span=(p:typeof small)=>Math.max(...p.sections.filter(b=>b.section.voltageKv===33).map(b=>b.x2-b.x1));
 for(let i=0;i<16;i++)f.line('D'+i,33);const large=connectedStationLayout(f.graph(),allVoltageBands());assert.ok(span(large)>span(small));assert.ok(span(small)<500);
 for(const c of large.compartments.values()){assert.ok(c.x1<c.axis&&c.axis<c.x2);assert.equal(c.flowY-c.titleY,56);assert.equal(c.equipmentY-c.titleY,76);assert.ok(c.y1<c.y2);}
});
test('Model feeder display tags never classify an ordinary physical ElmBay as virtual',()=>{
 const feeder=sourceCircuit('breaker-line').graph.feeders[0];assert.equal(isModelFeeder({feeder:{...feeder,name:'TR YÜKÜ',sourceClass:'ElmBay'}}),false);
 for(const name of ['TR YÜKÜ','LSZ TR-A','TR-4 YUKU'])assert.equal(isModelFeeder({feeder:{...feeder,name,sourceClass:'ElmLod'}}),true);assert.equal(isModelFeeder({feeder:{...feeder,name:'Actual generator',sourceClass:'ElmSym'}}),false);
});
test('Source virtual load / LSZ connections occupy their own straight cells after the physical feeders',()=>{
 const f=ytbsFixture(),source=acNetwork(2);f.line('REAL',33);const n={...f.n,loads:['TR-A YUKU','TR-B YÜKÜ'].map((name,i)=>({...source.loads[0],id:'VL'+i,sourceId:'VL'+i,name,bus:'L',siteIds:['S']})),generators:[{...source.generators[0],id:'VG',sourceId:'VG',name:'LSZ TR-A',sourceClass:'ElmGenStat',bus:'L',siteIds:['S']}]};
 const graph=buildStationTopologyGraph(n,'S',f.source),before=structuredClone(graph),p=connectedStationLayout(graph,allVoltageBands()),virtual=p.equipment.filter(e=>['VL0','VL1','VG'].includes(e.equipment.id));assert.equal(virtual.length,3);
 for(const e of virtual){assert.equal(e.straightModelSpine,true);assert.equal(e.x,e.nativePorts[0].x);assert.ok(e.ports[0].wires.every(w=>w.points.every(pt=>pt[0]===e.x)));assert.ok([...p.compartments.values()].some(c=>c.model&&c.axis===e.x));}
 assert.deepEqual(graph,before);
});
test('Hop-over marks only non-electrical interior crossings, preserving real native joins and endpoints',()=>{
 const horizontal={terminalId:'A',points:[[0,20],[80,20]] as const},vertical={terminalId:'B',points:[[40,0],[40,40]] as const};assert.deepEqual(wireCrossings([horizontal,vertical]),[{x:40,y:20,vertical:false,wire:0,other:1}]);
 assert.deepEqual(wireCrossings([horizontal,{...vertical,terminalId:'A'}]),[]);assert.deepEqual(wireCrossings([horizontal,{...vertical,points:[[80,0],[80,40]]}]),[]);assert.deepEqual(wireCrossings([horizontal,{...vertical,points:[[40,20],[40,60]]}]),[]);
});
test('Explicit batch ownership survives rollback of the earlier line energization',()=>{
 const store=new ScenarioStore('ownership');store.replace({...store.current,lineStatus:{L:true},switchState:{CB:true},energizations:{L:{type:'energization',lineId:'L',terminals:[],switches:['CB'],introducedTerminals:[],previousSwitches:{CB:null},previousTerminalStatus:{}}}});
 store.setSwitchStates([{id:'CB',source:false}],true);assert.deepEqual(store.current.energizations?.L.switches,[]);store.setStatus('lineStatus','L',false,false);assert.equal(store.current.switchState.CB,true);
});
