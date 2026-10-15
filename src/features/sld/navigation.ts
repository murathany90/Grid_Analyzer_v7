import type {CanonicalNetwork,Line} from '../../domain/model/network';
/** Never resolve a station from a line name. Ambiguous multi-owner terminals fail closed. */
export function oppositeStation(network:CanonicalNetwork,lineId:string,currentSiteId:string){
  const line=network.lines.find(l=>l.id===lineId||l.sourceId===lineId);if(!line)return null;
  const a=network.buses.find(t=>t.id===line.from),b=network.buses.find(t=>t.id===line.to);
  if(!a||!b||a.siteIds.length!==1||b.siteIds.length!==1||a.siteIds[0]===b.siteIds[0])return null;
  const target=a.siteIds[0]===currentSiteId?b.siteIds[0]:b.siteIds[0]===currentSiteId?a.siteIds[0]:null;
  const site=network.sites.find(s=>s.id===target);return site?{site,line,localTerminalId:a.siteIds[0]===currentSiteId?line.from:line.to,remoteTerminalId:a.siteIds[0]===currentSiteId?line.to:line.from}:null;
}
export interface SldVisit {siteId:string;lineId:string;scope:'station';bayId:string}
export class SldNavigationHistory {
  private visits:SldVisit[]=[];
  push(visit:SldVisit){this.visits.push({...visit});if(this.visits.length>40)this.visits.shift();}
  back():SldVisit|null{return this.visits.pop()??null;}
  get length(){return this.visits.length;}
  clear(){this.visits=[];}
}
export function branchTerminalIds(e:Pick<Line,'from'|'to'>){return [e.from,e.to];}
