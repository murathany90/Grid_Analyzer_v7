import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { DgsModel, type DgsRawData } from '../../src/importers/dgs/index';
import { mapCanonical } from '../../src/importers/dgs/canonical';
import type { CalculationResult } from '../../src/domain/results/types';
import { comparePowerFactoryReference, importPowerFactoryReference, importPowerFactoryReferenceDocument, powerFactoryLoadFlowSettings, type PowerFactoryReferenceRecord } from '../../src/analysis/validation/powerfactory-reference';

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

test('electricalBusKey controls bus statistics deduplication across distinct calculation keys',()=>{
 const parsed=importPowerFactoryReferenceDocument('sep=;\r\nkind;fid;name;calculationBusKey;electricalBusKey;physicalTerminalFid;voltagePu;resultAvailable\r\nbus;T1;Bus 1;CB1;EB1;T1;1.000;1\r\nbus;T2;Bus 2;CB2;EB1;T2;1.000;1\r\nbus;T3;Bus 3;CB3;EB2;T3;0.990;1');
 assert.equal(parsed.records.length,2);assert.deepEqual(parsed.records[0].fids,['T1','T2']);assert.deepEqual(parsed.records[0].physicalTerminalFids,['T1','T2']);
});

test('one electricalBusKey receives one voltage and angle observation despite multiple terminals',()=>{
 const parsed=importPowerFactoryReferenceDocument('sep=;\r\nkind;fid;name;calculationBusKey;electricalBusKey;physicalTerminalFid;voltagePu;angleDeg;resultAvailable\r\nbus;T1;Renamed 1;CB1;EB1;T1;1.01;2;1\r\nbus;T2;Renamed 2;CB2;EB1;T2;1.01;2;1\r\nbus;T3;Other;CB3;EB2;T3;0.99;1;1');
 const calc=result([{id:'CB1',name:'Actual 1',terms:['T1','T2'],siteIds:[],vnKv:154,vmPu:1.0,angleRad:0,pMw:0,qMvar:0},{id:'CB3',name:'Actual 2',terms:['T3'],siteIds:[],vnKv:154,vmPu:1.0,angleRad:0,pMw:0,qMvar:0}],[]);
 const report=comparePowerFactoryReference({...parsed,metadata:{...parsed.metadata,modelId:context.modelId,studyCase:context.studyCase,studyTime:context.studyTime,topologyHash:context.topologyHash}},calc,context);
 assert.equal(report.metrics.find(row=>row.metric==='voltagePu')?.count,2);assert.equal(report.metrics.find(row=>row.metric==='alignedAngleDeg')?.count,2);
});

test('loc_name mutation does not change FID-based branch, generator, or bus-control linkage',()=>{
 const calc=result([{id:'CB1',name:'GA bus',terms:['T1'],siteIds:[],vnKv:154,vmPu:1,angleRad:0,pMw:0,qMvar:0},{id:'CB2',name:'GA bus 2',terms:['T2'],siteIds:[],vnKv:154,vmPu:1,angleRad:0,pMw:0,qMvar:0}],[{id:'L1',name:'GA line',sourceClass:'ElmLne',from:'CB1',to:'CB2',siteIds:[],vnKv:154,pf:1,qf:0,pt:-1,qt:0,ifA:1,itA:1,loading:0,pLoss:0,qLoss:0}]);
 calc.generators.push({id:'G1',name:'GA generator',bus:'CB1',pMw:1,qMvar:0,qState:'PV'});
 const reference={metadata:{modelId:context.modelId,studyCase:context.studyCase,studyTime:context.studyTime,topologyHash:context.topologyHash},records:[{kind:'line' as const,fid:'L1',name:'PF line (renamed)'},{kind:'generator' as const,fid:'G1',name:'PF gen (renamed)',connectedBusFid:'T1'},{kind:'bus' as const,fid:'T1',name:'PF terminal (renamed)',voltagePu:1,angleDeg:0}]};
 const report=comparePowerFactoryReference(reference,calc,context),line=report.rows.find(row=>row.kind==='line'),gen=report.rows.find(row=>row.kind==='generator');
 assert.equal(line?.status,'MATCHED');assert.equal(line?.gridAnalyzerId,'L1');assert.equal(gen?.status,'MATCHED');assert.equal(gen?.generatorControl?.busMatch,'MATCHED');
});

