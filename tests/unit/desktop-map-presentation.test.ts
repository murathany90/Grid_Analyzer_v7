import test from 'node:test';
import assert from 'node:assert/strict';
import type {AppContext} from '../../src/app/contracts';
import type {CalculationResult} from '../../src/domain/results/types';
import {acNetwork} from '../helpers/ac-network';
import {identity} from '../../src/domain/calculation/identity';
import {ScenarioStore,scenarioSignature} from '../../src/domain/scenario/overlay';
import {ResultStore} from '../../src/domain/results/store';
import {AnalysisSettingsStore} from '../../src/domain/calculation/analysis-settings';
import {initialResultView} from '../../src/domain/results/workspace';
import {METRICS} from '../../src/domain/benchmark/comparison';
import {LF_MAP_METRICS,matchedVoltageKv,representativeStationBus,buildMapPresentationData,mapFlowMetric,mapPresentationGate,selectedN1Presentation,selectedScPresentation,mapStatusText,syncMapCase} from '../../src/map/layer-policy';
import {runHybridN1} from '../../src/analysis/contingency-hybrid';
import {equipmentCard,tooltipPosition} from '../../src/map/equipment-tooltip';
import {HELP_HOVER_DELAY_MS} from '../../src/help/context-help';
function context(){
  const base=acNetwork(),network={...base,buses:base.buses.map((b,i)=>({...b,vnKv:i===2?154:400,siteIds:['SITE']})),lines:base.lines.map(l=>({...l,vnKv:400})),sites:[{...base.buses[0],id:'SITE',name:'Örnek TM',sourceClass:'ElmSite',sourceId:'SITE',siteIds:['SITE'],voltages:[400,154],lat:39,lon:32,areaId:'A',areaName:'A'}],transformers:[{...base.lines[0],id:'TR',sourceId:'TR',sourceClass:'ElmTr2',siteIds:['SITE'],from:'B2',to:'B0',vnKv:400,lvKv:154,rPu:0,xPu:.1,tap:1,phase:0,ratingMva:100,tapPosition:0,gPu:0,bPu:0}]},scenario=new ScenarioStore(network.modelHash),analysisSettings=new AnalysisSettingsStore(),store=new ResultStore();store.selectScenario('B0');
  const id=identity(network.modelHash,scenario.current,'powerFlow',{analysisSettings:analysisSettings.value});
  const result:CalculationResult={identity:id,status:'CONVERGED',converged:true,iterations:2,rounds:1,maxMismatchMw:0,elapsedMs:2240,buses:network.buses.map((b,i)=>({id:'E'+i,name:'Bara '+i,terms:[b.id],siteIds:['SITE'],vnKv:b.vnKv,vmPu:[1.01,1.03,1.2][i],angleRad:[.1,.2,.3][i],pMw:0,qMvar:0,islandId:'island-1'})),branches:[{id:'L0',sourceClass:'ElmLne',name:'Hat',from:'B0',to:'B1',siteIds:[],vnKv:400,pf:0,pt:-0,qf:NaN,qt:2,ifA:0,itA:0,loading:null,pLoss:0,qLoss:NaN},{id:'TR',sourceClass:'ElmTr2',name:'Trafo',from:'B2',to:'B0',siteIds:['SITE'],vnKv:400,pf:-70,pt:70.5,qf:-20,qt:25,ifA:0,itA:0,loading:70,pLoss:.5,qLoss:5}],generators:[],diagnostics:{islands:[{islandId:'island-1',referenceSource:'SLACK',status:'CONVERGED'}],convergence:{stationControl:'STATION_CONTROL_CONVERGED',activeBalance:'ACTIVE_BALANCE_PARTIAL'}},warnings:[],quality:{numericalStatus:'CONVERGED',controlFidelity:'PARTIAL',referenceValidation:'NOT_AVAILABLE'}};
  store.expect('base',id);store.accept('base',result);
  const ctx={network,scenario,analysisSettings,resultStore:store,resultView:initialResultView(),benchmark:null,n1AcResults:[],n1Result:null,scResult:null,hybridResult:null,filters:{voltages:new Set(['400','154']),areaId:'',siteId:'',search:''},benchmarkMap:{analysis:'LF',source:'GA',metric:'pFromMw',table:'GA_Reference_Raw'},powerFactoryControlContextNumericFile:null} as unknown as AppContext;
  return {ctx,result};
}
test('six LF presentation choices retain canonical export fields and never animate transformer power as line power',()=>{
  assert.equal(LF_MAP_METRICS.length,6);assert.equal(new Set(LF_MAP_METRICS.map(m=>m.metric)).size,6);
  for(const m of LF_MAP_METRICS)assert.ok(m.metric in METRICS.GA_Reference_Raw);
  const {ctx,result}=context();const map=buildMapPresentationData(ctx,{...ctx.benchmarkMap!,metric:'pHvMw'});assert.equal(map.branches.has('ElmLne:L0'),false);assert.equal(map.branches.get('ElmTr2:TR')?.value,70.5);
  assert.equal(mapFlowMetric({...ctx.benchmarkMap!,metric:'pHvMw'},'nominal',result,true),null);assert.equal(mapFlowMetric({...ctx.benchmarkMap!,metric:'qHvMvar'},'nominal',result,true),null);
});
test('kV projection requires the identical nominal base, preserves zero and rejects missing/nonfinite values',()=>{
  assert.equal(matchedVoltageKv(1.01,154,154),155.54);assert.equal(matchedVoltageKv(0,154,154),0);for(const v of [null,undefined,NaN,Infinity])assert.equal(matchedVoltageKv(v,154,154),null);assert.equal(matchedVoltageKv(1,154,400),null);assert.equal(matchedVoltageKv(1,0,0),null);
});
test('TM selects highest nominal tier then highest measured voltage and the angle of that exact partition',()=>{
  const {ctx,result}=context(),selected=representativeStationBus(ctx,'SITE',result);assert.equal(selected.nominal,400);assert.equal(selected.bus?.id,'E1');
  const card=equipmentCard(ctx,ctx.network!.sites[0]);assert.deepEqual(card.rows[0],['400,00','412,00','+11,46']);assert.ok(card.note.includes('Bara 1'));ctx.filters.voltages.delete('400');assert.equal(representativeStationBus(ctx,'SITE',result).bus?.id,'E2');
  ctx.filters.voltages.add('400');result.diagnostics.islands=[];const angle=buildMapPresentationData(ctx,{...ctx.benchmarkMap!,metric:'angleDeg'});assert.equal(angle.sites.get('SITE')?.value,null);assert.equal(angle.sites.get('SITE')?.status,'ANGLE_REFERENCE_UNKNOWN');
});
test('line and HV/LV transformer cards use canonical endpoint signs, nulls, losses and native voltage orientation',()=>{
  const {ctx}=context(),line=equipmentCard(ctx,ctx.network!.lines[0]),trafo=equipmentCard(ctx,ctx.network!.transformers[0]);assert.equal(line.rows[0][1],'0,00');assert.equal(line.rows[0][2],'—');assert.equal(line.rows[0][3],'404,00');assert.ok(line.note.includes('P kayıp 0,00 MW'));
  assert.equal(trafo.rows[0][0],'YG');assert.equal(trafo.rows[0][1],'+70,50');assert.equal(trafo.rows[1][1],'-70,00');assert.ok(trafo.note.includes('P kayıp 0,50 MW'));assert.ok(!line.note.includes('NaN'));
});
test('a nonbase PF/delta context is blocked and never borrows current GA values',()=>{
  const {ctx}=context();ctx.scenario.setStatus('lineStatus','L0',false,true);for(const source of ['PF','DELTA','EXPLORATORY_DELTA'] as const)assert.equal(mapPresentationGate(ctx,{...ctx.benchmarkMap!,source}).reason,'PF_SCENARIO_IDENTITY_UNVERIFIED');
  ctx.benchmarkMap={...ctx.benchmarkMap!,source:'PF'};const card=equipmentCard(ctx,ctx.network!.lines[0]);assert.equal(card.status,'BLOCKED');assert.equal(card.rows.length,0);
});
test('DC N1 case gates Q/U; recorded case identity and native worsened constraints remain visible',async()=>{
  const {ctx}=context();ctx.resultView.analysis='N1';ctx.resultView.caseId='N1:ElmLne:L0';ctx.n1Result={identity:{modelHash:ctx.network!.modelHash,scenarioHash:scenarioSignature(ctx.scenario.current)},candidates:[{equipmentId:'L0',sourceClass:'ElmLne',status:'SCREENED',topImpacts:[{equipmentId:'L0',sourceClass:'ElmLne',baseFlowMw:0,postFlowMw:12,deltaPMw:12,baseEstimatedLoadingPct:null,postEstimatedLoadingPct:30}]}]} as unknown as AppContext['n1Result'];
  const s={analysis:'N1',source:'GA',table:'N1_RecordedExtrema_Raw',metric:'postPmw',caseId:ctx.resultView.caseId,n1Layer:'POST'} as const;
  assert.equal(buildMapPresentationData(ctx,s).branches.get('ElmLne:L0')?.value,12);assert.equal(mapPresentationGate(ctx,{...s,metric:'voltageKv'}).reason,'GA_DC_P_ONLY');assert.equal(mapPresentationGate(ctx,{...s,metric:'postQmvar'}).reason,'GA_DC_P_ONLY');
  ctx.resultView.caseId='N1:ElmLne:OTHER';assert.equal(selectedN1Presentation(ctx).status,'NOT_RUN');assert.equal(buildMapPresentationData(ctx,{...s,caseId:ctx.resultView.caseId}).numericValues,0);ctx.resultView.caseId=s.caseId;ctx.n1Result!.candidates[0].status='ISLANDING';assert.equal(mapPresentationGate(ctx,s).enabled,false);
  ctx.benchmark={groups:{N1:{tables:{N1_Cases_Raw:{headers:['caseId','outageClass','outageFid'],rows:[['PF-NATIVE-CASE','ElmLne','L0']]}}}}} as never;ctx.resultView.caseId='PF-NATIVE-CASE';syncMapCase(ctx);assert.deepEqual(ctx.comparisonOutage,{caseId:'PF-NATIVE-CASE',sourceClass:'ElmLne',fid:'L0'});
  const base=acNetwork(),n={...base,lines:base.lines.map(l=>({...l,capacity:{quality:'DGS_MAIN_TYPE' as const,typeId:'T',typeName:'T',nominalCurrentKA:1,nominalMVA:173.2,limitingSectionId:null,sections:[],seasonalReference:null}}))};
  ctx.benchmark=null;ctx.network=n;ctx.n1Result=null;ctx.resultView.caseId='N1:ElmLne:BYPASS';ctx.hybridResult=await runHybridN1(n,ctx.scenario.current,{analysisSettings:ctx.analysisSettings.value,selectedCandidateIds:['ElmLne:BYPASS'],policy:{acBudgetCases:1,operationalLoadingLimitPercent:1}});
  const c=ctx.hybridResult.cases.find(c=>c.outage.caseId===ctx.resultView.caseId)!,worsened=c.constraintChanges?.find(c=>c.metric==='postLoadingPercent'&&c.state==='WORSENED');assert.ok(worsened,'fixture must contain a genuine worsened native constraint');
  const newLayer=buildMapPresentationData(ctx,{...s,caseId:ctx.resultView.caseId,metric:'postLoadingPercent',n1Layer:'NEW_CONSTRAINTS'}),equipment=n.lines.find(e=>e.sourceId===worsened.fid)!;assert.equal(newLayer.branches.get('ElmLne:'+equipment.id)?.status,'WORSENED');assert.equal(newLayer.branches.get('ElmLne:'+equipment.id)?.value,worsened.post);
});
test('SC BLOCKED stays null with explicit source/partition reason and rejects stale identities',()=>{
  const {ctx}=context();ctx.resultView.analysis='SC';ctx.resultView.faultId='B0';ctx.scResult={identity:{modelHash:ctx.network!.modelHash,scenarioHash:scenarioSignature(ctx.scenario.current)},profile:{faultType:'3PH',calculateMode:'MAX'},faults:[{physicalTerminalFid:'B0',physicalTerminalFids:['B0'],nominalKv:400,status:'BLOCKED',ikssKa:null,skssMva:null,ipKa:null,ibKa:null,ithKa:null,reasons:['PARTITION_NOT_VERIFIED']}]} as unknown as AppContext['scResult'];
  assert.equal(selectedScPresentation(ctx).status,'BLOCKED');const card=equipmentCard(ctx,ctx.network!.sites[0]);assert.equal(card.rows[0][0],'—');assert.ok(card.note.includes('PARTITION_NOT_VERIFIED'));assert.ok(!card.context.includes('IEC 60909 hazır'));ctx.scResult!.identity.modelHash='wrong';assert.equal(selectedScPresentation(ctx).fault,null);
});
test('footer keeps partial LF honesty and switches to active N1/SC; equipment card clamp fits every desktop corner',()=>{
  const {ctx}=context();assert.match(mapStatusText(ctx),/P dengesi kısmi; tam çözüm değil/);ctx.resultView.analysis='SC';assert.ok(!mapStatusText(ctx).includes('NR yakınsadı'));ctx.resultView.analysis='N1';assert.ok(mapStatusText(ctx).includes('NOT_RUN'));
  assert.ok(HELP_HOVER_DELAY_MS>=450&&HELP_HOVER_DELAY_MS<=650);for(const [w,h] of [[1366,768],[1920,1080]])for(const [x,y] of [[0,0],[w,h],[w-1,1]]){const p=tooltipPosition(x,y,390,250,w,h);assert.ok(p.left>=0&&p.top>=0&&p.left+390<=w&&p.top+250<=h);}
});
