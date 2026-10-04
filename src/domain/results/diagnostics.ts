import type { CalculationResult } from './types';

/**
 * Truthful Full AC work counters.
 *
 * `CalculationResult.iterations` describes the final NR solve across islands. It is not a
 * step count for the calculation: a single Full AC run performs multiple full Newton
 * solves, reactive active-set rounds, distributed active-balance corrections and
 * station-controller rounds. The UI must present these separately instead of implying
 * that "4 steps" describes the whole solve.
 */
export interface FullAcDiagnostics {
  newtonIterations: number | null;
  finalNewtonIterations: number | null;
  fullNrSolves: number | null;
  qLimitRounds: number | null;
  activeBalanceCorrections: number | null;
  stationControlRounds: number | null;
  kluFactorizations: number | null;
}

function numeric(diagnostics: Record<string, unknown> | undefined, key: string): number | null {
  const value = diagnostics?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function fullAcDiagnostics(result: CalculationResult | null | undefined): FullAcDiagnostics {
  const diagnostics = (result?.diagnostics ?? {}) as Record<string, unknown>;
  const balance = diagnostics.activeBalancing as Record<string, unknown> | undefined;
  const rounds = diagnostics.qLimitActiveSet as { rounds?: unknown[] } | undefined;
  return {
    newtonIterations: numeric(diagnostics, 'totalNewtonIterations') ?? result?.iterations ?? null,
    finalNewtonIterations: result?.iterations ?? null,
    fullNrSolves: numeric(diagnostics, 'fullNrSolves'),
    qLimitRounds: Array.isArray(rounds?.rounds) ? rounds.rounds.length : null,
    activeBalanceCorrections: numeric(balance, 'iterations'),
    stationControlRounds: numeric(diagnostics, 'outerControlRounds'),
    kluFactorizations: numeric(diagnostics, 'kluNewtonFactorizations'),
  };
}

export function calculationConvergenceLabel(result: CalculationResult | null | undefined): string {
  if (!result) return 'Hesap bekleniyor';
  if (!result.converged) return result.status;
  const convergence = (result.diagnostics as Record<string, unknown>).convergence as {activeBalance?:string;stationControl?:string;pendingControllerStatuses?:Record<string,number>} | undefined;
  const partial: string[] = [];
  if (convergence?.activeBalance === 'ACTIVE_BALANCE_CONVERGED') partial.push('P dengesi yakınsadı');
  if (convergence?.activeBalance === 'ACTIVE_BALANCE_PARTIAL') partial.push('P dengesi kısmi');
  if (convergence?.stationControl === 'STATION_CONTROL_PARTIAL') {
    const count=Object.values(convergence.pendingControllerStatuses??{}).reduce((sum,value)=>sum+value,0);
    partial.push(`istasyon kontrolü kısmi${count?` (${count})`:''}`);
  }
  if (convergence?.stationControl === 'STATION_CONTROL_CONVERGED') partial.push('istasyon kontrolü yakınsadı');
  return partial.length?`NR yakınsadı · ${partial.join(' · ')}`:'Yakınsadı';
}