test('calculation-settings hash mismatch blocks parity; raw-only settings stay exploratory',()=>{
 const reference={metadata:{modelId:context.modelId,studyCase:context.studyCase,studyTime:context.studyTime,topologyHash:context.topologyHash,calculationSettingsHash:'pf-hash',calculationSettingsHashAlgorithm:'canonical-json-v1'},records:[]};
 const mismatch=comparePowerFactoryReference(reference,result([],[]),{...context,calculationSettingsHash:'ga-hash',calculationSettingsHashAlgorithm:'canonical-json-v1'});
 assert.equal(mismatch.compatibility.status,'BLOCKED_CALCULATION_SETTINGS_MISMATCH');
 const unlikeHashes=comparePowerFactoryReference(reference,result([],[]),{...context,calculationSettingsHash:'ga-fnv',calculationSettingsHashAlgorithm:'fnv1a-v1'});assert.equal(unlikeHashes.compatibility.status,'EXPLORATORY_ONLY');
 const rawOnly=comparePowerFactoryReference({metadata:{...reference.metadata,calculationSettingsHash:undefined,loadFlowSettingsRaw:'{"iPbalancing":3}'},records:[]},result([],[]),{...context,calculationSettingsSemanticsAvailable:false});
 assert.equal(rawOnly.compatibility.status,'EXPLORATORY_ONLY');
 const missingEligibility=comparePowerFactoryReference({metadata:{modelId:context.modelId,studyCase:context.studyCase,studyTime:context.studyTime,topologyHash:context.topologyHash},records:[]},result([],[]),{...context,activeBalanceEligibilityAvailable:false});assert.equal(missingEligibility.compatibility.status,'COMPARABLE_PARTIAL');assert.equal(missingEligibility.quality,'COMPARABLE_PARTIAL');
});

test('known PF distributed balance mismatches effective single-reference balance unless eligibility is missing',()=>{
 const reference={metadata:{modelId:context.modelId,studyCase:context.studyCase,studyTime:context.studyTime,topologyHash:context.topologyHash,loadFlowSettingsSemantic:JSON.stringify({activeBalancingMode:'Distributed Slack by Loads'})},records:[]};
 const effective={...context,calculationSettingsSemanticsAvailable:true,effectiveActiveBalancingMode:'SINGLE_REFERENCE'};
 const blocked=comparePowerFactoryReference(reference,result([],[]),{...effective,activeBalanceEligibilityAvailable:true});
 assert.equal(blocked.compatibility.status,'BLOCKED_CALCULATION_SETTINGS_MISMATCH');
 const partial=comparePowerFactoryReference(reference,result([],[]),{...effective,activeBalanceEligibilityAvailable:false});
 assert.equal(partial.compatibility.status,'COMPARABLE_PARTIAL');
});

test('future per-load PowerFactory metadata is retained without inferring eligibility from i_scale',()=>{
 const parsed=importPowerFactoryReferenceDocument('sep=;\r\nkind;FID;loc_name;sourceClass;i_scale;adjustedByLoadScaling;initialP_MW;initialQ_MVAr;finalP_MW;finalQ_MVAr;balancingParticipation\r\nload;LD1;Load renamed;ElmLod;2;true;10;3;10.4;3.1;0.6');
 assert.equal(parsed.loadRecords?.length,1);const load=parsed.loadRecords![0];assert.equal(load.fid,'LD1');assert.equal(load.sourceClass,'ElmLod');assert.equal(load.iScaleRaw,'2');assert.equal(load.adjustedByLoadScaling,true);assert.equal(load.activeBalanceEligibility,undefined);assert.equal(load.initialPMw,10);assert.equal(load.initialQMvar,3);assert.equal(load.finalPMw,10.4);assert.equal(load.finalQMvar,3.1);assert.equal(load.balancingParticipation,.6);
});

test('ComLdf raw enum values are retained without guessed semantic mappings',()=>{
 const parsed=importPowerFactoryReferenceDocument(JSON.stringify({metadata:{loadFlowSettingsRaw:'{"iopt_lim":1,"iPbalancing":3}'},records:[]}));
 const settings=powerFactoryLoadFlowSettings(parsed);assert.deepEqual(settings.raw,{iopt_lim:1,iPbalancing:3});assert.equal(settings.profile,'UNKNOWN');assert.deepEqual(settings.semantic,{});
});

