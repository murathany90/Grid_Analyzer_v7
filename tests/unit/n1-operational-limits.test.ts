import test from 'node:test';
import assert from 'node:assert/strict';
import {operationalLimits,validateLimitProfiles,preflightOperationalLimits} from '../../src/analysis/contingency-hybrid/limits';
import {runHybridN1} from '../../src/analysis/contingency-hybrid';
import {comparePostConstraints} from '../../src/analysis/contingency-hybrid/constraints';
import {postResultAssembler} from '../../src/analysis/contingency-ac/post-results';
import {validateAcOutages} from '../../src/analysis/contingency-ac';
import {acNetwork} from '../helpers/ac-network';
import {emptyScenario} from '../../src/domain/scenario/overlay';
const defaults={voltageMinPu:.9,voltageMaxPu:1.1,operationalLoadingLimitPercent:100},voltage={id:'154',voltageKv:154,voltageMinPu:.95,voltageMaxPu:1.05,operationalLoadingLimitPercent:95,provenance:'USER_TEST'},area={...voltage,id:'OA154',ytmId:'OA',voltageMinPu:.97};
test('user limits are scoped by voltage and YTM without changing other elements',()=>{
  validateLimitProfiles([voltage,area]);assert.equal(operationalLimits(defaults,[voltage,area],154,['OA']).voltageMinPu,.97);assert.equal(operationalLimits(defaults,[voltage,area],154,['OTHER']).voltageMinPu,.95);assert.deepEqual(operationalLimits(defaults,[voltage,area],33,['OA']),defaults);
  assert.throws(()=>validateLimitProfiles([{...area,voltageMinPu:NaN}]),/INVALID_LIMIT/);assert.throws(()=>operationalLimits(defaults,[voltage,{...voltage,id:'conflict',voltageMinPu:.99}],154),/AMBIGUOUS/);
});
test('real POST constraints reject reversed endpoints and retain rating basis',async()=>{
  const n=acNetwork(),[r]=await validateAcOutages(n,emptyScenario(),[{caseId:'C',sourceClass:'ElmLne',fid:'BYPASS'}]),base=postResultAssembler(n,r.result!,'nominal'),a=base.branches[0];
  a.loading={...a.loading,operationalPercent:120,fromLimitA:100,toLimitA:100};const post=structuredClone(base);post.branches[0].from=a.to;post.branches[0].to=a.from;
  const row=comparePostConstraints(base,post,defaults).find(r=>r.fid===a.fid)!;assert.equal(row.state,'IDENTITY_UNVERIFIED');assert.equal(row.delta,null);
  const same=structuredClone(base);same.branches[0].loading.operationalPercent=125;assert.equal(comparePostConstraints(base,same,defaults).find(r=>r.fid===a.fid)?.state,'WORSENED');
});
test('BASE/POST voltage severity uses the same source-labelled regional policy',()=>{
  const base={buses:[{terms:['T'],vnKv:154,vmPu:.96,angleDeg:0,ytmIds:['OA']}],branches:[]},post={...base,buses:[{...base.buses[0],vmPu:.94}]};
  const [row]=comparePostConstraints(base,post,{...defaults,limitProfiles:[area]});assert.equal(row.state,'WORSENED');assert.equal(row.limit,.97);assert.ok(Math.abs(row.delta!+.02)<1e-12);
});

test('multi-YTM coupled bus conflict is reported before any Full AC or DC work',async()=>{
  const base=acNetwork(),sites=['A','B'].map(id=>({...base.buses[0],id,sourceId:id,sourceClass:'ElmSite',areaId:id,areaName:id,lat:null,lon:null,voltages:[100]})),n={...base,sites,buses:base.buses.map((b,i)=>({...b,siteIds:[i===0?'A':'B']})),switches:[{...base.lines[0],sourceClass:'ElmCoup',id:'COUP',sourceId:'COUP',from:'B0',to:'B1',closed:true}]};
  const profiles=[{...area,id:'A100',ytmId:'A',voltageKv:100},{...area,id:'B100',ytmId:'B',voltageKv:100,voltageMinPu:.95}],policy={...defaults,limitProfiles:profiles};
  const p=preflightOperationalLimits(n,emptyScenario(),policy);assert.equal(p.status,'BLOCKED');assert.deepEqual(p.conflicts[0].profileIds,['A100','B100']);assert.ok(p.conflicts[0].physicalTerminalFids?.includes('B1'));assert.deepEqual(p.conflicts[0].ytmIds,['A','B']);assert.strictEqual(preflightOperationalLimits(n,emptyScenario(),policy),p);
  let calls=0;await assert.rejects(runHybridN1(n,emptyScenario(),{policy,solveBase:async()=>{calls++;throw Error('Must not solve');}}),/AMBIGUOUS_LIMIT_PROFILE/);assert.equal(calls,0);
  const consistent={...policy,limitProfiles:profiles.map(p=>({...p,voltageMinPu:.97}))};assert.equal(preflightOperationalLimits(n,emptyScenario(),consistent).status,'READY');
  const open={...emptyScenario(),switchState:{COUP:false}};assert.equal(preflightOperationalLimits(n,open,policy).status,'READY');
});
