import type {Line,Site} from '../domain/model/network';
import type {BranchResult} from '../domain/results/types';
import type {Settings} from '../persistence/settings';
import {branchMapDelta,type StationVoltage} from './electrical-overlays';
import {deltaLabels,signedValue} from './delta-style';
import {format as f} from '../ui/components/dom';
interface DetailData {settings:Settings;names:string[];inService:boolean;row?:BranchResult;base?:BranchResult;voltage?:StationVoltage;voltageDelta?:number;endpointVoltages?:{name:string;voltage?:StationVoltage;delta?:number}[]}
function voltageText(name:string,voltage?:StationVoltage):string {
  if(!voltage)return `${name}\n— / Sonuç yok`;
  const bus=voltage.worst;
  return `${name}\n${voltage.groups.map(g=>`${f(g.kv)} kV: Min ${f(g.min,4)} pu · Max ${f(g.max,4)} pu`).join('\n')}\n${voltage.count===1?'Bara':'En kritik bara'}: ${bus.name}\n${f(bus.vmPu*bus.vnKv)} kV · ${f(bus.vmPu,4)} pu · Açı ${f(bus.angleRad*180/Math.PI)}°`;
}
export function mapDetailText(entity:Line|Site,data:DetailData):string {
  const {settings,row,base}=data,site=entity.sourceClass==='ElmSite';
  const heading=site?entity.name:`${entity.name} · ${f((entity as Line).vnKv)} kV\n${data.names.join(' → ')}`;
  const unavailable=(value:number|null|undefined,digits=2)=>value==null||!Number.isFinite(value)?'— / Sonuç yok':f(value,digits);
  if(settings.displayMode==='v')return site?voltageText(entity.name,data.voltage):heading+'\n'+(data.endpointVoltages||[]).map(v=>voltageText(v.name,v.voltage)).join('\n');
  if(settings.displayMode==='delta'){
    const metric=deltaLabels[settings.deltaMetric],delta=(value:number|null|undefined)=>value==null||!Number.isFinite(value)?'— / Sonuç yok':signedValue(value,settings.deltaMetric==='v'?5:2)+' '+metric.unit;
    if(settings.deltaMetric==='v')return site?`${heading}\nΔV ${delta(data.voltageDelta)}`:`${heading}\n${(data.endpointVoltages||[]).map(v=>`${v.name} · ΔV ${delta(v.delta)}`).join('\n')}`;
    return `${heading}\n${metric.symbol} ${delta(site?null:branchMapDelta(base,row,settings.deltaMetric))}`;
  }
  if(site)return `${heading} · TM${settings.displayMode==='nominal'?'':'\nHat sonucu için hat seçin'}`;
  if(settings.displayMode==='nominal')return `${heading}\n${data.inService?'Serviste':'Servis dışı'}`;
  if(settings.displayMode==='loading')return `${heading}\nYüklenme ${unavailable(row?.loading,1)} %`;
  const q=settings.displayMode==='q',symbol=q?'Q':'P',unit=q?'MVAr':'MW';
  return `${heading}\nA ${symbol} ${unavailable(q?row?.qf:row?.pf)} ${unit}\nB ${symbol} ${unavailable(q?row?.qt:row?.pt)} ${unit}`;
}
