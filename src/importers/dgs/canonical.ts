import type { DgsModel } from './index';
import type { CanonicalNetwork, Entity, Generator, Line, SourceRef } from '../../domain/model/network';
import { buildLineCapacityMetadata } from '../../domain/model/capacity';

type Row = Record<string, unknown>;
const num = (v: unknown, fallback = 0): number => v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : fallback;
const str = (v: unknown): string => String(v ?? '');
const BASE = 100;
export function mapCanonical(m: DgsModel, modelHash: string): CanonicalNetwork {
  const warnings: string[] = [];
  for (const issue of m.issues) warnings.push(`[${issue.level}] ${issue.cls}${issue.fid ? ` ${issue.fid}` : ''}: ${issue.kind}${issue.details ? ` — ${issue.details}` : ''}`);
  const rows = (cls: string): Row[] => Array.from({ length: m.t(cls)?.Values.length || 0 }, (_, i) => m.row(cls, i) as Row);
  const ref = (cls: string, id: unknown, field: string, unit?: string): SourceRef => ({ sourceClass: cls, sourceId: str(id), field, unit });
  const base = (cls: string, r: Row): Entity => {
    const id = str(r.FID), site = m.resolveSiteByClass(cls, id);
    return { id, name: str(r.loc_name) || `${cls} (adsız)`, sourceClass: cls, sourceId: id, inService: num(r.outserv) !== 1,
      siteIds: site ? [site] : [], sourceRefs: { name: [ref(cls, id, 'loc_name')], inService: [ref(cls, id, 'outserv')] } };
  };
  const cubs = new Map(rows('StaCubic').map(r => [str(r.FID), str(r.fold_id)]));
  const endpoint = (id: unknown): string => cubs.get(str(id)) || '';
  const terminals = rows('ElmTerm');
  const buses = terminals.map(r => ({ ...base('ElmTerm', r), vnKv: num(r.uknom), parentId: str(r.fold_id), sourceRefs: { ...base('ElmTerm', r).sourceRefs, vnKv: [ref('ElmTerm', r.FID, 'uknom', 'kV')] } }));
  const busById = new Map(buses.map(b => [b.id, b]));
  const branchBase = (cls: string, r: Row, from: string, to: string) => ({ ...base(cls, r), from, to,
    siteIds: [...new Set([...(busById.get(from)?.siteIds || []), ...(busById.get(to)?.siteIds || [])])] });
  const sections = new Map<string, Row[]>();
  for (const row of rows('ElmLnesec')) { const id = str(row.fold_id); if (!sections.has(id)) sections.set(id, []); sections.get(id)!.push(row); }
  const lines: Line[] = rows('ElmLne').map(r => {
    const from = endpoint(r.bus1), to = endpoint(r.bus2), type = m.get('TypLne', str(r.typ_id)) as Row | null;
    const vnKv = busById.get(from)?.vnKv || num(type?.uline), parts = sections.get(str(r.FID));
    let rOhm = 0, xOhm = 0, bSiemens = 0, ratingMva = Infinity;
    const provenance: SourceRef[] = [];
    for (const part of parts?.length ? parts : [r]) {
      const typ = m.get('TypLne', str(part.typ_id)) as Row | null;
      if (!typ) { warnings.push(`Hat tipi bulunamadı: ${str(r.loc_name)} (${str(r.FID)})`); continue; }
      const length = num(part.dline); rOhm += num(typ.rline) * length; xOhm += num(typ.xline) * length; bSiemens += num(typ.bline) * 1e-6 * length;
      if (num(typ.sline) > 0) ratingMva = Math.min(ratingMva, Math.sqrt(3) * vnKv * num(typ.sline));
      provenance.push(ref('TypLne', part.typ_id, 'rline/xline/bline/sline', 'ohm/km; microS/km; kA'), ref(parts ? 'ElmLnesec' : 'ElmLne', part.FID, 'dline', 'km'));
    }
    const original = m.lineById(str(r.FID));
    const mainType = type ? { id: str(r.typ_id), name: type.loc_name, sline: type.sline } : null;
    const capacity = buildLineCapacityMetadata({
      id: str(r.FID), voltageKv: vnKv, lineFactor: r.fline, mainType,
      sections: (parts || []).map(part => {
        const typeId = str(part.typ_id), sectionType = m.get('TypLne', typeId) as Row | null;
        return { id: str(part.FID), type: sectionType ? { id: typeId, name: sectionType.loc_name, sline: sectionType.sline } : null,
          factor: part.fline, index: Number(part.index), factorSourceClass: 'ElmLnesec' as const, factorSourceId: str(part.FID) };
      }),
    });
    return { ...branchBase('ElmLne', r, from, to), vnKv, lengthKm: num(r.dline), rOhm, xOhm, bSiemens,
      ratingMva: Number.isFinite(ratingMva) ? ratingMva : null, coordinates: (original?.coords || []) as [number, number][], sections: parts?.length || 0,
      capacity,
      fastParameters: {rOhm:num(type?.rline,NaN)*num(r.dline),xOhm:num(type?.xline,NaN)*num(r.dline),bSiemens:num(type?.bline)*1e-6*num(r.dline),vnKv:num(type?.uline)},
      sourceRefs: { ...base('ElmLne', r).sourceRefs, impedance: provenance, from: [ref('ElmLne', r.FID, 'bus1')], to: [ref('ElmLne', r.FID, 'bus2')] } };
  });
  const transformers = rows('ElmTr2').map(r => {
    const from = endpoint(r.bushv), to = endpoint(r.buslv), t = (m.get('TypTr2', str(r.typ_id)) || {}) as Row;
    const sn = num(t.strn), uk = num(t.uktr), rp = sn > 0 ? num(t.pcutr) / (1000 * sn) : NaN, zp = uk / 100;
    const hv = num(t.utrn_h), lv = num(t.utrn_l), vnKv = busById.get(from)?.vnKv || 0, lvKv = busById.get(to)?.vnKv || 0;
    const pos = num(r.nntap), side = num(t.tap_side); let rel = 1, valid = hv > 0 && lv > 0 && vnKv > 0 && lvKv > 0;
    if (valid && num(t.itapch) === 1) {
      const index = Math.round(pos - num(t.ntpmn)), tapKv = index >= 0 && index < num(r['mTaps:SIZEROW']) ? num(r[`mTaps:${index}`], NaN) : NaN;
      if (tapKv > 0) rel = tapKv / (side === 0 ? hv : lv);
      else if (t.dutap != null && Number.isFinite(Number(t.dutap))) rel = 1 + (pos - num(t.nntap0)) * num(t.dutap) / 100;
      else valid = false;
    }
    let tap = valid ? (hv / vnKv) / (lv / lvKv) * (side === 0 ? rel : side === 1 ? 1 / rel : 1) : 1;
    if (!valid || !(tap > .5 && tap < 1.6)) { tap = 1; warnings.push(`Trafo kademe oranı çözülemedi; 1.0: ${str(r.FID)}`); }
    const g = sn > 0 ? num(t.pfe) / (1000 * sn) : 0, b = -Math.sqrt(Math.max(0, (num(t.curmg) / 100) ** 2 - g * g)), scale = sn / BASE;
    return { ...branchBase('ElmTr2', r, from, to), vnKv, lvKv, rPu: rp * BASE / sn, xPu: Math.sqrt(Math.max(0, zp*zp-rp*rp)) * BASE / sn,
      tap, phase: 0, ratingMva: sn, tapPosition: pos, gPu: g * scale, bPu: b * scale,
      sourceRefs: { ...base('ElmTr2', r).sourceRefs, impedance: [ref('TypTr2', r.typ_id, 'strn/uktr/pcutr')], tap: [ref('ElmTr2', r.FID, 'nntap/mTaps'), ref('TypTr2', r.typ_id, 'dutap/nntap0/tap_side/utrn_h/utrn_l')], phase: [ref('TypTr2', r.typ_id, 'PHASE_SHIFT_SOURCE_UNAVAILABLE')] } };
  });
  const generators: Generator[] = ['ElmSym', 'ElmGenStat'].flatMap(cls => rows(cls).map(r => {
    let qMin: number | null = null, qMax: number | null = null; const pMw = num(r.pgini);
    if (cls === 'ElmSym' && r.cQ_min != null && r.cQ_max != null && Number.isFinite(Number(r.cQ_min)) && Number.isFinite(Number(r.cQ_max)) && Number(r.cQ_min) <= Number(r.cQ_max)) { qMin = Number(r.cQ_min); qMax = Number(r.cQ_max); }
    else {
      const curve = m.get('IntQlim', str(r.pQlimType)) as Row | null;
      if (curve) {
        const points = Array.from({ length: num(curve['cap_P:SIZEROW']) }, (_, i) => [Number(curve[`cap_P:${i}`]), Number(curve[`cap_Qmn:${i}`]), Number(curve[`cap_Qmx:${i}`])]).filter(p => p.every(Number.isFinite)).sort((a,b) => a[0]-b[0]);
        if (points.length) { let a = points[0], b = a; for (const point of points) { b = point; if (point[0] >= pMw) break; a = point; } const t = Math.max(0, Math.min(1, (pMw-a[0])/(b[0]-a[0] || 1))); qMin = a[1] + t*(b[1]-a[1]); qMax = a[2] + t*(b[2]-a[2]); }
      }
    }
    return { ...base(cls, r), bus: endpoint(r.bus1), pMw, qMvar: num(r.qgini), vmSet: num(r.usetp, 1), voltageControl: r.av_mode === 'constv', qMin, qMax,
      sourceRefs: { ...base(cls, r).sourceRefs, dispatch: [ref(cls, r.FID, 'pgini/qgini', 'MW/MVAr')], qLimits: [ref(cls, r.FID, 'cQ_min/cQ_max/pQlimType'), ref('IntQlim', r.pQlimType, 'cap_P/cap_Qmn/cap_Qmx')] } };
  }));
  const loads = rows('ElmLod').map(r => ({ ...base('ElmLod', r), bus: endpoint(r.bus1), pMw: num(r.plini), qMvar: num(r.qlini) }));
  const internationalConnections = rows('ElmVac').map(r => ({ ...base('ElmVac', r), bus: endpoint(r.bus1), pMw: num(r.Pload), qMvar: num(r.Qload) }));
  const externalGrids = rows('ElmXnet').map(r => ({ ...base('ElmXnet', r), bus: endpoint(r.bus1), pMw: num(r.pgini), qMvar: num(r.qgini), vmSet: num(r.usetp, 1),bustpRaw:str(r.bustp),modeInputRaw:str(r.mode_inp),sourceRefs:{...base('ElmXnet',r).sourceRefs,reference:[ref('ElmXnet',r.FID,'bustp/mode_inp/usetp')]} }));
  const shunts = rows('ElmShnt').map(r => {
    let q = num(r.shtype) === 1 ? -Math.abs(num(r.qrean)) : num(r.shtype) === 2 ? Math.abs(num(r.qcapn)) : 0;
    if (![1,2].includes(num(r.shtype))) warnings.push(`Şönt türü desteklenmiyor: ${str(r.FID)}`);
    const nominalQMvar=q,max = num(r.ncapx, 1); if (max > 0) q *= num(r.ncapa, max) / max;
    return { ...base('ElmShnt', r), bus: endpoint(r.bus1), gPu: 0, bPu: q / BASE, nominalQMvar };
  });
  const seriesCompensators = rows('ElmScap').map(r => ({ ...branchBase('ElmScap', r, endpoint(r.bus1), endpoint(r.bus2)), rOhm: 0, xOhm: num(r.bcap) > 0 ? -1/num(r.bcap) : NaN }));
  const switches = rows('ElmCoup').map(r => ({ ...branchBase('ElmCoup', r, endpoint(r.bus1), endpoint(r.bus2)), closed: num(r.on_off) === 1 }));
  const cubicleSwitches = rows('StaSwitch').map(r => {
    const cub = str(r.fold_id), owner = m.get('StaCubic', cub) as Row | null;
    return { ...branchBase('StaSwitch', r, endpoint(cub), endpoint(cub)), closed: num(r.on_off) === 1, cubicleId: cub, equipmentId: str(owner?.obj_id) };
  });
  const rawNumber=(v:unknown):number|null=>v==null||v===''||!Number.isFinite(Number(v))?null:Number(v);
  const unitById=new Map(generators.map(g=>[g.id,g]));
  const stationControllers = rows('ElmStactrl').map(r => {
    const unitIds=Array.from({length:num(r['psym:SIZEROW'])}, (_,i) => str(r[`psym:${i}`]));
    return { ...base('ElmStactrl', r),remoteBus:str(r.rembar),unitIds,vmSet:num(r.usetp,1),modeSemantics:'UNVERIFIED' as const,
      unitRefs:unitIds.map(id=>{const g=unitById.get(id);return{id,sourceClass:g?(g.sourceClass as 'ElmSym'|'ElmGenStat'):'UNRESOLVED' as const,inService:g?.inService??false};}),
      controlModeRaw:rawNumber(r.i_ctrl),distributionModeRaw:rawNumber(r.imode),droopModeRaw:rawNumber(r.i_droop),droopValueRaw:rawNumber(r.ddroop),ratedPowerRaw:rawNumber(r.Srated),qSetpointRaw:rawNumber(r.qsetp),measurementRefRaw:str(r.pQmeas),measurementCubicleRaw:str(r.p_cub),qOrientationRaw:rawNumber(r.iQorient),
      sourceRefs:{...base('ElmStactrl',r).sourceRefs,remoteBus:[ref('ElmStactrl',r.FID,'rembar')],unitIds:[ref('ElmStactrl',r.FID,'psym:*')],vmSet:[ref('ElmStactrl',r.FID,'usetp','pu')],controlModeRaw:[ref('ElmStactrl',r.FID,'i_ctrl')],distributionModeRaw:[ref('ElmStactrl',r.FID,'imode')],droopModeRaw:[ref('ElmStactrl',r.FID,'i_droop/ddroop/Srated')],qSetpointRaw:[ref('ElmStactrl',r.FID,'qsetp/pQmeas/p_cub/iQorient')]}
    };
  });
  const sites = m.sites.map(s => ({ ...base('ElmSite', s as unknown as Row), lat: s.lat, lon: s.lon, areaId: str(s.ytmId), areaName: str(s.ytm), voltages: [...s.volts].filter(Number.isFinite) as number[] }));
  const classCounts = Object.fromEntries([...m.tables].map(([cls, t]) => [cls, t.Values.length]));
  const powerReasons = ['ElmStactrl sayısal kontrol modu ve Q dağılım semantiği doğrulanmadı; dış kontrol uygulanmaz.', 'TypTr2 kaynak profilinde faz kaydırma alanı yok; faz 0 ile hesaplanır ve sonuç kısmi sadakattedir.', 'PowerFactory eşdeğerliği doğrulanmadı.'];
  if (!externalGrids.some(x => x.inService)) powerReasons.push('Servis içi dış şebeke (ElmXnet) yok.');
  const comLdf=rows('ComLdf')[0];const loadFlowOptionsRaw=comLdf?Object.fromEntries(['iopt_lim','itrlx','ictrlx','errlf','erreq','iPbalancing'].map(key=>[key,rawNumber(comLdf[key])])):{};
  return { schemaVersion: 1, modelHash, name: m.name, size: m.size, baseMva: BASE, buses, lines, transformers, generators, loads, shunts, seriesCompensators, externalGrids, internationalConnections, switches: [...switches, ...cubicleSwitches], stationControllers,loadFlowOptionsRaw,
    secondaryControllers: rows('ElmSecctrl').map(r => base('ElmSecctrl',r)), boundaries: rows('ElmBoundary').map(r => base('ElmBoundary',r)), sites, classCounts,
    records: Object.values(classCounts).reduce((a,b) => a+b,0), warnings,
    capabilities: { powerFlow: { state: externalGrids.some(x => x.inService) ? 'PARTIAL' : 'BLOCKED', reasons: powerReasons }, shortCircuit3Phase: {state:'BLOCKED',reasons:['Bu sürümde uygulanmadı; sekans/reaktans kapsamı doğrulanmalı.']}, shortCircuitGround:{state:'BLOCKED',reasons:['Sıfır sekans ve vektör grubu kapsamı doğrulanmadı.']}, n1:{state:'BLOCKED',reasons:['Bu sürümde uygulanmadı.']} } };
}
