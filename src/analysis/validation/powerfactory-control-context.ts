import type { CanonicalNetwork, Load } from '../../domain/model/network';

export interface ControlContextRow {
  kind: string; ownerFid: string; ownerClass: string; index: number | null;
  key: string; value: string; unit: string; refFid: string; refClass: string; status: string;
}
export interface ControlContextLoad {
  fid: string; inService: boolean; initialPMw: number; initialQMvar: number;
  iScale: 0 | 1; scale0: number; connectedBusFid: string;
  finalPMw: number; finalQMvar: number;
}
export interface ControlContextStationController {
  fid: string; memberFids: string[]; cvqq: number[]; remoteBusFid: string;
  droopModeRaw: number; ddroop: number; measurementFid: string | null;
}
export interface PowerFactoryControlContext {
  metadata: Record<string, string>; sourceHash: string; loads: ControlContextLoad[];
  stationControllers: ControlContextStationController[];
  rows: ControlContextRow[];
}

function csvRows(text: string): Record<string, string>[] {
  const source = text.replace(/^\uFEFF/, '').replace(/^sep=;\r?\n/i, '');
  const rows: string[][] = []; let row: string[] = [], cell = '', quoted = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (char === '"') { if (quoted && source[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (char === ';' && !quoted) { row.push(cell); cell = ''; }
    else if ((char === '\r' || char === '\n') && !quoted) { if (char === '\r' && source[i + 1] === '\n') i++; row.push(cell); if (row.some(value => value.trim())) rows.push(row); row = []; cell = ''; }
    else cell += char;
  }
  row.push(cell); if (row.some(value => value.trim())) rows.push(row);
  const header = rows.shift() || [];
  return rows.map(values => Object.fromEntries(header.map((key, index) => [key, values[index] ?? ''])));
}
function decimal(value: string, label: string): number {
  const parsed = Number(value.trim().replace(',', '.'));
  if (!value.trim() || !Number.isFinite(parsed)) throw new Error(`ControlContext ${label} geçersiz: ${value}`);
  return parsed;
}
function hashText(text: string): string {
  let hash = 0xcbf29ce484222325n;
  for (let i = 0; i < text.length; i++) hash = BigInt.asUintN(64, (hash ^ BigInt(text.charCodeAt(i))) * 0x100000001b3n);
  return hash.toString(16).padStart(16, '0');
}
export function importPowerFactoryControlContext(text: string): PowerFactoryControlContext {
  const rows = csvRows(text), metadata: Record<string, string> = {}, byLoad = new Map<string, Map<string, ControlContextRow>>(), byController=new Map<string,ControlContextRow[]>(), parsedRows: ControlContextRow[] = [];
  for (const raw of rows) {
    if (raw.kind === 'meta') { if (raw.key) metadata[raw.key] = raw.value; continue; }
    const row: ControlContextRow = { kind: raw.kind, ownerFid: raw.ownerFid, ownerClass: raw.ownerClass, index: raw.index ? decimal(raw.index, 'index') : null,
      key: raw.key, value: raw.value, unit: raw.unit, refFid: raw.refFid, refClass: raw.refClass, status: raw.status };
    parsedRows.push(row);
    if(row.ownerClass==='ElmStactrl'){const group=byController.get(row.ownerFid)||[];group.push(row);byController.set(row.ownerFid,group);}
    if (row.ownerClass !== 'ElmLod') continue;
    if (!row.ownerFid) throw new Error('ControlContext ElmLod FID eksik.');
    const fields = byLoad.get(row.ownerFid) || new Map<string, ControlContextRow>();
    const key = `${row.kind}:${row.key}`;
    if (fields.has(key)) throw new Error(`ControlContext ElmLod ${row.ownerFid} alanı yineleniyor: ${key}`);
    fields.set(key, row); byLoad.set(row.ownerFid, fields);
  }
  if (metadata.schemaVersion !== 'PF-GA-CONTROL-1.0') throw new Error('ControlContext şeması desteklenmiyor.');
  const loads: ControlContextLoad[] = [];
  for (const [fid, fields] of byLoad) {
    const get = (kind: string, key: string) => { const row = fields.get(`${kind}:${key}`); if (!row || row.status !== 'OK') throw new Error(`ControlContext ElmLod ${fid}: ${kind}:${key} eksik veya geçersiz.`); return row; };
    const iScale = decimal(get('attribute', 'i_scale').value, `${fid}.i_scale`);
    if (iScale !== 0 && iScale !== 1) throw new Error(`ControlContext ElmLod ${fid}: i_scale semantiği bilinmiyor (${iScale}).`);
    const inService = decimal(get('attribute', 'inService').value, `${fid}.inService`);
    if (inService !== 0 && inService !== 1) throw new Error(`ControlContext ElmLod ${fid}: inService değeri geçersiz.`);
    loads.push({ fid, inService: inService === 1, initialPMw: decimal(get('attribute', 'plini').value, `${fid}.plini`), initialQMvar: decimal(get('attribute', 'qlini').value, `${fid}.qlini`),
      iScale: iScale as 0 | 1, scale0: decimal(get('attribute', 'scale0').value, `${fid}.scale0`), connectedBusFid: get('reference', 'connectedBus').refFid,
      finalPMw: decimal(get('result', 'm:P:bus1').value, `${fid}.finalP`), finalQMvar: decimal(get('result', 'm:Q:bus1').value, `${fid}.finalQ`) });
  }
  if (Number(metadata['summary.elmLodCount']) !== loads.length) throw new Error('ControlContext ElmLod özet sayısı satırlarla uyuşmuyor.');
  const stationControllers:ControlContextStationController[]=[];
  for(const [fid,group] of byController){
    const field=(kind:string,key:string)=>group.find(row=>row.kind===kind&&row.key===key);
    const required=(kind:string,key:string)=>{const row=field(kind,key);if(!row||row.status!=='OK')throw new Error(`ControlContext ElmStactrl ${fid}: ${kind}:${key} eksik.`);return row;};
    const members=group.filter(row=>row.kind==='reference'&&row.key==='psym').sort((a,b)=>(a.index??-1)-(b.index??-1));
    const cvqq=group.filter(row=>row.kind==='attribute'&&row.key==='cvqq').sort((a,b)=>(a.index??-1)-(b.index??-1));
    if(members.length!==cvqq.length||members.some((row,index)=>row.index!==index||row.status!=='OK'||!row.refFid||cvqq[index].index!==index||cvqq[index].status!=='OK'))
      throw new Error(`ControlContext ElmStactrl ${fid}: psym/cvqq üye dizisi uyuşmuyor.`);
    const measurement=field('reference','pQmeas');
    stationControllers.push({fid,memberFids:members.map(row=>row.refFid),cvqq:cvqq.map(row=>decimal(row.value,`${fid}.cvqq`)),
      remoteBusFid:required('reference','rembar').refFid,droopModeRaw:decimal(required('attribute','i_droop').value,`${fid}.i_droop`),
      ddroop:decimal(required('attribute','ddroop').value,`${fid}.ddroop`),measurementFid:measurement?.status==='OK'?measurement.refFid:null});
  }
  if(Number(metadata['summary.elmStactrlCount'])!==stationControllers.length||Number(metadata['summary.stationControllerMemberCount'])!==stationControllers.reduce((sum,row)=>sum+row.memberFids.length,0))
    throw new Error('ControlContext ElmStactrl özet sayıları satırlarla uyuşmuyor.');
  return { metadata, sourceHash: hashText(text), loads, stationControllers, rows: parsedRows };
}

export function applyPowerFactoryControlContext(network: CanonicalNetwork, context: PowerFactoryControlContext): CanonicalNetwork {
  const modelId = network.name.replace(/\.(json|zip)$/i, ''), studyCase = network.studyCase || modelId;
  const time = /^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(?:_|$)/.exec(studyCase);
  const studyTime = time ? `${time[1]}-${time[2]}-${time[3]} ${time[4]}:${time[5]}:00` : null;
  if (context.metadata.modelId !== modelId || !studyTime || context.metadata.studyTimeLocal !== studyTime)
    throw new Error('ControlContext model/study time mevcut DGS modeliyle uyuşmuyor.');
  const source = new Map(context.loads.map(load => [load.fid, load]));
  const activeLoads = network.loads.filter(load => load.inService);
  if (source.size !== context.loads.length || source.size !== activeLoads.length) throw new Error('ControlContext etkin ElmLod FID kapsamı DGS ile uyuşmuyor.');
  const loads: Load[] = network.loads.map(load => {
    if (!load.inService) return load;
    const record = source.get(load.id);
    if (!record || record.inService !== load.inService || record.connectedBusFid !== load.bus)
      throw new Error(`ControlContext ElmLod FID/durum/bara uyuşmazlığı: ${load.id}`);
    const close = (a: number, b: number) => Math.abs(a - b) <= Math.max(1e-4, 1e-6 * Math.max(Math.abs(a), Math.abs(b)));
    if (!close(record.initialPMw, load.pMw) || !close(record.initialQMvar, load.qMvar))
      throw new Error(`ControlContext ElmLod başlangıç P/Q uyuşmazlığı: ${load.id}`);
    return { ...load, activeBalanceEligibility: record.iScale === 1, activeBalanceEligibilitySource: 'ElmLod.i_scale', activeBalanceEligibilityRaw: record.iScale };
  });
  const fixedQObserved=context.loads.every(record=>Math.abs(record.finalQMvar-record.initialQMvar)<=Math.max(1e-5,1e-7*Math.abs(record.initialQMvar)));
  const controllerByFid=new Map(context.stationControllers.map(row=>[row.fid,row]));
  if(controllerByFid.size!==network.stationControllers.filter(row=>row.inService).length)throw new Error('ControlContext etkin ElmStactrl FID kapsamı DGS ile uyuşmuyor.');
  const stationControllers=network.stationControllers.map(controller=>{
    if(!controller.inService)return controller;
    const row=controllerByFid.get(controller.id);
    if(!row||row.remoteBusFid!==controller.remoteBus||row.memberFids.length!==controller.unitIds.length||row.memberFids.some((fid,index)=>fid!==controller.unitIds[index]))
      throw new Error(`ControlContext ElmStactrl FID/rembar/psym uyuşmazlığı: ${controller.id}`);
    if(row.droopModeRaw!==controller.droopModeRaw||controller.droopValueRaw!=null&&Math.abs(row.ddroop-controller.droopValueRaw)>1e-4)
      throw new Error(`ControlContext ElmStactrl droop kaynak uyuşmazlığı: ${controller.id}`);
    return {...controller,qParticipationRaw:row.cvqq,sourceRefs:{...controller.sourceRefs,qParticipation:[{sourceClass:'ElmStactrl',sourceId:controller.id,field:'ControlContext.cvqq:*',unit:'%'}]}};
  });
  return { ...network, loads, stationControllers, diagnostics: [...(network.diagnostics || []).filter(d => d.code !== 'ACTIVE_BALANCE_ELIGIBILITY_MISSING'),
    { code: 'ACTIVE_BALANCE_ELIGIBILITY_FROM_PF_CONTROL_CONTEXT', message: `${activeLoads.length} etkin ElmLod i_scale alanı FID ve başlangıç P/Q üzerinden doğrulandı.`, severity: 'INFO', sourceClass: 'ElmLod' },
    { code: 'STATION_CVQQ_FROM_PF_CONTROL_CONTEXT', message: `${controllerByFid.size} etkin ElmStactrl için psym/cvqq üyeliği FID ile doğrulandı.`, severity: 'INFO', sourceClass: 'ElmStactrl' },
    ...(fixedQObserved?[{code:'ACTIVE_BALANCE_FIXED_Q_OBSERVED',message:'PF ControlContext son yük Q değerleri başlangıç Q ile kaynak hassasiyetinde aynı; P dengelemede sabit Q gözlendi.',severity:'INFO' as const,sourceClass:'ElmLod'}]:[])] };
}
