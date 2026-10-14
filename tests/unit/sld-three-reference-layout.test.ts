import test from 'node:test';
import assert from 'node:assert/strict';
import {ytbsFixture} from '../helpers/sld-ytbs-fixture';
import {connectedStationLayout} from '../../src/features/sld/physical-layout';
import {allVoltageBands} from '../../src/domain/model/voltage-band';

test('Reference coupler is vertical below an 18-unit bus bundle and cannot bridge its open breaker',()=>{
 const f=ytbsFixture();f.term('H2',400,'G400',true);f.sw('HC','H','H2','FHC','cbk',false);
 const g=f.graph();g.siteId='M1482';const before=structuredClone(g),p=connectedStationLayout(g,allVoltageBands()),r=p.routes.find(r=>r.sw.id==='HC')!,bars=p.sections.filter(b=>b.section.voltageKv===400);
 assert.equal(Math.abs(bars[0].y-bars[1].y),18);assert.equal(r.rotation,0);assert.ok(r.y>Math.max(...bars.map(b=>b.y))+18);
 for(const w of p.routes.flatMap(r=>r.wires))for(let i=1;i<w.points.length;i++){const a=w.points[i-1],b=w.points[i];assert.ok(!(a[0]===b[0]&&Math.abs(a[0]-r.x)<1&&Math.min(a[1],b[1])<r.y&&Math.max(a[1],b[1])>r.y),'a conductor crossed the open contact');}
 assert.deepEqual(g,before);
});

test('Separate low-voltage source groups share one visual level even with different nominal voltages',()=>{
 const f=ytbsFixture();f.term('L2',33.6,'SECOND',true);f.term('L2out',33.6,'FL2');f.sw('L2CB','L2','L2out','FL2','cbk');
 const g=f.graph();g.siteId='M937';const before=structuredClone(g),p=connectedStationLayout(g,allVoltageBands()),a=p.sections.find(b=>b.section.id==='L')!,b=p.sections.find(b=>b.section.id==='L2')!;
 assert.equal(a.y,b.y);assert.ok(a.x2<b.x1);assert.notEqual(a.section.voltageKv,b.section.voltageKv);assert.deepEqual(g,before);
});

test('Source bank leaves remain independent of winding terminals and sit beyond the winding axes',()=>{
 const f=ytbsFixture();f.n.transformers.push({...f.n.transformers[0],id:'T1parallel',sourceId:'T1parallel'});
 f.term('leaf1',400,'FH');f.term('leaf2',400,'FH');f.sw('leafDS1','Ht','leaf1','FH');f.sw('leafDS2','Ht','leaf2','FH');
 const g=f.graph();g.siteId='M1482';const before=structuredClone(g),p=connectedStationLayout(g,allVoltageBands()),windings=p.equipment.filter(e=>['T1','T1parallel'].includes(e.equipment.id));
 for(const id of ['leaf1','leaf2']){assert.ok(p.ports.get(id)!.x>Math.max(...windings.map(w=>w.x)));assert.ok(g.equipment.every(e=>!e.terminals.includes(id)));}
 assert.deepEqual(g,before);assert.equal(p.routes.length,g.switches.length);
});
