import assert from 'node:assert/strict';
import test from 'node:test';
import type {CanonicalNetwork} from '../../src/domain/model/network';
import {prepareModel} from '../../src/analysis/power-flow/preparation';
import {runStationControlledIsland} from '../../src/analysis/power-flow/station-controls';
import {solveNR} from '../../src/analysis/power-flow/js/newton';
import {aggregateStationAngles} from '../../src/map/electrical-overlays';
import {SettingsStore} from '../../src/persistence/settings';
import type {BusResult} from '../../src/domain/results/types';
import {mapDetailText} from '../../src/map/detail-text';
import {defaultSettings} from '../../src/persistence/settings';

const entity=(id:string)=>({id,name:id,sourceClass:'ElmTerm',sourceId:id,inService:true,siteIds:['S'],sourceRefs:{}});
function fixture(target=1.02,qMin=-100,qMax=100,droop=0):CanonicalNetwork {
  const buses=['B0','B1','B2'].map(id=>({...entity(id),vnKv:154,parentId:'S'}));
  const line=(id:string,from:string,to:string)=>({...entity(id),sourceClass:'ElmLne',from,to,vnKv:154,lengthKm:10,rOhm:2,xOhm:20,bSiemens:0,ratingMva:200,coordinates:[],sections:1});
  return {schemaVersion:1,modelHash:'station-fixture',name:'station-fixture',size:0,baseMva:100,buses,lines:[line('L01','B0','B1'),line('L12','B1','B2')],transformers:[],generators:[{...entity('G1'),sourceClass:'ElmSym',bus:'B1',pMw:20,qMvar:0,vmSet:1.08,voltageControl:true,qMin,qMax}],loads:[{...entity('D2'),sourceClass:'ElmLod',bus:'B2',pMw:40,qMvar:20}],shunts:[],seriesCompensators:[],externalGrids:[{...entity('X0'),sourceClass:'ElmXnet',bus:'B0',pMw:0,qMvar:0,vmSet:1}],internationalConnections:[],switches:[],stationControllers:[{...entity('C1'),sourceClass:'ElmStactrl',remoteBus:'B2',unitIds:['G1'],vmSet:target,droopModeRaw:droop}],secondaryControllers:[],boundaries:[],sites:[],classCounts:{},records:0,warnings:[],capabilities:{powerFlow:{state:'READY',reasons:[]},shortCircuit3Phase:{state:'BLOCKED',reasons:[]},shortCircuitGround:{state:'BLOCKED',reasons:[]},n1:{state:'BLOCKED',reasons:[]}}};
}
function run(network:CanonicalNetwork){const prepared=prepareModel(network);return {baseline:solveNR(prepared.model),controlled:runStationControlledIsland(network,prepared,prepared.diagnostics.stationControllerMappings as {id:string;islandId:string|null;solverBusIndex:number|null}[])};}

test('single-unit remote controller owns local PV and converges toward remote voltage',()=>{
  const {baseline,controlled}=run(fixture()),row=controlled.controllers[0];
  assert.equal(baseline.converged,true);assert.equal(controlled.result.converged,true);
  assert.equal(controlled.prepared.model.busType[row.actuatorBus!],0);
  assert.equal(row.supported,true);assert.equal(row.status,'SATISFIED');
  assert.ok(Math.abs(row.finalVpu!-row.targetVpu)<1e-4);
  assert.ok(Math.abs(row.finalVpu!-row.targetVpu)<Math.abs(baseline.Vm![row.remoteBusIndex!]-row.targetVpu));
  assert.ok(controlled.outerRounds>0);
  assert.ok(row.outerRounds>0&&row.outerRounds<=controlled.outerRounds);
  assert.equal(controlled.unitOverrides.get('G1')?.qMvar,row.finalQ);
});

test('remote controller reports Qmax and Qmin saturation without exceeding limits',()=>{
  for(const [target,expected] of [[1.12,'SATURATED_QMAX'],[.88,'SATURATED_QMIN']] as const){
    const {controlled}=run(fixture(target,-2,2)),row=controlled.controllers[0];
    assert.equal(controlled.result.converged,true);assert.equal(row.status,expected);
    assert.ok(row.finalQ!>=-2-1e-8&&row.finalQ!<=2+1e-8);
    assert.ok(Math.abs(row.voltageResidualPu!)>1e-4);
  }
});

test('unsupported droop preserves the previous numerical result',()=>{
  const {baseline,controlled}=run(fixture(1.02,-100,100,1));
  assert.equal(controlled.controllers[0].status,'UNSUPPORTED_DROOP');assert.equal(controlled.controllers[0].supported,false);
  assert.deepEqual(controlled.result.Vm,baseline.Vm);assert.deepEqual(controlled.result.Va,baseline.Va);
});

test('station angle excludes solved buses below 66 kV and respects the selected band',()=>{
  const row=(id:string,kv:number,deg:number):BusResult=>({id,name:id,terms:[id],siteIds:['S'],vnKv:kv,vmPu:1,angleRad:deg*Math.PI/180,pMw:0,qMvar:0,islandId:'one'});
  const buses=[row('low',34.5,150),row('mid',66,-2),row('high',154,4)];
  const all=aggregateStationAngles(buses,new Set(['low','66','154']));
  assert.equal(all.get('S')?.count,2);assert.equal(all.get('S')?.max,4);
  const selected=aggregateStationAngles(buses,new Set(['low','154']));assert.equal(selected.get('S')?.count,1);assert.equal(selected.get('S')?.representative.id,'high');
});

test('loading settings migrate four legacy thresholds and five custom colors',()=>{
  const settings=new SettingsStore();settings.update({thresholds:[40,60,75,105],loadingColor0:'#101010',loadingColor1:'#202020',loadingColor2:'#303030',loadingColor3:'#404040',loadingColor4:'#505050'},false);
  assert.deepEqual(settings.value.thresholds,[20,40,60,75,90,105]);
  assert.deepEqual([0,1,2,3,4,5,6].map(i=>settings.value[`loadingColor${i}` as keyof typeof settings.value]),['#101010','#101010','#202020','#303030','#404040','#404040','#505050']);
  const fresh=new SettingsStore();assert.deepEqual(fresh.value.thresholds,[25,50,65,80,90,100]);
});

test('line hover reports both-end P/Q/S/I, losses and loading from solved branch data',()=>{
  const network=fixture(),line=network.lines[0],settings=defaultSettings();settings.displayMode='loading';const text=mapDetailText(line,{settings,names:['A TM','B TM'],inService:true,row:{id:line.id,name:line.name,sourceClass:'ElmLne',from:'B0',to:'B1',siteIds:['S'],vnKv:154,pf:12,qf:5,pt:-11,qt:-4,ifA:48,itA:45,loading:35,pLoss:1,qLoss:1}});
  for(const expected of ['12 MW','5 MVAr','13 MVA','48 A','11 MW','4 MVAr','45 A','Kayıp: P 1 MW · Q 1 MVAr','Yüklenme 35 %'])assert.ok(text.includes(expected),expected);
});
