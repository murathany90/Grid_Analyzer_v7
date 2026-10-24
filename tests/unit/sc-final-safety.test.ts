import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadBenchmarkModel} from '../../src/importers/powerfactory-benchmark/model';
import {adaptShortCircuitSources} from '../../src/importers/powerfactory-benchmark/short-circuit-source';
import {calculateThreePhase,type ScProfile} from '../../src/analysis/short-circuit';
import {emptyScenario} from '../../src/domain/scenario/overlay';
import {runYtmStudy} from '../../src/analysis/ytm-study';
import {engineeringSourceOptions} from '../../src/analysis/short-circuit/engineering-profile';
import {scResultIsAdmissible} from '../../src/analysis/short-circuit/result-validity';
const fixture=JSON.parse(await readFile('tests/fixtures/sc-mini-dgs.json','utf8'));
const profile:ScProfile={faultType:'1LG',calculateMode:'MAX',voltageFactor:1.1,factorProvenance:'Independent analytical test',edition:null,rfOhm:0,xfOhm:0,maxFaults:10,timeBudgetMs:30000};
const put=(raw:any,cls:string,field:string,value:unknown)=>{const t=raw[cls],i=t.Attributes.indexOf(field);if(i<0){t.Attributes.push(field);for(const row of t.Values)row.push(value);}else t.Values[0][i]=value;};
async function imported(raw:any){const loaded=await loadBenchmarkModel(new File([JSON.stringify(raw)],'sc-mini.json'));return {network:loaded.network,context:adaptShortCircuitSources(raw,loaded.network)};}
async function fault(raw:any,id='SYN-B1'){const {network,context}=await imported(raw);return (await calculateThreePhase(network,emptyScenario(),context,[id],profile)).faults[0];}
const near=(a:number|null|undefined,b:number)=>assert.ok(a!=null&&Math.abs(a-b)<1e-6*Math.max(1,Math.abs(b)),`${a} vs ${b}`);
const blocked=(f:Awaited<ReturnType<typeof fault>>)=>{assert.equal(f.status,'BLOCKED');assert.equal(f.ikssKa,null);assert.equal(f.quality,'NOT_COMPUTABLE');};
test('native transformer Z0 uses magnitude decomposition; neutral tap/type base analytical MAX and MIN',async()=>{
 for(const [hv,lv,tapSide] of [[110,10,0],[120,11,0],[120,11,1]]){
  const raw=structuredClone(fixture);put(raw,'TypTr2','utrn_h',hv);put(raw,'TypTr2','utrn_l',lv);put(raw,'TypTr2','itapch',1);put(raw,'TypTr2','dutap',2.5);put(raw,'TypTr2','tap_side',tapSide);put(raw,'ElmTr2','nntap',2);
  const {network}=await imported(raw);
  for(const mode of ['MAX','MIN'] as const){const context=adaptShortCircuitSources(raw,network,undefined,{mode}),c=mode==='MAX'?1.1:1;
   const f=(await calculateThreePhase(network,emptyScenario(),context,['SYN-B1'],{...profile,calculateMode:mode,voltageFactor:c})).faults[0];
   const z1=10*(lv/hv)**2+.1*(lv/10)**2,r0=.06*(lv/10)**2,x0=.08*(lv/10)**2;
   near(f.z1Ohm?.im,z1);near(f.z2Ohm?.im,z1);near(f.z0Ohm?.re,r0);near(f.z0Ohm?.im,x0);near(f.ikssKa,Math.sqrt(3)*c*10/Math.hypot(r0,2*z1+x0));
  }
 }
 const zero=structuredClone(fixture);put(zero,'TypTr2','ur0tr',0);put(zero,'TypTr2','pcutr',6000);near((await fault(zero)).z0Ohm?.re,0);
});
test('every active source requires explicit Z2 and Z0 even when another ground path exists',async()=>{
 for(const field of ['R2','X2','R0','X0']){const raw=structuredClone(fixture);put(raw,'ElmVac',field,null);blocked(await fault(raw));}
 const f=await fault(fixture,'SYN-B0');near(f.ikssKa,Math.sqrt(3)*1.1*110/30);
 const raw=structuredClone(fixture);raw.ElmVac.Values.push(['OTHER','Out of service','CX',1,0,1,0,1,0,1,1]);near((await fault(raw,'SYN-B0')).ikssKa,f.ikssKa!);
});
test('sentinel, negative, absent and nonfinite sequence/neutral fields never become finite grounding',async()=>{
 for(const value of [99999,999999,-1,null,NaN])for(const [cls,field] of [['ElmVac','R0'],['ElmVac','R2'],['TypTr2','ur0tr'],['ElmTr2','re0tr_l'],['ElmTr2','cneutcon']]){
  const raw=structuredClone(fixture);put(raw,cls,field,value);blocked(await fault(raw));
 }
 const impossible=structuredClone(fixture);put(impossible,'TypTr2','ur0tr',11);blocked(await fault(impossible));
 const vg=structuredClone(fixture);put(vg,'TypTr2','tr2cn_l','UNKNOWN');blocked(await fault(vg));
 for(const value of [99999,999999,-1,null,NaN])for(const field of ['rline0','xline0']){const raw=structuredClone(fixture);raw.ElmTerm.Values[1][3]=110;raw.ElmTr2.Values=[];raw.TypLne={Attributes:['FID','rline','xline','rline0','xline0'],Values:[['LT',0,1,0,3]]};raw.ElmLne={Attributes:['FID','typ_id','bus1','bus2','dline','outserv'],Values:[['TR1','LT','C0','C1',1,0]]};put(raw,'TypLne',field,value);blocked(await fault(raw));}
 const nec=structuredClone(fixture);nec.ElmNec={Attributes:['FID','bus1','outserv','R0','X0'],Values:[['NEC','CX',0,20,999999]]};blocked(await fault(nec));
 const pure=structuredClone(fixture);pure.ElmTr2.Values=[];put(pure,'ElmVac','R0',40);put(pure,'ElmVac','X0',0);const f=await fault(pure,'SYN-B0');near(f.z0Ohm?.re,40);near(f.ikssKa,Math.sqrt(3)*1.1*110/Math.hypot(40,20));
});
test('resume fills duplicate holes and only cancelled electrical targets in all four slots',async()=>{
 const {network}=await imported(fixture),scenario=emptyScenario(),contexts={MAX:adaptShortCircuitSources(fixture,network,undefined,engineeringSourceOptions('MAX',false)),MIN:adaptShortCircuitSources(fixture,network,undefined,engineeringSourceOptions('MIN',false))},options={ytmId:network.sites[0].areaId,profile:'FAST' as const,families:['SC' as const],timeBudgetMs:30000};
 const first=await runYtmStudy(network,scenario,contexts,options);
 for(const key of ['scMax','scMin','sc1LgMax','sc1LgMin'] as const)assert.equal(first[key]?.faults.length,2);
 const completed=first.scMax!.faults[0];first.scMax!.faults=[completed,{...completed}];
 const progress:number[]=[];const resumed=await runYtmStudy(network,scenario,contexts,options,{resume:first,onProgress:(s,d)=>{if(s==='SC_FAULT')progress.push(Number(d?.total));}});
 assert.deepEqual(progress,[1]);assert.equal(resumed.status,'COMPLETE');assert.equal(new Set(resumed.scMax!.faults.map(f=>f.physicalTerminalFid)).size,2);assert.equal(resumed.scMax!.faults[0],completed);
 const old=resumed.sc1LgMin!.faults[0];resumed.sc1LgMin!.faults[1]={...resumed.sc1LgMin!.faults[1],status:'CANCELLED',quality:undefined,ikssKa:null};progress.length=0;
 const done=await runYtmStudy(network,scenario,contexts,options,{resume:resumed,onProgress:(s,d)=>{if(s==='SC_FAULT')progress.push(Number(d?.total));}});assert.deepEqual(progress,[1]);assert.equal(done.sc1LgMin!.faults[0],old);assert.equal(done.status,'COMPLETE');assert.deepEqual(done.pendingCounts,{N1:0,SC_MAX:0,SC_MIN:0,SC1_MAX:0,SC1_MIN:0});
 const r=done.scMax!,expected={...r.identity,mode:'MAX' as const,faultType:'3PH' as const,context:contexts.MAX};assert.ok(scResultIsAdmissible(r,expected));assert.equal(scResultIsAdmissible({...r,engineRevision:undefined},expected),false);assert.equal(scResultIsAdmissible({...r,identity:{...r.identity,sourceHash:'bad'}},expected),false);
});
