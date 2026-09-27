/**
 * Bounded DGS reader and derived network indexes.
 *
 * The source tables stay in their columnar DGS form. Accessors materialize a
 * fresh row object so callers can add display fields without changing source
 * values. Derived indexes are Maps and each source table is traversed a
 * constant number of times during build().
 */

export interface DgsTable {
  readonly Attributes: readonly string[];
  readonly Values: readonly (readonly unknown[])[];
}

export type DgsRawData = Readonly<Record<string, unknown>>;

/** Open, detached object view of one DGS row. Raw DGS attributes are dynamic. */
export interface DgsRecord extends Record<string, unknown> {}

/** Matrix coordinates use the source convention [latitude, longitude]. */
export type DgsCoordinate = readonly [number, number];

export interface DgsSite extends DgsRecord {
  FID: string;
  loc_name: string;
  sType: string;
  groups: DgsRecord[];
  lines: DgsLine[];
  equipment: Record<string, string[]>;
  volts: Set<number>;
  lat: number | null;
  lon: number | null;
  ytmId: string;
  ytm: string;
  lineCount: number;
  bayCount: number;
  transformerCount: number;
  voltageList: string;
  coord: string;
}

export interface DgsLine extends DgsRecord {
  FID: string;
  loc_name: string;
  stationA: string;
  stationB: string;
  voltage: number | null;
  siteA: DgsSite | null;
  siteB: DgsSite | null;
  geoStatus: 'Eksik' | 'Model güzergâhı' | 'Tek koordinat';
  coords: DgsCoordinate[] | null;
}

export interface DgsIssue {
  level: string;
  kind: string;
  cls: string;
  fid: string;
  details: string;
}

export interface DgsStats {
  sites: number;
  real: number;
  virtual: number;
  lines: number;
  geo: number;
  fallback: number;
  tr: number;
  bay: number;
  unit: number;
  load: number;
  rows: number;
}

export type DgsProgress = (message: string) => void;

const EMPTY_STATS = (): DgsStats => ({
  sites: 0,
  real: 0,
  virtual: 0,
  lines: 0,
  geo: 0,
  fallback: 0,
  tr: 0,
  bay: 0,
  unit: 0,
  load: 0,
  rows: 0,
});

