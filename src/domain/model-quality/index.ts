import type { CanonicalNetwork, Entity, SourceRef } from '../model/network';

export type ModelQualitySeverity = 'BLOCKER' | 'ERROR' | 'WARNING' | 'INFO';
export type ModelQualityCategory = 'TOPOLOGY' | 'ELECTRICAL_DATA' | 'CAPACITY' | 'CONTROLLER' | 'REDUCED_MODEL' | 'PROVENANCE';
export interface ModelQualityFinding {
  readonly id: string; readonly code: string; readonly severity: ModelQualitySeverity; readonly category: ModelQualityCategory;
  readonly entityClass: string | null; readonly entityId: string | null; readonly entityName: string | null;
  readonly field: string | null; readonly originalValue: unknown; readonly normalizedValue: unknown; readonly unit: string | null;
  readonly message: string; readonly calculationImpact: string; readonly sourceRefs: readonly SourceRef[];
}
export interface ModelQualityAuditContext {
  readonly preparationDiagnostics?: Readonly<Record<string, unknown>>;
  readonly reducedModelDiagnostics?: Readonly<Record<string, unknown>>;
}
export interface ModelQualityAuditSummary {
  readonly total: number;
  readonly counts: Readonly<Record<ModelQualitySeverity, number>>;
  readonly categoryCounts: Readonly<Partial<Record<ModelQualityCategory, number>>>;
}
export interface ModelQualityAuditResult { readonly modelHash: string; readonly findings: readonly ModelQualityFinding[]; readonly summary: ModelQualityAuditSummary }

const SEVERITIES: readonly ModelQualitySeverity[] = ['BLOCKER', 'ERROR', 'WARNING', 'INFO'];
const CATEGORIES: readonly ModelQualityCategory[] = ['TOPOLOGY', 'ELECTRICAL_DATA', 'CAPACITY', 'CONTROLLER', 'REDUCED_MODEL', 'PROVENANCE'];
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const asText = (value: unknown): string => typeof value === 'string' ? value : '';
const asRecord = (value: unknown): Record<string, unknown> | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
const entityRefs = (entity: Entity | undefined, keys: readonly string[] = []): SourceRef[] => {
  if (!entity) return [];
  const selected = keys.flatMap(key => entity.sourceRefs[key] || []);
  const refs = keys.length === 0 ? [] : selected.length ? selected : Object.values(entity.sourceRefs).flat();
  const unique = new Map<string, SourceRef>();
  for (const ref of refs) unique.set([ref.sourceClass, ref.sourceId, ref.field, ref.unit || ''].join('\u0000'), ref);
  return [...unique.values()].sort((a, b) => a.sourceClass.localeCompare(b.sourceClass) || a.sourceId.localeCompare(b.sourceId) || a.field.localeCompare(b.field) || (a.unit || '').localeCompare(b.unit || ''));
};

type AddFinding = (input: {
  code: string; severity: ModelQualitySeverity; category: ModelQualityCategory; field: string | null;
  originalValue: unknown; normalizedValue: unknown; unit: string | null; message: string; calculationImpact: string;
  entity?: Entity; entityClass?: string | null; entityId?: string | null; entityName?: string | null; refKeys?: readonly string[];
}) => void;

