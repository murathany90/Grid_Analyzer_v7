import test from 'node:test';import assert from 'node:assert/strict';
import {ytbsFixture} from '../helpers/sld-ytbs-fixture';
import {connectedStationLayout} from '../../src/features/sld/physical-layout';
import {allVoltageBands} from '../../src/domain/model/voltage-band';
test('Station identity cannot select a different drawing policy',()=>{
 const g=ytbsFixture().graph(),before=structuredClone(g),shape=(id:string)=>{const p=connectedStationLayout({...g,siteId:id},allVoltageBands());return{rails:p.sections.map(b=>[b.section.id,b.x1,b.x2,b.y]),devices:p.routes.map(r=>[r.sw.id,r.x,r.y,r.rotation,r.wires]),equipment:p.equipment.map(e=>[e.equipment.id,e.x,e.y,e.ports])};};
 assert.deepEqual(shape('ANY_UNKNOWN_TM'),shape('M1482'));assert.deepEqual(shape('NEW_IMPORTED_STATION'),shape('M937'));assert.deepEqual(g,before);
});
test('A source feeder with a different nominal voltage still draws every switch on its actual rail',()=>{
 const f=ytbsFixture();f.term('mismatch',33.6,'FN');f.sw('nominalCB','L','mismatch','FN','cbk');const g=f.graph(),before=structuredClone(g),p=connectedStationLayout(g,allVoltageBands());
 assert.equal(p.feeders.length,g.feeders.length);const r=p.routes.find(r=>r.sw.id==='nominalCB')!;assert.equal(r.a!.terminalId,'L');assert.equal(r.b!.terminalId,'mismatch');assert.ok(Number.isFinite(r.y));assert.deepEqual(g,before);
});
test('A cross-bay connection cannot move the native terminal out of its owning feeder',()=>{
 const f=ytbsFixture();f.term('H2',400,'G400',true);f.sw('sharedSelector','H2','Ht','OTHER_BAY');const g=f.graph(),before=structuredClone(g),p=connectedStationLayout(g,allVoltageBands());
 assert.equal(p.ports.get('Ht')!.seriesFeeder,'FH');assert.equal(p.routes.length,g.switches.length);assert.deepEqual(g,before);
});
test('Two selectors from the same source bay and same busbar receive distinct physical axes',()=>{
 const f=ytbsFixture();f.term('alternateEnd',400,'FH');f.sw('secondSelector','H','alternateEnd','FH');const g=f.graph(),before=structuredClone(g),p=connectedStationLayout(g,allVoltageBands()),a=p.routes.find(r=>r.sw.id==='H_CB')!,b=p.routes.find(r=>r.sw.id==='secondSelector')!;
 assert.ok(Math.abs(a.x-b.x)>=32);assert.equal(a.sw.from,b.sw.from);assert.notEqual(a.sw.to,b.sw.to);assert.equal(p.routes.length,g.switches.length);assert.deepEqual(g,before);
});
test('Two autotransformer windings retain their own native HV and LV breakers and open contacts',()=>{
 const f=ytbsFixture();f.term('HV2',400,'FHV2');f.term('LV2',154,'FLV2');f.sw('HV2CB','H','HV2','FHV2','cbk',false);f.sw('LV2CB','M','LV2','FLV2','cbk',false);
 f.n.transformers.push({...f.n.transformers[0],id:'OTR2',sourceId:'OTR2',from:'HV2',to:'LV2'});const g=f.graph();for(const e of g.equipment.filter(e=>e.kind==='transformer'))e.autoTransformer=true;
 const before=structuredClone(g),p=connectedStationLayout(g,allVoltageBands());for(const id of ['HV2CB','LV2CB']){const r=p.routes.find(r=>r.sw.id===id)!;assert.equal(r.sw.kind,'breaker');assert.deepEqual(r.wires[0].points.at(-1),r.contactFrom);assert.deepEqual(r.wires[1].points[0],r.contactTo);
  for(const w of [...p.routes.flatMap(r=>r.wires),...p.equipment.flatMap(e=>e.ports.flatMap(p=>p.wires))])for(let i=1;i<w.points.length;i++){const a=w.points[i-1],b=w.points[i];assert.ok(!(a[0]===b[0]&&a[0]===r.x&&Math.min(a[1],b[1])<r.y&&Math.max(a[1],b[1])>r.y),'an OTR open contact was bypassed');}}
 assert.deepEqual(g,before);assert.ok(p.equipment.find(e=>e.equipment.id==='OTR2')!.ports.some(p=>p.terminalId==='HV2'));assert.ok(p.equipment.find(e=>e.equipment.id==='OTR2')!.ports.some(p=>p.terminalId==='LV2'));
});
