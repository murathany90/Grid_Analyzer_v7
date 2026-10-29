import { createWorkbook } from "../../../shared/export/xlsx.js";
import turkeyBasemap from "../../../shared/assets/turkey-basemap.json";
// Migrated V12 engine. Private per-instance bindings; no DGS controller.
export function define(ctx) {
  ctx.g = function g(e2, t2, n2, r2) {
    let i2 = ctx.m(n2),
      a2 = ctx.h(n2);
    e2.setUint32(t2, r2 ? a2 : i2, r2), e2.setUint32(t2 + 4, r2 ? i2 : a2, r2);
  };
  ctx._ = function _(e2) {
    return e2 instanceof Uint8Array || ArrayBuffer.isView(e2) && e2.constructor.name === `Uint8Array` && `BYTES_PER_ELEMENT` in e2 && e2.BYTES_PER_ELEMENT === 1;
  };
  ctx.y = function y(e2, t2 = ``) {
    if (typeof e2 != `number`) throw TypeError(ctx.v(t2) + `expected number, got ` + typeof e2);
    if (!Number.isSafeInteger(e2) || e2 < 0) throw RangeError(ctx.v(t2) + `expected integer >= 0, got ` + e2);
    return e2;
  };
  ctx.b = function b(e2, t2, n2 = ``) {
    if (ctx._(e2) && (t2 === void 0 || e2.length === t2)) return e2;
    t2 !== void 0 && ctx.y(t2, `length`);
    let r2 = ctx._(e2),
      i2 = t2 === void 0 ? `` : ` of length ${t2}`,
      a2 = r2 ? `length=${e2.length}` : `type=${typeof e2}`,
      o2 = ctx.v(n2) + `expected Uint8Array` + i2 + `, got ` + a2;
    throw r2 ? RangeError(o2) : TypeError(o2);
  };
  ctx.C = function C(e2, t2 = true) {
    if (e2.destroyed) throw Error(`hash was destroyed`);
    if (t2 && e2.finished) throw Error(`digest() was already called`);
  };
  ctx.w = function w(e2, t2) {
    ctx.b(e2, void 0, `output`);
    let n2 = t2.outputLen;
    if (!(e2.length >= n2)) throw RangeError(`"output" expected length >= ` + n2);
  };
  ctx.T = function T(...e2) {
    for (let t2 = 0; t2 < e2.length; t2++) e2[t2].fill(0);
  };
  ctx.E = function E(e2) {
    return new DataView(e2.buffer, e2.byteOffset, e2.byteLength);
  };
  ctx.D = function D(e2, t2) {
    return e2 << 32 - t2 | e2 >>> t2;
  };
  ctx.O = function O(e2, t2, n2 = `opts`) {
    return ctx.S(e2, `defaults`), t2 !== void 0 && ctx.S(t2, n2), Object.assign(/* @__PURE__ */Object.create(null), e2, t2);
  };
  ctx.k = function k(e2, t2 = {}) {
    if (typeof e2 != `function`) throw TypeError(`"hashCons" expected function, got type=` + typeof e2);
    t2 = ctx.O({}, t2, `info`);
    let n2 = (t3, n3) => e2(n3).update(t3).digest(),
      r2 = e2(void 0);
    return n2.outputLen = r2.outputLen, n2.blockLen = r2.blockLen, n2.canXOF = r2.canXOF, n2.create = t3 => e2(t3), Object.assign(n2, t2), Object.freeze(n2);
  };
  ctx.j = function j(e2, t2, n2) {
    return e2 & t2 ^ ~e2 & n2;
  };
  ctx.M = function M(e2, t2, n2) {
    return e2 & t2 ^ e2 & n2 ^ t2 & n2;
  };
  ctx.Q = function Q(e2, t2 = ``, n2) {
    let r2 = ctx.document.createElement(e2);
    return r2.className = t2, n2 !== void 0 && (r2.textContent = n2), r2;
  };
  ctx.$ = function $(e2, t2, n2 = e2) {
    let r2 = ctx.Q(`button`, `ga-button`, e2);
    return r2.type = `button`, r2.title = n2, r2.setAttribute(`aria-label`, n2), r2.onclick = t2, r2;
  };
  ctx.Os = function Os(e2, t2, n2 = `text/plain;charset=utf-8`) {
    let r2 = URL.createObjectURL(new Blob([e2], {
        type: n2
      })),
      i2 = ctx.Q(`a`);
    i2.href = r2, i2.download = t2, i2.click(), ctx.window.setTimeout(() => URL.revokeObjectURL(r2), 1e3);
  };
  ctx.ks = function ks(e2) {
    if (typeof e2 == `number`) return `"` + (Number.isFinite(e2) ? String(e2).replace(`.`, `,`) : ``) + `"`;
    let t2 = String(e2 ?? ``);
    return /^[\s\u0000-\u001f\u007f]*[=+@-]/.test(t2) && (t2 = `'` + t2), `"` + t2.replace(/"/g, `""`) + `"`;
  };
  ctx.ol = function ol(e2, t2) {
    return ctx.rl(e2, t2 || {}, 0, 0);
  };
  ctx.dl = function dl(e2, t2) {
    if (t2) {
      for (var n2 = new ctx.pc(e2.length), r2 = 0; r2 < e2.length; ++r2) n2[r2] = e2.charCodeAt(r2);
      return n2;
    }
    if (ctx.ll) return ctx.ll.encode(e2);
    for (var i2 = e2.length, a2 = new ctx.pc(e2.length + (e2.length >> 1)), o2 = 0, s2 = function (e3) {
        a2[o2++] = e3;
      }, r2 = 0; r2 < i2; ++r2) {
      if (o2 + 5 > a2.length) {
        var c2 = new ctx.pc(o2 + 8 + (i2 - r2 << 1));
        c2.set(a2), a2 = c2;
      }
      var l2 = e2.charCodeAt(r2);
      l2 < 128 || t2 ? s2(l2) : l2 < 2048 ? (s2(192 | l2 >> 6), s2(128 | l2 & 63)) : l2 > 55295 && l2 < 57344 ? (l2 = 65536 + (l2 & 1047552) | e2.charCodeAt(++r2) & 1023, s2(240 | l2 >> 18), s2(128 | l2 >> 12 & 63), s2(128 | l2 >> 6 & 63), s2(128 | l2 & 63)) : (s2(224 | l2 >> 12), s2(128 | l2 >> 6 & 63), s2(128 | l2 & 63));
    }
    return ctx.Bc(a2, 0, o2);
  };
  ctx.hl = function hl(e2, t2) {
    t2 ||= {};
    var n2 = {},
      r2 = [];
    ctx.cl(e2, ``, n2, t2);
    var i2 = 0,
      a2 = 0;
    for (var o2 in n2) {
      var s2 = n2[o2],
        c2 = s2[0],
        l2 = s2[1],
        u2 = l2.level == 0 ? 0 : 8,
        d2 = ctx.dl(o2),
        f2 = d2.length,
        p2 = l2.comment,
        m2 = p2 && ctx.dl(p2),
        h2 = m2 && m2.length,
        g2 = ctx.fl(l2.extra);
      f2 > 65535 && ctx.Hc(11);
      var _2 = u2 ? ctx.ol(c2, l2) : c2,
        v2 = _2.length,
        y2 = ctx.nl();
      y2.p(c2), r2.push(ctx.il(l2, {
        size: c2.length,
        crc: y2.d(),
        c: _2,
        f: d2,
        m: m2,
        u: f2 != o2.length || m2 && p2.length != h2,
        o: i2,
        compression: u2
      })), i2 += 30 + f2 + g2 + v2, a2 += 76 + 2 * (f2 + g2) + (h2 || 0) + v2;
    }
    for (var b2 = new ctx.pc(a2 + 22), x2 = i2, S2 = a2 - i2, C2 = 0; C2 < r2.length; ++C2) {
      var d2 = r2[C2];
      ctx.pl(b2, d2.o, d2, d2.f, d2.u, d2.c.length);
      var w2 = 30 + d2.f.length + ctx.fl(d2.extra);
      b2.set(d2.c, d2.o + w2), ctx.pl(b2, i2, d2, d2.f, d2.u, d2.c.length, d2.o, d2.m), i2 += 16 + w2 + (d2.m ? d2.m.length : 0);
    }
    return ctx.ml(b2, i2, r2.length, S2, x2), b2;
  };
  ctx.fu = function fu(e2, t2) {
    if (e2 == null || !Number.isFinite(e2)) return `#708596`;
    if (Math.abs(e2) < 1e-9) return t2.deltaNeutral;
    let n2 = e2 > 0 ? t2.deltaUp : t2.deltaDown,
      r2 = Math.min(1, Math.abs(e2) / ctx.lu(t2));
    return `#` + [1, 3, 5].map(e3 => parseInt(n2.slice(e3, e3 + 2), 16)).map(e3 => Math.round(r2 < 0.5 ? e3 + (255 - e3) * (0.58 * (1 - r2 * 2)) : e3 * (1 - 0.42 * (r2 - 0.5) * 2))).map(e3 => e3.toString(16).padStart(2, `0`)).join(``);
  };
  ctx.zd = function zd(e2) {
    let t2 = e2 + 1,
      n2 = ``;
    for (; t2;) t2--, n2 = String.fromCharCode(65 + t2 % 26) + n2, t2 = Math.floor(t2 / 26);
    return n2;
  };
  ctx.Bd = function Bd(e2) {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${e2.map((e3, t2) => `<row r="${t2 + 1}">${e3.map((e4, n2) => {
      let r2 = `${ctx.zd(n2)}${t2 + 1}`;
      return e4 == null || typeof e4 == `number` && !Number.isFinite(e4) ? `<c r="${r2}"/>` : typeof e4 == `number` ? `<c r="${r2}"><v>${e4}</v></c>` : `<c r="${r2}" t="inlineStr"><is><t xml:space="preserve">${ctx.Rd(e4.slice(0, 32767))}</t></is></c>`;
    }).join(``)}</row>`).join(``)}</sheetData></worksheet>`;
  };
  ctx.Hd = sheets => createWorkbook(sheets);
  ctx.qd = function qd(e2, t2 = `GridAnalyzer_PowerFactory_Comparison.xlsx`) {
    let n2 = ctx.Hd(e2),
      r2 = URL.createObjectURL(new Blob([new Uint8Array(n2)], {
        type: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
      })),
      i2 = ctx.document.createElement(`a`);
    i2.href = r2, i2.download = t2, i2.click(), ctx.window.setTimeout(() => URL.revokeObjectURL(r2), 1e3);
  };
  ctx.ah = function ah(e2, t2, n2, r2, i2, a2 = true, o2 = i2) {
    let s2 = `http://www.w3.org/2000/svg`,
      c2 = ctx.document.createElementNS(s2, `g`);
    c2.setAttribute(`data-symbol`, t2), c2.setAttribute(`transform`, `translate(${n2} ${r2})`), e2.append(c2);
    let l2 = (e3, t3) => {
        let n3 = ctx.document.createElementNS(s2, e3);
        for (let [e4, r3] of Object.entries(t3)) n3.setAttribute(e4, String(r3));
        return c2.append(n3), n3;
      },
      u2 = e3 => l2(`path`, {
        d: e3,
        fill: `none`,
        stroke: i2,
        "stroke-width": 2
      }),
      d2 = (e3, t3, n3 = 11, r3 = i2) => l2(`circle`, {
        cx: e3,
        cy: t3,
        r: n3,
        fill: `var(--sld-paper, #102033)`,
        stroke: r3,
        "stroke-width": 2
      });
    if (t2 === `breaker`) l2(`rect`, {
      x: -7,
      y: -8,
      width: 14,
      height: 16,
      fill: a2 ? i2 : `var(--sld-paper, #102033)`,
      stroke: i2,
      "stroke-width": 2
    });else if (t2 === `disconnector` || t2 === `earth-switch`) u2(`M0 11 L${a2 ? 0 : 9} -11`), t2 === `earth-switch` && u2(`M0 11 V18 M-9 18 H9 M-6 22 H6 M-3 26 H3`);else if (t2 === `transformer2w` || t2 === `autotransformer` || t2 === `transformer3w`) d2(0, -7), d2(0, 7, 11, o2), t2 === `autotransformer` && u2(`M-16 17 L16 -17 M10 -17 H16 V-11`), t2 === `transformer3w` && d2(15, 0);else if (t2 === `current-transformer`) d2(0, 0, 8), u2(`M0 -16 V16`);else if (t2 === `voltage-transformer`) d2(0, -6, 8), d2(0, 6, 8);else if (t2 === `arrester`) l2(`rect`, {
      x: -6,
      y: -12,
      width: 12,
      height: 24,
      fill: `none`,
      stroke: i2
    }), u2(`M6 -12 L-6 12`);else if (t2 === `capacitor` || t2 === `series-capacitor`) u2(`M0 -18 V-4 M-10 -4 H10 M-10 4 H10 M0 4 V18`);else if (t2 === `capacitor-bank`) u2(`M0 -18 V-10 M-10 -10 H10 M-10 -4 H10 M0 -4 V4 M-10 4 H10 M-10 10 H10 M0 10 V18`), u2(`M-8 18 H8 M-5 22 H5 M-2 26 H2`).dataset.symbolEarth = `shunt-reference`;else if (t2 === `reactor` || t2 === `shunt-reactor` || t2 === `series-reactor`) u2(`M0 -18 V-12 C-12 -12 -12 -4 0 -4 C-12 -4 -12 4 0 4 C-12 4 -12 12 0 12 V18`).dataset.reactorCoil = `true`, t2 === `shunt-reactor` && (u2(`M-8 18 H8 M-5 22 H5 M-2 26 H2`).dataset.symbolEarth = `shunt-reference`), t2 === `series-reactor` && (d2(0, -18, 1.6), d2(0, 18, 1.6));else if (t2 === `reactive-equivalent`) {
      u2(`M0 -18 V-10 M0 10 V18`), l2(`rect`, {
        x: -7,
        y: -10,
        width: 14,
        height: 20,
        fill: `var(--sld-paper, #102033)`,
        stroke: i2,
        "stroke-width": 2
      });
      let e3 = l2(`text`, {
        x: 0,
        y: 4,
        fill: i2,
        "font-size": 10,
        "text-anchor": `middle`
      });
      e3.textContent = `X`, c2.dataset.symbolPartial = `UNRESOLVED_REACTIVE_TYPE`;
    } else t2 === `load` ? u2(`M0 -14 V-7 M-11 -7 H11 L0 12 Z`) : t2 === `exit` ? u2(`M0 -16 V4 M-7 -3 L0 4 L7 -3`) : (d2(0, 0, 13), u2(`M-8 0 C-4 -10 0 -10 0 0 C0 10 4 10 8 0`));
    return c2;
  };
  ctx.yg = function yg(e2, t2, n2, r2, i2, a2, o2, s2) {
    if (!ctx.pg(e2)) return s2;
    let c2 = e2 < n2 ? i2 : a2,
      l2 = e2 < n2 ? a2 : o2,
      u2 = Math.max(0, Math.min(1, e2 < n2 ? (e2 - t2) / (n2 - t2) : (e2 - n2) / (r2 - n2))),
      d2 = e3 => [1, 3, 5].map(t3 => parseInt(e3.slice(t3, t3 + 2), 16)),
      f2 = d2(c2),
      p2 = d2(l2);
    return `#` + f2.map((e3, t3) => Math.round(e3 + (p2[t3] - e3) * u2).toString(16).padStart(2, `0`)).join(``);
  };
  ctx.bg = function bg(e2, t2) {
    return ctx.yg(e2, t2.voltageMin, t2.voltageNeutral, t2.voltageMax, t2.voltageLowColor, t2.voltageNeutralColor, t2.voltageHighColor, t2.colorNoResult);
  };
  ctx.Sg = function Sg(e2) {
    return e2.palette === `green` ? [`#d8f3df`, `#c5ecd1`, `#abe4bc`, `#68ca8e`, `#47b87d`, `#329f68`, `#176943`] : [e2.loadingColor0, e2.loadingColor1, e2.loadingColor2, e2.loadingColor3, e2.loadingColor4, e2.loadingColor5, e2.loadingColor6];
  };
  ctx.Cg = function Cg(e2, t2) {
    let n2 = ctx.Sg(t2);
    return e2 == null || !Number.isFinite(e2) ? t2.colorNoResult : n2[e2 > 100 ? 6 : Math.min(6, t2.thresholds.filter(t3 => e2 > t3).length)];
  };
  ctx.kg = function kg(e2, t2) {
    return [e2 - 35.5, -(t2 - 39) / Math.cos(39 * Math.PI / 180)];
  };
  ctx.Ag = function Ag(e2) {
    let t2 = new Path2D();
    for (let n2 of e2) n2.forEach(([e3, n3], r2) => {
      let [i2, a2] = ctx.kg(e3, n3);
      r2 ? t2.lineTo(i2, a2) : t2.moveTo(i2, a2);
    }), t2.closePath();
    return t2;
  };
  ctx._y = function _y(e2, t2, n2) {
    let r2 = e2.value;
    e2.replaceChildren(new Option(n2, ``), ...t2.map(e3 => new Option(e3.label, e3.value))), t2.some(e3 => e3.value === r2) && (e2.value = r2);
  };
  ctx.vy = function vy(e2, t2) {
    switch (ctx.Ms(e2)) {
      case `b400`:
        return t2.settings.value.color400;
      case `b220`:
        return t2.settings.value.color220;
      case `b154`:
        return t2.settings.value.color154;
      case `b66`:
        return t2.settings.value.color66;
      case `blow`:
        return t2.settings.value.colorLow;
      default:
        return `#758698`;
    }
  };
  ctx.yy = function yy(e2) {
    let t2 = /* @__PURE__ */new Map();
    for (let n2 of e2.branches) n2.kind === `three-winding-leg` && (t2.get(n2.sourceEquipmentId) ?? (t2.set(n2.sourceEquipmentId, []), t2.get(n2.sourceEquipmentId))).push(n2);
    return [...t2.entries()].map(([t3, n2]) => (n2.sort((e3, t4) => Number(e3.windingId) - Number(t4.windingId)), {
      sourceEquipmentId: t3,
      legs: n2,
      terminals: [...new Set(n2.flatMap(e3 => [e3.from, e3.to]).filter(t4 => e2.buses[t4]?.source))],
      status: +!!n2.every(e3 => e3.status === 1)
    }));
  };
  ctx.by = function by(e2, t2, n2) {
    let r2 = new Set(t2),
      i2 = ctx.yy(e2).filter(e3 => e3.terminals.some(e4 => r2.has(e4)) && ctx.wv(e3.status, n2)),
      a2 = e2.branches.filter(e3 => ctx.wv(e3.status, n2) && (r2.has(e3.from) || r2.has(e3.to) || i2.some(t3 => t3.sourceEquipmentId === e3.sourceEquipmentId)));
    return {
      indices: t2,
      depths: new Map(t2.map(e3 => [e3, 0])),
      branches: a2,
      three: i2,
      omittedBuses: 0,
      omittedBranches: 0
    };
  };
  ctx.xy = function xy(e2, t2) {
    let n2 = /* @__PURE__ */new Map();
    for (let r3 of e2) {
      let e3 = t2.buses[r3].baseKv,
        i3 = e3 !== null && e3 <= 36 ? `36` : String(e3 ?? 0);
      n2.set(i3, [...(n2.get(i3) ?? []), r3]);
    }
    let r2 = /* @__PURE__ */new Map(),
      i2 = 145;
    for (let [, e3] of [...n2].sort((e4, t3) => Number(t3[0]) - Number(e4[0]))) e3.sort((e4, n3) => (t2.buses[e4].externalNumber ?? e4) - (t2.buses[n3].externalNumber ?? n3)), e3.forEach((t3, n3) => r2.set(t3, {
      x: e3.length === 1 ? ctx.my / 2 : n3 % 2 ? ctx.my * 0.73 : ctx.my * 0.27,
      y: i2 + Math.floor(n3 / 2) * 220
    })), i2 += Math.ceil(e3.length / 2) * 220;
    return r2;
  };
  ctx.Sy = function Sy(e2, t2, n2, r2) {
    return e2.buses[t2]?.source ? t2 : n2.find(e3 => e3.terminals.includes(t2))?.terminals.find(e3 => r2.has(e3)) ?? -1;
  };
  ctx.Cy = function Cy(e2) {
    let t2 = new Map(e2.base.buses.map(e3 => [e3.connectionKey, e3])),
      n2 = new Map(e2.base.branches.map(e3 => [e3.id, e3])),
      r2 = new Map(e2.base.generators.map(e3 => [e3.id, e3]));
    return {
      buses: new Map(e2.calculation?.busResults.filter(e3 => {
        let n3 = t2.get(e3.connectionKey);
        return n3 && e3.id === n3.id && e3.sourceEquipmentId === n3.sourceEquipmentId;
      }).map(e3 => [e3.connectionKey, e3]) ?? []),
      branches: new Map(e2.calculation?.branchResults.filter(e3 => {
        let t3 = n2.get(e3.id);
        return t3 && e3.sourceEquipmentId === t3.sourceEquipmentId && e3.terminalFrom === t3.terminalFrom && e3.terminalTo === t3.terminalTo;
      }).map(e3 => [e3.id, e3]) ?? []),
      generators: new Map(e2.calculation?.generatorResults.filter(e3 => r2.get(e3.id)?.sourceEquipmentId === e3.sourceEquipmentId).map(e3 => [e3.sourceEquipmentId, e3]) ?? [])
    };
  };
}
export const initializers = [[14, ctx => {
  ctx.m = e2 => e2 / 2 ** 32 | 0;
}], [15, ctx => {
  ctx.h = e2 => e2 >>> 0;
}], [18, ctx => {
  ctx.v = e2 => e2 ? `"${e2}" ` : ``;
}], [21, ctx => {
  ctx.x = (e2, t2) => {
    if (typeof e2 != `object` || !e2 || Array.isArray(e2)) throw TypeError((t2 === `object` ? `` : `"${t2}" `) + `expected object, got type=` + typeof e2);
  };
}], [22, ctx => {
  ctx.S = (e2, t2) => {
    ctx.x(e2, t2);
    let n2 = Object.getPrototypeOf(e2);
    if (n2 !== Object.prototype && n2 !== null) throw TypeError(`"${t2}" expected plain object`);
    if (Object.hasOwn(e2, `__proto__`)) throw TypeError(`"${t2}.__proto__" is not allowed`);
  };
}], [30, ctx => {
  ctx.A = e2 => ({
    oid: Uint8Array.from([6, 9, 96, 134, 72, 1, 101, 3, 4, 2, e2])
  });
}], [33, ctx => {
  ctx.N = class {
    blockLen;
    outputLen;
    canXOF = false;
    padOffset;
    isLE;
    buffer;
    view;
    finished = false;
    length = 0;
    pos = 0;
    destroyed = false;
    constructor(e2, t2, n2, r2) {
      this.blockLen = e2, this.outputLen = t2, this.padOffset = n2, this.isLE = r2, this.buffer = new Uint8Array(e2), this.view = ctx.E(this.buffer);
    }
    update(e2) {
      ctx.C(this), ctx.b(e2);
      let {
          view: t2,
          buffer: n2,
          blockLen: r2
        } = this,
        i2 = e2.length,
        a2 = false;
      for (let o2 = 0; o2 < i2;) {
        let s2 = Math.min(r2 - this.pos, i2 - o2);
        if (s2 === r2) {
          let t3 = ctx.E(e2);
          for (; r2 <= i2 - o2; o2 += r2) this.process(t3, o2);
          a2 = true;
          continue;
        }
        n2.set(o2 === 0 && s2 === i2 ? e2 : e2.subarray(o2, o2 + s2), this.pos), this.pos += s2, o2 += s2, this.pos === r2 && (this.process(t2, 0), this.pos = 0, a2 = true);
      }
      return this.length += e2.length, a2 && this.roundClean(), this;
    }
    digestInto(e2) {
      ctx.C(this), ctx.w(e2, this), this.finished = true;
      let {
          buffer: t2,
          view: n2,
          blockLen: r2,
          isLE: i2
        } = this,
        {
          pos: a2
        } = this;
      t2[a2++] = 128, t2.fill(0, a2), this.padOffset > r2 - a2 && (this.process(n2, 0), t2.fill(0)), ctx.g(n2, r2 - 8, this.length * 8, i2), this.process(n2, 0), this.roundClean();
      let o2 = e2 === t2 ? n2 : ctx.E(e2),
        s2 = this.outputLen,
        c2 = s2 / 4,
        l2 = this.get();
      if (s2 % 4 || c2 > l2.length) throw Error(`invalid outputLen`);
      for (let e3 = 0; e3 < c2; e3++) o2.setUint32(4 * e3, l2[e3], i2);
    }
    digest() {
      let {
        buffer: e2,
        outputLen: t2
      } = this;
      this.digestInto(e2);
      let n2 = e2.slice(0, t2);
      return this.destroy(), n2;
    }
    _cloneIntoMeta(e2) {
      let {
        buffer: t2,
        length: n2,
        finished: r2,
        destroyed: i2,
        pos: a2
      } = this;
      return e2.destroyed = i2, e2.finished = r2, e2.length = n2, e2.pos = a2, a2 && e2.buffer.set(t2), e2;
    }
    clone() {
      return this._cloneInto();
    }
  };
}], [34, ctx => {
  ctx.P = Uint32Array.from([1779033703, 3144134277, 1013904242, 2773480762, 1359893119, 2600822924, 528734635, 1541459225]);
}], [35, ctx => {
  ctx.F = Uint32Array.from([1116352408, 1899447441, 3049323471, 3921009573, 961987163, 1508970993, 2453635748, 2870763221, 3624381080, 310598401, 607225278, 1426881987, 1925078388, 2162078206, 2614888103, 3248222580, 3835390401, 4022224774, 264347078, 604807628, 770255983, 1249150122, 1555081692, 1996064986, 2554220882, 2821834349, 2952996808, 3210313671, 3336571891, 3584528711, 113926993, 338241895, 666307205, 773529912, 1294757372, 1396182291, 1695183700, 1986661051, 2177026350, 2456956037, 2730485921, 2820302411, 3259730800, 3345764771, 3516065817, 3600352804, 4094571909, 275423344, 430227734, 506948616, 659060556, 883997877, 958139571, 1322822218, 1537002063, 1747873779, 1955562222, 2024104815, 2227730452, 2361852424, 2428436474, 2756734187, 3204031479, 3329325298]);
}], [36, ctx => {
  ctx.I = new Uint32Array(64);
}], [37, ctx => {
  ctx.L = class extends ctx.N {
    A = 0;
    B = 0;
    C = 0;
    D = 0;
    E = 0;
    F = 0;
    G = 0;
    H = 0;
    constructor(e2, t2) {
      super(64, e2, 8, false), this.A = t2[0] | 0, this.B = t2[1] | 0, this.C = t2[2] | 0, this.D = t2[3] | 0, this.E = t2[4] | 0, this.F = t2[5] | 0, this.G = t2[6] | 0, this.H = t2[7] | 0;
    }
    get() {
      let {
        A: e2,
        B: t2,
        C: n2,
        D: r2,
        E: i2,
        F: a2,
        G: o2,
        H: s2
      } = this;
      return [e2, t2, n2, r2, i2, a2, o2, s2];
    }
    set(e2, t2, n2, r2, i2, a2, o2, s2) {
      this.A = e2 | 0, this.B = t2 | 0, this.C = n2 | 0, this.D = r2 | 0, this.E = i2 | 0, this.F = a2 | 0, this.G = o2 | 0, this.H = s2 | 0;
    }
    _cloneInto(e2) {
      return (e2 ||= new this.constructor()).set(...this.get()), this._cloneIntoMeta(e2);
    }
    process(e2, t2) {
      for (let n3 = 0; n3 < 16; n3++, t2 += 4) ctx.I[n3] = e2.getUint32(t2, false);
      for (let e3 = 16; e3 < 64; e3++) {
        let t3 = ctx.I[e3 - 15],
          n3 = ctx.I[e3 - 2],
          r3 = ctx.D(t3, 7) ^ ctx.D(t3, 18) ^ t3 >>> 3,
          i3 = ctx.D(n3, 17) ^ ctx.D(n3, 19) ^ n3 >>> 10;
        ctx.I[e3] = i3 + ctx.I[e3 - 7] + r3 + ctx.I[e3 - 16] | 0;
      }
      let {
        A: n2,
        B: r2,
        C: i2,
        D: a2,
        E: o2,
        F: s2,
        G: c2,
        H: l2
      } = this;
      for (let e3 = 0; e3 < 64; e3++) {
        let t3 = ctx.D(o2, 6) ^ ctx.D(o2, 11) ^ ctx.D(o2, 25),
          u2 = l2 + t3 + ctx.j(o2, s2, c2) + ctx.F[e3] + ctx.I[e3] | 0,
          d2 = (ctx.D(n2, 2) ^ ctx.D(n2, 13) ^ ctx.D(n2, 22)) + ctx.M(n2, r2, i2) | 0;
        l2 = c2, c2 = s2, s2 = o2, o2 = a2 + u2 | 0, a2 = i2, i2 = r2, r2 = n2, n2 = u2 + d2 | 0;
      }
      n2 = n2 + this.A | 0, r2 = r2 + this.B | 0, i2 = i2 + this.C | 0, a2 = a2 + this.D | 0, o2 = o2 + this.E | 0, s2 = s2 + this.F | 0, c2 = c2 + this.G | 0, l2 = l2 + this.H | 0, this.set(n2, r2, i2, a2, o2, s2, c2, l2);
    }
    roundClean() {
      ctx.T(ctx.I);
    }
    destroy() {
      this.destroyed = true, this.set(0, 0, 0, 0, 0, 0, 0, 0), ctx.T(this.buffer);
    }
  };
}], [38, ctx => {
  ctx.R = class extends ctx.L {
    constructor() {
      super(32, ctx.P);
    }
  };
}], [39, ctx => {
  ctx.z = ctx.k(() => new ctx.R(), ctx.A(1));
}], [374, ctx => {
  ctx.to = () => ({
    lfBranchDisplay: `pq-loading`,
    lfBusDisplay: `voltage-angle`,
    deltaMetric: `p`,
    voltageMin: 0.9,
    voltageNeutral: 1,
    voltageMax: 1.1,
    voltageLowColor: `#508bc2`,
    voltageNeutralColor: `#bccbd3`,
    voltageHighColor: `#e4a66a`,
    angleMin: -20,
    angleNeutral: 0,
    angleMax: 20,
    angleNegativeColor: `#4f91cc`,
    angleNeutralColor: `#becbd1`,
    anglePositiveColor: `#d8965d`,
    magnitudePercentile: 95,
    magnitudePMax: 0,
    magnitudeQMax: 0,
    magnitudeIntensity: 1,
    basemapStyle: `dark`,
    showProvinceBorders: true,
    basemapOpacity: 0.7,
    precision: 1,
    pageSize: 20,
    siteSize: 2.5,
    routeDetail: true,
    riskWarningPercent: 80,
    color400: `#e6534e`,
    color220: `#8d80d8`,
    color154: `#449bda`,
    color66: `#51b6bc`,
    colorLow: `#8fb0a0`,
    colorMid: `#449bda`,
    colorOut: `#708596`,
    colorScenarioOff: `#e18b55`,
    colorScenarioOn: `#53d2a4`,
    colorNoResult: `#708596`,
    loadingColor0: `#c5dbe3`,
    loadingColor1: `#b6dedf`,
    loadingColor2: `#a9d4d3`,
    loadingColor3: `#e5c66b`,
    loadingColor4: `#e9a96a`,
    loadingColor5: `#e58b58`,
    loadingColor6: `#c94345`,
    thresholds: [25, 50, 65, 80, 90, 100],
    palette: `voltage`,
    width400: 3,
    widthMid: 2,
    widthOther: 1.4,
    qBase400Mvar: 200,
    qBase154Mvar: 100,
    qThresholds: [25, 50, 65, 80, 90, 100],
    deltaUp: `#e75e6c`,
    deltaDown: `#43baca`,
    deltaNeutral: `#b4bec4`,
    deltaLoad: 30,
    deltaP: 300,
    deltaQ: 100,
    deltaV: 0.05,
    layoutMode: `standard`,
    flowDefault: true,
    clearOnBlank: true,
    legend: true,
    displayMode: `nominal`,
    flowSpeed: `normal`,
    flowDensity: 4,
    theme: `dark`
  });
}], [375, ctx => {
  ctx.no = class {
    value = ctx.to();
    constructor() {
      try {
        this.update(JSON.parse(ctx.window.localStorage.getItem(`grid-analyzer-v7-settings`) || `{}`), false);
      } catch {}
    }
    update(e2, t2 = true) {
      let n2 = {
        ...this.value
      };
      for (let t3 of Object.keys(n2)) {
        let r3 = e2[t3];
        typeof r3 == typeof n2[t3] && r3 !== void 0 && Object.assign(n2, {
          [t3]: r3
        });
      }
      if (Array.isArray(e2.thresholds) && e2.thresholds.length === 4 && e2.thresholds.every(Number.isFinite)) {
        let t3 = [...e2.thresholds].sort((e3, t4) => e3 - t4);
        n2.thresholds = [Math.min(25, t3[0] / 2), t3[0], t3[1], t3[2], (t3[2] + t3[3]) / 2, t3[3]];
        let r3 = [n2.loadingColor0, n2.loadingColor1, n2.loadingColor2, n2.loadingColor3, n2.loadingColor4];
        [n2.loadingColor0, n2.loadingColor1, n2.loadingColor2, n2.loadingColor3, n2.loadingColor4, n2.loadingColor5, n2.loadingColor6] = [r3[0], r3[0], r3[1], r3[2], r3[3], r3[3], r3[4]];
      }
      for (let e3 of `color400.color220.color154.color66.colorLow.colorMid.colorOut.colorScenarioOff.colorScenarioOn.colorNoResult.loadingColor0.loadingColor1.loadingColor2.loadingColor3.loadingColor4.loadingColor5.loadingColor6.voltageLowColor.voltageNeutralColor.voltageHighColor.angleNegativeColor.angleNeutralColor.anglePositiveColor.deltaUp.deltaDown.deltaNeutral`.split(`.`)) /^#[0-9a-f]{6}$/i.test(n2[e3]) || (n2[e3] = this.value[e3]);
      n2.thresholds = Array.isArray(n2.thresholds) && n2.thresholds.length === 6 && n2.thresholds.every(Number.isFinite) ? n2.thresholds.map(e3 => Math.max(0, Math.min(300, e3))).sort((e3, t3) => e3 - t3) : [...this.value.thresholds], n2.qThresholds = Array.isArray(n2.qThresholds) && n2.qThresholds.length === 6 && n2.qThresholds.every(Number.isFinite) ? n2.qThresholds.map(e3 => Math.max(0, Math.min(300, e3))).sort((e3, t3) => e3 - t3) : [...this.value.qThresholds];
      for (let e3 of [`qBase400Mvar`, `qBase154Mvar`]) (!Number.isFinite(n2[e3]) || n2[e3] <= 0) && (n2[e3] = this.value[e3]);
      for (let e3 of [`width400`, `widthMid`, `widthOther`, `deltaLoad`, `deltaP`, `deltaQ`, `deltaV`, `flowDensity`]) (!Number.isFinite(n2[e3]) || n2[e3] <= 0) && (n2[e3] = this.value[e3]);
      let r2 = {
        lfBranchDisplay: [`p-loading`, `pq`, `pq-loading`],
        lfBusDisplay: [`voltage`, `angle`, `voltage-angle`],
        palette: [`voltage`, `green`],
        layoutMode: [`standard`, `separated`],
        displayMode: [`nominal`, `loading`, `p`, `q`, `v`, `angle`, `delta`, `island`, `n1-island`, `n1-risk`],
        deltaMetric: [`p`, `q`, `v`, `loading`],
        basemapStyle: [`dark`, `plain`, `provinces`, `none`],
        flowSpeed: [`slow`, `normal`, `fast`],
        theme: [`dark`, `light`]
      };
      for (let e3 of Object.keys(r2)) r2[e3].includes(n2[e3]) || Object.assign(n2, {
        [e3]: this.value[e3]
      });
      n2.precision = Math.round(Math.max(0, Math.min(8, n2.precision || 0))), n2.pageSize = Math.round(Math.max(10, Math.min(100, n2.pageSize || 20))), n2.siteSize = Math.max(1, Math.min(10, n2.siteSize || 2.5)), (!Number.isFinite(n2.riskWarningPercent) || n2.riskWarningPercent < 0 || n2.riskWarningPercent >= 100) && (n2.riskWarningPercent = this.value.riskWarningPercent), (!Number.isFinite(n2.voltageMin) || n2.voltageMin <= 0 || n2.voltageMin >= 2) && (n2.voltageMin = this.value.voltageMin), (!Number.isFinite(n2.voltageNeutral) || n2.voltageNeutral <= 0 || n2.voltageNeutral >= 2) && (n2.voltageNeutral = this.value.voltageNeutral), (!Number.isFinite(n2.voltageMax) || n2.voltageMax <= 0 || n2.voltageMax > 2) && (n2.voltageMax = this.value.voltageMax), n2.voltageMin < n2.voltageNeutral && n2.voltageNeutral < n2.voltageMax || (n2.voltageMin = this.value.voltageMin, n2.voltageNeutral = this.value.voltageNeutral, n2.voltageMax = this.value.voltageMax), (!Number.isFinite(n2.angleMin) || !Number.isFinite(n2.angleNeutral) || !Number.isFinite(n2.angleMax) || !(n2.angleMin < n2.angleNeutral && n2.angleNeutral < n2.angleMax) || n2.angleMin < -180 || n2.angleMax > 180) && (n2.angleMin = this.value.angleMin, n2.angleNeutral = this.value.angleNeutral, n2.angleMax = this.value.angleMax), (!Number.isFinite(n2.magnitudePercentile) || n2.magnitudePercentile < 50 || n2.magnitudePercentile > 99.9) && (n2.magnitudePercentile = this.value.magnitudePercentile);
      for (let e3 of [`magnitudePMax`, `magnitudeQMax`]) (!Number.isFinite(n2[e3]) || n2[e3] < 0) && (n2[e3] = this.value[e3]);
      if ((!Number.isFinite(n2.magnitudeIntensity) || n2.magnitudeIntensity < 0.1 || n2.magnitudeIntensity > 2) && (n2.magnitudeIntensity = this.value.magnitudeIntensity), n2.basemapOpacity = Number.isFinite(n2.basemapOpacity) ? Math.max(0, Math.min(1, n2.basemapOpacity)) : this.value.basemapOpacity, this.value = n2, t2) try {
        ctx.window.localStorage.setItem(`grid-analyzer-v7-settings`, JSON.stringify(n2));
      } catch {}
    }
    reset() {
      this.update(ctx.to());
    }
  };
}], [451, ctx => {
  ctx.Ts = [`substation`, `bus`, `line`, `transformer`, `generator`, `load`, `shunt`, `switch`, `node`, `terminal`, `dc`, `facts`, `other`];
}], [453, ctx => {
  ctx.Es = 2;
}], [455, ctx => {
  ctx.Z = (e2, t2 = ctx.Es) => e2 != null && Number.isFinite(Number(e2)) ? Number(e2).toLocaleString(`tr-TR`, {
    maximumFractionDigits: t2
  }) : `\u2014`;
}], [460, ctx => {
  ctx.As = e2 => `\uFEFFsep=;\r
` + e2.map(e3 => e3.map(ctx.ks).join(`;`)).join(`\r
`);
}], [461, ctx => {
  ctx.js = [{
    id: `b400`,
    label: `400 kV`
  }, {
    id: `b220`,
    label: `220 kV`
  }, {
    id: `b154`,
    label: `154 kV`
  }, {
    id: `b66`,
    label: `66 kV`
  }, {
    id: `blow`,
    label: `\u226436 kV`
  }];
}], [497, ctx => {
  ctx.pc = Uint8Array;
}], [498, ctx => {
  ctx.mc = Uint16Array;
}], [499, ctx => {
  ctx.hc = Int32Array;
}], [500, ctx => {
  ctx.gc = new ctx.pc([0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0, 0, 0, 0]);
}], [501, ctx => {
  ctx._c = new ctx.pc([0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13, 0, 0]);
}], [502, ctx => {
  ctx.vc = new ctx.pc([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
}], [503, ctx => {
  ctx.yc = function (e2, t2) {
    for (var n2 = new ctx.mc(31), r2 = 0; r2 < 31; ++r2) n2[r2] = t2 += 1 << e2[r2 - 1];
    for (var i2 = new ctx.hc(n2[30]), r2 = 1; r2 < 30; ++r2) for (var a2 = n2[r2]; a2 < n2[r2 + 1]; ++a2) i2[a2] = a2 - n2[r2] << 5 | r2;
    return {
      b: n2,
      r: i2
    };
  };
}], [504, ctx => {
  ctx.bc = ctx.yc(ctx.gc, 2);
}], [505, ctx => {
  ctx.xc = ctx.bc.b;
}], [506, ctx => {
  ctx.Sc = ctx.bc.r;
}], [507, ctx => {
  ctx.xc[28] = 258, ctx.Sc[258] = 28;
}], [508, ctx => {
  for (ctx.Cc = ctx.yc(ctx._c, 0), ctx.wc = ctx.Cc.b, ctx.Tc = ctx.Cc.r, ctx.Ec = new ctx.mc(32768), ctx.Dc = 0; ctx.Dc < 32768; ++ctx.Dc) {
    var Oc = (ctx.Dc & 43690) >> 1 | (ctx.Dc & 21845) << 1;
    ctx.Oc = (ctx.Oc & 52428) >> 2 | (ctx.Oc & 13107) << 2, ctx.Oc = (ctx.Oc & 61680) >> 4 | (ctx.Oc & 3855) << 4, ctx.Ec[ctx.Dc] = ((ctx.Oc & 65280) >> 8 | (ctx.Oc & 255) << 8) >> 1;
  }
}], [509, ctx => {
  for (ctx.kc = function (e2, t2, n2) {
    for (var r2 = e2.length, i2 = 0, a2 = new ctx.mc(t2); i2 < r2; ++i2) e2[i2] && ++a2[e2[i2] - 1];
    var o2 = new ctx.mc(t2);
    for (i2 = 1; i2 < t2; ++i2) o2[i2] = o2[i2 - 1] + a2[i2 - 1] << 1;
    var s2;
    if (n2) {
      s2 = new ctx.mc(1 << t2);
      var c2 = 15 - t2;
      for (i2 = 0; i2 < r2; ++i2) if (e2[i2]) for (var l2 = i2 << 4 | e2[i2], u2 = t2 - e2[i2], d2 = o2[e2[i2] - 1]++ << u2, f2 = d2 | (1 << u2) - 1; d2 <= f2; ++d2) s2[ctx.Ec[d2] >> c2] = l2;
    } else for (s2 = new ctx.mc(r2), i2 = 0; i2 < r2; ++i2) e2[i2] && (s2[i2] = ctx.Ec[o2[e2[i2] - 1]++] >> 15 - e2[i2]);
    return s2;
  }, ctx.Ac = new ctx.pc(288), ctx.Dc = 0; ctx.Dc < 144; ++ctx.Dc) ctx.Ac[ctx.Dc] = 8;
}], [510, ctx => {
  for (ctx.Dc = 144; ctx.Dc < 256; ++ctx.Dc) ctx.Ac[ctx.Dc] = 9;
}], [511, ctx => {
  for (ctx.Dc = 256; ctx.Dc < 280; ++ctx.Dc) ctx.Ac[ctx.Dc] = 7;
}], [512, ctx => {
  for (ctx.Dc = 280; ctx.Dc < 288; ++ctx.Dc) ctx.Ac[ctx.Dc] = 8;
}], [513, ctx => {
  for (ctx.jc = new ctx.pc(32), ctx.Dc = 0; ctx.Dc < 32; ++ctx.Dc) ctx.jc[ctx.Dc] = 5;
}], [514, ctx => {
  ctx.Mc = ctx.kc(ctx.Ac, 9, 0);
}], [516, ctx => {
  ctx.Pc = ctx.kc(ctx.jc, 5, 0);
}], [521, ctx => {
  ctx.zc = function (e2) {
    return (e2 + 7) / 8 | 0;
  };
}], [522, ctx => {
  ctx.Bc = function (e2, t2, n2) {
    return (t2 == null || t2 < 0) && (t2 = 0), (n2 == null || n2 > e2.length) && (n2 = e2.length), new ctx.pc(e2.subarray(t2, n2));
  };
}], [523, ctx => {
  ctx.Vc = [`unexpected EOF`, `invalid block type`, `invalid length/literal`, `invalid distance`, `stream finished`, `no stream handler`,, `no callback`, `invalid UTF-8 data`, `extra field too long`, `date not in range 1980-2099`, `filename too long`, `stream finishing`, `invalid zip data`];
}], [524, ctx => {
  ctx.Hc = function (e2, t2, n2) {
    var r2 = Error(t2 || ctx.Vc[e2]);
    if (r2.code = e2, Error.captureStackTrace && Error.captureStackTrace(r2, ctx.Hc), !n2) throw r2;
    return r2;
  };
}], [526, ctx => {
  ctx.Wc = function (e2, t2, n2) {
    n2 <<= t2 & 7;
    var r2 = t2 / 8 | 0;
    e2[r2] |= n2, e2[r2 + 1] |= n2 >> 8;
  };
}], [527, ctx => {
  ctx.Gc = function (e2, t2, n2) {
    n2 <<= t2 & 7;
    var r2 = t2 / 8 | 0;
    e2[r2] |= n2, e2[r2 + 1] |= n2 >> 8, e2[r2 + 2] |= n2 >> 16;
  };
}], [528, ctx => {
  ctx.Kc = function (e2, t2) {
    for (var n2 = [], r2 = 0; r2 < e2.length; ++r2) e2[r2] && n2.push({
      s: r2,
      f: e2[r2]
    });
    var i2 = n2.length,
      a2 = n2.slice();
    if (!i2) return {
      t: ctx.$c,
      l: 0
    };
    if (i2 == 1) {
      var o2 = new ctx.pc(n2[0].s + 1);
      return o2[n2[0].s] = 1, {
        t: o2,
        l: 1
      };
    }
    n2.sort(function (e3, t3) {
      return e3.f - t3.f;
    }), n2.push({
      s: -1,
      f: 25001
    });
    var s2 = n2[0],
      c2 = n2[1],
      l2 = 0,
      u2 = 1,
      d2 = 2;
    for (n2[0] = {
      s: -1,
      f: s2.f + c2.f,
      l: s2,
      r: c2
    }; u2 != i2 - 1;) s2 = n2[n2[l2].f < n2[d2].f ? l2++ : d2++], c2 = n2[l2 != u2 && n2[l2].f < n2[d2].f ? l2++ : d2++], n2[u2++] = {
      s: -1,
      f: s2.f + c2.f,
      l: s2,
      r: c2
    };
    for (var f2 = a2[0].s, r2 = 1; r2 < i2; ++r2) a2[r2].s > f2 && (f2 = a2[r2].s);
    var p2 = new ctx.mc(f2 + 1),
      m2 = ctx.qc(n2[u2 - 1], p2, 0);
    if (m2 > t2) {
      var r2 = 0,
        h2 = 0,
        g2 = m2 - t2,
        _2 = 1 << g2;
      for (a2.sort(function (e3, t3) {
        return p2[t3.s] - p2[e3.s] || e3.f - t3.f;
      }); r2 < i2; ++r2) {
        var v2 = a2[r2].s;
        if (p2[v2] > t2) h2 += _2 - (1 << m2 - p2[v2]), p2[v2] = t2;else break;
      }
      for (h2 >>= g2; h2 > 0;) {
        var y2 = a2[r2].s;
        p2[y2] < t2 ? h2 -= 1 << t2 - p2[y2]++ - 1 : ++r2;
      }
      for (; r2 >= 0 && h2; --r2) {
        var b2 = a2[r2].s;
        p2[b2] == t2 && (--p2[b2], ++h2);
      }
      m2 = t2;
    }
    return {
      t: new ctx.pc(p2),
      l: m2
    };
  };
}], [529, ctx => {
  ctx.qc = function (e2, t2, n2) {
    return e2.s == -1 ? Math.max(ctx.qc(e2.l, t2, n2 + 1), ctx.qc(e2.r, t2, n2 + 1)) : t2[e2.s] = n2;
  };
}], [530, ctx => {
  ctx.Jc = function (e2) {
    for (var t2 = e2.length; t2 && !e2[--t2];);
    for (var n2 = new ctx.mc(++t2), r2 = 0, i2 = e2[0], a2 = 1, o2 = function (e3) {
        n2[r2++] = e3;
      }, s2 = 1; s2 <= t2; ++s2) if (e2[s2] == i2 && s2 != t2) ++a2;else {
      if (!i2 && a2 > 2) {
        for (; a2 > 138; a2 -= 138) o2(32754);
        a2 > 2 && (o2(a2 > 10 ? a2 - 11 << 5 | 28690 : a2 - 3 << 5 | 12305), a2 = 0);
      } else if (a2 > 3) {
        for (o2(i2), --a2; a2 > 6; a2 -= 6) o2(8304);
        a2 > 2 && (o2(a2 - 3 << 5 | 8208), a2 = 0);
      }
      for (; a2--;) o2(i2);
      a2 = 1, i2 = e2[s2];
    }
    return {
      c: n2.subarray(0, r2),
      n: t2
    };
  };
}], [531, ctx => {
  ctx.Yc = function (e2, t2) {
    for (var n2 = 0, r2 = 0; r2 < t2.length; ++r2) n2 += e2[r2] * t2[r2];
    return n2;
  };
}], [532, ctx => {
  ctx.Xc = function (e2, t2, n2) {
    var r2 = n2.length,
      i2 = ctx.zc(t2 + 2);
    e2[i2] = r2 & 255, e2[i2 + 1] = r2 >> 8, e2[i2 + 2] = e2[i2] ^ 255, e2[i2 + 3] = e2[i2 + 1] ^ 255;
    for (var a2 = 0; a2 < r2; ++a2) e2[i2 + a2 + 4] = n2[a2];
    return (i2 + 4 + r2) * 8;
  };
}], [533, ctx => {
  ctx.Zc = function (e2, t2, n2, r2, i2, a2, o2, s2, c2, l2, u2) {
    ctx.Wc(t2, u2++, n2), ++i2[256];
    for (var d2 = ctx.Kc(i2, 15), f2 = d2.t, p2 = d2.l, m2 = ctx.Kc(a2, 15), h2 = m2.t, g2 = m2.l, _2 = ctx.Jc(f2), v2 = _2.c, y2 = _2.n, b2 = ctx.Jc(h2), x2 = b2.c, S2 = b2.n, C2 = new ctx.mc(19), w2 = 0; w2 < v2.length; ++w2) ++C2[v2[w2] & 31];
    for (var w2 = 0; w2 < x2.length; ++w2) ++C2[x2[w2] & 31];
    for (var T2 = ctx.Kc(C2, 7), E2 = T2.t, D2 = T2.l, O2 = 19; O2 > 4 && !E2[ctx.vc[O2 - 1]]; --O2);
    var k2 = l2 + 5 << 3,
      A2 = ctx.Yc(i2, ctx.Ac) + ctx.Yc(a2, ctx.jc) + o2,
      j2 = ctx.Yc(i2, f2) + ctx.Yc(a2, h2) + o2 + 14 + 3 * O2 + ctx.Yc(C2, E2) + 2 * C2[16] + 3 * C2[17] + 7 * C2[18];
    if (c2 >= 0 && k2 <= A2 && k2 <= j2) return ctx.Xc(t2, u2, e2.subarray(c2, c2 + l2));
    var M2, N2, P2, F2;
    if (ctx.Wc(t2, u2, 1 + (j2 < A2)), u2 += 2, j2 < A2) {
      M2 = ctx.kc(f2, p2, 0), N2 = f2, P2 = ctx.kc(h2, g2, 0), F2 = h2;
      var I2 = ctx.kc(E2, D2, 0);
      ctx.Wc(t2, u2, y2 - 257), ctx.Wc(t2, u2 + 5, S2 - 1), ctx.Wc(t2, u2 + 10, O2 - 4), u2 += 14;
      for (var w2 = 0; w2 < O2; ++w2) ctx.Wc(t2, u2 + 3 * w2, E2[ctx.vc[w2]]);
      u2 += 3 * O2;
      for (var L2 = [v2, x2], R2 = 0; R2 < 2; ++R2) for (var z2 = L2[R2], w2 = 0; w2 < z2.length; ++w2) {
        var B2 = z2[w2] & 31;
        ctx.Wc(t2, u2, I2[B2]), u2 += E2[B2], B2 > 15 && (ctx.Wc(t2, u2, z2[w2] >> 5 & 127), u2 += z2[w2] >> 12);
      }
    } else M2 = ctx.Mc, N2 = ctx.Ac, P2 = ctx.Pc, F2 = ctx.jc;
    for (var w2 = 0; w2 < s2; ++w2) {
      var V2 = r2[w2];
      if (V2 > 255) {
        var B2 = V2 >> 18 & 31;
        ctx.Gc(t2, u2, M2[B2 + 257]), u2 += N2[B2 + 257], B2 > 7 && (ctx.Wc(t2, u2, V2 >> 23 & 31), u2 += ctx.gc[B2]);
        var H2 = V2 & 31;
        ctx.Gc(t2, u2, P2[H2]), u2 += F2[H2], H2 > 3 && (ctx.Gc(t2, u2, V2 >> 5 & 8191), u2 += ctx._c[H2]);
      } else ctx.Gc(t2, u2, M2[V2]), u2 += N2[V2];
    }
    return ctx.Gc(t2, u2, M2[256]), u2 + N2[256];
  };
}], [534, ctx => {
  ctx.Qc = new ctx.hc([65540, 131080, 131088, 131104, 262176, 1048704, 1048832, 2114560, 2117632]);
}], [535, ctx => {
  ctx.$c = new ctx.pc(0);
}], [536, ctx => {
  ctx.el = function (e2, t2, n2, r2, i2, a2) {
    var o2 = a2.z || e2.length,
      s2 = new ctx.pc(r2 + o2 + 5 * (1 + Math.ceil(o2 / 7e3)) + i2),
      c2 = s2.subarray(r2, s2.length - i2),
      l2 = a2.l,
      u2 = (a2.r || 0) & 7;
    if (t2) {
      u2 && (c2[0] = a2.r >> 3);
      for (var d2 = ctx.Qc[t2 - 1], f2 = d2 >> 13, p2 = d2 & 8191, m2 = (1 << n2) - 1, h2 = a2.p || new ctx.mc(32768), g2 = a2.h || new ctx.mc(m2 + 1), _2 = Math.ceil(n2 / 3), v2 = 2 * _2, y2 = function (t3) {
          return (e2[t3] ^ e2[t3 + 1] << _2 ^ e2[t3 + 2] << v2) & m2;
        }, b2 = new ctx.hc(25e3), x2 = new ctx.mc(288), S2 = new ctx.mc(32), C2 = 0, w2 = 0, T2 = a2.i || 0, E2 = 0, D2 = a2.w || 0, O2 = 0; T2 + 2 < o2; ++T2) {
        var k2 = y2(T2),
          A2 = T2 & 32767,
          j2 = g2[k2];
        if (h2[A2] = j2, g2[k2] = A2, D2 <= T2) {
          var M2 = o2 - T2;
          if ((C2 > 7e3 || E2 > 24576) && (M2 > 423 || !l2)) {
            u2 = ctx.Zc(e2, c2, 0, b2, x2, S2, w2, E2, O2, T2 - O2, u2), E2 = C2 = w2 = 0, O2 = T2;
            for (var N2 = 0; N2 < 286; ++N2) x2[N2] = 0;
            for (var N2 = 0; N2 < 30; ++N2) S2[N2] = 0;
          }
          var P2 = 2,
            F2 = 0,
            I2 = p2,
            L2 = A2 - j2 & 32767;
          if (M2 > 2 && k2 == y2(T2 - L2)) for (var R2 = Math.min(f2, M2) - 1, z2 = Math.min(32767, T2), B2 = Math.min(258, M2); L2 <= z2 && --I2 && A2 != j2;) {
            if (e2[T2 + P2] == e2[T2 + P2 - L2]) {
              for (var V2 = 0; V2 < B2 && e2[T2 + V2] == e2[T2 + V2 - L2]; ++V2);
              if (V2 > P2) {
                if (P2 = V2, F2 = L2, V2 > R2) break;
                for (var H2 = Math.min(L2, V2 - 2), U2 = 0, N2 = 0; N2 < H2; ++N2) {
                  var W2 = T2 - L2 + N2 & 32767,
                    G2 = W2 - h2[W2] & 32767;
                  G2 > U2 && (U2 = G2, j2 = W2);
                }
              }
            }
            A2 = j2, j2 = h2[A2], L2 += A2 - j2 & 32767;
          }
          if (F2) {
            b2[E2++] = 268435456 | ctx.Sc[P2] << 18 | ctx.Tc[F2];
            var K2 = ctx.Sc[P2] & 31,
              q2 = ctx.Tc[F2] & 31;
            w2 += ctx.gc[K2] + ctx._c[q2], ++x2[257 + K2], ++S2[q2], D2 = T2 + P2, ++C2;
          } else b2[E2++] = e2[T2], ++x2[e2[T2]];
        }
      }
      for (T2 = Math.max(T2, D2); T2 < o2; ++T2) b2[E2++] = e2[T2], ++x2[e2[T2]];
      u2 = ctx.Zc(e2, c2, l2, b2, x2, S2, w2, E2, O2, T2 - O2, u2), l2 || (a2.r = u2 & 7 | c2[u2 / 8 | 0] << 3, u2 -= 7, a2.h = g2, a2.p = h2, a2.i = T2, a2.w = D2);
    } else {
      for (var T2 = a2.w || 0; T2 < o2 + l2; T2 += 65535) {
        var ee2 = T2 + 65535;
        ee2 >= o2 && (c2[u2 / 8 | 0] = l2, ee2 = o2), u2 = ctx.Xc(c2, u2 + 1, e2.subarray(T2, ee2));
      }
      a2.i = o2;
    }
    return ctx.Bc(s2, 0, r2 + ctx.zc(u2) + i2);
  };
}], [537, ctx => {
  ctx.tl = function () {
    for (var e2 = new Int32Array(256), t2 = 0; t2 < 256; ++t2) {
      for (var n2 = t2, r2 = 9; --r2;) n2 = (n2 & 1 && -306674912) ^ n2 >>> 1;
      e2[t2] = n2;
    }
    return e2;
  }();
}], [538, ctx => {
  ctx.nl = function () {
    var e2 = -1;
    return {
      p: function (t2) {
        for (var n2 = e2, r2 = 0; r2 < t2.length; ++r2) n2 = ctx.tl[n2 & 255 ^ t2[r2]] ^ n2 >>> 8;
        e2 = n2;
      },
      d: function () {
        return ~e2;
      }
    };
  };
}], [539, ctx => {
  ctx.rl = function (e2, t2, n2, r2, i2) {
    if (!i2 && (i2 = {
      l: 1
    }, t2.dictionary)) {
      var a2 = t2.dictionary.subarray(-32768),
        o2 = new ctx.pc(a2.length + e2.length);
      o2.set(a2), o2.set(e2, a2.length), e2 = o2, i2.w = a2.length;
    }
    return ctx.el(e2, t2.level == null ? 6 : t2.level, t2.mem == null ? i2.l ? Math.ceil(Math.max(8, Math.min(13, Math.log(e2.length))) * 1.5) : 20 : 12 + t2.mem, n2, r2, i2);
  };
}], [540, ctx => {
  ctx.il = function (e2, t2) {
    var n2 = {};
    for (var r2 in e2) n2[r2] = e2[r2];
    for (var r2 in t2) n2[r2] = t2[r2];
    return n2;
  };
}], [541, ctx => {
  ctx.al = function (e2, t2, n2) {
    for (; n2; ++t2) e2[t2] = n2, n2 >>>= 8;
  };
}], [544, ctx => {
  ctx.cl = function (e2, t2, n2, r2) {
    for (var i2 in e2) {
      var a2 = e2[i2],
        o2 = t2 + i2,
        s2 = r2;
      Array.isArray(a2) && (s2 = ctx.il(r2, a2[1]), a2 = a2[0]), ArrayBuffer.isView(a2) ? n2[o2] = [a2, s2] : (n2[o2 += `/`] = [new ctx.pc(0), s2], ctx.cl(a2, o2, n2, r2));
    }
  };
}], [545, ctx => {
  ctx.ll = typeof TextEncoder < `u` && new TextEncoder();
}], [546, ctx => {
  ctx.ul = typeof TextDecoder < `u` && new TextDecoder();
}], [547, ctx => {
  try {
    ctx.ul.decode(ctx.$c, {
      stream: true
    });
  } catch {}
}], [549, ctx => {
  ctx.fl = function (e2) {
    var t2 = 0;
    if (e2) for (var n2 in e2) {
      var r2 = e2[n2].length;
      r2 > 65535 && ctx.Hc(9), t2 += r2 + 4;
    }
    return t2;
  };
}], [550, ctx => {
  ctx.pl = function (e2, t2, n2, r2, i2, a2, o2, s2) {
    var c2 = r2.length,
      l2 = n2.extra,
      u2 = s2 && s2.length,
      d2 = ctx.fl(l2);
    ctx.al(e2, t2, o2 == null ? 67324752 : 33639248), t2 += 4, o2 != null && (e2[t2++] = 20, e2[t2++] = n2.os), e2[t2] = 20, t2 += 2, e2[t2++] = n2.flag << 1 | (a2 < 0 && 8), e2[t2++] = i2 && 8, e2[t2++] = n2.compression & 255, e2[t2++] = n2.compression >> 8;
    var f2 = new Date(n2.mtime == null ? Date.now() : n2.mtime),
      p2 = f2.getFullYear() - 1980;
    if ((p2 < 0 || p2 > 119) && ctx.Hc(10), ctx.al(e2, t2, p2 << 25 | f2.getMonth() + 1 << 21 | f2.getDate() << 16 | f2.getHours() << 11 | f2.getMinutes() << 5 | f2.getSeconds() >> 1), t2 += 4, a2 != -1 && (ctx.al(e2, t2, n2.crc), ctx.al(e2, t2 + 4, a2 < 0 ? -a2 - 2 : a2), ctx.al(e2, t2 + 8, n2.size)), ctx.al(e2, t2 + 12, c2), ctx.al(e2, t2 + 14, d2), t2 += 16, o2 != null && (ctx.al(e2, t2, u2), ctx.al(e2, t2 + 6, n2.attrs), ctx.al(e2, t2 + 10, o2), t2 += 14), e2.set(r2, t2), t2 += c2, d2) for (var m2 in l2) {
      var h2 = l2[m2],
        g2 = h2.length;
      ctx.al(e2, t2, +m2), ctx.al(e2, t2 + 2, g2), e2.set(h2, t2 + 4), t2 += 4 + g2;
    }
    return u2 && (e2.set(s2, t2), t2 += u2), t2;
  };
}], [551, ctx => {
  ctx.ml = function (e2, t2, n2, r2, i2) {
    ctx.al(e2, t2, 101010256), ctx.al(e2, t2 + 8, n2), ctx.al(e2, t2 + 10, n2), ctx.al(e2, t2 + 12, r2), ctx.al(e2, t2 + 16, i2);
  };
}], [600, ctx => {
  ctx.lu = e2 => e2.deltaMetric === `loading` ? e2.deltaLoad : e2.deltaMetric === `q` ? e2.deltaQ : e2.deltaMetric === `v` ? e2.deltaV : e2.deltaP;
}], [683, ctx => {
  ctx.Rd = e2 => e2.replace(/&/g, `&amp;`).replace(/</g, `&lt;`).replace(/>/g, `&gt;`).replace(/"/g, `&quot;`).replace(/'/g, `&apos;`);
}], [927, ctx => {
  ctx.pg = e2 => typeof e2 == `number` && Number.isFinite(e2);
}], [942, ctx => {
  ctx.Og = turkeyBasemap;
}], [945, ctx => {
  ctx.jg = class {
    country = ctx.Ag(ctx.Og.country);
    provinces = ctx.Ag(ctx.Og.provinces);
    render(e2, t2, n2, r2, i2, a2, o2, s2) {
      let c2 = e2.getContext(`2d`),
        l2 = devicePixelRatio || 1;
      c2.setTransform(l2, 0, 0, l2, 0, 0), c2.clearRect(0, 0, t2, n2), c2.fillStyle = `#0c1c2c`, c2.fillRect(0, 0, t2, n2), s2.basemapStyle !== `none` && (c2.save(), c2.translate(t2 / 2 + i2, n2 / 2 + a2), c2.scale(r2, r2), c2.globalAlpha = s2.basemapOpacity, c2.fillStyle = s2.basemapStyle === `plain` ? `#1b2c38` : `#172c3b`, c2.strokeStyle = `#607582`, c2.lineWidth = 1.1 / r2, c2.fill(this.country, `evenodd`), c2.stroke(this.country), s2.showProvinceBorders && s2.basemapStyle !== `plain` && (c2.strokeStyle = `#647582`, c2.globalAlpha *= Math.min(0.85, 0.18 + o2 * 0.11) * (s2.basemapStyle === `provinces` ? 1.4 : 1), c2.lineWidth = 0.55 / r2, c2.stroke(this.provinces)), c2.restore());
    }
  };
}], [1094, ctx => {
  ctx.my = 1180;
}], [1095, ctx => {
  ctx.hy = 720;
}], [1096, ctx => {
  ctx.gy = (e2, t2) => {
    let n2 = ctx.Q(`label`, `ga-psse-diagram-control`);
    return n2.append(ctx.Q(`span`, `ga-muted`, e2), t2), n2;
  };
}]];
