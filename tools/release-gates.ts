export interface ReleaseGateInput {
  populationMatches: boolean;
  kpis: readonly { id: string; n: number; baselineN: number | null; improvementPercent: number | null }[];
  activeBalanceConverged: boolean;
  stationControlConverged: boolean;
  unresolvedControllerCount: number;
  portableElapsedMs: number | null;
  portableStatus: string;
  portableSha256: string;
  committedPortableSha256: string | null;
  measuredPortableSha256: string;
  measuredGitSha: string;
  manifestGitSha: string;
  commitExists: boolean;
  measuredSourceMatchesCurrent: boolean;
  measuredInputsMatch: boolean;
  /** Signed diagnostics for the same population; evaluated as its own gate. */
  /**
   * Signed diagnostics for the same population, evaluated as its own gate.
   *
   * Under the default REQUIRED policy this input is mandatory: an absent or incomplete
   * `signed` fails the release. LEGACY_OPTIONAL exists only to re-verify an already
   * published historical manifest under its own policy.
   */
  signed?:Partial<ReleaseGateSignedInput>|null;
  signedPolicy?:SignedDiagnosticsPolicy;
}

export const isFullGitSha=(value:string):boolean=>/^[0-9a-f]{40}$/i.test(value);

/**
 * Signed-diagnostic gates that run alongside the primary magnitude KPI.
 *
 * The primary KPI is `abs(|GA| - |PF|)`, which is unchanged. A sign flip between GA and PF
 * contributes only the magnitude of the smaller side to that sum, so a large wrong-sign
 * flow can pass it. These gates exist so such an error cannot be hidden behind a
 * magnitude-only gate. They never alter the historical KPI numbers.
 */
export interface SignedKpiGateInput {
  signedSummary: {
    signDisagreementCount:number; signComparableCount:number;
    /** Mean of GA - PF, signed. */
    signedMeanError:number;
    maxP95AbsoluteError:number; maxAbsoluteError:number;
  };
  /** Baseline of the same model; when absent only absolute limits apply. */
  baselineSignedSummary?: { signDisagreementCount:number; maxP95AbsoluteError:number; maxAbsoluteError:number } | null;
  /**
   * Relative tolerance on p95 and max |GA-PF| against the baseline. These are wide because
   * the population is large; their purpose is to catch a new large-scale outlier, not to
   * gate small movements.
   */
  p95TolerancePercent?: number;
  maxTolerancePercent?: number;
}
export interface SignedKpiGateResult {
  signDisagreementNotIncreased:boolean;
  p95NotRegressed:boolean;
  maxNotRegressed:boolean;
  worstP95AbsoluteError:number;
  worstMaxAbsoluteError:number;
  /** Signed mean of GA - PF: a systematic bias a magnitude sum cannot express. */
  signedMeanError:number;
  tolerances:{p95Percent:number;maxPercent:number};
}
export function evaluateSignedKpiGates(input:SignedKpiGateInput):SignedKpiGateResult{
  const p95TolerancePercent=input.p95TolerancePercent??10,maxTolerancePercent=input.maxTolerancePercent??10;
  const {signedSummary,baselineSignedSummary}=input;
  const p95Limit=baselineSignedSummary?baselineSignedSummary.maxP95AbsoluteError*(1+p95TolerancePercent/100):Infinity;
  const maxLimit=baselineSignedSummary?baselineSignedSummary.maxAbsoluteError*(1+maxTolerancePercent/100):Infinity;
  return{
    signDisagreementNotIncreased:baselineSignedSummary?input.signedSummary.signDisagreementCount<=baselineSignedSummary.signDisagreementCount:input.signedSummary.signDisagreementCount>=0,
    p95NotRegressed:input.signedSummary.maxP95AbsoluteError<=p95Limit,
    maxNotRegressed:input.signedSummary.maxAbsoluteError<=maxLimit,
    worstP95AbsoluteError:input.signedSummary.maxP95AbsoluteError,
    worstMaxAbsoluteError:input.signedSummary.maxAbsoluteError,
    signedMeanError:input.signedSummary.signedMeanError,
    tolerances:{p95Percent:p95TolerancePercent,maxPercent:maxTolerancePercent},
  };
}

