import test from 'node:test';import assert from 'node:assert/strict';
import type {CanonicalNetwork} from '../../src/domain/model/network';
import {acNetwork} from '../helpers/ac-network';
import {BrowserJsPowerFlowEngine} from '../../src/analysis/api/browser-js-engine';
import {identity} from '../../src/domain/calculation/identity';
import {emptyScenario,effectiveNetwork,ScenarioStore} from '../../src/domain/scenario/overlay';
import {defaultAnalysisSettings,activeAnalysisSettings,analysisSettingsHash} from '../../src/domain/calculation/analysis-settings';
import {reconstructSwitchFlows} from '../../src/analysis/power-flow/switch-flows';
import {prepareModel} from '../../src/analysis/power-flow/preparation';
import {mapResults} from '../../src/analysis/power-flow/results';
import {solveNR} from '../../src/analysis/power-flow/js/newton';
import {createSldResultOverlay} from '../../src/features/sld/result-overlay';
import {lfPowerRows} from '../../src/features/sld/result-labels';
import {ResultStore} from '../../src/domain/results/store';import {defaultSettings} from '../../src/persistence/settings';import type {AppContext} from '../../src/app/contracts';
function mutable(count=3){const n=acNetwork(count);return {...n,buses:n.buses.map(e=>({...e})),lines:n.lines.map(e=>({...e})),loads:n.loads.map(e=>({...e})),switches:n.switches.map(e=>({...e}))};}
function network(){const n=mutable(),entity={name:'CB',sourceId:'CB',sourceClass:'ElmCoup',siteIds:[],sourceRefs:{},inService:true};n.switches=[{...entity,id:'CB',from:'B1',to:'B2',closed:true}];return n;}
const settings=()=>{const s=defaultAnalysisSettings();s.powerFlow.activeBalancingMode='SINGLE_REFERENCE';s.powerFlow.stationControlMode='off';return s;};
async function run(n:CanonicalNetwork=network(),scenario=emptyScenario(),s=settings()){return new BrowserJsPowerFlowEngine().runPowerFlow({network:n,scenario,analysisSettings:s,identity:identity(n.modelHash,scenario,'powerFlow',{analysisSettings:activeAnalysisSettings(s,'powerFlow'),analysisSettingsHash:analysisSettingsHash(s,'powerFlow'),controlContextHash:null})});}
test('Full AC emits signed constant-PQ load results only after a solved voltage exists',async()=>{
 const n=mutable(),before=structuredClone(n),r=await run(n),load=r.loads!.find(l=>l.id==='LOAD')!;assert.ok(r.converged);assert.equal(load.status,'SOLVED_CONSTANT_PQ');assert.equal(load.pMw,30);assert.equal(load.qMvar,10);assert.equal(load.model,'CONSTANT_PQ');assert.ok(load.voltagePu!>0&&load.voltagePu!==1);assert.deepEqual(n,before);
 n.loads=[{...n.loads[0],pMw:-33.04,qMvar:6.6}];const negative=await run(n);assert.equal(negative.loads![0].pMw,-33.04);assert.equal(negative.loads![0].qMvar,6.6);
});
test('Scenario load P/Q and open cubicles are represented without dispatch fallback',async()=>{
 const n=mutable(),s={...emptyScenario()};s.loadAdjustments={LOAD:{pMw:12,qMvar:4}};const r=await run(n,s);assert.equal(r.loads![0].pMw,12);assert.equal(r.loads![0].qMvar,4);assert.equal(n.loads[0].pMw,30);
 n.switches=[{id:'OPEN',name:'OPEN',sourceId:'OPEN',sourceClass:'StaSwitch',sourceRefs:{},from:'B2',to:'B2',equipmentId:'LOAD',inService:true,closed:false,siteIds:[]}];const blocked=await run(n);assert.equal(blocked.loads![0].status,'BLOCKED_OPEN_CUBICLE');assert.equal(blocked.loads![0].pMw,null);
 n.loads=[{...n.loads[0],inService:false}];assert.equal((await run(n)).loads![0].status,'OUT_OF_SERVICE');
});
test('Final active-balance corrections are allocated only to the exact eligible loads',()=>{
 const n=mutable(2);n.loads=[{...n.loads[0],id:'A',pMw:10,activeBalanceEligibility:true},{...n.loads[0],id:'B',pMw:30,activeBalanceEligibility:true},{...n.loads[0],id:'FIXED',pMw:20,activeBalanceEligibility:false}];const b=prepareModel(n),r=solveNR(b.model);assert.ok(r.converged);const bus=b.loads![0].index;r.activeBalanceLoadAdjustmentsMw=Array(b.model.n).fill(0);r.activeBalanceLoadAdjustmentsMw[bus]=-8;const mapped=mapResults(b,r,identity(n.modelHash,emptyScenario(),'powerFlow'));assert.deepEqual(mapped.loads!.map(l=>l.pMw),[8,24,20]);assert.deepEqual(mapped.loads!.map(l=>l.activeBalanceAdjustmentMw),[-2,-6,0]);assert.deepEqual(mapped.loads!.map(l=>l.qMvar),[10,10,10]);
});
test('Requested unsupported load-voltage dependence is explicit, never a fabricated ZIP result',async()=>{const s=settings();s.powerFlow.loadVoltageDependency=true;const r=await run(acNetwork(3),emptyScenario(),s);assert.equal(r.loads![0].status,'UNSUPPORTED_LOAD_VOLTAGE_DEPENDENCY');assert.equal(r.loads![0].pMw,null);assert.equal(r.loads![0].qMvar,null);});
test('A native ideal bridge has unique signed KCL powers; reversing FROM/TO reverses sign',async()=>{
 const n=network();n.lines=n.lines.filter(l=>l.id!=='L1');const r=await run(n);assert.ok(r.converged);const sw=r.switchFlows!.find(s=>s.id==='CB')!;assert.equal(sw.status,'SWITCH_FLOW_CALCULATED');assert.ok(Math.abs(sw.pf!-15)<.1);assert.ok(Math.abs(sw.qf!-5)<.5);assert.equal(sw.pt,-sw.pf!);assert.equal(sw.qt,-sw.qf!);const reversed=structuredClone(n);[reversed.switches[0].from,reversed.switches[0].to]=[reversed.switches[0].to,reversed.switches[0].from];const rev=reconstructSwitchFlows(reversed,r).find(s=>s.id==='CB')!;assert.equal(rev.pf,-sw.pf!);assert.equal(rev.qf,-sw.qf!);
});
test('Parallel ideal paths and cycles remain non-unique, while a bridge leaving a cycle is solved',async()=>{
 const n=network();n.lines=n.lines.filter(l=>l.id!=='L1');n.buses.push({...n.buses[1],id:'C',sourceId:'C'});n.loads=[{...n.loads[0],bus:'C'}];n.switches.push({...n.switches[0],id:'PARALLEL',sourceId:'PARALLEL'},{...n.switches[0],id:'TAIL',sourceId:'TAIL',from:'B2',to:'C'});const r=await run(n);for(const id of ['CB','PARALLEL']){const s=r.switchFlows!.find(s=>s.id===id)!;assert.equal(s.reason,'IDEAL_SWITCH_CYCLE_NON_UNIQUE');assert.equal(s.pf,null);}assert.equal(r.switchFlows!.find(s=>s.id==='TAIL')!.pf,30);
});
test('Open/off switches, missing injections and excessive KCL residuals cannot claim a flow',async()=>{
 const n=network();n.lines=n.lines.filter(l=>l.id!=='L1');const r=await run(n),incomplete=structuredClone(r);incomplete.loads=undefined;assert.equal(reconstructSwitchFlows(n,incomplete).find(s=>s.id==='CB')!.reason,'INCOMPLETE_NATIVE_INJECTIONS');const wrong=structuredClone(r);wrong.loads![0].pMw=999;assert.equal(reconstructSwitchFlows(n,wrong).find(s=>s.id==='CB')!.reason,'NATIVE_KCL_RESIDUAL_EXCEEDS_TOLERANCE');n.switches=[{...n.switches[0],closed:false}];assert.equal((await run(n)).switchFlows![0].reason,'SWITCH_OPEN');n.switches=[{...n.switches[0],inService:false}];assert.equal((await run(n)).switchFlows![0].reason,'OUT_OF_SERVICE');
});
test('Load/switch SLD uses exact result FIDs; old snapshots and stale identities never borrow model P0',async()=>{
 const n=network();n.lines=n.lines.filter(l=>l.id!=='L1');const s=settings(),r=await run(n),store=new ResultStore();store.expect('base',r.identity);store.accept('base',r);const ctx={network:n,scenario:new ScenarioStore(n.modelHash),analysisSettings:{value:s},settings:{value:defaultSettings()},resultStore:store,resultView:{analysis:'LF',source:'GA',phase:'BASE',scenarioId:'B0',metric:'pFromMw'},powerFactoryControlContextHash:null,n1AcResults:[],hybridResult:null,n1Result:null,scResult:null,scContext:null} as unknown as AppContext;
 const o=createSldResultOverlay(ctx,'LF');assert.deepEqual(lfPowerRows(o,'ElmLod|LOAD','B2'),['30.0 MW','10.0 MVAr']);assert.equal(o.entries.get('ElmCoup|CB')!.values.pFromMw,r.switchFlows![0].pf);ctx.powerFactoryControlContextHash='CHANGED';assert.equal(createSldResultOverlay(ctx,'LF').entries.size,0);ctx.powerFactoryControlContextHash=null;const old=structuredClone(r);delete old.loads;delete old.switchFlows;store.accept('base',old);assert.deepEqual(lfPowerRows(createSldResultOverlay(ctx,'LF'),'ElmLod|LOAD','B2'),['— MW','— MVAr']);assert.equal(createSldResultOverlay(ctx,'LF').entries.get('ElmLod|LOAD')!.status,'LOAD_RESULT_UNAVAILABLE_RECALCULATE');
});
test('Scenario-minus-base load and switch rows use two solved snapshots and reject stale edits',async()=>{
 const n=network();n.lines=n.lines.filter(l=>l.id!=='L1');const s=settings(),scenario=new ScenarioStore(n.modelHash),store=new ResultStore(),base=await run(n,emptyScenario(),s);store.expect('base',base.identity);store.accept('base',base);scenario.replace({...emptyScenario(),loadAdjustments:{LOAD:{pMw:12,qMvar:4}}});store.selectScenario(scenario.selectedId);const post=await run(n,scenario.current,s);store.expect('scenario',post.identity);store.accept('scenario',post);store.role='delta';const ctx={network:n,scenario,analysisSettings:{value:s},settings:{value:defaultSettings()},resultStore:store,resultView:{analysis:'LF',source:'Senaryo−Baz',phase:'CHANGE',scenarioId:scenario.selectedId,metric:'pFromMw'},powerFactoryControlContextHash:null,n1AcResults:[],hybridResult:null,n1Result:null,scResult:null,scContext:null} as unknown as AppContext;
 const o=createSldResultOverlay(ctx,'LF');assert.equal(o.entries.get('ElmLod|LOAD')!.values.pMw,-18);assert.equal(o.entries.get('ElmLod|LOAD')!.values.qMvar,-6);assert.equal(o.entries.get('ElmCoup|CB')!.values.pFromMw,post.switchFlows![0].pf!-base.switchFlows![0].pf!);scenario.replace({...scenario.current,loadAdjustments:{LOAD:{pMw:11,qMvar:4}}});assert.equal(createSldResultOverlay(ctx,'LF').entries.size,0);
});
