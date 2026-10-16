import test from 'node:test';import assert from 'node:assert/strict';
import {sourceCircuit,circuitNames} from '../helpers/sld-v32-circuits';
import {feederDrawingPath} from '../../src/features/sld/feeder-drawing-graph';
import {sourceSwitchKind} from '../../src/domain/model/switch-usage';
import {stationOverviewPage} from '../../src/features/sld/page-layout';
import {allVoltageBands} from '../../src/domain/model/voltage-band';
import {buildStationTopologyGraph} from '../../src/domain/model/station-topology';
import {nearestSideCorridor} from '../../src/features/sld/side-corridor';
for(const name of circuitNames)test('Native circuit inventory and source sequence remain immutable: '+name,()=>{
 const f=sourceCircuit(name),before=structuredClone(f.network),graphBefore=structuredClone(f.graph),p=stationOverviewPage(f.graph,allVoltageBands()),main=feederDrawingPath(f.graph,f.graph.feeders.find(f=>f.id==='F')!);
 assert.equal(p.routes.length,f.network.switches.length);assert.equal(new Set(p.routes.map(r=>r.sw.sourceClass+'|'+r.sw.sourceId)).size,f.network.switches.length);
 if(name!=='coupler'){assert.deepEqual(main?.switchIds,f.main.map(s=>s.id));assert.deepEqual(main?.branchSwitchIds,f.branches.map(s=>s.id));}
 assert.deepEqual(f.network,before);assert.deepEqual(f.graph,graphBefore);
 if(name==='unknown-order')for(const r of p.routes.filter(r=>r.sw.id.startsWith('UNKNOWN'))){assert.equal(r.ordering,'SOURCE_ORDER_UNAVAILABLE');assert.equal(r.wires.length,0);}
});
test('DGS aUsage mapping distinguishes load-break disconnector from generic switch and breaker',()=>{
 assert.deepEqual(['cbk','dct','sdc','swt','','invalid'].map(sourceSwitchKind),['breaker','isolator','load-break-disconnector','load-switch','switch','switch']);
 const f=sourceCircuit('breaker-line');f.source.switches=f.source.switches.map(s=>({...s,attributes:{...s.attributes,aUsage:'sdc'}}));
 assert.equal(buildStationTopologyGraph(f.network,'S',f.source).switches[0].kind,'load-break-disconnector');
});
test('A transfer bypass cannot shorten or reverse the source series sequence',()=>{
 const f=sourceCircuit('bypass');f.graph.switches.reverse();f.graph.terminals.reverse();const p=feederDrawingPath(f.graph,f.graph.feeders.find(f=>f.id==='F')!)!;assert.deepEqual(p.switchIds,['SW0','SW1','SW2']);assert.deepEqual(p.branchSwitchIds,['ALTERNATE']);
});
test('Auxiliary source forks keep short vertical leads on their own native columns',()=>{const f=sourceCircuit('branched-series'),p=stationOverviewPage(f.graph,allVoltageBands());for(const e of p.equipment.filter(e=>e.nativePorts.length===1)){assert.equal(e.x,e.nativePorts[0].x);for(const port of e.ports)for(const wire of port.wires)assert.ok(wire.points.every(point=>point[0]===e.x));}});
test('Nearest external corridor shortens left-hand winding leads without widening the sheet',()=>{
 assert.deepEqual(nearestSideCorridor(338,224,132,1370),{x:108,side:'LEFT'});
 assert.deepEqual(nearestSideCorridor(502,304,132,1370,1),{x:120,side:'LEFT'});
 assert.deepEqual(nearestSideCorridor(1350,1340,132,1370),{x:1394,side:'RIGHT'});
 assert.deepEqual(nearestSideCorridor(338,224,132,1370,2),{x:1394,side:'RIGHT'});
});