/** Every release requirement is a separate gate so a failed measurement cannot be hidden. */
/**
 * Signed-diagnostic gate input, evaluated alongside the primary magnitude gates.
 *
 * A sign flip contributes only the magnitude of the smaller side to the primary
 * `abs(|GA| - |PF|)` KPI, so a large wrong-sign flow can pass that gate. These values let
 * a release fail on such an error without changing the historical KPI definition.
 *
 * All four quantities are mandatory in the `opencode_fix` policy: absent signed data is
 * itself a failure, because a magnitude-only gate cannot see a wrong-sign error.
 */
export interface ReleaseGateSignedInput {
  signDisagreementCount:number;
  signDisagreementBaselineCount:number|null;
  /** Mean of GA - PF, signed. Mandatory so a systematic bias cannot hide behind a magnitude sum. */
  signedMeanError:number;
  maxP95AbsoluteError:number;
  maxP95Baseline:number|null;
  maxAbsoluteError:number;
  maxBaseline:number|null;
}
/**
 * Which signed diagnostics a run must supply.
 *
 * `REQUIRED` is the policy for any new validation or release run: missing signed data
 * fails the gate rather than passing it. `LEGACY_OPTIONAL` exists only so an already
 * published historical manifest can still be re-verified against its own policy; it must
 * not be used to sign off new work.
 */
export type SignedDiagnosticsPolicy='REQUIRED'|'LEGACY_OPTIONAL';
const SIGNED_FIELDS:Array<keyof ReleaseGateSignedInput>=['signDisagreementCount','signedMeanError','maxP95AbsoluteError','maxAbsoluteError'];
/** True when every mandatory signed quantity is present and finite. */
export function signedDiagnosticsComplete(input:Partial<ReleaseGateSignedInput>|null|undefined):boolean{
  if(!input)return false;
  return SIGNED_FIELDS.every(field=>{const value=input[field];return typeof value==='number'&&Number.isFinite(value);});
}
/**
 * Signed gate result.
 *
 * `pass` requires complete signed data under the REQUIRED policy. Under
 * LEGACY_OPTIONAL, absent data is tolerated for historical re-verification only.
 */
export interface SignedDiagnosticsGateResult{
  pass:boolean;
  policy:SignedDiagnosticsPolicy;
  complete:boolean;
  missing:Array<keyof ReleaseGateSignedInput>;
  signDisagreementNotIncreased:boolean|null;
  p95NotRegressed:boolean|null;
  maxNotRegressed:boolean|null;
  signedMeanError:number|null;
}
export function evaluateSignedDiagnosticsGate(input:Partial<ReleaseGateSignedInput>|null|undefined,policy:SignedDiagnosticsPolicy='REQUIRED'):SignedDiagnosticsGateResult{
  const missing=SIGNED_FIELDS.filter(field=>{const value=input?.[field];return typeof value!=='number'||!Number.isFinite(value);}) as Array<keyof ReleaseGateSignedInput>;
  const complete=missing.length===0;
  if(!complete)return{pass:policy==='LEGACY_OPTIONAL',policy,complete,missing,signDisagreementNotIncreased:null,p95NotRegressed:null,maxNotRegressed:null,signedMeanError:null};
  const value=input as ReleaseGateSignedInput;
  const signDisagreementNotIncreased=value.signDisagreementBaselineCount==null?null:value.signDisagreementCount<=value.signDisagreementBaselineCount;
  const p95NotRegressed=value.maxP95Baseline==null?null:value.maxP95Baseline<=0||value.maxP95AbsoluteError<=value.maxP95Baseline*1.1;
  const maxNotRegressed=value.maxBaseline==null?null:value.maxBaseline<=0||value.maxAbsoluteError<=value.maxBaseline*1.1;
  return{
    pass:signDisagreementNotIncreasing(signDisagreementNotIncreased)&&p95NotRegressed!==false&&maxNotRegressed!==false,
    policy,complete,missing,signDisagreementNotIncreased,p95NotRegressed,maxNotRegressed,signedMeanError:value.signedMeanError,
  };
}
const signDisagreementNotIncreasing=(value:boolean|null):boolean=>value!==false;