/** Deterministic, read-only audit over canonical data and diagnostics already produced by the app. */
export function auditModelQuality(network: CanonicalNetwork, context: ModelQualityAuditContext = {}): ModelQualityAuditResult {
  const findings: ModelQualityFinding[] = [];
  const findingIdCounts = new Map<string, number>();
  const add: AddFinding = input => {
    const entityClass = input.entityClass ?? input.entity?.sourceClass ?? null;
    const entityId = input.entityId ?? input.entity?.id ?? null;
    const entityName = input.entityName ?? input.entity?.name ?? null;
    const baseId = [input.code, entityClass || 'MODEL', entityId || 'MODEL', input.field || ''].join(':');
    const occurrence = (findingIdCounts.get(baseId) ?? 0) + 1;
    findingIdCounts.set(baseId, occurrence);
    const id = occurrence === 1 ? baseId : `${baseId}:${occurrence}`;
    findings.push({ id, code: input.code, severity: input.severity, category: input.category, entityClass, entityId, entityName,
      field: input.field, originalValue: input.originalValue, normalizedValue: input.normalizedValue, unit: input.unit,
      message: input.message, calculationImpact: input.calculationImpact, sourceRefs: entityRefs(input.entity, input.refKeys) });
  };
  const checkNumber = (entity: Entity, field: string, value: unknown, unit: string, code: string, label: string,
    valid: (n: number) => boolean, severity: ModelQualitySeverity, impact: string): void => {
    if (!finite(value) || !valid(value)) add({ code, severity, category: 'ELECTRICAL_DATA', entity, field, originalValue: value,
      normalizedValue: null, unit, message: entity.name + ': ' + label + ' is invalid.', calculationImpact: impact, refKeys: [field] });
  };
  const busIds = new Set(network.buses.map(bus => bus.id));
  for (const bus of network.buses) checkNumber(bus, 'vnKv', bus.vnKv, 'kV', 'BUS_VN_INVALID', 'nominal voltage', n => n > 0, 'BLOCKER', 'Voltage base cannot be formed reliably for this bus.');
  for (const line of network.lines) {
    checkNumber(line, 'rOhm', line.rOhm, 'ohm', 'LINE_R_INVALID', 'line resistance', n => n >= 0, 'ERROR', 'Line impedance may be omitted or malformed in power-flow calculations.');
    checkNumber(line, 'xOhm', line.xOhm, 'ohm', 'LINE_X_INVALID', 'line reactance', n => n > 0, 'ERROR', 'Positive series reactance is required by the current power-flow and DC models.');
    checkNumber(line, 'lengthKm', line.lengthKm, 'km', 'LINE_LENGTH_INVALID', 'line length', n => n > 0, 'ERROR', 'Line electrical parameters may not represent the intended physical length.');
    const cap = line.capacity;
    const seasonal = cap?.seasonalReference;
    const available = !!cap && ((Number.isFinite(cap.nominalMVA) && cap.nominalMVA! > 0) || !!seasonal?.matched && [seasonal.summerMVA, seasonal.winterMVA].some(v => Number.isFinite(v) && (v || 0) > 0));
    if (line.inService && !available) add({ code: 'LINE_CAPACITY_UNAVAILABLE', severity: 'WARNING', category: 'CAPACITY', entity: line, field: 'capacity', originalValue: line.capacity ?? line.ratingMva, normalizedValue: null, unit: 'MVA', message: line.name + ': usable line capacity is unavailable.', calculationImpact: 'Thermal loading and overload checks cannot be established for this line.', refKeys: ['capacity', 'ratingMva'] });
    if (!busIds.has(line.from) || !busIds.has(line.to)) add({ code: 'LINE_ENDPOINT_UNRESOLVED', severity: 'ERROR', category: 'TOPOLOGY', entity: line, field: !busIds.has(line.from) ? 'from' : 'to', originalValue: !busIds.has(line.from) ? line.from : line.to, normalizedValue: null, unit: null, message: line.name + ': endpoint terminal is unresolved.', calculationImpact: 'The line may not be represented in network topology.', refKeys: ['from', 'to'] });
  }
  for (const transformer of network.transformers) {
    checkNumber(transformer, 'rPu', transformer.rPu, 'pu', 'TRANSFORMER_R_INVALID', 'transformer resistance', n => n >= 0, 'ERROR', 'Transformer impedance may be omitted or malformed.');
    checkNumber(transformer, 'xPu', transformer.xPu, 'pu', 'TRANSFORMER_X_INVALID', 'transformer reactance', n => n > 0, 'ERROR', 'Transformer impedance may be omitted or malformed.');
    checkNumber(transformer, 'tap', transformer.tap, 'pu', 'TRANSFORMER_TAP_INVALID', 'transformer tap', n => n > 0, 'ERROR', 'Transformer voltage ratio may be invalid in the network model.');
    checkNumber(transformer, 'ratingMva', transformer.ratingMva, 'MVA', 'TRANSFORMER_RATING_INVALID', 'transformer rating', n => n > 0, 'WARNING', 'Transformer loading cannot be assessed reliably.');
    if (!busIds.has(transformer.from) || !busIds.has(transformer.to)) add({ code: 'TRANSFORMER_ENDPOINT_UNRESOLVED', severity: 'ERROR', category: 'TOPOLOGY', entity: transformer, field: !busIds.has(transformer.from) ? 'from' : 'to', originalValue: !busIds.has(transformer.from) ? transformer.from : transformer.to, normalizedValue: null, unit: null, message: transformer.name + ': endpoint terminal is unresolved.', calculationImpact: 'The transformer may not be represented in network topology.', refKeys: ['from', 'to'] });
  }
  for (const generator of network.generators) {
    if (generator.qMin == null || generator.qMax == null || !finite(generator.qMin) || !finite(generator.qMax)) add({ code: 'GENERATOR_Q_LIMITS_MISSING', severity: 'WARNING', category: 'ELECTRICAL_DATA', entity: generator, field: 'qMin/qMax', originalValue: { qMin: generator.qMin, qMax: generator.qMax }, normalizedValue: null, unit: 'MVAr', message: generator.name + ': reactive power limits are unavailable.', calculationImpact: 'Reactive limit enforcement cannot be represented for this generator.', refKeys: ['qLimits'] });
    else if (generator.qMin > generator.qMax) add({ code: 'GENERATOR_Q_LIMITS_REVERSED', severity: 'ERROR', category: 'ELECTRICAL_DATA', entity: generator, field: 'qMin/qMax', originalValue: { qMin: generator.qMin, qMax: generator.qMax }, normalizedValue: null, unit: 'MVAr', message: generator.name + ': Qmin exceeds Qmax.', calculationImpact: 'Generator reactive operating range is inconsistent.', refKeys: ['qLimits'] });
    checkNumber(generator, 'vmSet', generator.vmSet, 'pu', 'GENERATOR_VM_SET_INVALID', 'voltage setpoint', n => n > 0, 'ERROR', 'Voltage-controlled bus target may be invalid.');
  }
  for (const grid of network.externalGrids) checkNumber(grid, 'vmSet', grid.vmSet, 'pu', 'REFERENCE_VM_SET_INVALID', 'reference voltage setpoint', n => n > 0, 'ERROR', 'Reference-bus voltage target may be invalid.');

  const generatorById = new Map(network.generators.map(generator => [generator.id, generator]));
  for (const controller of network.stationControllers.filter(item => item.inService)) {
    if (!busIds.has(controller.remoteBus)) add({ code: 'CONTROLLER_REMOTE_UNRESOLVED', severity: 'ERROR', category: 'CONTROLLER', entity: controller, field: 'remoteBus', originalValue: controller.remoteBus, normalizedValue: null, unit: null, message: controller.name + ': remote bus cannot be resolved.', calculationImpact: 'Remote voltage control cannot be mapped to a network bus.', refKeys: ['remoteBus'] });
    for (const unitId of controller.unitIds) if (!generatorById.has(unitId)) add({ code: 'CONTROLLER_UNIT_UNRESOLVED', severity: 'ERROR', category: 'CONTROLLER', entity: controller, field: 'unitIds', originalValue: unitId, normalizedValue: null, unit: null, message: controller.name + ': controlled unit ' + unitId + ' cannot be resolved.', calculationImpact: 'Controller participation and reactive dispatch are incomplete.', refKeys: ['unitIds'] });
    const units = controller.unitIds.map(unitId => generatorById.get(unitId)).filter((generator): generator is NonNullable<typeof generator> => !!generator);
    if (units.some(unit => unit.qMin == null || unit.qMax == null)) add({ code: 'CONTROLLER_Q_LIMITS_UNAVAILABLE', severity: 'WARNING', category: 'CONTROLLER', entity: controller, field: 'unitIds', originalValue: controller.unitIds, normalizedValue: null, unit: 'MVAr', message: controller.name + ': one or more controlled units lack reactive limits.', calculationImpact: 'Controller reactive dispatch cannot be bounded by the unit limits.', refKeys: ['unitIds', 'controlModeRaw'] });
  }
  addPreparationFindings(context.preparationDiagnostics, add);
  addReducedFindings(context.reducedModelDiagnostics, add);
  const provenanceEntities = [
    ...network.lines.map(entity => ({ entity, key: 'impedance', field: 'rOhm/xOhm' })),
    ...network.transformers.map(entity => ({ entity, key: 'impedance', field: 'rPu/xPu' })),
  ];
  for (const item of provenanceEntities) if (!item.entity.sourceRefs[item.key]?.length) add({ code: 'MATERIAL_PROVENANCE_MISSING', severity: 'INFO', category: 'PROVENANCE', entity: item.entity, field: item.field, originalValue: null, normalizedValue: null, unit: null, message: item.entity.name + ': source reference for material electrical data is unavailable.', calculationImpact: 'The value cannot be traced back to its source field for review.' });

  findings.sort((a, b) => SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity) || a.category.localeCompare(b.category) || a.code.localeCompare(b.code) || (a.entityClass || '').localeCompare(b.entityClass || '') || (a.entityId || '').localeCompare(b.entityId || '') || (a.field || '').localeCompare(b.field || ''));
  const counts = Object.fromEntries(SEVERITIES.map(severity => [severity, findings.filter(item => item.severity === severity).length])) as Record<ModelQualitySeverity, number>;
  const categoryCounts = Object.fromEntries(CATEGORIES.flatMap(category => { const count = findings.filter(item => item.category === category).length; return count ? [[category, count]] : []; })) as Partial<Record<ModelQualityCategory, number>>;
  return { modelHash: network.modelHash, findings, summary: { total: findings.length, counts, categoryCounts } };
}

