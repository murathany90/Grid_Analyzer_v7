import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {inspectPilotSvg} from './sld-v36-pilot-oracle.mjs';
const out='local-benchmark-results/sld-v36-kayas-pilot',data=JSON.parse(await readFile(`${out}/fixtures-private.json`,'utf8')),fixture=data.fixtures.find(f=>f.site.id==='M1482'),xml=await readFile(`${out}/AFTER-M1482.svg`,'utf8'),proof=inspectPilotSvg(xml,fixture.graph);
assert.deepEqual(proof.pilotErrors,[]);assert.deepEqual(proof.pilotOverlaps,[]);assert.deepEqual(proof.pilotForeignTouches,[]);
assert.equal(proof.switches,128);assert.equal(proof.uniqueSwitches,128);assert.equal(proof.bars,8);assert.equal(proof.sourceBays,28);assert.equal(proof.transformers,6);
// Grouping is checked against the independent source endpoint pairs, not names.
const pairs=proof.bank.map(e=>`${e.hv}|${e.lv}`);assert.equal(new Set(pairs).size,2);assert.equal(pairs[0],pairs[1]);assert.equal(pairs[2],pairs[3]);assert.notEqual(pairs[1],pairs[2]);
for(const b of proof.bank){const e=fixture.graph.equipment.find(e=>e.id===b.id);assert.deepEqual([b.hv,b.lv],e.terminals);}
const nativePilot=fixture.graph.switches.filter(s=>fixture.graph.feeders.some(f=>f.voltageKv>=300&&f.switchIds.includes(s.id))),open=proof.ledger.find(r=>r.pilot&&r.state==='OPEN'),sw=xml.match(new RegExp(`<g[^>]*data-id="${open.owner}"[^>]*>`))[0],a=sw.match(/data-contact-in="([^"]+)"/)[1].split(',').map(Number),b=sw.match(/data-contact-out="([^"]+)"/)[1].split(',').map(Number),inject=path=>xml.replace('</svg>',path+'</svg>');
const badGap=inspectPilotSvg(inject(`<path data-connection="orthogonal" data-native-terminal="${open.terminal}" d="M${a.join(',')} L${b.join(',')}"/>`),fixture.graph);
assert.ok(badGap.pilotErrors.some(e=>e.includes('Open gap bridged '+open.owner)),'negative open-gap bridge must be rejected');
const lead=xml.match(/<path[^>]*data-source-conductor[^>]*>/)[0],badDuplicate=inspectPilotSvg(inject(lead),fixture.graph);assert.ok(badDuplicate.pilotOverlaps.length,'duplicate drawing must be rejected');
const badSource=inspectPilotSvg(xml.replace(`data-from="${nativePilot[0].from}"`,`data-from="FABRICATED"`),fixture.graph);assert.ok(badSource.pilotErrors.some(e=>e.includes('Source endpoint mismatch')));
const before=inspectPilotSvg(await readFile('local-benchmark-results/sld-v36/USER-M1482-CURRENT.svg','utf8'),fixture.graph);
await writeFile(`${out}/oracle-private.json`,JSON.stringify({...proof,baseline:{pilotErrors:before.pilotErrors,pilotOverlaps:before.pilotOverlaps.length},negativeTests:['OPEN_GAP_BRIDGE_REJECTED','DUPLICATE_SEGMENT_REJECTED','FABRICATED_ENDPOINT_REJECTED']},null,2));
const csv=rows=>rows.map(row=>row.map(v=>JSON.stringify(String(v))).join(',')).join('\n');
await writeFile(`${out}/independent-conductors.csv`,csv([['owner','sourceTerminal','contactSide','state','pilot','visiblePath'],...proof.ledger.map(r=>[r.owner,r.terminal,r.side,r.state,r.pilot,r.path])]));
await writeFile(`${out}/source-leaves.csv`,csv([['terminal','sourceName','switchFID','equipmentFID'],...proof.leafReport.map(r=>[r.id,r.name,r.edges.join(';'),r.equipment.join(';')])]));
console.log(JSON.stringify({status:'PILOT_PASS_FULL_STATION_PARTIAL',scope:'M1482 >=300kV',switches:proof.switches,bays:proof.sourceBays,bars:proof.bars,transformers:proof.transformers,pilotErrors:0,pilotOverlaps:0,pilotForeignTouches:0,remainingFullStationErrors:proof.errors.length,negativeTests:3}));
