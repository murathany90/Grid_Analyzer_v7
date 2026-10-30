import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { parseSldBinary, serializeSldBinary, type GaSldDocument } from '../../src/features/psse/sld-binary-codec.js';

function fixture(): GaSldDocument {
  return { format: 'ga-sld-v1', fileVersion: '2.0.51.1', layers: [{ n: 0, desc: 'Synthetic', vis: 'Visible' }], components: [
    { id: 1, t: 'Symbol', stype: 'Busbar', map: 'BU 101', layer: 0, color: 255, pos: [0, 0], len: 3, width: 0.1, rot: 90, groupId: 'synthetic-group' },
    { id: 2, t: 'Symbol', stype: 'Busbar', map: 'BU 102', layer: 0, color: 255, pos: [4, 2], len: 2, width: 0.1, rot: 90, groupId: 'synthetic-group' },
    { id: 3, t: 'Link', layer: 0, color: 255, p1: { sym: 1, idx: 0, pos: [1, 0] }, p2: { sym: 2, idx: 0, pos: [4, 2] }, knees: [[1, 1], [4, 1]] },
    { id: 4, t: 'Label', layer: 0, color: 255, pos: [0, -0.3], owner: 1, text: 'Sentetik Bara' },
  ] };
}

const runtime = fs.readFileSync(new URL('../../tools/psse-sld/studio_runtime.js', import.meta.url), 'utf8');
const codec = runtime.slice(runtime.indexOf('/* GENERATED CODEC START */'), runtime.indexOf('/* Part 2:'));
const browser: any = { Uint8Array, DataView, TextEncoder, atob, structuredClone, performance };
vm.createContext(browser);
vm.runInContext(codec + ';globalThis.codec={parseSldBinary,serializeSldBinary};', browser);

for (const [name, api] of [['TypeScript', { parseSldBinary, serializeSldBinary }], ['browser runtime', browser.codec]] as const) {
  test(`${name}: mandatory synthetic native import and immutable endpoint/bus/knee edit`, () => {
    let testedCount = 0;
    for (const version of ['2.0.49.3', '2.0.51.1']) {
      const original = api.parseSldBinary(api.serializeSldBinary(fixture(), version));
      const originalSnapshot = structuredClone(original);
      const edited = { ...original, components: original.components.map((c: any) => c.id === 3 ? { ...c, p1: { ...c.p1, pos: [3.475, 2.15] }, knees: [[3.475, 3], [4, 3]] } : c.id === 1 ? { ...c, len: 5, rot: 0 } : c) };
      const beforeSerialize = structuredClone(edited);
      const reparsed = api.parseSldBinary(api.serializeSldBinary(edited, version));
      assert.deepEqual(structuredClone(original), originalSnapshot, 'source raw graph mutated');
      assert.deepEqual(structuredClone(edited), beforeSerialize, 'edited raw graph mutated');
      const link = reparsed.components.find((c: any) => c.id === 3);
      assert.ok(Math.abs(link.p1.pos[0] - 3.475) < 1e-6);
      assert.ok(Math.abs(link.p1.pos[1] - 2.15) < 1e-6);
      assert.equal(link.knees.length, 2);
      assert.equal(reparsed.components.find((c: any) => c.id === 1).groupId, 'synthetic-group');
      const layer = reparsed._rawLayers[0][2];
      assert.ok(layer.layer_lists[0].length > 0, 'PSS/E draw index empty');
      const bus = reparsed.components.find((c: any) => c.id === 1)._rawObj;
      assert.equal(new DataView(bus.bus_tail.buffer,bus.bus_tail.byteOffset,bus.bus_tail.byteLength).getFloat64(version.includes('49') ? 18 : 20, true), 5);
      assert.equal(reparsed.components.find((c: any) => c.id === 1).len, 5);
      assert.equal(reparsed.components.find((c: any) => c.id === 1).rot, 0);
      const cleared = { ...reparsed, components: reparsed.components.map((c: any) => c.id === 3 ? { ...c, knees: [] } : c) };
      assert.equal(api.parseSldBinary(api.serializeSldBinary(cleared, version)).components.find((c: any) => c.id === 3).knees?.length || 0, 0);
      testedCount++;
    }
    assert.equal(testedCount, 2);
  });
  test(`${name}: invalid endpoint blocks native export`, () => {
    const doc = fixture(); doc.components[2].p1!.sym = 999;
    assert.throws(() => api.serializeSldBinary(doc), /Invalid Link/);
  });
}

test('equipment mapping uses the native CArchive circuit offset and shunt/transformer types', () => {
 const doc=fixture();
 doc.components.push({id:5,t:'Symbol',stype:'Radial',psse:'FixedShunt',map:'FXS 101 2',sdef:5,pos:[0,-1],layer:0,color:255});
 doc.components.push({id:6,t:'Symbol',stype:'Branch',psse:'Transformer',map:'TR 101 102 AB',sdef:10,pos:[2,1],layer:0,color:255});
 const parsed=parseSldBinary(serializeSldBinary(doc));
 for(const [id,type,ckt] of [[5,6,'2'],[6,11,'AB']] as const){
  const raw=parsed.components.find(c=>c.id===id)!._rawObj.map_raw;
  assert.equal(new DataView(raw.buffer,raw.byteOffset,raw.byteLength).getUint32(4,true),type);
  assert.equal(String.fromCharCode(...raw.subarray(24,28)).trim(),ckt);
 }
});

test('native ports use local symbol axes and keep an unconnected fixed port before port 1', () => {
 const doc=fixture();
 Object.assign(doc.components[1],{stype:'Branch',psse:'Branch',sdef:32,map:'LI 101 102 1',len:undefined,width:undefined});
 doc.components[2].p2={sym:2,idx:1,pos:[4.116,2]};
 const parsed=parseSldBinary(serializeSldBinary(doc));
 const link=parsed.components.find(c=>c.id===3)!;
 const p1=Array.isArray(link._rawObj.p1)?link._rawObj.p1[2]:link._rawObj.p1;
 assert.ok(Math.abs(p1.dx)<1e-10);assert.ok(Math.abs(p1.dy+1)<1e-10);
 const raw=parsed.components.find(c=>c.id===2)!._rawObj;
 const ports=raw.ports.map((p:any)=>Array.isArray(p)?p[2]:p);
 assert.deepEqual(ports.map((p:any)=>p.port_idx),[0,1]);
 assert.equal(ports[0].link,null);assert.ok(ports[1].link);
 const label=parsed.components.find(c=>c.id===4)!;
 assert.equal(label.lpos,-1);assert.equal(label.fh,9);
});