function addPreparationFindings(diagnostics: Readonly<Record<string, unknown>> | undefined, add: AddFinding): void {
  if (!diagnostics) return;
  const islands = Array.isArray(diagnostics.islands) ? diagnostics.islands : [];
  for (const raw of islands) {
    const island = asRecord(raw); if (!island) continue;
    const status = asText(island.status); const id = asText(island.islandId) || null;
    if (status === 'NO_REFERENCE') add({ code: 'ISLAND_WITHOUT_REFERENCE', severity: 'BLOCKER', category: 'TOPOLOGY', field: 'referenceSource', originalValue: null, normalizedValue: null, unit: null, entityClass: 'Island', entityId: id, entityName: null, message: (id || 'Island') + ' has no reference source.', calculationImpact: 'Power flow cannot be solved for this island.' });
    else if (status === 'MULTIPLE_REFERENCE_PARTIAL') add({ code: 'ISLAND_MULTIPLE_REFERENCES', severity: 'WARNING', category: 'TOPOLOGY', field: 'referenceCount', originalValue: island.referenceCount, normalizedValue: null, unit: null, entityClass: 'Island', entityId: id, entityName: null, message: (id || 'Island') + ' contains multiple reference sources.', calculationImpact: 'Reference and active-power balancing semantics are only partially defined.' });
  }
  const mappings = Array.isArray(diagnostics.stationControllerMappings) ? diagnostics.stationControllerMappings : [];
  for (const raw of mappings) {
    const mapping = asRecord(raw); if (!mapping || mapping.status !== 'NO_REFERENCE_ISLAND') continue;
    const id = asText(mapping.id) || null;
    add({ code: 'CONTROLLER_REMOTE_NO_REFERENCE', severity: 'ERROR', category: 'CONTROLLER', field: 'remoteBus', originalValue: mapping.remoteTerminalId ?? null, normalizedValue: null, unit: null, entityClass: 'ElmStactrl', entityId: id, entityName: null, message: 'Station controller ' + (id || '(unknown)') + ' is on an island without a reference source.', calculationImpact: 'The controlled island has no defined power-flow reference.' });
  }
  const summary = asRecord(diagnostics.stationControllerSummary);
  if (typeof summary?.unitDuplicates === 'number' && summary.unitDuplicates > 0) add({ code: 'CONTROLLER_DUPLICATE_UNIT_OWNERSHIP', severity: 'WARNING', category: 'CONTROLLER', field: 'unitIds', originalValue: summary.unitDuplicates, normalizedValue: null, unit: 'count', entityClass: 'ElmStactrl', entityId: null, entityName: null, message: summary.unitDuplicates + ' duplicate controller unit ownership entries were detected.', calculationImpact: 'Reactive control ownership may be ambiguous.' });
  if (typeof summary?.localVoltageConflicts === 'number' && summary.localVoltageConflicts > 0) add({ code: 'CONTROLLER_LOCAL_VOLTAGE_CONFLICT', severity: 'WARNING', category: 'CONTROLLER', field: 'remoteBus', originalValue: summary.localVoltageConflicts, normalizedValue: null, unit: 'count', entityClass: 'ElmStactrl', entityId: null, entityName: null, message: summary.localVoltageConflicts + ' controller-to-local voltage control conflicts were detected.', calculationImpact: 'Multiple controllers may claim incompatible voltage-control locations.' });
}

function addReducedFindings(diagnostics: Readonly<Record<string, unknown>> | undefined, add: AddFinding): void {
  if (!diagnostics) return;
  const excluded = diagnostics.excludedInputs;
  if (typeof excluded === 'number' && excluded > 0) add({ code: 'REDUCED_MODEL_INPUTS_EXCLUDED', severity: 'WARNING', category: 'REDUCED_MODEL', field: 'excludedInputs', originalValue: excluded, normalizedValue: null, unit: 'count', entityClass: 'ReducedModel', entityId: null, entityName: null, message: excluded + ' inputs were excluded from the reduced model.', calculationImpact: 'The reduced result does not include all in-service equipment injections.' });
  const unresolved = diagnostics.seriesUnresolved;
  if (typeof unresolved === 'number' && unresolved > 0) add({ code: 'SERIES_COMPENSATION_UNRESOLVED', severity: 'WARNING', category: 'REDUCED_MODEL', field: 'seriesUnresolved', originalValue: unresolved, normalizedValue: null, unit: 'count', entityClass: 'ReducedModel', entityId: null, entityName: null, message: unresolved + ' series compensators could not be represented in the reduced model.', calculationImpact: 'Reduced-model branch reactance may not include series compensation.' });
}
