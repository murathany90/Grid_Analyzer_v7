import type { LineCapacityMetadata } from './capacity';

export interface SourceRef { readonly sourceClass: string; readonly sourceId: string; readonly field: string; readonly unit?: string }
export interface Entity {
  readonly id: string; readonly name: string; readonly sourceClass: string; readonly sourceId: string;
  readonly inService: boolean; readonly siteIds: readonly string[];
  readonly sourceRefs: Readonly<Record<string, readonly SourceRef[]>>;
}
export interface Bus extends Entity { readonly vnKv: number; readonly parentId: string }
export interface Line extends Entity {
  readonly from: string; readonly to: string; readonly vnKv: number; readonly lengthKm: number;
  readonly rOhm: number; readonly xOhm: number; readonly bSiemens: number;
  /** Solver display/rating field; use capacity metadata for nominal and seasonal loading limits. */
  readonly ratingMva: number | null; readonly capacity?: LineCapacityMetadata; readonly coordinates: readonly (readonly [number, number])[];
  readonly sections: number;
  readonly fastParameters?: { readonly rOhm:number; readonly xOhm:number; readonly bSiemens:number; readonly vnKv:number };
}
export interface Transformer2W extends Entity {
  readonly from: string; readonly to: string; readonly vnKv: number; readonly lvKv: number;
  readonly rPu: number; readonly xPu: number; readonly tap: number; readonly phase: number;
  readonly ratingMva: number; readonly tapPosition: number; readonly gPu: number; readonly bPu: number;
  readonly typeHvKv?:number;readonly typeLvKv?:number;readonly tapSide?:number;readonly relativeTapVoltage?:number;
  readonly tapSource?:'mTaps'|'dutap'|'none';
  /**
   * Whether the tap ratio came from the source. A fallback substitutes tap=1, which is a
   * physical change, so it is never silent.
   */
  readonly tapResolution?:'SOURCE_RESOLVED'|'FALLBACK_UNRESOLVED_RATIO'|'FALLBACK_OUT_OF_RANGE';
}
export interface Generator extends Entity {
  readonly bus: string; readonly pMw: number; readonly qMvar: number;
  /** Immutable source dispatch (pgini/qgini), independent of solved output. */
  readonly pDispatchMw?: number; readonly qDispatchMvar?: number;
  readonly vmSet: number; readonly voltageControl: boolean;
  readonly qMin: number | null; readonly qMax: number | null;
}
export interface Load extends Entity { readonly bus: string; readonly pMw: number; readonly qMvar: number; readonly activeBalanceEligibility?: boolean; readonly activeBalanceEligibilitySource?: 'native-scale'|'ElmLod.i_scale'|'ElmLod.scale0'; readonly activeBalanceEligibilityRaw?: number|string|null }
export interface Shunt extends Entity { readonly bus: string; readonly gPu: number; readonly bPu: number; readonly nominalQMvar?: number;
  readonly ratedVoltageKv?:number|null;readonly activeStepQMvar?:number|null;readonly tapEnabled?:boolean;
  readonly tapPosition?:number;readonly tapMaximum?:number;readonly tapValues?:readonly (number|null)[];
  readonly stepProvenance?:'mTaps'|'qrean'|'qcapn'|'INVALID_MTAPS'|'INVALID_RATING';
}
export interface SeriesCompensator extends Entity { readonly from: string; readonly to: string; readonly rOhm: number; readonly xOhm: number }
export interface ExternalGrid extends Load { readonly vmSet: number; readonly pMin?: number|null; readonly pMax?: number|null; readonly qMin?: number|null; readonly qMax?: number|null; readonly bustpRaw?: string; readonly modeInputRaw?: string }
export interface Switch extends Entity { readonly from: string; readonly to: string; readonly closed: boolean; readonly cubicleId?: string; readonly equipmentId?: string }
export interface StationController extends Entity {
  /** ElmTerm FID, resolved through ElectricalTopology at preparation time. */
  readonly remoteBus: string; readonly unitIds: readonly string[]; readonly vmSet: number;
  readonly unitRefs?: readonly {id:string;sourceClass:'ElmSym'|'ElmGenStat'|'UNRESOLVED';inService:boolean}[];
  /** Source cvqq percentages, aligned with unitIds when exported by DGS. */
  readonly qParticipationRaw?: readonly (number|null)[];
  readonly controlModeRaw?:number|null;readonly selectedBusModeRaw?:number|null;readonly distributionModeRaw?:number|null;readonly droopModeRaw?:number|null;
  readonly droopValueRaw?:number|null;/** Reactive rating in MVAr for this source profile. */readonly ratedPowerRaw?:number|null;readonly qSetpointRaw?:number|null;
  readonly measurementRefRaw?:string;readonly measurementCubicleRaw?:string;readonly qOrientationRaw?:number|null;
  readonly measurementSelfCubicle?:boolean;
  readonly modeSemantics?:'CURRENT_PROFILE_VOLTAGE_DISPATCH_P'|'UNSUPPORTED';
}
/**
 * Occurrences of source data that was substituted or excluded rather than solved.
 *
 * `PARTIAL` fidelity is the honest report when any count is non-zero: the corresponding
 * equipment does not carry source-exact physics.
 */
