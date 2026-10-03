import { stableJson, type AnalysisType } from './identity';

export type FullAcProfile = 'POWERFACTORY_TEIAS_PARITY' | 'GA_ROBUST' | 'CUSTOM';
export interface SharedAnalysisSettings {
  loadScalePercent: number;
  generationScalePercent: number;
  motorScalePercent: number;
  storageHeaterScalePercent: number;
}
export interface FullAcSettings {
  profile: FullAcProfile;
  activeControlMode: 'AS_DISPATCHED';
  activeBalancingMode: 'SINGLE_REFERENCE' | 'DISTRIBUTED_ADJUSTABLE_LOADS';
  stationControlMode: 'off' | 'zeroDroop' | 'droop';
  maxInnerIterations: number;
  maxOuterIterations: number;
  nodalToleranceKva: number;
  modelEquationTolerancePercent: number;
  maxNoImprovementIterations: number;
  repeatedReactiveLimitDetection: number;
  qLimitToleranceMvar: number;
  reactiveLimitsEnabled: boolean;
  activePowerLimitsEnabled: boolean;
  automaticTransformerTap: boolean;
  automaticShunt: boolean;
  loadVoltageDependency: boolean;
  feederLoadScaling: boolean;
  interchangeSchedule: boolean;
  lineResistanceTemperatureCorrection: boolean;
  qLimitScalingEnabled: boolean;
}
export interface FastAcSettings { minVoltageKv: number; maxIterations: number; mismatchTolerance: number; nrRefinementEnabled: boolean; nrRefinementMaxIterations: number; maxQLimitRounds: number; usePvControls: boolean; considerQLimits: boolean; fallbackPolicy: 'APPROXIMATE'|'FAIL'; }
export interface DcSettings { minVoltageKv: number; maxLinearIterations: number; relativeResidualTolerance: number; activeBalancingMode: 'SINGLE_REFERENCE'; }
export interface AnalysisSettings { shared: SharedAnalysisSettings; powerFlow: FullAcSettings; fastAc: FastAcSettings; dc: DcSettings; }

const parityPowerFlow = (): FullAcSettings => ({
  profile: 'POWERFACTORY_TEIAS_PARITY', activeControlMode: 'AS_DISPATCHED', activeBalancingMode: 'DISTRIBUTED_ADJUSTABLE_LOADS', stationControlMode: 'zeroDroop',
  maxInnerIterations: 100, maxOuterIterations: 50, nodalToleranceKva: 5, modelEquationTolerancePercent: .2,
  maxNoImprovementIterations: 20, repeatedReactiveLimitDetection: 3, qLimitToleranceMvar: .02, reactiveLimitsEnabled: true, activePowerLimitsEnabled: false,
  automaticTransformerTap: false, automaticShunt: false, loadVoltageDependency: false, feederLoadScaling: false, interchangeSchedule: false,
  lineResistanceTemperatureCorrection: false, qLimitScalingEnabled: false
});
export const defaultAnalysisSettings = (): AnalysisSettings => ({
  shared: { loadScalePercent: 100, generationScalePercent: 100, motorScalePercent: 100, storageHeaterScalePercent: 100 },
  powerFlow: parityPowerFlow(), fastAc: { minVoltageKv: 66, maxIterations: 110, mismatchTolerance: 1e-5, nrRefinementEnabled: true, nrRefinementMaxIterations: 20, maxQLimitRounds: 5, usePvControls: true, considerQLimits: true, fallbackPolicy: 'APPROXIMATE' }, dc: { minVoltageKv: 66, maxLinearIterations: 20000, relativeResidualTolerance: 1e-7, activeBalancingMode: 'SINGLE_REFERENCE' }
});
export function activeAnalysisSettings(settings: AnalysisSettings, type: AnalysisType): unknown {
  return { shared: settings.shared, [type]: settings[type] };
}
export function analysisSettingsHash(settings: AnalysisSettings, type: AnalysisType): string {
  const text = stableJson(activeAnalysisSettings(settings, type));
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16).padStart(8, '0');
}

