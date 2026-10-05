import type { PowerFactoryNumericRow } from './pf-kpi';

/**
 * Reader for the PowerFactory numeric benchmark CSV (`PF-GA-BENCHMARK-*`).
 *
 * The export is `;`-separated with a `sep=;` marker line followed by the header row.
 * Decimal values use a comma decimal separator. Only the fields consumed by the
 * canonical KPI calculator are lifted into typed numbers; everything else is ignored.
 */

const NUMBER_FIELDS = new Set([
  'nominalKv',
  'voltageKv',
  'angleDeg',
  'fromVoltageKv',
  'toVoltageKv',
  'pFromMw',
  'qFromMvar',
  'pToMw',
  'qToMvar',
  'pHvMw',
  'qHvMvar',
  'pLvMw',
  'qLvMvar',
  'pResultMw',
  'qResultMvar',
]);

const TEXT_FIELDS = new Set(['kind', 'fid', 'electricalBusKey', 'resultAvailable', 'isReferenceBus']);

export interface PowerFactoryNumericCsv {
  rows: PowerFactoryNumericRow[];
  meta: Record<string, string>;
}

export function parsePowerFactoryNumericCsv(text: string): PowerFactoryNumericCsv {
  const clean = text.replace(/^﻿/, '');
  const lines = clean.split(/\r?\n/);
  let index = 0;
  while (index < lines.length && lines[index].trim() === '') index += 1;
  if (index >= lines.length) throw new Error('PowerFactory reference is empty.');
  const marker = lines[index];
  const separator = marker.startsWith('sep=') ? marker.slice(4).trim() : ';';
  const headerLine = lines[index + 1];
  if (!headerLine) throw new Error('PowerFactory reference has no header row.');
  const headers = headerLine.split(separator);
  const rows: PowerFactoryNumericRow[] = [];
  const meta: Record<string, string> = {};
  for (let line = index + 2; line < lines.length; line += 1) {
    const raw = lines[line];
    if (!raw || raw.trim() === '') continue;
    const cells = raw.split(separator);
    if (cells.length < headers.length) continue;
    const row: Record<string, unknown> = {};
    let metaKey: string | undefined;
    let metaValue: string | undefined;
    for (let column = 0; column < headers.length; column += 1) {
      const header = headers[column];
      const value = cells[column];
      if (header === 'metaKey') metaKey = value || undefined;
      else if (header === 'metaValue') metaValue = value || undefined;
      else if (NUMBER_FIELDS.has(header)) {
        const trimmed = value.trim();
        if (trimmed === '') continue;
        const parsed = Number(trimmed.replace(',', '.'));
        if (Number.isFinite(parsed)) row[header] = parsed;
      } else if (TEXT_FIELDS.has(header) && value !== '') {
        row[header] = value;
      }
    }
    if (row.kind === 'meta') {
      if (metaKey) meta[metaKey] = metaValue ?? '';
      continue;
    }
    if (typeof row.kind === 'string' && typeof row.fid === 'string') rows.push(row as unknown as PowerFactoryNumericRow);
  }
  return { rows, meta };
}
