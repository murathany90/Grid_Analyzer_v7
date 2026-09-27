/** Operational filter buckets only. Never replace the source nominal kV with a bucket label. */
export const VOLTAGE_BANDS = [
  { id: '400', label: '400 kV' }, { id: '220', label: '220 kV' },
  { id: '154', label: '154 kV' }, { id: '66', label: '66 kV' }, { id: 'low', label: '≤36 kV' },
] as const;
export type VoltageBand = typeof VOLTAGE_BANDS[number]['id'];
export function voltageBand(kv: number | null | undefined): VoltageBand | null {
  if (kv == null || !Number.isFinite(kv) || kv <= 0) return null;
  return kv >= 300 ? '400' : kv >= 180 ? '220' : kv >= 100 ? '154' : kv > 36 ? '66' : 'low';
}
export const allVoltageBands = (): Set<VoltageBand> => new Set(VOLTAGE_BANDS.map(b => b.id));
export function voltageMatches(kv: number | null | undefined, bands: ReadonlySet<VoltageBand>): boolean {
  const band = voltageBand(kv);
  return band ? bands.has(band) : bands.size === VOLTAGE_BANDS.length;
}
