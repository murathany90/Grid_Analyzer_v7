import {element} from '../../ui/components/dom';
import type {BenchmarkMetricRow} from '../../domain/benchmark/comparison';
import {diagnosticStatistics} from '../../domain/benchmark/diagnostic-statistics';

/** User-opened plots of one selected metric; exploratory errors stay separate. */
export function createDiagnosticPlots(rows:()=>BenchmarkMetricRow[],enabled:()=>boolean){
  const root=element('details'),summary=element('summary','','Tanısal dağılım: PF–GA ve |Δ|'),notice=element('p','ga-muted'),scatter=element('canvas'),histogram=element('canvas'),worst=element('pre');
  scatter.setAttribute('aria-label','Tanısal PF GA scatter');histogram.setAttribute('aria-label','Tanısal mutlak fark histogramı');for(const c of [scatter,histogram]){c.width=600;c.height=260;c.style.width='min(100%, 600px)';c.style.height='auto';}root.append(summary,notice,scatter,histogram,worst);
  function render(){if(!root.open)return;const r=enabled()?rows().filter(r=>r.diagnosticDelta!=null&&r.ga!==null&&r.pf.value!==null):[];
    if(!r.length||new Set(r.map(r=>`${r.metric}|${r.pf.unit}`)).size!==1){notice.textContent='Tanısal farkları açın ve tek bir metrik seçin. Doğrulanmış hata istatistiği değildir.';scatter.hidden=histogram.hidden=worst.hidden=true;return;}
    scatter.hidden=histogram.hidden=worst.hidden=false;const stats=diagnosticStatistics(r);notice.textContent=`EXPLORATORY_DELTA_METHOD_UNVERIFIED · ${r[0].metric} (${r[0].pf.unit}) · ${JSON.stringify(stats.map(({worstPrivateFid,worstPrivateSide,...s})=>s))}`;
    const values=r.flatMap(r=>[r.pf.value!,r.ga!]),min=values.reduce((a,b)=>Math.min(a,b),Infinity),max=values.reduce((a,b)=>Math.max(a,b),-Infinity),span=max-min||1,g=scatter.getContext('2d')!;g.clearRect(0,0,600,260);g.fillStyle='#0c1c2c';g.fillRect(0,0,600,260);g.strokeStyle='#a6b7c0';g.beginPath();g.moveTo(35,225);g.lineTo(565,225);g.moveTo(35,225);g.lineTo(35,25);g.moveTo(35,225);g.lineTo(565,25);g.stroke();g.fillStyle='#eb765b';const stride=Math.max(1,Math.ceil(r.length/1000));for(let i=0;i<r.length;i+=stride){g.beginPath();g.arc(35+530*(r[i].pf.value!-min)/span,225-200*(r[i].ga!-min)/span,2,0,Math.PI*2);g.fill();}g.fillStyle='#e5eef5';g.font='12px system-ui';g.fillText(`PF → [${min.toPrecision(4)}, ${max.toPrecision(4)}] · GA ↑ · noktalar ≤1000 / n=${r.length}`,35,250);
    const abs=r.map(r=>Math.abs(r.diagnosticDelta!)),ceiling=abs.reduce((a,b)=>Math.max(a,b),0)||1,bins=Array<number>(20).fill(0);for(const x of abs)bins[Math.min(19,Math.floor(20*x/ceiling))]++;const h=histogram.getContext('2d')!;h.fillStyle='#0c1c2c';h.fillRect(0,0,600,260);h.fillStyle='#63bdcf';const height=Math.max(...bins)||1;bins.forEach((n,i)=>h.fillRect(35+i*26.5,225-195*n/height,23,195*n/height));h.fillStyle='#e5eef5';h.fillText(`|GA−PF| → 0 … ${ceiling.toPrecision(4)} ${r[0].pf.unit} · tüm ${r.length} hücre`,35,250);
    worst.textContent='En büyük 20 tanısal hata · yerel FID / side / signed Δ\n'+[...r].sort((a,b)=>Math.abs(b.diagnosticDelta!)-Math.abs(a.diagnosticDelta!)).slice(0,20).map(r=>`${r.sourceClass}:${r.fid} / ${r.side||r.metric} / ${r.diagnosticDelta} ${r.pf.unit}`).join('\n');
  }
  root.ontoggle=render;return {element:root,render};
}
