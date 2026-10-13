import test from 'node:test';
import assert from 'node:assert/strict';
import {switchSymbolDefinition} from '../../src/features/sld/symbols';
import {ytbsFixture} from '../helpers/sld-ytbs-fixture';
import {stationOverviewPage} from '../../src/features/sld/page-layout';
import {allVoltageBands} from '../../src/domain/model/voltage-band';
import {obstacleIntersections} from '../../src/features/sld/orthogonal-router';

// Independently transcribed normalized contact geometry from V0 ÇİZİM TABLOSU E2/F2/E3/F3.
const contacts=[[0,-16],[0,16]];
test('V0 KE-01 breaker has centred fixed contacts and an outlined body in both states',()=>{
 for(const closed of [false,true]){const s=switchSymbolDefinition('KE-01',closed);assert.deepEqual(s.contacts,contacts);assert.deepEqual(s.body,{x:-7,y:-10,width:14,height:20});assert.deepEqual(s.stubs,[[[0,-16],[0,-6]],[[0,6],[0,16]]]);}
 assert.deepEqual(switchSymbolDefinition('KE-01',true).bridge,[[0,-6],[4,-6],[4,6],[0,6]]);
 assert.deepEqual(switchSymbolDefinition('KE-01',false).blade,[[0,6],[6,-5]]);
});
test('V0 common disconnector has a real open gap and the closed contact bridge',()=>{
 const open=switchSymbolDefinition('GENERIC_DISCONNECTOR',false),closed=switchSymbolDefinition('GENERIC_DISCONNECTOR',true);
 assert.deepEqual(open.contacts,contacts);assert.equal(open.body,null);assert.deepEqual(open.bridge,[]);assert.ok(Math.hypot(open.blade.at(-1)![0],open.blade.at(-1)![1]+6)>6);
 assert.deepEqual(closed.bridge,[[0,-6],[4,-6],[4,6],[0,6]]);assert.deepEqual(closed.blade,[]);
});
test('An unidentified switch never acquires a breaker or a conducting contact bridge',()=>{
 const s=switchSymbolDefinition('UNSPECIFIED',true);assert.equal(s.partial,true);assert.equal(s.body,null);assert.deepEqual(s.bridge,[]);assert.deepEqual(s.blade,[]);
});
test('A proved breaker with unknown position cannot claim an open or closed contact',()=>{
 const s=switchSymbolDefinition('KE-01',null);assert.equal(s.partial,true);assert.ok(s.body);assert.deepEqual(s.bridge,[]);assert.deepEqual(s.blade,[]);
});
test('Reference-like feeder names cannot create motors, earth switches, CT, VT or transformers',()=>{
 const f=ytbsFixture();f.n.transformers=[];f.line('X',400);
 f.source.bays=f.source.bays.map(b=>({...b,name:'400/33 trafo motorlu topraklama CT VT',attributes:{...b.attributes,feederFunction:'ÖLÇÜ+BARA TOPRAK'}}));
 const before=structuredClone(f.n),g=f.graph(),p=stationOverviewPage(g,allVoltageBands());
 assert.equal(g.equipment.some(e=>e.sourceClass.startsWith('ElmTr')),false);
 assert.equal(p.equipment.some(e=>e.equipment.kind.startsWith('transformer')),false);
 assert.deepEqual(new Set(p.equipment.map(e=>e.equipment.sourceClass+'|'+e.equipment.id)),new Set(g.equipment.map(e=>e.sourceClass+'|'+e.id)));
 assert.equal(p.routes.length,f.n.switches.length);assert.deepEqual(f.n,before);
 assert.ok(g.switches.every(s=>s.sourceUsage==='dct'||s.sourceUsage==='cbk'));
});
test('on_off without aUsage cannot declare a breaker or disconnector',()=>{
 const f=ytbsFixture();f.source.switches=f.source.switches.map(s=>({...s,attributes:{fold_id:s.attributes.fold_id,on_off:1}}));
 assert.ok(f.graph().switches.every(s=>s.kind==='switch'&&!s.sourceUsage));
});
test('Real 400/33 winding retains both FIDs, sits below HV, and clears unrelated native rails',()=>{
 const f=ytbsFixture();f.n.transformers.push({...f.n.transformers[0],id:'DIRECT',sourceId:'DIRECT',name:'DIRECT',from:'Ht',to:'Lt',lvKv:33});
 const before=structuredClone(f.n),g=f.graph(),p=stationOverviewPage(g,allVoltageBands()),t=p.equipment.find(e=>e.equipment.id==='DIRECT')!;
 assert.deepEqual(t.equipment.terminals,['Ht','Lt']);assert.deepEqual(t.ports.map(p=>p.terminalId),['Ht','Lt']);
 assert.ok(t.y>Math.max(...p.sections.filter(b=>b.section.voltageKv===400).map(b=>b.y)));
 // V3.2 permits the closest external side; the zero-intersection and native
 // winding assertions below retain the original electrical safety requirement.
 const lv=t.ports.find(p=>p.side===1)!;assert.ok(lv.corridor!<Math.min(...p.sections.map(b=>b.x1))||lv.corridor!>Math.max(...p.sections.map(b=>b.x2)));
 for(const w of lv.wires){assert.equal(obstacleIntersections(w.points,p.sections.map(b=>({id:b.section.id,x1:b.x1,x2:b.x2,y1:b.y-.1,y2:b.y+.1}))),0);assert.deepEqual(w.points.at(-1),lv.point);}
 assert.equal(new Set(p.routes.map(r=>r.sw.sourceClass+'|'+r.sw.sourceId)).size,g.switches.length);assert.deepEqual(f.n,before);
});
