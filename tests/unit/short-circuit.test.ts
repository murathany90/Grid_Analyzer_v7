import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateThreePhase,scFaultCatalog,clearScPreparationCache,type ScProfile} from '../../src/analysis/short-circuit';
import {adaptShortCircuitSources} from '../../src/importers/powerfactory-benchmark/short-circuit-source';
import type {ScSourceContext} from '../../src/analysis/short-circuit/source-adapter';
import {factorPositiveSequence} from '../../src/analysis/short-circuit/positive-sequence';
import {emptyScenario} from '../../src/domain/scenario/overlay';
import {acNetwork} from '../helpers/ac-network';
import {syntheticBenchmarkPair} from '../helpers/benchmark-model';
import {loadBenchmarkModel} from '../../src/importers/powerfactory-benchmark/model';
import {zipSync,strToU8} from 'fflate';
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

test('bounded SC batches reuse component factors; source, scenario and model changes invalidate preparation',async()=>{
  clearScPreparationCache();const n=acNetwork(3),c=context(n),scope=scFaultCatalog(n,emptyScenario(),c,['B0','B1','B1','UNKNOWN']);
  assert.equal(scope.physicalTerminals,3);assert.equal(scope.electricalPartitions,2);assert.equal(scope.unmappedTerminals,1);assert.equal(scope.networkPartitions,3);
  assert.equal(scope.identity.targetHash,scFaultCatalog(n,emptyScenario(),c,['UNKNOWN','B1','B0']).identity.targetHash);assert.notEqual(scope.identity.targetHash,scFaultCatalog(n,emptyScenario(),c,['B0','B2','UNKNOWN']).identity.targetHash);
  const first=await calculateThreePhase(n,emptyScenario(),c,['B0'],profile),next=await calculateThreePhase(n,emptyScenario(),c,['B1'],profile);
  assert.equal(first.factorizations,1);assert.equal(next.factorizations,0);assert.equal(next.rhsCount,1);near(next.faults[0].zkkOhm!.im,10+20/3);
  c.sources[0].xOhm=20;const changed=await calculateThreePhase(n,emptyScenario(),c,['B1'],profile);assert.equal(changed.factorizations,1);assert.notEqual(changed.identity.sourceHash,next.identity.sourceHash);near(changed.faults[0].zkkOhm!.im,20+20/3);
  const opened=await calculateThreePhase(n,{...emptyScenario(),lineStatus:{L0:false,BYPASS:false}},c,['B1'],profile);assert.equal(opened.faults[0].status,'BLOCKED');assert.equal(opened.faults[0].ikssKa,null);
  const other={...n,modelHash:'separate-model'},fresh=await calculateThreePhase(other,emptyScenario(),{...c,modelHash:other.modelHash},['B0'],profile);assert.equal(fresh.factorizations,1);clearScPreparationCache();
});

