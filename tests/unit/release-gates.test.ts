import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateReleaseGates, isFullGitSha, type ReleaseGateInput } from '../../tools/release-gates';

const ids=['lineActivePowerMw','lineReactivePowerMvar','transformerActivePowerMw','transformerReactivePowerMvar','busVoltageKv','busAlignedAngleDeg'];
const good=():ReleaseGateInput=>({
  populationMatches:true,
  kpis:ids.map((id,index)=>({id,n:index<4?100:50,baselineN:index<4?100:50,improvementPercent:index===2?-.05:index===1?-2.5:-.2})),
  activeBalanceConverged:true,stationControlConverged:true,unresolvedControllerCount:0,
  portableElapsedMs:14999,portableStatus:'OK',portableSha256:'a'.repeat(64),committedPortableSha256:'a'.repeat(64),measuredPortableSha256:'a'.repeat(64),
  measuredGitSha:'b'.repeat(40),manifestGitSha:'b'.repeat(40),commitExists:true,
});

test('release gate truth table requires all numerical, convergence, timing and provenance facts',()=>{
  assert.deepEqual(evaluateReleaseGates(good()),{mergeReady:true,failedGates:[],improvedCount:5});
  const cases:Array<[string,(input:ReleaseGateInput)=>void]>=[
    ['POPULATION_SIGNATURE',x=>{x.populationMatches=false;}],
    ['CANONICAL_KPI_POPULATION',x=>{x.kpis=[...x.kpis.slice(0,5)];}],
    ['FIVE_OF_SIX_KPI_IMPROVEMENT',x=>{x.kpis=x.kpis.map(row=>({...row,improvementPercent:-.05}));}],
    ['NO_KPI_REGRESSION_0_5_PERCENT',x=>{x.kpis=x.kpis.map((row,i)=>i===2?{...row,improvementPercent:.5}:row);}],
    ['LINE_AND_TRANSFORMER_Q_NO_WORSE',x=>{x.kpis=x.kpis.map(row=>row.id==='lineReactivePowerMvar'?{...row,improvementPercent:.01}:row);}],
    ['Q_KPI_IMPROVEMENT_2_PERCENT',x=>{x.kpis=x.kpis.map(row=>row.id==='lineReactivePowerMvar'?{...row,improvementPercent:-1}:row);}],
    ['ACTIVE_BALANCE_CONVERGED',x=>{x.activeBalanceConverged=false;}],
    ['STATION_CONTROL_CONVERGED',x=>{x.unresolvedControllerCount=1;}],
    ['PORTABLE_ELAPSED_15000_MS',x=>{x.portableElapsedMs=15001;}],
    ['COMMITTED_PORTABLE_BYTES',x=>{x.committedPortableSha256='c'.repeat(64);}],
    ['MEASURED_COMMIT_SHA',x=>{x.manifestGitSha='c'.repeat(40);}],
  ];
  for(const [name,mutate] of cases){const input=good();mutate(input);const actual=evaluateReleaseGates(input);assert.equal(actual.mergeReady,false,name);assert.ok(actual.failedGates.includes(name),name);}
});

test('measured SHA requires all forty hex characters and an existing matching commit',()=>{
  assert.equal(isFullGitSha('a'.repeat(40)),true);
  assert.equal(isFullGitSha('a'.repeat(39)),false);
  assert.equal(isFullGitSha('g'.repeat(40)),false);
  for(const change of [(x:ReleaseGateInput)=>{x.measuredGitSha='a'.repeat(39);},(x:ReleaseGateInput)=>{x.commitExists=false;}]){
    const input=good();change(input);assert.ok(evaluateReleaseGates(input).failedGates.includes('MEASURED_COMMIT_SHA'));
  }
});