test('ComLdf raw fields in the PF-GA CSV metadata are retained',()=>{
 const parsed=importPowerFactoryReferenceDocument('sep=;\r\nkind;metaKey;metaValue\r\nmeta;raw.ComLdf.i_power;1\r\nmeta;raw.ComLdf.iPbalancing;3\r\nmeta;raw.ComLdf.nsteps;1\r\nmeta;raw.ComLdf.errlf;5,0000000000\r\nmeta;raw.ComLdf.iopt_at;0');
 const settings=powerFactoryLoadFlowSettings(parsed);
 assert.equal(settings.raw.i_power,'1');assert.equal(settings.raw.iPbalancing,'3');assert.equal(settings.raw.nsteps,'1');assert.equal(settings.raw.errlf,'5,0000000000');assert.equal(settings.raw.iopt_at,'0');
 assert.deepEqual(settings.semantic,{});
});

test('DGS adjustable-load eligibility stays unknown without source attributes and maps native scale 0/1 only',async()=>{
 const raw=JSON.parse(await readFile(new URL('../fixtures/small-dgs.json',import.meta.url),'utf8')) as DgsRawData;
 const model=await new DgsModel(raw,'small.dgs').build(),network=mapCanonical(model,'fixture-hash');
 assert.equal(network.loads[0].activeBalanceEligibility,undefined);assert.ok(network.diagnostics?.some(d=>d.code==='ACTIVE_BALANCE_ELIGIBILITY_MISSING'));
 const withScale=JSON.parse(JSON.stringify(raw)) as DgsRawData,table=withScale.ElmLod as {Attributes:string[];Values:unknown[][]};table.Attributes.push('scale');table.Values[0].push(1);
 const scaled=mapCanonical(await new DgsModel(withScale,'small.dgs').build(),'fixture-hash');assert.equal(scaled.loads[0].activeBalanceEligibility,true);assert.equal(scaled.loads[0].activeBalanceEligibilitySource,'native-scale');
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

test('PF loading compares only when endpoint current ratings and PF current-derived loading agree',()=>{
 const calc=result([{id:'B1',name:'A',terms:[],siteIds:[],vnKv:154,vmPu:1,angleRad:0,pMw:0,qMvar:0},{id:'B2',name:'B',terms:[],siteIds:[],vnKv:154,vmPu:1,angleRad:0,pMw:0,qMvar:0}],[{id:'L1',name:'Line',sourceClass:'ElmLne',from:'B1',to:'B2',siteIds:[],vnKv:154,pf:10,qf:2,pt:-10,qt:-2,ifA:50,itA:60,loading:60,currentLoadingPercent:60,ratedCurrentFromA:100,ratedCurrentToA:100,pLoss:0,qLoss:0}]);
 const verified={kind:'line' as const,fid:'L1',name:'Line',loadingPercent:58,ratedCurrentFromA:100,ratedCurrentToA:100,raw:{loadingCalculatedFromCurrentPercent:'58'}};
 const matched=comparePowerFactoryReference(doc([verified]),calc,context),pair=matched.rows.find(row=>row.kind==='line')?.metrics.loadingPercent;
 assert.equal(pair?.comparable,true);assert.equal(pair?.delta,2);assert.equal(matched.metrics.find(row=>row.metric==='loadingPercent')?.mae,2);
 const wrongRating=comparePowerFactoryReference(doc([{...verified,ratedCurrentFromA:90}]),calc,context);
 assert.equal(wrongRating.rows.find(row=>row.kind==='line')?.metrics.loadingPercent?.comparable,false);
 assert.equal(wrongRating.metrics.some(row=>row.metric==='loadingPercent'),false);
 const wrongPfSemantics=comparePowerFactoryReference(doc([{...verified,raw:{loadingCalculatedFromCurrentPercent:'47'}}]),calc,context);
 assert.equal(wrongPfSemantics.rows.find(row=>row.kind==='line')?.metrics.loadingPercent?.comparable,false);
});
