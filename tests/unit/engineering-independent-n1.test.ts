import test from 'node:test';
import assert from 'node:assert/strict';
import {acNetwork} from '../helpers/ac-network';
import {validateAcOutages} from '../../src/analysis/contingency-ac';
import {emptyScenario} from '../../src/domain/scenario/overlay';
import {defaultAnalysisSettings} from '../../src/domain/calculation/analysis-settings';
import {BrowserJsPowerFlowEngine} from '../../src/analysis/api/browser-js-engine';
import {identity} from '../../src/domain/calculation/identity';
const close=(actual:number,expected:number,tolerance=1e-5)=>assert.ok(Math.abs(actual-expected)<tolerance,`${actual} versus independent ${expected}`);
/** Receiving-end S=V conj((E-V)/jX): y^2+(2Xq-E^2)y+X^2(p^2+q^2)=0.
 * This oracle uses input powers/impedance only; it never evaluates production Ybus. */
function radial(p:number,q:number,x:number,e=1){const d=e*e-2*x*q,y=(d+Math.sqrt(d*d-4*x*x*(p*p+q*q)))/2;return {v:Math.sqrt(y),angle:-Math.atan2(x*p,y+x*q),qFrom:q+x*(p*p+q*q)/y};}
const settings=()=>{const s=defaultAnalysisSettings();s.powerFlow.stationControlMode='off';s.powerFlow.activeBalancingMode='SINGLE_REFERENCE';s.powerFlow.nodalToleranceKva=.001;return s;};
test('parallel outage and closed coupler retain independently solved V, angle, endpoint S and zero MW loss',async()=>{
  const n=acNetwork(2),alias={...n.buses[1],id:'ALIAS',sourceId:'ALIAS'},network={...n,buses:[...n.buses,alias],loads:n.loads.map(l=>({...l,bus:'ALIAS'})),switches:[{...n.lines[0],id:'COUP',sourceId:'COUP',sourceClass:'ElmCoup',from:'B1',to:'ALIAS',closed:true}]};
  const [r]=await validateAcOutages(network,emptyScenario(),[{caseId:'N1:ElmLne:BYPASS',sourceClass:'ElmLne',fid:'BYPASS'}],{analysisSettings:settings()});assert.equal(r.status,'CONVERGED');
  const expected=radial(.3,.1,.1),bus=r.result!.buses.find(b=>b.terms.includes('ALIAS'))!,branch=r.result!.branches.find(b=>b.id==='L0')!;
  assert.ok(bus.terms.includes('B1'));close(bus.vmPu,expected.v);close(bus.angleRad,expected.angle);close(branch.pf,30);close(branch.pt,-30);close(branch.qf,expected.qFrom*100);close(Math.hypot(branch.pf,branch.qf),Math.hypot(30,expected.qFrom*100));assert.equal(branch.loading,null);
});
test('a transformer outage leaves the independently solved radial line and the exact other transformer identity',async()=>{
  const n=acNetwork(2),entity=n.lines[0],t={...entity,id:'T1',sourceId:'T1',sourceClass:'ElmTr2',rPu:0,xPu:.1,tap:1,phase:0,lvKv:100,ratingMva:100,tapPosition:0,gPu:0,bPu:0},network={...n,lines:[entity],transformers:[t]};
  const [r]=await validateAcOutages(network,emptyScenario(),[{caseId:'N1:ElmTr2:T1',sourceClass:'ElmTr2',fid:'T1'}],{analysisSettings:settings()});assert.equal(r.status,'CONVERGED');assert.equal(r.result!.branches.some(b=>b.id==='T1'),false);close(r.result!.buses.find(b=>b.terms.includes('B1'))!.vmPu,radial(.3,.1,.1).v);
});
test('ring outage with a fixed tap and phase obeys the input-derived receiving-voltage equation',async()=>{
  const n=acNetwork(2),entity=n.lines[0],tap=1.05,phase=.08,t={...entity,id:'T',sourceId:'T',sourceClass:'ElmTr2',rPu:0,xPu:.1,tap,phase,lvKv:100,ratingMva:100,tapPosition:1,gPu:0,bPu:0},network={...n,lines:[entity],transformers:[t]};
  const [r]=await validateAcOutages(network,emptyScenario(),[{caseId:'N1:ElmLne:L0',sourceClass:'ElmLne',fid:'L0'}],{analysisSettings:settings()});assert.equal(r.status,'CONVERGED');const expected=radial(.3,.1,.1,1/tap),b=r.result!.buses.find(b=>b.terms.includes('B1'))!,branch=r.result!.branches[0];close(b.vmPu,expected.v);close(b.angleRad,expected.angle-phase);close(branch.pf,30);close(branch.qf,expected.qFrom*100);close(branch.pf+branch.pt,0);
});
test('source-bounded station voltage control and saturated QMAX match separate analytical PV/PQ solutions',async()=>{
  const n=acNetwork(2),entity=n.loads[0],target=1.02,g={...entity,id:'G',sourceId:'G',sourceClass:'ElmSym',pMw:10,qMvar:0,vmSet:target,voltageControl:true,qMin:-100,qMax:100},c={...entity,id:'CTRL',sourceId:'CTRL',sourceClass:'ElmStactrl',remoteBus:'B1',unitIds:['G'],vmSet:target,controlModeRaw:0,selectedBusModeRaw:0,distributionModeRaw:0,droopModeRaw:0,qOrientationRaw:0,qSetpointRaw:0,modeSemantics:'CURRENT_PROFILE_VOLTAGE_DISPATCH_P' as const},s=settings();s.powerFlow.stationControlMode='zeroDroop';
  for(const qMax of [100,0]){const network={...n,generators:[{...g,qMax}],stationControllers:[c]},[r]=await validateAcOutages(network,emptyScenario(),[{caseId:'N1:ElmLne:BYPASS',sourceClass:'ElmLne',fid:'BYPASS'}],{analysisSettings:s});assert.equal(r.status,'CONVERGED');assert.equal(r.controlEvidence?.fidelity,'CONTROL_VERIFIED');const b=r.result!.buses.find(b=>b.terms.includes('B1'))!;
    if(qMax===100){const angle=-Math.asin(.2*.1/target),q=10+100*(target*target-target*Math.cos(angle))/.1;close(b.vmPu,target);close(b.angleRad,angle);close(r.result!.generators!.find(row=>row.id==='G')!.qMvar!,q,1e-4);}
    else{const expected=radial(.2,.1,.1);close(b.vmPu,expected.v);close(b.angleRad,expected.angle);close(r.result!.generators!.find(row=>row.id==='G')!.qMvar!,0);assert.match(JSON.stringify(r.controlEvidence?.stationSupport),/saturated/i);}
  }
});
test('distributed adjustable loads preserve fixed Q and independently known lossless participation',async()=>{
  const n=acNetwork(3),network={...n,diagnostics:[{code:'ACTIVE_BALANCE_FIXED_Q_OBSERVED',message:'Independent constant-Q fixture',severity:'INFO' as const}],lines:n.lines.filter(l=>l.id!=='BYPASS').map(l=>({...l,from:'B0'})),loads:[{...n.loads[0],id:'D1',sourceId:'D1',bus:'B1',pMw:10,qMvar:2,activeBalanceEligibility:true},{...n.loads[0],id:'D2',sourceId:'D2',bus:'B2',pMw:30,qMvar:6,activeBalanceEligibility:true}],externalGrids:n.externalGrids.map(e=>({...e,pMw:20}))},s=settings();s.powerFlow.activeBalancingMode='DISTRIBUTED_ADJUSTABLE_LOADS';const scenario=emptyScenario(),r=await new BrowserJsPowerFlowEngine().runPowerFlow({network,scenario,identity:identity(network.modelHash,scenario,'powerFlow'),analysisSettings:s});assert.equal(r.converged,true);assert.equal(r.diagnostics.convergence&&n1Evidence(r),true);
  const b1=r.branches.find(b=>b.id==='L0')!,b2=r.branches.find(b=>b.id==='L1')!;close(b1.pf,5);close(b2.pf,15);close(b1.qt,-2);close(b2.qt,-6);close(r.buses.find(b=>b.terms.includes('B1'))!.vmPu,radial(.05,.02,.1).v);close(r.buses.find(b=>b.terms.includes('B2'))!.vmPu,radial(.15,.06,.1).v);
});
function n1Evidence(r:import('../../src/domain/results/types').CalculationResult){return (r.diagnostics.convergence as {activeBalance?:string}).activeBalance==='ACTIVE_BALANCE_CONVERGED';}
