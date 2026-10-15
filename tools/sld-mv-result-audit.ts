/** Current GA snapshot only. Aggregate bus injections and load setpoints are not feeder results. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import type {AppContext} from '../src/app/contracts';
import {ScenarioStore} from '../src/domain/scenario/overlay';
import {ResultStore} from '../src/domain/results/store';
import {defaultSettings} from '../src/persistence/settings';
import {createSldResultOverlay} from '../src/features/sld/result-overlay';
import {labelValues,lfPowerRows,lfTransformerRows} from '../src/features/sld/result-labels';
import {feederReadout} from '../src/features/sld/feeder-readout';
import {feederDrawingPath} from '../src/features/sld/feeder-drawing-graph';
import {sldDrawingGraph} from '../src/features/sld/source-switch-policy';
import type {StationTopologyGraph} from '../src/domain/model/station-topology';
const out=process.argv.indexOf('--out'),dir=out<0?'local-benchmark-results/sld-mv-final':process.argv[out+1];await mkdir(dir,{recursive:true});
const data=JSON.parse(await readFile('local-benchmark-results/map-lightning-audit-SN3-cache-private.json','utf8')),fixtures=JSON.parse(await readFile('local-benchmark-results/sld-v38/graphs-audited-private.json','utf8')) as {site:{id:string;name:string};graph:StationTopologyGraph}[];
const store=new ResultStore();store.expect('base',data.lf.identity);store.accept('base',data.lf);
const ctx={network:data.network,analysisSettings:{value:data.settings},settings:{value:defaultSettings()},powerFactoryControlContextHash:data.controlHash,scenario:new ScenarioStore(data.network.modelHash),resultStore:store,resultView:{analysis:'LF',source:'GA',phase:'BASE',scenarioId:'B0',metric:'pFromMw'},n1AcResults:[],hybridResult:null,n1Result:null,scResult:null,scContext:null} as unknown as AppContext;
const overlay=createSldResultOverlay(ctx,'LF');assert.ok(overlay.status.startsWith('CONVERGED'),overlay.status);
type AuditRow={site_id:string;site_name:string;feeder_fid:string;source_name:string;nominal_kv:number;equipment_fids:string;result_in_model:string;shown_before:string;shown_in_sld:string;reason:string;reason_detail:string;result_key:string;native_terminal:string;presentation:string;p_validated:boolean;q_validated:boolean;p_shown:boolean;q_shown:boolean};
const rows:AuditRow[]=[];
for(const fixture of fixtures){const graph=sldDrawingGraph(fixture.graph);for(const f of graph.feeders.filter(f=>f.voltageKv>0&&f.voltageKv<=36)){
 const actualKeys=f.equipmentKeys.filter(k=>{const entry=overlay.entries.get(k);return entry&&Object.entries(entry.values).some(([k,v])=>/^(?:pFromMw|pToMw|pMw|qFromMvar|qToMvar|qMvar)$/.test(k)&&typeof v==='number'&&Number.isFinite(v));}),tr=graph.equipment.filter(e=>f.equipmentKeys.includes(e.sourceClass+'|'+e.id)&&['transformer','transformer3w'].includes(e.kind)),summaries=tr.map(e=>lfTransformerRows(overlay,e.sourceClass+'|'+e.id,e.terminals[0])).some(rows=>rows.slice(0,2).some(r=>!r.includes('—'))),readout=feederReadout(graph,f,overlay);
 const oldKey=f.equipmentKeys.find(k=>graph.equipment.some(e=>k===e.sourceClass+'|'+e.id)),oldEnd=feederDrawingPath(graph,f)?.terminals.at(-1)??f.terminalIds.find(id=>!f.busSectionIds.includes(id))??f.terminalIds[0],before=tr.length?summaries:lfPowerRows(overlay,oldKey,oldEnd).some(r=>!r.includes('—')),shown=tr.length?summaries:readout.shown,values=labelValues(readout.entry);
 // Inspect each displayed native quantity, rather than accepting a number at
 // the opposite end or counting an available MW as an available MVAr too.
 const nativeRows=tr.length?tr.map(e=>lfTransformerRows(overlay,e.sourceClass+'|'+e.id,e.terminals[0])):[readout.rows],has=(i:number)=>nativeRows.some(r=>!r[i].includes('—'));
 const detail=shown?'Validated GA snapshot; native equipment FID and terminal':!f.equipmentKeys.length?'No result-bearing line/load/generator attached to this source bay; reduced-bus total is not attributable to the feeder':f.equipmentKeys.some(k=>k.startsWith('ElmLod|'))?'The LF snapshot contains no per-load result record; canonical load setpoints and active-balancing totals are not substituted':'No validated per-equipment result in this snapshot (check service state, supported class and solved scope)';
 rows.push({site_id:fixture.site.id,site_name:fixture.site.name,feeder_fid:f.id,source_name:f.name,nominal_kv:f.voltageKv,equipment_fids:f.equipmentKeys.join(';'),result_in_model:actualKeys.length?'yes':'no',shown_before:before?'yes':'no',shown_in_sld:shown?'yes':'no',reason:shown?tr.length?'SINGLE_NATIVE_TRANSFORMER_SUMMARY':readout.reason:readout.reason,reason_detail:detail,result_key:readout.key??'',native_terminal:readout.terminal,presentation:tr.length?'TRANSFORMER_SUMMARY':'FEEDER',p_validated:has(0),q_validated:has(1),p_shown:has(0),q_shown:has(1)});
 }}
const summary={modelHash:data.network.modelHash,identity:data.lf.identity,status:overlay.status,mvFeeders:rows.length,resultExists:rows.filter(r=>r.result_in_model==='yes').length,shownBefore:rows.filter(r=>r.shown_before==='yes').length,shownAfter:rows.filter(r=>r.shown_in_sld==='yes').length,recovered:rows.filter(r=>r.shown_before==='no'&&r.shown_in_sld==='yes').length,withheld:rows.filter(r=>r.result_in_model==='yes'&&r.shown_in_sld==='no'),reasonCounts:Object.fromEntries([...new Set(rows.map(r=>r.reason))].map(reason=>[reason,rows.filter(r=>r.reason===reason).length]))};
const quantities={mwAvailable:rows.filter(r=>r.p_validated).length,mvarAvailable:rows.filter(r=>r.q_validated).length,both:rows.filter(r=>r.p_validated&&r.q_validated).length,mwOnly:rows.filter(r=>r.p_validated&&!r.q_validated).length,mvarOnly:rows.filter(r=>!r.p_validated&&r.q_validated).length,neither:rows.filter(r=>!r.p_validated&&!r.q_validated).length};Object.assign(summary,{quantities});assert.equal(quantities.both+quantities.mwOnly+quantities.mvarOnly+quantities.neither,22663);assert.deepEqual(summary.withheld,[]);
const csv=(items:typeof rows)=>[Object.keys(items[0]).join(','),...items.map(row=>Object.values(row).map(v=>'"'+String(v).replaceAll('"','""')+'"').join(','))].join('\n');
await writeFile(dir+'/MV_LF_RESULT_AUDIT.csv','\uFEFF'+csv(rows));await writeFile(dir+'/THREE_TM_LF_AUDIT.csv','\uFEFF'+csv(rows.filter(r=>['M891','M894','M1681'].includes(r.site_id))));await writeFile(dir+'/MV_LF_SUMMARY.json',JSON.stringify(summary,null,2));console.log(JSON.stringify({...summary,identity:undefined,withheld:summary.withheld.length},null,2));
