import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {syntheticSav} from '../fixtures/psse-synthetic-sav';
import {decodeSav} from '../../src/importers/psse/sav';
import {validatePsse} from '../../src/importers/psse/common';

const near = (actual: unknown, expected: number) => assert.ok(typeof actual === 'number' && Math.abs(actual - expected) < 0.00001, `${String(actual)} != ${expected}`);
test('native SAV reconstructs source IDs, linked electrical equipment, ZIP load and all ratings', () => {
  const model = decodeSav(syntheticSav(), 'synthetic.sav'); validatePsse(model);
  assert.equal(model.completeness, 'COMPLETE'); assert.deepEqual(model.analyses, {powerFlow:'BLOCKED',shortCircuit:'BLOCKED',n1:'BLOCKED'});
  const get = (kind: string) => model.equipment.find(e => e.kind === kind)!;
  const generator=get('generator'), load=get('load'), line=get('line'), transformer=get('transformer'), sw=get('switch');
  assert.equal(generator.id,'generator:101:G1'); assert.deepEqual(generator.buses,[101]); near(generator.fields.pg,50); near(generator.fields.qg,12); near(generator.fields.zx,0.2); near(generator.fields.mbase,75);
  assert.equal(load.id,'load:103:L1'); assert.deepEqual(load.buses,[103]);
  for(const [field,expected] of [['pl',40],['ql',10],['ip',2],['iq',3],['yp',4],['yq',-5]] as const)near(load.fields[field],expected);
  near(line.fields.rpu,0.01);near(line.fields.xpu,0.1);near(line.fields.bpu,0.03);near(line.fields.bi,0.02);near(line.fields.bj,0.04);
  assert.equal(line.fields.bp,0);assert.equal(line.operating.bp.value,0);assert.equal(line.operating.bp.field,'SAV.Bypass[1]');assert.equal(line.operating.bp.provenance,'SOURCE_SAVED');assert.ok(line.operating.bp.offset!>0);
  assert.deepEqual(Array.from({length:12},(_,i)=>line.fields[`rate${i+1}`]),Array.from({length:12},(_,i)=>100+i));
  assert.equal(transformer.id,'transformer:102:103:T1');assert.deepEqual(transformer.buses,[102,103]);near(transformer.fields.r12Pu,0.02);near(transformer.fields.x12Pu,0.2);near(transformer.fields.ratio1Pu,1.05);near(transformer.fields.ang1,30);
  assert.deepEqual(Array.from({length:12},(_,i)=>transformer.fields[`wdg1rate${i+1}`]),Array.from({length:12},(_,i)=>200+i));
  assert.equal(sw.fields.stype,2);assert.equal(sw.fields.nstat,1);assert.equal(sw.status,0);
  assert.ok(model.equipment.some(e=>e.kind==='other'&&e.fields.subtype==='voltage-droop'));
  assert.equal(model.case.xfrrat,0);assert.equal(model.case.nxfrat,1);
  assert.equal(generator.operating.pg.provenance,'DERIVED_FROM_SOURCE');assert.ok(generator.operating.pg.offset!>0);
  assert.ok(model.binaryArrays?.Cfdlfr);assert.ok(model.binaryArrays?.Ratings);
});

test('native SAV rejects orphan, aliased and cyclic electrical linked lists',()=>{
  assert.throws(()=>decodeSav(syntheticSav({Ldfrst:[0,0,0]}),'orphan.sav'),/SAV_ORPHAN_RECORD/);
  assert.throws(()=>decodeSav(syntheticSav({Ldnext:[1]}),'cycle.sav'),/SAV_LINK_CYCLE_OR_ALIAS/);
  assert.throws(()=>decodeSav(syntheticSav({Ifirst:[1,1,2]}),'alias.sav'),/SAV_LINK_CYCLE_OR_ALIAS/);
  assert.throws(()=>decodeSav(syntheticSav({Ito:[999,2,3]}),'missing-bus.sav'),/SAV_MISSING_BUS_POINTER/);
});

test('native SAV preserves isolated source status and catches a disabled slack machine',()=>{
  const model=decodeSav(syntheticSav({Mxstat:[0]}),'inactive-generator.sav');validatePsse(model);
  assert.equal(model.completeness,'PARTIAL');assert.ok(model.findings.some(f=>f.code==='NO_ACTIVE_SLACK'));
});

test('native SAV source operating state and parameter goldens are deterministic',()=>{
  const equipment=decodeSav(syntheticSav(),'synthetic.sav').equipment;
  const digest=createHash('sha256').update(JSON.stringify(equipment)).digest('hex');
  assert.equal(digest,'1711f7185f270b032bad920c5f2d77cb2d758df24d04e10647ec65f5b6174821');
  // The only source-contract extension is BP plus its original byte provenance.
  // Retain the complete previous golden to detect changes in every older field.
  const previous=structuredClone(equipment);
  for(const item of previous)if(item.kind==='line'||item.kind==='switch'){delete item.fields.bp;delete item.operating.bp;}
  assert.equal(createHash('sha256').update(JSON.stringify(previous)).digest('hex'),'c394ffaad414ac52c07ec41769e95fcb30729935547ce2e8f5478d789c5ec251');
});

test('native SAV display labels decode valid UTF-8 without changing source bytes or IDs',()=>{
  const raw='L\xc3\x9cNE'.padEnd(40,' ')+'TRANSFORMER'.padEnd(40,' ')+'SWITCH'.padEnd(40,' ');
  const model=decodeSav(syntheticSav({Brname:[raw]}),'utf8-label.sav');
  assert.equal(model.equipment.find(e=>e.kind==='line')!.name,'LÜNE');
  assert.equal(model.equipment.find(e=>e.kind==='line')!.id,'line:101:102:A');
  assert.equal(model.binaryArrays!.Brname.values[0],raw);
});
