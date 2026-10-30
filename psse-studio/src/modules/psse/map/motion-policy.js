export function motionPolicy({requested=true,available=false,mode='p',zoom=1}){
  return {enabled:requested&&available&&(mode!=='q'||zoom>=1.7)};
}
// The caller supplies an identity-validated GA LF result. Never changes the value layer.
export function flowSource(result,mode='p'){
  return result?.branchResults?.some(r=>mode==='q'?
    [r.qFromMvar,r.qToMvar].some(v=>Number.isFinite(v)&&Math.abs(v)>=.1):
    Number.isFinite(r.pFromMw)&&Number.isFinite(r.pToMw)&&r.pFromMw*r.pToMw<0&&Math.abs(r.pFromMw)>=.15)?result:null;
}
