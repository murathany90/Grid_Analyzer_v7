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

/**
 * Why a result may not be read as a complete solution, if it may not.
 *
 * `converged` describes the Newton solve only. A station-control fallback keeps a
 * converged local-PV operating point, so both flags stay true while the station
 * requirement is unresolved. Callers must therefore consult this to decide whether a
 * result may be presented as a full solution; the NR-level flag alone is not enough.
 */
export interface SolutionCompleteness {
  /** Newton solve converged. */
  newtonConverged:boolean;
  /** Station control reached a controlled operating point, not a local-PV fallback. */
  stationControlApplied:boolean;
  /** Distributed active balance met the reference P target. */
  activeBalanceConverged:boolean;
  /** No concern is partial: the result may be presented as a full solution. */
  fullSolution:boolean;
  /** Machine-readable reason when `fullSolution` is false. */
  reason:'NONE'|'NEWTON_NOT_CONVERGED'|'STATION_CONTROL_FALLBACK'|'ACTIVE_BALANCE_PARTIAL';
  provenance:string|null;
}

export function solutionCompleteness(result: CalculationResult | null | undefined): SolutionCompleteness {
  const diagnostics=(result?.diagnostics??{}) as Record<string,unknown>;
  const convergence=diagnostics.convergence as {activeBalance?:string;stationControl?:string}|undefined;
  const provenance=typeof diagnostics.resultProvenance==='string'?diagnostics.resultProvenance:null;
  const newtonConverged=result?.converged===true;
  const stationControlApplied=convergence?.stationControl==='STATION_CONTROL_CONVERGED'&&provenance!=='BASELINE_FALLBACK';
  const activeBalanceConverged=convergence?.activeBalance!=='ACTIVE_BALANCE_PARTIAL';
  const reason:SolutionCompleteness['reason']=!newtonConverged?'NEWTON_NOT_CONVERGED':provenance==='BASELINE_FALLBACK'||!stationControlApplied?'STATION_CONTROL_FALLBACK':!activeBalanceConverged?'ACTIVE_BALANCE_PARTIAL':'NONE';
  return{newtonConverged,stationControlApplied,activeBalanceConverged,fullSolution:reason==='NONE',reason,provenance};
}

export function calculationConvergenceLabel(result: CalculationResult | null | undefined): string {
  if (!result) return 'Hesap bekleniyor';
  if (!result.converged) return result.status;
  const completeness=solutionCompleteness(result);
  // A converged Newton solve that fell back to local PV is never presented as a full
  // solution: the station requirement is stated explicitly in the label.
  if(!completeness.fullSolution){
    const detail=completeness.reason==='STATION_CONTROL_FALLBACK'
      ?(completeness.provenance==='BASELINE_FALLBACK'?'istasyon kontrolü uygulanmadı (yerel PV geri düşüşü)':'istasyon kontrolü kısmi')
      :completeness.reason==='ACTIVE_BALANCE_PARTIAL'?'P dengesi kısmi':'tam çözüm değil';
    return`NR yakınsadı · ${detail} · tam çözüm değil`;
  }
  const convergence = (result.diagnostics as Record<string, unknown>).convergence as {activeBalance?:string;stationControl?:string;pendingControllerStatuses?:Record<string,number>} | undefined;
  const partial: string[] = [];
  if (convergence?.activeBalance === 'ACTIVE_BALANCE_CONVERGED') partial.push('P dengesi yakınsadı');
  if (convergence?.stationControl === 'STATION_CONTROL_CONVERGED') partial.push('istasyon kontrolü yakınsadı');
  return partial.length?`NR yakınsadı · ${partial.join(' · ')}`:'Yakınsadı';
}
