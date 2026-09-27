import {flowMagnitude,branchMapDelta} from './electrical-overlays';
import { voltageBand } from '../domain/model/voltage-band';
import type { Line } from '../domain/model/network';
import type { BranchResult } from '../domain/results/types';
import type { Settings } from '../persistence/settings';
export interface ResultStyle {color:string;width:number;dash:number[];alpha:number}
export const voltageGroup=(kv:number)=>voltageBand(kv)==='400'?'400':['66','154','220'].includes(voltageBand(kv)||'')?'mid':'other';
export function lineStyle(line:Line,inService:boolean,role:string,settings:Settings,result?:BranchResult,base?:BranchResult,magnitudeScale=1):ResultStyle{
  const group=voltageGroup(line.vnKv),style:ResultStyle={color:group==='400'?settings.color400:group==='mid'?settings.colorMid:'#718697',width:group==='400'?settings.width400:group==='mid'?settings.widthMid:settings.widthOther,dash:[],alpha:.9};
  if((settings.displayMode==='p'||settings.displayMode==='q')&&flowMagnitude(result,settings.displayMode)==null)return{...style,color:'#708596',alpha:.6,dash:inService?[]:[8,5]};
  if(role!=='base'&&line.inService!==inService){style.color=inService?settings.colorScenarioOn:settings.colorScenarioOff;style.width=Math.max(style.width,2.5);if(!inService)style.dash=[8,5];return style;}
  if(!inService){style.color=settings.colorOut;style.dash=[8,5];style.alpha=.5;return style;}
  if(settings.displayMode==='loading'){const palette=settings.palette==='green'?['#d8f3df','#abe4bc','#68ca8e','#329f68','#176943']:group==='400'?['#ffd8d5','#f4aaa4','#e6746c','#c8423d','#8e1919']:['#d9efff','#aad7f5','#6eb9e5','#357fbc','#174d7f'];style.color=result?.loading==null?'#708596':palette[settings.thresholds.filter(t=>result.loading!>=t).length];}
  if(settings.displayMode==='p'||settings.displayMode==='q'){const magnitude=flowMagnitude(result,settings.displayMode);if(magnitude==null){style.color='#708596';style.alpha=.6;}else{const strength=Math.min(1,magnitude/magnitudeScale);style.width=Math.min(5,style.width+.3+1.5*strength);style.alpha=.35+.65*strength;}}
  if(settings.displayMode==='delta'){const delta=branchMapDelta(base,result,settings.deltaMetric);style.color=delta==null?'#708596':Math.abs(delta)<1e-9?settings.deltaNeutral:delta>0?settings.deltaUp:settings.deltaDown;if(delta!=null)style.width+=Math.min(1.5,Math.abs(delta)/(settings.deltaMetric==='loading'?settings.deltaLoad:settings.deltaP));}

  return style;
}
