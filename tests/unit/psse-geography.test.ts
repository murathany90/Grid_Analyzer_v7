import test from 'node:test';
import assert from 'node:assert/strict';
import type {PsseEquipment,PsseModel} from '../../src/importers/psse/types';
import {decodeRawx} from '../../src/importers/psse/raw';
import {normalizePsseBusBranch} from '../../src/domain/psse/network';
import {syntheticRawx} from '../../tools/psse-synthetic-cases';
import {buildGeoSnapshot,normalizeSourceAlias} from '../../src/features/psse/geography';
import {isLowVoltageGroup} from '../../src/features/psse/diagram-utils';

const busEquipment=(model:PsseModel)=>model.equipment.filter(item=>item.kind==='bus');
function station(id:string,name:string,latitude:unknown,longitude:unknown):PsseEquipment{return{id,kind:'substation',name,buses:[],status:1,nominalKv:null,fields:{isub:id,latitude,longitude},operating:{}};}
function modelWithStations(configure:(buses:PsseEquipment[],model:PsseModel)=>PsseEquipment[]):{model:PsseModel;network:ReturnType<typeof normalizePsseBusBranch>}{
 const decoded=decodeRawx(new TextEncoder().encode(syntheticRawx()),'geo.rawx'),buses=busEquipment(decoded).map(item=>({...item,fields:{...item.fields}})),other=decoded.equipment.filter(item=>item.kind!=='bus');
 const model={...decoded,equipment:[...other,...buses,...configure(buses,decoded)]};return{model,network:normalizePsseBusBranch(model)};
}

test('PSS/E geography accepts explicit native isub and exact unique source-name aliases only',()=>{
 const {model,network}=modelWithStations(buses=>{
  buses[0].fields.isub=1001;buses[0].name='Explicit bus';buses[1].name='Marmara İstasyonu  1';buses[2].name='No verified station';
  return[station('1001','Different station label',40.2,29.1),station('1002',' marmara istasyonu 1 ',39.1,33.2)];
 });
 const geo=buildGeoSnapshot(model,network);
 assert.equal(geo.counts.sourceStations,2);assert.equal(geo.counts.validCoordinateStations,2);
 assert.deepEqual(geo.associations.map(row=>row.method),['EXPLICIT_SOURCE_REFERENCE','EXACT_UNIQUE_SOURCE_NAME_ALIAS']);
 assert.equal(geo.associations[0].stationIsub,'1001');assert.equal(geo.associations[1].stationIsub,'1002');
 assert.equal(geo.counts.unmatchedBuses,1);assert.equal(geo.unmatched[0].reason,'NO_STATION_REFERENCE');
 assert.deepEqual(geo.unreferencedStationIsubs,[]);assert.equal(geo.sourceSha256,model.source.sha256);
});

test('PSS/E geography rejects ambiguous aliases, guessed coordinates, and zero or invalid WGS84 coordinates',()=>{
 const {model,network}=modelWithStations(buses=>{
  buses[0].name='Direct reference';buses[0].fields.isub=1001;buses[1].name='DUPLİCATE SİTE';buses[2].fields.isub=1003;
  const duplicate=station('1001-copy','duplicate site',41,31);duplicate.fields.isub=1001;
  return[station('1001','duplicate site',40,30),station('1002',' Duplicate  Site ',40.1,30.1),duplicate,station('1003','Invalid location',0,32)];
 });
 const geo=buildGeoSnapshot(model,network);
 assert.equal(geo.counts.ambiguousBuses,1);assert.equal(geo.unmatched.find(row=>row.busId===network.buses[1].id)?.reason,'AMBIGUOUS_STATION_NAME');
 assert.equal(geo.unmatched.find(row=>row.busId===network.buses[0].id)?.reason,'AMBIGUOUS_STATION_REFERENCE');
 assert.equal(geo.unmatched.find(row=>row.busId===network.buses[2].id)?.reason,'STATION_COORDINATE_INVALID');
 assert.deepEqual(geo.stations.map(row=>row.isub),['1002']);assert.deepEqual(geo.invalidCoordinateStationIsubs,['1003']);
});

test('PSS/E source aliases use NFKC, whitespace collapse, trim, and Turkish case folding',()=>{
 assert.equal(normalizeSourceAlias('  İSTASYON\tＡ  '),normalizeSourceAlias('İstasyon A'));
 assert.equal(normalizeSourceAlias(42),'');
});

test('the explicit ≤36 kV group includes 36 and every known lower level, but excludes unknown bases',()=>{
 assert.equal(isLowVoltageGroup(36),true);assert.equal(isLowVoltageGroup(33),true);assert.equal(isLowVoltageGroup(36.1),false);assert.equal(isLowVoltageGroup(400),false);assert.equal(isLowVoltageGroup(null),false);
});
