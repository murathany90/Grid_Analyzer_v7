import assert from 'node:assert/strict';
import test from 'node:test';
import type { CalculationResult } from '../../src/domain/results/types';
import { comparePowerFactoryReference, importPowerFactoryReference, importPowerFactoryReferenceDocument, type PowerFactoryReferenceRecord } from '../../src/analysis/validation/powerfactory-reference';

const context={modelId:'20261002_1300_DA5_TR0',studyCase:'20261002_1300_DA5_TR0',studyTime:'2026-10-02 13:00:00',topologyHash:'topology-1'};
function result(buses:CalculationResult['buses'],branches:CalculationResult['branches']):CalculationResult{return{identity:{modelHash:'hash1',scenarioHash:'base',optionsHash:'',analysisType:'powerFlow',engine:'test',engineVersion:'1'},status:'CONVERGED_FULL_NR',converged:true,iterations:2,rounds:1,maxMismatchMw:0,elapsedMs:1,buses,branches,generators:[],diagnostics:{},warnings:[],quality:{numericalStatus:'CONVERGED',controlFidelity:'PARTIAL',referenceValidation:'NOT_AVAILABLE'}};}
const doc=(records:PowerFactoryReferenceRecord[])=>({metadata:{modelId:context.modelId,studyCase:context.studyCase,studyTime:context.studyTime,topologyHash:context.topologyHash},records});

test('imports typed JSON, comma-decimal CSV, PF metadata, and preserves source row fields',()=>{
 const json=importPowerFactoryReference(JSON.stringify({buses:[{fid:'B1',name:'Bara 1',nominalKv:154,voltagePu:.99,angleDeg:-2.5}]}));assert.equal(json[0].nominalKv,154);
 const csv=importPowerFactoryReferenceDocument('sep=;\r\nkind;fid;name;voltageKv;voltagePu;angleDeg;physicalTerminalFid;metaKey;metaValue\r\nmeta;;;;;;;modelId;20261002_1300_DA5_TR0\r\nbus;B2;Bara 2;151;0,9765;-1,25;T2;;;');
 assert.equal(csv.metadata.modelId,context.modelId);assert.equal(csv.records[0].voltagePu,.9765);assert.equal(csv.records[0].angleDeg,-1.25);assert.equal(csv.records[0].physicalTerminalFid,'T2');assert.equal(csv.records[0].raw?.voltagePu,'0,9765');
});

test('actual PF fixture metadata schema is understood; unknown or mismatched study context blocks every numeric metric',()=>{
 const fixtureHeader='sep=;\r\nkind;fid;name;metaKey;metaValue\r\nmeta;;;schemaVersion;PF-GA-BENCHMARK-2.1\r\nmeta;;;modelId;20261002_1300_DA5_TR0\r\nmeta;;;studyCase;20261002_1300_DA5_TR0\r\nmeta;;;studyTimeLocal;2026-10-02 13:00:00\r\nbus;B1;Bara;;;';
 const parsed=importPowerFactoryReferenceDocument(fixtureHeader,'PowerFactory_LoadFlow_20261002_1300_DA5_TR0_20261003_140951.csv');assert.equal(parsed.metadata.modelId,context.modelId);assert.equal(parsed.metadata.studyCase,context.studyCase);assert.equal(parsed.metadata.studyTime,context.studyTime);assert.equal(parsed.metadata.sourceFile,'PowerFactory_LoadFlow_20261002_1300_DA5_TR0_20261003_140951.csv');
 const calc=result([{id:'B1',name:'Bara',terms:[],siteIds:[],vnKv:154,vmPu:1,angleRad:0,pMw:0,qMvar:0}],[]);
 const blocked=comparePowerFactoryReference(parsed,calc);assert.equal(blocked.quality,'BLOCKED');assert.equal(blocked.metrics.length,0);assert.ok(blocked.compatibility.reasons.some(x=>x.includes('topology')));
 const mismatch=comparePowerFactoryReference(parsed,calc,{...context,studyTime:'2026-10-02 14:00:00'});assert.equal(mismatch.compatibility.status,'BLOCKED');assert.equal(mismatch.metrics.length,0);
});

