const finite=v=>typeof v==='number'&&Number.isFinite(v),networks=new WeakMap(),results=new WeakMap();
const groups=new WeakMap();
export function stationBusGroups(network,associations){let cached=groups.get(network);if(cached?.associations===associations)return cached.value;const byKey=new Map(network.buses.map((b,i)=>[b.connectionKey,i])),value=new Map();for(const a of associations){const i=byKey.get(a.connectionKey);if(i==null)continue;const key=String(a.stationIsub);if(!value.has(key))value.set(key,[]);value.get(key).push(i);}groups.set(network,{associations,value});return value;}
function networkIndex(network){let index=networks.get(network);if(!index){const connected=new Set();for(const b of network.branches)if(b.status===1){connected.add(b.from);connected.add(b.to);}for(const rows of [network.generators,network.loads,network.shunts])for(const e of rows)if(e.status===1)connected.add(e.bus);index={connected,positions:new Map(network.buses.map((b,i)=>[b,i]))};networks.set(network,index);}return index;}
function resultIndex(result){if(!result)return new Map();let index=results.get(result);if(!index){index=new Map(result.busResults.map(r=>[r.connectionKey,r]));results.set(result,index);}return index;}
/** Aggregate every associated physical bus. No representative/random bus defines a TM state. */
export function stationState(network,busIds,{result=null,baseResult=null,saved=false,sourceById=new Map()}={}){
  const buses=busIds.map(i=>network.buses[i]).filter(b=>b?.source),on=buses.filter(b=>b.status===1),topology=networkIndex(network),energized=on.filter(b=>topology.connected.has(topology.positions.get(b))),rows=resultIndex(result),voltages=[],angles=[];
  const measurements=[];let numeric=0;for(const b of on){const row=rows.get(b.connectionKey),valid=row?.id===b.id&&row.sourceEquipmentId===b.sourceEquipmentId,source=sourceById.get(b.sourceEquipmentId)?.fields;
    let vm=saved?source?.vm:valid?row.vmPu:null,va=saved?source?.va:valid?row.vaDeg:null;if(baseResult){const base=resultIndex(baseResult).get(b.connectionKey),same=base?.id===b.id&&base.sourceEquipmentId===b.sourceEquipmentId;vm=same&&finite(vm)&&finite(base.vmPu)?vm-base.vmPu:null;va=same&&finite(va)&&finite(base.vaDeg)?va-base.vaDeg:null;}measurements.push({id:b.id,sourceEquipmentId:b.sourceEquipmentId,baseKv:b.baseKv,vm,va,low:source?.nvlo,high:source?.nvhi});if(finite(vm)){numeric++;if(finite(b.baseKv))voltages.push(vm*b.baseKv);}if(finite(va))angles.push(va);
  }
  const service=!on.length?'OUT_OF_SERVICE':on.length<buses.length||energized.length<on.length?'PARTIAL':'IN_SERVICE',coverage=!on.length?'OUT_OF_SERVICE':!numeric?'NO_RESULT':numeric<on.length?'PARTIAL':'AVAILABLE';
  return {count:buses.length,active:on.length,energized:energized.length,numeric,service,coverage,voltages,angles,measurements,buses:buses.map(b=>({id:b.id,sourceEquipmentId:b.sourceEquipmentId,baseKv:b.baseKv,status:b.status})),kv:[...new Set(buses.map(b=>b.baseKv).filter(finite))].sort((a,b)=>b-a),status:service==='OUT_OF_SERVICE'?'Devre dışı':service==='PARTIAL'?'Kısmi servis':coverage==='NO_RESULT'?'Sonuç yok':coverage==='PARTIAL'?'Kısmi sonuç':'Serviste'};
}
export function stationRepresentative(state,metric='nominal',{delta=false}={}){
  const score=r=>metric==='va'?(finite(r.va)?Math.abs(r.va):null):metric==='vm'?(finite(r.vm)&&finite(r.baseKv)?(delta?Math.abs(r.vm):r.vm)*r.baseKv:null):metric==='violation'?(finite(r.vm)&&finite(r.low)&&r.low>0&&finite(r.high)&&r.high>0?Math.max(0,r.low-r.vm,r.vm-r.high):null):r.baseKv;
  const readings=metric==='nominal'?state.buses.map(b=>({...b,...state.measurements.find(r=>r.id===b.id)})):state.measurements;
  return readings.filter(r=>finite(score(r))).sort((a,b)=>score(b)-score(a)||String(a.id).localeCompare(String(b.id)))[0]??null;
}
