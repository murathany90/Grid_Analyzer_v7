import test from 'node:test';
import assert from 'node:assert/strict';
import {acNetwork} from '../helpers/ac-network';
import {emptyScenario} from '../../src/domain/scenario/overlay';
import {calculateThreePhase,type ScProfile} from '../../src/analysis/short-circuit';
import {adaptShortCircuitSources} from '../../src/importers/powerfactory-benchmark/short-circuit-source';
import {selectFaultTerminals} from '../../src/domain/benchmark/study-scope';
import {syntheticBenchmarkPair} from '../helpers/benchmark-model';
import {loadBenchmarkModel} from '../../src/importers/powerfactory-benchmark/model';
const profile:ScProfile={faultType:'3PH',calculateMode:'MAX',voltageFactor:1.1,factorProvenance:'ANALYTICAL_APPROXIMATION',edition:null,rfOhm:0,xfOhm:0,maxFaults:5,timeBudgetMs:30000};
const near=(a:number|null,b:number)=>assert.ok(a!==null&&Math.abs(a-b)<1e-8*Math.max(1,Math.abs(b)),`${a} vs ${b}`);
test('Norton current injection superposes on radial voltage-source fault current',async()=>{
 const base=acNetwork(2),n={...base,lines:base.lines.filter(l=>l.id!=='BYPASS')},context={modelHash:n.modelHash,audit:[],invalidBranches:[],sources:[{sourceClass:'ElmXnet',fid:'SLACK',bus:'B0',inService:true,rOhm:0,xOhm:10,reason:'',sourceRef:'ANALYTIC_OHM'},{sourceClass:'ElmGenStat',fid:'CS',bus:'B1',inService:true,rOhm:null,xOhm:null,currentKa:1,currentAngleDeg:-90,reason:'',sourceRef:'ANALYTIC_KA_PHASE'}]};
 const r=await calculateThreePhase(n,emptyScenario(),context,['B1'],profile);near(r.faults[0].ikssKa,110/(Math.sqrt(3)*20)+1);near(r.faults[0].skssMva,Math.sqrt(3)*100*r.faults[0].ikssKa!);assert.ok(r.faults[0].residual!<1e-10);
 const missing={...context,sources:context.sources.map(s=>s.fid==='CS'?{...s,currentKa:undefined,reason:'MISSING_CONTRIBUTION'}:s)};assert.equal((await calculateThreePhase(n,emptyScenario(),missing,['B1'],profile)).faults[0].status,'BLOCKED');
});
test('native machine base and explicit missing-machine assumptions remain separate',async()=>{
 const loaded=await loadBenchmarkModel(syntheticBenchmarkPair().model),n={...loaded.network,externalGrids:[]},raw={...loaded.raw,ElmXnet:undefined,ElmSym:{Attributes:['FID','bus1','outserv','typ_id','ngnum'],Values:[['G','SYN-CX',0,'GT',2]]},TypSym:{Attributes:['FID','rstr','xdss','ugn','sgn'],Values:[['GT',.01,.2,100,100]]}};
 const c=adaptShortCircuitSources(raw,n);near(c.sources[0].rOhm,.5);near(c.sources[0].xOhm,10);assert.equal(c.sources[0].reason,'');
 const missing={...raw,TypSym:{...raw.TypSym,Values:[['GT',.01,'',100,100]]}};assert.ok(adaptShortCircuitSources(missing,n).sources[0].reason);
 const approx=adaptShortCircuitSources(missing,n,undefined,{missingMachineXdssPu:.3,missingMachineRPu:.02,provenance:'EXPLICIT_TEST_ASSUMPTION'});near(approx.sources[0].xOhm,15);assert.match(approx.sources[0].sourceRef,/ASSUMPTION/);
 const r=await calculateThreePhase(n,emptyScenario(),approx,['SYN-B1'],profile);assert.equal(r.faults[0].status,'CALCULATED_NETWORK_APPROXIMATION');assert.equal(r.faults[0].ipKa,null);
});
test('native capital voltage-source fields and MAX/MIN source snapshots are validated',async()=>{
 const loaded=await loadBenchmarkModel(syntheticBenchmarkPair().model),n={...loaded.network,externalGrids:[]},raw={...loaded.raw,ElmXnet:undefined,ElmVac:{Attributes:['FID','bus1','outserv','R1','X1','usetp'],Values:[['V','SYN-CX',0,160000,160000,1]]}};
 const c=adaptShortCircuitSources(raw,n);assert.equal(c.sources[0].reason,'');const r=await calculateThreePhase(n,emptyScenario(),c,['SYN-B1'],profile);assert.equal(r.faults[0].status,'CALCULATED_NETWORK_APPROXIMATION');
 await assert.rejects(calculateThreePhase(n,emptyScenario(),c,['SYN-B1'],{...profile,calculateMode:'MIN'}),/MODE_MISMATCH/);
 const min=adaptShortCircuitSources(raw,n,undefined,{mode:'MIN'});assert.equal((await calculateThreePhase(n,emptyScenario(),min,['SYN-B1'],{...profile,calculateMode:'MIN'})).method,'GA_POSITIVE_SEQUENCE_3PH_MIN');
 const converter={...raw,ElmGenStat:{Attributes:['FID','bus1','outserv','psutype','Ikss3PF','ngnum'],Values:[['CS','SYN-CX',0,'fsce',1.25,1]]}},options={converterAngleDeg:-90,converterTerminalBasis:true,provenance:'EXPLICIT_TERMINAL_BASIS'};assert.ok(adaptShortCircuitSources(converter,n).sources.find(s=>s.fid==='CS')!.reason);near(adaptShortCircuitSources(converter,n,undefined,options).sources.find(s=>s.fid==='CS')!.currentKa??null,1.25);assert.equal(adaptShortCircuitSources(converter,n,undefined,{...options,mode:'MIN'}).sources.find(s=>s.fid==='CS')!.currentKa,0);
});
test('fault YTM/search/voltage filtering retains all electrical sources and outside branches',()=>{
 const base=acNetwork(),n={...base,buses:base.buses.map((b,i)=>({...b,siteIds:['S'+i],vnKv:i===1?34.5:400})),sites:base.buses.map((b,i)=>({...b,id:'S'+i,areaId:i===0?'A':'B',areaName:'same name',lat:null,lon:null,voltages:[400]}))};
 assert.deepEqual(selectFaultTerminals(n,{ytmIds:['B'],voltageBands:[33]}),['B1']);assert.deepEqual(selectFaultTerminals(n,{ytmIds:['A'],search:'B1'}),[]);assert.equal(selectFaultTerminals(n,{ytmIds:['A','B']}).length,3);assert.equal(n.externalGrids.length,1);assert.equal(n.lines.length,3);
});
