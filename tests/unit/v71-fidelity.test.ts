import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {unzipSync,strFromU8} from 'fflate';
import {DgsModel,type DgsRawData} from '../../src/importers/dgs/index';
import {mapCanonical} from '../../src/importers/dgs/canonical';
import {prepareModel} from '../../src/analysis/power-flow/preparation';
import {BrowserJsPowerFlowEngine} from '../../src/analysis/api/browser-js-engine';
import {emptyScenario} from '../../src/domain/scenario/overlay';
import {identity} from '../../src/domain/calculation/identity';
import {aggregateStationAngles} from '../../src/map/electrical-overlays';
import {SettingsStore} from '../../src/persistence/settings';
import {buildResultWorkbook} from '../../src/features/analysis/xlsx-export';
import type {CanonicalNetwork} from '../../src/domain/model/network';
import type {CalculationResult,BusResult} from '../../src/domain/results/types';

test('station controller keeps raw modes, resolves remote terminal and unit FIDs, and exposes unavailable phase',async()=>{
  const raw=JSON.parse(await readFile('tests/fixtures/small-dgs.json','utf8')) as Record<string,unknown>;
  raw.ElmStactrl={Attributes:['FID','loc_name','OP(a:1)','outserv','rembar','psym:SIZEROW','psym:0','i_ctrl','selBus','imode','i_droop','ddroop','Srated','usetp','qsetp','pQmeas','p_cub','iQorient'],Values:[['SC1','Station control','extra OP',0,'T154-PV',1,'GEN154',0,0,0,1,-4,100,1.03,0,'GEN154','',0]]};
  const model=await new DgsModel(raw as DgsRawData,'small',1000).build(),network=mapCanonical(model,'fixture'),controller=network.stationControllers[0];
  assert.equal(controller.controlModeRaw,0);assert.equal(controller.distributionModeRaw,0);assert.equal(controller.droopModeRaw,1);
  assert.equal(controller.unitRefs?.[0].sourceClass,'ElmGenStat');assert.equal(controller.modeSemantics,'CURRENT_PROFILE_VOLTAGE_DISPATCH_P');assert.equal(controller.selectedBusModeRaw,0);
  const prepared=prepareModel(network),summary=prepared.diagnostics.stationControllerSummary as {remoteResolved:number;unitsResolved:number;unsupported:number};
  assert.equal(summary.remoteResolved,1);assert.equal(summary.unitsResolved,1);assert.equal(summary.unsupported,1);
  assert.equal(network.transformers[0].phase,0);assert.equal(network.transformers[0].sourceRefs.phase[0].field,'PHASE_SHIFT_SOURCE_UNAVAILABLE');
});

test('independent referenced islands solve separately and keep island angle provenance',async()=>{
  const entity=(id:string)=>({id,name:id,sourceClass:'ElmTerm',sourceId:id,inService:true,siteIds:[],sourceRefs:{}});
  const buses=['A1','A2','B1','B2'].map(id=>({...entity(id),vnKv:154,parentId:'G1'}));
  const line=(id:string,from:string,to:string)=>({...entity(id),sourceClass:'ElmLne',from,to,vnKv:154,lengthKm:1,rOhm:1,xOhm:10,bSiemens:0,ratingMva:100,coordinates:[],sections:0});
  const source=(id:string,bus:string)=>({...entity(id),sourceClass:'ElmXnet',bus,pMw:0,qMvar:0,vmSet:1});
  const load=(id:string,bus:string)=>({...entity(id),sourceClass:'ElmLod',bus,pMw:20,qMvar:5});
  const network={schemaVersion:1,modelHash:'two-islands',name:'two-islands',size:0,baseMva:100,buses,lines:[line('LA','A1','A2'),line('LB','B1','B2')],transformers:[],generators:[],loads:[load('DA','A2'),load('DB','B2')],shunts:[],seriesCompensators:[],externalGrids:[source('XA','A1'),source('XB','B1')],internationalConnections:[],switches:[],stationControllers:[],secondaryControllers:[],boundaries:[],sites:[],classCounts:{},records:0,warnings:[],capabilities:{powerFlow:{state:'READY',reasons:[]}}} as unknown as CanonicalNetwork;
  const scenario=emptyScenario(),result=await new BrowserJsPowerFlowEngine().runPowerFlow({network,scenario,identity:identity(network.modelHash,scenario,'powerFlow')});
  assert.equal(result.converged,true);assert.equal(result.buses.length,4);assert.equal(result.branches.length,2);
  assert.equal(new Set(result.buses.map(b=>b.islandId)).size,2);assert.equal((result.diagnostics.islands as unknown[]).length,2);
  const multiple={...network,externalGrids:[...network.externalGrids,source('XZ','A2')]};const mapped=prepareModel(multiple);
  assert.ok(mapped.warnings.some(w=>w.includes('MULTIPLE_REFERENCE_PARTIAL')));
  assert.equal((mapped.diagnostics.islands as {referenceCount:number}[]).find(i=>i.referenceCount===2)?.referenceCount,2);
});