const storageKey = 'grid-analyzer-v7-analysis-settings';
function bounded(value: unknown, fallback: number, min: number, max: number, integer = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  const v = Math.max(min, Math.min(max, value));
  return integer ? Math.round(v) : v;
}
function mergeSettings(input: unknown): AnalysisSettings {
  const d = defaultAnalysisSettings(), src = input && typeof input === 'object' ? input as Partial<AnalysisSettings> : {};
  const sh: Partial<SharedAnalysisSettings> = src.shared ?? {}, pfInput: Partial<FullAcSettings> = src.powerFlow ?? {}, fastInput: Partial<FastAcSettings> = src.fastAc ?? {}, dcInput: Partial<DcSettings> = src.dc ?? {};
  const whitelist = <T extends object>(input: object, defaults: T): Partial<T> => Object.fromEntries(Object.entries(input).filter(([key]) => key in defaults)) as Partial<T>;
  const pf = whitelist(pfInput, d.powerFlow), fast = whitelist(fastInput, d.fastAc), dc = whitelist(dcInput, d.dc);
  const pickBool = (v: unknown, fallback: boolean) => typeof v === 'boolean' ? v : fallback;
  const enumValue = <T extends string>(v: unknown, values: readonly T[], fallback: T): T => values.includes(v as T) ? v as T : fallback;
  return {
    shared: {
      loadScalePercent: bounded(sh.loadScalePercent, d.shared.loadScalePercent, 0, 300), generationScalePercent: bounded(sh.generationScalePercent, d.shared.generationScalePercent, 0, 300),
      motorScalePercent: bounded(sh.motorScalePercent, d.shared.motorScalePercent, 0, 300), storageHeaterScalePercent: bounded(sh.storageHeaterScalePercent, d.shared.storageHeaterScalePercent, 0, 300)
    },
    powerFlow: {
      ...d.powerFlow, ...pf,
      profile: enumValue(pf.profile, ['POWERFACTORY_TEIAS_PARITY', 'GA_ROBUST', 'CUSTOM'], d.powerFlow.profile),
      activeControlMode: 'AS_DISPATCHED', activeBalancingMode: enumValue(pf.activeBalancingMode, ['SINGLE_REFERENCE', 'DISTRIBUTED_ADJUSTABLE_LOADS'], d.powerFlow.activeBalancingMode),
      stationControlMode: enumValue(pf.stationControlMode, ['off', 'zeroDroop', 'droop'], d.powerFlow.stationControlMode),
      maxInnerIterations: bounded(pf.maxInnerIterations, d.powerFlow.maxInnerIterations, 1, 10000, true), maxOuterIterations: bounded(pf.maxOuterIterations, d.powerFlow.maxOuterIterations, 1, 10000, true),
      nodalToleranceKva: bounded(pf.nodalToleranceKva, d.powerFlow.nodalToleranceKva, .001, 1e6), modelEquationTolerancePercent: bounded(pf.modelEquationTolerancePercent, d.powerFlow.modelEquationTolerancePercent, .001, 100),
      maxNoImprovementIterations: bounded(pf.maxNoImprovementIterations, d.powerFlow.maxNoImprovementIterations, 1, 10000, true), repeatedReactiveLimitDetection: bounded(pf.repeatedReactiveLimitDetection, d.powerFlow.repeatedReactiveLimitDetection, 1, 1000, true), qLimitToleranceMvar: bounded(pf.qLimitToleranceMvar, d.powerFlow.qLimitToleranceMvar, 0, 10000),
      reactiveLimitsEnabled: pickBool(pf.reactiveLimitsEnabled, d.powerFlow.reactiveLimitsEnabled), activePowerLimitsEnabled: pickBool(pf.activePowerLimitsEnabled, d.powerFlow.activePowerLimitsEnabled),
      automaticTransformerTap: pickBool(pf.automaticTransformerTap, false), automaticShunt: pickBool(pf.automaticShunt, false), loadVoltageDependency: pickBool(pf.loadVoltageDependency, false),
      feederLoadScaling: pickBool(pf.feederLoadScaling, false), interchangeSchedule: pickBool(pf.interchangeSchedule, false), lineResistanceTemperatureCorrection: pickBool(pf.lineResistanceTemperatureCorrection, false), qLimitScalingEnabled: pickBool(pf.qLimitScalingEnabled, false)
    },
    fastAc: { minVoltageKv: bounded(fast.minVoltageKv, d.fastAc.minVoltageKv, 1, 1000), maxIterations: bounded(fast.maxIterations, d.fastAc.maxIterations, 1, 100000, true), mismatchTolerance: bounded(fast.mismatchTolerance, d.fastAc.mismatchTolerance, 1e-12, 1), nrRefinementEnabled: pickBool(fast.nrRefinementEnabled, d.fastAc.nrRefinementEnabled), nrRefinementMaxIterations: bounded(fast.nrRefinementMaxIterations, d.fastAc.nrRefinementMaxIterations, 1, 10000, true), maxQLimitRounds: bounded(fast.maxQLimitRounds, d.fastAc.maxQLimitRounds, 1, 10000, true), usePvControls: pickBool(fast.usePvControls, d.fastAc.usePvControls), considerQLimits: pickBool(fast.considerQLimits, d.fastAc.considerQLimits), fallbackPolicy: enumValue(fast.fallbackPolicy, ['APPROXIMATE', 'FAIL'], d.fastAc.fallbackPolicy) },
    dc: { minVoltageKv: bounded(dc.minVoltageKv, d.dc.minVoltageKv, 1, 1000), maxLinearIterations: bounded(dc.maxLinearIterations, d.dc.maxLinearIterations, 1, 1000000, true), relativeResidualTolerance: bounded(dc.relativeResidualTolerance, d.dc.relativeResidualTolerance, 1e-12, 1), activeBalancingMode: 'SINGLE_REFERENCE' }
  };
}
export class AnalysisSettingsStore {
  value = defaultAnalysisSettings();
  constructor() { try { this.value = mergeSettings(JSON.parse(localStorage.getItem(storageKey) || 'null')); } catch { /* file:// storage can be unavailable */ } }
  update(input: unknown, persist = true): void { this.value = mergeSettings(input); if (persist) try { localStorage.setItem(storageKey, JSON.stringify(this.value)); } catch { /* Persistence is optional */ } }
  reset(): void { this.update(defaultAnalysisSettings()); }
}
