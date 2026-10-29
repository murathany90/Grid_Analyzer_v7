import {loadResultRecords,loadResultValues,nativeRatingColumn,nativeColumnAvailability} from '../model/native-results.js';
// Native column contract adapter. Excel is an oracle for tests, never a runtime data source.
const key=value=>String(value??'').toLowerCase().replace(/[^a-z0-9]/g,'');
const present=value=>value!==null&&value!==undefined&&value!=='';
const number=value=>typeof value==='number'&&Number.isFinite(value)?value:null;
const cache=new WeakMap();
export function nativeIndex(model,network){
  let byNetwork=cache.get(model);if(!byNetwork){byNetwork=new WeakMap();cache.set(model,byNetwork);}let index=byNetwork.get(network);if(index)return index;
  const arrays=model.binaryArrays??{},eq=new Map(model.equipment.map(e=>[e.id,e])),buses=new Map(model.equipment.filter(e=>e.kind==='bus').map(e=>[Number(e.fields.ibus),e]));
  const values=name=>arrays[name]?.values??[];
  const packed=new Map(),characters=name=>{if(!packed.has(name))packed.set(name,values(name).join(''));return packed.get(name);};
  const at=(name,i,component)=>{const a=arrays[name];if(!a||i==null||i<0)return null;let v=a.type==='CHAR'?characters(name).charAt(i):a.values[i];if(component!=null)v=v?.[component];return v==null||v===''?null:v;};
  const text=(name,i,width)=>characters(name).slice(i*width,(i+1)*width).replace(/\0/g,'').trim();
  const dictionaries=Object.fromEntries([['area','Numare','Arnam'],['zone','Numzon','Zoname'],['owner','Numown','Owname']].map(([kind,nums,names])=>[kind,new Map(values(nums).map((id,i)=>[Number(id),{id:Number(id),name:text(names,i,12),index:i}]))]));
  const busPosition=new Map(network.buses.map((b,i)=>[b,i])),fixedShunts=new Map();
  for(const s of network.shunts)if(s.selection==='FIXED'&&s.status===1){if(!fixedShunts.has(s.bus))fixedShunts.set(s.bus,[]);fixedShunts.get(s.bus).push(s);}
  index={model,network,eq,buses,arrays,values,at,text,dictionaries,busPosition,fixedShunts,networkBuses:new Map(network.buses.filter(b=>b.sourceEquipmentId).map(b=>[b.sourceEquipmentId,b])),flows:null,groups:new Map()};byNetwork.set(network,index);return index;
}
function sourceBus(index,e){return e.kind==='bus'?e:index.buses.get(Number(e.fields?.ibus));}
function winding(e){return e.fields?.windings?.[0]??{};}
function meteredNumber(index,f){
  if(number(f.meteredBus)!=null)return f.meteredBus;
  const internal=index.at('Imeter',Number(f.savBranchIndex??f.savIndex)-1);
  return number(internal)!=null?index.network.buses[Math.abs(internal)-1]?.externalNumber??null:null;
}
function meteredFlag(index,f){const bus=meteredNumber(index,f);if(bus!=null)return Number(Number(bus)===Number(f.ibus));const input=f.met??f.nmetr;return input===1?1:input===2?0:null;}
// Packed SAV I/O words use five octal digits; normalized network values stay on system base.
function transformerField(index,e,k){
  const cache=index.transformerFields??(index.transformerFields=new WeakMap());let prepared=cache.get(e);if(!prepared){
  const f=e.fields,w=winding(e),i=Number(f.savIndex)-1,word=w.packedSourceCodes;
  const code=shift=>Number.isInteger(word)?word>>shift&7:null;
  const cw=code(0)??f.cw,cz=code(3)??f.cz,cm=code(6)??f.cm;
  const from=index.buses.get(Number(f.ibus))?.fields,to=index.buses.get(Number(f.jbus))?.fields;
  const windingBase=number(w.mvaBase),factor=cz===2&&windingBase!=null?windingBase/index.network.baseMva:1;
  const ratio=(side,raw)=>{const r=side===1?w.ratioPu??f.windv1:w.secondaryRatioPu??f.windv2,b=side===1?from:to,n=side===1?w.nominalKv??f.nomv1:w.secondaryNominalKv??f.nomv2;if(r==null)return null;return !raw||cw===1?r:cw===2&&b?.baskv>0?r*b.baskv:cw===3&&b?.baskv>0&&n>0?r*b.baskv/n:null;};
  const enums={windingiocode:{1:'Turns ratio (pu)',2:'Winding voltage (kV)',3:'Ratio (pu of nominal)'},impedanceiocode:{1:'Zpu (system base)',2:'Zpu (winding base)',3:'Load loss & Z magnitude'},admittanceiocode:{1:'Admittance (pu)',2:'No load loss & exc. I'}};
  const fields={magnetizinggpuorwatts:cm===2&&number(f.mag1)!=null?f.mag1*index.network.baseMva*1e6*(w.nominalKv>0&&from?.baskv>0?(w.nominalKv/from.baskv)**2:1):f.mag1,magnetizingbpu:cm===2&&number(f.mag1)!=null&&number(f.mag2)!=null&&w.mvaBase>0?Math.hypot(f.mag1,f.mag2)*index.network.baseMva/w.mvaBase:f.mag2,winding1side:1,winding1number:f.ibus,winding2number:f.jbus,winding1name:index.buses.get(Number(f.ibus))?.name,winding2name:index.buses.get(Number(f.jbus))?.name,controlledbusname:index.buses.get(Number(w.controlledBus))?.name,wnd1tapratiopu:ratio(1,false),wnd2tapratiopu:ratio(2,false),wnd1tapratiopucw:ratio(1,true),wnd2tapratiopucw:ratio(2,true),wnd1ratiopuorkv:ratio(1,true),wnd2ratiopuorkv:ratio(2,true),wnd1basemva:w.mvaBase,windingmvabase:w.mvaBase,tapsteppu:w.tapPositions>1?(w.sourceRmax-w.sourceRmin)/(w.tapPositions-1):null,specifiedrpuorwatts:number(f.r1_2)!=null?f.r1_2*factor:null,specifiedxpu:number(f.x1_2)!=null?f.x1_2*factor:null,rtablecorrectedpuorwatts:number(f.r1_2)!=null?f.r1_2*factor:null,xtablecorrectedpu:number(f.x1_2)!=null?f.x1_2*factor:null};
    prepared={f,w,i,code,cw,cz,cm,factor,enums,fields};cache.set(e,prepared);
  }
  const {f,w,i,code,cw,cz,cm,factor,enums,fields}=prepared;
  if(enums[k])return enums[k][k==='windingiocode'?cw:k==='impedanceiocode'?cz:cm]??null;
  if(k in fields)return fields[k]??null;
  // These vector/connection codes are verified against matching I/J/CKT native records.
  if(k==='vectorgroup')return f.vectorGroup??({1:'YNyn0',3:'YNd1',19:'Dyn1',35:'Dd0',51:'YNa0'}[w.vectorGroupCode]??null);
  if(k==='connectioncode'){const c=index.at('Cnxcod',i),label={11:'Series path, no ground path',12:'No series path, ground winding 1',13:'No series path, ground winding 2',14:'No series or ground paths',16:'No series path, ground winding 1, earth winding 2',21:'Series path, no ground path'}[c];return label?c+' - '+label:c;}
  if(k==='leakageimpedanceiocode'||k==='groundingimpedanceiocode')return ({1:'Z pu (system base)',2:'Z pu (winding base)',3:'Z (ohms)'}[code(k==='leakageimpedanceiocode'?9:12)]??null);
  const seq={rg1:['Zgrnd0',i*2,0],xg1:['Zgrnd0',i*2,1],rg2:['Zgrnd0',i*2+1,0],xg2:['Zgrnd0',i*2+1,1],r01pu:['Zsere0',i*2,0],x01pu:['Zsere0',i*2,1],r02pu:['Zsere0',i*2+1,0],x02pu:['Zsere0',i*2+1,1],rnutrl:['Zntrl0',i,0],xnutrl:['Zntrl0',i,1]};
  if(seq[k]){const [name,position,component]=seq[k],v=index.at(name,position,component);return number(v)!=null?v*factor:null;}
  return undefined;
}
export function nativeField(index,e,label,fallback=()=>null){
  if(!e)return null;const f=e.fields??{},k=key(label),bus=sourceBus(index,e),bf=bus?.fields??{},w=winding(e),i=Number(f.savIndex)-1,base=index.network.baseMva;
  if(e.kind==='transformer'){const v=transformerField(index,e,k);if(v!==undefined)return v;}
  const dict=kind=>index.dictionaries[kind].get(Number(f[kind]??bf[kind]));
  if(['areanum','zonenum','ownernum'].includes(k))return f[k.slice(0,-3)]??bf[k.slice(0,-3)]??null;
  if(['areaname','zonename','ownername'].includes(k))return dict(k.slice(0,-4))?.name??null;
  if(k==='busname')return bus?.name??null;
  if(k==='substationname')return e.name??f.name??null;
  if(k==='groundingresistance')return f.srg??f.groundingResistance??null;
  if(k==='code')return f.savedJcode??bf.savedJcode??f.ide??bf.ide??null;
  const owner=/^(owner|fraction)([1-4])$/.exec(k);
  if(owner&&Array.isArray(f.owners))return f.owners[Number(owner[2])-1]?.[owner[1]==='owner'?'owner':'fraction']??0;
  const aliases={ploadmw:'pl',qloadmvar:'ql',iploadmw:'ip',iqloadmvar:'iq',yploadmw:'yp',yqloadmvar:'yq',gshuntmw:'gl',bshuntmvar:'bl',baseloaded:'baslod',machinecontrolmode:'wmod',renewablemachinepowerfactor:'wpf',rsourcepu:'zr',xsourcepu:'zx',rxtranpu:'rt',xxtranpu:'xt',groundingflag:'groundingFlag',regulatenodenumber:'nreg',regulatednodenumber:'nreg',regulatedbussection:'regConnectionKey',rmpct:'rmpct',rmpctpercent:'rmpct',controlledbus:'controlledBus',controllednodesnumber:'controlledNode',controllednodenumber:'controlledNode',tappositions:'tapPositions',controlmode:'controlMode',autoadjust:'autoAdjust',impedancetable:'correctionTable',wndconnectangledeg:'connectionAngle',windingiocode:'cw',impedanceiocode:'cz',admittanceiocode:'cm',vectorgroup:'vectorGroup'};
  if(aliases[k]){const name=aliases[k];if(present(f[name]))return f[name];if(present(w[name]))return w[name];}
  if(k==='vchedkv'||k==='vschedkv'){const reg=index.buses.get(Number(f.ireg))?.fields??bf;return number(f.vs)!=null&&number(reg.baskv)!=null?f.vs*reg.baskv:null;}
  if(k==='regulatedbusnumber')return f.ireg??f.regbus??w.controlledBus??null;
  if(k==='regulatedbusname')return index.buses.get(Number(f.ireg??f.regbus??w.controlledBus))?.name??null;
  if(k==='voltagekv')return number(bf.vm)!=null&&number(bf.baskv)!=null?bf.vm*bf.baskv:null;
  if(k==='scalable')return present(f.scale)?f.scale:f.scaleCode!=null?Number(f.scaleCode!=='N'):null;
  if(k==='interruptible')return present(f.intrpt)?f.intrpt:f.interruptibleCode!=null?Number(f.interruptibleCode==='I'):null;
  if(k==='distributedgenmw'||k==='distributedgenmvar')return f.distributedGenerationPu?.[k.endsWith('mw')?0:1]!=null?f.distributedGenerationPu[k.endsWith('mw')?0:1]*base:null;
  if(k==='distributedgenmode')return f.distributedGenerationMode??f.dgenm??null;
  if(k==='loadtype')return f.loadtype??(f.loadTypeIndex>0?index.text('Ldtypename',f.loadTypeIndex-1,12):null);
  if(e.kind==='generator'){
    const scalar={rpu:'Grpos',subtransientxpu:'Gxsubt',subtransientxpowerfactor:'Gxsubt',transientxpu:'Gxtrns',transientxpowerfactor:'Gxtrns',synchronousxpu:'Gxsync',synchronousxpowerfactor:'Gxsync',groundingzunits:'Ggrcod',referenceangledeg:'Grfdeg'};
    if(scalar[k]){const v=index.at(scalar[k],i);return scalar[k]==='Ggrcod'&&present(v)?Number(v):v;}
    const complex={rnegativepu:['Zsneg',0],xnegativepu:['Zsneg',1],rzeropu:['Zszero',0],xzeropu:['Zszero',1],groundingr:['Gxgrnd',0],groundingx:['Gxgrnd',1]};if(complex[k]){const [array,part]=complex[k],v=index.at(array,i,part),code=Number(index.at('Ggrcod',i));return array==='Gxgrnd'&&code===2&&number(v)!=null&&bf.baskv>0&&f.mbase>0?v*bf.baskv**2/f.mbase:v;}
  }
  if(e.kind==='load'){
    const sequence={pnegmw:['Loadn',0],qnegmvar:['Loadn',1],pzeromw:['Loadz',0],qzeromvar:['Loadz',1]};if(sequence[k]){const v=index.at(sequence[k][0],i,sequence[k][1]);return number(v)!=null?v*base:null;}if(k==='groundingflag'){const v=index.at('Lgrcod',i);return present(v)?Number(v):null;}
  }
  if(e.kind==='shunt'&&['gzeromw','bzeromvar'].includes(k)){const v=index.at('Shntzr',i,k==='gzeromw'?0:1);return number(v)!=null?v*base:null;}
  if(e.kind==='line'){
    const pair={rzeropu:['Gbz',0],xzeropu:['Gbz',1]};
    if(pair[k]){const z=index.at(pair[k][0],i);if(!Array.isArray(z))return null;const d=z[0]**2+z[1]**2;return d>0?(k==='rzeropu'?-z[0]:z[1])/d:null;}
    if(k==='bzeropu'){const v=index.at('B2sz',i);return number(v)!=null?2*v:null;}
    const endpoint={zeroseqgfrompu:0,zeroseqbfrompu:1,zeroseqgtopu:2,zeroseqbtopu:3};if(k in endpoint){const all=index.values('Gbzlin'),row=all[i*2+Math.floor(endpoint[k]/2)];return row?.[endpoint[k]%2]??null;}
    if(k==='movratedcurrentka'){const v=index.at('Movcur',i);return number(v)!=null&&bf.baskv>0?v*base/(Math.sqrt(3)*bf.baskv):null;}if(k==='protectionmode')return index.at('Sctypf',i);
  }
  if(e.kind==='switch'&&/^(rate_s|rate_i|rate_f)/i.test(label)){return f['rate'+({ratesmva:1,rateiamp:2,ratefamp:3}[k])]??null;}
  if(e.kind==='transformer'){
    const direct={rmaxpukvdeg:'sourceRmax',rminpukvdeg:'sourceRmin',vmaxpumvarmw:'vmax',vminpumvarmw:'vmin',loaddropcomprpu:0,loaddropcompxpu:1};
    if(k in direct){const name=direct[k];return typeof name==='number'?w.compensation?.[name]??null:w[name]??null;}
    if(k==='metered')return meteredFlag(index,f);
    if(k==='controlledbusside')return w.controlledBusSign??null;
    if(k==='autoadjust')return index.at('Tpnabl',i);
    if(k==='rtablecorrectedpuorwatts')return f.r1_2??null;if(k==='xtablecorrectedpu')return f.x1_2??null;
  }
  if(e.kind==='other'&&f.subtype==='voltage-droop'){
    if(k==='regulatedbusnumber')return f.regbus??null;
    if(k==='vhighdeadband')return f.vdbhigh??null;if(k==='vlowdeadband')return f.vdblow??null;
  }
  if(k==='metered'&&['line','switch'].includes(e.kind))return meteredFlag(index,f);
  return fallback(e,label);
}
const multiply=(a,b)=>[a[0]*b[0]-a[1]*b[1],a[0]*b[1]+a[1]*b[0]];
const plus=(a,b)=>[a[0]+b[0],a[1]+b[1]];
export function savedFlows(index){
  if(index.flows)return index.flows;const {network}=index,flows=new Map();
  const voltage=bus=>number(bus.initialVm)!=null&&number(bus.initialVaDeg)!=null?[bus.initialVm*Math.cos(bus.initialVaDeg*Math.PI/180),bus.initialVm*Math.sin(bus.initialVaDeg*Math.PI/180)]:null;
  for(const branch of network.branches){
    const from=network.buses[branch.from],to=network.buses[branch.to],vf=voltage(from),vt=voltage(to),source=index.eq.get(branch.sourceEquipmentId),sw=source?.fields?.switchIndex;
    let pf=null,qf=null,pt=null,qt=null;
    if(branch.status===0){pf=qf=pt=qt=0;}
    else if(sw>0){const v=index.at('Zflow',sw-1);if(Array.isArray(v)){pf=v[0]*network.baseMva;qf=v[1]*network.baseMva;pt=-pf;qt=-qf;}}
    else if(vf&&vt&&branch.yff&&branch.yft&&branch.ytf&&branch.ytt){
      const current=(a,b)=>plus(multiply(vf,[a.re,a.im]),multiply(vt,[b.re,b.im])),i=current(branch.yff,branch.yft),j=current(branch.ytf,branch.ytt),s=multiply(vf,[i[0],-i[1]]),t=multiply(vt,[j[0],-j[1]]);pf=s[0]*network.baseMva;qf=s[1]*network.baseMva;pt=t[0]*network.baseMva;qt=t[1]*network.baseMva;
    }
    const amps=(p,q,bus,v)=>number(p)!=null&&number(q)!=null&&bus.baseKv>0&&v?Math.hypot(p,q)*1000/(Math.sqrt(3)*bus.baseKv*Math.hypot(...v)):null;
    const z2=branch.rPu**2+branch.xPu**2,phase=-(branch.phaseDeg??0)*Math.PI/180;
    const va=vf?multiply(vf,[Math.cos(phase)/(branch.tapFrom??1),Math.sin(phase)/(branch.tapFrom??1)]):null,vb=vt?vt.map(v=>v/(branch.tapTo??1)):null;
    const seriesI2=branch.status===0||sw>0?0:va&&vb&&z2>0?((va[0]-vb[0])**2+(va[1]-vb[1])**2)/z2:null;
    flows.set(branch.id,{pFromMw:pf,qFromMvar:qf,pToMw:pt,qToMvar:qt,pLossMw:number(pf)!=null&&number(pt)!=null?pf+pt:null,qLossMvar:number(qf)!=null&&number(qt)!=null?qf+qt:null,seriesPLossMw:seriesI2!=null?seriesI2*branch.rPu*network.baseMva:null,seriesQLossMvar:seriesI2!=null?seriesI2*branch.xPu*network.baseMva:null,iFromA:amps(pf,qf,from,vf),iToA:amps(pt,qt,to,vt)});
  }
  index.flows=flows;return flows;
}
function voltageData(index,bus,result,saved){const f=index.eq.get(bus.sourceEquipmentId)?.fields??{};return {vm:saved?number(f.vm):number(result?.vmPu),angle:saved?number(f.va):number(result?.vaDeg),f};}
function busBalances(index,result,saved){
  const stamp=saved?'saved':result?.id;if(index.balanceStamp===stamp&&index.balances)return index.balances;
  const net=index.network,flows=saved?savedFlows(index):new Map(result?.branchResults?.map(r=>[r.id,r])??[]),genResults=new Map(result?.generatorResults?.map(r=>[r.id,r])??[]),busResults=new Map(result?.busResults?.map(r=>[r.connectionKey,r])??[]);
  const rows=net.buses.map(b=>({p:0,q:0,negativeP:0,negativeQ:0,zeroP:0,zeroQ:0,vm:saved?number(b.initialVm):number(busResults.get(b.connectionKey)?.vmPu),valid:true}));
  for(const g of net.generators)if(g.status===1){const r=saved?g:genResults.get(g.id),b=rows[g.bus];if(number(r?.pMw)==null||number(r?.qMvar)==null)b.valid=false;else{b.p+=r.pMw;b.q+=r.qMvar;}}
  for(const l of net.loads)if(l.status===1){const b=rows[l.bus],v=b.vm,e=index.eq.get(l.sourceEquipmentId);if(v==null)b.valid=false;else{b.p-=l.pMw+l.ipMw*v+l.ypMw*v*v;b.q-=l.qMvar+l.iqMvar*v+l.yqMvar*v*v;}for(const [prop,label]of [['negativeP','P Neg (MW)'],['negativeQ','Q Neg (Mvar)'],['zeroP','P Zero (MW)'],['zeroQ','Q Zero (Mvar)']]){const n=nativeField(index,e,label);if(n==null)b[prop]=null;else if(b[prop]!=null)b[prop]+=n;}}
  for(const s of net.shunts)if(s.status===1){const b=rows[s.bus];if(b.vm==null)b.valid=false;else{b.p-=s.gMw*b.vm*b.vm;b.q+=s.bMvar*b.vm*b.vm;}}
  for(const br of net.branches)if(br.status===1){const r=flows.get(br.id);for(const [bi,p,q]of [[br.from,r?.pFromMw,r?.qFromMvar],[br.to,r?.pToMw,r?.qToMvar]]){const b=rows[bi];if(number(p)==null||number(q)==null)b.valid=false;else{b.p-=p;b.q-=q;}}}
  index.balanceStamp=stamp;index.balances=rows;return rows;
}
function groupsFor(index,kind,result,saved){
  const stamp=kind+'|'+(saved?'saved':result?.id??'none');if(index.groups.has(stamp))return index.groups.get(stamp);
  const {network}=index,dictionary=index.dictionaries[kind],flows=saved?savedFlows(index):new Map(result?.branchResults?.map(r=>[r.id,r])??[]),genResults=new Map(result?.generatorResults?.map(r=>[r.id,r])??[]),busResults=new Map(result?.busResults?.map(r=>[r.connectionKey,r])??[]),groups=[];
  for(const [id,definition]of dictionary){
    const ownBus=b=>Number(index.eq.get(b.sourceEquipmentId)?.fields?.[kind])===id,bs=network.buses.filter(b=>b.source&&ownBus(b)),busSet=new Set(bs.map(b=>index.busPosition.get(b))),generators=network.generators.filter(g=>busSet.has(g.bus)),loads=network.loads.filter(l=>busSet.has(l.bus)),activeLoads=loads.filter(l=>l.status===1),ownerMachines=network.generators.filter(g=>index.eq.get(g.sourceEquipmentId)?.fields?.owners?.some(o=>Number(o.owner)===id)),ownerBranches=network.branches.filter(b=>index.eq.get(b.sourceEquipmentId)?.fields?.owners?.some(o=>Number(o.owner)===id));
    const vm=load=>{const b=network.buses[load.bus];return saved?number(b.initialVm):number(busResults.get(b.connectionKey)?.vmPu);};
    const loadSum=(property,actual)=>{if(!saved&&!result)return null;let total=0;for(const l of activeLoads){const v=vm(l);if(actual&&v==null)return null;total+=(l[property]??0)+(l[property==='pMw'?'ipMw':'iqMvar']??0)*(actual?v:1)+(l[property==='pMw'?'ypMw':'yqMvar']??0)*(actual?v*v:1);}return total;};
    const genSum=(list,property,weighted=false)=>{if(!saved&&!result)return null;let sum=0;for(const g of list){if(g.status!==1)continue;const r=saved?g:genResults.get(g.id),v=number(r?.[property]);if(v==null)return null;const weight=weighted?index.eq.get(g.sourceEquipmentId).fields.owners.find(o=>Number(o.owner)===id).fraction:1;sum+=v*weight;}return sum;};
    const branchList=kind==='owner'?ownerBranches:network.branches.filter(b=>busSet.has(b.from)||busSet.has(b.to));
    const loss=prop=>{if(!saved&&!result)return null;let total=0;for(const b of branchList){if(b.status!==1)continue;const row=flows.get(b.id),v=number(row?.[saved?(prop==='pLossMw'?'seriesPLossMw':'seriesQLossMvar'):prop]);if(v==null)return null;const weight=kind==='owner'?(index.eq.get(b.sourceEquipmentId)?.fields?.owners?.find(o=>Number(o.owner)===id)?.fraction??null):kind==='zone'?Number(busSet.has(b.from)):Number(busSet.has(Number(network.buses[b.from].externalNumber)===meteredNumber(index,index.eq.get(b.sourceEquipmentId).fields)?b.to:b.from));if(weight==null)return null;total+=v*weight;}return total;};
    const interchange=reactive=>{if(!saved&&!result)return null;let total=0;for(const br of branchList){if(br.status!==1||busSet.has(br.from)===busSet.has(br.to))continue;const row=flows.get(br.id),mf=Number(network.buses[br.from].externalNumber)===meteredNumber(index,index.eq.get(br.sourceEquipmentId).fields),v=number(row?.[reactive?(mf?'qFromMvar':'qToMvar'):(mf?'pFromMw':'pToMw')]);if(v==null)return null;total+=v*(busSet.has(mf?br.from:br.to)?1:-1);}return total;};
    const pgen=genSum(generators,'pMw'),qgen=genSum(generators,'qMvar'),pl=loadSum('pMw',true),ql=loadSum('qMvar',true),ploss=loss('pLossMw'),qloss=loss('qLossMvar');
    const values={areanum:id,areaname:definition.name,ownernum:id,ownername:definition.name,zonenum:id,zonename:definition.name,areaswingbus:index.at('Iswing',definition.index),desiredinterchangemw:number(index.at('Desint',definition.index))!=null?index.at('Desint',definition.index)*network.baseMva:null,tolerancemw:number(index.at('Destol',definition.index))!=null?index.at('Destol',definition.index)*network.baseMva:null,numberofbuses:bs.length,numberofloads:loads.length,numberofmachines:kind==='owner'?ownerMachines.length:generators.length,numberofindmachines:index.values('Imnext').length?null:0,numberofdcbuses:index.values('Ipr').length||index.values('Vscmode').length?null:0,numberofbranches:ownerBranches.length,numberoffactsdevices:index.values('Fcstat').length?null:0,numberofvscdclines:index.values('Vscmode').length?null:0,numberofdclines:index.values('Ipr').length?null:0,ploadmw:pl,qloadmvar:ql,ploadldmw:pl,qloadldmvar:ql,pgenmw:pgen,qgenmvar:qgen,activepwrofmacsmw:kind==='owner'?genSum(ownerMachines,'pMw',true):pgen,reactivepwrofmacsmvar:kind==='owner'?genSum(ownerMachines,'qMvar',true):qgen,activepwrofindmacsonbusesmw:index.values('Imnext').length?null:0,reactivepwrofindmacsonbusesmvar:index.values('Imnext').length?null:0,activepwrofindmacsmw:index.values('Imnext').length?null:0,reactivepwrofindmacsmvar:index.values('Imnext').length?null:0,activepowerlossesmw:ploss,rectivepowerlossesmvar:qloss,activepowernetinterchangemw:interchange(false),rectivepowernetinterchangemvar:interchange(true)};
    if(kind==='owner'&&!bs.length&&!ownerMachines.length&&!ownerBranches.length&&!loads.length)continue;groups.push(values);
  }
  index.groups.set(stamp,groups);return groups;
}
export function installNativeTables(ctx){
  const previousField=ctx.tableField,previousDataset=ctx.liveDataset;
  ctx.nativeResultSource='saved';
  ctx.tableField=(e,label)=>nativeField(nativeIndex(ctx.sources(),ctx.ga.psseNetwork),e,label,previousField);
  ctx.liveDataset=(cfg,section)=>{
    const model=ctx.sources(),base=ctx.ga.psseNetwork,headers=cfg.columns,saved=ctx.nativeResultSource!=='ga',result=saved?null:ctx.result(),network=section==='nd'||saved?base:ctx.ga.engine?.fs(base,ctx.ga.psseScenario)??base,index=nativeIndex(model,network);
    if(section==='nd'){
      const data=['Plant','Area','Owner','Zone'].includes(cfg.name)?{headers,rows:[],source:'NATIVE_SAV',note:''}:previousDataset(cfg,section);if(cfg.name==='Swith. Dev. Ratings')data.rows.length=Math.min(data.rows.length,index.values('Swdrate').length/12);
      if(['Machine','AC Line','2 Winding'].includes(cfg.name)){const kind=cfg.name==='Machine'?'generator':cfg.name==='AC Line'?'line':'transformer',items=model.equipment.filter(e=>e.kind===kind);for(let row=0;row<items.length;row++)for(let slot=1;slot<=4;slot++){if(!items[row].fields.owners?.[slot-1]){const column=headers.findIndex(h=>key(h)==='fraction'+slot);if(column>=0)data.rows[row][column]=1;}}}
      if(['Area','Owner','Zone'].includes(cfg.name)){const kind=cfg.name.toLowerCase();data.rows=[...index.dictionaries[kind].values()].map(d=>headers.map(h=>{const k=key(h);if(k===kind+'num')return d.id;if(k===kind+'name')return d.name;if(cfg.name==='Area'){const i=d.index;return k==='areaswingbus'?index.at('Iswing',i):k==='desiredinterchangemw'?index.at('Desint',i)*network.baseMva:k==='tolerancemw'?index.at('Destol',i)*network.baseMva:null;}return null;}));}
      if(cfg.name==='Plant'){
        const byBus=new Map();for(const g of network.generators){if(!byBus.has(g.bus))byBus.set(g.bus,[]);byBus.get(g.bus).push(g);}
        data.rows=[...byBus].map(([busId,gs])=>{const b=network.buses[busId],source=index.eq.get(gs[0].sourceEquipmentId),f=source.fields,bus=index.eq.get(b.sourceEquipmentId);return headers.map(h=>{const k=key(h),sum=prop=>gs.filter(g=>g.status===1).reduce((sum,g)=>sum+(g[prop]??0),0);return k==='busnumber'?b.externalNumber:k==='busname'?bus.name:k==='pgenmw'?sum('pMw'):k==='qgenmvar'?sum('qMvar'):k==='qmaxmvar'?(number(index.at('Qmax',f.plantIndex-1))!=null?index.at('Qmax',f.plantIndex-1)*network.baseMva:sum('qMaxMvar')):k==='qminmvar'?(number(index.at('Qmin',f.plantIndex-1))!=null?index.at('Qmin',f.plantIndex-1)*network.baseMva:sum('qMinMvar')):k==='voltagekv'?(()=>{const reg=index.buses.get(Number(f.ireg))?.fields;return reg?.vm!=null?reg.vm*reg.baskv:null;})():nativeField(index,source,h,previousField);});});
      }
      if(cfg.name==='Swith. Dev. Ratings'){const raw=index.values('Rsetdesc').join('');for(let i=0;i<data.rows.length;i++){const record=raw.slice(i*20,(i+1)*20),length=record.charCodeAt(0)|record.charCodeAt(1)<<8;for(let j=0;j<12;j++)data.rows[i][j+2]=index.at('Swdrate',i+j*data.rows.length);data.rows[i][1]=length>0&&length<=16?record.slice(4,4+length).replace(/\0/g,'').trim():null;}}
      return data;
    }
    const source=saved?'SOURCE_SAVED_DERIVED':'GA_PSSE_CALCULATED';
    if(!saved&&(!result||result.status!=='CONVERGED'||result.physicsCoverage==='BLOCKED'||!ctx.ga.engine?.Wo(result,{sourceSha256:model.source.sha256,network:base,effectiveNetwork:network,scenario:ctx.ga.psseScenario})))return {headers,rows:[],source:'NOT_RUN',note:'Güncel ve yayımlanabilir GA sonucu yok.'};
    const busResults=new Map(result?.busResults?.map(r=>[r.connectionKey,r])??[]),flows=saved?savedFlows(index):new Map(result?.branchResults?.map(r=>[r.id,r])??[]),gens=new Map(result?.generatorResults?.map(r=>[r.id,r])??[]);
    if(['Owner','Area','Zone'].includes(cfg.name))return {headers,rows:groupsFor(index,cfg.name.toLowerCase(),result,saved).map(row=>headers.map(h=>row[key(h)]??null)),source,note:saved?'SAV sözlükleri ve kayıtlı işletme değerleri; çözüm çalıştırılmadı.':''};
    let records=[];
    if(cfg.name==='BUS')records=network.buses.filter(b=>b.source).map(bus=>({kind:'bus',bus,e:index.eq.get(bus.sourceEquipmentId)}));
    if(cfg.name==='AC Line'||cfg.name==='2 Winding')records=network.branches.filter(b=>cfg.name==='AC Line'?b.kind==='line':b.kind==='transformer'||b.kind==='three-winding-leg').map(branch=>({kind:'branch',branch,e:index.eq.get(branch.sourceEquipmentId)}));
    if(cfg.name==='Machine')records=network.generators.map(gen=>({kind:'gen',gen,e:index.eq.get(gen.sourceEquipmentId)}));
    if(cfg.name==='Load')records=loadResultRecords(network,index.eq);
    if(cfg.name==='Fixed Shunt')records=network.shunts.filter(s=>s.selection==='FIXED').map(shunt=>({kind:'shunt',shunt,e:index.eq.get(shunt.sourceEquipmentId)}));
    if(cfg.name==='Plant'||cfg.name==='Limit Plant'){const map=new Map();for(const g of network.generators){if(!map.has(g.bus))map.set(g.bus,[]);map.get(g.bus).push(g);}records=[...map].map(([i,gs])=>({kind:'plant',bus:network.buses[i],units:gs,e:index.eq.get(gs[0].sourceEquipmentId)}));}
    const rows=records.map(rec=>headers.map((h,columnIndex)=>{
      const k=key(h),{e}=rec,f=e.fields,b=rec.bus??network.buses[rec.gen?.bus??rec.load?.bus??rec.shunt?.bus??rec.branch?.from],vb=voltageData(index,b,busResults.get(b.connectionKey),saved),base=b.baseKv;
      if(rec.kind==='plant'&&cfg.name==='Limit Plant'&&columnIndex>7&&['busnumber','basekv','voltagepu'].includes(k)){const remote=index.buses.get(Number(f.ireg)),rb=remote?index.networkBuses.get(remote.id):b;return k==='busnumber'?f.ireg??null:k==='basekv'?remote?.fields.baskv??null:rb?voltageData(index,rb,busResults.get(rb.connectionKey),saved).vm:null;}
      if(k==='busnumber')return b.externalNumber;if(k==='busname')return index.eq.get(b.sourceEquipmentId)?.name??null;
      if(['voltagepu','voltagekv','anglerad','angledeg','basekv'].includes(k))return k==='basekv'?base:k==='voltagepu'?vb.vm:k==='voltagekv'?vb.vm!=null&&base!=null?vb.vm*base:null:k==='anglerad'?vb.angle!=null?vb.angle*Math.PI/180:null:vb.angle;
      if(rec.kind==='bus'){
        const balance=busBalances(index,result,saved)[index.busPosition.get(b)],sequence={inserviceloadnegativemw:'negativeP',inserviceloadnegativemvar:'negativeQ',inserviceloadzeromw:'zeroP',inserviceloadzeromvar:'zeroQ'};if(sequence[k])return balance[sequence[k]];if(k==='mismatchmwkv'||k==='mismatchmvarkv')return balance.valid?(k==='mismatchmwkv'?balance.p:balance.q):null;
        const limits={normalvmaxpu:'nvhi',normalvminpu:'nvlo',emergencyvmaxpu:'evhi',emergencyvminpu:'evlo'};if(limits[k])return vb.f[limits[k]]??null;
        if(k==='voltagepur'||k==='voltagepux')return vb.vm!=null&&vb.angle!=null?vb.vm*(k==='voltagepur'?Math.cos(vb.angle*Math.PI/180):Math.sin(vb.angle*Math.PI/180)):null;
        if(k.startsWith('fixedshunt')){const shunts=(index.fixedShunts.get(index.busPosition.get(b))??[]),reactive=k.includes('mvar'),nominal=k.includes('nominal');if(!nominal&&vb.vm==null)return null;return shunts.reduce((sum,s)=>sum+(reactive?-s.bMvar:s.gMw),0)*(nominal?1:vb.vm**2);}
      }
      if(rec.kind==='branch'){
        const br=rec.branch,r=flows.get(br.id),a=network.buses[br.from],to=network.buses[br.to],meter=Number(meteredNumber(index,f)??a.externalNumber),nonmeter=meter===Number(a.externalNumber)?to:a;
        const fields={frombusnumber:a.externalNumber,tobusnumber:to.externalNumber,frombusname:index.eq.get(a.sourceEquipmentId)?.name,tobusname:index.eq.get(to.sourceEquipmentId)?.name,id:f.ckt??null,name:e.name,inservice:br.status,meteredbusnumber:meter,meteredbusname:index.buses.get(meter)?.name,nonmeteredbusnumber:nonmeter.externalNumber,nonmeteredbusname:index.eq.get(nonmeter.sourceEquipmentId)?.name,activemw:r?.pFromMw,reactivemvar:r?.qFromMvar,activelossesmw:r?.pLossMw,reactivelossesmvar:saved?r?.seriesQLossMvar:r?.qLossMvar,ampscurrent:r?.iFromA,pucurrent:r?.iFromA!=null&&a.baseKv>0?r.iFromA/(network.baseMva*1000/(Math.sqrt(3)*a.baseKv)):null};if(k in fields)return fields[k]??null;
        if(k==='frombusflowmva')return number(r?.pFromMw)!=null&&number(r?.qFromMvar)!=null?Math.hypot(r.pFromMw,r.qFromMvar):null;if(k==='frombusmaxflowmva')return number(r?.pFromMw)!=null&&number(r?.pToMw)!=null?Math.max(Math.hypot(r.pFromMw,r.qFromMvar),Math.hypot(r.pToMw,r.qToMvar)):null;
        const slot=nativeRatingColumn(h);if(slot){const rate=br.ratingsFromSource?.[slot.index];if(!slot.percentage)return rate??null;if(!(rate>0))return null;const current=(amp,bus)=>number(amp)!=null&&bus.baseKv>0?Math.abs(amp)*Math.sqrt(3)*bus.baseKv/1000:null,aValue=current(r?.iFromA,a),bValue=current(r?.iToA,to),actual=slot.maximum?aValue!=null&&bValue!=null?Math.max(aValue,bValue):null:aValue;return actual!=null?100*actual/rate:null;}
      }
      if(rec.kind==='gen'){
        const r=saved?rec.gen:gens.get(rec.gen.id);if(k==='pgenmw')return r?.pMw??null;if(k==='qgenmvar')return r?.qMvar??null;if(k==='inservice')return rec.gen.status;
      }
      if(rec.kind==='load'){
        const values={...loadResultValues(rec.load,vb.vm),type:nativeField(index,e,'Load Type')};if(k in values)return values[k];
      }
      if(rec.kind==='shunt'){if(k==='inserviceactualmvar')return vb.vm!=null&&rec.shunt.status===1?-rec.shunt.bMvar*vb.vm**2:rec.shunt.status===0?0:null;if(k==='inservicenominalmvar')return rec.shunt.status===1?-rec.shunt.bMvar:0;}
      if(rec.kind==='plant'){
        const remote=index.buses.get(Number(f.ireg)),remoteBus=remote?index.networkBuses.get(remote.id):b,remoteV=remoteBus?voltageData(index,remoteBus,busResults.get(remoteBus.connectionKey),saved):null;
        if(k==='remotebusnumber')return f.ireg??null;if(k==='remotebusname')return remote?.name??null;if(k==='remotebusbasekv')return remote?.fields.baskv??null;if(k==='remotebusvoltagepu')return remoteV?.vm??null;if(k==='remotebusvoltagekv')return remoteV?.vm!=null?remoteV.vm*remote.fields.baskv:null;if(k==='remotebusschedvoltagepu'||k==='voltageschedulepu')return f.vs??null;if(k==='remotebusschedvoltagekv')return f.vs!=null&&remote?f.vs*remote.fields.baskv:null;
        if(cfg.name==='Limit Plant'){if(k==='swingtype')return vb.f.ide===3?'SYST':null;if(k==='busnumber'&&columnIndex>7)return f.ireg??null;if(k==='name')return columnIndex>7?remote?.name??null:index.eq.get(b.sourceEquipmentId)?.name??null;if(k==='basekv'&&columnIndex>7)return remote?.fields.baskv??null;if(k==='voltagepu')return remoteV?.vm??null;if(k==='zonenumber')return vb.f.zone??null;if(k==='areanumber')return vb.f.area??null;}
        if(k==='mismatchmwkv'||k==='mismatchmvarkv'){const balance=busBalances(index,result,saved)[index.busPosition.get(b)];return balance.valid?(k==='mismatchmwkv'?balance.p:balance.q):null;}
        const active=rec.units.filter(g=>g.status===1),sum=prop=>{let sum=0;for(const unit of active){const g=saved?unit:gens.get(unit.id);if(number(g?.[prop])==null)return null;sum+=g[prop];}return sum;};
        const values={pgenmw:sum('pMw'),pmw:sum('pMw'),qgenmvar:sum('qMvar'),qmvar:sum('qMvar'),pmaxmw:active.reduce((s,g)=>s+(g.pMaxMw??0),0),pminmw:active.reduce((s,g)=>s+(g.pMinMw??0),0),qmaxmvar:active.reduce((s,g)=>s+g.qMaxMvar,0),qminmvar:active.reduce((s,g)=>s+g.qMinMvar,0),numberofinservicemachines:active.length,numberofoutofservicemachines:rec.units.length-active.length,bustype:vb.f.ide,inservice:Number(active.length>0),dummybus:vb.f.threeWindingStar?1:0,mvaloading:sum('pMw')!=null&&sum('qMvar')!=null?Math.hypot(sum('pMw'),sum('qMvar')):null,machinebasemva:active.reduce((total,g)=>total+(index.eq.get(g.sourceEquipmentId)?.fields?.mbase??0),0)};if(k in values)return values[k];
      }
      return nativeField(index,e,h,previousField);
    }));
    return {headers,rows,source,availability:nativeColumnAvailability(headers,records,rows),note:cfg.name==='Load'?`${network.loads.length} kaynak yükü; servis dışı kayıtlar dahil.`:saved?'SAV kayıtlı durum; akışlar kayıtlı gerilim/admitans ve Zflow kaynağından türetilir.':''};
  };
}
