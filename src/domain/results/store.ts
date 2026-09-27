import { identityKey, type AnalysisType, type CalculationIdentity } from '../calculation/identity';
import type { CalculationResult } from './types';
export type ResultRole = 'base' | 'scenario';
export class ResultStore {
  private expected = new Map<string, string>();
  private results = new Map<string, CalculationResult>();
  role: ResultRole | 'delta' = 'base';
  analysisType: AnalysisType = 'powerFlow';
  expect(role: ResultRole, id: CalculationIdentity): void { this.expected.set(`${role}.${id.analysisType}`, identityKey(id)); }
  accept(role: ResultRole, result: CalculationResult): boolean {
    const key = `${role}.${result.identity.analysisType}`;
    if (this.expected.get(key) !== identityKey(result.identity)) return false;
    this.results.set(key, result); return true;
  }
  get(role: ResultRole, type = this.analysisType): CalculationResult | null {
    const key = `${role}.${type}`, result = this.results.get(key);
    return result && this.expected.get(key) === identityKey(result.identity) ? result : null;
  }
  get active(): CalculationResult | null { return this.get(this.role === 'base' ? 'base' : 'scenario'); }
  invalidateScenario(): void { for (const key of [...this.expected.keys()]) if (key.startsWith('scenario.')) this.expected.delete(key); }
  clear(): void { this.expected.clear(); this.results.clear(); this.role = 'base'; }
  comparable(): boolean {
    const a = this.get('base'), b = this.get('scenario');
    return !!a && !!b && a.identity.modelHash === b.identity.modelHash && a.identity.optionsHash === b.identity.optionsHash && a.identity.engine === b.identity.engine && a.identity.engineVersion === b.identity.engineVersion && a.converged && b.converged;
  }
  delta(): { id: string; name: string; sourceClass: string; pMw: number | null; loading: number | null; state: string }[] {
    if (!this.comparable()) return [];
    const a = this.get('base')!, b = this.get('scenario')!;
    const old = new Map(a.branches.map(e => [`${e.sourceClass}|${e.id}`, e]));
    const current = new Map(b.branches.map(e => [`${e.sourceClass}|${e.id}`, e]));
    return [...new Set([...old.keys(), ...current.keys()])].map(key => {
      const before = old.get(key), after = current.get(key), entity = after || before!;
      return { id: entity.id, name: entity.name, sourceClass: entity.sourceClass,
        pMw: before && after && Number.isFinite(after.pf-before.pf) ? after.pf-before.pf : null,
        loading: before?.loading != null && after?.loading != null ? after.loading-before.loading : null,
        state: before ? after ? 'COMPARED' : 'REMOVED' : 'ADDED' };
    });
  }
}
