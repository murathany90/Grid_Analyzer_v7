export function resultStatus(result) {
  if(!result)return 'NOT_RUN';
  if(result.status==='BLOCKED'||result.physicsCoverage==='BLOCKED')return 'BLOCKED';
  if(result.status!=='CONVERGED')return 'PARTIAL';
  if(result.method==='LOSSLESS_DC'||result.physicsCoverage!=='SUPPORTED')return 'APPROXIMATE';
  return 'CONVERGED';
}
export function fullAcEvidence(result) {
  return resultStatus(result)==='CONVERGED'&&['NR_POLAR','FDNS_XB'].includes(result.method)&&Number.isFinite(result.maxPMismatchPu)&&Number.isFinite(result.maxQMismatchPu)&&result.maxPMismatchPu<=(result.options?.tolerancePu??1e-6)&&result.maxQMismatchPu<=(result.options?.tolerancePu??1e-6)&&!(result.unsolvedIslands?.length);
}
