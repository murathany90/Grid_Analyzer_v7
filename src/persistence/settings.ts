export interface Settings {
  precision:number;pageSize:number;siteSize:number;routeDetail:boolean;
  color400: string; color220:string; color154:string; color66:string; colorLow:string; colorMid: string;
  colorOut: string; colorScenarioOff: string; colorScenarioOn: string; colorNoResult:string;
  loadingColor0:string;loadingColor1:string;loadingColor2:string;loadingColor3:string;loadingColor4:string;
  thresholds: number[]; palette: 'voltage' | 'green'; width400: number; widthMid: number; widthOther: number;
  deltaUp: string; deltaDown: string; deltaNeutral: string; deltaLoad: number; deltaP: number; deltaQ: number; deltaV: number; layoutMode: 'standard' | 'separated'; flowDefault: boolean;
  clearOnBlank: boolean; legend: boolean; displayMode: 'nominal' | 'loading' | 'p' | 'q' | 'v' | 'angle' | 'delta';
  deltaMetric:'p'|'q'|'v'|'loading';voltageMin:number;voltageNeutral:number;voltageMax:number;
  voltageLowColor:string;voltageNeutralColor:string;voltageHighColor:string;
  angleMin:number;angleNeutral:number;angleMax:number;angleNegativeColor:string;angleNeutralColor:string;anglePositiveColor:string;
  magnitudePercentile:number;magnitudePMax:number;magnitudeQMax:number;magnitudeIntensity:number;
  basemapStyle:'dark'|'plain'|'provinces'|'none';showProvinceBorders:boolean;basemapOpacity:number;
  flowSpeed: 'slow' | 'normal' | 'fast'; flowDensity: number; theme: 'dark' | 'light';
}
export const defaultSettings = (): Settings => ({
  deltaMetric:'p',voltageMin:.90,voltageNeutral:1,voltageMax:1.10,voltageLowColor:'#508bc2',voltageNeutralColor:'#bccbd3',voltageHighColor:'#e4a66a',
  angleMin:-20,angleNeutral:0,angleMax:20,angleNegativeColor:'#4f91cc',angleNeutralColor:'#becbd1',anglePositiveColor:'#d8965d',
  magnitudePercentile:95,magnitudePMax:0,magnitudeQMax:0,magnitudeIntensity:1,
  basemapStyle:'dark',showProvinceBorders:true,basemapOpacity:.7,precision:2,pageSize:20,siteSize:2.5,routeDetail:true,
  color400:'#e6534e',color220:'#8d80d8',color154:'#449bda',color66:'#51b6bc',colorLow:'#8fb0a0',colorMid:'#449bda',
  colorOut:'#708596',colorScenarioOff:'#e18b55',colorScenarioOn:'#53d2a4',colorNoResult:'#708596',
  loadingColor0:'#c5dbe3',loadingColor1:'#a9d4d3',loadingColor2:'#e5c66b',loadingColor3:'#e58b58',loadingColor4:'#c94345',
  thresholds:[50,65,80,100],palette:'voltage',width400:3,widthMid:2,widthOther:1.4,
  deltaUp:'#e75e6c',deltaDown:'#43baca',deltaNeutral:'#b4bec4',deltaLoad:30,deltaP:300,deltaQ:100,deltaV:.05,
  layoutMode:'standard',flowDefault:true,clearOnBlank:true,legend:true,displayMode:'nominal',flowSpeed:'normal',flowDensity:4,theme:'dark'
});
export class SettingsStore {
  value = defaultSettings();
  constructor() { try { this.update(JSON.parse(localStorage.getItem('grid-analyzer-v7-settings') || '{}'), false); } catch { /* Storage is optional on file://. */ } }
  update(input: Partial<Settings>, persist = true): void {
    const next = { ...this.value };
    for (const key of Object.keys(next) as (keyof Settings)[]) {
      const value = input[key];
      if (typeof value === typeof next[key] && value !== undefined) Object.assign(next, { [key]: value });
    }
    for (const key of ['color400','color220','color154','color66','colorLow','colorMid','colorOut','colorScenarioOff','colorScenarioOn','colorNoResult','loadingColor0','loadingColor1','loadingColor2','loadingColor3','loadingColor4','voltageLowColor','voltageNeutralColor','voltageHighColor','angleNegativeColor','angleNeutralColor','anglePositiveColor','deltaUp','deltaDown','deltaNeutral'] as const)
      if (!/^#[0-9a-f]{6}$/i.test(next[key])) next[key] = this.value[key];
    next.thresholds = Array.isArray(next.thresholds) && next.thresholds.length === 4 && next.thresholds.every(Number.isFinite) ? next.thresholds.map(x => Math.max(0, Math.min(300, x))).sort((a,b) => a-b) : [...this.value.thresholds];
    for (const key of ['width400', 'widthMid', 'widthOther', 'deltaLoad', 'deltaP', 'deltaQ', 'deltaV', 'flowDensity'] as const) if (!Number.isFinite(next[key]) || next[key] <= 0) next[key] = this.value[key];
    const enums = {palette:['voltage','green'],layoutMode:['standard','separated'],displayMode:['nominal','loading','p','q','v','angle','delta'],deltaMetric:['p','q','v','loading'],basemapStyle:['dark','plain','provinces','none'],flowSpeed:['slow','normal','fast'],theme:['dark','light']} as const;
    for (const key of Object.keys(enums) as (keyof typeof enums)[]) if (!(enums[key] as readonly string[]).includes(next[key])) Object.assign(next,{[key]:this.value[key]});
    next.precision=Math.round(Math.max(0,Math.min(8,next.precision||0)));next.pageSize=Math.round(Math.max(10,Math.min(100,next.pageSize||20)));next.siteSize=Math.max(1,Math.min(10,next.siteSize||2.5));
    if(!Number.isFinite(next.voltageMin)||next.voltageMin<=0||next.voltageMin>=2)next.voltageMin=this.value.voltageMin;
    if(!Number.isFinite(next.voltageNeutral)||next.voltageNeutral<=0||next.voltageNeutral>=2)next.voltageNeutral=this.value.voltageNeutral;
    if(!Number.isFinite(next.voltageMax)||next.voltageMax<=0||next.voltageMax>2)next.voltageMax=this.value.voltageMax;
    if(!(next.voltageMin<next.voltageNeutral&&next.voltageNeutral<next.voltageMax)){next.voltageMin=this.value.voltageMin;next.voltageNeutral=this.value.voltageNeutral;next.voltageMax=this.value.voltageMax;}
    if(!Number.isFinite(next.angleMin)||!Number.isFinite(next.angleNeutral)||!Number.isFinite(next.angleMax)||!(next.angleMin<next.angleNeutral&&next.angleNeutral<next.angleMax)||next.angleMin< -180||next.angleMax>180){next.angleMin=this.value.angleMin;next.angleNeutral=this.value.angleNeutral;next.angleMax=this.value.angleMax;}
    if(!Number.isFinite(next.magnitudePercentile)||next.magnitudePercentile<50||next.magnitudePercentile>99.9)next.magnitudePercentile=this.value.magnitudePercentile;
    for(const key of ['magnitudePMax','magnitudeQMax'] as const)if(!Number.isFinite(next[key])||next[key]<0)next[key]=this.value[key];
    if(!Number.isFinite(next.magnitudeIntensity)||next.magnitudeIntensity<.1||next.magnitudeIntensity>2)next.magnitudeIntensity=this.value.magnitudeIntensity;
    next.basemapOpacity=Number.isFinite(next.basemapOpacity)?Math.max(0,Math.min(1,next.basemapOpacity)):this.value.basemapOpacity;
    this.value = next;
    if (persist) try { localStorage.setItem('grid-analyzer-v7-settings', JSON.stringify(next)); } catch { /* Private/portable environments may deny persistence. */ }
  }
  reset(): void { this.update(defaultSettings()); }
}