export function evaluateReleaseGates(input:ReleaseGateInput):{mergeReady:boolean;failedGates:string[];improvedCount:number} {
  const kpis=new Map(input.kpis.map(row=>[row.id,row]));
  const canonical=['lineActivePowerMw','lineReactivePowerMvar','transformerActivePowerMw','transformerReactivePowerMvar','busVoltageKv','busAlignedAngleDeg'];
  const complete=canonical.length===input.kpis.length&&kpis.size===canonical.length&&canonical.every(id=>{const row=kpis.get(id);return row&&row.n>0&&row.n===row.baselineN&&row.improvementPercent!=null&&Number.isFinite(row.improvementPercent);});
  const improvedCount=canonical.filter(id=>{const value=kpis.get(id)?.improvementPercent;return value!=null&&value<=-.1;}).length;
  const noRegression=complete&&canonical.every(id=>{const value=kpis.get(id)?.improvementPercent;return value!=null&&value<.5;});
  const lineQ=kpis.get('lineReactivePowerMvar')?.improvementPercent;
  const transformerQ=kpis.get('transformerReactivePowerMvar')?.improvementPercent;
  const qNoWorse=lineQ!=null&&transformerQ!=null&&lineQ<=0&&transformerQ<=0;
  const qImproved=lineQ!=null&&transformerQ!=null&&(lineQ<=-2||transformerQ<=-2);
  const validCommit=isFullGitSha(input.measuredGitSha)&&isFullGitSha(input.manifestGitSha)&&input.commitExists&&input.measuredGitSha.toLowerCase()===input.manifestGitSha.toLowerCase();
  const portableBytesMatch=/^[0-9a-f]{64}$/i.test(input.portableSha256)&&input.portableSha256===input.committedPortableSha256&&input.portableSha256===input.measuredPortableSha256;
  const gates:[string,boolean][]=[
    ['POPULATION_SIGNATURE',input.populationMatches],
    ['CANONICAL_KPI_POPULATION',complete],
    ['FIVE_OF_SIX_KPI_IMPROVEMENT',improvedCount>=5],
    ['NO_KPI_REGRESSION_0_5_PERCENT',noRegression],
    ['LINE_AND_TRANSFORMER_Q_NO_WORSE',qNoWorse],
    ['Q_KPI_IMPROVEMENT_2_PERCENT',qImproved],
    ['ACTIVE_BALANCE_CONVERGED',input.activeBalanceConverged],
    ['STATION_CONTROL_CONVERGED',input.stationControlConverged&&input.unresolvedControllerCount===0],
    ['PORTABLE_ELAPSED_15000_MS',input.portableStatus==='OK'&&input.portableElapsedMs!=null&&input.portableElapsedMs<=15000],
    ['COMMITTED_PORTABLE_BYTES',portableBytesMatch],
    ['MEASURED_COMMIT_SHA',validCommit],
    ['MEASURED_SOURCE_TREE',input.measuredSourceMatchesCurrent],
    ['MEASURED_INPUT_BYTES',input.measuredInputsMatch],
  ];
  // Mandatory by default: a run without complete signed diagnostics is not merge-ready,
  // because the magnitude-only primary KPI cannot detect a wrong-sign error.
  const signedPolicy=input.signedPolicy??'REQUIRED';
  const signedGate=evaluateSignedDiagnosticsGate(input.signed,signedPolicy);
  gates.push(['SIGNED_DIAGNOSTICS',signedGate.pass]);
  const failedGates=gates.filter(([,passed])=>!passed).map(([name])=>name);
  return{mergeReady:failedGates.length===0,failedGates,improvedCount};
}

/** Finalization policy: retain the validated v8.2.3 operating point and KPI quality. */
export interface BaselinePreservationGateInput extends ReleaseGateInput {
  baselineValidated: boolean;
  goldenInputsMatch: boolean;
  sl1PMw: number | null;
  sl1QMvar: number | null;
  sl1QMinMvar: number | null;
  sl1QLimitState: string | null;
  activeBalanceToleranceMw: number;
  qLimitToleranceMvar: number;
  stationControlStatus: string | null;
  stationPartialDisclosed: boolean;
  requiredValidationPassed: boolean;
}

