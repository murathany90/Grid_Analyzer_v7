// Migrated V12 engine. Private per-instance bindings; no DGS controller.
export function define(ctx) {
ctx.Ms = function Ms(e2) {
  return e2 == null || !Number.isFinite(e2) || e2 <= 0 ? `unknown` : e2 >= 300 ? `b400` : e2 >= 180 ? `b220` : e2 >= 100 ? `b154` : e2 > 36 ? `b66` : `blow`;
};
ctx.Ns = function Ns(e2) {
  let t2 = {
    b400: 0,
    b220: 0,
    b154: 0,
    b66: 0,
    blow: 0,
    unknown: 0
  };
  for (let n2 of e2) {
    let e3 = ctx.Ms(n2);
    t2[e3]++;
  }
  return t2;
};
ctx.zs = function zs(e2, t2, n2 = false) {
  return t2 === `buses` ? e2.buses.join(` \u2192 `) : t2 in e2 && t2 !== `fields` && t2 !== `operating` ? e2[t2] : n2 ? e2.operating[t2]?.value : e2.fields[t2];
};
ctx.Bs = function Bs(e2, t2) {
  let n2 = (t2.search ?? ``).trim().toLocaleLowerCase(`tr`),
    r2 = t2.sort ?? `id`,
    i2 = new Intl.Collator(`tr`, {
      numeric: true,
      sensitivity: `base`
    }),
    a2 = e2.equipment.filter(e3 => (!t2.kind || e3.kind === t2.kind) && (!t2.status || (e3.status === null ? `unknown` : String(e3.status)) === t2.status) && (t2.minKv === void 0 || e3.nominalKv !== null && e3.nominalKv >= t2.minKv) && (t2.maxKv === void 0 || e3.nominalKv !== null && e3.nominalKv <= t2.maxKv) && (!t2.bands || !t2.bands.length || t2.bands.includes(ctx.Ms(e3.nominalKv))) && (!n2 || [e3.id, e3.name, e3.buses.join(` `), JSON.stringify(e3.fields)].join(` `).toLocaleLowerCase(`tr`).includes(n2)));
  a2.sort((e3, n3) => {
    let a3 = ctx.zs(e3, r2, t2.operating),
      o3 = ctx.zs(n3, r2, t2.operating),
      s3 = a3 == null ? o3 == null ? 0 : 1 : o3 == null ? -1 : typeof a3 == `number` && typeof o3 == `number` ? a3 - o3 : i2.compare(String(a3), String(o3));
    return (t2.descending ? -s3 : s3) || i2.compare(e3.id, n3.id);
  });
  let o2 = Math.max(10, Math.min(100, Math.floor(t2.pageSize ?? 40))),
    s2 = Math.max(1, Math.ceil(a2.length / o2)),
    c2 = Math.min(s2 - 1, Math.max(0, Math.floor(t2.page ?? 0)));
  return {
    rows: a2.slice(c2 * o2, (c2 + 1) * o2),
    total: a2.length,
    pages: s2,
    page: c2,
    pageSize: o2
  };
};
ctx.Hs = function Hs(e2, t2, n2) {
  let r2 = /* @__PURE__ */new Map(),
    i2 = e2.binaryArrays?.[t2]?.values ?? [],
    a2 = e2.binaryArrays?.[n2]?.values ?? [],
    o2 = Array.isArray(a2) ? a2.join(``) : ``;
  return Array.isArray(i2) && i2.forEach((e3, t3) => {
    let n3 = Number(e3);
    if (!Number.isFinite(n3)) return;
    let i3 = o2.slice(t3 * 12, (t3 + 1) * 12).trim();
    i3 && r2.set(n3, i3);
  }), r2;
};
ctx.Us = function Us(e2) {
  let t2 = ctx.Vs.get(e2);
  return t2 || (t2 = {
    area: ctx.Hs(e2, `Numare`, `Arnam`),
    zone: ctx.Hs(e2, `Numzon`, `Zoname`),
    owner: ctx.Hs(e2, `Numown`, `Owname`)
  }, ctx.Vs.set(e2, t2)), t2;
};
ctx.Ws = function Ws(e2, t2) {
  let n2 = Number(t2);
  return Number.isFinite(n2) ? ctx.Us(e2).area.get(n2) ?? null : null;
};
ctx.Gs = function Gs(e2, t2) {
  let n2 = Number(t2);
  return Number.isFinite(n2) ? ctx.Us(e2).owner.get(n2) ?? null : null;
};
ctx.Ks = function Ks(e2, t2) {
  let n2 = e2 ?? (t2 == null || t2 === `` ? `` : String(t2));
  return n2 ? t2 == null || t2 === `` ? n2 : `${n2} (${t2})` : `\u2014`;
};
ctx.qs = function qs(e2) {
  return typeof e2 == `string` ? e2.normalize(`NFKC`).trim().replace(/\s+/gu, ` `).toLocaleLowerCase(`tr-TR`) : ``;
};
ctx.Js = function Js(e2) {
  return typeof e2 == `number` && Number.isSafeInteger(e2) && e2 >= 0 ? String(e2) : typeof e2 == `string` && /^\d+$/.test(e2.trim()) ? String(Number(e2.trim())) : null;
};
ctx.Ys = function Ys(e2) {
  let t2 = e2.fields.latitude,
    n2 = e2.fields.longitude;
  return typeof t2 != `number` || typeof n2 != `number` || !Number.isFinite(t2) || !Number.isFinite(n2) || t2 === 0 || n2 === 0 || t2 < -90 || t2 > 90 || n2 < -180 || n2 > 180 ? null : {
    latitude: t2,
    longitude: n2
  };
};
ctx.Xs = function Xs(e2, t2) {
  return e2.sourceEquipmentId ? t2.get(e2.sourceEquipmentId) ?? null : null;
};
ctx.Zs = function Zs(e2, t2) {
  let n2 = new Map(e2.equipment.map(e3 => [e3.id, e3])),
    r2 = e2.equipment.filter(e3 => e3.kind === `substation`),
    i2 = /* @__PURE__ */new Map(),
    a2 = /* @__PURE__ */new Set(),
    o2 = /* @__PURE__ */new Map();
  for (let e3 of r2) {
    let t3 = ctx.Js(e3.fields.isub) ?? ctx.Js(e3.id);
    if (t3 !== null) {
      let n4 = i2.get(t3);
      n4 && n4.id !== e3.id ? a2.add(t3) : i2.set(t3, e3);
    }
    let n3 = ctx.qs(e3.name || e3.fields.name);
    n3 && (o2.get(n3) ?? (o2.set(n3, []), o2.get(n3))).push(e3);
  }
  let s2 = [],
    c2 = [];
  for (let [e3, t3] of i2) {
    if (a2.has(e3)) continue;
    let n3 = ctx.Ys(t3);
    if (!n3) {
      c2.push(e3);
      continue;
    }
    s2.push({
      isub: e3,
      sourceEquipmentId: t3.id,
      name: t3.name || String(t3.fields.name ?? `TM ${e3}`),
      ...n3,
      sourceFields: {
        isub: t3.fields.isub ?? t3.id,
        latitude: t3.fields.latitude,
        longitude: t3.fields.longitude
      }
    });
  }
  let l2 = new Set(s2.map(e3 => e3.isub)),
    u2 = [],
    d2 = [],
    f2 = /* @__PURE__ */new Set(),
    p2 = 0,
    m2 = 0,
    h2 = 0;
  for (let r3 of t2.buses) {
    if (!r3.source) continue;
    let t3 = ctx.Xs(r3, n2),
      s3 = String(t3?.name ?? t3?.fields.name ?? r3.id),
      c3,
      g3,
      _2 = null;
    if (!t3 || t3.kind !== `bus`) _2 = `NO_SOURCE_BUS_RECORD`;else {
      let n3 = t3.fields.isub;
      if (n3 != null && n3 !== ``) {
        let e3 = ctx.Js(n3);
        g3 = `EXPLICIT_SOURCE_REFERENCE`, e3 !== null && a2.has(e3) ? (c3 = void 0, _2 = `AMBIGUOUS_STATION_REFERENCE`) : c3 = e3 === null ? void 0 : i2.get(e3), !c3 && !_2 && (_2 = `UNKNOWN_STATION_REFERENCE`);
      } else {
        let e3 = ctx.qs(t3.name || t3.fields.name),
          n4 = e3 ? o2.get(e3) ?? [] : [];
        n4.length === 1 ? (c3 = n4[0], g3 = `EXACT_UNIQUE_SOURCE_NAME_ALIAS`) : n4.length > 1 ? (_2 = `AMBIGUOUS_STATION_NAME`, h2++) : _2 = `NO_STATION_REFERENCE`;
      }
      if (c3 && g3) {
        let n4 = ctx.Js(c3.fields.isub) ?? ctx.Js(c3.id);
        if (n4 === null) _2 = `UNKNOWN_STATION_REFERENCE`;else if (!l2.has(n4)) _2 = `STATION_COORDINATE_INVALID`;else {
          u2.push({
            sourceSha256: e2.source.sha256,
            connectionKey: r3.connectionKey,
            busId: r3.id,
            externalNumber: r3.externalNumber,
            stationIsub: n4,
            method: g3,
            busSourceEquipmentId: t3.id,
            busSourceFields: {
              name: t3.name,
              ...t3.fields
            },
            stationSourceFields: {
              name: c3.name,
              ...c3.fields
            }
          }), f2.add(n4), g3 === `EXPLICIT_SOURCE_REFERENCE` ? p2++ : m2++;
          continue;
        }
      }
    }
    d2.push({
      connectionKey: r3.connectionKey,
      busId: r3.id,
      externalNumber: r3.externalNumber,
      name: s3,
      reason: _2 ?? `NO_STATION_REFERENCE`
    });
  }
  let g2 = [...i2.keys()].filter(e3 => l2.has(e3) && !f2.has(e3));
  return {
    stations: s2,
    associations: u2,
    unmatched: d2,
    unreferencedStationIsubs: g2,
    invalidCoordinateStationIsubs: c2,
    sourceSha256: e2.source.sha256,
    counts: {
      sourceStations: r2.length,
      validCoordinateStations: s2.length,
      invalidCoordinateStations: c2.length,
      sourceBuses: t2.buses.filter(e3 => e3.source).length,
      explicitReferences: p2,
      exactNameAliases: m2,
      ambiguousBuses: h2,
      unmatchedBuses: d2.length,
      unreferencedStations: g2.length
    }
  };
};
ctx.Qs = function Qs(e2) {
  let t2 = String(e2 ?? ``);
  return /^[\s\u0000-\u001f\u007f]*[=+@-]/.test(t2) && (t2 = `'` + t2), `"` + t2.replace(/"/g, `""`) + `"`;
};
ctx.ec = function ec(e2) {
  return ctx.$s([[`source_sha256`, `bus_id`, `external_number`, `bus_name`, `association_status`, `association_rule`], ...e2.unmatched.map(t2 => [e2.sourceSha256, t2.busId, t2.externalNumber, t2.name, t2.reason, `EXPLICIT_SOURCE_REFERENCE_THEN_EXACT_UNIQUE_SOURCE_NAME_ALIAS`])]);
};
ctx.tc = function tc(e2) {
  let t2 = new Map(e2.stations.map(e3 => [e3.isub, e3]));
  return ctx.$s([[`source_sha256`, `bus_id`, `external_number`, `connection_key`, `bus_source_equipment_id`, `station_isub`, `station_name`, `latitude`, `longitude`, `association_method`, `bus_source_fields_json`, `station_source_fields_json`], ...e2.associations.map(e3 => {
    let n2 = t2.get(e3.stationIsub);
    return [e3.sourceSha256, e3.busId, e3.externalNumber, e3.connectionKey, e3.busSourceEquipmentId, e3.stationIsub, n2.name, n2.latitude, n2.longitude, e3.method, JSON.stringify(e3.busSourceFields), JSON.stringify(e3.stationSourceFields)];
  })]);
};
ctx.nc = function nc() {
  return ctx.$s([[`source_sha256`, `bus_id`, `bus_source_name`, `source_bus_isub`, `station_isub`, `station_name`, `latitude`, `longitude`, `association_method`, `evidence_note`]]);
};
ctx.rc = function rc(e2, t2) {
  let n2 = ctx.Zs(e2, t2),
    r2 = ctx.Q(`details`, `ga-psse-advanced ga-psse-geography-quality`),
    i2 = ctx.Q(`div`, `ga-toolbar`),
    a2 = e2.source.sha256.slice(0, 12),
    o2 = n2.counts;
  return r2.append(ctx.Q(`summary`, ``, `Geli\u015Fmi\u015F / Koordinat provenans\u0131 ve e\u015Fle\u015Fmeyen baralar`), ctx.Q(`p`, `ga-muted`, `${o2.validCoordinateStations}/${o2.sourceStations} kaynak TM koordinat\u0131 \xB7 ${o2.explicitReferences + o2.exactNameAliases}/${o2.sourceBuses} e\u015Fle\u015Fen bara \xB7 ${o2.unmatchedBuses} e\u015Fle\u015Fmeyen \xB7 ${o2.ambiguousBuses} belirsiz \xB7 ${o2.invalidCoordinateStations} ge\xE7ersiz koordinat.`)), i2.append(ctx.$(`E\u015Fle\u015Fmeyen bara CSV`, () => ctx.Os(ctx.ec(n2), `psse-tm-eslesmeyen-baralar-${a2}.csv`, `text/csv;charset=utf-8`)), ctx.$(`TM e\u015Fle\u015Fme provenans\u0131 CSV`, () => ctx.Os(ctx.tc(n2), `psse-tm-geo-provenance-${a2}.csv`, `text/csv;charset=utf-8`)), ctx.$(`Bo\u015F koordinat \u015Fablonu`, () => ctx.Os(ctx.nc(), `TM_KOORDINAT_ESLEME_SABLONU.csv`, `text/csv;charset=utf-8`))), r2.append(i2, ctx.Q(`p`, `ga-muted`, `E\u015Fle\u015Fmeler yaln\u0131z a\xE7\u0131k kaynak ili\u015Fkisi veya tekil tam kaynak ad\u0131 ile kurulur. CSV kaynak kimliklerini ve e\u015Fle\u015Fme y\xF6ntemini korur; tam provenans dosyas\u0131 ger\xE7ek koordinat i\xE7erir ve yerel kullan\u0131m i\xE7indir.`)), r2;
};
ctx.uc = function uc(e2, t2) {
  let n2 = ctx.Q(`section`, `ga-feature ga-psse-view ga-psse-` + e2),
    r2 = ctx.Q(`p`, `ga-notice`, `PSS/E kaynak incelemesi \xB7 SOURCE_SAVED de\u011Ferleri hesaplanm\u0131\u015F sonu\xE7 de\u011Fildir. \xC7\xF6z\xFCm uygunlu\u011Fu ve y\xF6ntem kapsam\u0131 Y\xFCk Ak\u0131\u015F\u0131 b\xF6l\xFCm\xFCnde denetlenir.`),
    i2 = ctx.Q(`div`);
  n2.append(r2, i2);
  let a2 = ``,
    o2 = e2 === `operating` ? `bus` : `substation`,
    s2 = 0,
    c2 = `id`,
    l2 = false,
    u2 = ``,
    d2 = ``,
    f2 = ``,
    p2 = ``,
    m2 = 40,
    h2 = ``,
    g2 = `substation`,
    _2 = 0,
    v2 = {},
    y2 = {},
    b2 = {},
    x2 = {
      main: false,
      tables: {}
    },
    S2 = /* @__PURE__ */new Map(),
    C2 = ctx.Q(`div`, `ga-toolbar`),
    w2 = ctx.Q(`nav`, `ga-tabs`),
    T2 = ctx.Q(`input`),
    E2 = ctx.Q(`select`),
    D2 = ctx.Q(`select`),
    O2 = ctx.Q(`select`),
    k2 = ctx.Q(`select`),
    A2 = ctx.Q(`dialog`, `ga-record-dialog`),
    j2 = ctx.Q(`div`, `ga-detail`);
  T2.type = `search`, T2.placeholder = `Ad / kaynak kimli\u011Fi / bara`, T2.setAttribute(`aria-label`, `PSS/E ekipman aramas\u0131`), E2.setAttribute(`aria-label`, `PSS/E ekipman durumu`), E2.append(new Option(`T\xFCm durumlar`, ``));
  for (let [e3, t3] of [[`1`, `Serviste / durum 1`], [`0`, `Devre d\u0131\u015F\u0131 / durum 0`], [`2`, `Kaynak durum 2`], [`3`, `Kaynak durum 3`], [`4`, `Kaynak durum 4`], [`unknown`, `Kaynakta belirtilmemi\u015F`]]) E2.append(new Option(t3, e3));
  O2.setAttribute(`aria-label`, `PSS/E sayfa boyutu`);
  for (let e3 of [20, 40, 80, 100]) O2.append(new Option(e3 + ` / sayfa`, String(e3)));
  O2.value = String(m2), D2.setAttribute(`aria-label`, `PSS/E gerilim band\u0131`), D2.append(new Option(`T\xFCm gerilim bantlar\u0131`, ``), ...ctx.js.map(e3 => new Option(e3.label, e3.id))), k2.setAttribute(`aria-label`, `PSS/E bulgu \xF6nemi`), k2.append(new Option(`T\xFCm \xF6nemler`, ``), new Option(`Hata`, `ERROR`), new Option(`Uyar\u0131`, `WARNING`), new Option(`Bilgi`, `INFO`));
  let M2 = ctx.$(`JSON indir`, () => {
    let e3 = t2.getModel();
    e3 && ctx.Os(JSON.stringify(e3, null, 2), `PSSE_` + e3.source.name.replace(/\.[^.]+$/, ``) + `.json`, `application/json`);
  });
  C2.append(T2, e2 === `quality` ? k2 : E2, ...(e2 === `quality` ? [] : [D2]), O2, ...(e2 === `summary` ? [] : [M2])), A2.setAttribute(`aria-label`, `PSS/E kaynak ekipman ayr\u0131nt\u0131s\u0131`), A2.append(ctx.$(`Kapat`, () => A2.close()), j2), n2.append(A2);
  let N2 = () => {
    s2 = 0, K2();
  };
  T2.oninput = () => {
    u2 = T2.value, N2();
  }, E2.onchange = () => {
    d2 = E2.value, N2();
  }, D2.onchange = () => {
    ctx.Ls(D2.value ? [D2.value] : []), N2();
  }, k2.onchange = () => {
    p2 = k2.value, N2();
  }, O2.onchange = () => {
    m2 = Number(O2.value), N2();
  };
  function P2(e3, t3) {
    let n3 = ctx.Q(`div`, `ga-card`);
    return n3.append(ctx.Q(`span`, `ga-muted`, e3), ctx.Q(`strong`, ``, t3)), n3;
  }
  function F2(e3) {
    t2.onSelection?.(e3), j2.replaceChildren(ctx.Q(`h3`, ``, e3.name || e3.id), ctx.Q(`p`, `ga-code`, ctx.Ps[e3.kind] + ` \xB7 ` + e3.id), ctx.Q(`p`, `ga-muted`, `Kaynak alanlar\u0131 ve ba\u011Flant\u0131lar; eksik de\u011Ferler doldurulmaz.`), ctx.Q(`pre`, ``, JSON.stringify({
      id: e3.id,
      buses: e3.buses,
      status: e3.status,
      nominalKv: e3.nominalKv,
      fields: e3.fields,
      operating: e3.operating
    }, null, 2))), A2.open || A2.showModal();
  }
  function I2(e3, t3, n3, r3) {
    let i3 = ctx.Q(`div`, `ga-pager`),
      a3 = ctx.$(`\u2190 \xD6nceki`, () => {
        r3 ? r3(n3 - 1) : (s2--, K2());
      }),
      o3 = ctx.$(`Sonraki \u2192`, () => {
        r3 ? r3(n3 + 1) : (s2++, K2());
      });
    return a3.disabled = n3 === 0, o3.disabled = n3 >= t3 - 1, i3.append(a3, ctx.Q(`span`, `ga-muted`, `${ctx.ac(e3)} kay\u0131t \xB7 ${n3 + 1}/${t3}`), o3), i3;
  }
  function L2(e3, t3) {
    let n3 = e3.sourceTables[t3.kind],
      r3 = Array.isArray(n3) ? n3 : [],
      i3 = /* @__PURE__ */new Map();
    for (let e4 of r3) {
      let n4 = Number(e4[t3.codeField]);
      Number.isFinite(n4) && i3.set(n4, String(e4[t3.nameField] ?? ``).trim());
    }
    let a3 = {
      AREA: ctx.Us(e3).area,
      ZONE: ctx.Us(e3).zone,
      OWNER: ctx.Us(e3).owner
    }[t3.kind];
    for (let [e4, t4] of a3) t4 && !i3.has(e4) && i3.set(e4, t4);
    let o3 = /* @__PURE__ */new Map();
    for (let n4 of e3.equipment) if (n4.kind === `bus`) {
      let e4 = Number(n4.fields[t3.busField]);
      Number.isFinite(e4) && (o3.set(e4, (o3.get(e4) ?? 0) + 1), i3.has(e4) || i3.set(e4, ``));
    }
    return [...i3].map(([e4, t4]) => ({
      code: e4,
      name: t4,
      busCount: o3.get(e4) ?? 0
    })).sort((e4, t4) => t4.busCount - e4.busCount || e4.code - t4.code);
  }
  function R2(e3, t3) {
    let n3 = L2(e3, t3),
      r3 = n3[0],
      i3 = b2[t3.kind] ?? false,
      a3 = ctx.Q(`details`, `ga-psse-azocard`);
    a3.open = i3, a3.ontoggle = () => {
      b2[t3.kind] = a3.open;
    };
    let o3 = ctx.Q(`summary`);
    o3.append(ctx.Q(`small`, `ga-muted`, t3.heading), ctx.Q(`strong`, ``, r3 ? r3.name ? ctx.Ks(r3.name, r3.code) : String(r3.code) : `\u2014`), ctx.Q(`span`, `ga-psse-azocard-sub`, r3 ? `${ctx.ac(r3.busCount)} bara \xB7 ${ctx.ac(n3.length)} kaynak kodu` : `kaynak kodu yok`));
    let s3 = ctx.Q(`div`, `ga-psse-azocard-body`),
      c3 = ctx.Q(`input`);
    c3.type = `search`, c3.placeholder = `Ad veya kod ara`, c3.setAttribute(`aria-label`, `${t3.heading} ara`), c3.value = y2[t3.kind] ?? ``;
    let l3 = ctx.Q(`div`, `ga-table-wrap`),
      u3 = ctx.Q(`p`, `ga-muted`),
      d3 = ctx.Q(`table`, `ga-table ga-psse-azocard-table`),
      f3 = ctx.Q(`thead`),
      p3 = ctx.Q(`tr`);
    for (let e4 of [`Kod`, `Ad`, `Bara`]) p3.append(ctx.Q(`th`, ``, e4));
    f3.append(p3);
    let m3 = () => {
      let e4 = (y2[t3.kind] ?? ``).toLocaleLowerCase(`tr`),
        r4 = n3.filter(t4 => !e4 || `${t4.code} ${t4.name}`.toLocaleLowerCase(`tr`).includes(e4)),
        i4 = ctx.Q(`tbody`);
      for (let e5 of r4.slice(0, 100)) {
        let t4 = ctx.Q(`tr`);
        t4.append(ctx.Q(`td`, ``, String(e5.code)), ctx.Q(`td`, ``, e5.name || `Kaynakta ad belirtilmemi\u015F`), ctx.Q(`td`, ``, ctx.ac(e5.busCount))), i4.append(t4);
      }
      d3.replaceChildren(f3, i4), l3.replaceChildren(d3), u3.textContent = r4.length > 100 ? `\u0130lk 100 sat\u0131r g\xF6steriliyor; aramayla daralt\u0131n (${ctx.ac(r4.length)} kay\u0131t).` : r4.length === n3.length ? `${ctx.ac(r4.length)} kaynak kodu \xB7 bara say\u0131lar\u0131 kaynak bus alan\u0131 ${t3.busField} \xFCzerinden.` : `${ctx.ac(r4.length)}/${ctx.ac(n3.length)} kaynak kodu.`;
    };
    return c3.oninput = () => {
      y2[t3.kind] = c3.value, m3();
    }, m3(), s3.append(c3, l3, u3), a3.append(o3, s3), a3;
  }
  function z2(e3, t3) {
    let n3 = ctx.Q(`details`, `ga-psse-advanced-table`);
    n3.open = x2.tables[e3] ?? false, n3.ontoggle = () => {
      x2.tables[e3] = n3.open;
    };
    let r3 = Array.isArray(t3) ? t3 : [],
      i3 = r3.filter(e4 => !!e4 && typeof e4 == `object`);
    n3.append(ctx.Q(`summary`, ``, `${e3} \xB7 ${ctx.ac(r3.length)} kay\u0131t`));
    let a3 = ctx.Q(`div`, `ga-psse-advanced-body`);
    if (!Array.isArray(t3)) a3.append(ctx.Q(`pre`, ``, JSON.stringify(t3, null, 2).slice(0, 4e3)));else if (!i3.length) a3.append(ctx.Q(`p`, `ga-muted`, `Kay\u0131t yok.`));else {
      let t4 = Math.max(1, Math.ceil(i3.length / 100)),
        n4 = () => {
          let o3 = Math.min(v2[e3] ?? 0, t4 - 1);
          v2[e3] = o3;
          let s3 = [...new Set(i3.slice(0, 50).flatMap(e4 => Object.keys(e4)))].slice(0, 8),
            c3 = ctx.Q(`table`, `ga-table`),
            l3 = ctx.Q(`thead`),
            u3 = ctx.Q(`tr`);
          for (let e4 of s3) u3.append(ctx.Q(`th`, ``, e4));
          l3.append(u3);
          let d3 = ctx.Q(`tbody`);
          for (let e4 of i3.slice(o3 * 100, (o3 + 1) * 100)) {
            let t5 = ctx.Q(`tr`);
            for (let n5 of s3) {
              let r4 = ctx.Q(`td`, ``, ctx.ic(e4[n5]));
              r4.title = typeof e4[n5] == `object` ? JSON.stringify(e4[n5]) : String(e4[n5] ?? ``), t5.append(r4);
            }
            d3.append(t5);
          }
          c3.append(l3, d3);
          let f3 = ctx.Q(`div`, `ga-table-wrap`);
          f3.append(c3);
          let p3 = ctx.Q(`div`, `ga-pager`),
            m3 = ctx.$(`\u2190 \xD6nceki`, () => {
              v2[e3] = Math.max(0, o3 - 1), n4();
            }),
            h3 = ctx.$(`Sonraki \u2192`, () => {
              v2[e3] = Math.min(t4 - 1, o3 + 1), n4();
            });
          m3.disabled = o3 === 0, h3.disabled = o3 >= t4 - 1, p3.append(m3, ctx.Q(`span`, `ga-muted`, `${ctx.ac(i3.length)} kay\u0131t \xB7 sayfa ${o3 + 1}/${t4} \xB7 ${s3.length} kolon`), h3), a3.replaceChildren(p3, f3), r3.length !== i3.length && a3.append(ctx.Q(`p`, `ga-muted`, `${ctx.ac(r3.length - i3.length)} kay\u0131t nesne olmad\u0131\u011F\u0131 i\xE7in tabloda \xF6nizlenmez; JSON indirimi t\xFCm\xFCn\xFC korur.`)), s3.length < Object.keys(i3[0] ?? {}).length && a3.append(ctx.Q(`p`, `ga-muted`, `\u0130lk kolonlar \xF6nizlenir; t\xFCm alanlar JSON indiriminin i\xE7indedir.`));
        };
      n4();
    }
    return n3.append(a3), n3;
  }
  function B2(e3) {
    let t3 = ctx.Q(`details`, `ga-psse-advanced`);
    t3.open = x2.main, t3.ontoggle = () => {
      x2.main = t3.open;
    };
    let n3 = Object.entries(e3.sourceTables),
      r3 = n3.reduce((e4, [, t4]) => e4 + (Array.isArray(t4) ? t4.length : 0), 0),
      i3 = Object.keys(e3.binaryArrays ?? {});
    t3.append(ctx.Q(`summary`, ``, `Geli\u015Fmi\u015F / Kaynak Veri \xB7 ${n3.length} kaynak tablosu \xB7 ${ctx.ac(r3)} kay\u0131t \xB7 ${i3.length} binary dizi \xB7 ${e3.sourceResults.length} analiz kayd\u0131`), ctx.Q(`p`, `ga-muted`, `Salt okunur \xF6nizleme (sayfa ba\u015F\u0131na 100 sat\u0131r). Hi\xE7bir kaynak veri g\xF6sterimden kaybolmaz; tam i\xE7erik JSON indirimiyle korunur.`));
    for (let [e4, r4] of n3) t3.append(z2(e4, r4));
    if (i3.length) {
      let n4 = ctx.Q(`details`, `ga-psse-advanced-table`),
        r4 = ctx.Q(`div`, `ga-psse-advanced-list`);
      n4.append(ctx.Q(`summary`, ``, `binary diziler \xB7 ${i3.length}`));
      for (let t4 of i3) {
        let n5 = e3.binaryArrays?.[t4];
        r4.append(ctx.Q(`div`, `ga-psse-advanced-list-row`, `${t4} \xB7 ${n5?.type ?? `?`} \xB7 ${ctx.ac(n5?.count ?? 0)}`));
      }
      n4.append(r4), t3.append(n4);
    }
    if (e3.sourceResults.length) {
      let n4 = ctx.Q(`details`, `ga-psse-advanced-table`),
        r4 = ctx.Q(`div`, `ga-psse-advanced-list`);
      n4.append(ctx.Q(`summary`, ``, `analiz kay\u0131tlar\u0131 \xB7 ${e3.sourceResults.length}`));
      for (let t4 of e3.sourceResults) {
        let e4 = ctx.Q(`div`, `ga-psse-advanced-list-row`, `${t4.type} \xB7 ${t4.evidence}`);
        e4.title = JSON.stringify(t4.values).slice(0, 400), r4.append(e4);
      }
      n4.append(r4), t3.append(n4);
    }
    return t3.append(M2), t3;
  }
  function V2(e3) {
    let t3 = [{
      key: `name`,
      label: e3 === `substation` ? `TM ad\u0131` : e3 === `bus` ? `Bara ad\u0131` : `Ad`
    }];
    return e3 !== `bus` && e3 !== `substation` && t3.push({
      key: `buses`,
      label: `Baralar`
    }), t3.push({
      key: `area`,
      label: `YTM`
    }, {
      key: `nominalKv`,
      label: `Gerilim (kV)`
    }, {
      key: `kind`,
      label: `Tip`
    }, {
      key: `status`,
      label: `\u0130\u015Fletme durumu`
    }, {
      key: `id`,
      label: `Kaynak kimlikleri`,
      secondary: true
    }), t3;
  }
  function H2(e3, t3, n3) {
    let r3 = ctx.Q(`td`);
    if (n3.key === `name`) r3.textContent = t3.name || `\u2014`;else if (n3.key === `buses`) r3.textContent = t3.buses.map(e4 => S2.get(e4) ?? String(e4)).join(` \u2192 `) || `\u2014`, r3.title = t3.buses.join(` \u2192 `);else if (n3.key === `area`) {
      let n4 = t3.fields.area;
      if (n4 == null || n4 === ``) r3.textContent = `\u2014`;else {
        let t4 = ctx.Ws(e3, Number(n4));
        r3.textContent = t4 ? ctx.Ks(t4, Number(n4)) : ctx.ic(n4), r3.title = String(n4);
      }
    } else if (n3.key === `nominalKv`) r3.textContent = t3.nominalKv === null ? `\u2014` : ctx.ic(t3.nominalKv);else if (n3.key === `kind`) r3.textContent = ctx.Ps[t3.kind];else if (n3.key === `status`) r3.textContent = ctx.sc(t3.status);else {
      r3.className = `ga-psse-cell-secondary`;
      let e4 = [t3.id];
      for (let n4 of [`ibus`, `ckt`, `savIndex`]) t3.fields[n4] !== void 0 && t3.fields[n4] !== null && e4.push(`${n4} ${ctx.ic(t3.fields[n4])}`);
      r3.textContent = e4.join(` \xB7 `);
    }
    return r3;
  }
  function U2(e3) {
    let n3 = ctx.Q(`p`, `ga-psse-model-line`);
    n3.append(ctx.Q(`strong`, ``, e3.source.name), ctx.Q(`span`, `ga-psse-model-meta`, ` \xB7 ${e3.source.format} \xB7 ${ctx.oc(e3.source.byteLength)} \xB7 ${e3.completeness} \xB7 ${ctx.ic(e3.case.baseMva)} MVA \xB7 ${ctx.ic(e3.case.frequencyHz)} Hz \xB7 \xE7\xF6z\xFCmleme ${e3.timing.decodeMs.toFixed(1)} ms`)), n3.title = `SHA-256 ${e3.source.sha256} \xB7 binary revizyon ${e3.source.revision} \xB7 ${ctx.ac(e3.source.byteLength)} bayt`;
    let r3 = ctx.Q(`details`, `ga-psse-advanced`);
    r3.append(ctx.Q(`summary`, ``, `Teknik Detaylar`), ctx.Q(`code`, `ga-model-sha`, e3.source.sha256), ctx.Q(`p`, `ga-muted`, `Binary revizyon ${e3.source.revision} \xB7 ${ctx.ac(e3.source.byteLength)} bayt \xB7 \xE7\xF6z\xFCmleme ${e3.timing.decodeMs.toFixed(1)} ms \xB7 ${ctx.ac(e3.equipment.length)} kaynak kayd\u0131`), ctx.Q(`p`, `ga-muted`, `Model kapsam\u0131: ${e3.completeness} \xB7 ${e3.completeness === `PARTIAL` ? `Eksik elektriksel model; envanter tan\u0131sal inceleme i\xE7indir.` : `\xC7\xF6z\xFCmlenen kaynak envanteri.`}`), ctx.Q(`p`, `ga-muted`, e3.case.title.filter(e4 => e4.trim()).join(` / `) || `Kaynak ba\u015Fl\u0131\u011F\u0131 belirtilmemi\u015F.`));
    let a3 = ctx.Q(`div`, `ga-psse-kpi-row`);
    for (let n4 of ctx.cc) {
      let r4 = e3.equipment.filter(e4 => e4.kind === n4).length,
        i3 = ctx.Q(`button`, `ga-psse-kpi`);
      i3.type = `button`, i3.append(ctx.Q(`span`, `ga-psse-kpi-label`, ctx.Ps[n4]), ctx.Q(`span`, `ga-psse-kpi-count`, ctx.ac(r4))), i3.title = `${ctx.Ps[n4]} envanter tablosunu g\xF6ster`, i3.setAttribute(`aria-pressed`, String(n4 === g2)), i3.onclick = () => {
        g2 = n4, _2 = 0, t2.onKind?.(n4), K2();
      }, a3.append(i3);
    }
    let o3 = ctx.Ns(e3.equipment.filter(e4 => e4.kind === `bus`).map(e4 => e4.nominalKv)),
      s3 = new Set(ctx.Is()),
      c3 = ctx.Q(`div`, `ga-psse-band-row`);
    c3.append(ctx.Q(`span`, `ga-psse-band-caption`, `Gerilim band\u0131:`));
    for (let e4 of ctx.js) {
      let t3 = ctx.Q(`button`, `ga-psse-band-chip`);
      t3.type = `button`, t3.textContent = `${e4.label} \xB7 ${ctx.ac(o3[e4.id])}`, t3.title = `Envanter tablolar\u0131n\u0131 bu gerilim band\u0131na indirger; \u226436 kV tek bantt\u0131r.`, t3.setAttribute(`aria-pressed`, String(s3.has(e4.id))), t3.onclick = () => {
        ctx.Rs(e4.id), K2();
      }, c3.append(t3);
    }
    c3.append(ctx.Q(`span`, `ga-psse-band-unknown`, `bilinmeyen: ${ctx.ac(o3.unknown)}`));
    let l3 = ctx.Q(`div`, `ga-psse-azo-row`);
    for (let t3 of ctx.lc) l3.append(R2(e3, t3));
    let u3 = ctx.Q(`p`, `ga-psse-azo-note`, `Adlar kaynak SAV s\xF6zl\xFCklerinden (Arnam/Zoname/Owname) okunur; ZONE gerilim s\u0131n\u0131f\u0131d\u0131r, BM (b\xF6lge m\xFCd\xFCrl\xFC\u011F\xFC) \u2260 YTM. Kodsuz adlar doldurulmaz.`),
      d3 = ctx.Q(`section`, `ga-psse-summary-inventory`),
      f3 = ctx.Ts.filter(t3 => e3.equipment.some(e4 => e4.kind === t3));
    f3.includes(g2) || (g2 = f3[0] ?? `bus`);
    let p3 = ctx.Bs(e3, {
      kind: g2,
      bands: ctx.Is(),
      sort: `name`,
      descending: false,
      page: _2,
      pageSize: 12
    });
    _2 = p3.page;
    let m3 = ctx.Q(`p`, `ga-psse-summary-caption`, `${ctx.Ps[g2]} envanteri \xB7 ${ctx.ac(p3.total)} kay\u0131t${ctx.Is().length ? ` \xB7 gerilim band\u0131 filtresi etkin` : ``}`),
      h3 = ctx.Q(`table`, `ga-table`),
      v3 = ctx.Q(`thead`),
      y3 = ctx.Q(`tr`);
    for (let e4 of V2(g2)) y3.append(ctx.Q(`th`, ``, e4.label));
    y3.append(ctx.Q(`th`, ``, `Ayr\u0131nt\u0131`)), v3.append(y3);
    let b3 = ctx.Q(`tbody`);
    for (let t3 of p3.rows) {
      let n4 = ctx.Q(`tr`);
      n4.dataset.id = t3.id;
      for (let r5 of V2(g2)) n4.append(H2(e3, t3, r5));
      let r4 = ctx.Q(`td`);
      r4.append(ctx.$(`Kaynak / detay`, () => F2(t3))), n4.append(r4), b3.append(n4);
    }
    h3.append(v3, b3);
    let x3 = ctx.Q(`div`, `ga-psse-summary-wrap`);
    x3.append(h3), d3.append(m3, x3, b3.children.length ? I2(p3.total, p3.pages, _2, e4 => {
      _2 = e4, K2();
    }) : ctx.Q(`p`, `ga-muted`, `Bu filtrede kay\u0131t yok.`)), i2.replaceChildren(n3, r3, a3, c3, l3, u3, d3, B2(e3));
  }
  function W2(e3) {
    let n3 = u2.trim().toLocaleLowerCase(`tr`),
      r3 = e3.findings.filter(e4 => (!p2 || e4.severity === p2) && (!n3 || JSON.stringify(e4).toLocaleLowerCase(`tr`).includes(n3))),
      a3 = Math.max(1, Math.ceil(r3.length / m2));
    s2 = Math.min(s2, a3 - 1);
    let o3 = ctx.Q(`div`, `ga-model-health`);
    for (let t3 of [`ERROR`, `WARNING`, `INFO`]) {
      let n4 = P2(t3, ctx.ac(e3.findings.filter(e4 => e4.severity === t3).length));
      n4.dataset.severity = t3, o3.append(n4);
    }
    let c3 = ctx.Q(`table`, `ga-table`),
      l3 = ctx.Q(`tr`);
    for (let e4 of [`\xD6nem`, `Kod`, `Kaynak kimli\u011Fi`, `Bulgu`]) l3.append(ctx.Q(`th`, ``, e4));
    let d3 = ctx.Q(`thead`);
    d3.append(l3);
    let f3 = ctx.Q(`tbody`);
    for (let e4 of r3.slice(s2 * m2, (s2 + 1) * m2)) {
      let t3 = ctx.Q(`tr`);
      for (let n4 of [e4.severity, e4.code, e4.equipment, e4.message]) t3.append(ctx.Q(`td`, ``, ctx.ic(n4)));
      f3.append(t3);
    }
    c3.append(d3, f3);
    let h3 = ctx.Q(`div`, `ga-table-wrap`);
    h3.append(c3), i2.replaceChildren(C2, o3, ctx.Q(`p`, `ga-notice`, `Kaynak tan\u0131s\u0131: ${e3.completeness} \xB7 Solver uygunlu\u011Fu Y\xFCk Ak\u0131\u015F\u0131 b\xF6l\xFCm\xFCnde y\xF6ntem baz\u0131nda de\u011Ferlendirilir \xB7 ${ctx.ac(r3.length)} kaynak bulgusu`), r3.length ? h3 : ctx.Q(`p`, `ga-muted`, `Bu filtrede bulgu yok; bu ifade analiz uygunlu\u011Fu onay\u0131 de\u011Fildir.`), I2(r3.length, a3, s2)), i2.append(ctx.rc(e3, t2.getNetwork?.() ?? ctx.No(e3)));
  }
  function G2(t3) {
    let n3 = ctx.Ts.filter(e3 => t3.equipment.some(t4 => t4.kind === e3));
    n3.includes(o2) || (o2 = n3[0] ?? `bus`), w2.replaceChildren(...n3.map(e3 => {
      let t4 = ctx.$(ctx.Ps[e3], () => {
        o2 = e3, c2 = `id`, N2();
      });
      return t4.setAttribute(`aria-pressed`, String(e3 === o2)), t4;
    })), w2.setAttribute(`aria-label`, e2 === `inventory` ? `PSS/E envanter t\xFCrleri` : `PSS/E kay\u0131tl\u0131 i\u015Fletme t\xFCrleri`);
    let r3 = e2 === `operating`,
      a3 = ctx.Is(),
      p3 = ctx.Bs(t3, {
        kind: o2,
        search: u2,
        status: d2,
        sort: c2,
        descending: l2,
        page: s2,
        pageSize: m2,
        operating: r3,
        bands: a3,
        minKv: r3 && f2 ? Number(f2) : void 0,
        maxKv: r3 && f2 ? Number(f2) : void 0
      });
    s2 = p3.page;
    let h3 = ctx.Q(`table`, `ga-table`),
      g3 = ctx.Q(`thead`);
    if (r3) {
      let e3 = [`id`, `name`, `buses`, `nominalKv`, `status`, ...[...new Set(t3.equipment.filter(e4 => e4.kind === o2).flatMap(e4 => Object.keys(e4.operating)))].slice(0, 10)],
        n4 = {
          id: `Kaynak kimli\u011Fi`,
          name: `Ad`,
          buses: `Bara ba\u011Flant\u0131lar\u0131`,
          nominalKv: `Nominal kV`,
          status: `Kaynak durumu`
        },
        i3 = ctx.Q(`tr`);
      for (let t4 of e3) {
        let e4 = ctx.Q(`th`),
          r4 = ctx.$((n4[t4] ?? t4) + (c2 === t4 ? l2 ? ` \u2193` : ` \u2191` : ``), () => {
            l2 = c2 === t4 && !l2, c2 = t4, N2();
          });
        e4.append(r4), i3.append(e4);
      }
      i3.append(ctx.Q(`th`, ``, `Ayr\u0131nt\u0131`)), g3.append(i3);
      let a4 = ctx.Q(`tbody`);
      for (let t4 of p3.rows) {
        let n5 = ctx.Q(`tr`);
        n5.dataset.id = t4.id;
        for (let i5 of e3) {
          let e4 = ctx.zs(t4, i5, r3),
            a5 = ctx.Q(`td`, ``, ctx.ic(e4));
          if (a5.title = typeof e4 == `object` ? JSON.stringify(e4) : String(e4 ?? `Kaynakta belirtilmemi\u015F`), t4.operating[i5]) {
            let e5 = t4.operating[i5];
            a5.title = `${e5.provenance} \xB7 ${e5.field} = ${e5.value}${e5.unit ? ` \xB7 ` + e5.unit : ``}${e5.offset === void 0 ? `` : ` \xB7 byte ` + e5.offset}`, a5.dataset.provenance = e5.provenance;
          }
          n5.append(a5);
        }
        let i4 = ctx.Q(`td`);
        i4.append(ctx.$(`Kaynak / detay`, () => F2(t4))), n5.append(i4), a4.append(n5);
      }
      h3.append(g3, a4);
    } else {
      let e3 = V2(o2),
        n4 = ctx.Q(`tr`);
      for (let t4 of e3) {
        let e4 = ctx.Q(`th`);
        if (t4.secondary) e4.append(ctx.Q(`span`, `ga-psse-th-secondary`, t4.label));else {
          let n5 = ctx.$(t4.label + (c2 === t4.key ? l2 ? ` \u2193` : ` \u2191` : ``), () => {
            l2 = c2 === t4.key && !l2, c2 = t4.key, N2();
          });
          e4.append(n5);
        }
        n4.append(e4);
      }
      n4.append(ctx.Q(`th`, ``, `Ayr\u0131nt\u0131`)), g3.append(n4);
      let r4 = ctx.Q(`tbody`);
      for (let n5 of p3.rows) {
        let i3 = ctx.Q(`tr`);
        i3.dataset.id = n5.id;
        for (let r5 of e3) {
          let e4 = H2(t3, n5, r5);
          r5.key !== `id` && r5.key !== `buses` && r5.key !== `area` && (e4.title = `${r5.label}: ${ctx.ic(ctx.zs(n5, r5.key))}`), i3.append(e4);
        }
        let a4 = ctx.Q(`td`);
        a4.append(ctx.$(`Kaynak / detay`, () => F2(n5))), i3.append(a4), r4.append(i3);
      }
      h3.append(g3, r4);
    }
    let _3 = ctx.Q(`div`, `ga-table-wrap`);
    _3.append(h3);
    let v3 = ctx.Q(`p`, `ga-muted`, r3 ? `Vm, Va, P/Q ve konumlar yaln\u0131z kaynakta bulunan de\u011Ferlerdir. H\xFCcre ipu\xE7lar\u0131 kaynak alan\u0131, birim ve varsa binary ofseti g\xF6sterir.` : `Kaynak kimlikleri, ba\u011Flant\u0131lar ve durum kodlar\u0131 korunur; kimlik s\xFCtunu ikincil g\xF6sterilir. T\xFCm alanlar ekipman ayr\u0131nt\u0131s\u0131nda bulunur.`);
    if (i2.replaceChildren(w2, C2, v3, _3, I2(p3.total, p3.pages, p3.page)), r3 && t3.sourceResults.length) {
      let e3 = ctx.Q(`details`, `ga-psse-advanced`);
      e3.append(ctx.Q(`summary`, ``, `Kaynakta bulunan di\u011Fer analiz kay\u0131tlar\u0131`), ctx.Q(`pre`, ``, JSON.stringify(t3.sourceResults, null, 2))), i2.append(e3);
    }
  }
  function K2() {
    let n3 = t2.getModel();
    if (!n3) {
      i2.replaceChildren(ctx.Q(`p`, `ga-empty`, `PSS/E modeli bekleniyor.`)), A2.close();
      return;
    }
    S2 = /* @__PURE__ */new Map();
    for (let e3 of n3.equipment) e3.kind === `bus` && e3.buses[0] !== void 0 && S2.set(e3.buses[0], e3.name || String(e3.buses[0]));
    a2 !== n3.source.sha256 && (a2 = n3.source.sha256, s2 = 0, _2 = 0, h2 = ``, A2.close(), d2 = ``, f2 = ``, g2 = `substation`, v2 = {}, y2 = {}, b2 = {}, x2 = {
      main: false,
      tables: {}
    }, ctx.Ls([]));
    let c3 = JSON.stringify([u2, d2, f2, p2, o2, m2]);
    c3 !== h2 && (s2 = 0, h2 = c3), r2.dataset.completeness = n3.completeness;
    let l3 = ctx.Is();
    D2.value = l3.length === 1 && [...D2.options].some(e3 => e3.value === l3[0]) ? l3[0] : ``, e2 === `summary` ? U2(n3) : e2 === `quality` ? W2(n3) : G2(n3);
  }
  return {
    element: n2,
    render: K2,
    deactivate() {
      A2.close();
    },
    setKind(e3) {
      o2 = e3, s2 = 0, K2();
    }
  };
};
ctx.J_ = function J_(e2, t2, n2, ...r2) {
  return {
    status: e2,
    sourceSha256: t2,
    method: n2,
    counts: ctx.z_(),
    maximumAbsoluteError: ctx.B_(),
    details: r2
  };
};
ctx.Y_ = function Y_(e2) {
  let t2 = e2.trim().toLowerCase();
  return [`fnsl`, `fullnewton`].includes(t2) ? {
    method: t2,
    solver: `NR_POLAR`,
    scope: `AC`
  } : [`fdns`, `fdns_xb`].includes(t2) ? {
    method: t2,
    solver: `FDNS_XB`,
    scope: `AC`
  } : [`dclf`, `dclf_2`].includes(t2) ? {
    method: t2,
    solver: `LOSSLESS_DC`,
    scope: `DC`
  } : null;
};
ctx.X_ = function X_(e2, t2, n2 = []) {
  if (!e2) return `column table is missing or malformed`;
  let r2 = [...t2, ...n2.filter(t3 => e2[t3] !== void 0)];
  for (let t3 of r2) if (!Array.isArray(e2[t3])) return `column ${t3} is missing or malformed`;
  let i2 = r2.map(t3 => e2[t3].length);
  return i2.some(e3 => e3 !== i2[0]) ? `columns ${r2.join(`, `)} have inconsistent row counts` : null;
};
ctx.Z_ = function Z_(e2, t2, n2) {
  return e2[t2]?.[n2];
};
ctx.Q_ = function Q_(e2) {
  let t2 = /* @__PURE__ */new Map();
  for (let n2 of e2.equipment) {
    let e3 = t2.get(n2.id) ?? [];
    e3.push(n2), t2.set(n2.id, e3);
  }
  return t2;
};
ctx.$_ = function $_(e2, t2) {
  return e2.diagnostics?.[t2];
};
ctx.ev = function ev(e2, t2, n2, r2) {
  let i2 = ctx.V_(e2),
    a2 = ctx.z_(),
    o2 = ctx.B_();
  if (!i2 || i2.schema !== `ga.psse.reference.v1` || i2.provenance !== `PSSE_REFERENCE`) return ctx.J_(`NOT_READY`, null, null, `Invalid or unsupported reference schema/provenance.`);
  let s2 = ctx.V_(i2.source),
    c2 = ctx.V_(i2.spec),
    l2 = typeof s2?.sha256 == `string` ? s2.sha256 : null,
    u2 = typeof c2?.method == `string` ? c2.method : null,
    d2 = u2 ? ctx.Y_(u2) : null,
    f2 = d2?.method ?? (u2?.trim().toLowerCase() || null),
    p2 = (e3, ...t3) => ({
      status: e3,
      sourceSha256: l2,
      method: f2,
      counts: a2,
      maximumAbsoluteError: o2,
      details: t3
    });
  if (!l2 || !ctx.L_.test(l2)) return p2(`NOT_READY`, `Reference source SHA-256 is missing or malformed.`);
  if (l2 !== t2.source.sha256 || n2.sourceSha256 !== t2.source.sha256) return p2(`SOURCE_MISMATCH`, `Reference, source model, and normalized network must have the same source SHA-256.`);
  if (!d2) return p2(`METHOD_MISMATCH`, `Unsupported or missing reference method: ${f2 ?? `unknown`}.`);
  if (d2.solver !== r2.method) return p2(`METHOD_MISMATCH`, `Reference method ${f2} requires ${d2.solver}, but the result method is ${r2.method}.`);
  if (r2.schema !== `ga.psse.calculation.v1` || r2.source !== `GA_PSSE_CALCULATED` || r2.status !== `CONVERGED`) return p2(`NOT_READY`, `A CONVERGED GA_PSSE_CALCULATED result is required (status=${String(r2.status)}, source=${String(r2.source)}).`);
  let m2 = r2.identity;
  if (!m2 || m2.schema !== `ga.psse.calculation-identity.v1` || m2.mode !== `PSSE` || m2.id !== r2.id || m2.solver !== r2.method || m2.algorithmId !== r2.method) return p2(`NOT_READY`, `Calculation identity is incomplete or inconsistent with the result.`);
  if (m2.sourceSha256 !== t2.source.sha256 || m2.modelHash !== n2.modelHash || m2.normalizedModelHash !== n2.modelHash || m2.normalizedRevision !== n2.revision || m2.topologyHash !== ctx.Bo(n2)) return p2(`NOT_READY`, `Calculation identity does not match the loaded normalized model and topology.`);
  let h2;
  try {
    h2 = ctx.Fo(n2).hash;
  } catch {
    return p2(`NOT_READY`, `The base PSS/E scenario identity could not be verified.`);
  }
  if (m2.scenarioHash !== h2) return p2(`NOT_READY`, `Reference comparison is available only for the matching base scenario; the calculation scenario hash differs.`);
  if (!ctx.L_.test(m2.optionsHash) || !m2.controlPolicyId || !m2.controlPolicyRevision || !m2.algorithmRevision || !m2.engineVersion || !m2.resultSchemaRevision) return p2(`NOT_READY`, `Calculation identity is missing required policy or version fields.`);
  if (c2?.profile !== `fixed-controls-v1` || ctx.U_(c2.harnessVersion) === null || ctx.U_(c2.harnessVersion) < 2 || ctx.U_(c2.iterations) === null || ctx.U_(c2.iterations) < 0 || ctx.H_(c2.toleranceMva) === null || ctx.H_(c2.toleranceMva) <= 0) return p2(`NOT_READY`, `Reference profile, harness version, iteration count, or tolerance is unsupported or malformed.`);
  if (typeof i2.optionsHash != `string` || !ctx.L_.test(i2.optionsHash)) return p2(`NOT_READY`, `Reference optionsHash is missing or malformed. It is not compared with the GA options hash.`);
  if (ctx.H_(i2.loadError) !== 0 || ctx.H_(i2.ierr) !== 0) return p2(`REFERENCE_NOT_SOLVED`, `Reference load/solver error must be zero (loadError=${String(i2.loadError)}, ierr=${String(i2.ierr)}).`);
  if (ctx.U_(i2.solved) === null) return p2(`NOT_READY`, `Reference solved flag is malformed (${String(i2.solved)}).`);
  if (d2.scope === `AC` && i2.solved !== 0) return p2(`REFERENCE_NOT_SOLVED`, `AC reference solver must report solved=0 and ierr=0 (solved=${String(i2.solved)}, ierr=${String(i2.ierr)}).`);
  if (!Array.isArray(i2.exportErrors) || i2.exportErrors.length > 0) return p2(`INCOMPLETE_COMPARISON`, `Reference exportErrors must be present and empty (count=${Array.isArray(i2.exportErrors) ? i2.exportErrors.length : `unknown`}).`);
  let g2 = c2.options;
  if (!Array.isArray(g2) || Array.from({
    length: g2.length
  }, (e3, t3) => ctx.U_(g2[t3]) !== null).some(e3 => !e3)) return p2(`NOT_READY`, `Reference spec.options must be a complete array of finite integers.`);
  if (d2.scope === `AC`) {
    if (g2.length !== 8 || g2.slice(0, 5).some(e4 => e4 !== 0) || ![0, 1].includes(g2[5]) || ![-1, 0].includes(g2[6]) || ![0, 1].includes(g2[7])) return p2(`NOT_READY`, `AC reference options must be the supported eight-entry PSS/E profile with the first five flags fixed at zero.`);
    let e3 = m2.initialVoltagePolicy === `SOURCE_SAVED` ? 0 : m2.initialVoltagePolicy === `FLAT` ? 1 : null;
    if (e3 === null || g2[5] !== e3) return p2(`NOT_READY`, `AC reference initialization option does not match the calculation initial-voltage policy.`);
    let t3 = m2.controlPolicyId === `FIXED_CONTROLS_NO_Q_LIMITS` ? -1 : m2.controlPolicyId === `FIXED_CONTROLS_Q_LIMITS` ? 0 : null;
    if (t3 === null || g2[6] !== t3 || m2.controlPolicyRevision !== `fixed-controls-1`) return p2(`NOT_READY`, `AC reference Q-limit option is incompatible with the calculation control policy.`);
  } else {
    let e3 = [0, 0, 1, 1, 0, 1];
    if (g2.length !== e3.length || g2.some((t3, n3) => t3 !== e3[n3])) return p2(`NOT_READY`, `DC reference requires the validated six-entry DCLF profile [0,0,1,1,0,1], including saving base-case DC bus angles.`);
    if (r2.diagnostics, !(ctx.$_(r2, `approximation`) === `LOSSLESS_DC` && ctx.$_(r2, `voltageMagnitudePu`) === 1 && ctx.$_(r2, `tapPolicy`) === `PSSE36_DCLF_COMPAT` && ctx.$_(r2, `reactanceTapConvention`) === `b=1/xPu, PSS/E 36.5 DCLF reference profile` && ctx.$_(r2, `loadVoltagePolicy`) === `SOURCE_SAVED` && ctx.$_(r2, `realShuntConsumptionIncluded`) === true && ctx.$_(r2, `terminalConductanceConsumptionIncluded`) === true && ctx.$_(r2, `realShuntVoltagePolicy`) === `SOURCE_SAVED` && [`FLAT_REFERENCE`, `SOURCE_REFERENCE_ANGLE`].includes(m2.initialVoltagePolicy) && ctx.$_(r2, `seriesResistanceAndLosses`) === `OMITTED_BY_LOSSLESS_DC` && m2.controlPolicyId === `FIXED_CONTROLS`)) return p2(`NOT_READY`, `DC comparison requires the PSS/E 36.5 DCLF tap profile, zero loss estimate/fixed phase options, source-saved load and real-shunt voltages, included real-shunt consumption, unit voltage magnitude, and explicit lossless diagnostics.`);
  }
  let _2 = ctx.q_(i2, `buses`),
    v2 = ctx.X_(_2, d2.scope === `AC` ? [`NUMBER`, `TYPE`, `PU`] : [`NUMBER`, `TYPE`], [`STATUS`, `ANGLE`, `ANGLED`]),
    y2 = _2?.ANGLED === void 0 ? _2?.ANGLE === void 0 ? null : `ANGLE` : `ANGLED`;
  if (v2 || !y2) return p2(`INCOMPLETE_COMPARISON`, `Reference bus table is incomplete: ${v2 ?? `both ANGLE and ANGLED columns are absent`}.`);
  let b2 = _2.NUMBER.length;
  if (d2.scope === `AC` && _2.PU.length !== b2 || _2[y2].length !== b2) return p2(`INCOMPLETE_COMPARISON`, `Reference bus table has inconsistent voltage or angle arrays.`);
  let x2 = e3 => {
      let t3 = _2.STATUS ? ctx.U_(ctx.Z_(_2, `STATUS`, e3)) : null,
        n3 = ctx.U_(ctx.Z_(_2, `TYPE`, e3));
      return (n3 === 1 || n3 === 2 || n3 === 3) && (!_2.STATUS || t3 === 1);
    },
    S2 = ctx.q_(i2, `branches`),
    C2 = ctx.q_(i2, `windings`),
    w2 = d2.scope === `AC` ? ctx.X_(S2, [`FROMNUMBER`, `TONUMBER`, `ID`, `STATUS`, `P`, `Q`]) : null,
    T2 = d2.scope === `AC` ? ctx.X_(C2, [`WIND1NUMBER`, `WIND2NUMBER`, `WIND3NUMBER`, `WNDNUM`, `ID`, `STATUS`, `P`, `Q`]) : null,
    E2 = d2.scope === `AC` ? ctx.q_(i2, `generators`) : null,
    D2 = d2.scope === `AC` ? ctx.X_(E2, [`NUMBER`, `ID`, `STATUS`, `PGEN`, `QGEN`]) : null;
  if (w2) return p2(`INCOMPLETE_COMPARISON`, `Reference branch table is incomplete: ${w2}.`);
  if (T2) return p2(`INCOMPLETE_COMPARISON`, `Reference winding table is incomplete: ${T2}.`);
  if (D2) return p2(`INCOMPLETE_COMPARISON`, `Reference generator table is incomplete: ${D2}.`);
  let O2 = ctx.z_(),
    k2 = ctx.B_(),
    A2 = [],
    j2 = [],
    M2 = (e3, t3, n3) => {
      O2.missing++, j2.length < 12 && j2.push(`${e3} ${t3}: ${n3}`);
    },
    N2 = (e3, t3) => {
      k2.powerMvar = ctx.K_(k2.powerMvar, Math.abs(e3 - t3));
    },
    P2 = e3 => {
      if (y2 === `ANGLED`) {
        let t4 = ctx.H_(ctx.Z_(_2, `ANGLED`, e3));
        if (t4 !== null) return t4;
      }
      let t3 = ctx.H_(ctx.Z_(_2, `ANGLE`, e3));
      return t3 === null ? null : t3 * 180 / Math.PI;
    },
    F2 = e3 => e3.externalNumber !== null && Number.isInteger(e3.externalNumber) ? e3.externalNumber : null,
    I2 = /* @__PURE__ */new Map(),
    L2 = /* @__PURE__ */new Set();
  for (let e3 = 0; e3 < n2.buses.length; e3++) {
    let t3 = n2.buses[e3];
    if (!t3.source) continue;
    let r3 = F2(t3);
    r3 !== null && (I2.has(r3) ? L2.add(r3) : I2.set(r3, e3));
  }
  let R2 = /* @__PURE__ */new Map(),
    z2 = /* @__PURE__ */new Set();
  for (let e3 = 0; e3 < b2; e3++) {
    let t3 = ctx.U_(ctx.Z_(_2, `NUMBER`, e3));
    if (t3 === null) {
      M2(`bus table`, `row ${e3 + 1}`, `external bus number is not a finite integer`);
      continue;
    }
    R2.has(t3) ? z2.add(t3) : R2.set(t3, e3);
  }
  for (let e3 of L2) M2(`network bus`, String(e3), `external bus number is ambiguous in the normalized model`);
  for (let e3 of z2) M2(`reference bus`, String(e3), `external bus number is duplicated in the reference`);
  let B2 = /* @__PURE__ */new Map(),
    V2 = /* @__PURE__ */new Set();
  for (let e3 of r2.busResults) B2.has(e3.connectionKey) ? V2.add(e3.connectionKey) : B2.set(e3.connectionKey, e3);
  let H2 = n2.buses.map((e3, t3) => ({
      bus: e3,
      index: t3
    })).filter(({
      bus: e3
    }) => e3.source && e3.status === 1 && e3.type !== 4),
    U2 = new Set(H2.map(({
      bus: e3
    }) => F2(e3)).filter(e3 => e3 !== null)),
    W2 = /* @__PURE__ */new Set();
  for (let e3 = 0; e3 < b2; e3++) if (x2(e3)) {
    let t3 = ctx.U_(ctx.Z_(_2, `NUMBER`, e3));
    t3 !== null && W2.add(t3);
  }
  for (let e3 of W2) U2.has(e3) || M2(`reference bus`, String(e3), `active source row has no active normalized physical bus`);
  let G2 = new Int32Array(n2.buses.length).fill(-1),
    K2 = n2.buses.map(() => []);
  for (let e3 of n2.branches) e3.status === 1 && n2.buses[e3.from]?.status === 1 && n2.buses[e3.to]?.status === 1 && (K2[e3.from].push(e3.to), K2[e3.to].push(e3.from));
  let q2 = 0;
  for (let e3 = 0; e3 < n2.buses.length; e3++) {
    if (n2.buses[e3].status !== 1 || G2[e3] !== -1) continue;
    let t3 = [e3];
    for (G2[e3] = q2; t3.length;) {
      let e4 = t3.pop();
      for (let n3 of K2[e4]) G2[n3] === -1 && (G2[n3] = q2, t3.push(n3));
    }
    q2++;
  }
  let ee2 = /* @__PURE__ */new Map(),
    J2 = /* @__PURE__ */new Set();
  for (let e3 = 0; e3 < q2; e3++) {
    let t3 = n2.buses.map((e4, t4) => ({
      bus: e4,
      index: t4
    })).filter(({
      bus: t4,
      index: n3
    }) => t4.source && t4.status === 1 && t4.type === 3 && G2[n3] === e3).sort((e4, t4) => (e4.bus.externalNumber ?? 0) - (t4.bus.externalNumber ?? 0));
    if (!t3.length) {
      J2.add(e3);
      continue;
    }
    let r3 = t3[0],
      i3 = F2(r3.bus),
      a3 = i3 === null ? void 0 : R2.get(i3),
      o3 = B2.get(r3.bus.connectionKey),
      s3 = a3 === void 0 ? null : P2(a3),
      c3 = ctx.H_(o3?.vaDeg);
    if (a3 === void 0 || z2.has(i3) || V2.has(r3.bus.connectionKey) || s3 === null || c3 === null) {
      J2.add(e3);
      continue;
    }
    ee2.set(e3, c3 - s3);
  }
  for (let {
    bus: e3,
    index: t3
  } of H2) {
    let n3 = F2(e3),
      r3 = n3 === null ? e3.connectionKey : String(n3),
      i3 = n3 === null ? void 0 : R2.get(n3),
      a3 = B2.get(e3.connectionKey),
      o3 = G2[t3];
    if (n3 === null) {
      M2(`bus`, r3, `normalized bus has no external source number`);
      continue;
    }
    if (L2.has(n3) || z2.has(n3)) {
      M2(`bus`, r3, `external bus identity is ambiguous`);
      continue;
    }
    if (i3 === void 0 || !x2(i3)) {
      M2(`bus`, r3, `active physical bus is missing or inactive in the reference`);
      continue;
    }
    if (V2.has(e3.connectionKey) || !a3) {
      M2(`bus`, r3, `calculation result row is missing or duplicated`);
      continue;
    }
    let s3 = d2.scope === `AC` ? ctx.H_(ctx.Z_(_2, `PU`, i3)) : 1,
      c3 = d2.scope === `AC` ? ctx.H_(a3.vmPu) : 1,
      l3 = P2(i3),
      u3 = ctx.H_(a3.vaDeg),
      f3 = ee2.get(o3),
      p3 = true;
    d2.scope === `AC` && (s3 === null || c3 === null ? (M2(`bus`, r3, `Vm is absent or non-finite`), p3 = false) : k2.voltagePu = ctx.K_(k2.voltagePu, Math.abs(c3 - s3))), l3 === null || u3 === null || f3 === void 0 ? (M2(`bus`, r3, J2.has(o3) ? `island reference angle is unavailable or ambiguous` : `Va is absent or non-finite`), p3 = false) : k2.angleDeg = ctx.K_(k2.angleDeg, Math.abs(ctx.G_(u3, l3 + f3))), p3 && (O2.buses++, O2.compared++);
  }
  if (d2.scope === `AC`) {
    let e3 = /* @__PURE__ */new Set();
    for (let t3 = 0; t3 < E2.NUMBER.length; t3++) if (ctx.U_(ctx.Z_(E2, `STATUS`, t3)) === 1) {
      let n3 = ctx.U_(ctx.Z_(E2, `NUMBER`, t3));
      n3 !== null && e3.add(n3);
    }
    let i3 = /* @__PURE__ */new Map(),
      a3 = /* @__PURE__ */new Set();
    for (let e4 of r2.generatorResults) i3.has(e4.sourceEquipmentId) ? a3.add(e4.sourceEquipmentId) : i3.set(e4.sourceEquipmentId, e4);
    let o3 = ctx.Q_(t2),
      s3 = n2.generators.filter(e4 => e4.status === 1),
      c3 = /* @__PURE__ */new Set();
    for (let e4 of s3) {
      let t3 = n2.buses[e4.bus],
        r3 = F2(t3),
        s4 = o3.get(e4.sourceEquipmentId) ?? [],
        l4 = s4.length === 1 ? s4[0] : void 0,
        u4 = l4 ? ctx.W_(l4.fields.machid ?? l4.fields.id) : ``,
        d4 = `${r3 ?? `?`}/${u4}`;
      if (!l4 || s4.length !== 1 || r3 === null || !u4) {
        M2(`generator`, d4, `source machine identity is missing or ambiguous`);
        continue;
      }
      let f4 = `${r3}/${u4}`;
      c3.add(f4);
      let p4 = [];
      for (let e5 = 0; e5 < E2.NUMBER.length; e5++) ctx.U_(ctx.Z_(E2, `NUMBER`, e5)) === r3 && ctx.W_(ctx.Z_(E2, `ID`, e5)) === u4 && ctx.U_(ctx.Z_(E2, `STATUS`, e5)) === 1 && p4.push(e5);
      let m4 = i3.get(e4.sourceEquipmentId);
      if (p4.length !== 1 || !m4 || a3.has(e4.sourceEquipmentId)) {
        M2(`generator`, d4, p4.length > 1 ? `reference machine identity is duplicated` : !m4 || a3.has(e4.sourceEquipmentId) ? `calculation machine row is missing or duplicated` : `active machine row is missing from the reference`);
        continue;
      }
      let h4 = ctx.H_(ctx.Z_(E2, `PGEN`, p4[0])),
        g3 = ctx.H_(ctx.Z_(E2, `QGEN`, p4[0])),
        _3 = ctx.H_(m4.pMw),
        v3 = ctx.H_(m4.qMvar);
      if (h4 === null || g3 === null || _3 === null || v3 === null) {
        M2(`generator`, d4, `Pg or Qg is absent or not determined`);
        continue;
      }
      N2(_3, h4), N2(v3, g3), O2.generators++, O2.compared++;
    }
    for (let e4 = 0; e4 < E2.NUMBER.length; e4++) if (ctx.U_(ctx.Z_(E2, `STATUS`, e4)) === 1) {
      let t3 = ctx.U_(ctx.Z_(E2, `NUMBER`, e4)),
        n3 = ctx.W_(ctx.Z_(E2, `ID`, e4));
      t3 !== null && !c3.has(`${t3}/${n3}`) && M2(`reference generator`, `${t3}/${n3}`, `active source machine row has no normalized generator`);
    }
    let l3 = /* @__PURE__ */new Map();
    for (let e4 = 0; e4 < S2.FROMNUMBER.length; e4++) {
      if (ctx.U_(ctx.Z_(S2, `STATUS`, e4)) !== 1) continue;
      let t3 = ctx.U_(ctx.Z_(S2, `FROMNUMBER`, e4)),
        n3 = ctx.U_(ctx.Z_(S2, `TONUMBER`, e4)),
        r3 = ctx.W_(ctx.Z_(S2, `ID`, e4));
      if (t3 === null || n3 === null || !r3) {
        M2(`reference branch`, `row ${e4 + 1}`, `endpoint or circuit identity is malformed`);
        continue;
      }
      let i4 = `${t3}|${n3}|${r3}`,
        a4 = l3.get(i4) ?? [];
      a4.push(e4), l3.set(i4, a4);
    }
    let u3 = /* @__PURE__ */new Map();
    for (let e4 = 0; e4 < C2.WNDNUM.length; e4++) {
      if (ctx.U_(ctx.Z_(C2, `STATUS`, e4)) !== 1) continue;
      let t3 = ctx.U_(ctx.Z_(C2, `WIND1NUMBER`, e4)),
        n3 = ctx.U_(ctx.Z_(C2, `WIND2NUMBER`, e4)),
        r3 = ctx.U_(ctx.Z_(C2, `WIND3NUMBER`, e4)),
        i4 = ctx.U_(ctx.Z_(C2, `WNDNUM`, e4)),
        a4 = ctx.W_(ctx.Z_(C2, `ID`, e4));
      if (t3 === null || n3 === null || r3 === null || i4 === null || i4 < 1 || i4 > 3 || !a4) {
        M2(`reference winding`, `row ${e4 + 1}`, `bus, winding, or circuit identity is malformed`);
        continue;
      }
      let o4 = `${t3}|${n3}|${r3}|${a4}|${i4}`,
        s4 = u3.get(o4) ?? [];
      s4.push(e4), u3.set(o4, s4);
    }
    let d3 = /* @__PURE__ */new Map();
    for (let e4 of r2.branchResults) {
      let t3 = d3.get(e4.id) ?? [];
      t3.push(e4), d3.set(e4.id, t3);
    }
    let f3 = ctx.Q_(t2),
      p3 = /* @__PURE__ */new Set(),
      m3 = /* @__PURE__ */new Set(),
      h3 = n2.branches.filter(e4 => e4.status === 1 && n2.buses[e4.from]?.status === 1 && n2.buses[e4.to]?.status === 1);
    for (let e4 of h3) {
      let t3 = f3.get(e4.sourceEquipmentId) ?? [],
        r3 = t3.length === 1 ? t3[0] : void 0,
        i4 = d3.get(e4.id) ?? [],
        a4 = i4.length === 1 ? i4[0] : void 0;
      if (!r3 || t3.length !== 1 || !a4 || a4.sourceEquipmentId !== e4.sourceEquipmentId || a4.terminalFrom !== e4.terminalFrom || a4.terminalTo !== e4.terminalTo) {
        M2(e4.kind === `three-winding-leg` ? `winding` : `branch`, e4.id, `source/result terminal identity is missing, duplicated, or stale`);
        continue;
      }
      if (e4.kind === `three-winding-leg`) {
        let t4 = ctx.U_(Number(e4.windingId)),
          i5 = [r3.fields.ibus, r3.fields.jbus, r3.fields.kbus].map(ctx.U_),
          o5 = F2(n2.buses[e4.from]);
        if (t4 === null || t4 < 1 || t4 > 3 || i5.some(e5 => e5 === null) || o5 === null || i5[t4 - 1] !== o5) {
          M2(`winding`, e4.id, `normalized source winding does not map to its exact external terminal`);
          continue;
        }
        let s5 = `${i5[0]}|${i5[1]}|${i5[2]}|${ctx.W_(r3.fields.ckt ?? `1`)}|${t4}`;
        m3.add(s5);
        let c5 = u3.get(s5) ?? [];
        if (c5.length !== 1) {
          M2(`winding`, e4.id, c5.length ? `reference winding identity is duplicated` : `reference winding row is missing`);
          continue;
        }
        let l4 = c5[0],
          d4 = ctx.H_(ctx.Z_(C2, `P`, l4)),
          f4 = ctx.H_(ctx.Z_(C2, `Q`, l4)),
          p4 = ctx.H_(a4.pFromMw),
          h5 = ctx.H_(a4.qFromMvar);
        if (d4 === null || f4 === null || p4 === null || h5 === null) {
          M2(`winding`, e4.id, `external winding P/Q is absent or non-finite`);
          continue;
        }
        N2(p4, d4), N2(h5, f4), O2.windings++, O2.compared++;
        continue;
      }
      let o4 = F2(n2.buses[e4.from]),
        s4 = F2(n2.buses[e4.to]);
      if (o4 === null || s4 === null) {
        M2(`branch`, e4.id, `normalized branch endpoint has no external bus number`);
        continue;
      }
      let c4 = ctx.W_(r3.fields.ckt ?? `1`),
        h4 = `${o4}|${s4}|${c4}`,
        g3 = `${s4}|${o4}|${c4}`;
      p3.add(h4), p3.add(g3);
      let _3 = l3.get(h4) ?? [],
        v3 = l3.get(g3) ?? [];
      if (_3.length !== 1 || v3.length !== 1) {
        M2(`branch`, e4.id, _3.length > 1 || v3.length > 1 ? `directed circuit identity is duplicated` : `both directed reference terminal rows are required`);
        continue;
      }
      let y3 = ctx.H_(ctx.Z_(S2, `P`, _3[0])),
        b3 = ctx.H_(ctx.Z_(S2, `Q`, _3[0])),
        x3 = ctx.H_(ctx.Z_(S2, `P`, v3[0])),
        w3 = ctx.H_(ctx.Z_(S2, `Q`, v3[0])),
        T3 = ctx.H_(a4.pFromMw),
        E3 = ctx.H_(a4.qFromMvar),
        D3 = ctx.H_(a4.pToMw),
        k3 = ctx.H_(a4.qToMvar);
      if (y3 === null || b3 === null || x3 === null || w3 === null || T3 === null || E3 === null || D3 === null || k3 === null) {
        M2(`branch`, e4.id, `both-end P/Q values are required and must be finite`);
        continue;
      }
      N2(T3, y3), N2(E3, b3), N2(D3, x3), N2(k3, w3), O2.branches += 2, O2.compared += 2;
    }
    for (let [e4, t3] of l3) p3.has(e4) ? t3.length > 1 && M2(`reference branch`, e4, `parallel circuit key is duplicated; circuit ID is required to disambiguate`) : M2(`reference branch`, e4, `active reference row has no normalized physical branch`);
    for (let [e4, t3] of u3) m3.has(e4) ? t3.length > 1 && M2(`reference winding`, e4, `source winding identity is duplicated`) : M2(`reference winding`, e4, `active reference row has no normalized external winding`);
  } else {
    let e3 = ctx.V_(i2.dcReport),
      a3 = e3?.flows;
    if (!e3 || !Array.isArray(a3) || !Array.isArray(e3.unparsedRows) || e3.unparsedRows.length !== 0 || ctx.H_(e3.flowResolutionMw) === null || ctx.H_(e3.flowResolutionMw) <= 0) return p2(`INCOMPLETE_COMPARISON`, `DC reference requires a parsed dcReport with finite flow resolution and no unparsed rows.`);
    let o3 = [],
      s3 = /* @__PURE__ */new Map();
    for (let e4 = 0; e4 < a3.length; e4++) {
      let t3 = ctx.V_(a3[e4]),
        n3 = ctx.U_(t3?.from),
        r3 = t3?.to === null ? null : ctx.U_(t3?.to),
        i3 = typeof t3?.circuit == `string` ? t3.circuit.trim() : null,
        c4 = ctx.H_(t3?.pMw),
        l4 = t3?.winding === void 0 ? null : ctx.U_(t3.winding);
      if (n3 === null || i3 === null || !i3 || c4 === null || t3?.to !== null && r3 === null || l4 !== null && (l4 < 1 || l4 > 3)) {
        M2(`DC flow`, `row ${e4 + 1}`, `flow record is incomplete or non-finite`);
        continue;
      }
      if (l4 === null && r3 === null || l4 !== null && r3 !== null) {
        M2(`DC flow`, `row ${e4 + 1}`, `ordinary line and winding flow identities must be explicit`);
        continue;
      }
      let u4 = {
        from: n3,
        to: r3,
        circuit: i3,
        p: c4,
        winding: l4
      };
      o3.push(u4);
      let d4 = l4 === null ? `${n3}|${r3}|${i3}` : `${n3}|${i3}|${l4}`,
        f3 = s3.get(d4) ?? [];
      f3.push(u4), s3.set(d4, f3);
    }
    let c3 = /* @__PURE__ */new Map();
    for (let e4 of r2.branchResults) {
      let t3 = c3.get(e4.id) ?? [];
      t3.push(e4), c3.set(e4.id, t3);
    }
    let l3 = ctx.Q_(t2),
      u3 = /* @__PURE__ */new Set(),
      d3 = n2.branches.filter(e4 => e4.status === 1 && n2.buses[e4.from]?.status === 1 && n2.buses[e4.to]?.status === 1);
    for (let e4 of d3) {
      let t3 = l3.get(e4.sourceEquipmentId) ?? [],
        r3 = t3.length === 1 ? t3[0] : void 0,
        i3 = c3.get(e4.id) ?? [],
        a4 = i3.length === 1 ? i3[0] : void 0;
      if (!r3 || t3.length !== 1 || !a4 || a4.sourceEquipmentId !== e4.sourceEquipmentId || a4.terminalFrom !== e4.terminalFrom || a4.terminalTo !== e4.terminalTo) {
        M2(e4.kind === `three-winding-leg` ? `winding` : `DC flow`, e4.id, `source/result terminal identity is missing, duplicated, or stale`);
        continue;
      }
      let o4 = ctx.W_(r3.fields.ckt ?? `1`),
        d4 = F2(n2.buses[e4.from]);
      if (d4 === null) {
        M2(e4.kind === `three-winding-leg` ? `winding` : `DC flow`, e4.id, `normalized source terminal has no external bus number`);
        continue;
      }
      if (e4.kind === `three-winding-leg`) {
        let t4 = ctx.U_(Number(e4.windingId)),
          n3 = [r3.fields.ibus, r3.fields.jbus, r3.fields.kbus].map(ctx.U_);
        if (t4 === null || t4 < 1 || t4 > 3 || n3.some(e5 => e5 === null) || n3[t4 - 1] !== d4) {
          M2(`winding`, e4.id, `normalized winding does not map to its exact external terminal`);
          continue;
        }
        let i4 = `${d4}|${o4}|${t4}`,
          c4 = s3.get(i4) ?? [];
        if (u3.add(i4), c4.length !== 1) {
          M2(`winding`, e4.id, c4.length ? `DC winding flow is ambiguous` : `DC winding flow is missing`);
          continue;
        }
        let l4 = ctx.H_(a4.pFromMw);
        if (l4 === null) {
          M2(`winding`, e4.id, `calculated external winding P is unavailable`);
          continue;
        }
        N2(l4, c4[0].p), O2.windings++, O2.compared++;
        continue;
      }
      let f3 = F2(n2.buses[e4.to]);
      if (f3 === null) {
        M2(`branch`, e4.id, `normalized destination has no external bus number`);
        continue;
      }
      let p3 = `${d4}|${f3}|${o4}`,
        m3 = `${f3}|${d4}|${o4}`,
        h3 = s3.get(p3) ?? [],
        g3 = s3.get(m3) ?? [];
      if (u3.add(p3), u3.add(m3), h3.length !== 1 || g3.length !== 1) {
        M2(`DC flow`, e4.id, h3.length > 1 || g3.length > 1 ? `directed circuit flow is ambiguous` : `both directed DC flow rows are required`);
        continue;
      }
      let _3 = ctx.H_(a4.pFromMw),
        v3 = ctx.H_(a4.pToMw);
      if (_3 === null || v3 === null) {
        M2(`DC flow`, e4.id, `both calculated terminal P flows are required`);
        continue;
      }
      N2(_3, h3[0].p), N2(v3, g3[0].p), O2.branches += 2, O2.compared += 2;
    }
    for (let [e4, t3] of s3) u3.has(e4) ? t3.length > 1 && M2(`DC flow`, e4, `directed circuit flow identity is duplicated`) : M2(`DC flow`, e4, `active reference flow has no normalized physical branch or winding`);
  }
  let te2 = H2.length > 0;
  (!te2 || O2.compared === 0) && A2.push(`No required reference quantities were successfully compared.`), A2.push(`Scope: ${d2.scope === `AC` ? `active physical bus Vm/Va, active machine Pg/Qg, both-end ordinary branch P/Q, and external 3W winding P/Q` : `active physical bus Va and P-only directed ordinary branch/3W winding DC flows`}; inactive rows, internal 3W stars, and unsupported DC Vm/Q/machine values are excluded.`), A2.push(`Compared ${O2.compared} complete records: ${O2.buses} buses, ${O2.branches} directed ordinary branch terminals, ${O2.windings} external 3W windings, ${O2.generators} machines; ${O2.missing} required rows or values are missing or ambiguous.`), A2.push(`Maximum absolute error: voltage ${k2.voltagePu ?? `n/a`} pu; angle ${k2.angleDeg ?? `n/a`} degrees; P/Q or DC P ${k2.powerMvar ?? `n/a`} MW/Mvar.`), A2.push(`Acceptance gates: |\u0394Vm| \u2264 ${ctx.R_.voltagePu} pu, |\u0394Va| \u2264 ${ctx.R_.angleDeg}\xB0, |\u0394P/Q| \u2264 ${ctx.R_.powerMvar} MW/Mvar; DC P uses the same ${ctx.R_.powerMvar} MW contract gate.`), j2.length && A2.push(`Missing details: ${j2.join(`; `)}${O2.missing > j2.length ? `; plus ${O2.missing - j2.length} more` : ``}.`), A2.push(`GA physics coverage: ${r2.physicsCoverage}. Reference optionsHash is treated as reference provenance and is not compared with the GA optionsHash.`);
  let ne2 = O2.missing === 0 && O2.compared > 0 && te2,
    re2 = (k2.voltagePu === null || k2.voltagePu <= ctx.R_.voltagePu) && (k2.angleDeg === null || k2.angleDeg <= ctx.R_.angleDeg) && (k2.powerMvar === null || k2.powerMvar <= ctx.R_.powerMvar);
  return {
    status: ne2 ? re2 ? `MATCHED` : `DIFFERENT` : `INCOMPLETE_COMPARISON`,
    sourceSha256: l2,
    method: f2,
    counts: O2,
    maximumAbsoluteError: k2,
    details: A2
  };
};
ctx.tv = function tv(e2) {
  return e2 === null || !Number.isFinite(e2) || e2 <= 0 ? `unknown` : e2 <= 36 ? `<=36` : String(e2);
};
}
export const initializers = [
[464, ctx => { ctx.Ps = {
  substation: `TM`,
  bus: `Bara`,
  line: `Hat`,
  transformer: `Trafo`,
  generator: `Jenerat\xF6r`,
  load: `Y\xFCk`,
  shunt: `\u015E\xF6nt`,
  switch: `Anahtar`,
  node: `D\xFC\u011F\xFCm`,
  terminal: `Terminal`,
  dc: `DC`,
  facts: `FACTS`,
  other: `Di\u011Fer`
}; }],
[465, ctx => { ctx.Fs = /* @__PURE__ */new Set(); }],
[466, ctx => { ctx.Is = () => [...ctx.Fs]; }],
[467, ctx => { ctx.Ls = e2 => {
  ctx.Fs.clear();
  for (let t2 of e2) ctx.Fs.add(t2);
}; }],
[468, ctx => { ctx.Rs = e2 => {
  ctx.Fs.has(e2) ? ctx.Fs.delete(e2) : ctx.Fs.add(e2);
}; }],
[471, ctx => { ctx.Vs = /* @__PURE__ */new WeakMap(); }],
[483, ctx => { ctx.$s = e2 => `\uFEFFsep=;\r
` + e2.map(e3 => e3.map(ctx.Qs).join(`;`)).join(`\r
`); }],
[488, ctx => { ctx.ic = e2 => e2 == null ? `\u2014` : typeof e2 == `object` ? JSON.stringify(e2) : typeof e2 == `number` ? e2 !== 0 && Math.abs(e2) < 1e-5 ? e2.toExponential(5) : e2.toLocaleString(`tr-TR`, {
  maximumFractionDigits: 5,
  useGrouping: false
}) : String(e2); }],
[489, ctx => { ctx.ac = e2 => e2.toLocaleString(`tr-TR`); }],
[490, ctx => { ctx.oc = e2 => e2 >= 1048576 ? `${ctx.Z(e2 / 1048576, 1)} MB` : e2 >= 1024 ? `${ctx.Z(e2 / 1024, 1)} KB` : `${ctx.Z(e2, 0)} bayt`; }],
[491, ctx => { ctx.sc = e2 => e2 === null ? `Kaynakta belirtilmemi\u015F` : e2 === 1 ? `Serviste` : e2 === 0 ? `Devre d\u0131\u015F\u0131` : `Kaynak durum ${e2}`; }],
[492, ctx => { ctx.cc = [`substation`, `bus`, `line`, `transformer`, `generator`, `load`, `shunt`, `switch`]; }],
[493, ctx => { ctx.lc = [{
  kind: `AREA`,
  heading: `YTM / AREA`,
  busField: `area`,
  codeField: `iarea`,
  nameField: `arname`
}, {
  kind: `ZONE`,
  heading: `Gerilim B\xF6lgesi / ZONE`,
  busField: `zone`,
  codeField: `izone`,
  nameField: `zoname`
}, {
  kind: `OWNER`,
  heading: `B\xF6lge M\xFCd\xFCrl\xFC\u011F\xFC / OWNER`,
  busField: `owner`,
  codeField: `iowner`,
  nameField: `owname`
}]; }],
[1005, ctx => { ctx.L_ = /^[0-9a-f]{64}$/i; }],
[1006, ctx => { ctx.R_ = {
  voltagePu: 1e-4,
  angleDeg: 0.05,
  powerMvar: 0.5
}; }],
[1007, ctx => { ctx.z_ = () => ({
  buses: 0,
  branches: 0,
  windings: 0,
  generators: 0,
  compared: 0,
  missing: 0
}); }],
[1008, ctx => { ctx.B_ = () => ({
  voltagePu: null,
  angleDeg: null,
  powerMvar: null
}); }],
[1009, ctx => { ctx.V_ = e2 => typeof e2 == `object` && e2 && !Array.isArray(e2) ? e2 : null; }],
[1010, ctx => { ctx.H_ = e2 => typeof e2 == `number` && Number.isFinite(e2) ? e2 : null; }],
[1011, ctx => { ctx.U_ = e2 => {
  let t2 = ctx.H_(e2);
  return t2 !== null && Number.isInteger(t2) ? t2 : null;
}; }],
[1012, ctx => { ctx.W_ = e2 => String(e2 ?? ``).trim(); }],
[1013, ctx => { ctx.G_ = (e2, t2) => ((e2 - t2 + 180) % 360 + 360) % 360 - 180; }],
[1014, ctx => { ctx.K_ = (e2, t2) => e2 === null ? t2 : Math.max(e2, t2); }],
[1015, ctx => { ctx.q_ = (e2, t2) => ctx.V_(e2[t2]); }]
];
