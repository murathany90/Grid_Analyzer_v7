import {isCurrentPsseResult,type PsseCalculationResult} from '../../domain/psse/results';
import {createPsseScenario} from '../../domain/psse/scenario';
import type {PsseDiagramSnapshot} from './diagram-utils';

export interface PsseResultComparison {base:PsseCalculationResult|null;scenario:PsseCalculationResult|null;ready:boolean;reason:string|null}
/** Only actual empty-base and current-scenario solves with identical numerical policies may be subtracted. */
export function getPsseResultComparison(snapshot:PsseDiagramSnapshot,baseCandidate:PsseCalculationResult|null|undefined):PsseResultComparison{
 const emptyScenario=createPsseScenario(snapshot.base),baseCurrent=snapshot.scenario.operations.length===0?snapshot.calculation:baseCandidate;
 const base=baseCurrent&&baseCurrent.status==='CONVERGED'&&baseCurrent.physicsCoverage!=='BLOCKED'&&isCurrentPsseResult(baseCurrent,{sourceSha256:snapshot.model.source.sha256,network:snapshot.base,effectiveNetwork:snapshot.base,scenario:emptyScenario})?baseCurrent:null;
 const current=snapshot.calculation,scenario=snapshot.scenario.operations.length>0&&current&&current.status==='CONVERGED'&&current.physicsCoverage!=='BLOCKED'&&isCurrentPsseResult(current,{sourceSha256:snapshot.model.source.sha256,network:snapshot.base,effectiveNetwork:snapshot.network,scenario:snapshot.scenario})?current:null;
 if(!base)return{base,scenario,ready:false,reason:'Baz senaryoda aynı model için geçerli bir hesap gerekli.'};
 if(!scenario)return{base,scenario,ready:false,reason:'Senaryo işlemi ve bu senaryo için güncel bir hesap gerekli.'};
 const a=base.identity,b=scenario.identity,matching=base.method===scenario.method&&base.baseMva===scenario.baseMva&&a.optionsHash===b.optionsHash&&a.algorithmRevision===b.algorithmRevision&&a.controlPolicyId===b.controlPolicyId&&a.controlPolicyRevision===b.controlPolicyRevision&&a.initialVoltagePolicy===b.initialVoltagePolicy;
 return{base,scenario,ready:matching,reason:matching?null:'Baz ve senaryo yöntemi veya hesap ayarları farklı; fark üretilemez.'};
}
/** Missing quantities stay missing in differences; a DC Q/Vm is never zero-filled. */
export function psseFiniteDelta(base:number|null|undefined,scenario:number|null|undefined):number|null{return typeof base==='number'&&Number.isFinite(base)&&typeof scenario==='number'&&Number.isFinite(scenario)?scenario-base:null;}
