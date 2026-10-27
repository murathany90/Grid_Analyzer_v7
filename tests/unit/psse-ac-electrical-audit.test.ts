import test from 'node:test';
import assert from 'node:assert/strict';
import {syntheticRawx} from '../../tools/psse-synthetic-cases';
import {decodeRawx} from '../../src/importers/psse/raw';
import {normalizePsseBusBranch} from '../../src/domain/psse/network';
import {solvePsseNewton} from '../../src/analysis/psse/newton';
import type {PsseCalculationResult} from '../../src/domain/psse/results';
import type {PsseBusBranchNetwork} from '../../src/domain/psse/network';

function fixture(name='basic'){return decodeRawx(new TextEncoder().encode(syntheticRawx(name)),'public-electrical-audit.rawx');}
/** Independent output equation: machine aggregate = ZIP consumption + shunts + all terminal powers. */
function maxOutputKcl(network:PsseBusBranchNetwork,result:PsseCalculationResult){
 const buses=new Map(result.busResults.map(b=>[b.id,b])),branches=new Map(result.branchResults.map(b=>[b.id,b]));let maximum=0;
 for(let i=0;i<network.buses.length;i++)if(network.buses[i].source&&network.buses[i].status===1){const bus=buses.get(network.buses[i].id)!;let p=bus.pGenerationMw!,q=bus.qGenerationMvar!;const v=bus.vmPu!;
  for(const l of network.loads)if(l.status===1&&l.bus===i){p-=l.pMw+l.ipMw*v+l.ypMw*v*v;q-=l.qMvar+l.iqMvar*v+l.yqMvar*v*v;}
  for(const s of network.shunts)if(s.status===1&&s.bus===i){p-=s.gMw*v*v;q+=s.bMvar*v*v;}
  for(const b of network.branches)if(b.status===1){const r=branches.get(b.id)!;if(b.from===i){p-=r.pFromMw!;q-=r.qFromMvar!;}if(b.to===i){p-=r.pToMw!;q-=r.qToMvar!;}}
  maximum=Math.max(maximum,Math.hypot(p,q));
 }
 return maximum;
}

test('AC ideal trees and cycles preserve charging and terminal conductance with physical per-bus KCL',()=>{
 for(const cycle of [false,true]){const model=fixture(),lines=model.equipment.filter(e=>e.kind==='line');for(const e of cycle?lines:[lines[0]])Object.assign(e.fields,{rpu:0,xpu:.0001});Object.assign(lines[0].fields,{bpu:.03,gi:.002,bi:-.01,gj:.003,bj:.015});const network=normalizePsseBusBranch(model),original=JSON.stringify(network),result=solvePsseNewton({model,network,options:{initialVoltagePolicy:'SOURCE_SAVED',tolerancePu:1e-9}});
  assert.equal(result.status,'CONVERGED');assert.equal(result.classification,'SOLVED_APPROXIMATE');assert.equal(JSON.stringify(network),original,'AC contraction must not change the network used by DC/DGS');assert.ok(maxOutputKcl(network,result)<1e-6,`physical KCL ${cycle?'cycle':'tree'}`);
  const branch=network.branches.find(b=>b.sourceEquipmentId===lines[0].id)!,r=result.branchResults.find(b=>b.id===branch.id)!,v=result.busResults.find(b=>b.id===network.buses[branch.from].id)!.vmPu!;assert.ok(Math.abs(r.pLossMw!-.005*network.baseMva*v*v)<1e-8,'ideal series contraction retains both conductance shunts');assert.ok(Math.abs(r.qLossMvar!+(.03-.01+.015)*network.baseMva*v*v)<1e-8,'ideal series contraction retains charging and both terminal susceptances');
  if(cycle)assert.ok(result.findings.some(f=>f.code==='AC_IDEAL_LINK_CYCLE_FLOW_ALLOCATION'));
 }
});

test('valid nonzero BP bypass contracts the series branch while retaining shunts and physical KCL',()=>{
 const model=fixture(),line=model.equipment.find(e=>e.kind==='line')!;Object.assign(line.fields,{bp:1,rpu:.04,xpu:.12,gi:.002,gj:.003});const network=normalizePsseBusBranch(model),result=solvePsseNewton({model,network,options:{initialVoltagePolicy:'SOURCE_SAVED',tolerancePu:1e-9}});assert.equal(result.status,'CONVERGED',JSON.stringify(result.findings.filter(f=>f.severity==='ERROR')));assert.equal((result.diagnostics.idealLinkContraction as {contractedBranchCount:number}).contractedBranchCount,1);assert.ok(maxOutputKcl(network,result)<1e-6);
});

test('three-winding output conserves physical bus power and zero injection at its internal star',()=>{
 const model=fixture('three-winding'),network=normalizePsseBusBranch(model),result=solvePsseNewton({model,network,options:{tolerancePu:1e-9}});assert.equal(result.status,'CONVERGED');assert.ok(maxOutputKcl(network,result)<1e-6);const legs=network.branches.filter(b=>b.kind==='three-winding-leg'),outputs=new Map(result.branchResults.map(b=>[b.id,b]));assert.equal(legs.length,3);assert.ok(Math.abs(legs.reduce((s,b)=>s+outputs.get(b.id)!.pToMw!,0))<1e-6);assert.ok(Math.abs(legs.reduce((s,b)=>s+outputs.get(b.id)!.qToMvar!,0))<1e-6);
});

test('a warm-start load perturbation performs Newton updates and reduces independent physical mismatch',()=>{
 const model=fixture(),network=normalizePsseBusBranch(model),base=solvePsseNewton({model,network,options:{tolerancePu:1e-9}});assert.equal(base.status,'CONVERGED');const perturbed=structuredClone(network),oldBuses=new Map(base.busResults.map(b=>[b.id,b]));for(const b of perturbed.buses){b.initialVm=oldBuses.get(b.id)!.vmPu;b.initialVaDeg=oldBuses.get(b.id)!.vaDeg;}for(const l of perturbed.loads){l.pMw*=1.2;l.qMvar*=1.2;}const original=JSON.stringify(perturbed),history:number[]=[],result=solvePsseNewton({model,network:perturbed,options:{initialVoltagePolicy:'SOURCE_SAVED',tolerancePu:1e-9},progress:e=>{if(e.residualPu!==null)history.push(e.residualPu);}});
 assert.equal(result.status,'CONVERGED');assert.ok(result.iterations>=1);assert.ok(history[0]>.1);assert.ok(history.at(-1)!<history[0]*1e-7);assert.ok(maxOutputKcl(perturbed,result)<1e-6);assert.equal(JSON.stringify(perturbed),original);const loadBus=network.buses[network.loads[0].bus].id;assert.ok(Math.abs(result.busResults.find(b=>b.id===loadBus)!.vmPu!-oldBuses.get(loadBus)!.vmPu!)>1e-3,'new solution differs from the saved initial voltage');
});