const PARENT_CLASSES = ['ElmSubstat', 'ElmBay', 'ElmTerm', 'StaCubic'] as const;
const SKIP_EQUIPMENT_CLASSES = new Set([
  'Matrix',
  'StaCubic',
  'TypSwitch',
  'TypSym',
  'TypLne',
  'TypTr2',
  'IntQlim',
  'ComOutage',
  'ElmSite',
  'ElmLne',
  'ElmSubstat',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRawRow(value: DgsRecord | readonly unknown[]): value is readonly unknown[] {
  return Array.isArray(value);
}

function freezeJsonValue(value: unknown, seen: WeakSet<object>): void {
  if ((typeof value !== 'object' || value === null) || seen.has(value)) return;
  if (!Array.isArray(value) && !isRecord(value)) return;
  seen.add(value);
  for (const child of Object.values(value)) freezeJsonValue(child, seen);
  Object.freeze(value);
}

/** Freeze validated source storage in place, avoiding a second 143 MB copy. */
function freezeDgsTable(value: unknown): DgsTable | null {
  if (!isRecord(value)) return null;
  const attributes = value.Attributes;
  const rows = value.Values;
  if (!Array.isArray(attributes) || !attributes.every((attribute: unknown) => typeof attribute === 'string') || !Array.isArray(rows)) return null;

  const seen = new WeakSet<object>();
  for (const row of rows) {
    if (!Array.isArray(row)) return null;
    for (const cell of row) freezeJsonValue(cell, seen);
    Object.freeze(row);
  }
  Object.freeze(attributes);
  Object.freeze(rows);
  Object.freeze(value);
  return value as unknown as DgsTable;
}

export function cloneDgsValue(value: unknown, seen = new WeakMap<object, unknown>()): unknown {
  if (typeof value !== 'object' || value === null) return value;
  const prior = seen.get(value);
  if (prior !== undefined) return prior;
  if (Array.isArray(value)) {
    const copy: unknown[] = [];
    seen.set(value, copy);
    for (const item of value) copy.push(cloneDgsValue(item, seen));
    return copy;
  }
  if (!isRecord(value)) return value;
  const copy: DgsRecord = {};
  seen.set(value, copy);
  for (const [key, child] of Object.entries(value)) {
    Object.defineProperty(copy, key, {
      value: cloneDgsValue(child, seen),
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }
  return copy;
}

function asIdentifier(value: unknown): string | null {
  if (typeof value === 'string') return value === '' ? null : value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return String(value);
  return null;
}

function asText(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return null;
}

function asNumber(value: unknown): number {
  if (value === null) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string' || typeof value === 'boolean') return Number(value);
  return Number.NaN;
}

function cloneRawRow(table: DgsTable, index: number): DgsRecord | null {
  if (index < 0 || index >= table.Values.length) return null;
  const values = table.Values[index];
  if (!Array.isArray(values)) return null;

  const row: DgsRecord = {};
  const length = Math.min(table.Attributes.length, values.length);
  for (let column = 0; column < length; column += 1) {
    // defineProperty also treats a source attribute named "__proto__" as data.
    Object.defineProperty(row, table.Attributes[column], {
      value: cloneDgsValue(values[column]),
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }
  return row;
}

function defer(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

function makeRid(): string {
  const cryptoApi = globalThis.crypto;
  return cryptoApi?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

export class DgsModel {
  readonly raw: DgsRawData;
  readonly name: string;
  readonly size: number;
  readonly rid: string;

  readonly tables = new Map<string, DgsTable>();
  readonly index = new Map<string, Map<string, number>>();
  readonly attr = new Map<string, Map<string, number>>();
  readonly issues: DgsIssue[] = [];
  readonly parents = new Map<string, string>();
  readonly siteCache = new Map<string, string | null>();
  readonly stationGroups = new Map<string, DgsSite>();
  readonly stationLines = new Map<string, DgsLine[]>();
  readonly stationEquip = new Map<string, Map<string, string[]>>();
  readonly sites: DgsSite[] = [];
  readonly lines: DgsLine[] = [];
  readonly lineIndex = new Map<string, DgsLine>();
  readonly geometry = new Map<string, DgsCoordinate[]>();
  stats: DgsStats = EMPTY_STATS();
  date = '';
  time = '';
  timeKey = '';
  scenario = '';
  version = '';
  analysisStatus = '';

  private readonly groupVoltages = new Map<string, Set<number>>();

  constructor(raw: DgsRawData, name: string, size?: number) {
    this.raw = Object.freeze(raw);
    this.name = name;
    this.size = size ?? 0;
    this.rid = makeRid();
  }

  t(cls: string): DgsTable | undefined {
    return this.tables.get(cls);
  }

  attrAt(cls: string, attribute: string): number {
    return this.attr.get(cls)?.get(attribute) ?? -1;
  }

  get(cls: string, id: unknown): DgsRecord | null {
    const key = asIdentifier(id);
    if (key === null) return null;
    const rowIndex = this.index.get(cls)?.get(key);
    return rowIndex === undefined ? null : this.row(cls, rowIndex);
  }

  row(cls: string, index: number): DgsRecord | null {
    const table = this.t(cls);
    return table ? cloneRawRow(table, index) : null;
  }

  value(cls: string, rowIndex: number, attribute: string): unknown | null {
    const column = this.attrAt(cls, attribute);
    if (column < 0) return null;
    const row = this.t(cls)?.Values[rowIndex];
    if (!row || !Array.isArray(row) || column >= row.length) return null;
    return row[column] == null ? null : cloneDgsValue(row[column]);
  }

  addIssue(kind: string, cls: string, fid: string, details: string, level = 'Uyarı'): void {
    if (this.issues.length < 14_000) this.issues.push({ level, kind, cls, fid, details });
  }

  async build(progress: DgsProgress = () => undefined): Promise<this> {
    this.resetDerivedState();

    for (const [cls, rawTable] of Object.entries(this.raw)) {
      const table = freezeDgsTable(rawTable);
      if (!table) {
        this.addIssue('DGS sınıf yapısı geçersiz', cls, '', 'Attributes / Values dizisi bulunamadı', 'Kritik');
        continue;
      }
      this.tables.set(cls, table);
      const attributes = new Map<string, number>();
      for (let column = 0; column < table.Attributes.length; column += 1) {
        attributes.set(table.Attributes[column], column);
      }
      this.attr.set(cls, attributes);

      if (cls === 'Matrix') continue;
      const fidColumn = attributes.get('FID') ?? -1;
      const foldColumn = attributes.get('fold_id') ?? -1;
      const ids = new Map<string, number>();
      if (fidColumn >= 0) {
        for (let rowIndex = 0; rowIndex < table.Values.length; rowIndex += 1) {
          const values = table.Values[rowIndex];
          if (!Array.isArray(values)) continue;
          const idValue = values[fidColumn];
          const id = asIdentifier(idValue);
          if (id === null) {
            this.addIssue('Eksik FID', cls, '', `Satır ${rowIndex}`);
            continue;
          }
          if (ids.has(id)) this.addIssue('Tekrarlı FID', cls, id, `Satır ${rowIndex}`);
          ids.set(id, rowIndex);

          if (foldColumn >= 0) {
            const parent = asIdentifier(values[foldColumn]);
            if (parent !== null) this.parents.set(`${cls}|${id}`, parent);
          }
        }
      }
      this.index.set(cls, ids);
    }

    progress('Model zamanı ve kimlikler okunuyor');
    this.readMetadata();
    progress('Trafo merkezi hiyerarşisi ve koordinatlar hazırlanıyor');
    this.buildSites();
    await defer();

    progress('Nesne bağlantıları ve hat uçları çözümleniyor');
    this.buildLines();
    await defer();

    progress('Hat güzergâh matrisleri oluşturuluyor');
    this.buildGeometry();
    this.reportGeometryIssues();
    await defer();

    progress('Referans indeksleri ve kalite metrikleri hesaplanıyor');
    this.buildGroupVoltageIndex();
    this.buildEquipmentIndex();
    this.finishSites();
    this.calculateStats();
    await defer();
    return this;
  }

  findTermVoltagesForGroup(groupId: string): Set<number> {
    return new Set(this.groupVoltages.get(groupId) ?? []);
  }

  siteFromParent(parent: unknown): string | null {
    let id = asIdentifier(parent) ?? '';
    if (!id) return null;
    if (this.siteCache.has(id)) return this.siteCache.get(id) ?? null;

    const seen = new Set<string>();
    const chain: string[] = [];
    while (id && !seen.has(id)) {
      seen.add(id);
      chain.push(id);
      if (this.stationGroups.has(id)) {
        for (const ancestor of chain) this.siteCache.set(ancestor, id);
        return id;
      }
      let next = '';
      for (const cls of PARENT_CLASSES) {
        if (!this.index.get(cls)?.has(id)) continue;
        next = this.parents.get(`${cls}|${id}`) ?? '';
        break;
      }
      id = next;
    }
    for (const ancestor of chain) this.siteCache.set(ancestor, null);
    return null;
  }

  siteFromCub(cubId: unknown): string | null {
    const id = asIdentifier(cubId);
    if (id === null) return null;
    const cubParent = this.index.get('StaCubic')?.has(id)
      ? this.parents.get(`StaCubic|${id}`)
      : undefined;
    return this.siteFromParent(cubParent ?? id);
  }

  resolveSiteByClass(
    cls: string,
    id: string,
    row: DgsRecord | readonly unknown[] | null = null,
    foldIndex = -1,
  ): string | null {
    const key = `${cls}|${id}`;
    if (this.siteCache.has(key)) return this.siteCache.get(key) ?? null;

    const source = row ?? this.get(cls, id);
    if (source === null) return null;
    const foldColumn = foldIndex >= 0 ? foldIndex : this.attrAt(cls, 'fold_id');
    const fold = isRawRow(source)
      ? (foldColumn >= 0 ? source[foldColumn] : null)
      : source.fold_id;
    let siteId = this.siteFromParent(fold);

    if (!siteId) {
      const bus = isRawRow(source)
        ? this.rawValueAt(cls, source, 'bus1')
        : source.bus1;
      if (bus) siteId = this.siteFromCub(bus);
    }
    this.siteCache.set(key, siteId);
    return siteId;
  }

  getEquipmentForSite(siteId: string, cls: string): DgsRecord[] {
    if (cls === 'ElmSubstat') return this.stationGroups.get(siteId)?.groups ?? [];
    if (cls === 'ElmSite') {
      const site = this.stationGroups.get(siteId);
      return site ? [site] : [];
    }
    if (cls === 'ElmLne') return this.stationLines.get(siteId) ?? [];
    const ids = this.stationEquip.get(siteId)?.get(cls) ?? [];
    const equipment: DgsRecord[] = [];
    for (const id of ids) {
      const row = this.get(cls, id);
      if (row) equipment.push(row);
    }
    return equipment;
  }

  getStateObj(cls: string, id: unknown): DgsRecord | null {
    return this.get(cls, id);
  }

  enriched(cls: string, rowIndex: number): DgsRecord | null {
    const row = this.row(cls, rowIndex);
    if (!row) return null;
    const id = asIdentifier(row.FID) ?? '';
    if (cls === 'ElmSite') return this.stationGroups.get(id) ?? row;
    if (cls === 'ElmLne') return this.lineIndex.get(id) ?? row;

    if (cls === 'ElmTr2' || cls === 'ElmScap') {
      const endpointA = this.siteFromCub(row.bushv || row.bus1);
      const endpointB = this.siteFromCub(row.buslv || row.bus2);
      row.stationA = this.stationGroups.get(endpointA ?? '')?.loc_name || endpointA || '—';
      row.stationB = this.stationGroups.get(endpointB ?? '')?.loc_name || endpointB || '—';
      if (cls === 'ElmTr2') {
        const transformerType = this.get('TypTr2', row.typ_id);
        if (transformerType) {
          for (const attribute of ['strn', 'utrn_h', 'utrn_l']) row[attribute] = transformerType[attribute];
        }
      }
    }

    const siteId = this.resolveSiteByClass(cls, id);
    if (siteId) row.station = this.stationGroups.get(siteId)?.loc_name || siteId;
    return row;
  }

  lineById(id: unknown): DgsLine | null {
    const key = asIdentifier(id);
    return key === null ? null : this.lineIndex.get(key) ?? null;
  }

  siteById(id: unknown): DgsSite | null {
    const key = asIdentifier(id);
    return key === null ? null : this.stationGroups.get(key) ?? null;
  }

  private resetDerivedState(): void {
    this.tables.clear();
    this.index.clear();
    this.attr.clear();
    this.issues.length = 0;
    this.parents.clear();
    this.siteCache.clear();
    this.stationGroups.clear();
    this.stationLines.clear();
    this.stationEquip.clear();
    this.sites.length = 0;
    this.lines.length = 0;
    this.lineIndex.clear();
    this.geometry.clear();
    this.groupVoltages.clear();
    this.stats = EMPTY_STATS();
  }

  private readMetadata(): void {
    const general = this.get('General', 'GENERAL');
    this.version = asText(general?.Val) || 'Belirsiz';

    const time = this.get('SetTime', 'TIME') ?? this.row('SetTime', 0) ?? {};
    const rawDate = asText(time.cDate) || '';
    const rawTime = (asText(time.cTime) || '').padStart(6, '0');
    this.date = rawDate.length === 8
      ? `${rawDate.slice(6, 8)}.${rawDate.slice(4, 6)}.${rawDate.slice(0, 4)}`
      : 'Belirsiz';
    this.time = rawTime.length === 6 ? `${rawTime.slice(0, 2)}:${rawTime.slice(2, 4)}` : 'Belirsiz';
    this.timeKey = rawDate + rawTime;
    this.scenario = asText(this.row('IntCase', 0)?.loc_name) || this.name;
    this.analysisStatus = asText(this.row('ComLdf', 0)?.loc_name) || '';
  }

  private buildSites(): void {
    const siteIndex = this.index.get('ElmSite');
    if (siteIndex) {
      for (const [id, rowIndex] of siteIndex) {
        const row = this.row('ElmSite', rowIndex);
        if (!row) continue;
        const site = {
          ...row,
          FID: id,
          loc_name: asText(row.loc_name) ?? id,
          sType: asText(row.sType) ?? '',
          groups: [],
          lines: [],
          equipment: {},
          volts: new Set<number>(),
          lat: null,
          lon: null,
          ytmId: asIdentifier(row.fold_id) ?? '',
          ytm: '—',
          lineCount: 0,
          bayCount: 0,
          transformerCount: 0,
          voltageList: '—',
          coord: 'Yok',
        } satisfies DgsSite;
        site.ytm = this.get('ElmNet', site.ytmId)?.loc_name as string || site.ytmId || '—';
        this.sites.push(site);
        this.stationGroups.set(id, site);
        this.stationLines.set(id, []);
        this.stationEquip.set(id, new Map());
      }
    }

    const substationIndex = this.index.get('ElmSubstat');
    if (substationIndex) {
      for (const [fid, rowIndex] of substationIndex) {
        const group = this.row('ElmSubstat', rowIndex);
        if (!group) continue;
        const siteId = asIdentifier(group.fold_id);
        const site = siteId ? this.stationGroups.get(siteId) : undefined;
        if (!site) continue;
        site.groups.push(group);
        const lat = asNumber(group.GPSlat);
        const lon = asNumber(group.GPSlon);
        if (Number.isFinite(lat) && Number.isFinite(lon) && lat >= 30 && lat <= 46 && lon >= 25 && lon <= 46) {
          if (site.lat === null) {
            site.lat = lat;
            site.lon = lon;
          } else if (site.lon !== null && Math.hypot(site.lat - lat, site.lon - lon) > 0.12) {
            this.addIssue('TM bara grubu koordinat farkı', 'ElmSubstat', fid, `${asText(group.loc_name) ?? fid}: ilk grup ile farklı konum`);
          }
        } else {
          this.addIssue('Geçersiz TM koordinatı', 'ElmSubstat', fid, `${lat}, ${lon}`);
        }
      }
    }
    this.sites.sort((left, right) => left.loc_name.localeCompare(right.loc_name, 'tr'));
  }

  private buildLines(): void {
    const lineIndex = this.index.get('ElmLne');
    if (!lineIndex) return;
    for (const [fid, rowIndex] of lineIndex) {
      const row = this.row('ElmLne', rowIndex);
      if (!row) continue;
      const siteAId = this.siteFromCub(row.bus1);
      const siteBId = this.siteFromCub(row.bus2);
      const type = this.get('TypLne', row.typ_id);
      const voltageValue = asNumber(type?.uline);
      const voltage = Number.isFinite(voltageValue) ? voltageValue : null;
      const line = {
        ...row,
        FID: fid,
        loc_name: asText(row.loc_name) ?? fid,
        stationA: siteAId ?? '',
        stationB: siteBId ?? '',
        voltage,
        siteA: this.stationGroups.get(siteAId ?? '') ?? null,
        siteB: this.stationGroups.get(siteBId ?? '') ?? null,
        geoStatus: 'Eksik',
        coords: null,
      } satisfies DgsLine;

      if (siteAId) {
        this.stationLines.get(siteAId)?.push(line);
        if (line.voltage !== null) line.siteA?.volts.add(line.voltage);
      } else {
        this.addIssue('Hat birinci TM bağlantısı çözülemedi', 'ElmLne', fid, String(row.bus1));
      }
      if (siteBId && siteBId !== siteAId) {
        this.stationLines.get(siteBId)?.push(line);
        if (line.voltage !== null) line.siteB?.volts.add(line.voltage);
      } else if (!siteBId) {
        this.addIssue('Hat ikinci TM bağlantısı çözülemedi', 'ElmLne', fid, String(row.bus2));
      }
      this.lines.push(line);
      this.lineIndex.set(fid, line);
    }
  }

  private buildGeometry(): void {
    const matrix = this.t('Matrix');
    if (!matrix) return;
    const fidColumn = this.attrAt('Matrix', 'FID');
    const rowColumn = this.attrAt('Matrix', 'MatRow');
    const columnColumn = this.attrAt('Matrix', 'MatColumn');
    const valueColumn = this.attrAt('Matrix', 'Val');
    if (fidColumn < 0 || rowColumn < 0 || columnColumn < 0 || valueColumn < 0) return;

    const matrices = new Map<string, Map<number, number[]>>();
    for (const row of matrix.Values) {
      const id = asIdentifier(row[fidColumn]);
      const matrixRow = asNumber(row[rowColumn]);
      const matrixColumn = asNumber(row[columnColumn]);
      const value = asNumber(row[valueColumn]);
      if (id === null || !Number.isFinite(matrixRow) || !Number.isFinite(matrixColumn) || !Number.isFinite(value)) continue;
      let rows = matrices.get(id);
      if (!rows) {
        rows = new Map();
        matrices.set(id, rows);
      }
      let coordinate = rows.get(matrixRow);
      if (!coordinate) {
        coordinate = [];
        rows.set(matrixRow, coordinate);
      }
      coordinate[matrixColumn] = value;
    }

    for (const line of this.lines) {
      const reference = asText(line['GPScoords:MATRIX']) || '';
      if (!reference) continue;
      const alternatives = [
        reference,
        reference.replace(/^Matrix_/, 'HG'),
        `HG${line.FID.replace(/\D/g, '')}`,
        line.FID,
      ];
      let rows: Map<number, number[]> | undefined;
      for (const alternative of alternatives) {
        rows = matrices.get(alternative);
        if (rows) break;
      }
      if (!rows) continue;
      const coords = Array.from(rows.entries())
        .sort((left, right) => left[0] - right[0])
        .map(([, point]) => point)
        .filter(point => Number.isFinite(point[0]) && Number.isFinite(point[1])
          && point[0] >= 30 && point[0] <= 46 && point[1] >= 25 && point[1] <= 46)
        .map(point => [point[0], point[1]] as const);
      line.coords = coords.length >= 2 ? coords : null;
      line.geoStatus = coords.length >= 2
        ? 'Model güzergâhı'
        : coords.length === 1 ? 'Tek koordinat' : 'Eksik';
      if (line.coords) this.geometry.set(line.FID, line.coords);
    }
  }

  private reportGeometryIssues(): void {
    for (const line of this.lines) {
      if (line.geoStatus === 'Eksik') {
        this.addIssue('Hat güzergâhı bulunamadı', 'ElmLne', line.FID, 'Güzergâh yok; iki TM koordinatı varsa temsili bağlantı çizilir.', 'Bilgi');
      } else if (line.geoStatus === 'Tek koordinat') {
        this.addIssue('Hat güzergâhı tek noktalı', 'ElmLne', line.FID, 'Tek nokta gerçek çizgi güzergâhı oluşturmaz; temsili bağlantı çizilir.', 'Bilgi');
      }
    }
  }

  private buildGroupVoltageIndex(): void {
    const table = this.t('ElmTerm');
    if (!table) return;
    const groupColumn = this.attrAt('ElmTerm', 'fold_id');
    const voltageColumn = this.attrAt('ElmTerm', 'uknom');
    if (groupColumn < 0 || voltageColumn < 0) return;

    for (const row of table.Values) {
      const groupId = asIdentifier(row[groupColumn]);
      if (!groupId?.startsWith('G')) continue;
      const voltage = asNumber(row[voltageColumn]);
      if (!Number.isFinite(voltage)) continue;
      let voltages = this.groupVoltages.get(groupId);
      if (!voltages) {
        voltages = new Set();
        this.groupVoltages.set(groupId, voltages);
      }
      voltages.add(voltage);
    }
  }

  private buildEquipmentIndex(): void {
    for (const [cls, table] of this.tables) {
      if (SKIP_EQUIPMENT_CLASSES.has(cls)) continue;
      const fidColumn = this.attrAt(cls, 'FID');
      const foldColumn = this.attrAt(cls, 'fold_id');
      if (fidColumn < 0) continue;
      for (const row of table.Values) {
        const id = asIdentifier(row[fidColumn]);
        if (id === null) continue;
        const siteId = this.resolveSiteByClass(cls, id, row, foldColumn);
        if (!siteId) continue;
        const equipmentByClass = this.stationEquip.get(siteId);
        if (!equipmentByClass) continue;
        let equipmentIds = equipmentByClass.get(cls);
        if (!equipmentIds) {
          equipmentIds = [];
          equipmentByClass.set(cls, equipmentIds);
        }
        equipmentIds.push(id);
        const site = this.stationGroups.get(siteId);
        if (site && cls === 'ElmBay') site.bayCount += 1;
        if (site && cls === 'ElmTr2') site.transformerCount += 1;
      }
    }
  }

  private finishSites(): void {
    for (const site of this.sites) {
      site.lines = this.stationLines.get(site.FID) ?? [];
      site.lineCount = site.lines.length;
      for (const group of site.groups) {
        for (const voltage of this.findTermVoltagesForGroup(asIdentifier(group.FID) ?? '')) site.volts.add(voltage);
      }
      site.voltageList = Array.from(site.volts)
        .filter(Number.isFinite)
        .sort((left, right) => right - left)
        .join(' / ') || '—';
      site.coord = site.lat === null || site.lon === null ? 'Yok' : `${site.lat}, ${site.lon}`;
    }
  }

  private calculateStats(): void {
    this.stats = {
      sites: this.sites.length,
      real: this.sites.filter(site => site.sType === 'GERCEK').length,
      virtual: this.sites.filter(site => site.sType !== 'GERCEK').length,
      lines: this.lines.length,
      geo: this.lines.filter(line => line.geoStatus === 'Model güzergâhı').length,
      fallback: this.lines.filter(line => line.geoStatus !== 'Model güzergâhı').length,
      tr: this.t('ElmTr2')?.Values.length ?? 0,
      bay: this.t('ElmBay')?.Values.length ?? 0,
      unit: (this.t('ElmSym')?.Values.length ?? 0) + (this.t('ElmGenStat')?.Values.length ?? 0),
      load: this.t('ElmLod')?.Values.length ?? 0,
      rows: Array.from(this.tables.values()).reduce((sum, table) => sum + table.Values.length, 0),
    };
  }

  private rawValueAt(cls: string, row: readonly unknown[], attribute: string): unknown {
    const column = this.attrAt(cls, attribute);
    return column < 0 ? null : row[column] ?? null;
  }
}

export async function parseDgs(text: string, name = 'DGS'): Promise<DgsModel> {
  const parsed: unknown = JSON.parse(text);
  if (!isRecord(parsed)) throw new TypeError('DGS kök değeri bir nesne olmalı.');
  const model = new DgsModel(parsed, name, text.length);
  return model.build();
}
