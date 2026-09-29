import assert from 'node:assert/strict';
import test from 'node:test';
import type {CanonicalNetwork} from '../../src/domain/model/network';
import type {CalculationResult} from '../../src/domain/results/types';
import {mapResults} from '../../src/analysis/power-flow/results';
import type {PreparedModel} from '../../src/analysis/power-flow/preparation';
import type {PowerFlowResult} from '../../src/analysis/power-flow/js/types';
import {buildIslandMapData,islandColor} from '../../src/map/island-map';
import {lineStyle} from '../../src/map/result-style';
import {mapDetailText} from '../../src/map/detail-text';
import {defaultSettings,SettingsStore} from '../../src/persistence/settings';

const entity=(id:string,siteIds:string[]=['S'])=>({id,name:id,sourceClass:'ElmTerm',sourceId:id,inService:true,siteIds,sourceRefs:{}});
function network():CanonicalNetwork {
  const buses=['A1','A2','B1','B2'].map(id=>({...entity(id),vnKv:154,parentId:'G1'}));
  const line=(id:string,from:string,to:string)=>({...entity(id),sourceClass:'ElmLne',from,to,vnKv:154,lengthKm:1,rOhm:1,xOhm:10,bSiemens:0,ratingMva:100,coordinates:[],sections:0});
  const source={...entity('X1'),sourceClass:'ElmXnet',bus:'A1',pMw:0,qMvar:0,vmSet:1};
  const site={...entity('S'),sourceClass:'ElmSite',lat:39,lon:32,areaId:'A',areaName:'Area',voltages:[154]};
  return{schemaVersion:1,modelHash:'island-map',name:'island-map',size:0,baseMva:100,buses,lines:[line('LA','A1','A2'),line('LB','B1','B2')],transformers:[],generators:[],loads:[],shunts:[],seriesCompensators:[],externalGrids:[source],internationalConnections:[],switches:[],stationControllers:[],secondaryControllers:[],boundaries:[],sites:[site],classCounts:{},records:0,warnings:[],capabilities:{powerFlow:{state:'READY',reasons:[]}}} as unknown as CanonicalNetwork;
}
function result():CalculationResult {
  return{identity:{} as CalculationResult['identity'],status:'CONVERGED_FULL_NR',converged:true,iterations:2,rounds:1,maxMismatchMw:0,elapsedMs:1,
    buses:[],branches:[{id:'LA',name:'LA',sourceClass:'ElmLne',from:'A1',to:'A2',siteIds:['S'],vnKv:154,pf:0,qf:0,pt:0,qt:0,ifA:0,itA:0,loading:0,pLoss:0,qLoss:0,islandId:'island-1'}],generators:[],
    diagnostics:{islands:[{islandId:'island-1',busCount:2,branchCount:1,referenceSource:'X1',status:'CONVERGED'},{islandId:'island-2',busCount:2,branchCount:1,referenceSource:null,status:'NO_REFERENCE'}]},warnings:[],quality:{numericalStatus:'CONVERGED',controlFidelity:'PARTIAL',referenceValidation:'NOT_AVAILABLE'}};
}

test('branch results retain their solved electrical island id',()=>{
  const built={model:{slack:0},buses:[{id:'B1',name:'B1',terms:['B1'],siteIds:['S'],vnKv:154},{id:'B2',name:'B2',terms:['B2'],siteIds:['S'],vnKv:154}],branches:[{id:'L1',name:'L1',sourceClass:'ElmLne',from:'B1',to:'B2',siteIds:['S'],vnKv:154,ratingMva:100,i:0,j:1}],generators:[],diagnostics:{islandCount:1,unsuppliedBuses:0},warnings:[],islandId:'island-7'} as unknown as PreparedModel;
  const solved={status:'CONVERGED',converged:true,iterations:1,rounds:1,maxMismatchMW:0,elapsedMs:1,Vm:[1,1],Va:[0,0],P:[0,0],Q:[0,0],branches:[{pf:1,qf:0,pt:-1,qt:0}],warnings:[]} as unknown as PowerFlowResult;
  assert.equal(mapResults(built,solved,{} as CalculationResult['identity']).branches[0].islandId,'island-7');
});

test('island map colors are stable, unreferenced lines are dashed grey, and TM detail warns about multiple islands',()=>{
  const n=network(),calculation=result(),map=buildIslandMapData(n,calculation),settings=defaultSettings();settings.displayMode='island';
  assert.equal(islandColor('island-1'),islandColor('island-1'));assert.notEqual(islandColor('island-1'),islandColor('island-2'));
  assert.equal(map.lineIslands.get('LA')?.status,'CONVERGED');assert.equal(map.lineIslands.get('LB')?.status,'NO_REFERENCE');
  const unreferenced=lineStyle(n.lines[1],true,'scenario',settings,undefined,undefined,1,map.lineIslands.get('LB'));
  assert.equal(unreferenced.color,settings.colorNoResult);assert.deepEqual(unreferenced.dash,[5,4]);
  const lineText=mapDetailText(n.lines[1],{settings,names:['TM'],inService:true,island:map.lineIslands.get('LB')});
  assert.match(lineText,/island-2 · Referans: YOK · 2 bara · 1 dal · NO_REFERENCE/);
  assert.equal(map.siteIslands.get('S')?.islandCount,2);assert.equal(map.siteIslands.get('S')?.dominant?.islandId,'island-1');
  const siteText=mapDetailText(n.sites[0],{settings,names:[],inService:true,siteIslands:map.siteIslands.get('S')});assert.match(siteText,/2 elektrik adasında/);
});

test('island display mode is accepted and preserved by settings storage',()=>{
  const settings=new SettingsStore();settings.update({displayMode:'island'},false);assert.equal(settings.value.displayMode,'island');
  const restored=new SettingsStore();restored.update(JSON.parse(JSON.stringify(settings.value)),false);assert.equal(restored.value.displayMode,'island');
});
