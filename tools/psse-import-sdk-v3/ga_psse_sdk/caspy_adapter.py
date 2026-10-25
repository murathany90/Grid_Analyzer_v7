"""Caspy adapter module for extracting network models from PSS(R)E .sav files.

Uses the user-installed Siemens caspy runtime under its own licensing terms.
No Siemens binary or license is redistributed. Produces:
  1. ga-psse-bridge-v1 JSON dictionary
  2. RAWX standard JSON dictionary (PSS(R)E v36 41-table format)
  3. RAW formatted text string (PSS(R)E v36 syntax)
"""
import datetime
import hashlib
import math
import os
import re
from typing import Any, Dict, List, Optional

from . import psse_env
from . import rawx_fields


def _clean_str(val: Any) -> str:
    if val is None:
        return ""
    if isinstance(val, (bytes, bytearray)):
        val = val.decode("latin1", errors="replace")
    return str(val).strip()


def _clean_float(val: Any, default: float = 0.0) -> float:
    if val is None:
        return default
    try:
        f = float(val)
        if f != f or f in (float("inf"), float("-inf")):
            raise ValueError("Non-finite native numeric value")
        return f
    except (ValueError, TypeError) as exc:
        raise ValueError(f"Invalid native numeric value: {val!r}") from exc


def _clean_int(val: Any, default: int = 0) -> int:
    if val is None:
        return default
    try:
        return int(val)
    except (ValueError, TypeError) as exc:
        raise ValueError(f"Invalid native numeric value: {val!r}") from exc


def _clean_complex(val: Any) -> complex:
    if isinstance(val, complex):
        return val
    if isinstance(val, (tuple, list)) and len(val) >= 2:
        return complex(_clean_float(val[0]), _clean_float(val[1]))
    return complex(_clean_float(val), 0.0)


def sha256_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


