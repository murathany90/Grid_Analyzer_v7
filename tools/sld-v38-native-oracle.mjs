import {SaxesParser} from 'saxes';
/** Independent oracle: expectations are raw cubicle endpoints and structural
 * components, never the production pruning function or its visibility count. */
const rawIndexes=new WeakMap();
export function inspectSwitchVisibility(xml,graph,raw){
 const p=new SaxesParser(),visible=[],attributes=[];p.on('opentag',t=>{attributes.push(t.attributes);if(t.attributes['data-physical-switch'])visible.push(t.attributes['data-id']);});p.write(xml).close();
 let index=rawIndexes.get(raw);if(!index){const byTerm=new Map();for(const c of raw.StaCubic)byTerm.set(c.fold_id,[...(byTerm.get(c.fold_id)??[]),c]);index={byTerm,cubs:new Map(raw.StaCubic.map(c=>[c.FID,c])),switches:new Map(raw.ElmCoup.map(s=>[s.FID,s]))};rawIndexes.set(raw,index);}
 const {byTerm,cubs,switches}=index,errors=[],shown=new Set(visible),missing=graph.switches.filter(s=>!shown.has(s.id)),hidden=new Set(missing.map(s=>s.id)),expected=new Set((graph.sourceAudit?.switchDrawing??[]).filter(r=>r.classification==='HIDE_NONFUNCTIONAL_SOURCE_LEAF').map(r=>r.switchId));
 if(visible.length!==shown.size)errors.push('Duplicate physical switch');
 for(const id of shown)if(!graph.switches.some(s=>s.id===id)||expected.has(id))errors.push('Unexpected visible switch '+id);
 for(const id of expected)if(!hidden.has(id))errors.push('Hidden switch still visible '+id);
 const anchors=new Set([...graph.busSections.map(b=>b.id),...graph.equipment.flatMap(e=>e.terminals)]),adj=new Map();for(const s of missing)for(const id of [s.from,s.to])adj.set(id,[...(adj.get(id)??[]),s]);
 const retained=new Set(graph.switches.filter(s=>shown.has(s.id)).flatMap(s=>[s.from,s.to])),visited=new Set(),components=[];
 for(const start of adj.keys()){if(visited.has(start))continue;const nodes=[start],edges=new Set();visited.add(start);for(let i=0;i<nodes.length;i++)for(const s of adj.get(nodes[i])??[]){edges.add(s.id);const next=s.from===nodes[i]?s.to:s.from;if(!visited.has(next)){visited.add(next);nodes.push(next);}}
  const boundary=nodes.filter(id=>anchors.has(id)||retained.has(id));if(boundary.length>1)errors.push('Functional path hidden between anchors '+boundary.join(','));
  const removed=nodes.filter(id=>!boundary.includes(id));for(const id of removed){if(anchors.has(id))errors.push('Equipment/bar terminal hidden '+id);for(const c of byTerm.get(id)??[])if(!edges.has(c.obj_id))errors.push('Foreign cubicle owner on hidden branch '+id+':'+c.obj_id);for(const a of attributes)if([a['data-id'],a['data-port'],a['data-native-terminal'],a['data-junction'],a['data-source-leaf-caption']].includes(id))errors.push('Hidden terminal/wire/icon remains '+id);}
  components.push({switches:[...edges],boundary,removedTerminals:removed});
 }
 for(const s of missing){const r=switches.get(s.id),ends=r?['bus1','bus2'].map(f=>cubs.get(r[f])?.fold_id):[];if(!expected.has(s.id))errors.push('Unclassified omission '+s.id);if(s.sourceClass!=='ElmCoup'||ends[0]!==s.from||ends[1]!==s.to||['bus1','bus2'].some(f=>cubs.get(r?.[f])?.obj_id!==s.id))errors.push('Raw source mismatch '+s.id);for(const a of attributes)if(a['data-id']===s.id||a['data-physical-switch']==='ElmCoup|'+s.id)errors.push('Hidden device/contact remains '+s.id);}
 return{errors,sourceSwitches:graph.switches.length,visibleSwitches:visible.length,hiddenSwitches:missing.map(s=>s.id),components};
}
