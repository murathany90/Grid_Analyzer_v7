(function() {
  let e = (e2) => e2 / 2 ** 32 | 0, t = (e2) => e2 >>> 0;
  function n(n2, r2, i2, a2) {
    let o2 = e(i2), s2 = t(i2);
    n2.setUint32(r2, a2 ? s2 : o2, a2), n2.setUint32(r2 + 4, a2 ? o2 : s2, a2);
  }
  function r(e2) {
    return e2 instanceof Uint8Array || ArrayBuffer.isView(e2) && e2.constructor.name === `Uint8Array` && `BYTES_PER_ELEMENT` in e2 && e2.BYTES_PER_ELEMENT === 1;
  }
  let i = (e2) => e2 ? `"${e2}" ` : ``;
  function a(e2, t2 = ``) {
    if (typeof e2 != `number`) throw TypeError(i(t2) + `expected number, got ` + typeof e2);
    if (!Number.isSafeInteger(e2) || e2 < 0) throw RangeError(i(t2) + `expected integer >= 0, got ` + e2);
    return e2;
  }
  function o(e2, t2, n2 = ``) {
    if (r(e2) && (t2 === void 0 || e2.length === t2)) return e2;
    t2 !== void 0 && a(t2, `length`);
    let o2 = r(e2), s2 = t2 === void 0 ? `` : ` of length ${t2}`, c2 = o2 ? `length=${e2.length}` : `type=${typeof e2}`, l2 = i(n2) + `expected Uint8Array` + s2 + `, got ` + c2;
    throw o2 ? RangeError(l2) : TypeError(l2);
  }
  let s = (e2, t2) => {
    if (typeof e2 != `object` || !e2 || Array.isArray(e2)) throw TypeError((t2 === `object` ? `` : `"${t2}" `) + `expected object, got type=` + typeof e2);
  }, c = (e2, t2) => {
    s(e2, t2);
    let n2 = Object.getPrototypeOf(e2);
    if (n2 !== Object.prototype && n2 !== null) throw TypeError(`"${t2}" expected plain object`);
    if (Object.hasOwn(e2, `__proto__`)) throw TypeError(`"${t2}.__proto__" is not allowed`);
  };
  function l(e2, t2 = true) {
    if (e2.destroyed) throw Error(`hash was destroyed`);
    if (t2 && e2.finished) throw Error(`digest() was already called`);
  }
  function u(e2, t2) {
    o(e2, void 0, `output`);
    let n2 = t2.outputLen;
    if (!(e2.length >= n2)) throw RangeError(`"output" expected length >= ` + n2);
  }
  function d(...e2) {
    for (let t2 = 0; t2 < e2.length; t2++) e2[t2].fill(0);
  }
  function f(e2) {
    return new DataView(e2.buffer, e2.byteOffset, e2.byteLength);
  }
  function p(e2, t2) {
    return e2 << 32 - t2 | e2 >>> t2;
  }
  let m = typeof Uint8Array.from([]).toHex == `function` && typeof Uint8Array.fromHex == `function`, h = /* @__PURE__ */ Array.from({ length: 256 }, (e2, t2) => t2.toString(16).padStart(2, `0`));
  function g(e2) {
    if (o(e2), m) return e2.toHex();
    let t2 = ``;
    for (let n2 = 0; n2 < e2.length; n2++) t2 += h[e2[n2]];
    return t2;
  }
  function _(e2, t2, n2 = `opts`) {
    return c(e2, `defaults`), t2 !== void 0 && c(t2, n2), Object.assign(/* @__PURE__ */ Object.create(null), e2, t2);
  }
  function v(e2, t2 = {}) {
    if (typeof e2 != `function`) throw TypeError(`"hashCons" expected function, got type=` + typeof e2);
    t2 = _({}, t2, `info`);
    let n2 = (t3, n3) => e2(n3).update(t3).digest(), r2 = e2(void 0);
    return n2.outputLen = r2.outputLen, n2.blockLen = r2.blockLen, n2.canXOF = r2.canXOF, n2.create = (t3) => e2(t3), Object.assign(n2, t2), Object.freeze(n2);
  }
  let y = (e2) => ({ oid: Uint8Array.from([6, 9, 96, 134, 72, 1, 101, 3, 4, 2, e2]) });
  function b(e2, t2, n2) {
    return e2 & t2 ^ ~e2 & n2;
  }
  function x(e2, t2, n2) {
    return e2 & t2 ^ e2 & n2 ^ t2 & n2;
  }
  var S = class {
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
      this.blockLen = e2, this.outputLen = t2, this.padOffset = n2, this.isLE = r2, this.buffer = new Uint8Array(e2), this.view = f(this.buffer);
    }
    update(e2) {
      l(this), o(e2);
      let { view: t2, buffer: n2, blockLen: r2 } = this, i2 = e2.length, a2 = false;
      for (let o2 = 0; o2 < i2; ) {
        let s2 = Math.min(r2 - this.pos, i2 - o2);
        if (s2 === r2) {
          let t3 = f(e2);
          for (; r2 <= i2 - o2; o2 += r2) this.process(t3, o2);
          a2 = true;
          continue;
        }
        n2.set(o2 === 0 && s2 === i2 ? e2 : e2.subarray(o2, o2 + s2), this.pos), this.pos += s2, o2 += s2, this.pos === r2 && (this.process(t2, 0), this.pos = 0, a2 = true);
      }
      return this.length += e2.length, a2 && this.roundClean(), this;
    }
    digestInto(e2) {
      l(this), u(e2, this), this.finished = true;
      let { buffer: t2, view: r2, blockLen: i2, isLE: a2 } = this, { pos: o2 } = this;
      t2[o2++] = 128, t2.fill(0, o2), this.padOffset > i2 - o2 && (this.process(r2, 0), t2.fill(0)), n(r2, i2 - 8, this.length * 8, a2), this.process(r2, 0), this.roundClean();
      let s2 = e2 === t2 ? r2 : f(e2), c2 = this.outputLen, d2 = c2 / 4, p2 = this.get();
      if (c2 % 4 || d2 > p2.length) throw Error(`invalid outputLen`);
      for (let e3 = 0; e3 < d2; e3++) s2.setUint32(4 * e3, p2[e3], a2);
    }
    digest() {
      let { buffer: e2, outputLen: t2 } = this;
      this.digestInto(e2);
      let n2 = e2.slice(0, t2);
      return this.destroy(), n2;
    }
    _cloneIntoMeta(e2) {
      let { buffer: t2, length: n2, finished: r2, destroyed: i2, pos: a2 } = this;
      return e2.destroyed = i2, e2.finished = r2, e2.length = n2, e2.pos = a2, a2 && e2.buffer.set(t2), e2;
    }
    clone() {
      return this._cloneInto();
    }
  };
  let C = /* @__PURE__ */ Uint32Array.from([1779033703, 3144134277, 1013904242, 2773480762, 1359893119, 2600822924, 528734635, 1541459225]), w = /* @__PURE__ */ Uint32Array.from([1116352408, 1899447441, 3049323471, 3921009573, 961987163, 1508970993, 2453635748, 2870763221, 3624381080, 310598401, 607225278, 1426881987, 1925078388, 2162078206, 2614888103, 3248222580, 3835390401, 4022224774, 264347078, 604807628, 770255983, 1249150122, 1555081692, 1996064986, 2554220882, 2821834349, 2952996808, 3210313671, 3336571891, 3584528711, 113926993, 338241895, 666307205, 773529912, 1294757372, 1396182291, 1695183700, 1986661051, 2177026350, 2456956037, 2730485921, 2820302411, 3259730800, 3345764771, 3516065817, 3600352804, 4094571909, 275423344, 430227734, 506948616, 659060556, 883997877, 958139571, 1322822218, 1537002063, 1747873779, 1955562222, 2024104815, 2227730452, 2361852424, 2428436474, 2756734187, 3204031479, 3329325298]), T = /* @__PURE__ */ new Uint32Array(64);
  var E = class extends S {
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
      let { A: e2, B: t2, C: n2, D: r2, E: i2, F: a2, G: o2, H: s2 } = this;
      return [e2, t2, n2, r2, i2, a2, o2, s2];
    }
    set(e2, t2, n2, r2, i2, a2, o2, s2) {
      this.A = e2 | 0, this.B = t2 | 0, this.C = n2 | 0, this.D = r2 | 0, this.E = i2 | 0, this.F = a2 | 0, this.G = o2 | 0, this.H = s2 | 0;
    }
    _cloneInto(e2) {
      return (e2 ||= new this.constructor()).set(...this.get()), this._cloneIntoMeta(e2);
    }
    process(e2, t2) {
      for (let n3 = 0; n3 < 16; n3++, t2 += 4) T[n3] = e2.getUint32(t2, false);
      for (let e3 = 16; e3 < 64; e3++) {
        let t3 = T[e3 - 15], n3 = T[e3 - 2], r3 = p(t3, 7) ^ p(t3, 18) ^ t3 >>> 3, i3 = p(n3, 17) ^ p(n3, 19) ^ n3 >>> 10;
        T[e3] = i3 + T[e3 - 7] + r3 + T[e3 - 16] | 0;
      }
      let { A: n2, B: r2, C: i2, D: a2, E: o2, F: s2, G: c2, H: l2 } = this;
      for (let e3 = 0; e3 < 64; e3++) {
        let t3 = p(o2, 6) ^ p(o2, 11) ^ p(o2, 25), u2 = l2 + t3 + b(o2, s2, c2) + w[e3] + T[e3] | 0, d2 = (p(n2, 2) ^ p(n2, 13) ^ p(n2, 22)) + x(n2, r2, i2) | 0;
        l2 = c2, c2 = s2, s2 = o2, o2 = a2 + u2 | 0, a2 = i2, i2 = r2, r2 = n2, n2 = u2 + d2 | 0;
      }
      n2 = n2 + this.A | 0, r2 = r2 + this.B | 0, i2 = i2 + this.C | 0, a2 = a2 + this.D | 0, o2 = o2 + this.E | 0, s2 = s2 + this.F | 0, c2 = c2 + this.G | 0, l2 = l2 + this.H | 0, this.set(n2, r2, i2, a2, o2, s2, c2, l2);
    }
    roundClean() {
      d(T);
    }
    destroy() {
      this.destroyed = true, this.set(0, 0, 0, 0, 0, 0, 0, 0), d(this.buffer);
    }
  }, D = class extends E {
    constructor() {
      super(32, C);
    }
  };
  let O = /* @__PURE__ */ v(() => new D(), /* @__PURE__ */ y(1)), k = (e2, t2 = `number`) => {
    if (e2 == null || e2 === ``) throw Error(`Missing ${t2}`);
    let n2 = typeof e2 == `number` ? e2 : Number(String(e2).replace(/[dD]/g, `E`));
    if (!Number.isFinite(n2)) throw Error(`Invalid ${t2}: ${String(e2).slice(0, 80)}`);
    return n2;
  }, A = (e2, t2 = `integer`) => {
    let n2 = k(e2, t2);
    if (!Number.isSafeInteger(n2)) throw Error(`Invalid ${t2}`);
    return n2;
  }, j = (e2) => e2 == null || e2 === `` ? null : k(e2), M = (e2) => e2 == null ? `` : String(e2).trim(), N = (e2, t2, n2, r2 = false, i2) => ({ value: e2, field: t2, unit: n2, provenance: r2 ? `DERIVED_FROM_SOURCE` : `SOURCE_SAVED`, ...i2 === void 0 ? {} : { offset: i2 } });
  function P(e2, t2, n2, r2, i2, a2, o2) {
    if (!(i2 > 0)) throw Error(`Invalid system MVA base`);
    return { schema: `ga.psse.native.v1`, source: { name: t2, format: n2, revision: r2, byteLength: e2.length, sha256: g(O(e2)) }, case: { baseMva: i2, frequencyHz: a2, title: o2 }, equipment: [], sourceTables: {}, findings: [], completeness: `COMPLETE`, analyses: { powerFlow: `BLOCKED`, shortCircuit: `BLOCKED`, n1: `BLOCKED` }, sourceResults: [], timing: { decodeMs: 0 } };
  }
  function F(e2, t2, n2, r2, i2, a2, o2 = ``, s2 = {}) {
    let c2 = { kind: t2, id: `${t2}:${n2}`, name: o2, buses: i2, status: a2, nominalKv: null, fields: r2, operating: s2 };
    return e2.equipment.push(c2), c2;
  }
  function ee(e2) {
    let t2 = /* @__PURE__ */ new Map(), n2 = /* @__PURE__ */ new Set(), r2 = (t3, n3, r3) => e2.findings.push({ severity: `ERROR`, code: t3, message: n3, equipment: r3 });
    for (let r3 of e2.equipment) {
      if (n2.has(r3.id)) throw Error(`DUPLICATE_EQUIPMENT_ID: ${r3.id}`);
      if (n2.add(r3.id), r3.kind === `bus`) {
        let n3 = A(r3.fields.connectionKey ?? r3.fields.ibus, `bus identity`);
        if (n3 <= 0 || t2.has(n3)) throw Error(`DUPLICATE_OR_INVALID_BUS: ${n3}`);
        if (t2.set(n3, r3), r3.nominalKv = k(r3.fields.baskv, `bus base kV`), r3.nominalKv < 0) throw Error(`Invalid base kV: ${n3}`);
        r3.nominalKv === 0 && e2.findings.push({ severity: `WARNING`, code: `UNSPECIFIED_BASE_KV`, message: `${n3}: kaynak nominal gerilimi 0; gerilim taban\u0131 t\xFCretilmedi.`, equipment: r3.id });
      }
    }
    if (!t2.size) throw Error(`NO_ELECTRICAL_BUSES`);
    for (let n3 of e2.equipment) {
      for (let e3 of n3.buses) if (!t2.has(e3)) throw Error(`MISSING_TERMINAL_BUS: ${n3.id} -> ${e3}`);
      n3.nominalKv === null && n3.buses.length && (n3.nominalKv = t2.get(n3.buses[0]).nominalKv);
    }
    let i2 = new Set(e2.equipment.filter((e3) => e3.kind === `generator` && e3.status === 1).flatMap((e3) => e3.buses)), a2 = new Set([...t2].filter(([e3, t3]) => k(t3.fields.ide) === 3 && t3.status === 1 && i2.has(e3)).map(([e3]) => e3));
    a2.size || r2(`NO_ACTIVE_SLACK`, `Aktif referans bara ve o baraya ba\u011Fl\u0131 devrede jenerat\xF6r bulunamad\u0131.`);
    for (let [e3, n3] of t2) k(n3.fields.ide) === 3 && !i2.has(e3) && r2(`SLACK_WITHOUT_ACTIVE_GENERATOR`, `Referans bara ${e3} \xFCzerinde devrede jenerat\xF6r yok.`, n3.id);
    let o2 = /* @__PURE__ */ new Map();
    for (let e3 of t2.keys()) o2.set(e3, []);
    for (let n3 of e2.equipment) if ([`line`, `transformer`, `switch`].includes(n3.kind) && n3.status !== 0 && n3.buses.length > 1) {
      let e3 = n3.kind === `transformer` && n3.buses.length === 3 && n3.status !== 1 ? { 2: 1, 3: 2, 4: 0 }[n3.status ?? 0] : void 0, r3 = n3.buses.filter((r4, i3) => i3 !== e3 && t2.get(n3.buses[i3]).status === 1);
      for (let e4 = 1; e4 < r3.length; e4++) o2.get(r3[0]).push(r3[e4]), o2.get(r3[e4]).push(r3[0]);
    }
    let s2 = /* @__PURE__ */ new Set(), c2 = 0, l2 = 0;
    for (let [e3, n3] of t2) {
      if (n3.status !== 1 || n3.fields.threeWindingStar === true || s2.has(e3)) continue;
      c2++;
      let r3 = [e3];
      s2.add(e3);
      let i3 = false;
      for (let e4 = 0; e4 < r3.length; e4++) {
        let n4 = r3[e4];
        i3 ||= a2.has(n4);
        for (let e5 of o2.get(n4)) !s2.has(e5) && t2.get(e5).status === 1 && (s2.add(e5), r3.push(e5));
      }
      i3 || l2++;
    }
    e2.case.activeIslands = c2, l2 && r2(`ISLAND_WITHOUT_ACTIVE_SLACK`, `${l2}/${c2} aktif adada do\u011Frulanm\u0131\u015F aktif referans kaynak yok.`);
    let u2 = new Set(e2.equipment.filter((e3) => e3.kind === `node`).map((e3) => `${e3.fields.isub}:${e3.fields.inode}`));
    for (let t3 of e2.equipment) {
      if (t3.kind === `terminal` && !u2.has(`${t3.fields.isub}:${t3.fields.inode}`)) throw Error(`MISSING_NODE_TERMINAL: ${t3.id}`);
      if (t3.kind === `switch` && t3.fields.isub !== void 0) {
        for (let e3 of [`inode`, `jnode`]) if (!u2.has(`${t3.fields.isub}:${t3.fields[e3]}`)) throw Error(`MISSING_SWITCH_NODE: ${t3.id}`);
      }
    }
    e2.findings.push({ severity: `INFO`, code: `INSPECTION_ONLY`, message: `Kaynak envanteri ve kay\u0131tl\u0131 i\u015Fletme noktas\u0131. GA y\xFCk ak\u0131\u015F\u0131, k\u0131sa devre ve N-1 hesaplanmad\u0131; analizler BLOCKED.` }), e2.findings.some((e3) => e3.severity === `ERROR` || e3.code === `UNSUPPORTED_SOURCE_MODEL` || e3.code === `UNSPECIFIED_BASE_KV`) && (e2.completeness = `PARTIAL`);
  }
  let I = (e2) => e2.split(` `), L = Array.from({ length: 12 }, (e2, t2) => `rate${t2 + 1}`), R = I(`o1 f1 o2 f2 o3 f3 o4 f4`), z = (e2) => [...I(`windv nomv ang`).map((t2) => t2 + e2), ...L.map((t2) => `wdg${e2}${t2}`), ...I(`cod cont node rma rmi vma vmi ntp tab cr cx cnxa`).map((t2) => t2 + e2)], B = { BUS: I(`ibus name baskv ide area zone owner vm va nvhi nvlo evhi evlo`), LOAD: I(`ibus loadid stat area zone pl ql ip iq yp yq owner scale intrpt dgenp dgenq dgenm loadtype name`), FIXED_SHUNT: I(`ibus shntid stat gl bl name`), VOLTAGE_DROOP_CONTROL: I(`name status regbus qdb qmin qmax vdblow vdbhigh vlow vhigh`), GENERATOR: [...I(`ibus machid pg qg qt qb vs ireg nreg mbase zr zx rt xt gtap stat rmpct pt pb baslod`), ...R, ...I(`wmod wpf droopname name`)], SWITCHING_DEVICE_RATING_SET: [...I(`rsetnam desc`), ...L], BRANCH: [...I(`ibus jbus ckt rpu xpu bpu name`), ...L, ...I(`gi bi gj bj stat bp met len`), ...R], SYSTEM_SWITCHING_DEVICE: I(`ibus jbus ckt xpu rsetnam stat nstat met stype name`), TRANSFORMER: [...I(`ibus jbus kbus ckt cw cz cm mag1 mag2 nmet name stat`), ...R, ...I(`vecgrp zcod`)], AREA: I(`iarea isw pdes ptol arname`), ZONE: I(`izone zoname`), OWNER: I(`iowner owname`), FACTS_DEVICE: I(`name ibus jbus mode pdes qdes vset shmx trmx vtmn vtmx vsmx imx linx rmpct owner set1 set2 vsref fcreg nreg mname`), SWITCHED_SHUNT: [...I(`ibus shntid modsw adjm stat vswhi vswlo swreg nreg rmpct rmidnt binit name`), ...Array.from({ length: 8 }, (e2, t2) => [`s${t2 + 1}`, `n${t2 + 1}`, `b${t2 + 1}`]).flat()], SUBSTATION: I(`isub name lati long srg`), SUBSTATION_NODE: I(`inode name ibus stat vm va`), SUBSTATION_SWITCHING_DEVICE: I(`inode jnode swdid name type stat nstat xpu rsetnam`), SUBSTATION_TERMINAL: I(`ibus inode type jbus kbus eqid`) }, V = { bus: `BUS`, load: `LOAD`, fixshunt: `FIXED_SHUNT`, voltagedroop: `VOLTAGE_DROOP_CONTROL`, generator: `GENERATOR`, swdratset: `SWITCHING_DEVICE_RATING_SET`, acline: `BRANCH`, sysswd: `SYSTEM_SWITCHING_DEVICE`, transformer: `TRANSFORMER`, area: `AREA`, zone: `ZONE`, owner: `OWNER`, facts: `FACTS_DEVICE`, swshunt: `SWITCHED_SHUNT`, sub: `SUBSTATION`, subnode: `SUBSTATION_NODE`, subswd: `SUBSTATION_SWITCHING_DEVICE`, subterm: `SUBSTATION_TERMINAL`, twotermdc: `TWO_TERMINAL_DC`, vscdc: `VSC_DC_LINE`, ntermdc: `MULTI_TERMINAL_DC` };
  function H(e2, t2, n2, r2, i2) {
    if (r2 === 1) return [e2, t2];
    if (![2, 3].includes(r2) || n2 <= 0) throw Error(`Unsupported CZ / invalid transformer MVA base`);
    let a2 = i2 / n2;
    if (r2 === 2) return [e2 * a2, t2 * a2];
    let o2 = e2 / (n2 * 1e6);
    if (t2 < 0 || t2 * t2 < o2 * o2) throw Error(`Invalid CZ=3 impedance magnitude`);
    return [o2 * a2, Math.sqrt(t2 * t2 - o2 * o2) * a2];
  }
  function U(e2, t2, n2, r2) {
    if (e2 <= 0) throw Error(`Invalid winding ratio`);
    if (r2 === 1) return e2;
    if (n2 <= 0) throw Error(`Missing winding voltage base`);
    if (r2 === 2) return e2 / n2;
    if (r2 === 3) return e2 * (t2 || n2) / n2;
    throw Error(`Unsupported CW`);
  }
  let te = { BUS: [`ibus`, `name`, `baskv`, `ide`, `vm`, `va`], LOAD: [`ibus`, `loadid`, `stat`, `pl`, `ql`, `ip`, `iq`, `yp`, `yq`], GENERATOR: [`ibus`, `machid`, `pg`, `qg`, `qt`, `qb`, `vs`, `mbase`, `zr`, `zx`, `stat`, `pt`, `pb`], BRANCH: [`ibus`, `jbus`, `ckt`, `rpu`, `xpu`, `bpu`, `stat`], FIXED_SHUNT: [`ibus`, `shntid`, `stat`, `gl`, `bl`], SYSTEM_SWITCHING_DEVICE: [`ibus`, `jbus`, `ckt`, `xpu`, `stat`], TRANSFORMER: [`ibus`, `jbus`, `kbus`, `ckt`, `cw`, `cz`, `cm`, `mag1`, `mag2`, `stat`, `r1_2`, `x1_2`, `sbase1_2`, `windv1`, `windv2`] };
  function W(e2, t2) {
    e2.sourceTables = t2;
    for (let [e3, n3] of Object.entries(t2)) for (let t3 of n3) for (let n4 of te[e3] ?? []) if (t3[n4] === null || t3[n4] === void 0 || t3[n4] === ``) throw Error(`Missing ${e3}.${n4}`);
    let n2 = /* @__PURE__ */ new Set();
    for (let e3 of [`BRANCH`, `TRANSFORMER`, `SYSTEM_SWITCHING_DEVICE`, `SUBSTATION_SWITCHING_DEVICE`]) for (let r3 of t2[e3] ?? []) {
      let t3 = e3 === `SUBSTATION_SWITCHING_DEVICE`, i3 = (t3 ? [r3.inode, r3.jnode] : e3 === `TRANSFORMER` ? [r3.ibus, r3.jbus, r3.kbus] : [r3.ibus, r3.jbus]).filter((e4) => e4 != null && A(e4) !== 0).map((e4) => Math.abs(A(e4))).sort((e4, t4) => e4 - t4), a3 = e3 + `:` + (t3 ? A(r3.isub) + `:` : ``) + i3.join(`:`) + `:` + M(t3 ? r3.swdid : r3.ckt);
      if (n2.has(a3)) throw Error(`DUPLICATE_OR_REVERSED_EQUIPMENT: ${a3}`);
      n2.add(a3);
    }
    let r2 = /* @__PURE__ */ new Map();
    for (let n3 of t2.BUS ?? []) {
      let t3 = A(n3.ibus);
      r2.set(t3, n3), F(e2, `bus`, String(t3), n3, [t3], A(n3.ide) === 4 ? 0 : 1, M(n3.name), { vm: N(k(n3.vm), `BUS.vm`, `pu`), va: N(k(n3.va), `BUS.va`, `deg`) });
    }
    for (let [e3, n3] of [[`GENERATOR`, [`ireg`]], [`SWITCHED_SHUNT`, [`swreg`]], [`TRANSFORMER`, [`cont1`, `cont2`, `cont3`]], [`VOLTAGE_DROOP_CONTROL`, [`regbus`]]]) for (let i3 of t2[e3] ?? []) for (let t3 of n3) {
      let n4 = j(i3[t3]);
      if (n4 !== null && n4 !== 0 && !r2.has(Math.abs(A(n4)))) throw Error(`MISSING_CONTROL_BUS: ${e3}.${t3}=${n4}`);
    }
    let i2 = (n3, r3, i3, a3 = `stat`, o3 = ``) => {
      for (let s3 of t2[r3] ?? []) {
        let t3 = A(s3.ibus), c2 = {};
        for (let e3 of n3 === `generator` ? [`pg`, `qg`, `vs`] : n3 === `load` ? [`pl`, `ql`, `ip`, `iq`, `yp`, `yq`] : [`gl`, `bl`, `binit`]) s3[e3] !== null && s3[e3] !== void 0 && (c2[e3] = N(k(s3[e3]), `${r3}.${e3}`, e3 === `vs` ? `pu` : /[pq]g$|[pq]l$|^ip$|^yp$|^gl$/.test(e3) ? `MW` : `Mvar`));
        F(e2, n3, `${o3}${t3}:${M(s3[i3])}`, s3, [t3], A(s3[a3]), M(s3.name), c2);
      }
    };
    i2(`generator`, `GENERATOR`, `machid`), i2(`load`, `LOAD`, `loadid`), i2(`shunt`, `FIXED_SHUNT`, `shntid`, `stat`, `fixed:`), i2(`shunt`, `SWITCHED_SHUNT`, `shntid`, `stat`, `switched:`);
    for (let n3 of t2.BRANCH ?? []) {
      let t3 = Math.abs(A(n3.ibus)), r3 = Math.abs(A(n3.jbus));
      F(e2, `line`, `${t3}:${r3}:${M(n3.ckt)}`, n3, [t3, r3], A(n3.stat), M(n3.name));
    }
    for (let n3 of t2.SYSTEM_SWITCHING_DEVICE ?? []) {
      let t3 = A(n3.ibus), r3 = A(n3.jbus);
      F(e2, `switch`, `system:${t3}:${r3}:${M(n3.ckt)}`, n3, [t3, r3], A(n3.stat), M(n3.name), { status: N(A(n3.stat), `SYSTEM_SWITCHING_DEVICE.stat`) });
    }
    for (let n3 of t2.TRANSFORMER ?? []) {
      let t3 = [A(n3.ibus), A(n3.jbus)], i3 = A(n3.kbus);
      i3 && t3.push(i3);
      let a3 = { ...n3 }, o3 = {};
      for (let [t4, r3] of i3 ? [[1, 2], [2, 3], [3, 1]] : [[1, 2]]) {
        let [i4, o4] = H(k(n3[`r${t4}_${r3}`]), k(n3[`x${t4}_${r3}`]), k(n3[`sbase${t4}_${r3}`]), A(n3.cz), e2.case.baseMva);
        a3[`r${t4}${r3}Pu`] = i4, a3[`x${t4}${r3}Pu`] = o4;
      }
      for (let e3 = 1; e3 <= t3.length; e3++) {
        let i4 = r2.get(t3[e3 - 1]);
        if (!i4) throw Error(`Missing transformer terminal bus`);
        a3[`ratio${e3}Pu`] = U(k(n3[`windv${e3}`]), k(n3[`nomv${e3}`]), k(i4.baskv), A(n3.cw)), o3[`tap${e3}`] = N(k(n3[`windv${e3}`]), `TRANSFORMER.windv${e3}`), j(n3[`ang${e3}`]) !== null && (o3[`angle${e3}`] = N(k(n3[`ang${e3}`]), `TRANSFORMER.ang${e3}`, `deg`));
      }
      F(e2, `transformer`, `${t3.join(`:`)}:${M(n3.ckt)}`, a3, t3, A(n3.stat), M(n3.name), o3);
    }
    for (let n3 of t2.SUBSTATION ?? []) F(e2, `substation`, String(A(n3.isub)), n3, [], null, M(n3.name));
    let a2 = new Set((t2.SUBSTATION ?? []).map((e3) => A(e3.isub))), o2 = /* @__PURE__ */ new Map();
    for (let n3 of t2.SUBSTATION_NODE ?? []) {
      let t3 = A(n3.isub), r3 = A(n3.inode), i3 = A(n3.ibus);
      if (!a2.has(t3)) throw Error(`MISSING_NODE_SUBSTATION: ${t3}:${r3}`);
      o2.set(`${t3}:${r3}`, n3), F(e2, `node`, `${t3}:${r3}`, n3, i3 ? [i3] : [], A(n3.stat), M(n3.name), { vm: N(j(n3.vm), `SUBSTATION_NODE.vm`, `pu`), va: N(j(n3.va), `SUBSTATION_NODE.va`, `deg`) });
    }
    for (let n3 of t2.SUBSTATION_SWITCHING_DEVICE ?? []) {
      let t3 = A(n3.isub), r3 = A(n3.inode), i3 = A(n3.jnode), a3 = [o2.get(`${t3}:${r3}`)?.ibus, o2.get(`${t3}:${i3}`)?.ibus].filter((e3) => e3 !== void 0 && A(e3) !== 0).map((e3) => A(e3));
      F(e2, `switch`, `node:${t3}:${r3}:${i3}:${M(n3.swdid)}`, n3, a3, A(n3.stat), M(n3.name));
    }
    for (let n3 of t2.SUBSTATION_TERMINAL ?? []) {
      let t3 = [n3.ibus, n3.jbus, n3.kbus].filter((e3) => e3 != null && A(e3) !== 0).map((e3) => A(e3)), r3 = M(n3.type).toUpperCase(), i3 = o2.get(`${n3.isub}:${n3.inode}`);
      if (i3 && A(i3.ibus) !== 0 && A(i3.ibus) !== t3[0]) throw Error(`TERMINAL_NODE_BUS_MISMATCH: ${n3.isub}:${n3.inode}`);
      let a3 = { M: [`generator`, `machid`], L: [`load`, `loadid`], F: [`shunt`, `shntid`], S: [`shunt`, `shntid`], B: [`line`, `ckt`], 2: [`transformer`, `ckt`], 3: [`transformer`, `ckt`] }[r3];
      if (a3) {
        let i4 = e2.equipment.find((e3) => (e3.kind === a3[0] || r3 === `B` && e3.id.startsWith(`switch:system:`)) && M(e3.fields[a3[1]]) === M(n3.eqid) && e3.buses.length === t3.length && e3.buses.every((e4) => t3.includes(e4)) && (r3 !== `F` || e3.id.startsWith(`shunt:fixed:`)) && (r3 !== `S` || e3.id.startsWith(`shunt:switched:`)));
        if (!i4) throw Error(`MISSING_TERMINAL_EQUIPMENT: ${n3.isub}:${n3.inode}:${r3}:${M(n3.eqid)}`);
        n3.connectedEquipmentId = i4.id;
      } else [`D`, `V`, `N`, `A`, `I`].includes(r3) || e2.findings.push({ severity: `WARNING`, code: `UNSUPPORTED_SOURCE_MODEL`, message: `SUBSTATION_TERMINAL type ${r3}: kaynak ili\u015Fkisi korunuyor; ekipman e\u015Flemesi bilinmiyor.` });
      F(e2, `terminal`, `${n3.isub}:${n3.inode}:${n3.type}:${t3.join(`:`)}:${M(n3.eqid)}`, n3, t3, null);
    }
    let s2 = /* @__PURE__ */ new Set([`BUS`, `LOAD`, `FIXED_SHUNT`, `GENERATOR`, `BRANCH`, `SYSTEM_SWITCHING_DEVICE`, `TRANSFORMER`, `SWITCHED_SHUNT`, `SUBSTATION`, `SUBSTATION_NODE`, `SUBSTATION_SWITCHING_DEVICE`, `SUBSTATION_TERMINAL`]);
    for (let [n3, r3] of Object.entries(t2)) if (!s2.has(n3) && r3.length) {
      let t3 = /DC|FACTS|GNE|INDUCTION|VOLTAGE_DROOP/.test(n3);
      t3 && e2.findings.push({ severity: `WARNING`, code: `UNSUPPORTED_SOURCE_MODEL`, message: `${n3}: ${r3.length} kaynak kayd\u0131 korunuyor; elektriksel yorumun kapsam\u0131 s\u0131n\u0131rl\u0131.` }), t3 && r3.forEach((t4, r4) => {
        let i3 = /DC/.test(n3) ? `dc` : /FACTS/.test(n3) ? `facts` : `other`, a3 = [`ibus`, `jbus`, `regbus`].flatMap((e3) => j(t4[e3]) ? [Math.abs(A(t4[e3]))] : []);
        F(e2, i3, `${n3}:${M(t4.name)}:${r4}`, { sourceTable: n3, ...t4 }, a3, j(t4.stat ?? t4.status ?? t4.mode), M(t4.name));
      });
    }
  }
  function G(e2) {
    let t2 = [], n2 = ``, r2 = ``;
    for (let i2 = 0; i2 < e2.length; i2++) {
      let a2 = e2[i2];
      if (r2) a2 === r2 ? e2[i2 + 1] === r2 ? (n2 += a2, i2++) : r2 = `` : n2 += a2;
      else if (a2 === `"` || a2 === `'`) r2 = a2;
      else if (a2 === `/`) break;
      else a2 === `,` ? (t2.push(n2.trim()), n2 = ``) : n2 += a2;
    }
    if (r2) throw Error(`Unterminated RAW quoted field`);
    return t2.push(n2.trim()), t2;
  }
  let K = /* @__PURE__ */ new Set([`name`, `mname`, `loadid`, `shntid`, `machid`, `ckt`, `droopname`, `loadtype`, `rsetnam`, `desc`, `vecgrp`, `rmidnt`, `swdid`, `eqid`, `arname`, `zoname`, `owname`]);
  function q(e2, t2) {
    let n2 = {};
    return e2.forEach((e3, r2) => {
      let i2 = t2[r2] ?? `sourceField${r2 + 1}`;
      n2[i2] = e3 === `` ? null : K.has(i2) || r2 >= t2.length ? e3 : k(e3, i2);
    }), n2;
  }
  function ne(e2) {
    if (e2.length < 4) throw Error(`Truncated substation terminal`);
    let t2 = e2[2].toUpperCase(), n2 = t2 === `3` ? 2 : +!![`B`, `2`, `Z`].includes(t2);
    if (e2.length !== 4 + n2) throw Error(`Invalid substation terminal ${t2} field count`);
    return { ibus: A(e2[0]), inode: A(e2[1]), type: t2, jbus: n2 ? A(e2[3]) : null, kbus: n2 === 2 ? A(e2[4]) : null, eqid: e2[3 + n2], sourceTokens: e2 };
  }
  let J = /* @__PURE__ */ `BUS.LOAD.FIXED_SHUNT.VOLTAGE_DROOP_CONTROL.GENERATOR.SWITCHING_DEVICE_RATING_SET.BRANCH.SYSTEM_SWITCHING_DEVICE.TRANSFORMER.AREA.TWO_TERMINAL_DC.VSC_DC_LINE.IMPEDANCE_CORRECTION.MULTI_TERMINAL_DC.MULTI_SECTION_LINE.ZONE.INTER_AREA_TRANSFER.OWNER.FACTS_DEVICE.SWITCHED_SHUNT.GNE.INDUCTION_MACHINE.LOAD_TYPE.INTERFACE.INTERFACE_ELEMENT.SUBSTATION`.split(`.`), Y = `r1_2 x1_2 sbase1_2 r2_3 x2_3 sbase2_3 r3_1 x3_1 sbase3_1 vmstar anstar`.split(` `);
  function re(e2, t2) {
    let n2 = new TextDecoder(`windows-1254`, { fatal: true }).decode(e2).replace(/^\uFEFF/, ``).split(/\r?\n/).filter((e3) => !e3.trimStart().startsWith(`@!`));
    for (; n2.length && !n2[0].trim(); ) n2.shift();
    if (n2.length < 3) throw Error(`Truncated RAW header`);
    let r2 = G(n2[0]);
    if (r2.length < 6) throw Error(`Missing RAW case identification`);
    let i2 = A(r2[2]);
    if (![35, 36].includes(i2)) throw Error(`UNSUPPORTED_RAW_REVISION: ${i2}`);
    let a2 = P(e2, t2, `RAW`, i2, k(r2[1]), k(r2[5]), n2.slice(1, 3)), o2 = {}, s2 = n2.slice(3, 100).some((e3) => /BEGIN BUS DATA/i.test(e3)) ? `SYSTEM_WIDE` : `BUS`, c2 = null, l2 = false, u2 = {};
    for (let e3 = 3; e3 < n2.length; e3++) {
      let t3 = n2[e3].trim();
      if (!t3) continue;
      if (/^(?:Q|'Q'|"Q")\s*(?:\/.*)?$/i.test(t3)) {
        l2 = true;
        break;
      }
      if (/^0\s*(?:[,/]|$)/.test(t3)) {
        let e4 = /BEGIN\s+([A-Z0-9_\-\s]+?)(?:\s+DATA|$)/i.exec(t3);
        if (e4) s2 = e4[1].trim().replace(/[\s-]+/g, `_`).toUpperCase();
        else if (/END OF SUBSTATION TERMINAL/i.test(t3)) s2 = `SUBSTATION`;
        else if (/END OF SUBSTATION DATA/i.test(t3)) s2 = `END`;
        else {
          let e5 = J.indexOf(s2) + 1;
          if (e5 <= 0 || e5 >= J.length) throw Error(`Unknown RAW section transition: ${s2}`);
          s2 = J[e5];
        }
        continue;
      }
      if (s2 === `END`) throw Error(`Unexpected data after final RAW section`);
      let r3 = G(t3);
      if ((u2[s2] ??= []).push(r3), s2 === `SUBSTATION`) c2 = A(r3[0]), (o2.SUBSTATION ??= []).push(q(r3, B.SUBSTATION)), s2 = `SUBSTATION_NODE`;
      else if (s2.startsWith(`SUBSTATION_`)) {
        if (c2 === null) throw Error(`Node-breaker record without parent substation`);
        (o2[s2] ??= []).push({ isub: c2, ...s2 === `SUBSTATION_TERMINAL` ? ne(r3) : q(r3, B[s2] ?? []) });
      }
    }
    if (!l2) throw Error(`TRUNCATED_RAW: missing Q end marker`);
    for (let [e3, t3] of Object.entries(u2)) if (!e3.startsWith(`SUBSTATION`)) {
      if (e3 === `TRANSFORMER`) for (let n3 = 0; n3 < t3.length; ) {
        let r3 = t3[n3], i3 = A(r3[2]) !== 0, a3 = i3 ? 5 : 4;
        if (n3 + a3 > t3.length) throw Error(`TRUNCATED_TRANSFORMER`);
        if (r3.length < 12 || t3[n3 + 1].length < (i3 ? 11 : 3) || t3[n3 + 2].length < 15 || t3[n3 + 3].length < 2 || i3 && t3[n3 + 4].length < 15) throw Error(`Truncated transformer winding or impedance record`);
        let s3 = { ...q(r3, B.TRANSFORMER), ...q(t3[n3 + 1], i3 ? Y : Y.slice(0, 3)), ...q(t3[n3 + 2], z(1)), ...q(t3[n3 + 3], z(2)), ...i3 ? q(t3[n3 + 4], z(3)) : {}, sourceLines: t3.slice(n3, n3 + a3) };
        (o2[e3] ??= []).push(s3), n3 += a3;
      }
      else o2[e3] = t3.map((t4) => ({ ...q(t4, B[e3] ?? []), sourceTokens: t4 }));
    }
    return a2.case.identification = r2, W(a2, o2), a2;
  }
  function X(e2, t2) {
    if (!e2 || typeof e2 != `object` || Array.isArray(e2)) throw Error(`Invalid RAWX ${t2}`);
    return e2;
  }
  function Z(e2, t2) {
    let n2 = X(JSON.parse(new TextDecoder(`utf-8`, { fatal: true }).decode(e2).replace(/^\uFEFF/, ``)), `root`), r2 = X(n2.network, `network`), i2 = {}, a2;
    for (let [e3, t3] of Object.entries(r2)) {
      let n3 = X(t3, e3);
      if (!Array.isArray(n3.fields) || !Array.isArray(n3.data)) throw Error(`Invalid RAWX table ${e3}`);
      let r3 = n3.fields.map((e4) => M(e4).toLowerCase());
      if (r3.some((e4) => !e4) || new Set(r3).size !== r3.length) throw Error(`Duplicate/empty RAWX fields: ${e3}`);
      let o3 = [`caseid`, `general`, `gauss`, `newton`, `adjust`, `tysl`, `solver`].includes(e3) ? [n3.data] : n3.data, s3 = V[e3] ?? e3.toUpperCase(), c2 = /* @__PURE__ */ new Set([...B[s3] ?? [], ...s3 === `TRANSFORMER` ? [...Y, ...z(1), ...z(2), ...z(3)] : []]), l2 = o3.map((t4) => {
        if (!Array.isArray(t4) || t4.length > r3.length) throw Error(`Invalid RAWX row ${e3}`);
        return Object.fromEntries(r3.map((e4, n4) => {
          let r4 = t4[n4] ?? null, i3 = K.has(e4) || s3 === `SUBSTATION_TERMINAL` && e4 === `type`;
          return [e4, r4 === null ? null : c2.has(e4) && !i3 ? k(r4, `${s3}.${e4}`) : i3 ? M(r4) : r4];
        }));
      });
      e3 === `caseid` && (a2 = l2[0]), i2[V[e3] ?? e3.toUpperCase()] = l2;
    }
    if (!a2) throw Error(`Missing RAWX caseid`);
    let o2 = A(a2.rev);
    if (![35, 36].includes(o2)) throw Error(`UNSUPPORTED_RAWX_REVISION: ${o2}`);
    let s2 = P(e2, t2, `RAWX`, o2, k(a2.sbase), k(a2.basfrq), [M(a2.title1), M(a2.title2)]);
    return s2.case.general = n2.general, W(s2, i2), s2;
  }
  let Q = 1392, $ = 1600;
  function ie(e2, t2 = 536870912) {
    let n2 = new Uint8Array(e2), r2 = new DataView(e2), i2 = (e3) => {
      throw Error(`SAV_SFL_INVALID: ${e3}`);
    };
    (!Number.isSafeInteger(t2) || t2 < Q) && i2(`invalid byte budget`), (n2.length > t2 || n2.length < Q || (n2.length - 12) % 4 != 0) && i2(`truncated or excessive physical length`);
    for (let e3 = 0; e3 < 20; e3++) n2[e3] !== `FuP_pHySPCD%PTI_SFL_`.charCodeAt(e3) && i2(`unsupported physical signature`);
    let a2 = (e3) => ((!Number.isSafeInteger(e3) || e3 < 0 || e3 + 4 > n2.length) && i2(`integer outside source`), r2.getUint32(e3, true));
    a2(20) !== 1 && i2(`unsupported SFL revision`);
    let o2 = a2(24), s2 = 12 + 4 * o2;
    s2 !== n2.length && i2(`allocated high-water mark disagrees with physical length`);
    let c2 = (e3, t3) => {
      (!Number.isSafeInteger(e3) || e3 < 1) && i2(`null or invalid word pointer`);
      let n3 = 12 + 4 * (e3 - 1);
      return (!Number.isSafeInteger(t3) || t3 < 0 || n3 + t3 > s2) && i2(`pointer outside allocation`), n3;
    }, l2 = [{ start: 0, end: Q }], u2 = [];
    for (let e3 = 0; e3 < 328; e3++) {
      let t3 = a2(80 + e3 * 4);
      if (!t3) continue;
      let n3 = c2(t3, $);
      n3 < Q && i2(`directory overlaps fixed header`), l2.push({ start: n3, end: n3 + $ }), u2.push({ group: e3, at: n3 });
    }
    let d2 = [], f2 = 0, p2 = 0;
    for (let e3 of u2) for (let r3 = 0; r3 < 100; r3++) {
      let o3 = e3.at + r3 * 16, s3 = a2(o3), u3 = a2(o3 + 4), m3 = a2(o3 + 8), h2 = a2(o3 + 12);
      if (!s3 && !u3 && !h2 && (m3 === 0 || m3 === 4294967295)) continue;
      (!s3 || !u3 || !m3 || m3 === 4294967295 || !h2 || h2 > m3) && i2(`inconsistent segment directory entry`);
      let g2 = m3 * 4;
      f2 += g2, (g2 > n2.length || f2 > n2.length || f2 > t2) && i2(`logical size exceeds physical source or byte budget`);
      let _2 = [], v2 = /* @__PURE__ */ new Set(), y2 = s3, b2 = 0;
      for (; y2; ) {
        v2.has(y2) && i2(`extent cycle`), v2.add(y2), p2++, p2 > 65536 && i2(`extent traversal budget exceeded`);
        let e4 = c2(y2, 8), t3 = a2(e4), n3 = a2(e4 + 4);
        (!n3 || b2 >= m3) && i2(`invalid capacity or excessive chain`), c2(y2, 8 + n3 * 4), l2.push({ start: e4, end: e4 + 8 + n3 * 4 });
        let r4 = b2 + 1, o4 = Math.min(n3, m3 - b2);
        _2.push({ pointer: y2, headerByte: e4, dataByte: e4 + 8, capacityWords: n3, usedWords: o4, logicalStartWord: r4, next: t3 }), b2 += o4, y2 === u3 ? (t3 !== 0 || r4 !== h2) && i2(`last extent metadata disagrees with chain`) : t3 || i2(`chain ends before declared last extent`), y2 = t3;
      }
      (b2 !== m3 || _2.at(-1)?.pointer !== u3) && i2(`logical size or last extent mismatch`), d2.push({ number: e3.group * 100 + r3 + 1, directoryByte: o3, logicalWords: m3, extents: _2 });
    }
    l2.sort((e3, t3) => e3.start - t3.start || e3.end - t3.end);
    for (let e3 = 1; e3 < l2.length; e3++) l2[e3].start < l2[e3 - 1].end && i2(`overlapping directory, header or extent ranges`);
    d2[0]?.number !== 1 && i2(`required SAV segment 1 is absent`);
    let m2 = d2.map((e3) => {
      let t3 = new Uint8Array(e3.logicalWords * 4);
      for (let r3 of e3.extents) t3.set(n2.subarray(r3.dataByte, r3.dataByte + r3.usedWords * 4), (r3.logicalStartWord - 1) * 4);
      return t3;
    });
    return { signature: `PTI_SFL_`, revision: 1, byteLength: n2.length, allocatedWords: o2, segments: m2, segmentInfo: d2 };
  }
  function ae(e2, t2, n2) {
    if (!Number.isSafeInteger(t2) || !Number.isSafeInteger(n2) || t2 < 0 || n2 < 0 || t2 + n2 > e2.logicalWords * 4) throw Error(`SAV_SFL_INVALID: provenance span outside segment`);
    let r2 = t2 + n2;
    return e2.extents.flatMap((e3) => {
      let n3 = (e3.logicalStartWord - 1) * 4, i2 = Math.max(n3, t2), a2 = Math.min(n3 + e3.usedWords * 4, r2);
      return i2 < a2 ? [{ offset: e3.dataByte + i2 - n3, length: a2 - i2 }] : [];
    });
  }
  let oe = [[`Info`, 3, 36, 0, 0], [`Release`, 0, 1, 0, 30], [`Pntrev`, 0, 0, 0, 30], [`Headre`, 1, 0, 0, 29], [`Headin`, 0, 0, 0, 31], [`Maxary`, 0, 0, 0, 19], [`Headlo`, 4, 0, 0, 30], [`Ihanb`, 3, 120, 0, 0], [`Title`, 3, 1152, 0, 0], [`Numbus`, 0, -1, 0, 0], [`Jcode`, 0, -1, 0, 0], [`Volt`, 5, -1, 44, 30], [`Dblvlt`, 6, -1, 14, 30], [`Nvlmhi`, 1, -1, 0, 28], [`Evlmlo`, 1, -1, 0, 28], [`Evlmhi`, 1, -1, 0, 28], [`Nvlmlo`, 1, -1, 0, 28], [`Bsectns`, 0, -1, 0, 29], [`Sectnum`, 0, -1, 36, 30], [`Origbus`, 0, -1, 0, 29], [`Ldfrst`, 0, -1, 1, 16], [`Ldnext`, 0, -19, 1, 16], [`Cfdlfr`, 5, -21, 1, 16], [`Ldstat`, 0, -19, 1, 16], [`Ldarea`, 0, -19, 1, 16], [`Ldzone`, 0, -19, 1, 16], [`Ldownr`, 0, -19, 1, 18], [`Loadid`, 3, -20, 1, 16], [`Ldconf`, 3, -19, 1, 27], [`Ldintr`, 3, -19, 1, 28], [`Cdgnfr`, 5, -19, 1, 29], [`Ldgnfl`, 0, -19, 1, 29], [`Ildtype`, 0, -19, 1, 31], [`Ldname`, 3, -131, 1, 31], [`Ldnmord`, 0, -19, 1, 31], [`Shfrst`, 0, -1, 29, 26], [`Shnext`, 0, -83, 29, 26], [`Shstat`, 0, -83, 29, 26], [`Shntgb`, 5, -83, 29, 26], [`Shntid`, 3, -84, 29, 26], [`Shnnam`, 3, -140, 29, 31], [`Shnmord`, 0, -83, 29, 31], [`Busnam`, 3, -74, 0, 24], [`Basvlt`, 1, -1, 0, 0], [`Iarea`, 0, -1, 0, 0], [`Loszon`, 0, -1, 0, 0], [`Iowner`, 0, -1, 0, 18], [`Busord`, 0, -1, 0, 0], [`Alford`, 0, -1, 0, 0], [`Ordalf`, 0, -1, 0, 0], [`Busext`, 0, -1, 0, 0], [`Busint`, 0, -1, 0, 0], [`Bslist`, 0, -1, 2, 0], [`Bsthrd`, 0, -1, 2, 0], [`Genbus`, 0, -1, 0, 0], [`Pgen`, 1, -4, 0, 0], [`Qgen`, 1, -4, 0, 0], [`Qmax`, 1, -4, 0, 0], [`Qmin`, 1, -4, 0, 0], [`Vsave`, 1, -4, 0, 0], [`Regbus`, 0, -4, 0, 0], [`Regnod`, 0, -4, 0, 30], [`Rempct`, 1, -4, 0, 0], [`Mcfrst`, 0, -4, 0, 0], [`Mcnext`, 0, -5, 0, 0], [`Mxstat`, 0, -5, 0, 0], [`Pgenmc`, 1, -5, 0, 0], [`Qgenmc`, 1, -5, 0, 0], [`Qmaxmc`, 1, -5, 0, 0], [`Qminmc`, 1, -5, 0, 0], [`Mbase`, 1, -5, 0, 0], [`Zsorce`, 5, -5, 0, 0], [`Xtran`, 5, -5, 0, 0], [`Gentap`, 1, -5, 0, 0], [`Isorce`, 5, -5, 0, 0], [`Machid`, 3, -6, 0, 18], [`Pmaxmc`, 1, -5, 0, 0], [`Pminmc`, 1, -5, 0, 0], [`Mcofst`, 0, -5, 0, 18], [`Mconxt`, 0, -27, 0, 18], [`Mconum`, 0, -27, 0, 18], [`Mcopct`, 1, -27, 0, 18], [`Basflg`, 0, -5, 0, 30], [`Wndnum`, 0, -5, 30, 26], [`Wndmod`, 0, -85, 30, 26], [`Wndpf`, 1, -85, 30, 26], [`Mcname`, 3, -133, 0, 31], [`Mcnmord`, 0, -5, 0, 31], [`Imfrst`, 0, -1, 31, 28], [`Imnext`, 0, -90, 31, 28], [`Imbits`, 0, -90, 31, 28], [`Imarea`, 0, -90, 31, 28], [`Imzone`, 0, -90, 31, 28], [`Imwonr`, 1, -90, 31, 28], [`Imbase`, 1, -90, 31, 28], [`Imratv`, 1, -90, 31, 28], [`Imsetp`, 1, -90, 31, 28], [`Imra`, 1, -90, 31, 28], [`Imxa`, 1, -90, 31, 28], [`Imxm`, 1, -90, 31, 28], [`Imr1`, 1, -90, 31, 28], [`Imx1`, 1, -90, 31, 28], [`Imr2`, 1, -90, 31, 28], [`Imx2`, 1, -90, 31, 28], [`Imx3`, 1, -90, 31, 28], [`Ime1`, 1, -90, 31, 28], [`Imse1`, 1, -90, 31, 28], [`Ime2`, 1, -90, 31, 28], [`Imse2`, 1, -90, 31, 28], [`Imia1`, 1, -90, 31, 28], [`Imia2`, 1, -90, 31, 28], [`Immult`, 1, -90, 31, 28], [`Imtrqa`, 1, -90, 31, 28], [`Imtrqb`, 1, -90, 31, 28], [`Imtrqd`, 1, -90, 31, 28], [`Imtrqe`, 1, -90, 31, 28], [`Imh`, 1, -90, 31, 28], [`Impac`, 1, -90, 31, 28], [`Imqac`, 1, -90, 31, 28], [`Imslip`, 1, -90, 31, 28], [`Imzsrc`, 5, -90, 31, 28], [`Imisrc`, 5, -90, 31, 28], [`Imacid`, 3, -91, 31, 28], [`Imname`, 3, -132, 31, 31], [`Immnord`, 0, -90, 31, 31], [`Swdratnam`, 3, -99, 0, 31], [`Swdrattyp`, 0, -141, 0, 31], [`Swdratunt`, 3, -135, 0, 31], [`Swdratdesc`, 3, -100, 0, 31], [`Rsetname`, 3, -138, 48, 31], [`Swdrate`, 1, -137, 48, 31], [`Rsetdesc`, 3, -139, 48, 31], [`Swdrattblord`, 0, -136, 48, 31], [`Ifirst`, 0, -1, 0, 0], [`Ito`, 0, -7, 0, 0], [`Inext`, 0, -7, 0, 0], [`Icom`, 0, -7, 0, 0], [`Bypass`, 0, -7, 0, 31], [`Numckt`, 3, -8, 0, 0], [`Kfirst`, 0, -1, 0, 0], [`Kto`, 0, -8, 0, 0], [`Knext`, 0, -8, 0, 0], [`Knum`, 0, -8, 0, 0], [`Gb`, 5, -7, 0, 0], [`B2s`, 1, -7, 0, 0], [`Gbline`, 5, -8, 0, 0], [`Imeter`, 0, -7, 0, 0], [`Brname`, 3, -98, 0, 29], [`Bnmord`, 0, -7, 0, 29], [`Ratnam`, 3, -99, 0, 29], [`Ratdesc`, 3, -100, 0, 29], [`Ratselector`, 0, 1, 0, 29], [`Ratings`, 1, -101, 0, 29], [`Linlen`, 1, -7, 0, 16], [`Lnofst`, 0, -7, 0, 18], [`Lnonxt`, 0, -28, 0, 18], [`Lnonum`, 0, -28, 0, 18], [`Lnopct`, 1, -28, 0, 18], [`Tapno`, 0, -7, 0, 0], [`Iocode`, 0, -9, 0, 21], [`Windrp`, 1, -9, 0, 21], [`Windrs`, 1, -9, 0, 21], [`Psangl`, 1, -9, 0, 21], [`Nomvp`, 1, -9, 0, 21], [`Nomvs`, 1, -9, 0, 21], [`Trnbas`, 1, -9, 0, 21], [`Trname`, 3, 1, 36, 29], [`Tablno`, 0, -9, 0, 0], [`Ntbpnt`, 0, -26, 43, 29], [`Phshtb`, 4, -26, 43, 29], [`ZCorTbl%T`, 1, -117, 43, 29], [`ZCorTbl%F`, 5, -117, 43, 29], [`Gbtran`, 5, -9, 0, 0], [`Tpnabl`, 0, -9, 0, 9], [`Pqcont`, 0, -9, 0, 0], [`Pqcnod`, 0, -9, 0, 30], [`Vmax`, 1, -9, 0, 0], [`Vmin`, 1, -9, 0, 0], [`Rmax`, 1, -9, 0, 0], [`Rmin`, 1, -9, 0, 0], [`Psalfa`, 1, -9, 0, 27], [`Ntapos`, 0, -9, 0, 21], [`Xfrcmp`, 5, -9, 0, 14], [`Vg2idx`, 0, -9, 0, 28], [`Indx3w`, 0, -9, 45, 30], [`Bus3wt`, 0, -51, 45, 21], [`Icm3wt`, 0, -49, 45, 21], [`Nmtr3w`, 0, -49, 45, 21], [`Ckt3wt`, 3, -50, 45, 21], [`Nam3wt`, 3, -118, 45, 29], [`Vg3idx`, 0, -49, 45, 28], [`Vg3nam`, 3, -124, 45, 30], [`Fcstat`, 0, -43, 3, 19], [`Vmxmod`, 0, -43, 3, 19], [`Fcsbus`, 0, -43, 3, 19], [`Fctbus`, 0, -43, 3, 19], [`Fcownr`, 0, -43, 3, 19], [`Fcrem`, 0, -43, 3, 26], [`Fcordr`, 0, -43, 3, 26], [`Fcnode`, 0, -43, 3, 30], [`Fpbrdg`, 1, -43, 3, 19], [`Fqshnt`, 1, -43, 3, 19], [`Fpsend`, 1, -43, 3, 19], [`Fqsend`, 1, -43, 3, 19], [`Fpterm`, 1, -43, 3, 19], [`Fqterm`, 1, -43, 3, 19], [`Fcacc`, 1, -43, 3, 19], [`Oldlta`, 1, -43, 3, 19], [`Olderr`, 1, -43, 3, 19], [`Fcpdes`, 1, -43, 3, 19], [`Fcqdes`, 1, -43, 3, 19], [`Fcvset`, 1, -43, 3, 19], [`Fcvtmx`, 1, -43, 3, 19], [`Fcvtmn`, 1, -43, 3, 19], [`Trsfmx`, 1, -43, 3, 19], [`Fcshmx`, 1, -43, 3, 19], [`Fcvmx`, 1, -43, 3, 19], [`Fcimx`, 1, -43, 3, 19], [`Bseres`, 1, -43, 3, 19], [`Fcpct`, 1, -43, 3, 24], [`Fcname`, 3, -86, 3, 26], [`Fcipnm`, 3, -86, 3, 26], [`Ipr`, 0, -31, 4, 18], [`Ipi`, 0, -31, 4, 18], [`Mdc`, 0, -31, 4, 18], [`Nbr`, 0, -31, 4, 18], [`Nbi`, 0, -31, 4, 18], [`Dcmetr`, 0, -31, 4, 18], [`Combsr`, 0, -31, 4, 18], [`Combsi`, 0, -31, 4, 18], [`Comndr`, 0, -31, 4, 30], [`Comndi`, 0, -31, 4, 30], [`Acfrr`, 0, -31, 4, 18], [`Actor`, 0, -31, 4, 18], [`Acfri`, 0, -31, 4, 18], [`Actoi`, 0, -31, 4, 18], [`Cccitmax`, 0, -31, 4, 19], [`Dc2ord`, 0, -31, 4, 26], [`Pacr`, 1, -31, 4, 18], [`Qacr`, 1, -31, 4, 18], [`Paci`, 1, -31, 4, 18], [`Qaci`, 1, -31, 4, 18], [`Alfa`, 1, -31, 4, 18], [`Gama`, 1, -31, 4, 18], [`Tapr`, 1, -31, 4, 18], [`Tapi`, 1, -31, 4, 18], [`Vdcr`, 1, -31, 4, 18], [`Vdci`, 1, -31, 4, 18], [`Dc`, 1, -31, 4, 18], [`Setval`, 1, -31, 4, 18], [`Rdc`, 1, -31, 4, 18], [`Rcomp`, 1, -31, 4, 18], [`Vsched`, 1, -31, 4, 18], [`Vcmode`, 1, -31, 4, 18], [`Delti`, 1, -31, 4, 18], [`Alfmin`, 1, -31, 4, 18], [`Alfmx`, 1, -31, 4, 18], [`Gammin`, 1, -31, 4, 18], [`Gammx`, 1, -31, 4, 18], [`Xcrr`, 1, -31, 4, 18], [`Xcir`, 1, -31, 4, 18], [`Ebaser`, 1, -31, 4, 18], [`Ebasei`, 1, -31, 4, 18], [`Trr`, 1, -31, 4, 18], [`Tri`, 1, -31, 4, 18], [`Tapmxr`, 1, -31, 4, 18], [`Tapmnr`, 1, -31, 4, 18], [`Tstpr`, 1, -31, 4, 18], [`Tapmxi`, 1, -31, 4, 18], [`Tapmni`, 1, -31, 4, 18], [`Tstpi`, 1, -31, 4, 18], [`Rcr`, 1, -31, 4, 18], [`Rci`, 1, -31, 4, 18], [`Dcvmin`, 1, -31, 4, 18], [`Xcapr`, 1, -31, 4, 19], [`Xcapi`, 1, -31, 4, 19], [`Cccacc`, 1, -31, 4, 19], [`Acidr`, 3, -32, 4, 17], [`Acidi`, 3, -32, 4, 17], [`Dc2nam`, 3, -45, 4, 26], [`Vscmdc,...`, 0, -71, 28, 23], [`Vscidc,...`, 1, -71, 28, 23], [`Vscnam`, 3, -81, 28, 24], [`Vsccnv,...`, 0, -130, 28, 30], [`Vscpac,...`, 1, -73, 28, 23], [`Nconv,...`, 0, -87, 5, 26], [`Dcmswv`, 1, -33, 5, 18], [`Mdcnam`, 3, -88, 5, 26], [`Pac,...`, 1, -35, 5, 18], [`Acbus,...`, 0, -36, 5, 18], [`Vdc,...`, 1, -37, 5, 18], [`Dcarea,...`, 0, -38, 5, 18], [`Dcname`, 3, -77, 5, 24], [`Dcres,...`, 1, -40, 5, 18], [`Dcfr,...`, 0, -41, 5, 18], [`Dcckt`, 3, -42, 5, 0], [`Swfrst`, 0, -1, 6, 0], [`Swnext`, 0, -10, 6, 30], [`Swshid`, 3, -125, 6, 30], [`Swshmd`, 0, -10, 6, 0], [`Bswich`, 1, -10, 6, 0], [`Vshnhi`, 1, -10, 6, 0], [`Vshnlo`, 1, -10, 6, 0], [`Swshrm`, 0, -10, 6, 0], [`Swsnod`, 0, -10, 6, 30], [`Swspct`, 1, -10, 6, 24], [`Rmindx`, 0, -10, 6, 23], [`Nswstp`, 0, -11, 6, 0], [`Swshnb`, 1, -11, 6, 0], [`Swshnm`, 3, -134, 6, 31], [`Shswmord`, 0, -10, 6, 31], [`Bswicz`, 1, -10, 13, 13], [`Swshnz`, 1, -11, 13, 13], [`Areord`, 0, -22, 0, 27], [`Numare`, 0, -22, 0, 27], [`Ownord`, 0, -29, 0, 27], [`Numown`, 0, -29, 0, 27], [`Zonord`, 0, -24, 0, 27], [`Numzon`, 0, -24, 0, 27], [`Iswing`, 0, -22, 0, 0], [`Desint`, 1, -22, 0, 17], [`Destol`, 1, -22, 0, 17], [`Arnam`, 3, -78, 0, 24], [`Zoname`, 3, -79, 0, 24], [`Owname`, 3, -80, 0, 24], [`Inarea`, 0, -22, 0, 18], [`Inzone`, 0, -24, 0, 18], [`Inownr`, 0, -29, 0, 18], [`Zernum`, 0, -7, 2, 0], [`Zflow`, 5, -12, 2, 0], [`Mulbus`, 0, -1, 7, 11], [`Mulsec`, 0, -7, 7, 11], [`Msfrom`, 0, -15, 7, 11], [`Msto`, 0, -15, 7, 11], [`Msfrst`, 0, -15, 7, 11], [`Mslast`, 0, -15, 7, 11], [`Sectto`, 0, -16, 7, 11], [`Sectkf`, 0, -16, 7, 11], [`Mslnid`, 3, -15, 7, 11], [`Secckt`, 3, -17, 7, 11], [`Msmetr`, 0, -15, 7, 12], [`Arfrom`, 0, -18, 8, 13], [`Arto`, 0, -18, 8, 13], [`Ptran`, 1, -18, 8, 13], [`Tranid`, 3, -18, 8, 13], [`Vdname`, 3, -143, 49, 31], [`Vdorder`, 0, -142, 49, 31], [`Vdqdb`, 1, -142, 49, 31], [`Vdqmaxraw`, 1, -142, 49, 31], [`Vdqminraw`, 1, -142, 49, 31], [`Vdvlowraw`, 1, -142, 49, 31], [`Vddbloraw`, 1, -142, 49, 31], [`Vddbhiraw`, 1, -142, 49, 31], [`Vdvhiraw`, 1, -142, 49, 31], [`Vdstatusraw`, 0, -142, 49, 31], [`Vdregbus`, 0, -142, 49, 31], [`Machdrpcurve`, 0, -5, 0, 31], [`Ldtypename`, 3, -145, 50, 31], [`Ldtypedes`, 3, -146, 50, 31], [`Inldtype`, 0, -144, 50, 31], [`Ldtypeord`, 0, -144, 50, 31], [`Intername`, 3, -149, 51, 31], [`Internumber`, 0, -147, 51, 31], [`Intertype`, 0, -147, 51, 31], [`Internameord`, 0, -147, 51, 31], [`Internmbrord`, 0, -147, 51, 31], [`Interfirst`, 0, -147, 51, 31], [`Interratemax`, 0, -148, 51, 31], [`Interratemin`, 0, -148, 51, 31], [`Internext`, 0, -150, 52, 31], [`Inteletype`, 0, -150, 52, 31], [`Intelekf`, 0, -150, 52, 31], [`Inteletoarea`, 0, -150, 52, 31], [`Inteledirect`, 0, -150, 52, 31], [`Intelemeter`, 0, -150, 52, 31], [`Inteleweight`, 1, -150, 52, 31], [`Grpos`, 1, -5, 10, 28], [`Gxsubt`, 1, -5, 10, 28], [`Gxtrns`, 1, -5, 10, 28], [`Gxsync`, 1, -5, 10, 28], [`Zsneg`, 5, -5, 10, 0], [`Zszero`, 5, -5, 10, 0], [`Gxgrnd`, 5, -5, 10, 28], [`Ggrcod`, 3, -5, 10, 28], [`Grfdeg`, 1, -5, 10, 29], [`Loadn`, 5, -19, 10, 28], [`Loadz`, 5, -19, 10, 28], [`Lgrcod`, 3, -19, 10, 28], [`Shntzr`, 5, -83, 10, 26], [`Cnxcod`, 0, -9, 10, 0], [`Zgrnd0`, 5, -82, 10, 24], [`Zsere0`, 5, -82, 10, 28], [`Zntrl0`, 5, -9, 10, 28], [`Cnx3wt`, 0, -49, 33, 21], [`Zgrnd3`, 5, -97, 33, 28], [`Zsere3`, 5, -97, 33, 28], [`Zntrl3`, 5, -49, 33, 28], [`Iml2ra`, 1, -90, 32, 28], [`Inrtox`, 1, -90, 32, 28], [`Iml2ra_trn`, 1, -90, 32, 28], [`Inrtox_trn`, 1, -90, 32, 28], [`Iml2ra_neg`, 1, -90, 32, 28], [`Inrtox_neg`, 1, -90, 32, 28], [`Imzzer`, 5, -90, 32, 28], [`Imzgrn`, 5, -90, 32, 28], [`Ickt1`, 3, -14, 11, 0], [`Ickt2`, 3, -14, 11, 0], [`Imbus`, 0, -13, 11, 0], [`Jmbus`, 0, -13, 11, 0], [`Kmbus`, 0, -13, 11, 0], [`Lmbus`, 0, -13, 11, 0], [`Bmut`, 5, -13, 11, 0], [`Bi1`, 1, -13, 11, 0], [`Bi2`, 1, -13, 11, 0], [`Bk1`, 1, -13, 11, 14], [`Bk2`, 1, -13, 11, 14], [`Zflpos`, 5, 1, 36, 27], [`Zflneg`, 5, 1, 36, 27], [`Zflzer`, 5, 1, 36, 27], [`Gbz`, 5, -7, 10, 0], [`B2sz`, 1, -7, 10, 0], [`Gbzlin`, 5, -8, 10, 0], [`Movcur`, 1, -7, 10, 28], [`Sctypf`, 3, -7, 10, 28], [`Brknum`, 0, -1, 34, 28], [`Brbits`, 0, -92, 34, 28], [`Brint`, 1, -92, 34, 28], [`Brrate`, 1, -92, 34, 28], [`Brmomr`, 1, -92, 34, 28], [`Brprtm`, 1, -93, 34, 28], [`Brid`, 3, -93, 34, 28], [`Brnam`, 3, -94, 34, 28], [`Nctpak`, 0, -95, 35, 31], [`Nctord`, 0, -95, 35, 31], [`Ncttblnam`, 3, -151, 35, 31], [`Ncstbltimorv`, 1, -152, 35, 31], [`Ncstblipiq`, 5, -152, 35, 31], [`Mtemp`, 4, 1, 35, 31], [`Ncmtyp`, 0, -5, 53, 31], [`Ptemp`, 4, 1, 53, 31], [`Ncmpos`, 0, -5, 54, 31], [`Ntemp`, 4, 1, 53, 31], [`Ncmneg`, 0, -5, 55, 31], [`Ncmimx`, 1, -5, 53, 31], [`Ncmvmi`, 1, -5, 53, 31], [`Ncmvmx`, 1, -5, 53, 31], [`Oldblvlt`, 6, 1, 36, 30], [`Ophdre`, 1, 0, 15, 20], [`Ophdin`, 0, 0, 15, 18], [`Ophdlo`, 4, 0, 15, 20], [`Bvmax`, 1, -1, 15, 18], [`Bvmin`, 1, -1, 15, 18], [`Bvmxe`, 1, -1, 15, 18], [`Bvmne`, 1, -1, 15, 18], [`Lmvtyp`, 0, -1, 15, 18], [`Rhslv`, 1, -1, 15, 18], [`Bvar`, 0, -1, 15, 18], [`Vrnext`, 0, -53, 16, 18], [`Varid`, 3, -89, 16, 26], [`Varadd`, 1, -53, 16, 18], [`Varmax`, 1, -53, 16, 18], [`Varmin`, 1, -53, 16, 18], [`Varcst`, 1, -53, 16, 18], [`Vrcstp`, 0, -53, 16, 18], [`Varst`, 0, -53, 16, 18], [`Vrcstb`, 0, -53, 16, 18], [`Bsldtb`, 0, -19, 17, 18], [`Ebsltb`, 0, -54, 18, 18], [`Ldmult`, 1, -54, 18, 18], [`Ldmaxm`, 1, -54, 18, 18], [`Ldminm`, 1, -54, 18, 18], [`Ldratm`, 1, -54, 18, 18], [`Mxratm`, 1, -54, 18, 18], [`Mnratm`, 1, -54, 18, 18], [`Ldcst`, 1, -54, 18, 18], [`Ldcstp`, 0, -54, 18, 18], [`Ldtbst`, 0, -54, 18, 18], [`Ldcstb`, 0, -54, 18, 18], [`Dispch`, 1, -5, 15, 18], [`Gentbl`, 0, -5, 15, 18], [`Epgtb`, 0, -55, 19, 18], [`Mxpdsp`, 1, -55, 19, 18], [`Mnpdsp`, 1, -55, 19, 18], [`Pgncst`, 1, -55, 19, 18], [`Pgcstp`, 0, -55, 19, 18], [`Pgnst`, 0, -55, 19, 18], [`Pgcstb`, 0, -55, 19, 18], [`Mcnptr`, 0, -56, 20, 18], [`Rtramp`, 1, -56, 20, 18], [`Rtcapa`, 1, -56, 20, 18], [`Rcmac`, 0, -57, 21, 18], [`Xdsyn`, 1, -57, 21, 18], [`Ismax`, 1, -57, 21, 18], [`Rpflg`, 1, -57, 21, 18], [`Rpfle`, 1, -57, 21, 18], [`Qmax0`, 1, -57, 21, 18], [`Rcstat`, 0, -57, 21, 18], [`Brlin`, 0, -58, 22, 18], [`Rctmlt`, 1, -58, 22, 18], [`Mxrctm`, 1, -58, 22, 18], [`Mnrctm`, 1, -58, 22, 18], [`Brncst`, 1, -58, 22, 18], [`Brcstp`, 0, -58, 22, 18], [`Brnst`, 0, -58, 22, 18], [`Brcstb`, 0, -58, 22, 18], [`Tblnum`, 0, -59, 23, 18], [`Tbltyp`, 0, -59, 23, 18], [`Tbllbl`, 3, -60, 23, 18], [`Tblcst`, 1, -59, 23, 18], [`Numprs`, 0, -59, 23, 18], [`Tblptr`, 0, -59, 23, 18], [`Tblprs`, 5, -61, 23, 18], [`Rtlimt`, 1, -70, 15, 18], [`Period`, 1, -70, 15, 18], [`Rsts`, 0, -70, 15, 18], [`Rsfrst`, 0, -70, 15, 18], [`Rsnext`, 0, -62, 15, 18], [`Rsvunt`, 0, -62, 15, 18], [`Bfllin`, 0, -63, 24, 18], [`Brflid`, 3, -63, 24, 18], [`Nmflmx`, 1, -63, 24, 18], [`Nmflmn`, 1, -63, 24, 18], [`Emrlmx`, 1, -63, 24, 18], [`Emflmn`, 1, -63, 24, 18], [`Flwtyp`, 0, -63, 24, 18], [`Fllmtp`, 0, -63, 24, 18], [`Flslv`, 1, -63, 24, 18], [`Inflid`, 0, -64, 25, 18], [`Intlbl`, 3, -65, 25, 18], [`Intfmx`, 1, -64, 25, 18], [`Intfmn`, 1, -64, 25, 18], [`Ifltyp`, 0, -64, 25, 18], [`Ifllmt`, 0, -64, 25, 18], [`Intfsl`, 0, -64, 25, 18], [`Intptr`, 0, -64, 25, 18], [`Intnxt`, 0, -66, 25, 18], [`Infbrn`, 0, -66, 25, 18], [`Ceqnid`, 0, -67, 26, 18], [`Eqnlbl`, 3, -68, 26, 18], [`Cslkmx`, 1, -67, 26, 18], [`Cslkmn`, 1, -67, 26, 18], [`Eqnptr`, 0, -67, 26, 18], [`Eqnnxt`, 0, -69, 26, 18], [`Eqntyp`, 0, -69, 26, 18], [`Eqnseq`, 0, -69, 26, 18], [`Coeffc`, 1, -69, 26, 18], [`Dcflmx`, 1, -31, 27, 21], [`Dcflmn`, 1, -31, 27, 21], [`Dcvtmx`, 1, -31, 27, 21], [`Dcvtmn`, 1, -31, 27, 21], [`Brnominalx`, 1, -58, 22, 21], [`Orgjcode`, 0, -1, 0, 30], [`Orgicom`, 0, -7, 0, 30], [`Orgvscmdc`, 0, -128, 0, 30], [`Orgvsctyp`, 0, -126, 0, 30], [`Orgmdc`, 0, -31, 0, 30], [`Orgdcmode`, 0, -33, 0, 30], [`Orgfcstat`, 0, -43, 0, 30], [`Stsnam`, 3, -107, 39, 29], [`Stsnum`, 0, -102, 39, 29], [`Stsord`, 0, -102, 39, 29], [`Instas`, 0, -102, 39, 29], [`Stslon`, 1, -102, 39, 29], [`Stslat`, 1, -102, 39, 29], [`Stsgrd`, 1, -102, 39, 29], [`Salford`, 0, -102, 39, 29], [`Sordalf`, 0, -102, 39, 29], [`Stsbfs`, 0, -102, 39, 29], [`Stsbnx`, 0, -1, 39, 29], [`Bussts`, 0, -1, 39, 29], [`Nodnam`, 3, -108, 40, 29], [`Nodnum`, 0, -103, 40, 29], [`Nodbus`, 0, -103, 40, 29], [`Nodcod`, 0, -103, 40, 29], [`Nodsta`, 0, -103, 40, 29], [`Bsndfs`, 0, -1, 40, 29], [`Bsndnx`, 0, -103, 40, 29], [`Ndtmfs`, 0, -103, 40, 29], [`Ndtmnx`, 0, -106, 40, 29], [`Ndtmtyp`, 0, -106, 40, 29], [`Ndtmseq`, 0, -106, 40, 29], [`Brchnf`, 0, -7, 40, 29], [`Brchnt`, 0, -7, 40, 29], [`Machtm`, 0, -5, 40, 29], [`Loadtm`, 0, -19, 40, 29], [`Shnttm`, 0, -83, 40, 29], [`Swshtm`, 0, -10, 40, 29], [`Bvartm`, 0, -83, 40, 30], [`Indmtm`, 0, -90, 40, 30], [`Dcrctm`, 0, -31, 40, 30], [`Dcintm`, 0, -31, 40, 30], [`Vscdtm`, 0, -126, 40, 30], [`Facstm`, 0, -43, 40, 30], [`Facttm`, 0, -43, 40, 30], [`Ntdctm`, 0, -113, 40, 30], [`Brknam`, 3, -109, 41, 29], [`Brktyp`, 0, -104, 41, 29], [`Brknst`, 0, -104, 41, 29], [`Brkno`, 0, -7, 41, 29], [`Brkrsetnum`, 0, -104, 41, 31], [`Brkckt`, 3, -110, 42, 29], [`Brkcom`, 0, -105, 42, 29], [`Ibrkno`, 0, -105, 42, 29], [`Bkrate`, 1, 1, 36, 31], [`Brkrac`, 1, -105, 42, 29], [`Ndsfst`, 0, -103, 42, 29], [`Ndsnxt`, 0, -105, 42, 29], [`Ndsto`, 0, -105, 42, 29], [`Ndfrst`, 0, -103, 42, 29], [`Ndnext`, 0, -110, 42, 29], [`Ndto`, 0, -110, 42, 29], [`Ndnum`, 0, -110, 42, 29], [`gntrms`, 0, -122, 38, 29], [`gnstat`, 0, -112, 38, 27], [`gnownr`, 0, -112, 38, 27], [`gnnmtr`, 0, -112, 38, 27], [`gnord`, 0, -112, 38, 27], [`gnname`, 3, -114, 38, 27], [`gnmodl`, 3, -115, 38, 27], [`gnysav`, 5, -123, 38, 29], [`gndatasize`, 0, -127, 38, 27]];
  function se(e2, t2, n2, r2) {
    switch (e2) {
      case -151:
        return t2[44] * 4 + t2[44] * 4 * 2 + 0;
      case -150:
        return t2[67];
      case -149:
        return t2[66] * 8 + t2[66] * 8 * 4 + 0;
      case -148:
        return t2[66] * 4 + t2[66] * 4 * 2 + 0;
      case -147:
        return t2[66];
      case -146:
        return t2[65] * 8 + t2[65] * 8 * 8 + 0;
      case -145:
        return t2[65] * 4 + t2[65] * 4 * 2 + 0;
      case -144:
        return t2[65];
      case -143:
        return t2[69] * 8 + t2[69] * 8 * 4 + 0;
      case -142:
        return t2[69];
      case -141:
        return 12;
      case -140:
        return t2[34] * 8 + t2[34] * 8 * 4 + 0;
      case -138:
        return t2[68] * 8 + t2[68] * 8 * 4 + 0;
      case -137:
        return t2[68] * 4 + t2[68] * 4 * 2 + 0;
      case -136:
        return t2[68];
      case -135:
        return 36;
      case -134:
        return t2[5] * 8 + t2[5] * 8 * 4 + 0;
      case -133:
        return t2[2] * 8 + t2[2] * 8 * 4 + 0;
      case -132:
        return t2[38] * 8 + t2[38] * 8 * 4 + 0;
      case -131:
        return t2[26] * 8 + t2[26] * 8 * 4 + 0;
      case -130:
        return t2[31] + t2[31] + (t2[31] + t2[31]) * 4 + 0;
      case -129:
        return t2[26] * 4 + t2[26] * 4 * 2 + 0;
      case -128:
        return t2[31];
      case -127:
        return 0;
      case -126:
        return t2[31] + t2[31];
      case -125:
        return t2[5] + t2[5];
      case -123:
        return t2[39] * 4 + t2[39] * 4 * 8 + 0;
      case -122:
        return t2[39] + t2[39] + (t2[39] + t2[39]) * 2 + 0;
      case -121:
        return t2[39] * 4;
      case -120:
        return t2[39] + t2[39];
      case -119:
        return t2[2] + t2[2] + (t2[2] + t2[2]) * 2 + 0;
      case -118:
        return t2[30] * 8 + t2[30] * 8 * 4 + 0;
      case -116:
        return n2[2] * 8 + n2[2] * 8 * 2 + 0;
      case -115:
        return t2[39] * 16;
      case -114:
        return t2[39] * 4 + t2[39] * 4 * 2 + 0;
      case -113:
        return n2[5] * t2[7];
      case -112:
        return t2[39];
      case -111:
        return t2[47] + t2[47] * 2 + 0;
      case -110:
        return t2[47] + t2[47];
      case -109:
        return t2[48] * 8 + t2[48] * 8 * 4 + 0;
      case -108:
        return t2[46] * 8 + t2[46] * 8 * 4 + 0;
      case -107:
        return t2[45] * 8 + t2[45] * 8 * 4 + 0;
      case -106:
        return t2[49];
      case -105:
        return t2[47];
      case -104:
        return t2[48];
      case -103:
        return t2[46];
      case -102:
        return t2[45];
      case -100:
        return 384;
      case -99:
        return 72;
      case -98:
        return t2[3] * 8 + t2[3] * 8 * 4 + 0;
      case -97:
        return t2[30] + t2[30] * 2 + 0;
      case -96:
        return t2[44] + t2[44];
      case -95:
        return t2[44];
      case -94:
        return t2[43] * 4 + t2[43] * 4 * 2 + 0;
      case -93:
        return t2[43] + t2[43];
      case -92:
        return t2[43];
      case -91:
        return t2[38] + t2[38];
      case -90:
        return t2[38];
      case -89:
        return r2[2] + r2[2];
      case -88:
        return t2[7] * 4 + t2[7] * 4 * 2 + 0;
      case -87:
        return 0 + t2[7] * 8 + 0 - t2[7];
      case -86:
        return t2[29] * 4 + t2[29] * 4 * 2 + 0;
      case -85:
        return t2[33];
      case -84:
        return t2[34] + t2[34];
      case -83:
        return t2[34];
      case -82:
        return t2[4] + t2[4];
      case -81:
        return t2[31] * 4 + t2[31] * 4 * 2 + 0;
      case -80:
        return t2[36] * 4 + t2[36] * 4 * 2 + 0;
      case -79:
        return t2[37] * 4 + t2[37] * 4 * 2 + 0;
      case -78:
        return t2[35] * 4 + t2[35] * 4 * 2 + 0;
      case -77:
        return t2[7] * n2[6] * 4 + t2[7] * n2[6] * 4 * 2 + 0;
      case -76:
        return t2[30] * 4 + t2[30] * 4 * 2 + 0;
      case -75:
        return t2[4] * 4 + t2[4] * 4 * 2 + 0;
      case -74:
        return t2[0] * 4 + t2[0] * 4 * 2 + 0;
      case -73:
        return t2[31] * 32 - (t2[31] + t2[31] * 1 + 0);
      case -72:
        return t2[31] * 8;
      case -71:
        return t2[31] + t2[31] + (t2[31] + t2[31]) * 2 + 0;
      case -70:
        return 15;
      case -69:
        return r2[16];
      case -68:
        return r2[15] * 4 + r2[15] * 4 * 2 + 0;
      case -67:
        return r2[15];
      case -66:
        return r2[14];
      case -65:
        return r2[13] * 32;
      case -64:
        return r2[13];
      case -63:
        return r2[12];
      case -62:
        return r2[11];
      case -61:
        return r2[9];
      case -60:
        return r2[8] * 4 + r2[8] * 4 * 2 + 0;
      case -59:
        return r2[8];
      case -58:
        return r2[7];
      case -57:
        return r2[6];
      case -56:
        return r2[5];
      case -55:
        return r2[4];
      case -54:
        return r2[3];
      case -53:
        return r2[2];
      case -52:
        return t2[30] * 8;
      case -51:
        return t2[30] * 4;
      case -50:
        return t2[30] + t2[30];
      case -49:
        return t2[30];
      case -48:
        return t2[4] * 8;
      case -47:
        return t2[6] * 4;
      case -46:
        return t2[6] * 4 + t2[6] * 4 * 8 + 0;
      case -45:
        return t2[6] * 4 + t2[6] * 4 * 2 + 0;
      case -44:
        return 0 + t2[37] * 8 + 8;
      case -43:
        return t2[29];
      case -42:
        return n2[7] * t2[7];
      case -41:
        return t2[7] * n2[7] + t2[7] * n2[7] * 2 + 0;
      case -40:
        return t2[7] * n2[7] + t2[7] * n2[7];
      case -39:
        return t2[7] * n2[6] * 8;
      case -38:
        return t2[7] * n2[6] + t2[7] * n2[6] * 2 + 0;
      case -37:
        return t2[7] * n2[6] + t2[7] * n2[6];
      case -36:
        return t2[7] * n2[5] + t2[7] * n2[5] * 4 + 0;
      case -35:
        return t2[7] * n2[5] * 16 + t2[7] * n2[5];
      case -34:
        return t2[7] + t2[7] + (t2[7] + t2[7]) * 2 + 0;
      case -33:
        return t2[7];
      case -32:
        return t2[6] + t2[6];
      case -31:
        return t2[6];
      case -30:
        return t2[36] * 8;
      case -29:
        return t2[36];
      case -28:
        return t2[28];
      case -27:
        return t2[27];
      case -26:
        return n2[2];
      case -25:
        return t2[37] * 8;
      case -24:
        return t2[37];
      case -23:
        return t2[35] * 8;
      case -22:
        return t2[35];
      case -21:
        return t2[26] + t2[26] * 2 + 0;
      case -20:
        return t2[26] + t2[26];
      case -19:
        return t2[26];
      case -18:
        return t2[25];
      case -17:
        return t2[24] + t2[24];
      case -16:
        return t2[24];
      case -15:
        return t2[23];
      case -14:
        return t2[9] + t2[9];
      case -13:
        return t2[9];
      case -12:
        return t2[8];
      case -11:
        return t2[5] * 8;
      case -10:
        return t2[5];
      case -9:
        return t2[4];
      case -8:
        return t2[3] + t2[3];
      case -7:
        return t2[3];
      case -6:
        return t2[2] + t2[2];
      case -5:
        return t2[2];
      case -4:
        return t2[1];
      case -3:
        return t2[0] * 8;
      case -2:
        return t2[0] + t2[0] + (t2[0] + t2[0]) * 2 + 0;
      case -1:
        return t2[0];
      default:
        throw Error(`SAV_UNSUPPORTED_DIMENSION: ${e2}`);
    }
  }
  function ce(e2, t2, n2, r2, i2, a2) {
    switch (e2) {
      case 0:
        return true;
      case 1:
        return t2[26] > 0;
      case 2:
        return t2[8] > 0;
      case 3:
        return t2[29] > 0;
      case 4:
        return t2[6] > 0;
      case 5:
        return t2[7] > 0;
      case 6:
        return t2[5] > 0;
      case 7:
        return t2[23] > 0;
      case 8:
        return t2[25] > 0;
      case 9:
        return n2[7] != 0;
      case 10:
        return n2[0] != 0;
      case 11:
        return n2[0] != 0 && t2[9] > 0;
      case 12:
        return n2[0] != 0 && t2[8] > 0;
      case 13:
        return n2[0] != 0 && t2[5] > 0;
      case 14:
        return n2[16] != 0;
      case 15:
        return n2[7] != 0;
      case 16:
        return n2[7] != 0 && r2[2] > 0;
      case 17:
        return n2[7] != 0 && t2[26] > 0;
      case 18:
        return n2[7] != 0 && r2[3] > 0;
      case 19:
        return n2[7] != 0 && r2[4] > 0;
      case 20:
        return n2[7] != 0 && r2[5] > 0;
      case 21:
        return n2[7] != 0 && r2[6] > 0;
      case 22:
        return n2[7] != 0 && r2[7] > 0;
      case 23:
        return n2[7] != 0 && r2[8] > 0;
      case 24:
        return n2[7] != 0 && r2[12] > 0;
      case 25:
        return n2[7] != 0 && r2[13] > 0;
      case 26:
        return n2[7] != 0 && r2[15] > 0;
      case 27:
        return n2[7] != 0 && t2[6] > 0;
      case 28:
        return t2[31] > 0;
      case 29:
        return t2[34] > 0;
      case 30:
        return t2[33] > 0;
      case 31:
        return t2[38] > 0;
      case 32:
        return n2[0] != 0 && t2[38] > 0;
      case 33:
        return n2[0] != 0 && t2[30] > 0;
      case 34:
        return n2[0] != 0 && t2[43] > 0;
      case 35:
        return n2[0] != 0 && t2[44] > 0;
      case 36:
        return false;
      case 37:
        return n2[7] != 0 && !(r2[2] <= 0);
      case 38:
        return t2[39] > 0;
      case 39:
        return t2[45] > 0;
      case 40:
        return t2[46] > 0;
      case 41:
        return t2[48] > 0;
      case 42:
        return t2[47] > 0;
      case 43:
        return i2[2] > 0;
      case 44:
        return n2[16] == 0;
      case 45:
        return t2[30] > 0;
      case 46:
        return n2[36] != 0;
      case 47:
        return false;
      case 48:
        return t2[68] > 0;
      case 49:
        return t2[69] > 0;
      case 50:
        return t2[65] > 0;
      case 51:
        return t2[66] > 0;
      case 52:
        return !(t2[67] <= 0);
      case 53:
        return n2[0] != 0 && !(t2[44] <= 0) && a2(`Mtemp`) != 0;
      case 54:
        return n2[0] != 0 && !(t2[44] <= 0) && a2(`Mtemp`) != 0 && a2(`Ptemp`) != 0;
      case 55:
        return n2[0] != 0 && !(t2[44] <= 0) && a2(`Mtemp`) != 0 && a2(`Ntemp`) != 0;
      default:
        throw Error(`SAV_UNSUPPORTED_PREDICATE: ${e2}`);
    }
  }
  let le = [`I32`, `F32`, `F64`, `CHAR`, `LOGICAL`, `C64`, `C128`], ue = [4, 4, 8, 1, 4, 8, 16];
  function de(e2) {
    let t2 = ``;
    for (let n2 = 0; n2 < e2.length; n2 += 8192) t2 += String.fromCharCode(...e2.subarray(n2, n2 + 8192));
    return t2;
  }
  function fe(e2) {
    if (e2.byteLength < 40 || e2.byteLength > 536870912) throw Error(`SAV_PAYLOAD_SIZE: missing, truncated or excessive logical stream`);
    let t2 = de(e2.subarray(0, 36));
    if (t2.slice(0, 4) !== `LILL` || !/^\d{2}$/.test(t2.slice(4, 6))) throw Error(`SAV_UNSUPPORTED_REPRESENTATION: expected validated LILL representation`);
    let n2 = Number(t2.slice(4, 6));
    if (n2 !== 31) throw Error(`SAV_UNSUPPORTED_LAYOUT: ${n2}; verified layout is 31`);
    let r2 = new DataView(e2.buffer, e2.byteOffset, e2.byteLength), i2 = /* @__PURE__ */ Object.create(null), a2 = 0, o2 = 0, s2 = [], c2 = [], l2 = [], u2 = [], d2 = (e3) => {
      let t3 = i2[e3]?.values;
      if (!t3) return [];
      if (t3.some((e4) => typeof e4 != `number`)) throw Error(`SAV_INVALID_NUMERIC_ARRAY: ${e3}`);
      return t3;
    }, f2 = (e3) => d2(e3)[0] ?? 0, p2 = (e3, t3, n3) => {
      if (!Number.isFinite(e3)) throw Error(`SAV_NONFINITE: ${t3} at logical byte ${n3}`);
      return e3;
    }, m2 = (t3, n3, r3) => {
      if (!Number.isSafeInteger(t3) || !Number.isSafeInteger(n3) || t3 < 0 || n3 < 0 || t3 > e2.byteLength - n3) throw Error(`SAV_TRUNCATED_ARRAY: ${r3} at logical byte ${t3}, ${n3} bytes`);
    }, h2 = () => {
      let t3 = a2, n3 = s2[68];
      if (!Number.isSafeInteger(n3) || n3 < 0 || n3 > Math.floor((e2.byteLength - t3) / 4)) throw Error(`SAV_INVALID_DESCRIPTION_COUNT`);
      for (let e3 = 0; e3 < n3; e3 += 1) {
        m2(t3, 4, `Rsetdesc.length`);
        let e4 = r2.getInt32(t3, true);
        if (e4 < 0) throw Error(`SAV_INVALID_DESCRIPTION_LENGTH`);
        let n4 = Math.ceil(e4 / 4) * 4;
        m2(t3 + 4, n4, `Rsetdesc.text`), t3 += 4 + n4;
      }
      return t3 - a2;
    }, g2 = (e3) => {
      switch (e3) {
        case 0:
          return [f2(`Release`), 28, 71, 10, 37, 17, 19, 31][o2 - 1];
        case -101: {
          let e4 = f2(`Ratselector`) & 4095, t3 = 0;
          for (; e4; ) t3 += e4 & 1, e4 >>>= 1;
          return t3 * s2[3];
        }
        case -117:
          return d2(`Ntbpnt`).reduce((e4, t3) => e4 + Math.max(0, t3), 0);
        case -124:
          return Math.max(0, Math.min(1288, d2(`Vg3idx`).reduce((e4, t3) => Math.max(e4, t3), 0)) - 288) * 9;
        case -139:
          return h2();
        case -152:
          return d2(`Nctpak`).reduce((e4, t3) => e4 + (t3 & 63), 0);
        default:
          return se(e3, s2, c2, u2);
      }
    };
    for (let [t3, h3, _3, v3, y2] of oe) {
      if (_3 === 0 && (o2 += 1), y2 > n2 || !ce(v3, s2, l2, u2, c2, f2)) continue;
      let b2 = _3 <= 0 ? g2(_3) : _3, x2 = ue[h3];
      if (!Number.isSafeInteger(b2) || b2 < 0 || x2 === void 0) throw Error(`SAV_INVALID_DIMENSION: ${t3} (${b2})`);
      let S2 = b2 * x2;
      m2(a2, Math.ceil(S2 / 4) * 4, t3);
      let C2 = [];
      if (h3 === 3) C2.push(de(e2.subarray(a2, a2 + S2)));
      else for (let e3 = 0; e3 < b2; e3 += 1) {
        let n3 = a2 + e3 * x2;
        switch (h3) {
          case 0:
          case 4:
            C2.push(r2.getInt32(n3, true));
            break;
          case 1:
            C2.push(p2(r2.getFloat32(n3, true), t3, n3));
            break;
          case 2:
            C2.push(p2(r2.getFloat64(n3, true), t3, n3));
            break;
          case 5:
            C2.push([p2(r2.getFloat32(n3, true), t3, n3), p2(r2.getFloat32(n3 + 4, true), t3, n3 + 4)]);
            break;
          case 6:
            C2.push([p2(r2.getFloat64(n3, true), t3, n3), p2(r2.getFloat64(n3 + 8, true), t3, n3 + 8)]);
            break;
          default:
            throw Error(`SAV_UNSUPPORTED_TYPE: ${h3}`);
        }
      }
      if (i2[t3] = { type: le[h3], count: b2, offset: a2, values: C2 }, a2 += Math.ceil(S2 / 4) * 4, t3 === `Release` && (f2(`Release`) < 0 || f2(`Release`) > 65536)) throw Error(`SAV_INVALID_RELEASE_LENGTH`);
      if (t3 === `Headin`) {
        if (s2 = d2(t3), s2[0] < 1 || s2[0] > 2e6) throw Error(`SAV_INVALID_BUS_COUNT`);
      } else t3 === `Maxary` ? c2 = d2(t3) : t3 === `Headlo` ? l2 = d2(t3) : t3 === `Ophdin` && (u2 = d2(t3));
    }
    let _2 = Array.from(e2.subarray(a2)), v2 = _2.length === 20 && _2.every((e3) => e3 === 0);
    return { arrays: i2, header: { layoutRevision: n2, info: t2, integerHeader: s2, sizingLimits: c2, logicalHeader: l2, opfIntegerHeader: u2 }, consumedBytes: a2, tail: { offset: a2, bytes: _2, recognizedEmptyExtension: v2 } };
  }
  function pe(e2, t2) {
    let n2 = performance.now(), r2 = new ArrayBuffer(e2.byteLength);
    new Uint8Array(r2).set(e2);
    let i2 = ie(r2), a2 = fe(i2.segments[0]), o2 = a2.arrays, s2 = (e3) => o2[e3]?.count ?? 0, c2 = (e3, t3) => {
      let n3 = o2[e3]?.values[t3];
      if (typeof n3 != `number` || !Number.isFinite(n3)) throw Error(`SAV_MISSING_OR_INVALID_FIELD: ${e3}[${t3 + 1}]`);
      return n3;
    }, l2 = (e3, t3) => A(c2(e3, t3), `${e3}[${t3 + 1}]`), u2 = (e3, t3) => o2[e3] && t3 < o2[e3].count ? c2(e3, t3) : null, d2 = (e3, t3, n3) => {
      let r3 = o2[e3]?.values[0];
      if (typeof r3 != `string` || t3 < 0 || (t3 + 1) * n3 > r3.length) throw Error(`SAV_MISSING_CHARACTER_FIELD: ${e3}[${t3 + 1}]`);
      return r3.slice(t3 * n3, (t3 + 1) * n3).trimEnd();
    }, f2 = (e3, t3, n3) => {
      let r3 = d2(e3, t3, n3);
      if (!/[\u0080-\u00ff]/.test(r3)) return r3;
      try {
        return new TextDecoder(`utf-8`, { fatal: true }).decode(Uint8Array.from(r3, (e4) => e4.charCodeAt(0)));
      } catch {
        return r3;
      }
    }, p2 = (e3, t3) => {
      let n3 = o2[e3]?.values[t3];
      if (!Array.isArray(n3) || n3.length !== 2 || n3.some((e4) => !Number.isFinite(e4))) throw Error(`SAV_MISSING_COMPLEX_FIELD: ${e3}[${t3 + 1}]`);
      return [n3[0], n3[1]];
    }, m2 = (e3, t3) => {
      let [n3, r3] = p2(e3, t3), i3 = n3 * n3 + r3 * r3;
      if (i3 === 0) throw Error(`SAV_ZERO_SERIES_ADMITTANCE: ${e3}[${t3 + 1}]`);
      return [-n3 / i3, r3 / i3];
    }, h2 = (e3, t3 = 0) => {
      let n3 = o2[e3];
      if (!n3 || t3 < 0 || t3 >= n3.count) throw Error(`SAV_INVALID_PROVENANCE: ${e3}`);
      let r3 = { I32: 4, F32: 4, F64: 8, CHAR: 1, LOGICAL: 4, C64: 8, C128: 16 };
      return ae(i2.segmentInfo[0], n3.offset + t3 * r3[n3.type], r3[n3.type])[0].offset;
    }, g2 = (e3, t3, n3, r3, i3 = false) => N(e3, `SAV.${t3}[${n3 + 1}]`, r3, i3, h2(t3, n3)), _2 = c2(`Headre`, 2), v2 = P(e2, t2, `SAV`, 31, _2, c2(`Headre`, 16), [d2(`Ihanb`, 0, 60), d2(`Ihanb`, 1, 60)]);
    v2.binaryArrays = o2, v2.sourceTables = { SAV_HEADER: a2.header, SFL: { ...i2, segments: i2.segmentInfo }, SAV_TAIL: a2.tail }, v2.case.binaryOffsetOrigin = `SFL segment 1 logical byte offsets in binaryArrays; operating.offset is physical source byte`, v2.case.savedInfo = a2.header.info, v2.case.displayNameEncoding = `Inferred valid UTF-8 for labels, otherwise byte-faithful Latin-1; source IDs and binaryArrays retain original bytes.`, v2.case.xfrrat = l2(`Headlo`, 26), v2.case.nxfrat = l2(`Headlo`, 27), v2.case.transformerRatingUnits = Number(v2.case.xfrrat) > 0 ? `CURRENT_EXPRESSED_AS_MVA` : `MVA`, v2.case.lineRatingUnits = Number(v2.case.nxfrat) > 0 ? `CURRENT_EXPRESSED_AS_MVA` : `MVA`, v2.case.normalization = `Canonical system-base impedances and bus-base winding ratios; original packed codes and every decoded array are retained.`;
    let y2 = (e3) => {
      v2.completeness = `PARTIAL`, v2.findings.push({ severity: `WARNING`, code: `UNSUPPORTED_SOURCE_MODEL`, message: e3 });
    };
    i2.segments.length > 1 && y2(`${i2.segments.length - 1} additional SAV segments are preserved; their electrical meaning is not implemented.`), i2.segments.length > 1 && (v2.sourceTables.ADDITIONAL_SEGMENTS = i2.segments.slice(1).map((e3, t3) => ({ number: i2.segmentInfo[t3 + 1].number, bytes: Array.from(e3) }))), a2.tail.bytes.length && !a2.tail.recognizedEmptyExtension && y2(`SAV extension tail (${a2.tail.bytes.length} bytes) is retained but not electrically interpreted.`);
    let b2 = s2(`Numbus`), x2 = Array.from({ length: b2 }, (e3, t3) => l2(`Numbus`, t3)), S2 = x2.some((e3) => e3 % 1e3 != 0), C2 = x2.map((e3) => Math.trunc(e3 / 1e3)), w2 = x2.map((e3, t3) => S2 ? e3 : C2[t3]);
    v2.case.busConnectionKeyEncoding = S2 ? `source packed Numbus = 1000 * external bus number + section` : `external bus number`;
    let T2 = (e3, t3 = false) => {
      if (!e3 && t3) return 0;
      let n3 = Math.abs(A(e3)) - 1;
      if (n3 < 0 || n3 >= b2) throw Error(`SAV_MISSING_BUS_POINTER: ${e3}`);
      return w2[n3];
    }, E2 = (e3, t3 = false) => !e3 && t3 ? 0 : (T2(e3), C2[Math.abs(e3) - 1]), D2 = (e3) => {
      T2(e3);
      let t3 = Math.abs(e3) - 1, n3 = x2[t3] % 1e3;
      return n3 ? `${C2[t3]}:${n3}` : String(C2[t3]);
    }, O2 = (e3, t3, n3 = false) => !t3 && n3 ? 0 : l2(e3, Math.abs(t3) - 1), k2 = [];
    for (let e3 = 0; e3 < b2; e3++) {
      let t3 = o2.Dblvlt ? `Dblvlt` : `Volt`, [n3, r3] = p2(t3, e3), i3 = Math.hypot(n3, r3), a3 = Math.atan2(r3, n3) * 180 / Math.PI, s3 = Math.abs(l2(`Jcode`, e3)), d3 = { savIndex: e3 + 1, ibus: C2[e3], section: x2[e3] % 1e3, connectionKey: w2[e3], packedNumbus: x2[e3], name: f2(`Busnam`, e3, 12), baskv: c2(`Basvlt`, e3), ide: s3, savedJcode: l2(`Jcode`, e3), originalJcode: u2(`Orgjcode`, e3), area: O2(`Numare`, l2(`Iarea`, e3)), zone: O2(`Numzon`, l2(`Loszon`, e3)), owner: O2(`Numown`, l2(`Iowner`, e3)), vm: i3, va: a3, nvhi: c2(`Nvlmhi`, e3), nvlo: c2(`Nvlmlo`, e3), evhi: c2(`Evlmhi`, e3), evlo: c2(`Evlmlo`, e3), sourceVoltage: [n3, r3], originalBusIndex: l2(`Origbus`, e3) }, m3 = u2(`Bussts`, e3);
      m3 && (d3.isub = O2(`Stsnum`, m3)), k2.push(F(v2, `bus`, D2(e3 + 1), d3, [w2[e3]], s3 === 4 ? 0 : 1, String(d3.name), { vm: g2(i3, t3, e3, `pu`, true), va: g2(a3, t3, e3, `deg`, true) }));
    }
    let j2 = (e3, t3, n3, r3) => {
      if (s2(e3) !== n3 || s2(t3) !== r3) throw Error(`SAV_LINK_DIMENSION_MISMATCH: ${e3}/${t3}`);
      let i3 = Array(r3).fill(-1);
      for (let a3 = 0; a3 < n3; a3++) {
        let n4 = l2(e3, a3);
        for (; n4; ) {
          let e4 = n4 - 1;
          if (e4 < 0 || e4 >= r3) throw Error(`SAV_LINK_OUTSIDE_TABLE: ${t3} -> ${n4}`);
          if (i3[e4] !== -1) throw Error(`SAV_LINK_CYCLE_OR_ALIAS: ${t3}[${n4}]`);
          i3[e4] = a3, n4 = l2(t3, e4);
        }
      }
      if (i3.some((e4) => e4 < 0)) throw Error(`SAV_ORPHAN_RECORD: ${t3}`);
      return i3;
    }, M2 = (e3, t3, n3, r3, i3) => {
      let a3 = [], o3 = /* @__PURE__ */ new Set(), u3 = l2(e3, i3);
      for (; u3; ) {
        if (u3 < 1 || u3 > s2(t3) || o3.has(u3)) throw Error(`SAV_OWNER_CHAIN_INVALID: ${t3}`);
        o3.add(u3), a3.push({ owner: O2(`Numown`, l2(n3, u3 - 1)), fraction: c2(r3, u3 - 1) }), u3 = l2(t3, u3 - 1);
      }
      return a3;
    }, ee2 = [], I2 = [], L2 = [], R2 = [], z2 = s2(`Ldnext`);
    if (z2) {
      let e3 = j2(`Ldfrst`, `Ldnext`, b2, z2);
      for (let t3 = 0; t3 < z2; t3++) {
        let n3 = e3[t3], r3 = d2(`Loadid`, t3, 2), i3 = [p2(`Cfdlfr`, 3 * t3), p2(`Cfdlfr`, 3 * t3 + 1), p2(`Cfdlfr`, 3 * t3 + 2)], a3 = { savIndex: t3 + 1, ibus: C2[n3], section: x2[n3] % 1e3, connectionKey: w2[n3], loadid: r3, stat: l2(`Ldstat`, t3), area: O2(`Numare`, l2(`Ldarea`, t3)), zone: O2(`Numzon`, l2(`Ldzone`, t3)), owner: O2(`Numown`, l2(`Ldownr`, t3)), pl: i3[0][0] * _2, ql: i3[0][1] * _2, ip: i3[1][0] * _2, iq: i3[1][1] * _2, yp: i3[2][0] * _2, yq: i3[2][1] * _2, scaleCode: d2(`Ldconf`, t3, 1), interruptibleCode: d2(`Ldintr`, t3, 1), distributedGenerationPu: p2(`Cdgnfr`, t3), distributedGenerationMode: l2(`Ldgnfl`, t3), loadTypeIndex: l2(`Ildtype`, t3), name: f2(`Ldname`, t3, 40) }, o3 = {};
        for (let [e4, n4, r4] of [[`pl`, 0, 0], [`ql`, 0, 1], [`ip`, 1, 0], [`iq`, 1, 1], [`yp`, 2, 0], [`yq`, 2, 1]]) o3[e4] = g2(i3[n4][r4] * _2, `Cfdlfr`, 3 * t3 + n4, r4 ? `Mvar` : `MW`, true);
        ee2[t3] = F(v2, `load`, `${D2(n3 + 1)}:${r3}`, a3, [w2[n3]], l2(`Ldstat`, t3), String(a3.name), o3).id;
      }
    }
    let B2 = s2(`Shnext`);
    if (B2) {
      let e3 = j2(`Shfrst`, `Shnext`, b2, B2);
      for (let t3 = 0; t3 < B2; t3++) {
        let n3 = e3[t3], r3 = d2(`Shntid`, t3, 2), [i3, a3] = p2(`Shntgb`, t3);
        I2[t3] = F(v2, `shunt`, `fixed:${D2(n3 + 1)}:${r3}`, { savIndex: t3 + 1, subtype: `fixed`, ibus: C2[n3], shntid: r3, gl: i3 * _2, bl: a3 * _2, stat: l2(`Shstat`, t3), zeroSequenceAdmittance: o2.Shntzr ? p2(`Shntzr`, t3) : null }, [w2[n3]], l2(`Shstat`, t3), f2(`Shnnam`, t3, 40), { gl: g2(i3 * _2, `Shntgb`, t3, `MW`, true), bl: g2(a3 * _2, `Shntgb`, t3, `Mvar`, true) }).id;
      }
    }
    let V2 = s2(`Mcfrst`), H2 = s2(`Mcnext`);
    if (H2) {
      let e3 = Array(V2).fill(-1);
      for (let t4 = 0; t4 < b2; t4++) {
        let n3 = l2(`Genbus`, t4);
        if (n3) {
          if (n3 < 1 || n3 > V2 || e3[n3 - 1] !== -1) throw Error(`SAV_INVALID_PLANT_BUS_LINK`);
          e3[n3 - 1] = t4;
        }
      }
      let t3 = j2(`Mcfrst`, `Mcnext`, V2, H2);
      for (let n3 = 0; n3 < H2; n3++) {
        let r3 = t3[n3], i3 = e3[r3];
        if (i3 < 0) throw Error(`SAV_GENERATOR_WITHOUT_PLANT_BUS`);
        let a3 = d2(`Machid`, n3, 2), [o3, s3] = p2(`Zsorce`, n3), [m3, h3] = p2(`Xtran`, n3), y3 = u2(`Wndnum`, n3), b3 = l2(`Regbus`, r3), S3 = { savIndex: n3 + 1, plantIndex: r3 + 1, ibus: C2[i3], section: x2[i3] % 1e3, connectionKey: w2[i3], machid: a3, pg: c2(`Pgenmc`, n3) * _2, qg: c2(`Qgenmc`, n3) * _2, qt: c2(`Qmaxmc`, n3) * _2, qb: c2(`Qminmc`, n3) * _2, pt: c2(`Pmaxmc`, n3) * _2, pb: c2(`Pminmc`, n3) * _2, vs: c2(`Vsave`, r3), ireg: E2(b3, true), regConnectionKey: T2(b3, true), nreg: l2(`Regnod`, r3), mbase: c2(`Mbase`, n3), zr: o3, zx: s3, rt: m3, xt: h3, gtap: c2(`Gentap`, n3), stat: l2(`Mxstat`, n3), rmpct: c2(`Rempct`, r3), baslod: l2(`Basflg`, n3), wmod: y3 ? c2(`Wndmod`, y3 - 1) : 0, wpf: y3 ? c2(`Wndpf`, y3 - 1) : null, voltageDroopIndex: l2(`Machdrpcurve`, n3), owners: M2(`Mcofst`, `Mconxt`, `Mconum`, `Mcopct`, n3), name: f2(`Mcname`, n3, 40) }, O3 = { pg: g2(Number(S3.pg), `Pgenmc`, n3, `MW`, true), qg: g2(Number(S3.qg), `Qgenmc`, n3, `Mvar`, true), vs: g2(Number(S3.vs), `Vsave`, r3, `pu`), status: g2(Number(S3.stat), `Mxstat`, n3) };
        L2[n3] = F(v2, `generator`, `${D2(i3 + 1)}:${a3}`, S3, [w2[i3]], Number(S3.stat), String(S3.name), O3).id;
      }
    }
    let U2 = s2(`Ito`), te2 = j2(`Ifirst`, `Inext`, b2, U2), W2 = Array(U2), G2 = Array(s2(`Windrp`)).fill(-1), K2 = l2(`Ratselector`, 0) & 4095, q2 = Array.from({ length: 12 }, (e3, t3) => t3).filter((e3) => K2 & 1 << e3);
    if (s2(`Ratings`) !== q2.length * U2) throw Error(`SAV_RATING_DIMENSION_MISMATCH`);
    let ne2 = (e3) => {
      let t3 = Array(12).fill(0);
      return q2.forEach((n3, r3) => {
        t3[n3] = c2(`Ratings`, r3 * U2 + e3);
      }), t3;
    }, J2 = (e3) => Object.fromEntries(ne2(e3).map((e4, t3) => [`rate${t3 + 1}`, e4])), Y2 = (e3) => [te2[e3] + 1, l2(`Ito`, e3)];
    for (let e3 = 0; e3 < U2; e3++) {
      let [t3, n3] = Y2(e3), r3 = l2(`Tapno`, e3), i3 = u2(`Brkno`, e3) ?? 0, a3 = u2(`Bypass`, e3);
      if (r3 && i3) throw Error(`SAV_BRANCH_HAS_TRANSFORMER_AND_SWITCH_ID`);
      if (r3) {
        let t4 = Math.abs(r3) - 1;
        if (t4 < 0 || t4 >= G2.length || G2[t4] !== -1) throw Error(`SAV_INVALID_TRANSFORMER_BRANCH_LINK`);
        G2[t4] = e3;
        continue;
      }
      let o3 = d2(`Numckt`, e3, 2), [s3, h3] = m2(`Gb`, e3), [_3, y3] = p2(`Gbline`, 2 * e3), [b3, x3] = p2(`Gbline`, 2 * e3 + 1), S3 = l2(`Icom`, e3), C3 = { savIndex: e3 + 1, ibus: E2(t3), jbus: E2(n3), ckt: o3, rpu: s3, xpu: h3, bpu: 2 * c2(`B2s`, e3), bp: a3, ...J2(e3), gi: _3, bi: y3, gj: b3, bj: x3, stat: S3, originalStatus: u2(`Orgicom`, e3), len: c2(`Linlen`, e3), meteredBus: E2(l2(`Imeter`, e3)), owners: M2(`Lnofst`, `Lnonxt`, `Lnonum`, `Lnopct`, e3), name: f2(`Brname`, e3, 40), ratingMask: K2 };
      if (i3) {
        let r4 = i3 - 1;
        C3.switchIndex = i3, C3.nstat = l2(`Brknst`, r4), C3.nstatus = C3.nstat, C3.stype = l2(`Brktyp`, r4), C3.sourceBrktyp = C3.stype, C3.sourceBrknst = C3.nstat, C3.ratingSetIndex = l2(`Brkrsetnum`, r4), C3.rsetnam = Number(C3.ratingSetIndex) ? d2(`Rsetname`, Number(C3.ratingSetIndex) - 1, 40) : ``, W2[e3] = F(v2, `switch`, `system:${D2(t3)}:${D2(n3)}:${o3}`, C3, [T2(t3), T2(n3)], S3, f2(`Brknam`, r4, 40), { status: g2(S3, `Icom`, e3), ...a3 === null ? {} : { bp: g2(a3, `Bypass`, e3, `code`) } }).id;
      } else W2[e3] = F(v2, `line`, `${D2(t3)}:${D2(n3)}:${o3}`, C3, [T2(t3), T2(n3)], S3, String(C3.name), { status: g2(S3, `Icom`, e3), ...a3 === null ? {} : { bp: g2(a3, `Bypass`, e3, `code`) } }).id;
    }
    if (G2.some((e3) => e3 < 0)) throw Error(`SAV_ORPHAN_TRANSFORMER_WINDING`);
    let re2 = (e3) => {
      let t3 = G2[e3], [n3, r3] = m2(`Gbtran`, e3);
      return { savIndex: e3 + 1, branchIndex: t3 + 1, ratioPu: c2(`Windrp`, e3), secondaryRatioPu: c2(`Windrs`, e3), nominalKv: c2(`Nomvp`, e3), secondaryNominalKv: c2(`Nomvs`, e3), angleDeg: c2(`Psangl`, e3) * 180 / Math.PI, sourceAngleRadians: c2(`Psangl`, e3), systemResistancePu: n3, systemReactancePu: r3, mvaBase: c2(`Trnbas`, e3), controlMode: l2(`Tpnabl`, e3), controlledBus: E2(l2(`Pqcont`, e3), true), controlledConnectionKey: T2(l2(`Pqcont`, e3), true), controlledBusSign: Math.sign(l2(`Pqcont`, e3)), controlledNode: l2(`Pqcnod`, e3), sourceRmax: c2(`Rmax`, e3), sourceRmin: c2(`Rmin`, e3), vmax: c2(`Vmax`, e3), vmin: c2(`Vmin`, e3), tapPositions: l2(`Ntapos`, e3), correctionTable: l2(`Tablno`, e3), compensation: p2(`Xfrcmp`, e3), connectionAngle: c2(`Psalfa`, e3), packedSourceCodes: l2(`Iocode`, e3), vectorGroupCode: l2(`Vg2idx`, e3), ratings: ne2(t3) };
    };
    for (let e3 = 0; e3 < G2.length; e3++) {
      if ((u2(`Indx3w`, e3) ?? 0) !== 0) continue;
      let t3 = G2[e3], n3 = l2(`Tapno`, t3), r3 = Y2(t3), [i3, a3] = n3 > 0 ? r3 : [r3[1], r3[0]], o3 = d2(`Numckt`, t3, 2), s3 = re2(e3), [c3, m3] = p2(`Gbline`, 2 * t3), [h3, _3] = p2(`Gbline`, 2 * t3 + 1), y3 = l2(`Icom`, t3), b3 = { savIndex: e3 + 1, savBranchIndex: t3 + 1, ibus: E2(i3), jbus: E2(a3), kbus: 0, ckt: o3, cw: 1, cz: 1, cm: 1, mag1: c3 + h3, mag2: m3 + _3, r1_2: s3.systemResistancePu, x1_2: s3.systemReactancePu, sbase1_2: s3.mvaBase, r12Pu: s3.systemResistancePu, x12Pu: s3.systemReactancePu, windv1: s3.ratioPu, windv2: s3.secondaryRatioPu, ratio1Pu: s3.ratioPu, ratio2Pu: s3.secondaryRatioPu, nomv1: s3.nominalKv, nomv2: s3.secondaryNominalKv, ang1: s3.angleDeg, stat: y3, ...J2(t3), windings: [s3], originalPackedCodes: s3.packedSourceCodes, name: f2(`Brname`, t3, 40), owners: M2(`Lnofst`, `Lnonxt`, `Lnonum`, `Lnopct`, t3) };
      s3.ratings.forEach((e4, t4) => {
        b3[`wdg1rate${t4 + 1}`] = e4;
      }), W2[t3] = F(v2, `transformer`, `${D2(i3)}:${D2(a3)}:${o3}`, b3, [T2(i3), T2(a3)], y3, String(b3.name), { tap1: g2(s3.ratioPu, `Windrp`, e3, `pu`), tap2: g2(s3.secondaryRatioPu, `Windrs`, e3, `pu`), angle1: g2(s3.angleDeg, `Psangl`, e3, `deg`, true), status: g2(y3, `Icom`, t3) }).id;
    }
    for (let e3 = 0; e3 < s2(`Icm3wt`); e3++) {
      let t3 = [l2(`Bus3wt`, 4 * e3), l2(`Bus3wt`, 4 * e3 + 1), l2(`Bus3wt`, 4 * e3 + 2)], n3 = l2(`Bus3wt`, 4 * e3 + 3), r3 = Array.from({ length: G2.length }, (e4, t4) => t4).filter((t4) => u2(`Indx3w`, t4) === e3 + 1);
      if (r3.length !== 3) throw Error(`SAV_INCOMPLETE_THREE_WINDING_TRANSFORMER`);
      let i3 = t3.map((e4) => {
        let t4 = r3.filter((t5) => {
          let [r4, i4] = Y2(G2[t5]);
          return r4 === e4 && i4 === n3 || i4 === e4 && r4 === n3;
        });
        if (t4.length !== 1) throw Error(`SAV_THREE_WINDING_TERMINAL_MISMATCH`);
        return t4[0];
      }), a3 = i3.map(re2), o3 = d2(`Ckt3wt`, e3, 2), s3 = l2(`Icm3wt`, e3), c3 = r3.flatMap((e4) => {
        let t4 = G2[e4];
        return [p2(`Gbline`, t4 * 2), p2(`Gbline`, t4 * 2 + 1)];
      }), m3 = { savIndex: e3 + 1, subtype: `three-winding`, ibus: E2(t3[0]), jbus: E2(t3[1]), kbus: E2(t3[2]), ckt: o3, cw: 1, cz: 1, cm: 1, stat: s3, mag1: c3.reduce((e4, t4) => e4 + t4[0], 0), mag2: c3.reduce((e4, t4) => e4 + t4[1], 0), starBus: E2(n3), starConnectionKey: T2(n3), windings: a3, vectorGroupCode: l2(`Vg3idx`, e3) };
      for (let [e4, t4] of [[0, 1], [1, 2], [2, 0]]) m3[`r${e4 + 1}${t4 + 1}Pu`] = a3[e4].systemResistancePu + a3[t4].systemResistancePu, m3[`x${e4 + 1}${t4 + 1}Pu`] = a3[e4].systemReactancePu + a3[t4].systemReactancePu, m3[`r${e4 + 1}_${t4 + 1}`] = m3[`r${e4 + 1}${t4 + 1}Pu`], m3[`x${e4 + 1}_${t4 + 1}`] = m3[`x${e4 + 1}${t4 + 1}Pu`], m3[`sbase${e4 + 1}_${t4 + 1}`] = a3[e4].mvaBase;
      let h3 = {};
      a3.forEach((e4, t4) => {
        m3[`windv${t4 + 1}`] = e4.ratioPu, m3[`ratio${t4 + 1}Pu`] = e4.ratioPu, m3[`nomv${t4 + 1}`] = e4.nominalKv, m3[`ang${t4 + 1}`] = e4.angleDeg, e4.ratings.forEach((e5, n4) => {
          m3[`wdg${t4 + 1}rate${n4 + 1}`] = e5;
        }), h3[`tap${t4 + 1}`] = g2(e4.ratioPu, `Windrp`, i3[t4], `pu`), h3[`angle${t4 + 1}`] = g2(e4.angleDeg, `Psangl`, i3[t4], `deg`, true);
      });
      let _3 = F(v2, `transformer`, `${t3.map(D2).join(`:`)}:${o3}`, m3, t3.map((e4) => T2(e4)), s3, f2(`Nam3wt`, e3, 40), h3);
      r3.forEach((e4) => {
        W2[G2[e4]] = _3.id;
      }), k2[n3 - 1].fields.threeWindingStar = true;
    }
    if (s2(`Swnext`)) {
      let e3 = j2(`Swfrst`, `Swnext`, b2, s2(`Swnext`));
      for (let t3 = 0; t3 < e3.length; t3++) {
        let n3 = e3[t3], r3 = d2(`Swshid`, t3, 2), i3 = l2(`Swshmd`, t3), a3 = Array.from({ length: 8 }, (e4, n4) => ({ steps: l2(`Nswstp`, t3 * 8 + n4), susceptanceMvar: c2(`Swshnb`, t3 * 8 + n4) * _2 })), o3 = { savIndex: t3 + 1, subtype: `switched`, ibus: C2[n3], shntid: r3, packedMode: i3, modsw: i3 & 7, binit: c2(`Bswich`, t3) * _2, vswhi: c2(`Vshnhi`, t3), vswlo: c2(`Vshnlo`, t3), swrem: E2(l2(`Swshrm`, t3), true), swnod: l2(`Swsnod`, t3), rmpct: c2(`Swspct`, t3), remoteIndex: l2(`Rmindx`, t3), blocks: a3 };
        R2[t3] = F(v2, `shunt`, `switched:${D2(n3 + 1)}:${r3}`, o3, [w2[n3]], null, f2(`Swshnm`, t3, 40), { binit: g2(Number(o3.binit), `Bswich`, t3, `Mvar`, true) }).id;
      }
      y2(`Switched-shunt packed status/adjustment and block activation flags are retained but not fully normalized.`);
    }
    for (let e3 = 0; e3 < s2(`Stsnum`); e3++) {
      let t3 = l2(`Stsnum`, e3);
      F(v2, `substation`, String(t3), { savIndex: e3 + 1, isub: t3, lati: c2(`Stslat`, e3), long: c2(`Stslon`, e3), srg: c2(`Stsgrd`, e3), latitude: c2(`Stslat`, e3), longitude: c2(`Stslon`, e3), earthResistanceOhm: c2(`Stsgrd`, e3) }, [], null, f2(`Stsnam`, e3, 40));
    }
    let X2 = s2(`Nodnum`), Z2 = [];
    for (let e3 = 0; e3 < X2; e3++) {
      let t3 = O2(`Stsnum`, l2(`Nodsta`, e3)), n3 = l2(`Nodnum`, e3), r3 = l2(`Nodbus`, e3);
      Z2[e3] = F(v2, `node`, `${t3}:${n3}`, { savIndex: e3 + 1, isub: t3, inode: n3, ibus: E2(r3, true), busSection: r3 ? x2[r3 - 1] % 1e3 : 0, connectionKey: T2(r3, true), stat: l2(`Nodcod`, e3), name: f2(`Nodnam`, e3, 40) }, r3 ? [T2(r3)] : [], l2(`Nodcod`, e3), f2(`Nodnam`, e3, 40)).id;
    }
    if (s2(`Ndsnxt`)) {
      let e3 = j2(`Ndsfst`, `Ndsnxt`, X2, s2(`Ndsnxt`));
      for (let t3 = 0; t3 < e3.length; t3++) {
        let n3 = e3[t3], r3 = l2(`Ndsto`, t3) - 1;
        if (r3 < 0 || r3 >= X2 || l2(`Nodsta`, n3) !== l2(`Nodsta`, r3)) throw Error(`SAV_SWITCH_NODE_STATION_MISMATCH`);
        let i3 = O2(`Stsnum`, l2(`Nodsta`, n3)), a3 = l2(`Nodnum`, n3), o3 = l2(`Nodnum`, r3), s3 = l2(`Ibrkno`, t3) - 1, u3 = d2(`Brkckt`, t3, 2), p3 = [l2(`Nodbus`, n3), l2(`Nodbus`, r3)].filter(Boolean).map((e4) => T2(e4));
        F(v2, `switch`, `node:${i3}:${a3}:${o3}:${u3}`, { savIndex: t3 + 1, isub: i3, inode: a3, jnode: o3, swdid: u3, stat: l2(`Brkcom`, t3), stype: l2(`Brktyp`, s3), nstatus: l2(`Brknst`, s3), xpu: c2(`Brkrac`, t3), ratingSetIndex: l2(`Brkrsetnum`, s3), nodeIds: [Z2[n3], Z2[r3]] }, p3, l2(`Brkcom`, t3), f2(`Brknam`, s3, 40), { status: g2(l2(`Brkcom`, t3), `Brkcom`, t3) });
      }
    }
    if (s2(`Ndtmnx`)) {
      let e3 = j2(`Ndtmfs`, `Ndtmnx`, X2, s2(`Ndtmnx`));
      for (let t3 = 0; t3 < e3.length; t3++) {
        let n3 = e3[t3], r3 = O2(`Stsnum`, l2(`Nodsta`, n3)), i3 = l2(`Nodnum`, n3), a3 = l2(`Ndtmtyp`, t3), o3 = l2(`Ndtmseq`, t3), s3 = l2(`Nodbus`, n3), c3 = a3 === 1 ? ee2[o3 - 1] : a3 === 2 ? L2[o3 - 1] : a3 === 3 ? I2[o3 - 1] : a3 === 4 ? R2[o3 - 1] : a3 === 5 || a3 === 6 ? W2[o3 - 1] : void 0;
        F(v2, `terminal`, `${r3}:${i3}:${a3}:${o3}`, { savIndex: t3 + 1, isub: r3, inode: i3, type: a3, equipmentSequence: o3, equipmentId: c3 ?? null, nodeId: Z2[n3], sourceEndpoint: a3 === 5 ? `from` : a3 === 6 ? `to` : null }, s3 ? [T2(s3)] : [], null), c3 || y2(`Node terminal ${t3 + 1} type ${a3} retains its source reference; this equipment family is not fully normalized.`);
      }
    }
    for (let e3 = 0; e3 < s2(`Vdstatusraw`); e3++) {
      let t3 = l2(`Vdregbus`, e3);
      F(v2, `other`, `voltage-droop:${e3 + 1}`, { savIndex: e3 + 1, subtype: `voltage-droop`, regbus: E2(t3, true), regConnectionKey: T2(t3, true), qdb: c2(`Vdqdb`, e3), qmin: c2(`Vdqminraw`, e3), qmax: c2(`Vdqmaxraw`, e3), vlow: c2(`Vdvlowraw`, e3), vdblow: c2(`Vddbloraw`, e3), vdbhigh: c2(`Vddbhiraw`, e3), vhigh: c2(`Vdvhiraw`, e3), stat: l2(`Vdstatusraw`, e3) }, t3 ? [T2(t3)] : [], l2(`Vdstatusraw`, e3), f2(`Vdname`, e3, 40));
    }
    let Q2 = /* @__PURE__ */ `Mdc.Rdc.Setval.Vsched.Vcmode.Rcomp.Delti.Dcvmin.Cccitmax.Cccacc.Nbr.Nbi.Alfmin.Alfmx.Gammin.Gammx.Xcrr.Xcir.Ebaser.Ebasei.Trr.Tri.Tapr.Tapi.Tapmxr.Tapmnr.Tstpr.Tapmxi.Tapmni.Tstpi.Rcr.Rci.Xcapr.Xcapi.Acfrr.Actor.Acfri.Actoi`.split(`.`);
    for (let e3 = 0; e3 < s2(`Mdc`); e3++) {
      let t3 = l2(`Ipr`, e3), n3 = l2(`Ipi`, e3), r3 = { savIndex: e3 + 1, subtype: `two-terminal-dc`, ibus: E2(t3), jbus: E2(n3) };
      for (let t4 of Q2) r3[t4] = c2(t4, e3);
      F(v2, `dc`, `two-terminal:${e3 + 1}`, r3, [T2(t3), T2(n3)], l2(`Mdc`, e3) === 0 ? 0 : 1, f2(`Dc2nam`, e3, 12), { pacRectifier: g2(c2(`Pacr`, e3) * _2, `Pacr`, e3, `MW`, true), qacRectifier: g2(c2(`Qacr`, e3) * _2, `Qacr`, e3, `Mvar`, true), pacInverter: g2(c2(`Paci`, e3) * _2, `Paci`, e3, `MW`, true), qacInverter: g2(c2(`Qaci`, e3) * _2, `Qaci`, e3, `Mvar`, true) });
    }
    s2(`Mdc`) && y2(`Two-terminal DC records and saved AC P/Q are decoded; converter control semantics require further validation.`);
    let $2 = s2(`Vscmdc,...`) / 6;
    for (let e3 = 0; e3 < $2; e3++) {
      let t3 = [c2(`Vsccnv,...`, 2 * e3), c2(`Vsccnv,...`, 2 * e3 + 1)], n3 = { savIndex: e3 + 1, subtype: `vsc-dc`, control: c2(`Vscmdc,...`, e3), rdc: c2(`Vscidc,...`, $2 + e3), converters: t3.map((t4, n4) => {
        let r3 = 2 * e3 + n4, i3 = 2 * $2;
        return { ibus: E2(t4), connectionKey: T2(t4), itype: c2(`Vsccnv,...`, i3 + r3), mode: c2(`Vsccnv,...`, 2 * i3 + r3), dcset: c2(`Vscpac,...`, 2 * i3 + r3), acset: c2(`Vscpac,...`, 3 * i3 + r3), lossA: c2(`Vscpac,...`, 4 * i3 + r3), lossB: c2(`Vscpac,...`, 5 * i3 + r3), lossMin: c2(`Vscpac,...`, 6 * i3 + r3), smax: c2(`Vscpac,...`, 7 * i3 + r3), imax: c2(`Vscpac,...`, 8 * i3 + r3), powerFactor: c2(`Vscpac,...`, 9 * i3 + r3), qmax: c2(`Vscpac,...`, 10 * i3 + r3) * _2, qmin: c2(`Vscpac,...`, 11 * i3 + r3) * _2, rmpct: c2(`Vscpac,...`, 12 * i3 + r3) };
      }) };
      F(v2, `dc`, `vsc:${e3 + 1}`, n3, t3.map((e4) => T2(e4)), Number(n3.control) === 0 ? 0 : 1, f2(`Vscnam`, e3, 12));
    }
    $2 && y2(`VSC DC records are decoded with retained converter blocks; converter control semantics require further validation.`);
    let oe2 = s2(`Dcmswv`);
    for (let e3 = 0; e3 < oe2; e3++) F(v2, `dc`, `multi-terminal:${e3 + 1}`, { savIndex: e3 + 1, subtype: `multi-terminal-dc`, sourceArrays: [`Nconv,...`, `Dcmswv`, `Pac,...`, `Acbus,...`, `Vdc,...`, `Dcarea,...`, `Dcres,...`, `Dcfr,...`, `Dcckt`] }, [], null, f2(`Mdcnam`, e3, 12));
    oe2 && y2(`Multi-terminal DC source blocks are preserved; converter/DC bus relationships are not fully normalized.`);
    let se2 = [`Fcstat`, `Vmxmod`, `Fcownr`, `Fcrem`, `Fcordr`, `Fcnode`, `Fcpdes`, `Fcqdes`, `Fcvset`, `Fcvtmx`, `Fcvtmn`, `Trsfmx`, `Fcshmx`, `Fcvmx`, `Fcimx`, `Bseres`, `Fcpct`];
    for (let e3 = 0; e3 < s2(`Fcstat`); e3++) {
      let t3 = l2(`Fcsbus`, e3), n3 = l2(`Fctbus`, e3), r3 = { savIndex: e3 + 1, ibus: E2(t3), jbus: E2(n3, true) };
      for (let t4 of se2) r3[t4] = c2(t4, e3);
      let i3 = {};
      for (let t4 of [`Fpbrdg`, `Fqshnt`, `Fpsend`, `Fqsend`, `Fpterm`, `Fqterm`]) i3[t4] = g2(c2(t4, e3) * _2, t4, e3, t4[1] === `p` ? `MW` : `Mvar`, true);
      F(v2, `facts`, String(e3 + 1), r3, [t3, n3].filter(Boolean).map((e4) => T2(e4)), l2(`Fcstat`, e3) & 255 ? 1 : 0, f2(`Fcname`, e3, 12), i3);
    }
    if (s2(`Fcstat`) && y2(`FACTS identities, connections, source parameters and saved P/Q are decoded; packed control semantics require further validation.`), s2(`Imnext`)) {
      let e3 = j2(`Imfrst`, `Imnext`, b2, s2(`Imnext`));
      for (let t3 = 0; t3 < e3.length; t3++) {
        let n3 = { savIndex: t3 + 1, subtype: `induction-machine`, ibus: C2[e3[t3]] };
        for (let [r3, i3] of Object.entries(o2)) r3.startsWith(`Im`) && i3.count === e3.length && i3.type !== `CHAR` && (n3[r3] = i3.values[t3]);
        F(v2, `other`, `induction:${t3 + 1}`, n3, [w2[e3[t3]]], null, f2(`Imname`, t3, 40));
      }
      y2(`Induction-machine source records are retained; packed status and dynamic electrical interpretation require further validation.`);
    }
    return s2(`gnstat`) && y2(`Generic-network-equivalent source arrays are retained but their arbitrary model equations are not implemented.`), v2.case.savedEquipmentCounts = Object.fromEntries([`bus`, `line`, `transformer`, `generator`, `load`, `shunt`, `switch`, `node`, `terminal`, `dc`, `facts`, `substation`].map((e3) => [e3, v2.equipment.filter((t3) => t3.kind === e3).length])), v2.timing.decodeMs = performance.now() - n2, v2;
  }
  async function me(e2, t2) {
    let n2 = performance.now();
    if (e2.byteLength > 536870912) throw Error(`MODEL_SIZE_LIMIT_512_MIB`);
    if (!e2.byteLength) throw Error(`EMPTY_MODEL`);
    let r2 = new Uint8Array(e2), i2 = t2.split(`.`).pop()?.toLowerCase(), a2 = i2 === `sav` ? pe(r2, t2) : i2 === `raw` ? re(r2, t2) : i2 === `rawx` ? Z(r2, t2) : null;
    if (!a2) throw Error(`UNSUPPORTED_MODEL_FORMAT`);
    return ee(a2), a2.timing.decodeMs = performance.now() - n2, a2;
  }
  let he = self;
  he.onmessage = async ({ data: e2 }) => {
    try {
      let t2 = await me(await e2.file.arrayBuffer(), e2.file.name);
      he.postMessage({ id: e2.id, type: `RESULT`, model: t2 });
    } catch (t2) {
      he.postMessage({ id: e2.id, type: `ERROR`, error: t2 instanceof Error ? t2.message : String(t2) });
    }
  };
})();
