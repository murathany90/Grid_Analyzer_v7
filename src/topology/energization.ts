import type { CanonicalNetwork, Switch } from '../domain/model/network';
import type { ScenarioOverlay } from '../domain/scenario/overlay';
export interface EnergizationPlan { lineId: string; ready: boolean; restoredTerminals: string[]; closeSwitches: string[]; blockers: string[]; paths: string[][] }
export function planEnergization(network: CanonicalNetwork, lineId: string): EnergizationPlan {
  const line=network.lines.find(l=>l.id===lineId), byId=new Map(network.buses.map(b=>[b.id,b]));
  const plan:EnergizationPlan={lineId,ready:false,restoredTerminals:[],closeSwitches:[],blockers:[],paths:[]};
  if(!line){plan.blockers.push('Hat bulunamadı.');return plan;}
  const adjacency=new Map<string,{to:string;sw:Switch}[]>();
  for(const sw of network.switches.filter(s=>s.sourceClass==='ElmCoup'))for(const [from,to]of[[sw.from,sw.to],[sw.to,sw.from]]){if(!adjacency.has(from))adjacency.set(from,[]);adjacency.get(from)!.push({to,sw});}
  for(const start of[line.from,line.to]){
    const queue=[{id:start,terms:[start],switches:[] as Switch[]}],seen=new Set([start]);let found:typeof queue[number]|undefined;
    for(let qi=0;qi<queue.length;qi++){
      const current=queue[qi];if(byId.get(current.id)?.inService){found=current;break;}
      if(current.switches.length>=14)continue;
      for(const edge of adjacency.get(current.id)||[]){if(seen.has(edge.to)||!edge.sw.inService)continue;seen.add(edge.to);queue.push({id:edge.to,terms:[...current.terms,edge.to],switches:[...current.switches,edge.sw]});}
    }
    if(!found){plan.blockers.push(`${byId.get(start)?.name||'Terminal'}: servis içi bara yolu bulunamadı.`);continue;}
    plan.paths.push(found.terms);plan.restoredTerminals.push(...found.terms.filter(t=>!byId.get(t)?.inService));plan.closeSwitches.push(...found.switches.filter(s=>!s.closed).map(s=>s.id));
  }
  for(const sw of network.switches.filter(s=>s.sourceClass==='StaSwitch'&&s.equipmentId===line.id)){
    if(!sw.inService)plan.blockers.push(`${sw.name}: anahtar servis dışı.`);else if(!sw.closed)plan.closeSwitches.push(sw.id);
  }
  plan.restoredTerminals=[...new Set(plan.restoredTerminals)];plan.closeSwitches=[...new Set(plan.closeSwitches)];plan.ready=plan.paths.length===2&&!plan.blockers.length;return plan;
}
export function applyEnergization(s:ScenarioOverlay,p:EnergizationPlan):ScenarioOverlay{
  if(!p.ready)throw Error('Sanal devreye alma yolu tamamlanmadı.');
  return{...s,lineStatus:{...s.lineStatus,[p.lineId]:true},switchState:{...s.switchState,...Object.fromEntries(p.closeSwitches.map(id=>[id,true]))},restoredTerminals:[...new Set([...s.restoredTerminals,...p.restoredTerminals])]};
}
