import type { CalculationIdentity } from '../calculation/identity';
export interface BusResult { id: string; name: string; terms: string[]; siteIds: string[]; vnKv: number; vmPu: number; angleRad: number; pMw: number; qMvar: number; islandId?: string }
export interface BranchResult { id: string; name: string; sourceClass: string; from: string; to: string; siteIds: string[]; vnKv: number; pf: number; qf: number; pt: number; qt: number; ifA: number; itA: number; loading: number | null; pLoss: number; qLoss: number; islandId?: string }
export interface GeneratorResult { id: string; name: string; pMw: number; qMvar: number|null; qState: string; bus: string }
export interface CalculationResult {
  identity: CalculationIdentity; status: string; converged: boolean; iterations: number; rounds: number;
  maxMismatchMw: number | null; elapsedMs: number; buses: BusResult[]; branches: BranchResult[];
  generators: GeneratorResult[]; diagnostics: Record<string, unknown>; warnings: string[];
  quality: { numericalStatus: string; controlFidelity: 'PARTIAL'; referenceValidation: 'NOT_AVAILABLE' };
}
