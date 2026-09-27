import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { mapCanonical } from '../../src/importers/dgs/canonical.ts';
import { identity } from '../../src/domain/calculation/identity.ts';
import { buildTopology } from '../../src/topology/electrical-topology.ts';
import { planEnergization,applyEnergization } from '../../src/topology/energization.ts';
import {
  effectiveNetwork,
  emptyScenario,
  ScenarioStore,
  scenarioChanged,
} from '../../src/domain/scenario/overlay.ts';
import { ResultStore } from '../../src/domain/results/store.ts';
import {displayBranches} from '../../src/domain/results/presentation.ts';
import {setCapacitySeason,setManualCapacity} from '../../src/domain/model/capacity.ts';
import type { CanonicalNetwork } from '../../src/domain/model/network.ts';
import type { CalculationIdentity } from '../../src/domain/calculation/identity.ts';
import type { CalculationResult } from '../../src/domain/results/types.ts';
import { parseDgs } from '../../src/importers/dgs/index.ts';

async function readFixture(): Promise<string> {
  return readFile(new URL('../fixtures/small-dgs.json', import.meta.url), 'utf8');
}

async function loadNetwork(): Promise<CanonicalNetwork> {
  const model = await parseDgs(await readFixture(), 'small-dgs.json');
  return mapCanonical(model, 'small-model-hash');
}

function result(identity: CalculationIdentity, lineP: number, loading: number): CalculationResult {
  return {
    identity,
    status: 'CONVERGED',
    converged: true,
    iterations: 4,
    rounds: 1,
    maxMismatchMw: 0.00001,
    elapsedMs: 12,
    buses: [],
    branches: [{
      id: 'L400-01',
      name: 'L400-01',
      sourceClass: 'ElmLne',
      from: 'T400-SLACK',
      to: 'T400-2',
      siteIds: ['S400'],
      vnKv: 400,
      pf: lineP,
      qf: 5,
      pt: -lineP + 0.2,
      qt: -4,
      ifA: 20,
      itA: 20,
      loading,
      pLoss: 0.2,
      qLoss: 1,
    }],
    generators: [],
    diagnostics: {},
    warnings: [],
    quality: { numericalStatus: 'OK', controlFidelity: 'PARTIAL', referenceValidation: 'NOT_AVAILABLE' },
  };
}

test('small DGS fixture covers mapped 400/154 kV equipment and the energization path', async () => {
  const network = await loadNetwork();
  assert.equal(network.lines.length, 15, 'the line inventory supports pagination checks');
  assert.ok(network.lines.some(line => line.vnKv === 400));
  assert.ok(network.lines.some(line => line.vnKv === 154));
  assert.equal(network.transformers.length, 1);
  assert.equal(network.transformers[0].from, 'T400-2');
  assert.equal(network.transformers[0].to, 'T154-PV');
  assert.equal(network.generators.length, 1);
  assert.equal(network.generators[0].voltageControl, true);
  assert.equal(network.loads.length, 1);
  assert.equal(network.externalGrids.length, 1);
  assert.equal(network.sites.length, 2);
  assert.ok(network.sites.every(site => site.lat !== null && site.lon !== null));
  assert.equal(network.lines.find(line => line.id === 'L154-OFF')?.inService, false);
  assert.equal(network.lines.find(line => line.id === 'L400-01')?.coordinates.length, 2);

  const topology = buildTopology(network);
  assert.equal(topology.closedSwitches, 1);
  assert.equal(topology.terminalToBus.get('T400-SLACK'), topology.terminalToBus.get('T400-2'));
  assert.equal(topology.terminalToBus.has('T154-OFF'), false);
});

test('scenario overrides change an effective copy and reset restores the base network', async () => {
  const network = await loadNetwork();
  const original = JSON.stringify(network);
  const store = new ScenarioStore();
  store.setStatus('lineStatus', 'L154-OFF', true, false);
  store.setStatus('transformerStatus', 'TR400-154', false, true);
  store.setStatus('switchState', 'SW_TIE', false, true);
  store.setStatus('busOrTerminalStatus', 'T154-3', false, true);
  store.restoreTerminals(['T154-OFF']);
  store.replace({
    ...store.current,
    generatorDispatch: { GEN154: { pMw: 35, qMvar: 6 } },
    loadAdjustments: { LOAD154: { pMw: 50, qMvar: 14 } },
  });

  const scenario = effectiveNetwork(network, store.current);
  assert.equal(scenario.lines.find(line => line.id === 'L154-OFF')?.inService, true);
  assert.equal(scenario.transformers[0].inService, false);
  assert.equal(scenario.switches[0].closed, false);
  assert.equal(scenario.buses.find(bus => bus.id === 'T154-3')?.inService, false);
  assert.equal(scenario.buses.find(bus => bus.id === 'T154-OFF')?.inService, true);
  assert.equal(scenario.generators[0].pMw, 35);
  assert.equal(scenario.loads[0].pMw, 50);
  assert.notEqual(scenario.lines, network.lines);
  assert.equal(JSON.stringify(network), original, 'building a scenario must not mutate its base');
  assert.equal(network.lines.find(line => line.id === 'L154-OFF')?.inService, false);
  assert.equal(network.transformers[0].inService, true);

  const restored = effectiveNetwork(network, {
    ...emptyScenario(),
    lineStatus: { 'L154-OFF': true },
    restoredTerminals: ['T154-OFF'],
  });
  assert.equal(buildTopology(restored).terminalToBus.has('T154-OFF'), true);

  store.reset();
  assert.equal(scenarioChanged(store.current), false);
  assert.deepEqual(store.current, emptyScenario());
  assert.equal(JSON.stringify(network), original);
});

