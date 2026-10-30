export const metricChoices=kind=>kind==='buses'?[['voltage','V'],['angle','Açı'],['voltage-angle','V-Açı']]:[['p-loading','P-Yük (%)'],['pq','P-Q'],['pq-loading','P-Q-Yük (%)']];
const c=(key,label,unit='',secondary)=>({key,label,unit,secondary});
export function resultColumns(kind,mode){
  if(kind==='generators')return [c('name','Jeneratör · TM'),c('p','P','MW'),c('q','Q','MVAr'),c('qState','Q durumu'),c('status','Durum')];
  if(kind==='buses')return [c('name','TM · Bara'),...(mode==='angle'?[]:[c('vKv','V','kV')]),...(mode==='voltage'?[]:[c('angle','Açı','°')]),c('status','Durum')];
  const q=mode!=='p-loading',load=mode!=='pq',trafo=kind==='transformers';
  return [...(trafo?[c('station','TM'),c('name','Trafo'),c('ratio','YG/AG','kV')]:[c('name','Hat')]),c('p',trafo?'YG P':'A P','MW',q?'q':null),c('pTo',trafo?'AG P':'B P','MW',q?'qTo':null),c('loss','Kayıp P','MW',q?'lossQ':null),...(load?[c('loading','Yük','%')]:[]),c('status','Durum')];
}
export function sortRows(rows,{key='name',desc=false}){
  const missing=v=>v==null||typeof v==='number'&&!Number.isFinite(v);
  return rows.sort((a,b)=>{const x=a[key],y=b[key];if(missing(x)!==missing(y))return missing(x)?1:-1;const order=missing(x)?0:typeof x==='number'&&typeof y==='number'?x-y:String(x).localeCompare(String(y),'tr',{numeric:true});return (desc?-order:order)||String(a.id).localeCompare(String(b.id),'en',{numeric:true});});
}
export function groupLoading(group,scenarioRows,baseRows,loading,diff){
  const max=rows=>{const values=group.map(b=>loading(b,rows.get(b.id)));return values.every(v=>typeof v==='number'&&Number.isFinite(v))?Math.max(...values):null;};
  const current=max(scenarioRows);if(!diff)return current;const base=max(baseRows);return current!=null&&base!=null?current-base:null;
}
