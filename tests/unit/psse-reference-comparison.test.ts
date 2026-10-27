import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {syntheticRawx} from '../../tools/psse-synthetic-cases';
import {decodeRawx} from '../../src/importers/psse/raw';
import {normalizePsseBusBranch} from '../../src/domain/psse/network';
import {createPsseScenario} from '../../src/domain/psse/scenario';
import {psseTopologyHash} from '../../src/domain/psse/identity';
import {solvePsseNewton} from '../../src/analysis/psse/newton';
import {solvePsseDc} from '../../src/analysis/psse/dc';
import {comparePsseReference} from '../../src/domain/psse/reference';

const fixture=JSON.parse(readFileSync('evidence/psse-ac-dc/synthetic-basic-reference.json','utf8')) as Record<string,any>;
function makeCase(rawx=syntheticRawx(),name='synthetic.rawx'){
 const model=decodeRawx(new TextEncoder().encode(rawx),name),network=normalizePsseBusBranch(model);return{model,network};
}
function columns(rows:Record<string,unknown>[]){const names=[...new Set(rows.flatMap(row=>Object.keys(row)))];return Object.fromEntries(names.map(name=>[name,rows.map(row=>row[name]??null)]));}
function referenceFromResult(model:ReturnType<typeof makeCase>['model'],network:ReturnType<typeof makeCase>['network'],result:ReturnType<typeof solvePsseNewton>|ReturnType<typeof solvePsseDc>,scope:'AC'|'DC'='AC'){
 const buses=network.buses.filter(bus=>bus.source).map(bus=>{const r=result.busResults.find(item=>item.connectionKey===bus.connectionKey)!;return{NUMBER:bus.externalNumber,TYPE:bus.type,STATUS:bus.status,PU:r.vmPu,ANGLE:r.vaDeg===null?null:r.vaDeg*Math.PI/180,ANGLED:r.vaDeg};});
 const branchRows:Record<string,unknown>[]=[],windingRows:Record<string,unknown>[]=[],dcFlows:Record<string,unknown>[]=[];
 const equipment=new Map(model.equipment.map(item=>[item.id,item]));
 for(const branch of network.branches.filter(item=>item.status===1)){
  const r=result.branchResults.find(item=>item.id===branch.id)!,source=equipment.get(branch.sourceEquipmentId)!,circuit=String(source.fields.ckt??'1').trim();
  const from=network.buses[branch.from]!.externalNumber!,to=network.buses[branch.to]!.externalNumber!;
  if(branch.kind==='three-winding-leg'){
   const winding=Number(branch.windingId),record={WIND1NUMBER:source.fields.ibus,WIND2NUMBER:source.fields.jbus,WIND3NUMBER:source.fields.kbus,WNDNUM:winding,ID:circuit,STATUS:1,P:r.pFromMw,Q:r.qFromMvar};windingRows.push(record);
   dcFlows.push({from,to:null,circuit,pMw:r.pFromMw,winding});
  }else{
   branchRows.push({FROMNUMBER:from,TONUMBER:to,STATUS:1,ID:circuit,P:r.pFromMw,Q:r.qFromMvar},{FROMNUMBER:to,TONUMBER:from,STATUS:1,ID:circuit,P:r.pToMw,Q:r.qToMvar});
   dcFlows.push({from,to,circuit,pMw:r.pFromMw},{from:to,to:from,circuit,pMw:r.pToMw});
  }
 }
 const generators=scope==='AC'?network.generators.map(gen=>{const r=result.generatorResults.find(item=>item.sourceEquipmentId===gen.sourceEquipmentId)!;const source=equipment.get(gen.sourceEquipmentId)!;return{NUMBER:network.buses[gen.bus]!.externalNumber,ID:String(source.fields.machid??source.fields.id).trim(),STATUS:gen.status,PGEN:r.pMw,QGEN:r.qMvar};}):[];
 const qFlag=result.identity.controlPolicyId==='FIXED_CONTROLS_NO_Q_LIMITS'?-1:0,warmFlag=result.identity.initialVoltagePolicy==='SOURCE_SAVED'?0:1;
 const windingColumns=windingRows.length?columns(windingRows):{WIND1NUMBER:[],WIND2NUMBER:[],WIND3NUMBER:[],WNDNUM:[],ID:[],STATUS:[],P:[],Q:[]};
 return{schema:'ga.psse.reference.v1',provenance:'PSSE_REFERENCE',source:{name:model.source.name,sha256:model.source.sha256},optionsHash:'a'.repeat(64),spec:{method:scope==='DC'?'dclf_2':'fnsl',options:scope==='DC'?[0,0,1,1,0,1]:[0,0,0,0,0,warmFlag,qFlag,1],iterations:100,toleranceMva:.001,profile:'fixed-controls-v1',oracleVersion:'36.5.0',harnessVersion:2},loadError:0,ierr:0,solved:scope==='DC'?9:0,exportErrors:[],buses:columns(buses),branches:columns(branchRows),generators:columns(generators),windings:windingColumns,dcReport:{flowResolutionMw:.001,flows:dcFlows,unparsedRows:[]}};
}
test('basic AC reference matches the production result only under the declared control policy',()=>{
 const {model,network}=makeCase(),result=solvePsseNewton({model,network,options:{reactiveLimitsEnabled:false}}),reference=structuredClone(fixture),beforeModel=JSON.stringify(model),beforeNetwork=JSON.stringify(network),beforeResult=JSON.stringify(result);
 const comparison=comparePsseReference(reference,model,network,result);
 assert.equal(comparison.status,'MATCHED');assert.deepEqual(comparison.counts,{buses:3,branches:6,windings:0,generators:2,compared:11,missing:0});
 assert.ok((comparison.maximumAbsoluteError.voltagePu??Infinity)<=1e-4);assert.ok((comparison.maximumAbsoluteError.angleDeg??Infinity)<=.05);assert.ok((comparison.maximumAbsoluteError.powerMvar??Infinity)<=.5);
 assert.equal(JSON.stringify(model),beforeModel);assert.equal(JSON.stringify(network),beforeNetwork);assert.equal(JSON.stringify(result),beforeResult);assert.equal(reference.optionsHash,'9821c30ef02b5eeef52d64ad3518f2ba2f6e08b2cc9285172e96f0db5d9ee908');
});

