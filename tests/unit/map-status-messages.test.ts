import test from 'node:test';import assert from 'node:assert/strict';
import type {AppContext} from '../../src/app/contracts';
import {mapStatusDetail,mapStatusText} from '../../src/map/layer-policy';
import {ScenarioStore} from '../../src/domain/scenario/overlay';
import {ResultStore} from '../../src/domain/results/store';
import {AnalysisSettingsStore} from '../../src/domain/calculation/analysis-settings';
import {initialResultView} from '../../src/domain/results/workspace';
import {defaultSettings} from '../../src/persistence/settings';

function fixture(){
  const scenario=new ScenarioStore('hash-messages'),resultStore=new ResultStore();
  const ctx={network:null,scenario,analysisSettings:new AnalysisSettingsStore(),resultStore,resultView:initialResultView(),settings:{value:defaultSettings()},n1AcResults:[],n1Result:null,scResult:null,hybridResult:null,ytmStudy:null,studyOptions:undefined,benchmark:null,benchmarkMap:null,powerFactoryControlContextHash:null,powerFactoryControlContextNumericFile:null,mapDisplay:{areaMode:'ALL',areaIds:[],voltages:new Set()},stats:{runs:0}} as unknown as AppContext;
  return ctx;
}
test('missing N-1 result shows a plain-Turkish call to action while keeping the technical code',()=>{
  const ctx=fixture();ctx.resultView.analysis='N1';
  const text=mapStatusText(ctx);
  assert.ok(text.includes('N-1 sonucu yok'));assert.ok(text.includes('NOT_RUN'));
  const detail=mapStatusDetail(ctx);
  assert.ok(detail.some(line=>line.startsWith('status=NOT_RUN')));
});
test('missing SC result shows guidance and the detail keeps the technical status',()=>{
  const ctx=fixture();ctx.resultView.analysis='SC';
  const text=mapStatusText(ctx);
  assert.ok(text.includes('SC sonucu yok'));assert.ok(text.includes('NOT_RUN'));
  assert.ok(mapStatusDetail(ctx).some(line=>line.startsWith('status=')));
});
test('stale/missing LF result is phrased in Turkish with the NOT_RUN / STALE code retained',()=>{
  const ctx=fixture();ctx.resultView.analysis='LF';ctx.resultStore.role='base';
  const text=mapStatusText(ctx);
  assert.ok(text.includes('LF sonucu yok'));assert.ok(text.includes('NOT_RUN / STALE'));
  assert.ok(mapStatusDetail(ctx).some(line=>line.includes('NOT_RUN / STALE')));
});
