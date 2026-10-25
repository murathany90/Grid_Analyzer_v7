import type { CanonicalNetwork, SourceRef } from './ga-network-types';

type Obj = Record<string, unknown>;
function obj(v: unknown): v is Obj { return typeof v === 'object' && v !== null && !Array.isArray(v); }
function fail(s: string): never { throw new Error(`PSSE_CONTRACT: ${s}`); }
function record(v: unknown, path: string): Obj { if (!obj(v)) fail(path); return v; }
function number(v: unknown): boolean { return typeof v === 'number' && Number.isFinite(v); }
function fields(v: Obj, keys: readonly string[], test: (v: unknown) => boolean, path: string): void {
  for (const k of keys) if (!test(v[k])) fail(`${path}.${k}`);
}
function array(v: unknown, path: string): unknown[] { if (!Array.isArray(v)) fail(path); return v; }
function strings(v: unknown): boolean { return Array.isArray(v) && v.every(x => typeof x === 'string'); }
function sourceRef(v: unknown): v is SourceRef {
  return obj(v) && ['sourceClass', 'sourceId', 'field'].every(k => typeof v[k] === 'string') &&
    (v.unit === undefined || typeof v.unit === 'string');
}

/** Runtime validation at the SDK boundary. No DgsModel and no unchecked cast. */
export function assertCanonical(v: unknown): asserts v is CanonicalNetwork {
  const n = record(v, 'network');
  if (n.schemaVersion !== 1) fail('schemaVersion');
  fields(n, ['modelHash', 'name'], x => typeof x === 'string', 'network');
  fields(n, ['baseMva', 'size', 'records'], number, 'network');
  if (typeof n.baseMva !== 'number' || n.baseMva <= 0) fail('baseMva positive');
  const numeric: Record<string, readonly string[]> = {
    buses:['vnKv'], lines:['vnKv','lengthKm','rOhm','xOhm','bSiemens','sections'],
    transformers:['vnKv','lvKv','rPu','xPu','tap','phase','ratingMva','tapPosition','gPu','bPu'],
    generators:['pMw','qMvar','vmSet'], loads:['pMw','qMvar'], shunts:['gPu','bPu'],
    seriesCompensators:['rOhm','xOhm'], externalGrids:['pMw','qMvar','vmSet'],
    internationalConnections:['pMw','qMvar'], switches:[], stationControllers:['vmSet'],
    secondaryControllers:[], boundaries:[], sites:[]
  };
  const busIds = new Set<string>(); const ids = new Set<string>();
  for (const [table, keys] of Object.entries(numeric)) {
    for (const value of array(n[table], table)) {
      const e = record(value, table);
      fields(e, ['id','name','sourceClass','sourceId'], x => typeof x === 'string', table);
      if (typeof e.id !== 'string' || ids.has(e.id)) fail(`${table}.duplicate id`);
      ids.add(e.id); if (table === 'buses') busIds.add(e.id);
      fields(e, ['inService'], x => typeof x === 'boolean', table);
      if (!strings(e.siteIds)) fail(`${table}.siteIds`);
      const refs = record(e.sourceRefs, `${table}.sourceRefs`);
      for (const [key, values] of Object.entries(refs)) if (!Array.isArray(values) || !values.every(sourceRef)) fail(`${table}.sourceRefs.${key}`);
      fields(e, keys, number, table);
      if (table === 'buses') {
        if (!number(e.vnKv) || Number(e.vnKv) <= 0 || typeof e.parentId !== 'string') fail('bus voltage/parent');
      }
      if (table === 'generators') {
        if (typeof e.voltageControl !== 'boolean') fail('generator control');
        fields(e, ['qMin','qMax'], x => x === null || number(x), table);
      }
      if (table === 'switches' && typeof e.closed !== 'boolean') fail('switch closed');
      if (table === 'lines' && e.ratingMva !== null && !number(e.ratingMva)) fail('line rating');
      if (table === 'sites') {
        fields(e, ['lat','lon'], x => x === null || number(x), table);
        fields(e, ['areaId','areaName'], x => typeof x === 'string', table);
        if (!Array.isArray(e.voltages) || !e.voltages.every(number)) fail('site voltages');
      }
      if (table === 'stationControllers') {
        if (typeof e.remoteBus !== 'string' || !strings(e.unitIds)) fail('controller terminals');
      }
    }
  }
  for (const table of ['lines','transformers','seriesCompensators','switches']) for (const value of array(n[table], table)) {
    const e = record(value, table);
    for (const k of ['from','to']) if (typeof e[k] !== 'string' || !busIds.has(e[k])) fail(`${table}.${k} dangling`);
  }
  for (const table of ['loads','generators','shunts','externalGrids','internationalConnections']) for (const value of array(n[table], table)) {
    const e = record(value, table); if (typeof e.bus !== 'string' || !busIds.has(e.bus)) fail(`${table}.bus dangling`);
  }
  const caps = record(n.capabilities, 'capabilities');
  for (const key of ['powerFlow','shortCircuit3Phase','n1']) {
    const c = record(caps[key], key);
    if (!['READY','PARTIAL','BLOCKED'].includes(String(c.state)) || !strings(c.reasons)) fail(`capability ${key}`);
  }
  const counts = record(n.classCounts, 'classCounts');
  for (const count of Object.values(counts)) if (!number(count)) fail('classCounts numeric');
  if (!strings(n.warnings)) fail('warnings');
  if (n.sourceFidelity !== undefined) {
    const f = record(n.sourceFidelity, 'sourceFidelity');
    fields(f, ['transformerTapFallbackCount','droppedBranchCount','generatorMissingQLimitCount','invalidShuntStepCount'], number, 'sourceFidelity');
    if (!strings(f.transformerTapFallbackIds) || !strings(f.droppedBranchIds) || !['SOURCE_EXACT','PARTIAL'].includes(String(f.fidelity))) fail('sourceFidelity shape');
  }
}

export function readCanonical(value: unknown): CanonicalNetwork { assertCanonical(value); return value; }
export function requireReady(network: CanonicalNetwork, analysis: keyof CanonicalNetwork['capabilities']): void {
  const cap = network.capabilities[analysis];
  if (cap.state !== 'READY') throw new Error(`PSSE_${analysis}_${cap.state}: ${cap.reasons.join('; ')}`);
}