test('blocked, stale, foreign-source, unknown-method, policy-mismatched and unsolved inputs never match',()=>{
 const {model,network}=makeCase(),result=solvePsseNewton({model,network,options:{reactiveLimitsEnabled:false}}),reference=structuredClone(fixture);
 assert.equal(comparePsseReference({...reference,source:{...reference.source,sha256:'0'.repeat(64)}},model,network,result).status,'SOURCE_MISMATCH');
 assert.equal(comparePsseReference({...reference,spec:{...reference.spec,method:'mystery'}},model,network,result).status,'METHOD_MISMATCH');
 assert.equal(comparePsseReference({...reference,spec:{...reference.spec,method:'dclf_2'}},model,network,result).status,'METHOD_MISMATCH');
 assert.equal(comparePsseReference({...reference,spec:{...reference.spec,options:[0,0,0,0,0,1,0,1]}},model,network,result).status,'NOT_READY');
 assert.equal(comparePsseReference({...reference,spec:{...reference.spec,options:[0,0,0,0,0,1,-1]}},model,network,result).status,'NOT_READY');
 assert.equal(comparePsseReference({...reference,solved:9},model,network,result).status,'REFERENCE_NOT_SOLVED');
 assert.equal(comparePsseReference(reference,model,network,{...result,status:'BLOCKED'}).status,'NOT_READY');
 assert.equal(comparePsseReference(reference,model,network,{...result,identity:{...result.identity,modelHash:'f'.repeat(64)}}).status,'NOT_READY');
 assert.equal(comparePsseReference(reference,model,network,{...result,identity:{...result.identity,scenarioHash:'f'.repeat(64)}}).status,'NOT_READY');
 const activeLoad=network.loads.find(load=>load.status===1)!;
 const scenario=createPsseScenario(network,[{equipmentId:activeLoad.sourceEquipmentId,action:'LOAD_SCALE',value:.95}]);
 const scenarioResult=solvePsseNewton({model,network,scenario,options:{reactiveLimitsEnabled:false}});
 assert.equal(comparePsseReference(reference,model,network,scenarioResult).status,'NOT_READY');
});

