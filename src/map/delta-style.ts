import type {Settings} from '../persistence/settings';
import {format} from '../ui/components/dom';
export const deltaLabels={p:{name:'Aktif güç',symbol:'ΔP',unit:'MW'},q:{name:'Reaktif güç',symbol:'ΔQ',unit:'MVAr'},v:{name:'Gerilim',symbol:'ΔV',unit:'pu'},loading:{name:'Yüklenme',symbol:'ΔYük',unit:'%'}};
export const deltaMaximum=(settings:Settings)=>settings.deltaMetric==='loading'?settings.deltaLoad:settings.deltaMetric==='q'?settings.deltaQ:settings.deltaMetric==='v'?settings.deltaV:settings.deltaP;
export const displayDelta=(value:number|null|undefined,digits=2):number|null=>value==null||!Number.isFinite(value)?null:Math.abs(value)<.5*10**-digits?0:value;
export const signedValue=(value:number|null|undefined,digits=2)=>{const shown=displayDelta(value,digits);return shown==null?'—':(shown>0?'+':'')+format(shown,digits);};
/** Display-only diverging scale: stronger absolute deltas darken the configured hue. */
export function deltaColor(value:number|null|undefined,settings:Settings):string {
  if(value==null||!Number.isFinite(value))return '#708596';
  if(Math.abs(value)<1e-9)return settings.deltaNeutral;
  const color=value>0?settings.deltaUp:settings.deltaDown,t=Math.min(1,Math.abs(value)/deltaMaximum(settings));
  const rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));
  const channels=rgb.map(c=>Math.round(t<.5?c+(255-c)*(.58*(1-t*2)):c*(1-.42*(t-.5)*2)));
  return '#'+channels.map(c=>c.toString(16).padStart(2,'0')).join('');
}
