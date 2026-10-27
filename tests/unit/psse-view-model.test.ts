import test from 'node:test';
import assert from 'node:assert/strict';
import {decodePsse} from '../../src/importers/psse/decode';
import {normalizePsseBusBranch} from '../../src/domain/psse/network';
import {syntheticRawx} from '../../tools/psse-synthetic-cases';
import {fitPsseProjectedPoints,psseStationViews,psseVoltageGroup,psseVoltageGroups} from '../../src/features/psse/view-model';
import {projectWgs84} from '../../src/map/projection';

test('one inclusive <=36kV view group covers all physical low voltage levels',async()=>{
 for(const kv of [.4,6.3,13.8,31.5,33,34.5,35,36])assert.equal(psseVoltageGroup(kv),'<=36');
 assert.equal(psseVoltageGroup(36.001),'36.001');assert.equal(psseVoltageGroup(null),'unknown');assert.equal(psseVoltageGroup(0),'unknown');
 const model=await decodePsse(new TextEncoder().encode(syntheticRawx()).buffer,'test.rawx'),network=normalizePsseBusBranch(model);
 network.buses.forEach((bus,i)=>bus.baseKv=[33,34.5,36][i]);assert.deepEqual(psseVoltageGroups(network),[{value:'<=36',label:'≤36 kV'}]);
});
test('projected network fit keeps every source point in the padded shared Canvas/SVG viewport',()=>{
 const points=[[26,42],[45,36],[35,39]].map(([lon,lat])=>projectWgs84(lon,lat)),fitted=fitPsseProjectedPoints(points,1200,690,1200/21)!;
 for(const [x,y]of points){const sx=600+fitted.panX+x*(1200/21)*fitted.zoom,sy=345+fitted.panY+y*(1200/21)*fitted.zoom;assert.ok(sx>=36-1e-9&&sx<=1164+1e-9);assert.ok(sy>=36-1e-9&&sy<=654+1e-9);}
 const one=fitPsseProjectedPoints([[7,3]],1200,690,50)!;assert.equal(600+one.panX+7*50*one.zoom,600);assert.equal(345+one.panY+3*50*one.zoom,345);
 assert.equal(fitPsseProjectedPoints([],1200,690,50),null);assert.equal(fitPsseProjectedPoints([[NaN,1]],1200,690,50),null);
});
test('TM selection uses source identity or a unique exact source name, never adjacency',async()=>{
 const model=await decodePsse(new TextEncoder().encode(syntheticRawx()).buffer,'test.rawx'),network=normalizePsseBusBranch(model);
 model.equipment.push({id:'substation:900',kind:'substation',name:'SYNTH 1',buses:[],status:1,nominalKv:null,fields:{isub:900},operating:{}});
 let stations=psseStationViews(model,network);assert.equal(stations.length,1);assert.deepEqual(stations[0].busIndices,[0]);
 model.equipment.push({id:'substation:901',kind:'substation',name:'SYNTH 1',buses:[],status:1,nominalKv:null,fields:{isub:901},operating:{}});
 assert.equal(psseStationViews(model,network).length,0);
 model.equipment.find(e=>e.kind==='bus')!.fields.isub=900;stations=psseStationViews(model,network);assert.deepEqual(stations[0].busIndices,[0]);
});
