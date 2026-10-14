import type { Shunt, SeriesCompensator } from './network';

export type ReactiveSymbol = 'shunt-reactor' | 'capacitor-bank' | 'series-reactor' | 'series-capacitor' | 'reactive-equivalent';
/** Presentation uses the resolved source ratings; it never guesses from a device name. */
export function shuntSymbol(shunt: Shunt): ReactiveSymbol {
  if (shunt.stepProvenance === 'INVALID_MTAPS' || shunt.stepProvenance === 'INVALID_RATING') return 'reactive-equivalent';
  const q = shunt.nominalQMvar ?? shunt.bPu;
  return q < 0 ? 'shunt-reactor' : q > 0 ? 'capacitor-bank' : 'reactive-equivalent';
}
export function seriesSymbol(series: SeriesCompensator): ReactiveSymbol {
  return series.xOhm < 0 ? 'series-capacitor' : series.xOhm > 0 ? 'series-reactor' : 'reactive-equivalent';
}