test('result identity rejects stale scenario results and delta requires matching options', async () => {
  const scenario = new ScenarioStore();
  const baseId = identity('small-model-hash', emptyScenario(), 'powerFlow', { tolerance: 1e-6 });
  const baseResult = result(baseId, 100, 45);
  const store = new ResultStore();
  store.expect('base', baseId);
  assert.equal(store.accept('base', baseResult), true);
  assert.equal(store.get('base'), baseResult);

  scenario.setStatus('lineStatus', 'L154-OFF', true, false);
  const scenarioId = identity('small-model-hash', scenario.current, 'powerFlow', { tolerance: 1e-6 });
  assert.notEqual(scenarioId.scenarioHash, baseId.scenarioHash);
  store.expect('scenario', scenarioId);
  const scenarioResult = result(scenarioId, 120, 52);
  assert.equal(store.accept('scenario', scenarioResult), true);
  assert.deepEqual(store.delta(), [{ id: 'L400-01', name: 'L400-01', sourceClass: 'ElmLne', pMw: 20, loading: 7, state: 'COMPARED' }]);

  const updatedId = identity('small-model-hash', scenario.current, 'powerFlow', { tolerance: 1e-5 });
  store.expect('scenario', updatedId);
  assert.equal(store.get('scenario'), null, 'the previously stored scenario result is stale');
  assert.equal(store.accept('scenario', scenarioResult), false);
  assert.deepEqual(store.delta(), [], 'base and scenario results with different options cannot be compared');

  const updatedResult = result(updatedId, 140, 60);
  assert.equal(store.accept('scenario', updatedResult), true);
  assert.deepEqual(store.delta(), []);
  store.invalidateScenario();
  assert.equal(store.get('scenario'), null);

  scenario.reset();
  const resetId = identity('small-model-hash', scenario.current, 'powerFlow', { tolerance: 1e-6 });
  assert.equal(resetId.scenarioHash, baseId.scenarioHash);
});

test('delta includes removed branches, uses class-qualified identity, and never invents missing flows', () => {
  const store=new ResultStore(),baseId=identity('m',emptyScenario(),'powerFlow');
  const scenarioId=identity('m',{...emptyScenario(),lineStatus:{removed:false}},'powerFlow');
  const base=result(baseId,100,45),next=result(scenarioId,120,50);
  base.branches.push({...base.branches[0],id:'removed'});
  next.branches.push({...next.branches[0],sourceClass:'ElmTr2'});
  store.expect('base',baseId);store.expect('scenario',scenarioId);store.accept('base',base);store.accept('scenario',next);
  const rows=store.delta();assert.equal(rows.length,3);
  assert.equal(rows.find(r=>r.id==='removed')?.state,'REMOVED');
  assert.equal(rows.find(r=>r.sourceClass==='ElmTr2')?.pMw,null);
  next.converged=false;assert.deepEqual(store.delta(),[]);
});

test('nested numerical options retain their values in result identity',()=>{
  const a=identity('m',emptyScenario(),'powerFlow',{solver:{tolerance:1e-6,maxIterations:20}});
  const b=identity('m',emptyScenario(),'powerFlow',{solver:{maxIterations:20,tolerance:1e-6}});
  const c=identity('m',emptyScenario(),'powerFlow',{solver:{tolerance:1e-5,maxIterations:20}});
  assert.equal(a.optionsHash,b.optionsHash);assert.notEqual(a.optionsHash,c.optionsHash);
});

test('energization restores only a complete available path and leaves raw/base state unchanged',async()=>{
  const network=await loadNetwork(),before=JSON.stringify(network),plan=planEnergization(network,'L154-OFF');
  assert.equal(plan.ready,true);assert.deepEqual(plan.restoredTerminals,['T154-OFF']);assert.deepEqual(plan.closeSwitches,['SW_RESTORE']);
  const effective=effectiveNetwork(network,applyEnergization(emptyScenario(),plan));
  assert.equal(buildTopology(effective).terminalToBus.has('T154-OFF'),true);
  assert.equal(effective.switches.find(s=>s.id==='SW_RESTORE')?.closed,true);
  assert.equal(JSON.stringify(network),before);
  const unavailable={...network,switches:network.switches.map(s=>s.id==='SW_RESTORE'?{...s,inService:false}:s)};
  assert.equal(planEnergization(unavailable,'L154-OFF').ready,false);
  assert.throws(()=>applyEnergization(emptyScenario(),planEnergization(unavailable,'L154-OFF')));
});

test('capacity presentation invalidates its cache on manual edits without rewriting solver results',async()=>{
  const network=await loadNetwork(),r=result(identity(network.modelHash,emptyScenario(),'powerFlow'),100,45);
  const rawLoading=r.branches[0].loading;
  setCapacitySeason(network.modelHash,'summer');setManualCapacity(network.modelHash,'L400-01',{summer:10,winter:20});
  const first=displayBranches(network,r),value=first.get('ElmLne|L400-01')!.loading!;
  setManualCapacity(network.modelHash,'L400-01',{summer:20,winter:40});
  const second=displayBranches(network,r);assert.notEqual(first,second);
  assert.equal(second.get('ElmLne|L400-01')!.loading,value/2);
  assert.equal(r.branches[0].loading,rawLoading);
  setCapacitySeason(network.modelHash,'operational');assert.equal(displayBranches(network,r).get('ElmLne|L400-01')!.loading,null);
});
