import assert from 'node:assert/strict';
import test from 'node:test';
import {unzipSync,strFromU8} from 'fflate';
import type {CanonicalNetwork} from '../../src/domain/model/network';
import type {CalculationResult} from '../../src/domain/results/types';
import {identity} from '../../src/domain/calculation/identity';
import {emptyScenario} from '../../src/domain/scenario/overlay';
import {preflightPowerFactoryReference} from '../../src/analysis/validation/powerfactory-preflight';
import {comparePowerFactoryReference,type PowerFactoryReference} from '../../src/analysis/validation/powerfactory-reference';
import {comparisonSheets} from '../../src/features/analysis/comparison-export';
import {buildWorkbook} from '../../src/features/analysis/xlsx-export';
import {qLoadingPercent,pLoadingPercent} from '../../src/map/result-style';
import {defaultSettings,SettingsStore} from '../../src/persistence/settings';

const entity=(id:string)=>({id,name:id,sourceClass:'ElmTerm',sourceId:id,inService:true,siteIds:[],sourceRefs:{}});
function fixture(){
  const network={schemaVersion:1,modelHash:'hash',name:'20261002_1300_DA5_TR0',studyCase:'20261002_1300_DA5_TR0',size:0,baseMva:100,buses:[{...entity('T1'),parentId:'G1',vnKv:154},{...entity('T2'),parentId:'G2',vnKv:154}],lines:[{...entity('L1'),sourceClass:'ElmLne',from:'T1',to:'T2',vnKv:154,lengthKm:1,rOhm:1,xOhm:10,bSiemens:0,ratingMva:100,coordinates:[],sections:0}],transformers:[],generators:[],loads:[],shunts:[],seriesCompensators:[],externalGrids:[{...entity('X1'),sourceClass:'ElmXnet',bus:'T1',pMw:0,qMvar:0,vmSet:1}],internationalConnections:[],switches:[],stationControllers:[],secondaryControllers:[],boundaries:[],sites:[],classCounts:{},records:0,warnings:[],capabilities:{powerFlow:{state:'READY',reasons:[]}}} as unknown as CanonicalNetwork;
  const result={identity:identity(network.modelHash,emptyScenario(),'powerFlow'),status:'CONVERGED_FULL_NR',converged:true,iterations:2,rounds:1,maxMismatchMw:0,elapsedMs:1,buses:[{id:'T1',name:'T1',terms:['T1'],siteIds:[],vnKv:154,vmPu:1,angleRad:0,pMw:0,qMvar:0,islandId:'island-1'},{id:'T2',name:'T2',terms:['T2'],siteIds:[],vnKv:154,vmPu:.99,angleRad:.01,pMw:0,qMvar:0,islandId:'island-1'}],branches:[{id:'L1',name:'L1',sourceClass:'ElmLne',from:'T1',to:'T2',siteIds:[],vnKv:154,pf:10,qf:5,pt:-9,qt:-4,ifA:42,itA:43,loading:10,pLoss:1,qLoss:1}],generators:[],diagnostics:{},warnings:[],quality:{numericalStatus:'CONVERGED',controlFidelity:'PARTIAL',referenceValidation:'NOT_AVAILABLE'}} as CalculationResult;
  const reference={metadata:{modelId:network.name,studyCase:network.studyCase,studyTime:'2026-10-02 13:00:00',sourceFile:'pf.csv'},records:[{kind:'bus' as const,fid:'T1',name:'T1',calculationBusKey:'T1',physicalTerminalFids:['T1'],voltagePu:1,angleDeg:0,isReferenceBus:true},{kind:'bus' as const,fid:'T2',name:'T2',calculationBusKey:'T2',physicalTerminalFids:['T2'],voltagePu:1,angleDeg:1},{kind:'line' as const,fid:'L1',name:'L1',fromBusFid:'T1',toBusFid:'T2',pFromMw:9,qFromMvar:5,loadingPercent:10,resultAvailable:true}]} as PowerFactoryReference;
  return{network,result,reference};
}
test('full context and terminal partition enable numeric comparison; changed study time and endpoint block it',()=>{
  const {network,result,reference}=fixture(),valid=preflightPowerFactoryReference(reference,network,result);
  assert.equal(valid.status,'COMPATIBLE');assert.equal(valid.topology.electricalBusesChecked,2);assert.equal(valid.topology.branchEndpointsChecked,1);
  const report=comparePowerFactoryReference(valid.reference,result,valid.context);assert.equal(report.compatibility.status,'COMPATIBLE');assert.equal(report.matched.bus,2);assert.equal(report.metrics.find(x=>x.metric==='pFromMw')?.mae,1);
  const time=preflightPowerFactoryReference({...reference,metadata:{...reference.metadata,studyTime:'2026-10-02 14:00:00'}},network,result);assert.equal(time.status,'BLOCKED');assert.equal(comparePowerFactoryReference(time.reference,result,time.context).metrics.length,0);
  const endpoint=preflightPowerFactoryReference({...reference,records:reference.records.map(row=>row.kind==='line'?{...row,toBusFid:'T1'}:row)},network,result);assert.equal(endpoint.status,'BLOCKED');assert.equal(endpoint.topology.branchEndpointConflicts,1);
});
test('comparison workbook has eight scalar sheets and excludes unequal PF loading semantics',()=>{
  const {network,result,reference}=fixture(),preflight=preflightPowerFactoryReference(reference,network,result),report=comparePowerFactoryReference(preflight.reference,result,preflight.context),sheets=comparisonSheets(report,preflight,network,result,reference);
  assert.deepEqual(sheets.map(x=>x.name),['Ozet','Gerilim_Aci','Hatlar','Trafolar','Ureticiler','Eslesmeyenler','Topoloji','Meta']);
  const workbook=unzipSync(buildWorkbook(sheets)),names=strFromU8(workbook['xl/workbook.xml']),line=strFromU8(workbook['xl/worksheets/sheet3.xml']);assert.match(names,/name="Gerilim_Aci"/);assert.match(line,/loadingPercent/);assert.match(line,/not established as equivalent/);assert.doesNotMatch(line,/\{"/);
});
test('P and Q loading use distinct bases and settings round trip',()=>{
  const settings=defaultSettings(),row={pf:70,pt:-69,qf:50,qt:80},line={ratingMva:100} as CanonicalNetwork['lines'][number];
  assert.equal(pLoadingPercent(line,row as CalculationResult['branches'][number]),70);
  assert.equal(qLoadingPercent(154,row as CalculationResult['branches'][number],settings),80);
  assert.equal(qLoadingPercent(400,row as CalculationResult['branches'][number],settings),40);
  const saved=new SettingsStore();saved.update({qBase400Mvar:250,qBase154Mvar:125,qThresholds:[10,20,30,40,50,60]},false);const restored=new SettingsStore();restored.update(JSON.parse(JSON.stringify(saved.value)),false);assert.equal(restored.value.qBase154Mvar,125);assert.deepEqual(restored.value.qThresholds,[10,20,30,40,50,60]);restored.reset();assert.equal(restored.value.qBase154Mvar,100);
});