export function evaluateBaselinePreservationGates(input:BaselinePreservationGateInput):{policy:'PRESERVE_VALIDATED_BASELINE';mergeReady:boolean;failedGates:string[]} {
  const canonical=['lineActivePowerMw','lineReactivePowerMvar','transformerActivePowerMw','transformerReactivePowerMvar','busVoltageKv','busAlignedAngleDeg'];
  const rows=new Map(input.kpis.map(row=>[row.id,row]));
  const complete=input.kpis.length===canonical.length&&rows.size===canonical.length&&canonical.every(id=>{
    const row=rows.get(id);
    return row!=null&&row.n>0&&row.n===row.baselineN&&row.improvementPercent!=null&&Number.isFinite(row.improvementPercent);
  });
  const regressionsPass=complete&&canonical.every(id=>rows.get(id)!.improvementPercent!<=0.5);
  const validCommit=isFullGitSha(input.measuredGitSha)&&isFullGitSha(input.manifestGitSha)&&input.commitExists&&input.measuredGitSha.toLowerCase()===input.manifestGitSha.toLowerCase();
  const portableBytesMatch=/^[0-9a-f]{64}$/i.test(input.portableSha256)&&input.portableSha256===input.committedPortableSha256&&input.portableSha256===input.measuredPortableSha256;
  const gates:[string,boolean][]=[
    ['VALIDATED_V823_BASELINE',input.baselineValidated],
    ['GOLDEN_INPUT_HASHES',input.goldenInputsMatch],
    ['POPULATION_SIGNATURE',input.populationMatches],
    ['CANONICAL_KPI_POPULATION',complete],
    ['SIX_KPI_RELATIVE_REGRESSION_0_5_PERCENT',regressionsPass],
    ['ACTIVE_BALANCE_CONVERGED',input.activeBalanceConverged],
    ['SL1_ACTIVE_P_TOLERANCE',input.sl1PMw!=null&&Number.isFinite(input.sl1PMw)&&Math.abs(input.sl1PMw)<=input.activeBalanceToleranceMw],
    ['SL1_QMIN_TOLERANCE',input.sl1QMvar!=null&&input.sl1QMinMvar!=null&&Number.isFinite(input.sl1QMvar)&&Number.isFinite(input.sl1QMinMvar)&&Math.abs(input.sl1QMvar-input.sl1QMinMvar)<=input.qLimitToleranceMvar],
    ['SL1_QMIN_LIMITED',input.sl1QLimitState==='QMIN_LIMITED'],
    ['STATION_PARTIAL_DISCLOSED',input.stationControlStatus!=='STATION_CONTROL_PARTIAL'||input.stationPartialDisclosed],
    ['PORTABLE_ELAPSED_15000_MS',input.portableStatus==='OK'&&input.portableElapsedMs!=null&&input.portableElapsedMs<=15000],
    ['COMMITTED_PORTABLE_BYTES',portableBytesMatch],
    ['MEASURED_COMMIT_SHA',validCommit],
    ['MEASURED_SOURCE_TREE',input.measuredSourceMatchesCurrent],
    ['MEASURED_INPUT_BYTES',input.measuredInputsMatch],
    ['REQUIRED_VALIDATION',input.requiredValidationPassed],
  ];
  // This function is the final verdict for the manifest, so it must carry the same
  // mandatory signed-diagnostics gate as `evaluateReleaseGates`. Without it a manifest
  // could report `signedGateRequired.pass = false` while `mergeReady = true`, because the
  // magnitude-only KPI cannot detect a wrong-sign error.
  const signedPolicy=input.signedPolicy??'REQUIRED';
  gates.push(['SIGNED_DIAGNOSTICS',evaluateSignedDiagnosticsGate(input.signed,signedPolicy).pass]);
  const failedGates=gates.filter(([,passed])=>!passed).map(([name])=>name);
  return{policy:'PRESERVE_VALIDATED_BASELINE',mergeReady:failedGates.length===0,failedGates};
}
