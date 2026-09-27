export interface Settings {
  precision:number;pageSize:number;siteSize:number;routeDetail:boolean;
  color400: string; colorMid: string; colorOut: string; colorScenarioOff: string; colorScenarioOn: string;
  thresholds: number[]; palette: 'voltage' | 'green'; width400: number; widthMid: number; widthOther: number;
  deltaUp: string; deltaDown: string; deltaNeutral: string; deltaLoad: number; deltaP: number; deltaV: number; layoutMode: 'standard' | 'separated'; flowDefault: boolean;
  clearOnBlank: boolean; legend: boolean; displayMode: 'nominal' | 'loading' | 'delta';
  flowSpeed: 'slow' | 'normal' | 'fast'; flowDensity: number; theme: 'dark' | 'light';
}
export const defaultSettings = (): Settings => ({ precision:2,pageSize:20,siteSize:2.5,routeDetail:true,color400: '#e6534e', colorMid: '#449bda', colorOut: '#708596', colorScenarioOff: '#e18b55', colorScenarioOn: '#53d2a4', thresholds: [50, 65, 80, 100], palette: 'voltage', width400: 3, widthMid: 2, widthOther: 1.4, deltaUp: '#e75e6c', deltaDown: '#43baca', deltaNeutral: '#b4bec4', deltaLoad: 10, deltaP: 50, deltaV: .02, layoutMode: 'standard', flowDefault: true, clearOnBlank: true, legend: true, displayMode: 'nominal', flowSpeed: 'normal', flowDensity: 4, theme: 'dark' });
export class SettingsStore {
  value = defaultSettings();
  constructor() { try { this.update(JSON.parse(localStorage.getItem('grid-analyzer-v7-settings') || '{}'), false); } catch { /* Storage is optional on file://. */ } }
  update(input: Partial<Settings>, persist = true): void {
    const next = { ...this.value };
    for (const key of Object.keys(next) as (keyof Settings)[]) {
      const value = input[key];
      if (typeof value === typeof next[key] && value !== undefined) Object.assign(next, { [key]: value });
    }
    for (const key of ['color400', 'colorMid', 'colorOut', 'colorScenarioOff', 'colorScenarioOn', 'deltaUp', 'deltaDown', 'deltaNeutral'] as const)
      if (!/^#[0-9a-f]{6}$/i.test(next[key])) next[key] = this.value[key];
    next.thresholds = Array.isArray(next.thresholds) && next.thresholds.length === 4 && next.thresholds.every(Number.isFinite) ? next.thresholds.map(x => Math.max(0, Math.min(300, x))).sort((a,b) => a-b) : [...this.value.thresholds];
    for (const key of ['width400', 'widthMid', 'widthOther', 'deltaLoad', 'deltaP', 'deltaV', 'flowDensity'] as const) if (!Number.isFinite(next[key]) || next[key] <= 0) next[key] = this.value[key];
    const enums = {palette:['voltage','green'],layoutMode:['standard','separated'],displayMode:['nominal','loading','delta'],flowSpeed:['slow','normal','fast'],theme:['dark','light']} as const;
    for (const key of Object.keys(enums) as (keyof typeof enums)[]) if (!(enums[key] as readonly string[]).includes(next[key])) Object.assign(next,{[key]:this.value[key]});
    next.precision=Math.round(Math.max(0,Math.min(8,next.precision||0)));next.pageSize=Math.round(Math.max(10,Math.min(100,next.pageSize||20)));next.siteSize=Math.max(1,Math.min(10,next.siteSize||2.5));
    this.value = next;
    if (persist) try { localStorage.setItem('grid-analyzer-v7-settings', JSON.stringify(next)); } catch { /* Private/portable environments may deny persistence. */ }
  }
  reset(): void { this.update(defaultSettings()); }
}
