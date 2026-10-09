import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAcOutages } from '../../src/analysis/contingency-ac';
import { emptyScenario } from '../../src/domain/scenario/overlay';
import { acNetwork } from '../helpers/ac-network';

for(const count of [3,5])test(`${count}-bus AC outage agrees with independent lossless radial solution`,async()=>{
  const n=acNetwork(count),s=emptyScenario(),before=JSON.stringify([n,s]),[result]=await validateAcOutages(n,s,[{caseId:'SYN-CASE',sourceClass:'ElmLne',fid:'BYPASS'}]);
  assert.equal(result.status,'CONVERGED');assert.equal(result.method,'GA_AC_POST_CONTINGENCY');assert.equal(JSON.stringify([n,s]),before);
  const p=.3,q=.1,x=(count-1)*.1,y=(1-2*x*q+Math.sqrt((1-2*x*q)**2-4*x*x*(p*p+q*q)))/2;
  const last=result.result!.buses.find(b=>b.terms.includes(`B${count-1}`))!;assert.ok(Math.abs(last.vmPu-Math.sqrt(y))<1e-5);
  const branch=result.result!.branches.find(b=>b.id==='L0')!,qSource=(q+x*(p*p+q*q)/y)*100;assert.ok(Math.abs(branch.pf-30)<1e-5);assert.ok(Math.abs(branch.qf-qSource)<1e-4);
  assert.equal(result.branchApparentPower.find(b=>b.fid==='L0')!.loadingPercent,null);assert.ok(Math.abs(result.branchApparentPower.find(b=>b.fid==='L0')!.sfMva-Math.hypot(30,qSource))<1e-4);
});
test('unsupplied island is explicit; no synthetic slack is inserted',async()=>{
  const n=acNetwork();const [r]=await validateAcOutages(n,{...emptyScenario(),lineStatus:{BYPASS:false}},[{caseId:'SYN-CUT',sourceClass:'ElmLne',fid:'L0'}]);assert.equal(r.status,'PARTIAL_SOLUTION');assert.ok(r.result?.converged);assert.ok(r.components?.some(c=>c.status==='UNSUPPLIED_COMPONENT'));assert.equal(r.result!.buses.some(b=>b.terms.includes('B2')),false);
});
test('cancel, offline outage, class/FID mismatch and case budget cannot yield success',async()=>{
  const n=acNetwork(),outage={caseId:'SYN-C',sourceClass:'ElmLne' as const,fid:'BYPASS'};
  assert.equal((await validateAcOutages(n,emptyScenario(),[outage],{signal:AbortSignal.abort()}))[0].status,'CANCELLED');
  assert.equal((await validateAcOutages(n,{...emptyScenario(),lineStatus:{BYPASS:false}},[outage]))[0].status,'NOT_COMPUTABLE');
  assert.equal((await validateAcOutages(n,emptyScenario(),[{...outage,sourceClass:'ElmTr2'}]))[0].status,'NOT_COMPUTABLE');
  await assert.rejects(validateAcOutages(n,emptyScenario(),Array(6).fill(outage)),/CASE_BUDGET/);
  assert.equal((await validateAcOutages(n,emptyScenario(),[{...outage,caseId:'N1:ElmTr2:BYPASS'}]))[0].reason,'N1_CASE_ID_OUTAGE_IDENTITY_MISMATCH');
});
