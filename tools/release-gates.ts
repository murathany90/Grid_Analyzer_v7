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
}

export const isFullGitSha=(value:string):boolean=>/^[0-9a-f]{40}$/i.test(value);

/** Every release requirement is a separate gate so a failed measurement cannot be hidden. */
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
  const gates:readonly [string,boolean][]=[
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
  const gates:readonly [string,boolean][]=[
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
  const failedGates=gates.filter(([,passed])=>!passed).map(([name])=>name);
  return{policy:'PRESERVE_VALIDATED_BASELINE',mergeReady:failedGates.length===0,failedGates};
}