test('partial or non-finite required values are incomplete, not successful comparisons',()=>{
 const {model,network}=makeCase(),result=solvePsseNewton({model,network,options:{reactiveLimitsEnabled:false}}),reference=structuredClone(fixture);
 reference.branches.P.pop();assert.equal(comparePsseReference(reference,model,network,result).status,'INCOMPLETE_COMPARISON');
 const nonfiniteResult=structuredClone(result);nonfiniteResult.busResults[0]!.vmPu=Number.NaN;
 const comparison=comparePsseReference(fixture,model,network,nonfiniteResult);assert.equal(comparison.status,'INCOMPLETE_COMPARISON');assert.ok(comparison.counts.missing>0);
 const nonfiniteReference=structuredClone(fixture);nonfiniteReference.buses.PU[0]=Number.NaN;
 assert.equal(comparePsseReference(nonfiniteReference,model,network,result).status,'INCOMPLETE_COMPARISON');
 const duplicateBus=structuredClone(fixture);for(const values of Object.values(duplicateBus.buses) as unknown[][])values.push(values[0]);
 assert.equal(comparePsseReference(duplicateBus,model,network,result).status,'INCOMPLETE_COMPARISON');
});

test('directed endpoint lookup handles reversed normalized branch orientation and parallel circuit IDs',()=>{
 const {model,network}=makeCase(),result=solvePsseNewton({model,network,options:{reactiveLimitsEnabled:false}});
 const reversedNetwork=structuredClone(network),reversedResult=structuredClone(result),branch=reversedNetwork.branches[0]!,calculated=reversedResult.branchResults.find(item=>item.id===branch.id)!;
 [branch.from,branch.to]=[branch.to,branch.from];[branch.fromKey,branch.toKey]=[branch.toKey,branch.fromKey];[branch.terminalFrom,branch.terminalTo]=[branch.terminalTo,branch.terminalFrom];
 [calculated.terminalFrom,calculated.terminalTo]=[calculated.terminalTo,calculated.terminalFrom];[calculated.pFromMw,calculated.pToMw]=[calculated.pToMw,calculated.pFromMw];[calculated.qFromMvar,calculated.qToMvar]=[calculated.qToMvar,calculated.qFromMvar];
 reversedResult.identity.topologyHash=psseTopologyHash(reversedNetwork);
 assert.equal(comparePsseReference(fixture,model,reversedNetwork,reversedResult).status,'MATCHED');

 const raw=JSON.parse(syntheticRawx()),lineTable=raw.network.acline,cktIndex=lineTable.fields.indexOf('ckt'),xIndex=lineTable.fields.indexOf('xpu'),parallel=[...lineTable.data[0]];parallel[cktIndex]='2';parallel[xIndex]=.24;lineTable.data.push(parallel);
 const parallelCase=makeCase(JSON.stringify(raw),'parallel.rawx'),parallelResult=solvePsseNewton({model:parallelCase.model,network:parallelCase.network,options:{reactiveLimitsEnabled:false}}),parallelReference=referenceFromResult(parallelCase.model,parallelCase.network,parallelResult);
 const parallelComparison=comparePsseReference(parallelReference,parallelCase.model,parallelCase.network,parallelResult);
 assert.equal(parallelComparison.status,'MATCHED',JSON.stringify(parallelComparison));assert.equal(parallelComparison.counts.branches,8);
 const confused=structuredClone(parallelReference);const duplicate=confused.branches.ID.findIndex((id,index)=>id==='2'&&confused.branches.FROMNUMBER[index]===1);confused.branches.ID[duplicate]='1';
 assert.equal(comparePsseReference(confused,parallelCase.model,parallelCase.network,parallelResult).status,'INCOMPLETE_COMPARISON');
});

