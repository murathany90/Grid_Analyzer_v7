import test from 'node:test';import assert from 'node:assert/strict';
import {ytbsFixture} from '../helpers/sld-ytbs-fixture';
import {connectedStationLayout,type Point} from '../../src/features/sld/physical-layout';
import {allVoltageBands} from '../../src/domain/model/voltage-band';
test('Long native coupler returns do not join short foreign feeder contact escapes',()=>{
  const f=ytbsFixture();for(let i=0;i<16;i++)f.line('MV'+i,154);const graph=f.graph(),before=structuredClone(graph);
  for(const labels of [false,true]){
    const layout=connectedStationLayout(graph,allVoltageBands(),labels),wires=[...layout.routes.flatMap(r=>r.wires),...layout.equipment.flatMap(e=>e.ports.flatMap(p=>p.wires))];
    const segments=wires.flatMap(w=>w.points.slice(1).map((b,i)=>({terminal:w.terminalId,a:w.points[i],b})));
    const overlap=(a:Point,b:Point,c:Point,d:Point)=>a[0]===b[0]&&c[0]===d[0]&&a[0]===c[0]?Math.min(Math.max(a[1],b[1]),Math.max(c[1],d[1]))-Math.max(Math.min(a[1],b[1]),Math.min(c[1],d[1])):a[1]===b[1]&&c[1]===d[1]&&a[1]===c[1]?Math.min(Math.max(a[0],b[0]),Math.max(c[0],d[0]))-Math.max(Math.min(a[0],b[0]),Math.min(c[0],d[0])):0;
    for(let i=0;i<segments.length;i++)for(const other of segments.slice(i+1)){const own=segments[i];if(own.terminal!==other.terminal)assert.ok(overlap(own.a,own.b,other.a,other.b)<=0,`${own.terminal}/${other.terminal}`);}
    assert.equal(layout.routes.length,graph.switches.length);
  }
  assert.deepEqual(graph,before);
});
