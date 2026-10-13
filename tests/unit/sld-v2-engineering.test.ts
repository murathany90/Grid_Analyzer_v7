import test from 'node:test';
import assert from 'node:assert/strict';
import type {CanonicalNetwork,Bus,Switch} from '../../src/domain/model/network';
import {buildStationTopologyGraph,type StationSources} from '../../src/domain/model/station-topology';
import {physicalStationLayout} from '../../src/features/sld/physical-layout';
import {oppositeStation,SldNavigationHistory} from '../../src/features/sld/navigation';
import {sldBranchValues,sldLfCurrent,createSldResultOverlay,sldFlowAtPort,type SldResultEntry} from '../../src/features/sld/result-overlay';
import {portResultRows,resultNumber} from '../../src/features/sld/result-labels';
import {transformerPresentation} from '../../src/features/sld/transformer-presentation';
import {allVoltageBands} from '../../src/domain/model/voltage-band';
import {buildTopology} from '../../src/topology/electrical-topology';
import {emptyScenario,effectiveNetwork,ScenarioStore} from '../../src/domain/scenario/overlay';
import {identity} from '../../src/domain/calculation/identity';
import {defaultAnalysisSettings,activeAnalysisSettings,analysisSettingsHash} from '../../src/domain/calculation/analysis-settings';
import {ResultStore} from '../../src/domain/results/store';
import type {AppContext} from '../../src/app/contracts';
import type {CalculationResult} from '../../src/domain/results/types';
import {defaultSettings} from '../../src/persistence/settings';
import {acNetwork} from '../helpers/ac-network';
import {BrowserJsPowerFlowEngine} from '../../src/analysis/api/browser-js-engine';
import {validateAcOutages} from '../../src/analysis/contingency-ac';
import {calculateThreePhase} from '../../src/analysis/short-circuit';
const entity=(id:string,cls:string)=>({id,sourceId:id,name:id,sourceClass:cls,inService:true,siteIds:['S'],sourceRefs:{}});
function fixture(edges:[string,string,string,boolean][],termIds:string[],kv=400){
 const bars=['B1','B2','BT'];const buses:Bus[]=termIds.map(id=>({...entity(id,'ElmTerm'),vnKv:kv,parentId:bars.includes(id)?'G':'F'}));
 const switches:Switch[]=edges.map(([id,from,to,closed])=>({...entity(id,'ElmCoup'),from,to,closed}));
 const n={schemaVersion:1,modelHash:'MODEL',name:'Synthetic SLD',baseMva:100,buses,switches,lines:[{...entity('L','ElmLne'),from:termIds.at(-1)!,to:'REMOTE',vnKv:kv,lengthKm:2,rOhm:1,xOhm:2,bSiemens:0,ratingMva:null,coordinates:[],sections:0}],transformers:[],generators:[],loads:[],shunts:[],seriesCompensators:[],externalGrids:[],internationalConnections:[],sites:[],stationControllers:[],secondaryControllers:[],boundaries:[],classCounts:{},warnings:[],records:0,size:0,capabilities:{}} as unknown as CanonicalNetwork;
 const sources:StationSources={bays:[{id:'F',name:'Native bay',attributes:{}}],terminals:buses.map(b=>({id:b.id,name:b.name,attributes:{fold_id:b.parentId,iUsage:bars.includes(b.id)?0:1}})),switches:switches.map((s,i)=>({id:s.id,name:s.name,attributes:{fold_id:'F',aUsage:i===0?'cbk':'dct',on_off:Number(s.closed)}})),cubicles:[],substats:[]};
 return {n,sources};
}
const cases:[string,[string,string,string,boolean][],string[]][]=[
 ['single breaker two selectors',[['A','B1','J',true],['B','B2','J',false],['C','J','T',true]],['B1','B2','J','T']],
 ['double breaker',[['A','B1','T',true],['B','B2','T',true]],['B1','B2','T']],
 ['breaker and a half',[['A','B1','T',true],['B','T','J',true],['C','J','B2',true]],['B1','B2','J','T']],
 ['transfer bypass',[['A','B1','T',true],['B','BT','T',false]],['B1','BT','T']],
 ['section and open coupler',[['A','B1','B2',false],['B','B1','T',true]],['B1','B2','T']],
 ['parallel feeders',[['A','B1','J',true],['B','B1','T',true]],['B1','J','T']]
];
for(const [name,edges,terms]of cases)test('SLD native source topology: '+name,()=>{
 const {n,sources}=fixture(edges,terms),before=structuredClone(n),graph=buildStationTopologyGraph(n,'S',sources),layout=physicalStationLayout(graph,allVoltageBands());
 assert.deepEqual(graph.connections.filter(e=>e.kind==='switch').map(e=>e.terminals),edges.map(e=>e.slice(1,3)));
 assert.equal(layout.routes.length,edges.length);assert.equal(new Set(layout.routes.map(r=>r.sw.sourceClass+'|'+r.sw.sourceId)).size,edges.length);
 assert.ok(layout.routes.every(r=>r.a&&r.b));assert.deepEqual(n,before);assert.deepEqual(buildTopology(n),buildTopology(before));
 const scenario={...emptyScenario(),switchState:{[edges[0][0]]:!edges[0][3]}};const active=effectiveNetwork(n,scenario);
 const structural=buildStationTopologyGraph(active,'S',sources);assert.deepEqual(structural.connections,graph.connections);assert.notDeepEqual(buildTopology(active),buildTopology(n));
});
test('SLD source counters refer to actual missing fields, not an unrelated zero endpoint count',()=>{
 const {n,sources}=fixture([['C','MISSING','T',false]],['T']);sources.bays=[...sources.bays,{id:'EMPTY',name:'Empty native bay',attributes:{}}];const graph=buildStationTopologyGraph(n,'S',sources);
 assert.equal(graph.counters.invalidSwitchEndpoints,1);assert.ok(graph.counters.unresolvedFeederTerminals>=1);assert.equal(graph.counters.diagramUnresolvedTotal,graph.issues.length);assert.ok(graph.issues.some(i=>i.sourceId==='C'&&i.reference==='MISSING'));
});
test('SLD missing usage never creates a guessed busbar and missing native cubicle references stay counted',()=>{
 const {n,sources}=fixture([['C','B1','T',true]],['B1','T']);sources.terminals=sources.terminals.map(r=>r.id==='B1'?{...r,attributes:{fold_id:'G'}}:r);sources.switches=[{...sources.switches[0],attributes:{...sources.switches[0].attributes,bus1:'MISSING_CUB'}}];const g=buildStationTopologyGraph(n,'S',sources);assert.equal(g.busSections.length,0);assert.equal(g.counters.ambiguousBusSections,1);assert.equal(g.counters.missingCubicleReferences,1);assert.equal(g.switches[0].kind,'breaker');
});
test('SLD 400/154 transformer winding ports and native type/range preserve source units and no ratio-based auto guess',()=>{
 const raw={id:'TR',name:'TR',attributes:{bushv:'CH',buslv:'CL',nntap:9}},type={id:'TYPE',name:'Type',attributes:{utrn_h:400,utrn_l:154,strn:250,tap_side:1,ntpmn:1,ntpmx:17,tr2cn_h:'YN',tr2cn_l:'D'}};
 const p=transformerPresentation(raw,type,[{id:'CH',name:'CH',attributes:{fold_id:'HV'}},{id:'CL',name:'CL',attributes:{fold_id:'LV'}}]);assert.deepEqual(p.windings.map(w=>[w.side,w.terminalId,w.nominalKv,w.tapSide]),[['HV','HV',400,false],['LV','LV',154,true]]);assert.equal(p.kind,'TWO_WINDING');assert.match(p.typeVerification,/UNVERIFIED/);assert.deepEqual(p.tapRange,[1,17]);
});
test('SLD native 3W physical projection never fabricates a two-winding calculation',()=>{
 const p=transformerPresentation({id:'T3',name:'T3',attributes:{bushv:'H',busmv:'M',buslv:'L'}},{id:'TYPE3',name:'TYPE3',attributes:{utrn_h:400,utrn_m:154,utrn_l:33}},['H','M','L'].map(id=>({id,name:id,attributes:{fold_id:id+'TERM'}})));
 assert.equal(p.windings.length,3);assert.equal(p.calculationSupport,'UNSUPPORTED');assert.equal(p.kind,'THREE_WINDING');assert.equal(p.ratingMva,null);
});
test('SLD endpoint injections, losses, amperes and missing values use the canonical contract',()=>{
 const v=sldBranchValues({pf:100,qf:20,pt:-98,qt:-15,ifA:400,itA:800},60);assert.equal(v.pLossMw,2);assert.equal(v.qLossMvar,5);assert.equal(v.iFromA,400);assert.equal(v.sToMva,Math.hypot(98,15));
 const missing=sldBranchValues({pf:0,qf:NaN,pt:0,qt:0,ifA:NaN,itA:0},null);assert.equal(missing.pFromMw,0);assert.equal(missing.qFromMvar,null);assert.equal(missing.sFromMva,null);assert.equal(missing.loadingPercent,null);assert.equal(missing.iToA,0);
 const entry:SldResultEntry={values:v,direction:v.pFromMw,status:'SYNTHETIC_RENDER_CONTRACT',method:'ENDPOINT_INJECTION_CONTRACT',lines:[],alarm:false};assert.equal(sldFlowAtPort(entry,'FROM'),100);assert.equal(sldFlowAtPort(entry,'TO'),-98);assert.equal(sldFlowAtPort({...entry,values:{pFromMw:100,pToMw:null}},'TO'),null);
});
function context(){const {n}=fixture([['C','B1','T',true]],['B1','T']);const settings=defaultAnalysisSettings(),scenario=new ScenarioStore(n.modelHash),store=new ResultStore();return {network:n,analysisSettings:{value:settings},settings:{value:defaultSettings()},powerFactoryControlContextHash:null,scenario,resultStore:store,resultView:{analysis:'LF',source:'GA',phase:'BASE',scenarioId:'B0',metric:'pFromMw'},n1AcResults:[],hybridResult:null,n1Result:null,scResult:null,scContext:null} as unknown as AppContext;}
test('SLD stale gate checks exact type, method, scenario, settings and source-control options',()=>{
 const ctx=context(),s=ctx.analysisSettings.value,id=identity(ctx.network!.modelHash,emptyScenario(),'powerFlow',{analysisSettings:activeAnalysisSettings(s,'powerFlow'),analysisSettingsHash:analysisSettingsHash(s,'powerFlow'),controlContextHash:null});const r={identity:id,status:'CONVERGED_FULL_NR',converged:true,buses:[],branches:[],generators:[]} as unknown as CalculationResult;
 assert.equal(sldLfCurrent(ctx,r,'base'),true);for(const altered of [{...id,analysisType:'dc'},{...id,engine:'OTHER'},{...id,optionsHash:'{}'},{...id,modelHash:'OLD'}])assert.equal(sldLfCurrent(ctx,{...r,identity:altered} as CalculationResult,'base'),false);
 ctx.scenario.setStatus('lineStatus','L',false,true);assert.equal(sldLfCurrent(ctx,r,'scenario'),false);assert.equal(sldLfCurrent(ctx,r,'base'),true);
});
test('SLD projection cache invalidates without running LF and never supplies a zero for NOT_RUN',()=>{
 const ctx=context(),a=createSldResultOverlay(ctx,'LF');assert.equal(a.status,'NOT_RUN / STALE');assert.equal(a.entries.size,0);assert.equal(createSldResultOverlay(ctx,'LF'),a);ctx.scenario.setStatus('lineStatus','L',false,true);assert.notEqual(createSldResultOverlay(ctx,'LF'),a);
});
test('SLD cross-station navigation uses distinct parallel FIDs and rejects missing/ambiguous endpoint owners',()=>{
 const ctx=context(),n=ctx.network!,sites=['S','OTHER'].map(id=>({...entity(id,'ElmSite'),areaId:'A',areaName:'A',lat:null,lon:null,voltages:[400]})),remote={...entity('REMOTE','ElmTerm'),siteIds:['OTHER'],vnKv:400,parentId:'G'};
 const model={...n,sites,buses:[...n.buses,remote],lines:[...n.lines,{...n.lines[0],id:'L2',sourceId:'L2'}]};assert.equal(oppositeStation(model,'L','S')?.site.id,'OTHER');assert.equal(oppositeStation(model,'L2','S')?.line.id,'L2');assert.equal(oppositeStation({...model,buses:model.buses.filter(b=>b.id!=='REMOTE')},'L','S'),null);assert.equal(oppositeStation({...model,buses:[...n.buses,{...remote,siteIds:['OTHER','AMBIGUOUS']}]},'L','S'),null);
 const h=new SldNavigationHistory();h.push({siteId:'S',lineId:'L2',scope:'station',bayId:''});assert.equal(h.back()?.lineId,'L2');assert.equal(h.length,0);
});
test('SLD positions are deterministic and contain every native port without solver values',()=>{
 const {n,sources}=fixture(cases[0][1],cases[0][2]),g=buildStationTopologyGraph(n,'S',sources),a=physicalStationLayout(g,allVoltageBands()),b=physicalStationLayout(g,allVoltageBands());assert.deepEqual(a,b);assert.equal(a.ports.size,n.buses.length);for(const p of a.ports.values())assert.ok(p.x>=0&&p.x<a.width&&p.y>=0&&p.y<a.height);
});
test('SLD genuine LF endpoint values remain unchanged and scenario options invalidate numerical labels',async()=>{
 const ctx=context(),n=acNetwork(3);ctx.network=n;ctx.scenario=new ScenarioStore(n.modelHash);const s=ctx.analysisSettings.value,id=identity(n.modelHash,emptyScenario(),'powerFlow',{analysisSettings:activeAnalysisSettings(s,'powerFlow'),analysisSettingsHash:analysisSettingsHash(s,'powerFlow'),controlContextHash:null}),r=await new BrowserJsPowerFlowEngine().runPowerFlow({network:n,scenario:emptyScenario(),identity:id,analysisSettings:s});ctx.resultStore.expect('base',id);assert.ok(ctx.resultStore.accept('base',r));const overlay=createSldResultOverlay(ctx,'LF'),b=r.branches[0],entry=overlay.entries.get(`${b.sourceClass}|${b.id}`)!;assert.equal(entry.values.pFromMw,b.pf);assert.equal(entry.values.qToMvar,b.qt);assert.equal(entry.values.iToA,b.itA);assert.equal(entry.values.pLossMw,b.pf+b.pt);assert.ok(overlay.entries.get('ElmTerm|B0'));
 ctx.powerFactoryControlContextHash='NEW_SOURCE';assert.equal(createSldResultOverlay(ctx,'LF').entries.size,0);
});
test('SLD cumulative S1/S2 delta uses the selected stored reference and existing partition/capacity gates',async()=>{
 const ctx=context(),n=acNetwork(3);ctx.network=n;ctx.scenario=new ScenarioStore(n.modelHash);ctx.scenario.setStatus('lineStatus','L0',false,true);const settings=ctx.analysisSettings.value,engine=new BrowserJsPowerFlowEngine();
 const run=async()=>{const id=identity(n.modelHash,ctx.scenario.current,'powerFlow',{analysisSettings:activeAnalysisSettings(settings,'powerFlow'),analysisSettingsHash:analysisSettingsHash(settings,'powerFlow'),controlContextHash:null}),r=await engine.runPowerFlow({network:n,scenario:ctx.scenario.current,identity:id,analysisSettings:settings});ctx.resultStore.selectScenario(ctx.scenario.selectedId);ctx.resultStore.expect('scenario',id);assert.ok(ctx.resultStore.accept('scenario',r));return r;};
 const s1=ctx.scenario.selectedId,before=await run();ctx.scenario.setStatus('lineStatus','L1',false,true);const after=await run();ctx.resultStore.comparisonScenarioId=s1;ctx.resultStore.role='delta';ctx.resultView.source='Senaryo−Baz';const o=createSldResultOverlay(ctx,'LF'),b=after.branches.find(b=>b.id==='BYPASS')!,a=before.branches.find(b=>b.id==='BYPASS')!;assert.equal(o.phase,'CHANGE');assert.equal(o.entries.get('ElmLne|BYPASS')?.values.pFromMw,b.pf-a.pf);assert.equal(o.entries.get('ElmLne|L1')?.values.pFromMw,0-before.branches.find(b=>b.id==='L1')!.pf);assert.equal(o.entries.get('ElmLne|L1')?.values.loadingPercent,null);const native=n.lines.find(e=>e.id==='BYPASS')!;assert.equal(o.entries.get('ElmLne|BYPASS')?.values.fromTerminal,native.from);assert.equal(o.entries.get('ElmLne|BYPASS')?.values.toTerminal,native.to);assert.equal(portResultRows(o,'ElmLne|BYPASS',native.to)[0],'ΔP: '+resultNumber(b.pt-a.pt)+' MW');
});
test('SLD N1 uses selected actual AC owner; BASE/POST/CHANGE and rejection never reuse old numeric POST',async()=>{
 const ctx=context(),n=acNetwork(3);ctx.network=n;ctx.scenario=new ScenarioStore(n.modelHash);ctx.resultView.analysis='N1';ctx.resultView.caseId='N1:ElmLne:L0';ctx.resultView.phase='POST';ctx.n1AcResults=await validateAcOutages(n,emptyScenario(),[{caseId:ctx.resultView.caseId,sourceClass:'ElmLne',fid:'L0'}],{analysisSettings:ctx.analysisSettings.value,controlPolicy:'ALLOW_PARTIAL'});assert.ok(ctx.n1AcResults[0].result);
 const overlay=createSldResultOverlay(ctx,'N1'),b=ctx.n1AcResults[0].result!.branches[0];assert.equal(overlay.entries.get(`${b.sourceClass}|${b.id}`)?.values.pToMw,b.pt);assert.equal(overlay.outageKey,'ElmLne|L0');assert.equal(overlay.method,'MANUAL_FULL_AC');const native=[...n.lines,...n.transformers].find(e=>e.id===b.id)!;assert.equal(overlay.entries.get(`${b.sourceClass}|${b.id}`)?.values.toTerminal,native.to);assert.equal(portResultRows(overlay,`${b.sourceClass}|${b.id}`,native.to)[1],'Q: '+resultNumber(b.qt)+' MVAr');ctx.resultView.phase='CHANGE';assert.equal(createSldResultOverlay(ctx,'N1').entries.get(`${b.sourceClass}|${b.id}`)?.values.pFromMw,null);
 ctx.n1AcResults=[{...ctx.n1AcResults[0],status:'NOT_COMPUTABLE',result:null}];ctx.resultView.phase='POST';assert.equal(createSldResultOverlay(ctx,'N1').entries.size,0);
});
test('SLD actual SC diagnostic quantities preserve normative BLOCKED and profile/source stale gates',async()=>{
 const ctx=context(),n=acNetwork(2);ctx.network=n;ctx.scenario=new ScenarioStore(n.modelHash);ctx.resultView.analysis='SC';ctx.scContext={modelHash:n.modelHash,audit:[],invalidBranches:[],sources:[{sourceClass:'ElmXnet',fid:'SLACK',bus:'B0',inService:true,rOhm:1,xOhm:10,reason:'',sourceRef:'INDEPENDENT_PHYSICAL_TEST_SOURCE_OHM'}]};const profile={faultType:'3PH' as const,calculateMode:'MAX' as const,voltageFactor:1.1,factorProvenance:'EXPLICIT_DIAGNOSTIC',edition:null,rfOhm:0,xfOhm:0,maxFaults:2,timeBudgetMs:30000};ctx.scResult=await calculateThreePhase(n,emptyScenario(),ctx.scContext,['B0'],profile);let overlay=createSldResultOverlay(ctx,'SC');assert.equal(overlay.entries.get('ElmTerm|B0')?.values.ikssKa,ctx.scResult.faults[0].ikssKa);assert.equal(overlay.entries.get('ElmTerm|B0')?.values.ipKa,null);
 ctx.scResult=await calculateThreePhase(n,emptyScenario(),ctx.scContext,['B0'],{...profile,edition:'IEC60909-0:2016'});overlay=createSldResultOverlay(ctx,'SC');assert.match(overlay.status,/BLOCKED/);assert.equal(overlay.entries.get('ElmTerm|B0')?.values.ikssKa,null);ctx.scContext={...ctx.scContext,assumptions:['CHANGED']};assert.equal(createSldResultOverlay(ctx,'SC').status,'STALE');
});