test('external three-winding winding P/Q rows are compared by the exact source winding identity',()=>{
 const {model,network}=makeCase(syntheticRawx('three-winding'),'three-winding.rawx'),result=solvePsseNewton({model,network,options:{reactiveLimitsEnabled:false}}),reference=referenceFromResult(model,network,result);
 const comparison=comparePsseReference(reference,model,network,result);
 assert.equal(comparison.status,'MATCHED');assert.equal(comparison.counts.windings,3);assert.equal(comparison.counts.missing,0);
 const missingWinding=structuredClone(reference);missingWinding.windings.P.pop();
 assert.equal(comparePsseReference(missingWinding,model,network,result).status,'INCOMPLETE_COMPARISON');
});

test('DC comparison uses dcReport flows, ignores AC branch P/Q, and does not gate on DCLF solved',()=>{
 const {model,network}=makeCase(),result=solvePsseDc({model,network}),reference=referenceFromResult(model,network,result,'DC');
 assert.equal(result.status,'CONVERGED');assert.equal(reference.solved,9);
 const baseline=comparePsseReference(reference,model,network,result);assert.equal(baseline.status,'MATCHED');
 const wrongSavedAnglePolicy=structuredClone(reference);wrongSavedAnglePolicy.spec.options[3]=0;
 assert.equal(comparePsseReference(wrongSavedAnglePolicy,model,network,result).status,'NOT_READY','DCLF options must save base-case DC angles before the angle comparison');
 reference.branches={P:[99999],Q:[-99999]};
 assert.equal(comparePsseReference(reference,model,network,result).status,'MATCHED');
 const dcReport=reference.dcReport as unknown as {flows:{pMw:number}[]};dcReport.flows[0]!.pMw+=10;
 assert.equal(comparePsseReference(reference,model,network,result).status,'DIFFERENT');
 const wrongTap=structuredClone(result);wrongTap.diagnostics.tapPolicy='TAP_AWARE_LOSSLESS';
 assert.equal(comparePsseReference(reference,model,network,wrongTap).status,'NOT_READY');
});

test('AC reference bus angles align per island and are compared with angle wrap',()=>{
 const {model,network}=makeCase(),result=solvePsseNewton({model,network,options:{reactiveLimitsEnabled:false}}),reference=structuredClone(fixture);
 reference.buses.ANGLE=reference.buses.ANGLE.map((angle:number)=>angle+Math.PI*2);reference.buses.ANGLED=reference.buses.ANGLED.map((angle:number)=>angle+360);
 const comparison=comparePsseReference(reference,model,network,result);assert.equal(comparison.status,'MATCHED');assert.ok((comparison.maximumAbsoluteError.angleDeg??Infinity)<1e-5);
});

test('ANGLE radians and ANGLED degrees agree when nonzero, while a real angle error fails the gate',()=>{
 const {model,network}=makeCase(),result=solvePsseNewton({model,network,options:{reactiveLimitsEnabled:false}}),reference=structuredClone(fixture);
 assert.ok(reference.buses.ANGLE.some((angle:number)=>Math.abs(angle)>.01),'fixture includes a nonzero reference angle in radians');
 assert.ok(reference.buses.ANGLED.some((angle:number)=>Math.abs(angle)>.5),'fixture includes the equivalent nonzero angle in degrees');
 const bothUnits=comparePsseReference(reference,model,network,result);
 assert.equal(bothUnits.status,'MATCHED');assert.ok((bothUnits.maximumAbsoluteError.angleDeg??Infinity)<1e-5);
 delete reference.buses.ANGLED;
 const radiansOnly=comparePsseReference(reference,model,network,result);
 assert.equal(radiansOnly.status,'MATCHED');assert.ok((radiansOnly.maximumAbsoluteError.angleDeg??Infinity)<1e-5);
 const disagrees=structuredClone(reference);disagrees.buses.ANGLE[2]+=.1;
 const changed=comparePsseReference(disagrees,model,network,result);
 assert.equal(changed.status,'DIFFERENT');assert.ok((changed.maximumAbsoluteError.angleDeg??0)>.05);
});
