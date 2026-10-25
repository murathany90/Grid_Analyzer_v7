// Exact capacity interfaces from GA main 70c098a (functions omitted).
export type CapacitySeason = 'nominal' | 'summer' | 'winter' | 'operational';
export interface ManualSeasonalCapacity { readonly summer: number; readonly winter: number }
export interface CapacitySourceRef { readonly sourceClass: string; readonly sourceId: string; readonly field: string; readonly unit?: string }

export interface CapacitySection {
  readonly id: string | null;
  readonly typeId: string | null;
  readonly conductor: string | null;
  readonly index: number;
  readonly rawCurrentKA: number | null;
  readonly sectionFactor: number | null;
  readonly lineFactor: number | null;
  readonly appliedFactor: number | null;
  readonly nominalCurrentKA: number | null;
  readonly nominalMVA: number | null;
  readonly supported: boolean;
  readonly unsupportedReasons: readonly string[];
  readonly sourceRefs: readonly CapacitySourceRef[];
}

export interface SeasonalCapacityReference {
  readonly name: string;
  readonly voltageKv: number;
  readonly stationA: string;
  readonly stationB: string;
  readonly summerMVA: number | null;
  readonly winterMVA: number | null;
  readonly operationalCandidateMVA: number | null;
  readonly matched: boolean;
  readonly reason: string;
}

export interface LineCapacityMetadata {
  readonly quality: 'CAPACITY_UNAVAILABLE' | 'SECTION_LIMITED' | 'DGS_MAIN_TYPE';
  readonly typeId: string | null;
  readonly typeName: string | null;
  readonly nominalCurrentKA: number | null;
  readonly nominalMVA: number | null;
  readonly limitingSectionId: string | null;
  readonly sections: readonly CapacitySection[];
  readonly seasonalReference: SeasonalCapacityReference | null;
}

