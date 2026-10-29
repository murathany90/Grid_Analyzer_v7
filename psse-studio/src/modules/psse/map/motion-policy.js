export function motionPolicy({requested=true,layer='calculated',available=false,mode='p',zoom=1}){
  return {enabled:requested&&layer==='calculated'&&available&&(mode!=='q'||zoom>=1.7)};
}
// The caller supplies only identity-validated LF results. Flow never starts a solver.
export function flowSource(layer,requested,result){
  return layer==='saved'&&requested&&result?.branchResults?.some(r=>
    Number.isFinite(r.pFromMw)&&Number.isFinite(r.pToMw)&&r.pFromMw*r.pToMw<0||
    [r.qFromMvar,r.qToMvar].some(v=>Number.isFinite(v)&&Math.abs(v)>=.1))?'calculated':layer;
}
