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
}

export const isFullGitSha=(value:string):boolean=>/^[0-9a-f]{40}$/i.test(value);

/** Every release requirement is a separate gate so a failed measurement cannot be hidden. */
export function evaluateReleaseGates(input:ReleaseGateInput):{mergeReady:boolean;failedGates:string[];improvedCount:number} {
  const kpis=new Map(input.kpis.map(row=>[row.id,row]));
  const canonical=['lineActivePowerMw','lineReactivePowerMvar','transformerActivePowerMw','transformerReactivePowerMvar','busVoltageKv','busAlignedAngleDeg'];
  const complete=canonical.length===input.kpis.length&&canonical.every(id=>{const row=kpis.get(id);return row&&row.n>0&&row.n===row.baselineN&&row.improvementPercent!=null&&Number.isFinite(row.improvementPercent);});
  const improvedCount=input.kpis.filter(row=>row.improvementPercent!=null&&row.improvementPercent<=-.1).length;
  const noRegression=input.kpis.every(row=>row.improvementPercent!=null&&row.improvementPercent<.5);
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
  ];
  const failedGates=gates.filter(([,passed])=>!passed).map(([name])=>name);
  return{mergeReady:failedGates.length===0,failedGates,improvedCount};
}
