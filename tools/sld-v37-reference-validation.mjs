import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {inspectPilotSvg} from './sld-v36-pilot-oracle.mjs';
const dir='local-benchmark-results/sld-v37-three-references'+(process.argv.includes('--labels')?'/lf':''),data=JSON.parse(await readFile('local-benchmark-results/sld-v36-kayas-pilot/fixtures-private.json','utf8')),metrics=JSON.parse(await readFile(`${dir}/metrics-private.json`,'utf8')),rows=[],conductors=[];
for(const f of data.fixtures){const xml=await readFile(`${dir}/AFTER-${f.site.id}.svg`,'utf8'),p=inspectPilotSvg(xml,f.graph,'all'),m=metrics.rows.find(r=>r.id===f.site.id);
 assert.deepEqual(p.errors,[]);assert.deepEqual(p.overlap,[]);assert.deepEqual(p.foreignTouches,[]);assert.deepEqual(m.fullSeries.errors,[]);assert.deepEqual(m.visual.overlaps,[]);assert.deepEqual(m.visual.textErrors,[]);assert.deepEqual(m.visual.portErrors,[]);assert.deepEqual(m.visual.sharedFeederAnchors,[]);
 assert.equal(m.barHops,0);assert.equal(p.switches,f.graph.switches.length);assert.equal(p.uniqueSwitches,f.graph.switches.length);assert.equal(p.bars,f.graph.busSections.length);assert.equal(m.feeders,f.graph.feeders.length);
 const open=p.ledger.find(r=>r.state==='OPEN'),group=xml.match(new RegExp(`<g[^>]*data-id="${open.owner}"[^>]*>`))[0],a=group.match(/data-contact-in="([^"]+)"/)[1],b=group.match(/data-contact-out="([^"]+)"/)[1],inject=s=>xml.replace('</svg>',s+'</svg>');
 assert.ok(inspectPilotSvg(inject(`<path data-connection="orthogonal" data-native-terminal="${open.terminal}" d="M${a} L${b}"/>`),f.graph,'all').errors.some(e=>e.includes('Open gap bridged')));
 const line=xml.match(/<path[^>]*data-source-conductor[^>]*>/)[0];assert.ok(inspectPilotSvg(inject(line),f.graph,'all').overlap.length);
 const erased=xml.replace(line,line.replace(/ d="[^"]*"/,' d=""'));assert.ok(inspectPilotSvg(erased,f.graph,'all').errors.some(e=>e.includes('Missing shared source interval')));
 assert.ok(inspectPilotSvg(xml.replace('data-from="','data-from="FABRICATED_'),f.graph,'all').errors.some(e=>e.includes('Source endpoint mismatch')));
 rows.push({site:f.site.id,box:m.box,bays:p.sourceBays,switches:p.switches,bars:p.bars,transformers:p.transformers,barHops:m.barHops,errors:0,overlap:0,foreignContacts:0,textErrors:0,negativeMutationsRejected:4,leaves:p.leafReport});conductors.push(...p.ledger.map(r=>({site:f.site.id,...r})));
}
await writeFile(`${dir}/independent-audit.json`,JSON.stringify(rows,null,2));
const csv=rows=>rows.map(r=>r.map(v=>JSON.stringify(String(v))).join(',')).join('\n');await writeFile(`${dir}/independent-conductors.csv`,csv([['site','owner','nativeTerminal','contactSide','state','visiblePath'],...conductors.map(r=>[r.site,r.owner,r.terminal,r.side,r.state,r.path])]));
console.log(JSON.stringify(rows.map(({leaves,...r})=>r)));
