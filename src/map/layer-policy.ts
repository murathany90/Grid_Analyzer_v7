import type {BenchmarkMapSelection,BenchmarkMapValue} from '../domain/benchmark/map-layer';
import {benchmarkLayerColor} from '../domain/benchmark/map-layer';
import type {CalculationResult} from '../domain/results/types';
import type {Settings} from '../persistence/settings';

const labels:Record<string,string>={voltagePu:'Bara gerilimi (pu)',voltageKv:'Bara gerilimi (kV)',angleDeg:'Bara açısı (°)',pFromMw:'Hat P giriş (MW)',qFromMvar:'Hat Q giriş (MVAr)',sFromMva:'Hat S giriş (MVA)',pToMw:'Hat P çıkış (MW)',qToMvar:'Hat Q çıkış (MVAr)',sToMva:'Hat S çıkış (MVA)',pHvMw:'Trafo P yüksek gerilim (MW)',qHvMvar:'Trafo Q yüksek gerilim (MVAr)',sHvMva:'Trafo S yüksek gerilim (MVA)',pLvMw:'Trafo P alçak gerilim (MW)',qLvMvar:'Trafo Q alçak gerilim (MVAr)',sLvMva:'Trafo S alçak gerilim (MVA)',iFromA:'Hat akımı giriş (A)',iToA:'Hat akımı çıkış (A)',loadingPercent:'Termik yüklenme (%)',pLossMw:'Aktif kayıp (MW)',qLossMvar:'Reaktif kayıp (MVAr)',pResultMw:'Ekipman P (MW)',qResultMvar:'Ekipman Q (MVAr)',postLoadingPercent:'Kesinti sonrası tahmini yük (%)',postPmw:'Kesinti sonrası P (MW)',postQmvar:'Kesinti sonrası Q (MVAr)',postMva:'Kesinti sonrası S (MVA)',postVoltagePu:'Kesinti sonrası bara gerilimi (pu)',postCurrentA:'Kesinti sonrası akım (A)',postCurrentLoadingPercent:'Kesinti sonrası akım yükü (%)',postApparentLoadingPercent:'Kesinti sonrası görünür güç yükü (%)',islands:'Kesinti sonrası elektrik adaları',thermalRisk:'Kesinti sonrası termik risk (%)',ikssKa:'Başlangıç kısa devre akımı (kA)',skssMva:'Kısa devre gücü (MVA)',ipKa:'Tepe kısa devre akımı (kA)',ibKa:'Kesme akımı (kA)',ithKa:'Termik kısa devre akımı (kA)'};
export const mapMetricLabel=(metric:string)=>labels[metric]??metric;

export function mapMetricTarget(metric:string):'site'|'branch'{
  return /voltage|angle|ikss|skss|ipKa|ibKa|ithKa/i.test(metric)?'site':'branch';
}
/** Missing or inapplicable numbers never erase the nominal electrical geography. */
export function resultLayerColor(nominal:string,target:'site'|'branch',selection:BenchmarkMapSelection,value:BenchmarkMapValue|undefined,enabled:boolean,scale?:number):string{
  if(!enabled||mapMetricTarget(selection.metric)!==target||value?.value==null||!Number.isFinite(value.value))return nominal;
  if(selection.analysis==='LF'&&selection.source==='GA'&&/^[pq](From|To|Hv|Lv)M(w|var)$/.test(selection.metric))return nominal;
  return benchmarkLayerColor(value,selection.n1Layer==='CHANGE'||['DELTA','EXPLORATORY_DELTA','SCENARIO_DELTA'].includes(selection.source),scale);
}
export function mapFlowMetric(selection:BenchmarkMapSelection|null,mode:Settings['displayMode'],result:CalculationResult|null,current:boolean):'p'|'q'|null{
  if(!current||!result?.converged||result.identity.analysisType!=='powerFlow')return null;
  if(selection){if(selection.analysis!=='LF'||selection.source!=='GA')return null;return /^(qFromMvar|qToMvar|qHvMvar|qLvMvar)$/.test(selection.metric)?'q':/^(pFromMw|pToMw|pHvMw|pLvMw|sFromMva|sToMva|loadingPercent|iFromA|iToA)$/.test(selection.metric)?'p':null;}
  return mode==='q'?'q':['nominal','p','loading'].includes(mode)?'p':null;
}
