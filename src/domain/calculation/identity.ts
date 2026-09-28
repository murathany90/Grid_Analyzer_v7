import { scenarioSignature, type ScenarioOverlay } from '../scenario/overlay';
export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return '['+value.map(stableJson).join(',')+']';
  if (value && typeof value === 'object') return '{'+Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).filter(([,v])=>v!==undefined).map(([k,v])=>JSON.stringify(k)+':'+stableJson(v)).join(',')+'}';
  return JSON.stringify(value) ?? 'null';
}
export type AnalysisType = 'powerFlow' | 'fastAc' | 'dc';
export interface CalculationIdentity { modelHash: string; scenarioHash: string; analysisType: AnalysisType; engine: string; engineVersion: string; optionsHash: string }
export function identity(modelHash: string, scenario: ScenarioOverlay, analysisType: AnalysisType, options = {}): CalculationIdentity {
  // Collision-free canonical serialization is used for small overlays/options; the model is SHA-256.
  return { modelHash, scenarioHash: scenarioSignature(scenario), analysisType, engine: 'BrowserJsEngine', engineVersion: '7.1.0', optionsHash: stableJson(options) };
}
export function identityKey(id: CalculationIdentity): string { return JSON.stringify([id.modelHash, id.scenarioHash, id.analysisType, id.engine, id.engineVersion, id.optionsHash]); }
