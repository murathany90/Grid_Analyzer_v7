/** Author two original three-bus DC conditioning witnesses; no user model inputs. */
import fs from 'node:fs';
const original=JSON.parse(fs.readFileSync('.tmp/psse-synthetic/basic.rawx','utf8'));
const idx=(table:{fields:string[]})=>new Map(table.fields.map((field,i)=>[field,i]));
const manifest:unknown[]=[];fs.mkdirSync('private-re/v2-dc-tiny-precision',{recursive:true});
for(const [name,x,r]of [['well-conditioned',.01625,.00125],['ill-conditioned',.00001625,.00000125]] as const){
 const fixture=structuredClone(original),n=fixture.network,b=idx(n.bus),g=idx(n.generator),l=idx(n.load),a=idx(n.acline);
 for(const row of n.bus.data){row[b.get('ide')!]=row[b.get('ibus')!]===1?3:1;row[b.get('vm')!]=1;row[b.get('va')!]=0;}
 n.generator.data=n.generator.data.filter((row:unknown[])=>row[g.get('ibus')!]===1);for(const row of n.generator.data){row[g.get('pg')!]=1200;row[g.get('qg')!]=0;row[g.get('vs')!]=1;row[g.get('qt')!]=9999;row[g.get('qb')!]=-9999;row[g.get('pt')!]=5000;}
 const load=n.load.data[0];n.load.data=[[2,1000],[3,200]].map(([bus,p])=>{const row=[...load];row[l.get('ibus')!]=bus;row[l.get('pl')!]=p;row[l.get('ql')!]=0;for(const key of ['ip','iq','yp','yq'])row[l.get(key)!]=0;return row;});
 const branch=n.acline.data[0];n.acline.data=[[1,2,.01,.1],[1,3,.01,.1],[2,3,r,x]].map(([from,to,resistance,reactance])=>{const row=[...branch];row[a.get('ibus')!]=from;row[a.get('jbus')!]=to;row[a.get('rpu')!]=resistance;row[a.get('xpu')!]=reactance;for(const key of ['bpu','gi','bi','gj','bj'])if(a.has(key))row[a.get(key)!]=0;row[a.get('ckt')!]='1';return row;});
 const file=`private-re/v2-dc-tiny-precision/${name}.rawx`;fs.writeFileSync(file,JSON.stringify(fixture,null,2)+'\n');manifest.push({name,file,finiteLinkReactancePu:x,finiteLinkResistancePu:r,externalReactancePu:.1,totalLoadMw:1200,slackVmPu:1,reason:'Only the finite 2-3 R/X changes; R stays nonzero, so THRSHZ must not contract this link.'});
}
fs.writeFileSync('private-re/v2-dc-tiny-precision/manifest.json',JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify(manifest));