test('FID matching, metric summary, raw and island-aligned angles work only after compatible preflight',()=>{
 const calc=result([{id:'B1',name:'Slack',terms:['TERM1'],siteIds:[],vnKv:154,vmPu:1.01,angleRad:10*Math.PI/180,pMw:0,qMvar:0,islandId:'island-1'},{id:'B2',name:'Remote',terms:[],siteIds:[],vnKv:154,vmPu:.99,angleRad:12*Math.PI/180,pMw:0,qMvar:0,islandId:'island-1'}],[{id:'L1',name:'Hat',sourceClass:'ElmLne',from:'B1',to:'B2',siteIds:[],vnKv:154,pf:12,qf:2,pt:-11,qt:-3,ifA:4,itA:4,loading:53.8,pLoss:1,qLoss:-1}]);calc.diagnostics.referenceBusId='B1';
 const reference=doc([{kind:'bus',fid:'TERM1',name:'PF label',voltagePu:1,angleDeg:0,isReferenceBus:true},{kind:'bus',fid:'B2',name:'Remote',voltagePu:1,angleDeg:1},{kind:'line',fid:'L1',name:'Hat',pFromMw:10,qFromMvar:1,loadingPercent:53.8}]);
 const report=comparePowerFactoryReference(reference,calc,context);assert.equal(report.compatibility.status,'COMPATIBLE');assert.deepEqual(report.matched,{bus:2,line:1,transformer:0,generator:0});assert.equal(report.matchMethods.FID,3);assert.equal(report.angleAlignment.method,'REFERENCE_BUS');assert.ok(report.metrics.some(m=>m.metric==='angleDeg'));assert.ok(report.metrics.some(m=>m.metric==='alignedAngleDeg'));assert.equal(report.metrics.find(m=>m.metric==='pFromMw')?.mae,2);assert.equal(report.metrics.some(m=>m.metric==='loadingPercent'),false);
});

test('does not fall back from an unmatched supplied FID to a same-name object; ambiguous exact name is visible',()=>{
 const calc=result([{id:'A',name:'same',terms:[],siteIds:[],vnKv:110,vmPu:1,angleRad:0,pMw:0,qMvar:0},{id:'B',name:'same',terms:[],siteIds:[],vnKv:110,vmPu:1,angleRad:0,pMw:0,qMvar:0}],[]);
 const report=comparePowerFactoryReference(doc([{kind:'bus',fid:'missing',name:'same',voltagePu:1},{kind:'bus',name:'same',voltagePu:1}]),calc,context);assert.equal(report.summary.unmatchedReference,1);assert.equal(report.ambiguous.length,1);assert.equal(report.ambiguous[0].reason,'AMBIGUOUS');
});

test('CSV number parser handles comma decimal and localized thousands grouping',()=>{const parsed=importPowerFactoryReference('sep=;\r\nkind;name;voltagePu\r\nbus;Bara;1.234,56');assert.equal(parsed[0].voltagePu,1234.56);});

test('model ID and model hash are compared only to the same identity type',()=>{
 const reference={metadata:{modelId:context.modelId,studyCase:context.studyCase,studyTime:context.studyTime,topologyHash:context.topologyHash},records:[]};
 const calc=result([],[]);calc.identity.modelHash='different-content-hash';
 const sameId=comparePowerFactoryReference(reference,calc,context);assert.equal(sameId.compatibility.status,'COMPATIBLE');
 const hashOnlyContext=comparePowerFactoryReference(reference,calc,{modelHash:'different-content-hash',studyCase:context.studyCase,studyTime:context.studyTime,topologyHash:context.topologyHash});assert.equal(hashOnlyContext.compatibility.status,'BLOCKED');assert.ok(hashOnlyContext.compatibility.reasons.includes('model identity is unknown'));
});

test('deduplicates terminal rows by calculationBusKey and reports conflicting values',()=>{
 const parsed=importPowerFactoryReferenceDocument('sep=;\r\nkind;fid;name;calculationBusKey;physicalTerminalFid;voltagePu;resultAvailable\r\nbus;T1;Bara 1;CB1;T1;1,000;1\r\nbus;T2;Bara 1;CB1;T2;0,990;1\r\nbus;T3;Bara 2;CB2;T3;0,980;1');
 assert.equal(parsed.records.length,2);assert.deepEqual(parsed.records[0].fids,['T1','T2']);assert.deepEqual(parsed.records[0].physicalTerminalFids,['T1','T2']);assert.deepEqual(parsed.records[0].conflictedMetrics,['voltagePu']);assert.equal(parsed.valueConflicts?.length,1);assert.equal(parsed.valueConflicts?.[0].calculationBusKey,'CB1');
});

