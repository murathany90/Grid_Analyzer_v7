import type { CalculationIdentity } from '../calculation/identity';
export interface BusResult { id: string; name: string; terms: string[]; siteIds: string[]; vnKv: number; vmPu: number; angleRad: number; pMw: number; qMvar: number; islandId?: string }
export interface BranchResult { id: string; name: string; sourceClass: string; from: string; to: string; siteIds: string[]; vnKv: number; pf: number; qf: number; pt: number; qt: number; ifA: number; itA: number; loading: number | null; apparentPowerLoadingPercent?: number|null; currentLoadingPercent?: number|null; displayLoadingPercent?: number|null; ratedCurrentFromA?: number|null; ratedCurrentToA?: number|null; pLoss: number; qLoss: number; islandId?: string }
export interface GeneratorResult { id: string; name: string; pMw: number; qMvar: number|null; qState: string; bus: string }
/** Positive P/Q is load consumption, including signed (negative) source loads. */
export interface LoadResult { id:string;name:string;sourceClass:'ElmLod';bus:string;pMw:number|null;qMvar:number|null;p0Mw:number;q0Mvar:number;voltagePu:number|null;activeBalanceAdjustmentMw:number|null;model:'CONSTANT_PQ';status:string }
/** Positive FROM power leaves the native FROM terminal. Cycles have no unique ideal flow. */
export interface SwitchFlowResult { id:string;sourceClass:string;from:string;to:string;pf:number|null;qf:number|null;pt:number|null;qt:number|null;status:string;method:'IDEAL_BRIDGE_KCL';reason:string;cutTerminalCount?:number;kclResidualMw?:number;kclResidualMvar?:number }
export interface CalculationResult {
  identity: CalculationIdentity; status: string; converged: boolean; iterations: number; rounds: number;
  maxMismatchMw: number | null; elapsedMs: number; buses: BusResult[]; branches: BranchResult[];
  generators: GeneratorResult[]; diagnostics: Record<string, unknown>; warnings: string[];
  /** Absent in older snapshots and reduced/DC results: never backfill from dispatch. */
  loads?:LoadResult[];switchFlows?:SwitchFlowResult[];
  quality: { numericalStatus: string; controlFidelity: 'PARTIAL'; referenceValidation: 'NOT_AVAILABLE' };
}
