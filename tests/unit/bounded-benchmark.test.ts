import test from 'node:test';
import assert from 'node:assert/strict';
import {boundedBenchmarkCalculation} from '../../tools/bounded-benchmark-calculation';
import {acNetwork} from '../helpers/ac-network';
import {emptyScenario} from '../../src/domain/scenario/overlay';
import type {AcContingency} from '../../src/analysis/contingency-ac';
test('CLI worker uses the real AC wrapper and terminates an over-budget job',async()=>{
  const payload={kind:'AC',network:acNetwork(),scenario:emptyScenario(),outage:{caseId:'N1:ElmLne:BYPASS',sourceClass:'ElmLne',fid:'BYPASS'}};
  await assert.rejects(boundedBenchmarkCalculation(payload,1),/WORKER_TIME_BUDGET/);
  const result=await boundedBenchmarkCalculation<AcContingency>(payload,30000);assert.equal(result.status,'CONVERGED');assert.ok(result.result!.maxMismatchMw!<1e-3);
});
