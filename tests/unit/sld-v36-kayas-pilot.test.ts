import test from 'node:test';
import assert from 'node:assert/strict';
import {railPassPath} from '../../src/features/sld/rail-pass';
import {claimConductor,type OwnedSegment} from '../../src/features/sld/conductor-ledger';
import {ytbsFixture} from '../helpers/sld-ytbs-fixture';
import {connectedStationLayout} from '../../src/features/sld/physical-layout';
import {allVoltageBands} from '../../src/domain/model/voltage-band';

test('Foreign rail crossing has a real optical gap; its native rail remains attached',()=>{
 const rails=[{id:'own',x1:0,x2:100,y:20},{id:'foreign',x1:0,x2:100,y:60}];
 const forward=railPassPath([[40,20],[40,100]],'own',rails),reverse=railPassPath([[40,100],[40,20]],'own',rails);
 assert.equal(forward.d,'M40,20 L40,54 M40,66 L40,100');
 assert.equal(reverse.d,'M40,100 L40,66 M40,54 L40,20');
 assert.deepEqual(forward.passes,[{railId:'foreign',x:40,y:60}]);
 assert.equal(railPassPath([[100,20],[100,100]],'own',rails).passes.length,0);
});

test('Shared native conductor is drawn once with both owners, foreign source nets stay distinct',()=>{
 const ledger:OwnedSegment[]=[];
 claimConductor([0,0],[0,100],'native','breaker',ledger);
 const share=claimConductor([0,120],[0,20],'native','branch',ledger);
 assert.deepEqual(share.fresh.map(s=>[s.a,s.b]),[[[0,120],[0,100]]]);
 assert.deepEqual(share.shared[0].owners,['breaker','branch']);
 assert.equal(claimConductor([0,20],[0,120],'foreign','other',ledger).fresh.length,1);
});

test('Pilot selector routing preserves native direction when source from/to is reversed',()=>{
 const f=ytbsFixture();f.term('H2',400,'G400',true);f.term('root',400,'PX');f.term('end',400,'PX');
 f.sw('s1','H','root','PX');f.sw('s2','H2','root','PX');f.sw('cb','root','end','PX','cbk',false);
 const graph=f.graph();graph.siteId='M1482';
 const check=(g:typeof graph)=>{const p=connectedStationLayout(g,allVoltageBands());for(const id of ['s1','s2']){const r=p.routes.find(s=>s.sw.id===id)!;assert.equal(r.ordering,'BAR_ATTACHMENT');assert.equal(r.wires[0].terminalId,r.sw.from);assert.equal(r.wires[1].terminalId,r.sw.to);assert.deepEqual(r.wires[0].points.at(-1),r.contactFrom);assert.deepEqual(r.wires[1].points[0],r.contactTo);}};
 check(graph);const reverse=structuredClone(graph);for(const s of reverse.switches)if(['s1','s2'].includes(s.id))[s.from,s.to]=[s.to,s.from];check(reverse);
});
