import {deltaColor,deltaMaximum} from './delta-style';
import {flowMagnitude,branchMapDelta} from './electrical-overlays';
import { voltageBand } from '../domain/model/voltage-band';
import type { Line } from '../domain/model/network';
import type { BranchResult } from '../domain/results/types';
import type { Settings } from '../persistence/settings';
import {islandColor,type ElectricalIslandSummary} from './island-map';
export interface ResultStyle {color:string;width:number;dash:number[];alpha:number}
export function engineeringLoadingColor(value:number|null|undefined,settings:Settings){const colors=[settings.loadingColor0,settings.loadingColor1,settings.loadingColor2,settings.loadingColor3,settings.loadingColor4,settings.loadingColor5,settings.loadingColor6];return value==null||!Number.isFinite(value)?settings.colorNoResult:value>100?settings.loadingColor6:colors[settings.thresholds.filter(t=>value>t).length];}
export const voltageGroup=(kv:number)=>voltageBand(kv)==='400'?'400':['66','154','220'].includes(voltageBand(kv)||'')?'mid':'other';
export function pLoadingPercent(line:Line,row:BranchResult|undefined):number|null {return row&&line.ratingMva!=null&&line.ratingMva>0?100*Math.max(Math.abs(row.pf),Math.abs(row.pt))/line.ratingMva:null;}
export function qLoadingPercent(kv:number,row:BranchResult|undefined,settings:Settings):number|null {if(!row)return null;const base=kv>=300?settings.qBase400Mvar:settings.qBase154Mvar;return base>0?100*Math.max(Math.abs(row.qf),Math.abs(row.qt))/base:null;}
export function lineStyle(line:Line,inService:boolean,role:string,settings:Settings,result?:BranchResult,base?:BranchResult,magnitudeScale=1,island?:ElectricalIslandSummary):ResultStyle{
  const group=voltageGroup(line.vnKv),band=voltageBand(line.vnKv),color=band==='400'?settings.color400:band==='220'?settings.color220:band==='154'?settings.color154:band==='66'?settings.color66:settings.colorLow;
  const style:ResultStyle={color,width:group==='400'?settings.width400:group==='mid'?settings.widthMid:settings.widthOther,dash:[],alpha:.9};
  if(role!=='base'&&line.inService!==inService){style.color=inService?settings.colorScenarioOn:settings.colorScenarioOff;style.width=Math.max(style.width,2.5);if(!inService)style.dash=[8,5];return style;}
  if(!inService){style.color=settings.colorOut;style.dash=[8,5];style.alpha=.5;return style;}
  if(settings.displayMode==='island'){if(!island||island.status==='NO_REFERENCE'||island.status==='NO_RESULT'){style.color=settings.colorNoResult;style.dash=[5,4];style.alpha=.7;}else style.color=islandColor(island.islandId);return style;}
  if(settings.displayMode==='loading'||settings.displayMode==='q'){const palette=settings.palette==='green'?['#d8f3df','#c5ecd1','#abe4bc','#68ca8e','#47b87d','#329f68','#176943']:[settings.loadingColor0,settings.loadingColor1,settings.loadingColor2,settings.loadingColor3,settings.loadingColor4,settings.loadingColor5,settings.loadingColor6];const value=settings.displayMode==='q'?qLoadingPercent(line.vnKv,result,settings):pLoadingPercent(line,result);const thresholds=settings.displayMode==='q'?settings.qThresholds:settings.thresholds;style.color=value==null?settings.colorNoResult:palette[thresholds.filter(t=>value>=t).length];}
  if(settings.displayMode==='p'){const magnitude=flowMagnitude(result,'p');if(magnitude==null){style.color=settings.colorNoResult;style.alpha=.6;}else{const strength=Math.min(1,magnitude/magnitudeScale)*settings.magnitudeIntensity;style.width=Math.min(5,style.width+.3+1.5*strength);style.alpha=Math.min(1,.35+.65*strength);}}
  if(settings.displayMode==='delta'){const delta=branchMapDelta(base,result,settings.deltaMetric);style.color=deltaColor(delta,settings);if(delta!=null)style.width+=Math.min(1.5,Math.abs(delta)/deltaMaximum(settings));}

  return style;
}
