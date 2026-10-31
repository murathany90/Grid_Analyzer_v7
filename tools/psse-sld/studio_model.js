/* Read-only indexes over source identities. Name candidates are explicitly
 * distinguished from a source isub relationship and never topology proof. */
function buildSldModelIndex(model,network){
  const equipment=new Map((model?.equipment||[]).map(e=>[e.id,e]));
  const names=(numbers,text)=>{
    const ids=model?.binaryArrays?.[numbers]?.values||[],packed=(model?.binaryArrays?.[text]?.values||[]).join('');
    const result=new Map(ids.map((id,i)=>[String(id),packed.slice(i*12,(i+1)*12).replace(/\0/g,'').trim()]));
    const [table,idField,nameField]=numbers==='Numown'?['OWNER','iowner','owname']:['AREA','iarea','arname'];
    for(const row of model?.sourceTables?.[table]||[])if(row[idField]!=null&&row[nameField]&&!result.get(String(row[idField])))result.set(String(row[idField]),String(row[nameField]));
    return result;
  };
  const ownerNames=names('Numown','Owname'),areaNames=names('Numare','Arnam');
  const stationById=new Map(),stationsByName=new Map(),stationBuses=new Map(),busStation=new Map(),busByNumber=new Map(),branchByMap=new Map(),devices=new Map();
  const normalized=s=>String(s??'').trim().toLocaleUpperCase('tr-TR');
  for(const e of equipment.values())if(e.kind==='substation'){
    const id=String(e.fields?.isub??e.id.replace(/^substation:/,''));stationById.set(id,e);stationBuses.set(id,{indices:[],provenance:'SOURCE_ISUB'});
    const name=normalized(e.name);if(!stationsByName.has(name))stationsByName.set(name,[]);stationsByName.get(name).push(id);
  }
  const sourceStations=new Map();for(const row of model?.sourceTables?.SUBSTATION_NODE||[])if(row.ibus!=null&&row.isub!=null){const key=String(row.ibus);if(!sourceStations.has(key))sourceStations.set(key,new Set());sourceStations.get(key).add(String(row.isub));}
  const pending=[];
  for(let i=0;i<(network?.buses||[]).length;i++){
    const b=network.buses[i],source=equipment.get(b.sourceEquipmentId);if(!b.source||!source)continue;
    busByNumber.set(String(b.externalNumber),b);busByNumber.set(String(b.connectionKey),b);
    const explicit=sourceStations.get(String(b.externalNumber));
    let id=source.fields?.isub==null?explicit?.size===1?[...explicit][0]:'':String(source.fields.isub),provenance='SOURCE_ISUB';
    if(!id){const matches=stationsByName.get(normalized(source.name))||[];if(matches.length===1)pending.push({id:matches[0],i,source});}
    if(stationById.has(id)){const group=stationBuses.get(id);group.indices.push(i);if(provenance!=='SOURCE_ISUB')group.provenance=provenance;busStation.set(i,id);}
  }
  const adjacent=new Map();for(const branch of network?.branches||[])for(const [a,b]of [[branch.from,branch.to],[branch.to,branch.from]]){if(!adjacent.has(a))adjacent.set(a,new Set());adjacent.get(a).add(b);}
  for(const candidate of pending){
    const {id,i,source}=candidate,group=stationBuses.get(id),anchors=group.indices.map(j=>equipment.get(network.buses[j].sourceEquipmentId));
    const peers=anchors.length?anchors:pending.filter(p=>p.id===id).map(p=>p.source);
    const owners=new Set(peers.map(e=>e.fields.owner)),areas=new Set(peers.map(e=>e.fields.area));
    const connected=group.indices.some(j=>adjacent.get(i)?.has(j));
    if(!connected&&(!owners.has(source.fields.owner)||!areas.has(source.fields.area)||(!anchors.length&&(owners.size>1||areas.size>1))))continue;
    group.indices.push(i);group.provenance=connected?'INFERRED_NAME_AND_CONNECTION':'INFERRED_EXACT_SOURCE_NAME';busStation.set(i,id);
  }
  for(const b of network?.branches||[]){
    const source=equipment.get(b.sourceEquipmentId),kind=source?.kind==='switch'?'SYS':source?.kind==='transformer'?'TR':'LI';
    const circuit=String(source?.fields?.ckt??b.windingId??'1').trim();
    for(const [from,to]of [[b.from,b.to],[b.to,b.from]]){
      const key=[kind,network.buses[from]?.externalNumber,network.buses[to]?.externalNumber,circuit].join(' ');
      if(!branchByMap.has(key))branchByMap.set(key,[]);branchByMap.get(key).push(b);
    }
  }
  for(const [kind,items,idField]of [['ME',network?.generators,'machid'],['LO',network?.loads,'loadid'],['FXS',network?.shunts,'shntid']])for(const d of items||[]){
    const source=equipment.get(d.sourceEquipmentId),key=[kind,network.buses[d.bus]?.externalNumber,String(source?.fields?.[idField]??d.sourceId??'1').trim()].join(' ');devices.set(key,d);
  }
  return {equipment,ownerNames,areaNames,stationById,stationBuses,busStation,busByNumber,branchByMap,devices,matches:new Map()};
}
