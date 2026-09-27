import { scenarioSignature, type ScenarioOverlay } from '../scenario/overlay';
export type AnalysisType = 'powerFlow' | 'fastAc' | 'dc';
export interface CalculationIdentity { modelHash: string; scenarioHash: string; analysisType: AnalysisType; engine: string; engineVersion: string; optionsHash: string }
export function identity(modelHash: string, scenario: ScenarioOverlay, analysisType: AnalysisType, options = {}): CalculationIdentity {
  // Collision-free canonical serialization is used for small overlays/options; the model is SHA-256.
  return { modelHash, scenarioHash: scenarioSignature(scenario), analysisType, engine: 'BrowserJsEngine', engineVersion: '7.0.0', optionsHash: JSON.stringify(options, Object.keys(options).sort()) };
}
export function identityKey(id: CalculationIdentity): string { return JSON.stringify([id.modelHash, id.scenarioHash, id.analysisType, id.engine, id.engineVersion, id.optionsHash]); }