class CaspyAdapter:
    """Reads a PSS(R)E SAV case using caspy and converts to multiple target formats."""

    def __init__(self, sav_path: str):
        self.sav_path = os.path.abspath(sav_path)
        if not os.path.isfile(self.sav_path):
            raise FileNotFoundError(f"SAV file not found: {self.sav_path}")
        self.file_name = os.path.basename(self.sav_path)
        self.file_size = os.path.getsize(self.sav_path)
        self.file_sha256 = sha256_file(self.sav_path)

        caspy = psse_env.import_caspy()
        self.case = caspy.Savecase(self.sav_path)
        self._validate_native_core()
        self._cache = {}

    def _validate_native_core(self):
        """A missing native column must not be replaced by a plausible default."""
        msc = getattr(self.case, "pssmsc", {})
        for key in ("SBASE", "BASFRQ"):
            if not isinstance(msc.get(key), (int, float)) or not math.isfinite(msc[key]) or msc[key] <= 0:
                raise ValueError("Missing/invalid native " + key)
        for table, identity_key, fields in (
            ("pssbus", "NUM", "BASKV IDE VM VA"),
            ("psslod", "NUM", "ID STATUS LOAD"),
            ("pssgen", "NUM", "IDE PG QG QT QB VS MBASE STAT PT PB ZSORCE"),
            ("casbrn", "FRMBUS", "TOBUS CKT RX B RATINGS GBI GBJ STAT"),
            ("castrn", "BUSNUM", "CKT RX WIND NOMV ANG RATINGS SBASE STAT"),
            ("pssfsh", "NUM", "ID STATUS SHUNT"),
            ("psswsh", "NUM", "ID STAT BINIT SI NI BI")):
            values = getattr(self.case, table, {})
            count = len(values.get(identity_key, ()))
            for field in fields.split():
                column = values.get(field, ())
                if count and (not isinstance(column, (tuple, list)) or len(column) != count or any(v is None for v in column)):
                    raise ValueError(f"Incomplete native table {table}.{field}")

    # -------------------------------------------------------------------------
    # Core Table Extractors
    # -------------------------------------------------------------------------
    def get_case_id(self) -> Dict[str, Any]:
        msc = getattr(self.case, "pssmsc", {})
        tit = getattr(self.case, "psstit", {})
        sbase = _clean_float(msc.get("SBASE", 100.0), 100.0)
        basfrq = _clean_float(msc.get("BASFRQ", 60.0), 60.0)
        ver = str(msc.get("PSSVER", 36))

        heding = tit.get("HEDING")
        if isinstance(heding, (list, tuple)) and len(heding) > 0:
            h1 = _clean_str(heding[0])
            h2 = _clean_str(heding[1]) if len(heding) > 1 else ""
        elif isinstance(heding, str):
            h1 = _clean_str(heding)
            h2 = ""
        else:
            h1 = "PSS(R)E CASE"
            h2 = ""

        if not h2:
            title = tit.get("TITLE")
            if isinstance(title, (list, tuple)) and len(title) > 0:
                h2 = _clean_str(title[0])
            elif isinstance(title, str):
                h2 = _clean_str(title)

        return {
            "sbaseMva": sbase,
            "baseFrequencyHz": basfrq,
            "titleLine1": h1,
            "titleLine2": h2,
            "psseVersion": ver,
        }

    def get_buses(self) -> List[Dict[str, Any]]:
        bus = getattr(self.case, "pssbus", {})
        nums = bus.get("NUM", ())
        names = bus.get("NAME", ())
        baskvs = bus.get("BASKV", ())
        ides = bus.get("IDE", ())
        areas = bus.get("AREA", ())
        zones = bus.get("ZONE", ())
        owners = bus.get("OWNER", ())
        vms = bus.get("VM", ())
        vas = bus.get("VA", ())
        nmaxs = bus.get("NMAXV", ())
        nmins = bus.get("NMINV", ())
        emaxs = bus.get("EMAXV", ())
        emins = bus.get("EMINV", ())

        count = len(nums)
        out = []
        for i in range(count):
            bus_num = _clean_int(nums[i])
            out.append({
                "ibus": bus_num,
                "name": _clean_str(names[i]),
                "baskv": _clean_float(baskvs[i]),
                "ide": _clean_int(ides[i], 1),
                "area": _clean_int(areas[i], 1) if areas else 1,
                "zone": _clean_int(zones[i], 1) if zones else 1,
                "owner": _clean_int(owners[i], 1) if owners else 1,
                "vmPu": _clean_float(vms[i], 1.0),
                "vaDeg": _clean_float(vas[i], 0.0),
                "normalMaxPu": _clean_float(nmaxs[i], 1.1) if nmaxs else 1.1,
                "normalMinPu": _clean_float(nmins[i], 0.9) if nmins else 0.9,
                "emergencyMaxPu": _clean_float(emaxs[i], 1.1) if emaxs else 1.1,
                "emergencyMinPu": _clean_float(emins[i], 0.9) if emins else 0.9,
            })
        return out

    def get_loads(self) -> List[Dict[str, Any]]:
        sbase = self.get_case_id()["sbaseMva"]
        lod = getattr(self.case, "psslod", {})
        nums = lod.get("NUM", ())
        ids = lod.get("ID", ())
        stats = lod.get("STATUS", ())
        areas = lod.get("AREA", ())
        zones = lod.get("ZONE", ())
        loads = lod.get("LOAD", ())
        owners = lod.get("OWNER", ())
        scales = lod.get("LDSCALE", ())
        intrpts = lod.get("LDINT", ())
        names = lod.get("LDNAME", ())

        count = len(nums)
        out = []
        for i in range(count):
            c_loads = loads[i] if i < len(loads) else ()
            p_mw = (c_loads[0].real * sbase) if len(c_loads) > 0 and isinstance(c_loads[0], complex) else 0.0
            q_mvar = (c_loads[0].imag * sbase) if len(c_loads) > 0 and isinstance(c_loads[0], complex) else 0.0
            p_curr = (c_loads[1].real * sbase) if len(c_loads) > 1 and isinstance(c_loads[1], complex) else 0.0
            q_curr = (c_loads[1].imag * sbase) if len(c_loads) > 1 and isinstance(c_loads[1], complex) else 0.0
            p_adm = (c_loads[2].real * sbase) if len(c_loads) > 2 and isinstance(c_loads[2], complex) else 0.0
            q_adm = (c_loads[2].imag * sbase) if len(c_loads) > 2 and isinstance(c_loads[2], complex) else 0.0

            out.append({
                "ibus": _clean_int(nums[i]),
                "loadid": _clean_str(ids[i]) or "1",
                "inService": bool(_clean_int(stats[i], 1) == 1),
                "area": _clean_int(areas[i], 1) if areas else 1,
                "zone": _clean_int(zones[i], 1) if zones else 1,
                "pMw": _clean_float(p_mw),
                "qMvar": _clean_float(q_mvar),
                "pCurrentMw": _clean_float(p_curr),
                "qCurrentMvar": _clean_float(q_curr),
                "pAdmittanceMw": _clean_float(p_adm),
                "qAdmittanceMvar": _clean_float(q_adm),
                "owner": _clean_int(owners[i], 1) if owners else 1,
                "isScalable": bool(_clean_int(scales[i], 1) == 1) if scales else True,
                "isInterruptible": bool(_clean_int(intrpts[i], 0) == 1) if intrpts else False,
                "name": _clean_str(names[i]) if names else "",
            })
        return out

    def get_generators(self) -> List[Dict[str, Any]]:
        sbase = self.get_case_id()["sbaseMva"]
        gen = getattr(self.case, "pssgen", {})
        nums = gen.get("NUM", ())
        machids = gen.get("IDE", ())
        pgs = gen.get("PG", ())
        qgs = gen.get("QG", ())
        qts = gen.get("QT", ())
        qbs = gen.get("QB", ())
        pts = gen.get("PT", ())
        pbs = gen.get("PB", ())
        vss = gen.get("VS", ())
        iregs = gen.get("IREG", ())
        nregs = gen.get("NREG", ())
        mbases = gen.get("MBASE", ())
        zsorces = gen.get("ZSORCE", ())
        stats = gen.get("STAT", ())
        rmpcts = gen.get("RMPCT", ())
        wmods = gen.get("WMOD", ())
        wpfs = gen.get("WPF", ())
        mcnames = gen.get("MCNAME", ())

        count = len(nums)
        out = []
        for i in range(count):
            zs = zsorces[i] if i < len(zsorces) and isinstance(zsorces[i], complex) else complex(0.0, 0.0)
            pg = _clean_float(pgs[i]) * sbase if pgs else 0.0
            qg = _clean_float(qgs[i]) * sbase if qgs else 0.0
            qt = _clean_float(qts[i], 99.99) * sbase if qts else 9999.0
            qb = _clean_float(qbs[i], -99.99) * sbase if qbs else -9999.0
            pt = _clean_float(pts[i], 99.99) * sbase if pts else 9999.0
            pb = _clean_float(pbs[i], -99.99) * sbase if pbs else 0.0

            out.append({
                "ibus": _clean_int(nums[i]),
                "machid": _clean_str(machids[i]) or "1",
                "inService": bool(_clean_int(stats[i], 1) == 1),
                "pMw": _clean_float(pg),
                "qMvar": _clean_float(qg),
                "qMaxMvar": _clean_float(qt),
                "qMinMvar": _clean_float(qb),
                "pMaxMw": _clean_float(pt),
                "pMinMw": _clean_float(pb),
                "vsPu": _clean_float(vss[i], 1.0),
                "mbaseMva": _clean_float(mbases[i], 100.0),
                "remoteBus": _clean_int(iregs[i], _clean_int(nums[i])) if iregs else _clean_int(nums[i]),
                "remoteNode": _clean_int(nregs[i], 0) if nregs else 0,
                "remotePct": _clean_float(rmpcts[i], 100.0) if rmpcts else 100.0,
                "zrPu": _clean_float(zs.real),
                "zxPu": _clean_float(zs.imag),
                "name": _clean_str(mcnames[i]) if mcnames else "",
                "windMode": _clean_int(wmods[i], 0) if wmods else 0,
                "windPowerFactor": _clean_float(wpfs[i], 1.0) if wpfs else 1.0,
            })
        return out


    def get_branches(self) -> List[Dict[str, Any]]:
        brn = getattr(self.case, "casbrn", getattr(self.case, "pssbrn", {}))
        froms = brn.get("FRMBUS", ())
        tos = brn.get("TOBUS", ())
        ckts = brn.get("CKT", ())
        rxs = brn.get("RX", ())
        bs = brn.get("B", ())
        brnames = brn.get("BRNAME", ())
        ratings = brn.get("RATINGS", ())
        gbis = brn.get("GBI", ())
        gbjs = brn.get("GBJ", ())
        stats = brn.get("STAT", ())
        metbuses = brn.get("METBUS", ())
        linlens = brn.get("LINLEN", ())

        count = len(froms)
        out = []
        for i in range(count):
            rx = rxs[i] if i < len(rxs) and isinstance(rxs[i], complex) else complex(0.0, 0.0)
            gbi = gbis[i] if i < len(gbis) and isinstance(gbis[i], complex) else complex(0.0, 0.0)
            gbj = gbjs[i] if i < len(gbjs) and isinstance(gbjs[i], complex) else complex(0.0, 0.0)
            rate_list = [_clean_float(x) for x in ratings[i]] if i < len(ratings) and isinstance(ratings[i], (list, tuple)) else [0.0] * 12
            rate_a = rate_list[0] if len(rate_list) > 0 and rate_list[0] > 0 else None

            out.append({
                "fromBus": _clean_int(froms[i]),
                "toBus": _clean_int(tos[i]),
                "circuitId": _clean_str(ckts[i]) or "1",
                "inService": bool(_clean_int(stats[i], 1) == 1),
                "rPu": _clean_float(rx.real),
                "xPu": _clean_float(rx.imag),
                "bPu": _clean_float(bs[i]) if i < len(bs) else 0.0,
                "rateMva": rate_a,
                "rateSet": rate_list,
                "fromShuntGpu": _clean_float(gbi.real),
                "fromShuntBpu": _clean_float(gbi.imag),
                "toShuntGpu": _clean_float(gbj.real),
                "toShuntBpu": _clean_float(gbj.imag),
                "lengthKm": _clean_float(linlens[i]) if linlens else 0.0,
                "name": _clean_str(brnames[i]) if brnames else "",
                "isBypassed": False,
                "meteredBus": (1 if metbuses[i] == froms[i] else 2) if metbuses else None,
            })
        return out

    def get_transformers(self) -> List[Dict[str, Any]]:
        trn = getattr(self.case, "castrn", {})
        busnums = trn.get("BUSNUM", ())
        ckts = trn.get("CKT", ())
        stats = trn.get("STAT", ())
        rxs = trn.get("RX", ())
        winds = trn.get("WIND", ())
        nomvs = trn.get("NOMV", ())
        angs = trn.get("ANG", ())
        ratings = trn.get("RATINGS", ())
        sbases = trn.get("SBASE", ())
        trnames = trn.get("TRNAME", ())
        vecgrps = trn.get("VECGRP", ())
        cntls = trn.get("CNTL", ())
        conbuses = trn.get("CONBUS", ())
        rmaxs = trn.get("RMAX", ())
        rmins = trn.get("RMIN", ())
        vmaxs = trn.get("VMAX", ())
        vmins = trn.get("VMIN", ())
        ntapss = trn.get("NTAPS", ())
        mag1s = trn.get("MAG1", ())
        mag2s = trn.get("MAG2", ())

        # Build 3W star bus map from pss3wt if present
        pss3wt = getattr(self.case, "pss3wt", {})
        star_buses = pss3wt.get("BUSSTAR", ())
        b1sts = pss3wt.get("BUS1ST", ())
        b2nds = pss3wt.get("BUS2ND", ())
        b3rds = pss3wt.get("BUS3RD", ())
        ckts3w = pss3wt.get("CKT", ())
        star_map = {}
        for s_idx in range(len(star_buses)):
            key = (
                _clean_int(b1sts[s_idx]),
                _clean_int(b2nds[s_idx]),
                _clean_int(b3rds[s_idx]),
                _clean_str(ckts3w[s_idx]).strip() if s_idx < len(ckts3w) else "1",
            )
            star_map[key] = _clean_int(star_buses[s_idx])

        count = len(busnums)
        out = []
        for i in range(count):
            buses = busnums[i] if i < len(busnums) else (0, 0, 0)
            from_b = _clean_int(buses[0])
            to_b = _clean_int(buses[1])
            tert_b = _clean_int(buses[2]) if len(buses) > 2 and buses[2] != 0 else None
            is_3w = tert_b is not None and tert_b > 0

            ckt = _clean_str(ckts[i]) if i < len(ckts) else "1"
            in_srv = bool(_clean_int(stats[i], 1) != 0) if i < len(stats) else True
            name = _clean_str(trnames[i]) if i < len(trnames) else ""
            vecgrp = _clean_str(vecgrps[i]) if i < len(vecgrps) else ""

            rx_list = rxs[i] if i < len(rxs) and isinstance(rxs[i], (list, tuple)) else [complex(0, 0)] * 3
            wind_list = winds[i] if i < len(winds) and isinstance(winds[i], (list, tuple)) else [1.0, 1.0, 0.0]
            nomv_list = nomvs[i] if i < len(nomvs) and isinstance(nomvs[i], (list, tuple)) else [0.0, 0.0, 0.0]
            ang_list = angs[i] if i < len(angs) and isinstance(angs[i], (list, tuple)) else [0.0, 0.0, 0.0]
            sbase_list = sbases[i] if i < len(sbases) and isinstance(sbases[i], (list, tuple)) else [100.0, 100.0, 100.0]
            rate_arr = ratings[i] if i < len(ratings) and isinstance(ratings[i], (list, tuple)) else [[0.0]*12]*3

            rx12 = rx_list[0] if len(rx_list) > 0 and isinstance(rx_list[0], complex) else complex(0, 0)
            rx23 = rx_list[1] if len(rx_list) > 1 and isinstance(rx_list[1], complex) else complex(0, 0)
            rx31 = rx_list[2] if len(rx_list) > 2 and isinstance(rx_list[2], complex) else complex(0, 0)

            rates1 = [_clean_float(x) for x in rate_arr[0]] if isinstance(rate_arr[0], (list, tuple)) else [0.0] * 12
            rates2 = [_clean_float(x) for x in rate_arr[1]] if len(rate_arr) > 1 and isinstance(rate_arr[1], (list, tuple)) else [0.0] * 12
            rates3 = [_clean_float(x) for x in rate_arr[2]] if len(rate_arr) > 2 and isinstance(rate_arr[2], (list, tuple)) else [0.0] * 12

            rate1_mva = rates1[0] if len(rates1) > 0 and rates1[0] > 0 else None
            rate2_mva = rates2[0] if len(rates2) > 0 and rates2[0] > 0 else None
            rate3_mva = rates3[0] if len(rates3) > 0 and rates3[0] > 0 else None

            w1 = {
                "ratioPu": _clean_float(wind_list[0], 1.0),
                "nominalKv": _clean_float(nomv_list[0], 0.0),
                "angleDeg": _clean_float(ang_list[0], 0.0),
                "rateMva": rate1_mva,
                "rateSet": rates1,
                "rMaxPu": _clean_float((rmaxs[i][0] if isinstance(rmaxs[i], (list, tuple)) else rmaxs[i]), 1.1) if rmaxs else 1.1,
                "rMinPu": _clean_float((rmins[i][0] if isinstance(rmins[i], (list, tuple)) else rmins[i]), 0.9) if rmins else 0.9,
                "vMax": _clean_float((vmaxs[i][0] if isinstance(vmaxs[i], (list, tuple)) else vmaxs[i]), 1.1) if vmaxs else 1.1,
                "vMin": _clean_float((vmins[i][0] if isinstance(vmins[i], (list, tuple)) else vmins[i]), 0.9) if vmins else 0.9,
                "numTaps": _clean_int((ntapss[i][0] if isinstance(ntapss[i], (list, tuple)) else ntapss[i]), 33) if ntapss else 33,
            }
            w2 = {
                "ratioPu": _clean_float(wind_list[1], 1.0),
                "rateMva": rate2_mva, "rateSet": rates2,
                "nominalKv": _clean_float(nomv_list[1], 0.0),
                "angleDeg": _clean_float(ang_list[1], 0.0),
            }
            w3 = None
            if is_3w:
                w3 = {
                    "ratioPu": _clean_float(wind_list[2], 1.0),
                    "nominalKv": _clean_float(nomv_list[2], 0.0),
                    "angleDeg": _clean_float(ang_list[2], 0.0),
                    "rateMva": rate3_mva,
                    "rateSet": rates3,
                }

            impedance = {
                "r12Pu": _clean_float(rx12.real),
                "x12Pu": _clean_float(rx12.imag),
                "sbase12Mva": _clean_float(sbase_list[0], 100.0),
                "r23Pu": _clean_float(rx23.real) if is_3w else None,
                "x23Pu": _clean_float(rx23.imag) if is_3w else None,
                "sbase23Mva": _clean_float(sbase_list[1], 100.0) if is_3w else None,
                "r31Pu": _clean_float(rx31.real) if is_3w else None,
                "x31Pu": _clean_float(rx31.imag) if is_3w else None,
                "sbase31Mva": _clean_float(sbase_list[2], 100.0) if is_3w else None,
            }
            magnetizing = {
                "gPu": _clean_float(mag1s[i], 0.0) if mag1s else 0.0,
                "bPu": _clean_float(mag2s[i], 0.0) if mag2s else 0.0,
            }

            out.append({
                "fromBus": from_b,
                "toBus": to_b,
                "tertiaryBus": tert_b,
                "circuitId": ckt or "1",
                "inService": in_srv,
                "isThreeWinding": is_3w,
                "name": name,
                "vectorGroup": vecgrp,
                "controlMode": _clean_int((cntls[i][0] if isinstance(cntls[i], (list, tuple)) else cntls[i]), 0) if cntls else 0,
                "controlledBus": _clean_int((conbuses[i][0] if isinstance(conbuses[i], (list, tuple)) else conbuses[i]), 0) if conbuses else 0,
                "sourceEncoding": {"cw": 1, "cz": 1, "cm": 1, "nativeNormalized": True},
                "statusCode": _clean_int(stats[i], 1),
                "winding1": w1,
                "winding2": w2,
                "winding3": w3,
                "impedance": impedance,
                "magnetizing": magnetizing,
                "starBus": star_map.get((from_b, to_b, tert_b, ckt.strip())) if is_3w else None,
            })
            for wn in range(1, 4 if is_3w else 2):
                w = out[-1]["winding"+str(wn)]
                for key,src in {"controlMode":"CNTL","controlledBus":"CONBUS","remoteNode":"NOD","impedanceTable":"TABLE", "rMaxPu":"RMAX","rMinPu":"RMIN","vMax":"VMAX","vMin":"VMIN","numTaps":"NTAPS"}.items():
                    values = trn.get(src, ())
                    value = values[i][wn-1] if i<len(values) and isinstance(values[i],(list,tuple)) else None
                    w[key] = value
        return out

    def get_fixed_shunts(self) -> List[Dict[str, Any]]:
        sbase = self.get_case_id()["sbaseMva"]
        fsh = getattr(self.case, "pssfsh", {})
        nums = fsh.get("NUM", ())
        ids = fsh.get("ID", ())
        stats = fsh.get("STATUS", ())
        shunts = fsh.get("SHUNT", ())

        count = len(nums)
        out = []
        for i in range(count):
            s = shunts[i] if i < len(shunts) and isinstance(shunts[i], complex) else complex(0.0, 0.0)
            out.append({
                "ibus": _clean_int(nums[i]),
                "shuntId": _clean_str(ids[i]) or "1",
                "inService": bool(_clean_int(stats[i], 1) == 1),
                "gMw": _clean_float(s.real * sbase),
                "bMvar": _clean_float(s.imag * sbase),
                "name": "",
            })
        return out


    def get_switched_shunts(self) -> List[Dict[str, Any]]:
        sbase = self.get_case_id()["sbaseMva"]
        wsh = getattr(self.case, "psswsh", {})
        nums = wsh.get("NUM", ())
        ids = wsh.get("ID", ())
        modsws = wsh.get("MODSW", ())
        stats = wsh.get("STAT", ())
        vswhis = wsh.get("VSWHI", ())
        vswlos = wsh.get("VSWLO", ())
        swrems = wsh.get("SWREM", ())
        binits = wsh.get("BINIT", ())
        sis = wsh.get("SI", ())
        nis = wsh.get("NI", ())
        bis = wsh.get("BI", ())
        swnames = wsh.get("SWNAME", ())

        count = len(nums)
        out = []
        for i in range(count):
            si = sis[i] if i < len(sis) and isinstance(sis[i], (list, tuple)) else [0]*8
            ni = nis[i] if i < len(nis) and isinstance(nis[i], (list, tuple)) else [0]*8
            bi = bis[i] if i < len(bis) and isinstance(bis[i], (list, tuple)) else [0.0]*8
            blocks = []
            for b_idx in range(min(8, len(ni))):
                if ni[b_idx] > 0:
                    blocks.append({
                        "inService": bool(si[b_idx] > 0),
                        "numSteps": _clean_int(ni[b_idx]),
                        "stepBMvar": _clean_float(bi[b_idx]) * sbase,
                    })

            out.append({
                "ibus": _clean_int(nums[i]),
                "shuntId": _clean_str(ids[i]) or "1",
                "inService": bool(_clean_int(stats[i], 1) == 1),
                "controlMode": _clean_int(modsws[i], 1) if modsws else 1,
                "bInitMvar": _clean_float(binits[i], 0.0) * sbase if binits else 0.0,
                "vHighPu": _clean_float(vswhis[i], 1.05) if vswhis else 1.05,
                "vLowPu": _clean_float(vswlos[i], 0.95) if vswlos else 0.95,
                "controlledBus": _clean_int(swrems[i], _clean_int(nums[i])) if swrems else _clean_int(nums[i]),
                "name": _clean_str(swnames[i]) if swnames else "",
                "blocks": blocks,
            })
        return out

    def get_substations(self) -> List[Dict[str, Any]]:
        sub = getattr(self.case, "psssub", {})
        nums = sub.get("NUM", ())
        names = sub.get("NAME", ())
        lats = sub.get("LAT", ())
        lngs = sub.get("LNG", ())
        srgs = sub.get("SRG", ())

        count = len(nums)
        out = []
        for i in range(count):
            lat = _clean_float(lats[i]) if lats and lats[i] != 0.0 else None
            lng = _clean_float(lngs[i]) if lngs and lngs[i] != 0.0 else None
            srg = _clean_float(srgs[i]) if srgs and srgs[i] != 0.0 else None
            out.append({
                "subNumber": _clean_int(nums[i]),
                "name": _clean_str(names[i]),
                "latitude": lat,
                "longitude": lng,
                "groundingResOhms": srg,
            })
        return out

    def get_substation_nodes(self) -> List[Dict[str, Any]]:
        nod = getattr(self.case, "pssnod", {})
        stations = nod.get("STATION", ())
        nodes = nod.get("NODE", ())
        names = nod.get("NAME", ())
        buses = nod.get("BUS", ())
        stats = nod.get("STAT", ())
        vms = nod.get("VM", ())
        vas = nod.get("VA", ())

        count = len(stations)
        out = []
        for i in range(count):
            out.append({
                "subNumber": _clean_int(stations[i]),
                "nodeNumber": _clean_int(nodes[i]),
                "name": _clean_str(names[i]),
                "electricalBus": _clean_int(buses[i]),
                "inService": bool(_clean_int(stats[i], 1) == 1),
                "vmPu": _clean_float(vms[i]) if vms else None,
                "vaDeg": _clean_float(vas[i]) if vas else None,
            })
        return out

    def get_substation_switches(self) -> List[Dict[str, Any]]:
        ssw = getattr(self.case, "pssssw", {})
        stations = ssw.get("STATION", ())
        frmnods = ssw.get("FRMNOD", ())
        tonods = ssw.get("TONOD", ())
        ckts = ssw.get("CKT", ())
        names = ssw.get("NAME", ())
        types = ssw.get("TYPE", ())
        stats = ssw.get("STAT", ())
        nstatuss = ssw.get("NSTATUS", ())
        xs = ssw.get("X", ())
        rates = ssw.get("INDXRATE", ())

        count = len(stations)
        out = []
        for i in range(count):
            out.append({
                "subNumber": _clean_int(stations[i]),
                "fromNode": _clean_int(frmnods[i]),
                "toNode": _clean_int(tonods[i]),
                "circuitId": _clean_str(ckts[i]) or "1",
                "name": _clean_str(names[i]),
                "switchType": _clean_int(types[i], 1),
                "isClosed": bool(_clean_int(stats[i], 1) == 1),
                "isNormalClosed": bool(_clean_int(nstatuss[i], 1) == 1) if nstatuss else True,
                "xPu": _clean_float(xs[i], 0.0001) if xs else 0.0001,
                "ratingMva": _clean_float(rates[i]) if rates and rates[i] > 0 else None,
            })
        return out

    def get_areas(self) -> List[Dict[str, Any]]:
        ara = getattr(self.case, "pssain", {})
        nums = ara.get("ARNUM", ())
        isws = ara.get("ISW", ())
        pdess = ara.get("PDES", ())
        ptols = ara.get("PTOL", ())
        names = ara.get("ARNAM", ())
        out = []
        for i in range(len(nums)):
            out.append({
                "iarea": _clean_int(nums[i]),
                "isw": _clean_int(isws[i]) if isws else 0,
                "pdes": _clean_float(pdess[i]) if pdess else 0.0,
                "ptol": _clean_float(ptols[i]) if ptols else 10.0,
                "arname": _clean_str(names[i]) if names else "",
            })
        return out

    def get_zones(self) -> List[Dict[str, Any]]:
        zon = getattr(self.case, "pssznm", {})
        nums = zon.get("ZONUM", ())
        names = zon.get("ZONAME", ())
        out = []
        for i in range(len(nums)):
            out.append({
                "izone": _clean_int(nums[i]),
                "zoname": _clean_str(names[i]) if names else "",
            })
        return out

    def get_owners(self) -> List[Dict[str, Any]]:
        own = getattr(self.case, "pssown", {})
        nums = own.get("OWNUM", ())
        names = own.get("OWNAME", ())
        out = []
        for i in range(len(nums)):
            out.append({
                "iowner": _clean_int(nums[i]),
                "owname": _clean_str(names[i]) if names else "",
            })
        return out

    # -------------------------------------------------------------------------
    # Format Exporters
    # -------------------------------------------------------------------------
    def to_bridge_dict(self) -> Dict[str, Any]:
        """Builds a Python dictionary conforming to ga-psse-bridge-v1.schema.json."""
        case_id = self.get_case_id()
        buses = self.get_buses()
        loads = self.get_loads()
        generators = self.get_generators()
        branches = self.get_branches()
        transformers = self.get_transformers()
        fixed_shunts = self.get_fixed_shunts()
        switched_shunts = self.get_switched_shunts()
        substations = self.get_substations()
        sub_nodes = self.get_substation_nodes()
        sub_switches = self.get_substation_switches()
        areas = self.get_areas()
        zones = self.get_zones()
        owners = self.get_owners()

        # Use the native table names and retain all raw values separately.
        unsupported = []
        for table, key, cls in (
            ("pss2dc", "NAME", "TwoTerminalDcLine"), ("pssvsc", "VNAME", "VscDcLine"),
            ("pssmdc", "NAME", "MultiTerminalDcLine"), ("pssfct", "NAME", "FactsDevice"),
            ("pssind", "NUM", "InductionMachine"), ("casswd", "FRMBUS", "SystemSwitchingDevice"),
            ("pssvdp", "NUM", "VoltageDroopControl"), ("psstrm", "STATION", "SubstationTerminal")):
            count = len(getattr(self.case, table, {}).get(key, ()))
            if count: unsupported.append({"sourceClass": cls, "count": count, "details": table})
        # Non-empty unmodelled electrical/control tables must also close the gate.
        known = {"pss2dc", "pssvsc", "pssmdc", "pssfct", "pssind", "casswd", "pssvdp", "psstrm"}
        modelled = {"pssmsc", "psstit", "pssbus", "psslod", "pssgen", "pssfsh", "psswsh", "psssub",
                    "pssnod", "pssssw", "psssbn", "psssbs", "psssbt", "casbrn", "castrn", "pssain", "pssznm", "pssown",
                    "pssabx", "pssatr", "pssifc", "pssmsl", "psssrn", "pssslv", "psssiz", "pss3wt", "pssbrn", "psstrn", "pssswd", "pssrat", "pssrateswd"}
        for table in dir(self.case):
            value = getattr(self.case, table)
            if not isinstance(value, dict) or table in known | modelled: continue
            count = max((len(v) for v in value.values() if isinstance(v, (tuple, list))), default=0)
            if count: unsupported.append({"sourceClass": "NativeUnmapped:"+table, "count": count, "details": "retained in sourceTables"})
        slv = getattr(self.case, "pssslv", {})
        sol_method = _clean_str(slv.get("SOLN", ""))
        # A saved solver method, even FDNS, is not a convergence certificate.
        is_solved = False
        def serialize(v):
            if isinstance(v, complex): return {"real": serialize(v.real), "imag": serialize(v.imag)}
            if isinstance(v, float) and not math.isfinite(v):
                return {"nonFiniteNativeValue": "NaN" if math.isnan(v) else "+Infinity" if v > 0 else "-Infinity"}
            if isinstance(v, bytes): return v.decode("latin1")
            if isinstance(v, dict): return {str(k): serialize(x) for k,x in v.items()}
            if isinstance(v, (tuple, list)): return [serialize(x) for x in v]
            return v
        source_tables = {k: serialize(v) for k in dir(self.case) if k.startswith(("pss", "cas")) and isinstance(v := getattr(self.case,k),dict)}
        for k, v in source_tables.items():
            if v.get("IERR", 0) not in (0,):
                unsupported.append({"sourceClass": "NativeTableError:"+k, "count": 1, "details": str(v["IERR"])})
        areas = [{"areaNumber": r["iarea"], "slackBus": r["isw"], "desiredExportMw": r["pdes"] * case_id["sbaseMva"], "toleranceMw": r["ptol"] * case_id["sbaseMva"], "name": r["arname"]} for r in areas]
        zones = [{"zoneNumber": r["izone"], "name": r["zoname"]} for r in zones]
        owners = [{"ownerNumber": r["iowner"], "name": r["owname"]} for r in owners]

        now_utc = datetime.datetime.now(datetime.timezone.utc).isoformat()
        fidelity = "SOURCE_EXACT" if (not unsupported and is_solved) else "PARTIAL"

        return {
            "schemaVersion": "ga-psse-bridge/1",
            "metadata": {
                "sourceFile": self.file_name,
                "sourceSha256": self.file_sha256,
                "sourceFormat": "SAV",
                "extractionMethod": "caspy-direct",
                "psseRelease": case_id.get("psseVersion", "36"),
                "timestampUtc": now_utc,
                "sourceFidelity": fidelity,
                "bridgeRevision": "1.1", "impedanceBase": "SYSTEM_MVA",
                "nativeCoverage": "All native tables retained; projection requires capability gate",
                "unsupportedEquipment": unsupported,
                "diagnostics": [
                    {
                        "level": "INFO",
                        "code": "CASPY_DIRECT_READ",
                        "message": f"Successfully extracted {len(buses)} buses, {len(branches)} branches, {len(transformers)} transformers using caspy",
                    }
                ],
            },
            "caseIdentification": {
                "sbaseMva": case_id["sbaseMva"],
                "baseFrequencyHz": case_id["baseFrequencyHz"],
                "titleLine1": case_id["titleLine1"],
                "titleLine2": case_id["titleLine2"],
                "psseVersion": case_id["psseVersion"],
                "solutionStatus": {"isSolved": False, "state": "UNKNOWN", "solutionMethod": sol_method, "evidence": "Saved method only; convergence unverified"},
            },
            "network": {
                "sourceTables": source_tables,
                "buses": buses,
                "loads": loads,
                "generators": generators,
                "branches": branches,
                "transformers": transformers,
                "fixedShunts": fixed_shunts,
                "switchedShunts": switched_shunts,
                "substations": substations,
                "substationNodes": sub_nodes,
                "substationSwitches": sub_switches,
                "areas": areas,
                "zones": zones,
                "owners": owners,
            },
        }

    def to_rawx_dict(self):
        raise NotImplementedError("Faithful SAV-to-RAWX requires --engine official; direct writer excluded pending all-table parity")

    def to_raw_string(self):
        raise NotImplementedError("Faithful SAV-to-RAW requires --engine official; direct writer excluded pending all-table parity")
