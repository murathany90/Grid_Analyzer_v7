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
}
export interface Generator extends Entity {
  readonly bus: string; readonly pMw: number; readonly qMvar: number;
  readonly vmSet: number; readonly voltageControl: boolean;
  readonly qMin: number | null; readonly qMax: number | null;
}
export interface Load extends Entity { readonly bus: string; readonly pMw: number; readonly qMvar: number; readonly activeBalanceEligibility?: boolean; readonly activeBalanceEligibilitySource?: 'native-scale'|'ElmLod.i_scale'|'ElmLod.scale0'; readonly activeBalanceEligibilityRaw?: number|string|null }
export interface Shunt extends Entity { readonly bus: string; readonly gPu: number; readonly bPu: number; readonly nominalQMvar?: number }
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
  readonly boundaries: readonly Entity[]; readonly sites: readonly Site[];
  readonly classCounts: Readonly<Record<string, number>>; readonly records: number;
  readonly warnings: readonly string[]; readonly capabilities: ModelCapabilities;
}
export type Equipment = Bus | Line | Transformer2W | Generator | Load | Shunt | SeriesCompensator | Switch | Site;
export function equipment(network: CanonicalNetwork): readonly Equipment[] {
  return [...network.lines, ...network.transformers, ...network.buses, ...network.generators, ...network.loads, ...network.switches];
}
