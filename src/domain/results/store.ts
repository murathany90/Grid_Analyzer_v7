import { identityKey, type AnalysisType, type CalculationIdentity } from '../calculation/identity';
import type { CalculationResult } from './types';
import { branchDelta } from './delta';
export type ResultRole = 'base' | 'scenario';
export class ResultStore {
  private expected = new Map<string, string>();
  private results = new Map<string, CalculationResult>();
  scenarioId='working';
  comparisonScenarioId='B0';
  selectScenario(id:string):void{this.scenarioId=id;}
  private key(role:ResultRole,type:AnalysisType):string{return `${role==='base'?'B0':this.scenarioId}.${type}`;}
  role: ResultRole | 'delta' = 'base';
  analysisType: AnalysisType = 'powerFlow';
  expect(role: ResultRole, id: CalculationIdentity): void { this.expected.set(this.key(role,id.analysisType), identityKey(id)); }
  accept(role: ResultRole, result: CalculationResult): boolean {
    const key = this.key(role,result.identity.analysisType);
    if (this.expected.get(key) !== identityKey(result.identity)) return false;
    this.results.delete(key);this.results.set(key,result);while(this.results.size>18)this.results.delete(this.results.keys().next().value!);return true;
  }
  get(role: ResultRole, type = this.analysisType): CalculationResult | null {
    const key = this.key(role,type), result = this.results.get(key);
    return result && this.expected.get(key) === identityKey(result.identity) ? result : null;
  }
  get active(): CalculationResult | null { return this.get(this.role === 'base' ? 'base' : 'scenario'); }
  invalidateScenario(): void { for (const key of [...this.expected.keys()]) if (key.startsWith(this.scenarioId+'.')&&this.scenarioId!=='B0') this.expected.delete(key); }
  clear(): void { this.expected.clear(); this.results.clear(); this.role = 'base';this.scenarioId='working';this.comparisonScenarioId='B0'; }
  private comparisonResult():CalculationResult|null{const key=`${this.comparisonScenarioId}.${this.analysisType}`,r=this.results.get(key);return r&&this.expected.get(key)===identityKey(r.identity)?r:null;}
  getSnapshot(id:string,type:AnalysisType='powerFlow'):CalculationResult|null{const key=`${id}.${type}`,r=this.results.get(key);return r&&this.expected.get(key)===identityKey(r.identity)?r:null;}
  comparable(): boolean {
    const a = this.comparisonResult(), b = this.get('scenario');
    return !!a && !!b && a.identity.modelHash === b.identity.modelHash && a.identity.optionsHash === b.identity.optionsHash && a.identity.engine === b.identity.engine && a.identity.engineVersion === b.identity.engineVersion && a.converged && b.converged;
  }
  delta() {
    if (!this.comparable()) return [];
    const a = this.comparisonResult()!, b = this.get('scenario')!;
    const old = new Map(a.branches.map(e => [`${e.sourceClass}|${e.id}`, e]));
    const current = new Map(b.branches.map(e => [`${e.sourceClass}|${e.id}`, e]));
    return [...new Set([...old.keys(), ...current.keys()])].map(key => {
      const before = old.get(key), after = current.get(key), entity = after || before!;
      return { id: entity.id, name: entity.name, sourceClass: entity.sourceClass,
        ...branchDelta(before, after),
        state: before ? after ? 'COMPARED' : 'REMOVED' : 'ADDED' };
    });
  }
}