export interface SourceFidelity {
  /** Transformers whose tap ratio could not be resolved and was replaced by 1.0. */
  readonly transformerTapFallbackCount:number;
  readonly transformerTapFallbackIds:readonly string[];
  /** Branches dropped because a parameter was invalid or missing. */
  readonly droppedBranchCount:number;
  readonly droppedBranchIds:readonly string[];
  /** Generators that supply no reactive limit, so no bound is enforced for them. */
  readonly generatorMissingQLimitCount:number;
  /** Active shunts whose selected step is not resolvable from the source. */
  readonly invalidShuntStepCount:number;
  readonly fidelity:'SOURCE_EXACT'|'PARTIAL';
}
export interface Site extends Entity { readonly lat: number | null; readonly lon: number | null; readonly areaId: string; readonly areaName: string; readonly voltages: readonly number[] }
export interface ModelCapabilities { powerFlow: Capability; shortCircuit3Phase: Capability; shortCircuitGround: Capability; n1: Capability }
export interface Capability { state: 'READY' | 'PARTIAL' | 'BLOCKED'; reasons: readonly string[]; /** Machine-readable scope of what the capability actually covers. */ scope?: string }
export interface CanonicalNetwork {
  readonly schemaVersion: 1; readonly modelHash: string; readonly name: string; readonly size: number;
  readonly studyCase?:string;
  readonly baseMva: number; readonly buses: readonly Bus[]; readonly lines: readonly Line[];
  readonly transformers: readonly Transformer2W[]; readonly generators: readonly Generator[];
  readonly loads: readonly Load[]; readonly shunts: readonly Shunt[];
  readonly seriesCompensators: readonly SeriesCompensator[]; readonly externalGrids: readonly ExternalGrid[];
  readonly internationalConnections: readonly Load[]; readonly switches: readonly Switch[];
  readonly stationControllers: readonly StationController[]; readonly secondaryControllers: readonly Entity[];
  readonly unsupportedReactiveLimitClasses?: readonly {sourceClass:string;count:number;sourceIds:readonly string[]}[];
  readonly loadFlowOptionsRaw?: Readonly<Record<string,number|string|null>>;
  readonly loadFlowSettings?: Readonly<Record<string,number|string|null>>;
  readonly diagnostics?: readonly { readonly code:string; readonly message:string; readonly severity:'INFO'|'WARNING'|'ERROR'; readonly sourceClass?:string; readonly sourceId?:string }[];
  /**
   * Counts of values the source did not supply and that were not guessed. Every entry is a
   * physical substitution or exclusion, reported so a strict path can present PARTIAL.
   */
  readonly sourceFidelity?: SourceFidelity;
  readonly boundaries: readonly Entity[]; readonly sites: readonly Site[];
  readonly classCounts: Readonly<Record<string, number>>; readonly records: number;
  readonly warnings: readonly string[]; readonly capabilities: ModelCapabilities;
}
export type Equipment = Bus | Line | Transformer2W | Generator | Load | Shunt | SeriesCompensator | Switch | Site;
export function equipment(network: CanonicalNetwork): readonly Equipment[] {
  return [...network.lines, ...network.transformers, ...network.buses, ...network.generators, ...network.loads, ...network.switches];
}
