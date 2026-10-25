import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {calculateThreePhase,scSourceContextHash,scProfileHash,SC_ENGINE_REVISION,type ScProfile} from '../../src/analysis/short-circuit';
import {adaptShortCircuitSources} from '../../src/importers/powerfactory-benchmark/short-circuit-source';
import {loadBenchmarkModel} from '../../src/importers/powerfactory-benchmark/model';
import {loadBenchmark} from '../../src/importers/powerfactory-benchmark';
import {syntheticBenchmarkPair} from '../helpers/benchmark-model';
import {analysisUiFixture} from '../helpers/analysis-ui';
import {emptyScenario} from '../../src/domain/scenario/overlay';
import {ScenarioStore} from '../../src/domain/scenario/overlay';
import {compactScRows} from '../../src/features/analysis/compact-rows';
import {buildBenchmarkMapData,benchmarkMapGate} from '../../src/domain/benchmark/map-layer';
import {equipmentCard} from '../../src/map/equipment-tooltip';
import {cleanStudy,cleanWorkspace,upgradeLegacyThreePhase} from '../../src/domain/results/sc-persistence';
import {runYtmStudy} from '../../src/analysis/ytm-study';
import {engineeringSourceOptions} from '../../src/analysis/short-circuit/engineering-profile';
import {scNodeClassification,nominalKv,scVoltageOptions} from '../../src/domain/results/sc-node';
const mini=JSON.parse(await readFile('tests/fixtures/sc-mini-dgs.json','utf8'));
const profile:ScProfile={faultType:'3PH',calculateMode:'MAX',voltageFactor:1.1,factorProvenance:'independent analytical fixture',edition:null,rfOhm:0,xfOhm:0,maxFaults:100,timeBudgetMs:30000};
const near=(a:number|null|undefined,b:number)=>assert.ok(a!=null&&Math.abs(a-b)<Math.max(1,Math.abs(b))*1e-7,`${a} != ${b}`);
async function loaded(){return loadBenchmarkModel(new File([JSON.stringify(mini)],'mini.json'));}
test('3PH MAX/MIN retain independent analytical transformer driving-point values',async()=>{
 const {network,raw}=await loaded();for(const mode of ['MAX','MIN'] as const){const context=adaptShortCircuitSources(raw,network,undefined,{mode}),c=mode==='MAX'?1.1:1,r=await calculateThreePhase(network,emptyScenario(),context,['SYN-B0','SYN-B1'],{...profile,calculateMode:mode,voltageFactor:c});
 near(r.faults[0].ikssKa,c*110/(Math.sqrt(3)*10));near(r.faults[1].ikssKa,c*10/(Math.sqrt(3)*(10*(10/110)**2+.1)));assert.equal(r.faults[1].status,'CALCULATED_NETWORK_APPROXIMATION');near(r.faults[1].zkkOhm?.im,10*(10/110)**2+.1);}
});
test('removed fault API is rejected; production source has no ground-fault engine or result fields',async()=>{
 const {network,raw}=await loaded(),context=adaptShortCircuitSources(raw,network);
 await assert.rejects(calculateThreePhase(network,emptyScenario(),context,['SYN-B0'],{...profile,faultType:'1LG'} as unknown as ScProfile),/SC_UNSUPPORTED_FAULT_TYPE/);
 assert.equal(Object.hasOwn(context,'sequenceData'),false);
 async function files(dir:string):Promise<string[]>{const all=await readdir(dir,{withFileTypes:true});return (await Promise.all(all.map(e=>e.isDirectory()?files(join(dir,e.name)):Promise.resolve([join(dir,e.name)])))).flat();}
 for(const path of (await files('src')).filter(p=>p.endsWith('.ts')||p.endsWith('.css'))){const source=await readFile(path,'utf8');assert.doesNotMatch(source,/\b1LG\b|\b1F\b|sc1Lg|scResult1Lg|ikss1F|sequence-network|negativeSources|zeroSources|sequenceData/,path);}
});
test('legacy records discard every removed field and preserve verified three-phase numbers',async()=>{
 const {network,raw}=await loaded(),context=adaptShortCircuitSources(raw,network),r=await calculateThreePhase(network,emptyScenario(),context,['SYN-B0'],profile);
 const legacy={...r,engineRevision:'sequence-safety-20261024',identity:{...r.identity,sourceHash:'a'.repeat(64)},faults:r.faults.map(f=>({...f,z2Ohm:{re:99,im:99},z0Ohm:{re:99,im:99}}))};
 const old={schemaVersion:1,identity:{},options:{ytmId:'AREA',families:['SC']},scMax:legacy,scMin:null,sc1LgMax:{evil:true},sc1LgMin:{evil:true},pendingCounts:{N1:0,SC_MAX:0,SC_MIN:0,SC1_MAX:99}} as any;
 const clean=cleanStudy(old)!;assert.doesNotMatch(JSON.stringify(clean),/sc1Lg|SC1_MAX|z2Ohm|z0Ohm/);assert.equal(clean.scMax!.faults[0].ikssKa,r.faults[0].ikssKa);
 assert.ok(upgradeLegacyThreePhase(clean.scMax!,context));assert.equal(clean.scMax!.engineRevision,SC_ENGINE_REVISION);assert.equal(clean.scMax!.identity.sourceHash,scSourceContextHash(context));assert.equal(clean.scMax!.identity.profileHash,scProfileHash(profile));
 const mismatch=structuredClone(legacy);mismatch.sourceModelInputs![0].xOhm=99;assert.equal(upgradeLegacyThreePhase(mismatch,context),false);
 const workspace=cleanWorkspace({n1:null,ac:[],hybrid:null,sc:r,scContext:{...context,sequenceData:{old:true}},sc1Lg:{old:true},ytm:old} as any);assert.doesNotMatch(JSON.stringify(workspace),/sc1Lg|sequenceData|SC1_MAX|z2Ohm|z0Ohm/);
});
test('resume repairs a duplicate hole and only one cancelled 3PH target',async()=>{
 const {network,raw}=await loaded(),scenario=emptyScenario(),contexts={MAX:adaptShortCircuitSources(raw,network,undefined,engineeringSourceOptions('MAX',false)),MIN:adaptShortCircuitSources(raw,network,undefined,engineeringSourceOptions('MIN',false))},options={ytmId:network.sites[0].areaId,profile:'FAST' as const,families:['SC' as const],timeBudgetMs:30000};
 const first=await runYtmStudy(network,scenario,contexts,options),done=first.scMax!.faults[0];first.scMax!.faults=[done,{...done}];const totals:number[]=[];
 const second=await runYtmStudy(network,scenario,contexts,options,{resume:first,onProgress:(stage,d)=>{if(stage==='SC_FAULT')totals.push(Number(d?.total));}});assert.deepEqual(totals,[1]);assert.equal(second.status,'COMPLETE');assert.equal(second.scMax!.faults[0],done);assert.deepEqual(second.pendingCounts,{N1:0,SC_MAX:0,SC_MIN:0});
 second.scMin!.faults[1]={...second.scMin!.faults[1],status:'CANCELLED',quality:undefined,ikssKa:null};totals.length=0;const third=await runYtmStudy(network,scenario,contexts,options,{resume:second,onProgress:(s,d)=>{if(s==='SC_FAULT')totals.push(Number(d?.total));}});assert.deepEqual(totals,[1]);assert.equal(third.status,'COMPLETE');
});
test('PF-only multi-bus station map, representative FID and tooltip agree despite another selected fault',async()=>{
 const pair=syntheticBenchmarkPair(true,true),loaded=await loadBenchmarkModel(pair.model),{ctx}=analysisUiFixture();ctx.network={...loaded.network,buses:loaded.network.buses.map(b=>({...b,siteIds:['S0']})),sites:loaded.network.sites.filter(s=>s.id==='S0')};ctx.scenario=new ScenarioStore(ctx.network.modelHash);ctx.benchmark=await loadBenchmark(pair.benchmark);ctx.ytmStudy=null;ctx.scResult=null;ctx.filters.areaId='';ctx.filters.siteId='';ctx.resultView={...ctx.resultView,analysis:'SC',source:'PF',faultId:'SYN-B1'};const selection={analysis:'SC' as const,source:'PF' as const,table:'SC_BusResults_Raw',metric:'ikss3FKa',scMode:'MAX' as const};ctx.benchmarkMap=selection;
 const rows=compactScRows(ctx,'PF');assert.equal(rows.length,2);const data=buildBenchmarkMapData(ctx,selection),site=data.sites.get('S0')!;assert.equal(site.value,6);assert.equal(site.representativeFid,'SYN-B0');assert.equal(site.nominalKv,100);
 const card=equipmentCard(ctx,ctx.network.sites[0]);assert.equal(card.status,'PF_REFERENCE_ONLY');assert.ok(card.rows[0][0].includes('6'));assert.equal(card.rows[0][1],site.representativeFid);assert.match(card.note,/maksimum/);assert.equal(benchmarkMapGate(ctx,{...selection,scMode:'MIN'}).enabled,false);
 assert.equal(buildBenchmarkMapData(ctx,{...selection,voltageKv:34.5}).sites.get('S0')?.value,null);
 const altered=structuredClone(ctx.benchmark),table=altered.groups.SC.tables.SC_BusResults_Raw;
 table.rows[0][table.headers.indexOf('faultType')]='1LG';table.rows[1][table.headers.indexOf('calculateMode')]='MIN';ctx.benchmark=altered;
 assert.equal(compactScRows(ctx,'PF').length,0);assert.equal(buildBenchmarkMapData(ctx,selection).scale,undefined);
});
test('native/topological node classification and fractional voltage display never depend on names',async()=>{
 const {network}=await loaded(),b=network.buses[0],n={...network,buses:[{...b,usage:0,name:'Fider Düğüm'},{...network.buses[1],usage:1,name:'Bara'}]};assert.equal(scNodeClassification(n,[b.sourceId]).kind,'PHYSICAL_BUS');assert.equal(scNodeClassification(n,[network.buses[1].sourceId]).kind,'FEEDER_NODE');assert.match(scNodeClassification(n,[b.sourceId]).evidence[0],/iUsage=0/);
 assert.equal(nominalKv(6.3),'6,3');assert.equal(nominalKv(33.6),'33,6');assert.equal(nominalKv(34.5),'34,5');assert.ok(scVoltageOptions(network).includes(220));
});
test('one solved electrical node retains both station aliases and station-local representative FIDs',async()=>{
 const pair=syntheticBenchmarkPair(true,true),loaded=await loadBenchmarkModel(pair.model),network={...loaded.network,switches:[{id:'COUP',sourceId:'COUP',sourceClass:'ElmCoup',name:'Closed coupling',inService:true,siteIds:['S0','S1'],sourceRefs:{},from:'SYN-B0',to:'SYN-B1',closed:true}]};
 const context=adaptShortCircuitSources(pair.raw,network),result=await calculateThreePhase(network,emptyScenario(),context,['SYN-B0'],profile),{ctx}=analysisUiFixture();assert.deepEqual(new Set(result.faults[0].physicalTerminalFids),new Set(['SYN-B0','SYN-B1']));ctx.network=network;ctx.scenario=new ScenarioStore(network.modelHash);ctx.scResult=result;ctx.scContext=context;ctx.ytmStudy=null;ctx.studyOptions=undefined;ctx.filters.areaId='';ctx.filters.siteId='';ctx.resultView={...ctx.resultView,analysis:'SC',source:'GA'};
 const rows=compactScRows(ctx);assert.equal(rows.length,1);assert.deepEqual(new Set(rows[0].siteIds),new Set(['S0','S1']));const data=buildBenchmarkMapData(ctx,{analysis:'SC',source:'GA',table:'SC_BusResults_Raw',metric:'ikss3FKa'});
 for(const [site,fid] of [['S0','SYN-B0'],['S1','SYN-B1']]){near(data.sites.get(site)?.value,result.faults[0].ikssKa!);assert.equal(data.sites.get(site)?.representativeFid,fid);}
 ctx.filters.siteId='S1';const scoped=compactScRows(ctx);assert.equal(scoped.length,1);assert.equal(scoped[0].fid,'SYN-B1');assert.deepEqual(scoped[0].siteIds,['S1']);near(scoped[0].metrics.ikss.ga,result.faults[0].ikssKa!);
});
