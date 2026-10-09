import test from 'node:test';
import assert from 'node:assert/strict';
import { syntheticBenchmarkPair } from '../helpers/benchmark-model';
import { loadBenchmarkModel } from '../../src/importers/powerfactory-benchmark/model';
import { loadBenchmark } from '../../src/importers/powerfactory-benchmark';
import { benchmarkControlContext,benchmarkLfReference } from '../../src/domain/benchmark/reference';
import { applyPowerFactoryControlContext } from '../../src/analysis/validation/powerfactory-control-context';
import { preflightPowerFactoryReference } from '../../src/analysis/validation/powerfactory-preflight';
import { zipSync,strToU8 } from 'fflate';

test('two ZIP synthetic model validates cubicle endpoints and ControlContext without LF results',async()=>{
  const pair=syntheticBenchmarkPair(),loaded=await loadBenchmarkModel(pair.model),benchmark=await loadBenchmark(pair.benchmark),network=applyPowerFactoryControlContext(loaded.network,benchmarkControlContext(benchmark));
  assert.equal(network.buses.length,2);assert.equal(network.lines.length,1);assert.equal(network.lines[0].from,'SYN-B0');
  const p=preflightPowerFactoryReference(benchmarkLfReference(benchmark),network,null);assert.deepEqual(p.reasons,['Yakınsamış Tam AC sonucu gerekli.']);
});
test('DGS class spelling alias retains original provenance and conflicting aliases are rejected',async()=>{
  const raw={...syntheticBenchmarkPair().raw,ElmGenstat:{Attributes:['FID','loc_name','bus1','outserv','pgini','qgini'],Values:[['SYN-G','Sentetik Üretici','SYN-CX',0,0,0]]}};
  const model=(data:unknown)=>new File([zipSync({'synthetic.json':strToU8(JSON.stringify(data))})],'synthetic.zip');
  const loaded=await loadBenchmarkModel(model(raw));assert.equal(loaded.sourceClassAliases.ElmGenStat,'ElmGenstat');assert.ok(loaded.raw.ElmGenstat);assert.ok(loaded.network.generators.some(g=>g.sourceClass==='ElmGenStat'));
  await assert.rejects(loadBenchmarkModel(model({...raw,ElmGenStat:raw.ElmGenstat})),/conflicting/);
  await assert.rejects(loadBenchmarkModel(model({...raw,ElmTerm:{...raw.ElmTerm,Values:[['TRUNCATED']]}})),/truncated/);
});