test('station angle uses solved filtered bus median without blending independent references',()=>{
  const row=(id:string,angle:number,islandId:string,vnKv=154):BusResult=>({id,name:id,terms:[id],siteIds:['S'],vnKv,vmPu:1,angleRad:angle*Math.PI/180,pMw:0,qMvar:0,islandId});
  const angles=aggregateStationAngles([row('A',-4,'one'),row('B',2,'one'),row('C',6,'one'),row('D',150,'two'),row('E',40,'one',400)],new Set(['154']));
  assert.equal(angles.get('S')?.count,3);assert.equal(angles.get('S')?.groups,2);assert.equal(angles.get('S')?.representative.id,'B');assert.ok(Math.abs((angles.get('S')?.median||0)-2)<1e-10);
  const even=aggregateStationAngles([row('A',-4,'one'),row('B',2,'one')],new Set(['154']));assert.ok(Math.abs((even.get('S')?.median||0)+1)<1e-10);
});

test('map parameter settings survive typed serialization and reject invalid scales',()=>{
  const source=new SettingsStore();source.update({displayMode:'angle',angleMin:-30,angleNeutral:0,angleMax:25,color220:'#112233',magnitudePercentile:90},false);
  const restored=new SettingsStore();restored.update(JSON.parse(JSON.stringify(source.value)),false);
  assert.equal(restored.value.displayMode,'angle');assert.equal(restored.value.angleMax,25);assert.equal(restored.value.color220,'#112233');assert.equal(restored.value.magnitudePercentile,90);
  restored.update({angleMin:40,angleNeutral:0,angleMax:20,voltageMax:.5},false);assert.equal(restored.value.angleMin,-30);assert.equal(restored.value.voltageMax,1.10);
});

test('single offline XLSX export has four worksheet parts and stores numbers as numeric cells',()=>{
  const scenario=emptyScenario(),result={identity:identity('m',scenario,'powerFlow'),status:'CONVERGED_FULL_NR',converged:true,iterations:4,rounds:1,maxMismatchMw:0,elapsedMs:1,buses:[{id:'B1',name:'Bus',terms:['B1'],siteIds:[],vnKv:154,vmPu:1.03,angleRad:0,pMw:1,qMvar:2}],branches:[],generators:[],diagnostics:{},warnings:[],quality:{numericalStatus:'CONVERGED',controlFidelity:'PARTIAL',referenceValidation:'NOT_AVAILABLE'}} as CalculationResult;
  const files=unzipSync(buildResultWorkbook(result,{generators:[]} as unknown as CanonicalNetwork));
  assert.deepEqual(['Buses','Branches','Generators','Diagnostics'].map((_,i)=>!!files[`xl/worksheets/sheet${i+1}.xml`]),[true,true,true,true]);
  const buses=strFromU8(files['xl/worksheets/sheet1.xml']);assert.match(buses,/<v>1\.03<\/v>/);assert.match(buses,/<v>158\.62<\/v>/);
  assert.match(strFromU8(files['xl/workbook.xml']),/name="Diagnostics"/);
});
