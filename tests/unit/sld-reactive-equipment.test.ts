import test from 'node:test';
import assert from 'node:assert/strict';
import {shuntSymbol,seriesSymbol} from '../../src/domain/model/reactive-symbol';
import type {Shunt,SeriesCompensator} from '../../src/domain/model/network';
import {ytbsFixture} from '../helpers/sld-ytbs-fixture';
import {connectedStationLayout,physicalStationLayout} from '../../src/features/sld/physical-layout';
import {allVoltageBands} from '../../src/domain/model/voltage-band';

test('Reactive types follow resolved ratings rather than misleading equipment names',()=>{
 assert.equal(shuntSymbol({name:'KAPASITOR',nominalQMvar:-100,stepProvenance:'qrean'} as Shunt),'shunt-reactor');
 assert.equal(shuntSymbol({name:'REAKTOR',nominalQMvar:50,stepProvenance:'qcapn'} as Shunt),'capacitor-bank');
 assert.equal(shuntSymbol({nominalQMvar:-100,stepProvenance:'INVALID_MTAPS'} as Shunt),'reactive-equivalent');
 assert.equal(shuntSymbol({bPu:0} as Shunt),'reactive-equivalent');
 assert.equal(seriesSymbol({xOhm:-45} as SeriesCompensator),'series-capacitor');
 assert.equal(seriesSymbol({xOhm:10} as SeriesCompensator),'series-reactor');
 assert.equal(seriesSymbol({xOhm:0} as SeriesCompensator),'reactive-equivalent');
});

test('Series equipment has two distinct contacts with original FROM/TO FIDs in both layouts',()=>{
 const f=ytbsFixture();f.term('SERIES_A',154,'FS');f.term('SERIES_B',154,'FS');f.sw('SCB','M','SERIES_A','FS','cbk',false);
 f.n.seriesCompensators=[{id:'SCAP',sourceId:'SCAP',sourceClass:'ElmScap',name:'SERIES',from:'SERIES_A',to:'SERIES_B',rOhm:0,xOhm:-45,inService:true,sourceRefs:{},siteIds:['S']}];
 const g=f.graph(),before=structuredClone(g);assert.equal(g.equipment.find(e=>e.id==='SCAP')!.reactiveSymbol,'series-capacitor');
 for(const layout of [connectedStationLayout(g,allVoltageBands()),physicalStationLayout(g,allVoltageBands())]){
  const e=layout.equipment.find(e=>e.equipment.id==='SCAP')!;assert.equal(e.ports.length,2);assert.notDeepEqual(e.ports[0].point,e.ports[1].point);
  assert.equal(Math.abs(e.ports[0].point[1]-e.ports[1].point[1]),36);
  for(const [i,p]of e.ports.entries()){assert.equal(p.side,i);assert.equal(p.terminalId,['SERIES_A','SERIES_B'][i]);assert.deepEqual(p.wires[0].points[0],[e.nativePorts[i].x,e.nativePorts[i].y]);assert.deepEqual(p.wires[0].points.at(-1),p.point);}
 }
 assert.deepEqual(g,before);
});

test('Shunt branches have one source contact on the symbol endpoint and no invented ground node',()=>{
 const f=ytbsFixture();f.n.shunts=[{id:'RE',sourceId:'RE',sourceClass:'ElmShnt',name:'RE',bus:'M',gPu:0,bPu:-1,nominalQMvar:-100,stepProvenance:'qrean',inService:true,sourceRefs:{},siteIds:['S']}];
 const g=f.graph(),before=structuredClone(g),e=connectedStationLayout(g,allVoltageBands()).equipment.find(e=>e.equipment.id==='RE')!;
 assert.equal(e.equipment.reactiveSymbol,'shunt-reactor');assert.equal(e.ports.length,1);assert.equal(Math.abs(e.ports[0].point[1]-e.y),18);assert.equal(g.connections.find(c=>c.sourceId==='RE')!.terminals.length,1);assert.deepEqual(g,before);
});

test('Source-only series inductors use cubicle FIDs and disclose unsupported calculations',()=>{
 const f=ytbsFixture();f.source.cubicles=[{id:'CA',name:'CA',attributes:{fold_id:'Mt',obj_id:'IND'}},{id:'CB',name:'CB',attributes:{fold_id:'Mp',obj_id:'IND'}}];
 f.source.seriesReactors=[{id:'IND',name:'IND',attributes:{bus1:'CA',bus2:'CB'}}];
 const g=f.graph(),e=g.equipment.find(e=>e.id==='IND')!;assert.deepEqual(e.terminals,['Mt','Mp']);assert.equal(e.reactiveSymbol,'series-reactor');assert.equal(e.diagramOnly,true);assert.ok(g.issues.some(i=>i.sourceId==='IND'&&i.kind==='unsupportedEquipmentConnections'));
 assert.notDeepEqual(connectedStationLayout(g,allVoltageBands()).equipment.find(e=>e.equipment.id==='IND')!.ports[0].point,connectedStationLayout(g,allVoltageBands()).equipment.find(e=>e.equipment.id==='IND')!.ports[1].point);
 f.source.seriesReactors=[{id:'BROKEN',name:'BROKEN',attributes:{bus1:'MISSING',bus2:'CB'}}];assert.ok(f.graph().issues.some(i=>i.sourceId==='BROKEN'&&i.kind==='unresolvedEquipmentConnections'));
});
