const finite=v=>typeof v==='number'&&Number.isFinite(v);
/** Results enumerate real source identities, including disconnected/out-of-service loads. */
export function loadResultRecords(network,equipment){
  const ids=new Set();
  return network.loads.map(load=>{
    const e=equipment.get(load.sourceEquipmentId),bus=network.buses[load.bus];
    if(!e||e.kind!=='load'||!bus||Number(e.fields.ibus)!==Number(bus.externalNumber)||!String(e.fields.loadid??'').trim()||ids.has(e.id))throw Error('PSSE_LOAD_RESULT_IDENTITY_MISMATCH');
    ids.add(e.id);return {kind:'load',load,e};
  });
}
export function loadResultValues(load,vm){
  const norm=(p,q)=>finite(p)&&finite(q)?Math.hypot(p,q):null;
  const component=(p,q,power)=>{const nominal=norm(p,q);return load.status===0?0:nominal===0?0:nominal!=null&&finite(vm)?nominal*vm**power:null;};
  const nominalP=load.pMw+load.ipMw+load.ypMw,nominalQ=load.qMvar+load.iqMvar+load.yqMvar;
  const variable=norm(load.ipMw,load.iqMvar)!==0||norm(load.ypMw,load.yqMvar)!==0;
  const actualTotal=load.status===0?0:!variable?norm(load.pMw,load.qMvar):finite(vm)?norm(load.pMw+load.ipMw*vm+load.ypMw*vm*vm,load.qMvar+load.iqMvar*vm+load.yqMvar*vm*vm):null;
  return {actualmva:load.status===0?0:norm(load.pMw,load.qMvar),nominalmva:norm(load.pMw,load.qMvar),constantcurrentactualmva:component(load.ipMw,load.iqMvar,1),constantcurrentnominalmva:norm(load.ipMw,load.iqMvar),constantadmittanceactualmva:component(load.ypMw,load.yqMvar,2),constantadmittancenominalmva:norm(load.ypMw,load.yqMvar),totalinserviceactualmva:actualTotal,totalinservicenominalmva:load.status===0?0:norm(nominalP,nominalQ),inservice:load.status};
}
export function nativeRatingColumn(label){
  const match=/^(KIS|YAZ|FIDER|KORUMA|ISLETM|DINAMI|RATE(\d+))\s*(Max\s*)?(%\s*)?\(I as MVA\)$/i.exec(String(label).trim());
  return match?{index:match[2]?Number(match[2])-1:['KIS','YAZ','FIDER','KORUMA','ISLETM','DINAMI'].indexOf(match[1].toUpperCase()),maximum:!!match[3],percentage:!!match[4]}:null;
}
export function nativeColumnAvailability(headers,records,rows){
  return headers.map((label,i)=>{
    if(rows.some(row=>row[i]!=null&&row[i]!==''))return null;
    const rate=nativeRatingColumn(label);
    if(rate?.percentage&&records.length&&records.every(r=>!(r.branch?.ratingsFromSource?.[rate.index]>0)))return {code:'ZERO_RATE',message:'RATE sıfır/yok; yüzde tanımsız.'};
    if(/^Winding 1 (Ratio|Angle) limit$/i.test(label))return {code:'NATIVE_CONTROL_SENTINEL',message:'Native Excel: -2; SAV alanına güvenilir eşleme yok.'};
    return null;
  });
}