test('matched detail rows expose metric pair semantics and indexed endpoint matching',()=>{
 const calc=result([{id:'CB1',name:'A',terms:['T1'],siteIds:[],vnKv:154,vmPu:1.01,angleRad:0,pMw:0,qMvar:0},{id:'CB2',name:'B',terms:['T2'],siteIds:[],vnKv:154,vmPu:1,angleRad:0,pMw:0,qMvar:0}],[{id:'L1',name:'Line',sourceClass:'ElmLne',from:'CB1',to:'CB2',siteIds:['S1'],vnKv:154,pf:12,qf:2,pt:-11,qt:-3,ifA:5,itA:5,loading:54,pLoss:1,qLoss:-1}]);
 const reference={metadata:{modelId:context.modelId,studyCase:context.studyCase,studyTime:context.studyTime,topologyHash:context.topologyHash},records:[{kind:'line' as const,fid:'wrong-line-id',name:'PF Line',fromCalculationBusKey:'CB2',toCalculationBusKey:'CB1',pFromMw:10,loadingPercent:54}]};
 const report=comparePowerFactoryReference(reference,calc,context),row=report.rows.find(x=>x.kind==='line');assert.equal(row?.status,'MATCHED');assert.equal(row?.matchMethod,'ENDPOINT_HIERARCHY');assert.equal(row?.topology.from,'CB1');assert.equal(row?.topology.powerFactoryFrom,'CB2');assert.equal(row?.metrics.pFromMw?.gridAnalyzer,12);assert.equal(row?.metrics.pFromMw?.powerFactory,10);assert.equal(row?.metrics.pFromMw?.delta,2);assert.equal(row?.metrics.loadingPercent?.comparable,false);assert.equal(row?.metrics.loadingPercent?.delta,null);
});

test('generator rows preserve Q control and connected-bus provenance; endpoint current metrics compare only with supplied currents',()=>{
 const calc=result([{id:'B1',name:'Bus',terms:['TERM1'],siteIds:[],vnKv:154,vmPu:1,angleRad:0,pMw:0,qMvar:0}],[{id:'L1',name:'Line',sourceClass:'ElmLne',from:'B1',to:'B1',siteIds:[],vnKv:154,pf:1,qf:1,pt:-1,qt:-1,ifA:15.5,itA:16.5,loading:60,pLoss:0,qLoss:0}]);
 calc.generators.push({id:'G1',name:'Generator',bus:'B1',pMw:12,qMvar:4,qState:'PV'});
 const parsed=importPowerFactoryReferenceDocument('sep=;\r\nkind;fid;name;controlModeRaw;connectedBusFid;connectedCalculationBusKey;pResultMw;qResultMvar;iFromA;iToA;loadingPercent\r\ngenerator;G1;Generator;voltage-control;TERM1;B1;12;5;;;\r\nline;L1;Line;;;;;;14;17;60');
 const reference={metadata:{modelId:context.modelId,studyCase:context.studyCase,studyTime:context.studyTime,topologyHash:context.topologyHash},records:parsed.records};
 const report=comparePowerFactoryReference(reference,calc,context),gen=report.rows.find(x=>x.kind==='generator'),line=report.rows.find(x=>x.kind==='line');
 assert.equal(gen?.generatorControl?.gridAnalyzerQState,'PV');assert.equal(gen?.generatorControl?.powerFactoryControlModeRaw,'voltage-control');assert.equal(gen?.generatorControl?.powerFactoryConnectedBusFid,'TERM1');assert.equal(gen?.generatorControl?.busMatch,'MATCHED');assert.equal(gen?.metrics.qMvar?.delta,-1);
 assert.equal(line?.metrics.currentFromA?.gridAnalyzer,15.5);assert.equal(line?.metrics.currentFromA?.powerFactory,14);assert.equal(line?.metrics.currentFromA?.delta,1.5);assert.equal(line?.metrics.currentToA?.delta,-.5);assert.equal(line?.metrics.loadingPercent?.comparable,false);
});

test('calculation-bus voltage/angle rounding within fixture precision is retained without conflict',()=>{
 const parsed=importPowerFactoryReferenceDocument('sep=;\r\nkind;fid;name;calculationBusKey;physicalTerminalFid;voltageKv;voltagePu;angleDeg;resultAvailable\r\nbus;T1;Bus;CB;T1;154;1.0107570451;18.2494736900;1\r\nbus;T2;Bus;CB;T2;154,000001;1.0107570450;18.2494736898;1');
 assert.equal(parsed.records.length,1);assert.equal(parsed.records[0].voltagePu,1.0107570451);assert.equal(parsed.records[0].angleDeg,18.24947369);assert.equal(parsed.valueConflicts?.length,0);
});
