import type { AppContext } from '../app/contracts';
import { element } from '../ui/components/dom';
import { benchmarkMapGate, type BenchmarkMapSelection } from '../domain/benchmark/map-layer';
import { METRICS } from '../domain/benchmark/comparison';
import { rowObject } from '../domain/benchmark/types';

export function createBenchmarkMapControls(ctx:AppContext){
  const root=element('div','ga-map-filters ga-benchmark-map-controls'),analysis=element('select'),source=element('select'),metric=element('select'),cases=element('select'),reason=element('span','ga-muted');
  analysis.setAttribute('aria-label','Benchmark harita analizi');source.setAttribute('aria-label','Benchmark harita kaynağı');metric.setAttribute('aria-label','Benchmark harita metriği');cases.setAttribute('aria-label','Benchmark harita kesintisi');
  for(const [value,label] of [['','Mevcut harita'],['LF','Benchmark: LF'],['N1','Benchmark: N-1'],['SC','Benchmark: SC']]){const o=element('option','',label);o.value=value;analysis.append(o);}
  for(const [value,label] of [['PF','PowerFactory'],['GA','Grid Analyzer'],['DELTA','Fark (GA−PF)']]){const o=element('option','',label);o.value=value;source.append(o);}
  root.append(analysis,source,metric,cases,reason);
  function selected():BenchmarkMapSelection|null{return analysis.value?{analysis:analysis.value as BenchmarkMapSelection['analysis'],source:source.value as BenchmarkMapSelection['source'],metric:metric.value,table:analysis.value==='LF'?'GA_Reference_Raw':analysis.value==='N1'?'N1_RecordedExtrema_Raw':'SC_BusResults_Raw',caseId:cases.value}:null;}
  const commit=()=>{ctx.benchmarkMap=selected();ctx.notify();};
  let previousAnalysis='',previousBenchmark=ctx.benchmark;
  function render(){
    const active=analysis.value;source.hidden=metric.hidden=!active;cases.hidden=active!=='N1';
    if(active!==previousAnalysis){previousAnalysis=active;metric.replaceChildren();const fields=active==='LF'?Object.entries(METRICS.GA_Reference_Raw):active==='SC'?Object.entries(METRICS.SC_BusResults_Raw):[['postLoadingPercent','%'],['postPmw','MW'],['postQmvar','Mvar'],['postMva','MVA'],['voltagePu','pu'],['voltageKv','kV']];for(const [field,unit] of fields){const o=element('option','',`${field} (${unit})`);o.value=field;metric.append(o);}}
    if(ctx.benchmark!==previousBenchmark||active==='N1'&&!cases.options.length){previousBenchmark=ctx.benchmark;const old=cases.value;cases.replaceChildren();const table=ctx.benchmark?.groups.N1.tables.N1_Cases_Raw;for(const row of table?.rows||[]){const r=rowObject(table!,row),o=element('option','',`${r.caseId} · ${r.outageName} · ${r.outageFid}`);o.value=String(r.caseId);cases.append(o);}if([...cases.options].some(o=>o.value===old))cases.value=old;}
    for(const option of source.options){const s=selected();const gate=s?benchmarkMapGate(ctx,{...s,source:option.value as BenchmarkMapSelection['source']}):{enabled:true,reason:''};option.disabled=!gate.enabled;option.title=gate.reason;}
    const s=selected(),gate=s?benchmarkMapGate(ctx,s):{enabled:true,reason:''};reason.textContent=gate.enabled?s?`${s.analysis} · ${s.source} · ${s.metric} · gri: NO_DATA / UNMATCHED / INVALID`:'':gate.reason;
  }
  analysis.onchange=()=>{render();commit();};source.onchange=metric.onchange=cases.onchange=commit;
  return {element:root,render};
}
