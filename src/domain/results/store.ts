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
  delta(): { id: string; name: string; pMw: number | null; loading: number | null; state: string }[] {
    const a = this.get('base'), b = this.get('scenario');
    if (!a || !b || a.identity.modelHash !== b.identity.modelHash || a.identity.optionsHash !== b.identity.optionsHash || !a.converged || !b.converged) return [];
    const old = new Map(a.branches.map(e => [e.id, e]));
    return b.branches.map(e => { const before = old.get(e.id); return { id: e.id, name: e.name, pMw: before ? e.pf - before.pf : null,
      loading: before?.loading != null && e.loading != null ? e.loading - before.loading : null, state: before ? 'COMPARED' : 'ADDED' }; });
  }
}
