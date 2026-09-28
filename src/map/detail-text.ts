import type {Line,Site} from '../domain/model/network';
import type {BranchResult} from '../domain/results/types';
import type {Settings} from '../persistence/settings';
import {branchMapDelta,type StationVoltage,type StationAngle} from './electrical-overlays';
import {deltaLabels,signedValue} from './delta-style';
import {format as f} from '../ui/components/dom';
interface DetailData {settings:Settings;names:string[];inService:boolean;row?:BranchResult;base?:BranchResult;voltage?:StationVoltage;angle?:StationAngle;voltageDelta?:number;endpointVoltages?:{name:string;voltage?:StationVoltage;angle?:StationAngle;delta?:number}[]}
function voltageText(name:string,voltage?:StationVoltage):string {
  if(!voltage)return `${name}\n— / Sonuç yok`;
  const bus=voltage.worst;
  return `${name}\n${voltage.groups.map(g=>`${f(g.kv)} kV: Min ${f(g.min,4)} pu · Max ${f(g.max,4)} pu`).join('\n')}\n${voltage.count===1?'Bara':'En kritik bara'}: ${bus.name}\n${f(bus.vmPu*bus.vnKv)} kV · ${f(bus.vmPu,4)} pu`;
}
function angleText(name:string,angle?:StationAngle):string {
  if(!angle)return `${name}\n— / Sonuç yok`;
  const bus=angle.representative;
  return `${name}\n${angle.count} bara · Min ${f(angle.min)}° · Medyan ${f(angle.median)}° · Max ${f(angle.max)}°\nTemsilci: ${bus.name} · ${f(bus.vnKv)} kV · ${f(bus.angleRad*180/Math.PI)}°${angle.groups>1?`\n${angle.groups} ayrı referans adası; yalnız en büyük ada gösteriliyor.`:''}`;
}
function branchElectrical(row?:BranchResult):string {
  if(!row)return '— / Sonuç yok';
  const n=(value:number|null|undefined,unit:string)=>value==null||!Number.isFinite(value)?'—':`${f(value)} ${unit}`;
  return `A: P ${n(row.pf,'MW')} · Q ${n(row.qf,'MVAr')} · S ${n(Math.hypot(row.pf,row.qf),'MVA')} · I ${n(row.ifA,'A')}\nB: P ${n(row.pt,'MW')} · Q ${n(row.qt,'MVAr')} · S ${n(Math.hypot(row.pt,row.qt),'MVA')} · I ${n(row.itA,'A')}\nKayıp: P ${n(row.pLoss,'MW')} · Q ${n(row.qLoss,'MVAr')}\nYüklenme ${n(row.loading,'%')}`;
}
export function mapDetailText(entity:Line|Site,data:DetailData):string {
  const {settings,row,base}=data,site=entity.sourceClass==='ElmSite';
  const heading=site?entity.name:`${entity.name} · ${f((entity as Line).vnKv)} kV\n${data.names.join(' → ')}`;
  const withBranch=(value:string)=>site?value:`${value}\n${branchElectrical(row)}`;
  if(settings.displayMode==='v')return site?voltageText(entity.name,data.voltage)+(data.angle?`\n${angleText('Açı (≥66 kV)',data.angle)}`:''):withBranch(heading+'\n'+(data.endpointVoltages||[]).map(v=>voltageText(v.name,v.voltage)).join('\n'));
  if(settings.displayMode==='angle')return site?angleText(entity.name,data.angle):withBranch(heading+'\n'+(data.endpointVoltages||[]).map(v=>angleText(v.name,v.angle)).join('\n'));
  if(settings.displayMode==='delta'){
    const metric=deltaLabels[settings.deltaMetric],delta=(value:number|null|undefined)=>value==null||!Number.isFinite(value)?'— / Sonuç yok':signedValue(value,settings.deltaMetric==='v'?5:2)+' '+metric.unit;
    if(settings.deltaMetric==='v')return site?`${heading}\nΔV ${delta(data.voltageDelta)}`:withBranch(`${heading}\n${(data.endpointVoltages||[]).map(v=>`${v.name} · ΔV ${delta(v.delta)}`).join('\n')}`);
    return withBranch(`${heading}\n${metric.symbol} ${delta(site?null:branchMapDelta(base,row,settings.deltaMetric))}`);
  }
  if(site){const bus=data.voltage?.worst,angle=data.angle?.representative;return `${heading} · TM${bus?`\n${bus.name}: ${f(bus.vmPu*bus.vnKv)} kV · ${f(bus.vmPu,4)} pu`:''}${angle?`\nAçı (${angle.name}, ${f(angle.vnKv)} kV): ${f(angle.angleRad*180/Math.PI)}°`:''}`;}
  if(settings.displayMode==='nominal')return `${heading}\n${data.inService?'Serviste':'Servis dışı'}`;
  if(settings.displayMode==='q'){const q=(value:number|undefined)=>value==null||!Number.isFinite(value)?'— / Sonuç yok':f(value);return `${heading}\nA Q ${q(row?.qf)} MVAr\nB Q ${q(row?.qt)} MVAr\n${branchElectrical(row)}`;}
  return `${heading}\n${data.inService?'Serviste':'Servis dışı'}\n${branchElectrical(row)}`;
}
