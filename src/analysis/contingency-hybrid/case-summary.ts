/** Numerical availability and control verification are separate outcomes. */
export function n1CaseOutcome(status:string){
  if(['CONVERGED','AC_CONVERGED_WITHIN_LIMIT','AC_CONVERGED_VIOLATION'].includes(status))return 'success';
  if(status==='PARTIAL_SOLUTION')return 'partial';
  if(['BLOCKED','DIVERGED','AC_DIVERGED','ISLAND_UNSUPPLIED','UNSUPPORTED_CONTROL_CONFIGURATION','NOT_COMPUTABLE'].includes(status))return 'skipped';
  if(status==='CANCELLED')return 'cancelled';
  return 'pending';
}
export function n1CaseCounts(cases:readonly {status:string}[]){
  const counts={success:0,partial:0,skipped:0,cancelled:0,pending:0};
  for(const c of cases)counts[n1CaseOutcome(c.status)]++;
  return counts;
}
