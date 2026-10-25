import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DgsModel} from '../../src/importers/dgs';
import {mapCanonical} from '../../src/importers/dgs/canonical';
import {ScenarioStore} from '../../src/domain/scenario/overlay';
import {AnalysisSettingsStore,activeAnalysisSettings,analysisSettingsHash} from '../../src/domain/calculation/analysis-settings';
import {identity} from '../../src/domain/calculation/identity';
import {ResultStore} from '../../src/domain/results/store';
import {operatingValues,operatingSortSnapshot} from '../../src/features/operating-data/operating-values';
import type {AppContext} from '../../src/app/contracts';
import type {CalculationResult} from '../../src/domain/results/types';
test('operating numeric sort uses admissible solved values, retains precision and invalidates snapshots',async()=>{
 const network=mapCanonical(await new DgsModel(JSON.parse(await readFile('tests/fixtures/small-dgs.json','utf8')),'operating sort').build(),'sort-model'),scenario=new ScenarioStore(network.modelHash),analysisSettings=new AnalysisSettingsStore(),resultStore=new ResultStore(),settings=analysisSettings.value,id=identity(network.modelHash,scenario.current,'powerFlow',{analysisSettings:activeAnalysisSettings(settings,'powerFlow'),analysisSettingsHash:analysisSettingsHash(settings,'powerFlow'),controlContextHash:null});
 const r={identity:id,status:'CONVERGED_FULL_NR',converged:true,buses:[],branches:[],generators:[],loads:[{id:network.loads[0].id,pMw:1.23456789,qMvar:.0049,status:'SOLVED_CONSTANT_PQ'}]} as unknown as CalculationResult;resultStore.expect('base',id);resultStore.accept('base',r);
 const ctx={network,scenario,analysisSettings,resultStore,powerFactoryControlContextHash:null} as unknown as AppContext,row={id:network.loads[0].id,name:'',attributes:{},siteIds:[]},before=JSON.stringify(network),v=operatingValues(ctx)(row,'ElmLod'),snapshot=operatingSortSnapshot(ctx,'operating.lfP',['ElmLod']);
 assert.equal(v.numeric.lf.P,1.23456789);assert.equal(v.numeric.source.P,45);assert.ok(v.lf.includes('1.23456789'));assert.ok(v.display.lf.includes('1,2 MW'));assert.ok(v.display.lf.includes('0,0049 MVAr'));assert.equal(snapshot.values[0][2],1.23456789);
 scenario.replace({...scenario.current,loadAdjustments:{[row.id]:{pMw:9.87654321,qMvar:3}}});const stale=operatingValues(ctx)(row,'ElmLod'),next=operatingSortSnapshot(ctx,'operating.lfP',['ElmLod']);assert.equal(stale.numeric.lf.P,null);assert.equal(stale.numeric.scenario.P,9.87654321);assert.equal(stale.lf,'NOT_RUN / STALE');assert.notEqual(next.id,snapshot.id);assert.equal(next.values[0][2],null);assert.equal(JSON.stringify(network),before);
});
