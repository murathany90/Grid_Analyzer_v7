import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateThreePhase,type ScProfile} from '../../src/analysis/short-circuit';
import {adaptShortCircuitSources} from '../../src/importers/powerfactory-benchmark/short-circuit-source';
import type {ScSourceContext} from '../../src/analysis/short-circuit/source-adapter';
import {factorPositiveSequence} from '../../src/analysis/short-circuit/positive-sequence';
import {emptyScenario} from '../../src/domain/scenario/overlay';
import {acNetwork} from '../helpers/ac-network';
import {syntheticBenchmarkPair} from '../helpers/benchmark-model';
import {loadBenchmarkModel} from '../../src/importers/powerfactory-benchmark/model';
const profile:ScProfile={faultType:'3PH',calculateMode:'MAX',voltageFactor:1.1,factorProvenance:'EXPLICIT_ANALYTICAL_TEST_PROFILE; NOT_IEC_CERTIFICATION',edition:null,rfOhm:0,xfOhm:0,maxFaults:10,timeBudgetMs:30000};
const context=(n:ReturnType<typeof acNetwork>):ScSourceContext=>({modelHash:n.modelHash,audit:[],invalidBranches:[],sources:[{sourceClass:'ElmXnet',fid:'SLACK',bus:'B0',inService:true,rOhm:1,xOhm:10,reason:'',sourceRef:'INDEPENDENT_PHYSICAL_TEST_SOURCE_OHM'}]});
const near=(a:number|null,b:number)=>assert.ok(a!==null&&Math.abs(a-b)<1e-8*Math.max(1,Math.abs(b)),`${a} vs ${b}`);
for(const count of [2,3,5])test(`independent SC ${count}-bus radial Zkk / Ikss / Skss and one factorization`,async()=>{
  const n={...acNetwork(count),lines:acNetwork(count).lines.filter(l=>l.id!=='BYPASS')};
  const result=await calculateThreePhase(n,emptyScenario(),context(n),n.buses.map(b=>b.id),profile);
  assert.equal(result.factorizations,1);assert.equal(result.rhsCount,count);assert.equal(result.dimensions[0].dimension,2*count);
  result.faults.forEach((f,i)=>{assert.equal(f.status,'CALCULATED_NETWORK_APPROXIMATION');near(f.zkkOhm!.re,1);near(f.zkkOhm!.im,10*(i+1));const ikss=110/(Math.sqrt(3)*Math.hypot(1,10*(i+1)));near(f.ikssKa,ikss);near(f.skssMva,Math.sqrt(3)*100*ikss);assert.ok(f.residual!<1e-10);assert.equal(f.ipKa,null);assert.equal(f.ibKa,null);assert.equal(f.ithKa,null);});
});
test('parallel branches halve branch impedance; fault resistance is in ohms',async()=>{
  const n=acNetwork(2),r=await calculateThreePhase(n,emptyScenario(),context(n),['B1'],{...profile,rfOhm:2});near(r.faults[0].zkkOhm!.im,15);near(r.faults[0].ikssKa,110/(Math.sqrt(3)*Math.hypot(3,15)));
});
test('transformer impedance base and non-unity ratio independently agree',()=>{
  const f=factorPositiveSequence(2,[{a:0,b:1,rPu:.01,xPu:.1,tap:1.05,phaseRad:.4}],[{bus:0,rPu:.01,xPu:.1}]);
  try{const z=f.drivingPoint(1);near(z.zPu.re,.01+.01/1.05**2);near(z.zPu.im,.1+.1/1.05**2);assert.ok(z.residual<1e-10);}finally{f.dispose();}
});
test('100/10 kV transformer gives low-side ohms and kA, not high-side nominal base',async()=>{
  const base=acNetwork(2),n={...base,buses:base.buses.map(b=>({...b,vnKv:b.id==='B0'?100:10})),lines:[],transformers:[{...base.lines[0],sourceClass:'ElmTr2',sourceId:'T',id:'T',vnKv:100,lvKv:10,rPu:.01,xPu:.1,tap:1,phase:0,ratingMva:100,tapPosition:0,gPu:0,bPu:0}]};
  const r=await calculateThreePhase(n,emptyScenario(),context(n),['B1'],profile);near(r.faults[0].zkkOhm!.re,.02);near(r.faults[0].zkkOhm!.im,.2);near(r.faults[0].ikssKa,11/(Math.sqrt(3)*Math.hypot(.02,.2)));
});
test('closed/open switch, scenario and wrong fault identity never reuse old result',async()=>{
  const base=acNetwork(3),n={...base,lines:base.lines.filter(l=>l.id==='L1'),switches:[{...base.lines[0],id:'SW',sourceId:'SW',sourceClass:'ElmCoup',closed:true}]};
  const r=await calculateThreePhase(n,emptyScenario(),context(n),['B2','UNKNOWN'],profile);assert.equal(r.faults[0].status,'CALCULATED_NETWORK_APPROXIMATION');assert.equal(r.faults[1].reasons[0],'NO_ACTIVE_FAULT_BUS');
  const s={...emptyScenario(),switchState:{SW:false}},open=await calculateThreePhase(n,s,context(n),['B2'],profile);assert.equal(open.faults[0].status,'BLOCKED');assert.notEqual(open.identity.scenarioHash,r.identity.scenarioHash);
});
test('negative/sentinel/zero X/missing source, unsupported converter and unbalanced faults are blocked',async()=>{
  const n=acNetwork();for(const x of [0,-1,99999,NaN]){const c=context(n);c.sources[0].xOhm=x;const r=await calculateThreePhase(n,emptyScenario(),c,['B2'],profile);assert.equal(r.faults[0].status,'BLOCKED');assert.equal(r.faults[0].ikssKa,null);}
  const c=context(n);c.sources.push({...c.sources[0],fid:'CONVERTER',sourceClass:'ElmGenStat',reason:'UNSUPPORTED_CONVERTER'});assert.equal((await calculateThreePhase(n,emptyScenario(),c,['B2'],profile)).faults[0].status,'BLOCKED');
  for(const faultType of ['1LG','LL','2LG'] as const)assert.deepEqual((await calculateThreePhase(n,emptyScenario(),context(n),['B2'],{...profile,faultType})).faults[0].reasons,['MISSING_SEQUENCE_FOR_UNBALANCED']);
  await assert.rejects(calculateThreePhase(n,emptyScenario(),{...c,modelHash:'wrong'},['B2'],profile),/MODEL_MISMATCH/);
  assert.equal((await calculateThreePhase(n,emptyScenario(),context(n),['B2'],profile,{signal:AbortSignal.abort()})).faults[0].status,'CANCELLED');
  await assert.rejects(calculateThreePhase(n,emptyScenario(),context(n),['B1','B2'],{...profile,maxFaults:1}),/PROFILE/);
});
test('small DGS with explicitly exported ElmVac impedance computes independently',async()=>{
  const pair=syntheticBenchmarkPair(),loaded=await loadBenchmarkModel(pair.model),raw={...pair.raw,ElmXnet:{Attributes:['FID'],Values:[]},ElmVac:{Attributes:['FID','bus1','outserv','r1','x1','usetp'],Values:[['VAC','SYN-CX',0,1,10,1]]}};
  const n={...loaded.network,externalGrids:[]},c=adaptShortCircuitSources(raw,n),r=await calculateThreePhase(n,emptyScenario(),c,['SYN-B1'],profile);
  assert.equal(r.faults[0].status,'CALCULATED_NETWORK_APPROXIMATION');near(r.faults[0].zkkOhm!.re,2);near(r.faults[0].zkkOhm!.im,20);assert.ok(c.audit.some(a=>a.field==='r1'&&a.unit==='ohm'));
  const bad=adaptShortCircuitSources({...raw,ElmVac:{...raw.ElmVac,Values:[['VAC','SYN-CX',0,1,99999,1]]}},n);assert.equal((await calculateThreePhase(n,emptyScenario(),bad,['SYN-B1'],profile)).faults[0].status,'BLOCKED');
});
test('inconsistent collapsed kV, negative line resistance and invalid transformer type remain blocked',async()=>{
  const base=acNetwork(),bad={...base,lines:base.lines.map(l=>({...l,rOhm:-1}))};assert.equal((await calculateThreePhase(bad,emptyScenario(),context(bad),['B2'],profile)).faults[0].status,'BLOCKED');
  const switched={...base,buses:base.buses.map(b=>({...b,vnKv:b.id==='B1'?99:100})),switches:[{...base.lines[0],id:'SW',sourceId:'SW',sourceClass:'ElmCoup',closed:true}]};assert.equal((await calculateThreePhase(switched,emptyScenario(),context(switched),['B2'],profile)).faults[0].status,'BLOCKED');
  const c=context(base);c.invalidBranches=[{sourceClass:'ElmLne',fid:'L0',reason:'INVALID_UNIT_OR_UNVERIFIED_TRANSFORMER_BASE_TAP'}];assert.equal((await calculateThreePhase(base,emptyScenario(),c,['B2'],profile)).faults[0].ikssKa,null);
});