test('retiring a preparation during an active batch does not dispose its leased factor',async()=>{
  clearScPreparationCache();const n=acNetwork(3),c=context(n),other={...acNetwork(2),modelHash:'concurrent-sc'};
  const [a,b]=await Promise.all([calculateThreePhase(n,emptyScenario(),c,['B0','B1','B2'],profile),calculateThreePhase(other,emptyScenario(),context(other),['B0'],profile)]);
  assert.equal(a.factorizations,1);assert.equal(a.rhsCount,3);assert.ok(a.faults.every(f=>f.status==='CALCULATED_NETWORK_APPROXIMATION'));assert.equal(b.factorizations,1);clearScPreparationCache();
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
  for(const faultType of ['LL','2LG'] as const)assert.deepEqual((await calculateThreePhase(n,emptyScenario(),context(n),['B2'],{...profile,faultType})).faults[0].reasons,['MISSING_SEQUENCE_FOR_UNBALANCED']);
  assert.deepEqual((await calculateThreePhase(n,emptyScenario(),context(n),['B2'],{...profile,faultType:'1LG'})).faults[0].reasons,['NOT_COMPUTABLE: MISSING_ZERO_SEQUENCE_PARAMETERS:line:L0']);
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
test('transformer with tap changer uses neutral tap position in short-circuit as per IEC 60909 and PF TechRef 4.1',async()=>{
  const base=acNetwork(2);
  // Base network has B0 at 100 kV and B1 at 10 kV
  // Transformer has operational tap = 1.15 (e.g. tap position +7 in load flow), but type nominals are 100 kV / 10 kV
  const n={...base,buses:base.buses.map(b=>({...b,vnKv:b.id==='B0'?100:10})),lines:[],transformers:[{...base.lines[0],sourceClass:'ElmTr2',sourceId:'T',id:'T',vnKv:100,lvKv:10,typeHvKv:100,typeLvKv:10,rPu:.01,xPu:.1,tap:1.15,phase:0,ratingMva:100,tapPosition:7,gPu:0,bPu:0}]};
  const r=await calculateThreePhase(n,emptyScenario(),context(n),['B1'],profile);
  // Because neutral tap = (100/100)/(10/10) = 1.0, impedance is NOT scaled by 1.15^2
  // High-side source: rPu = 0.01, xPu = 0.1 on 100 kV base -> reflected with neutral tap 1.0 -> same in p.u.
  // Total Zpu = (0.01 + 0.01) + j(0.1 + 0.1) = 0.02 + j0.2
  // zBase at 10 kV = 10^2 / 100 = 1.0 ohm. So zOhm = 0.02 + j0.2 ohm
  near(r.faults[0].zkkOhm!.re,.02);
  near(r.faults[0].zkkOhm!.im,.2);
  near(r.faults[0].ikssKa,11/(Math.sqrt(3)*Math.hypot(.02,.2)));
});
test('DGS transformer with HV tap changer maintains neutral impedance in short-circuit',async()=>{
  const pair=syntheticBenchmarkPair(),table=(Attributes:string[],Values:unknown[][])=>({Attributes,Values});
  // Replace line with a 100/10 kV transformer with HV tap changer (tap_side=0, dutap=2.5%, pos=+4 -> rel=1.10)
  const raw={...pair.raw,
    ElmTerm:table(['FID','loc_name','fold_id','uknom','outserv','iUsage'],[['SYN-B0','Bara 0','G0',100,0,0],['SYN-B1','Bara 1','G1',10,0,0]]),
    StaCubic:table(['FID','fold_id','obj_id'],[['SYN-C0','SYN-B0','TR-HV'],['SYN-C1','SYN-B1','TR-HV'],['SYN-CX','SYN-B0','VAC']]),
    TypLne:table(['FID'],[]),ElmLne:table(['FID'],[]),
    ElmXnet:table(['FID'],[]),
    ElmVac:table(['FID','loc_name','bus1','outserv','r1','x1','usetp'],[['VAC','Vac source','SYN-CX',0,1,10,1]]),
    TypTr2:table(['FID','loc_name','utrn_h','utrn_l','strn','uktr','pcutr','itapch','tap_side','dutap','nntap0','pfe','curmg'],
      [['TYP-TR','Trafo Tipi',100,10,100,10,1000,1,0,2.5,0,0,0]]),
    ElmTr2:table(['FID','loc_name','fold_id','typ_id','bushv','buslv','nntap','outserv'],
      [['TR-HV','HV Tap Trafo','G0','TYP-TR','SYN-C0','SYN-C1',4,0]])
  };
  const loaded=await loadBenchmarkModel(new File([zipSync({'test.json':strToU8(JSON.stringify(raw))})],'test.zip'));
  const n={...loaded.network,externalGrids:[]},c=adaptShortCircuitSources(raw,n);
  // Canonical LF tap is 1.10, but neutral tap is (100/100)/(10/10) = 1.0
  const r=await calculateThreePhase(n,emptyScenario(),c,['SYN-B1'],profile);
  assert.equal(r.faults[0].status,'CALCULATED_NETWORK_APPROXIMATION');
  const xExpected=0.1+Math.sqrt(0.1**2-0.01**2);
  near(r.faults[0].zkkOhm!.re,.02);
  near(r.faults[0].zkkOhm!.im,xExpected);
  near(r.faults[0].ikssKa,11/(Math.sqrt(3)*Math.hypot(.02,xExpected)));
});
test('DGS transformer with LV tap changer undoes rho^2 operational scaling for neutral short-circuit',async()=>{
  const pair=syntheticBenchmarkPair(),table=(Attributes:string[],Values:unknown[][])=>({Attributes,Values});
  // Replace line with a 100/10 kV transformer with LV tap changer (tap_side=1, dutap=2.5%, pos=+4 -> rel=1.10)
  const raw={...pair.raw,
    ElmTerm:table(['FID','loc_name','fold_id','uknom','outserv','iUsage'],[['SYN-B0','Bara 0','G0',100,0,0],['SYN-B1','Bara 1','G1',10,0,0]]),
    StaCubic:table(['FID','fold_id','obj_id'],[['SYN-C0','SYN-B0','TR-LV'],['SYN-C1','SYN-B1','TR-LV'],['SYN-CX','SYN-B0','VAC']]),
    TypLne:table(['FID'],[]),ElmLne:table(['FID'],[]),
    ElmXnet:table(['FID'],[]),
    ElmVac:table(['FID','loc_name','bus1','outserv','r1','x1','usetp'],[['VAC','Vac source','SYN-CX',0,1,10,1]]),
    TypTr2:table(['FID','loc_name','utrn_h','utrn_l','strn','uktr','pcutr','itapch','tap_side','dutap','nntap0','pfe','curmg'],
      [['TYP-TR','Trafo Tipi',100,10,100,10,1000,1,1,2.5,0,0,0]]),
    ElmTr2:table(['FID','loc_name','fold_id','typ_id','bushv','buslv','nntap','outserv'],
      [['TR-LV','LV Tap Trafo','G0','TYP-TR','SYN-C0','SYN-C1',4,0]])
  };
  const loaded=await loadBenchmarkModel(new File([zipSync({'test.json':strToU8(JSON.stringify(raw))})],'test.zip'));
  const n={...loaded.network,externalGrids:[]},c=adaptShortCircuitSources(raw,n);
  // In canonical.ts, LF rPu and xPu were multiplied by rho^2 = 1.21.
  // In SC, neutral tap position undoes rho^2 so neutral impedance remains exact 0.02 + j0.1995 ohm!
  const r=await calculateThreePhase(n,emptyScenario(),c,['SYN-B1'],profile);
  assert.equal(r.faults[0].status,'CALCULATED_NETWORK_APPROXIMATION');
  const xExpected=0.1+Math.sqrt(0.1**2-0.01**2);
  near(r.faults[0].zkkOhm!.re,.02);
  near(r.faults[0].zkkOhm!.im,xExpected);
  near(r.faults[0].ikssKa,11/(Math.sqrt(3)*Math.hypot(.02,xExpected)));
});


