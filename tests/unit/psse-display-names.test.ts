import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeRawx} from '../../src/importers/psse/raw';
import {normalizePsseBusBranch} from '../../src/domain/psse/network';
import type {PsseEquipment} from '../../src/importers/psse/types';
import {createPsseDisplayNames} from '../../src/features/psse/display-names';
import {syntheticRawx} from '../../tools/psse-synthetic-cases';

function fixture(){const model=decodeRawx(new TextEncoder().encode(syntheticRawx()),'names.rawx');return{model,buses:model.equipment.filter(e=>e.kind==='bus')};}
const station=(id:number,name:string):PsseEquipment=>({id:`substation:${id}`,kind:'substation',name,buses:[],status:null,nominalKv:null,fields:{isub:id},operating:{}});

test('display names retain exact source labels and technical IDs only in title/search context',()=>{
 const {model,buses}=fixture();buses[0].name='İSTASYON ALFA';buses[0].fields.name='İSTASYON ALFA';const network=normalizePsseBusBranch(model),names=createPsseDisplayNames(model,network);
 assert.equal(names.bus(network.buses[0]),'İSTASYON ALFA');assert.ok(!names.bus(network.buses[0]).includes('bus:'));assert.ok(names.busTitle(network.buses[0]).includes(network.buses[0].connectionKey));assert.ok(names.busSearchText(network.buses[0]).includes(network.buses[0].id));assert.equal(createPsseDisplayNames(model,network),names);
});
test('numeric technical bus labels prefer an exact source station even without coordinates',()=>{
 const {model,buses}=fixture();buses[0].name='1';buses[0].fields.name='1';buses[0].fields.isub=470;model.equipment.push(station(470,'GERÇEK TM ADI'));const network=normalizePsseBusBranch(model),names=createPsseDisplayNames(model,network);
 assert.equal(names.bus(network.buses[0]),'GERÇEK TM ADI');assert.equal(names.station(network.buses[0]),'GERÇEK TM ADI');assert.ok(!names.bus(network.buses[0]).includes(network.buses[0].id));
});
test('missing source names and ambiguous source station IDs never invent a city or decode a bus number',()=>{
 const {model,buses}=fixture();buses[0].name='1';buses[0].fields.name='1';buses[0].fields.isub=99;model.equipment.push(station(99,'A'),{...station(99,'B'),id:'substation:duplicate'});const network=normalizePsseBusBranch(model),names=createPsseDisplayNames(model,network);
 assert.equal(names.station(network.buses[0]),null);assert.equal(names.bus(network.buses[0]),'Adı kayıtlı olmayan bara');
});
test('only an exact unique source alias may associate an otherwise unreferenced bus with a station',()=>{
 const {model,buses}=fixture();buses[0].name='İSTASYON A';buses[0].fields.name='İSTASYON A';buses[1].name='İSTASYON';buses[1].fields.name='İSTASYON';model.equipment.push(station(71,' istasyon  a '));const network=normalizePsseBusBranch(model),names=createPsseDisplayNames(model,network);
 assert.equal(names.station(network.buses[0]),'istasyon  a');assert.equal(names.station(network.buses[1]),null);
});
test('branch labels use source names, named physical endpoints, kV and source circuit identity',()=>{
 const {model}=fixture(),source=model.equipment.find(e=>e.kind==='line')!;source.name=source.id;source.fields.name=source.id;source.fields.ckt='II';const network=normalizePsseBusBranch(model),names=createPsseDisplayNames(model,network),branch=network.branches[0],label=names.branch(branch);
 assert.ok(label.includes('SYNTH 1 110 kV → SYNTH 2 110 kV'));assert.ok(label.includes('Devre II'));assert.ok(!label.includes(source.id));assert.ok(names.branchTitle(branch).includes(source.id));
});
