import type {AppContext,Feature} from '../../app/contracts';
import {effectivePsseNetwork} from '../../analysis/psse/newton';
import {element} from '../../ui/components/dom';
const fmt=(value:number|null|undefined,d=2)=>value==null||!Number.isFinite(value)?'—':value.toLocaleString('tr-TR',{maximumFractionDigits:d,useGrouping:false});

/** Topology summary only; the dedicated Map and SLD features own diagrams. */
export function createPsseNetworkView(ctx:AppContext):Feature{
 const root=element('section','ga-feature ga-psse-network'),heading=element('div','ga-feature-heading'),content=element('div','ga-psse-network-content');
 heading.append(element('h2','','PSS/E Topoloji'),element('p','ga-muted','Elektrik adaları yalnız servisteki bara/düğümler ve servisteki seri dallar üzerinden sayılır. Fiziksel gerilim tabanı bilinmiyorsa kV alanı boş kalır.'));
 root.append(heading,content);
 function render(){
  const base=ctx.psseNetwork,scenario=ctx.psseScenario;
  if(!base||!scenario){content.replaceChildren(element('p','ga-empty','PSS/E bus-branch modeli bekleniyor.'));return;}
  const network=effectivePsseNetwork(base,scenario),active=network.buses.map((bus,index)=>bus.status===1?index:-1).filter(index=>index>=0),activeSet=new Set(active),adj=network.buses.map(()=>[] as number[]);
  for(const branch of network.branches)if(branch.status===1&&activeSet.has(branch.from)&&activeSet.has(branch.to)){adj[branch.from].push(branch.to);adj[branch.to].push(branch.from);}
  const seen=new Uint8Array(network.buses.length),components:number[][]=[];
  for(const index of active){if(seen[index])continue;seen[index]=1;const queue=[index],group:number[]=[];for(let p=0;p<queue.length;p++){const current=queue[p];group.push(current);for(const next of adj[current])if(!seen[next]){seen[next]=1;queue.push(next);}}components.push(group);}
  const result=ctx.psseCalculation?.identity.modelHash===base.modelHash&&ctx.psseCalculation.identity.scenarioHash===scenario.hash?ctx.psseCalculation:null,activeBranches=network.branches.filter(branch=>branch.status===1).length;
  const cards=[['Kaynak baralar',network.buses.filter(bus=>bus.source).length],['Servisteki düğüm',active.length],['Servisteki dal / sargı',activeBranches],['Energized ada',components.length],['Devre dışı bara',network.buses.filter(bus=>bus.status===0).length],['Hesap',result?.source??'NOT_RUN']];
  const grid=element('div','ga-card-grid');for(const [label,value]of cards){const card=element('div','ga-card');card.append(element('span','ga-muted',String(label)),element('strong','',String(value)));grid.append(card);}
  const table=element('table','ga-table'),head=element('tr');for(const label of ['Ada','Aktif bara/düğüm','Kaynak bara','Bağlı aktif dal','En düşük kaynak kV','En yüksek kaynak kV'])head.append(element('th','',label));const thead=element('thead');thead.append(head);const tbody=element('tbody');
  const sorted=[...components].sort((a,b)=>b.length-a.length);for(const [id,group]of sorted.slice(0,100).entries()){const buses=group.map(index=>network.buses[index]),knownKv=buses.map(bus=>bus.baseKv).filter((value):value is number=>value!==null&&Number.isFinite(value)),degree=group.reduce((sum,index)=>sum+adj[index].length,0),row=element('tr');for(const value of [String(id+1),String(group.length),String(buses.filter(bus=>bus.source).length),String(degree/2),knownKv.length?fmt(Math.min(...knownKv)):'—',knownKv.length?fmt(Math.max(...knownKv)):'—'])row.append(element('td','',value));tbody.append(row);}
  const wrap=element('div','ga-table-wrap');table.append(thead,tbody);wrap.append(table);const note=element('p','ga-notice',sorted.length>100?`${sorted.length-100} ek ada ayrıntısı bu tabloda gösterilmedi.`:'Ada üyeliği servisteki seri dallardan hesaplanır; iç 3 sargı yıldız düğümü sayısal ağda bir düğümdür.');
  const details=element('details');details.append(element('summary','','Topoloji kimliği ve ada üyeleri'),element('pre','',JSON.stringify({modelHash:base.modelHash,topologyHash:result?.identity.topologyHash??null,scenarioHash:scenario.hash,sourceBuses:network.buses.filter(bus=>bus.source).length,activeBuses:active.length,activeBranches,islands:sorted.map((group,id)=>({id:id+1,nodeCount:group.length,buses:group.map(index=>network.buses[index].id)}))},null,2)));
  content.replaceChildren(grid,note,wrap,details);
 }
 return{element:root,render};
}
