"""Pure-Python PSS(R)E RAW text parser (zero DLL dependencies).

Reads standard PSS(R)E v32-v36 RAW text files (.raw) across all sections
using a strict delimiter state machine based on standard '0 / END OF ... BEGIN ...' markers.
Operates on Linux, macOS, and Windows without Siemens software.
"""
import datetime
import hashlib
import math
import os
import re
from typing import Any, Dict, List, Optional, Tuple


def _split_tokens(line: str) -> List[str]:
    """Splits a RAW file line into tokens respecting single/double quotes and slash comments."""
    cleaned = []
    in_quote = None
    for char in line:
        if in_quote:
            cleaned.append(char)
            if char == in_quote:
                in_quote = None
        else:
            if char in ("'", '"'):
                in_quote = char
                cleaned.append(char)
            elif char == "/":
                break
            else:
                cleaned.append(char)

    content = "".join(cleaned).strip()
    if not content:
        return []

    tokens, part, quote = [], [], None
    for char in content:
        if quote:
            part.append(char)
            if char == quote: quote = None
        elif char in ("'", '"'):
            quote = char; part.append(char)
        elif char == ',':
            tokens.append(''.join(part).strip()); part = []
        else: part.append(char)
    if quote: raise ValueError("Unterminated RAW quoted field")
    tokens.append(''.join(part).strip())
    return [v[1:-1] if len(v) >= 2 and v[0] == v[-1] and v[0] in ("'", '"') else v for v in tokens]


def _clean_str(val: Any) -> str:
    if val is None:
        return ""
    return str(val).strip()


def _clean_float(val: Any, default: float = 0.0) -> float:
    if val is None or val == "":
        return default
    try:
        f = float(val)
        if f != f or f in (float("inf"), float("-inf")):
            raise ValueError("Non-finite numeric input")
        return f
    except (ValueError, TypeError) as exc:
        raise ValueError(f"Invalid numeric input: {val!r}") from exc


def _clean_int(val: Any, default: int = 0) -> int:
    if val is None or val == "":
        return default
    try:
        return int(val)
    except (ValueError, TypeError) as exc:
        raise ValueError(f"Invalid numeric input: {val!r}") from exc


from .electrical import transformer_impedance as _convert_transformer_impedance
from .electrical import winding_ratio, magnetizing_admittance

def parse_raw_file(raw_path: str) -> Dict[str, Any]:
    """Parses a PSS(R)E .raw file into a ga-psse-bridge-v1 dictionary."""
    raw_path = os.path.abspath(raw_path)
    if not os.path.isfile(raw_path):
        raise FileNotFoundError(f"RAW file not found: {raw_path}")

    with open(raw_path, "rb") as f:
        content = f.read()

    file_sha256 = hashlib.sha256(content).hexdigest()
    text = content.decode("latin1", errors="replace")

    raw_lines = [line.strip() for line in text.splitlines()]

    uncommented = [line for line in raw_lines if not line.startswith("@!")]
    while uncommented and not uncommented[0]: uncommented.pop(0)
    filtered_lines = uncommented[:3] + [line for line in uncommented[3:] if line]

    if len(filtered_lines) < 3:
        raise ValueError("Invalid RAW file: fewer than 3 lines.")

    # 1. Identification Line 1
    id_tokens = _split_tokens(filtered_lines[0])
    sbase = _clean_float(id_tokens[1] if len(id_tokens) > 1 else 100.0, 100.0)
    rev = _clean_str(id_tokens[2] if len(id_tokens) > 2 else "36")
    basfrq = _clean_float(id_tokens[5] if len(id_tokens) > 5 else 60.0, 60.0)

    if _clean_int(rev) not in (35, 36):
        raise ValueError("UNSUPPORTED RAW revision: only verified v35/v36 layouts are accepted")
    if len(id_tokens) < 6 or sbase <= 0:
        raise ValueError("Invalid RAW case identification")
    title1 = filtered_lines[1].strip()
    title2 = filtered_lines[2].strip()

    # State machine sequence for fallback when comments are absent
    fallback_sequence = [
        "BUS", "LOAD", "FIXED_SHUNT", "VOLTAGE_DROOP_CONTROL", "GENERATOR",
        "SWITCHING_DEVICE_RATING_SET", "BRANCH", "SYSTEM_SWITCHING_DEVICE",
        "TRANSFORMER", "AREA", "TWO_TERMINAL_DC", "VSC_DC_LINE",
        "IMPEDANCE_CORRECTION", "MULTI_TERMINAL_DC", "MULTI_SECTION_LINE",
        "ZONE", "INTER_AREA_TRANSFER", "OWNER", "FACTS_DEVICE",
        "SWITCHED_SHUNT", "GNE", "INDUCTION_MACHINE", "LOAD_TYPE",
        "INTERFACE", "INTERFACE_ELEMENT", "SUBSTATION"
    ]
    fallback_idx = 0

    sections: Dict[str, List[str]] = {}
    has_sys_wide = any("BEGIN BUS DATA" in line.upper() for line in filtered_lines[3:100])
    current_sec = "SYSTEM_WIDE" if has_sys_wide else "BUS"

    # Substation node-breaker block collections
    subs = []
    sub_nodes = []
    sub_switches = []
    current_sub_num = None
    sub_mode = "SUB"  # SUB, NODE, SWD, TRM

    for line in filtered_lines[3:]:
        if line.startswith("Q") or line.startswith("'Q'") or line.startswith('"Q"'):
            break

        # Delimiter line starts with 0
        if line.startswith("0") and ("/" in line or line.strip() == "0" or line.startswith("0,") or line.startswith("0 ")):
            comment = line.split("/", 1)[1].upper() if "/" in line else ""
            m = re.search(r"BEGIN\s+([A-Z0-9_\-\s]+?)(?:DATA|$)", comment)
            if m:
                sec_name = m.group(1).strip().replace(" ", "_").replace("-", "_")
                current_sec = sec_name
                if "SUBSTATION_NODE" in sec_name:
                    sub_mode = "NODE"
                elif "SUBSTATION_SWITCH" in sec_name:
                    sub_mode = "SWD"
                elif "SUBSTATION_TERMINAL" in sec_name:
                    sub_mode = "TRM"
                elif "SUBSTATION" in sec_name:
                    sub_mode = "SUB"
                continue
            elif "END OF SUBSTATION TERMINAL" in comment:
                sub_mode = "SUB"
                continue
            elif "END OF SUBSTATION" in comment:
                current_sec = "END"
                continue
            elif "END OF" in comment:
                # If delimiter has END OF without BEGIN, advance to next expected
                fallback_idx += 1
                if fallback_idx < len(fallback_sequence):
                    current_sec = fallback_sequence[fallback_idx]
                else:
                    current_sec = "END"
                continue
            else:
                # Bare '0 /' or '0' delimiter without comment
                fallback_idx += 1
                if fallback_idx < len(fallback_sequence):
                    current_sec = fallback_sequence[fallback_idx]
                else:
                    current_sec = "END"
                continue

        # In substation or its sub-blocks
        if current_sec in ("SUBSTATION", "SUBSTATION_NODE", "SUBSTATION_SWITCHING_DEVICE", "SUBSTATION_TERMINAL"):
            tok = _split_tokens(line)
            if not tok:
                continue
            if sub_mode == "SUB":
                current_sub_num = _clean_int(tok[0])
                subs.append({
                    "subNumber": current_sub_num,
                    "name": _clean_str(tok[1]),
                    "latitude": _clean_float(tok[2]) if len(tok) > 2 else None,
                    "longitude": _clean_float(tok[3]) if len(tok) > 3 else None,
                    "groundingResOhms": _clean_float(tok[4]) if len(tok) > 4 else None,
                })
                sub_mode = "NODE"
            elif sub_mode == "NODE":
                sub_nodes.append({
                    "subNumber": current_sub_num,
                    "nodeNumber": _clean_int(tok[0]),
                    "name": _clean_str(tok[1]),
                    "electricalBus": _clean_int(tok[2]),
                    "inService": bool(_clean_int(tok[3], 1) == 1) if len(tok) > 3 else True,
                    "vmPu": _clean_float(tok[4], 1.0) if len(tok) > 4 else None,
                    "vaDeg": _clean_float(tok[5], 0.0) if len(tok) > 5 else None,
                })
            elif sub_mode == "SWD":
                sub_switches.append({
                    "subNumber": current_sub_num,
                    "fromNode": _clean_int(tok[0]),
                    "toNode": _clean_int(tok[1]),
                    "circuitId": _clean_str(tok[2]) or "1",
                    "name": _clean_str(tok[3]) if len(tok) > 3 else "",
                    "switchType": _clean_int(tok[4], 1) if len(tok) > 4 else 1,
                    "isClosed": bool(_clean_int(tok[5], 1) == 1) if len(tok) > 5 else True,
                    "isNormalClosed": bool(_clean_int(tok[6], 1) == 1) if len(tok) > 6 else True,
                    "xPu": _clean_float(tok[7], 0.0001) if len(tok) > 7 else 0.0001,
                    "ratingMva": None,
                })
            elif sub_mode == "TRM":
                sections.setdefault("SUBSTATION_TERMINAL", []).append({"subNumber": current_sub_num, "record": line})
            continue

        if current_sec != "END":
            sections.setdefault(current_sec, []).append(line)

    minimums = {"BUS": 9, "LOAD": 13, "GENERATOR": 19, "BRANCH": 27, "FIXED_SHUNT": 5}
    for section, minimum in minimums.items():
        for record in sections.get(section, []):
            tokens = _split_tokens(record)
            if len(tokens) < minimum:
                raise ValueError(f"Truncated RAW {section} record: {len(tokens)} < {minimum}")
    for section, indices in {"BUS": (0,2,3,7,8), "LOAD": (0,5,6,7,8,9,10), "GENERATOR": (0,2,3,4,5,6,9), "BRANCH": (0,1,3,4,5)}.items():
        for record in sections.get(section, []):
            tokens = _split_tokens(record)
            if any(not tokens[i] for i in indices):
                raise ValueError(f"Missing required electrical RAW {section} value")
    # 1. Parse Buses
    buses = []
    bus_kv_map = {}
    for line in sections.get("BUS", []):
        tok = _split_tokens(line)
        if len(tok) >= 4:
            ibus = _clean_int(tok[0])
            name = _clean_str(tok[1])
            baskv = _clean_float(tok[2], 100.0)
            ide = _clean_int(tok[3], 1)
            area = _clean_int(tok[4], 1) if len(tok) > 4 else 1
            zone = _clean_int(tok[5], 1) if len(tok) > 5 else 1
            owner = _clean_int(tok[6], 1) if len(tok) > 6 else 1
            vm = _clean_float(tok[7], 1.0) if len(tok) > 7 else 1.0
            va = _clean_float(tok[8], 0.0) if len(tok) > 8 else 0.0
            nvhi = _clean_float(tok[9], 1.1) if len(tok) > 9 else 1.1
            nvlo = _clean_float(tok[10], 0.9) if len(tok) > 10 else 0.9
            evhi = _clean_float(tok[11], 1.1) if len(tok) > 11 else 1.1
            evlo = _clean_float(tok[12], 0.9) if len(tok) > 12 else 0.9

            bus_kv_map[ibus] = baskv
            buses.append({
                "ibus": ibus,
                "name": name,
                "baskv": baskv,
                "ide": ide,
                "area": area,
                "zone": zone,
                "owner": owner,
                "vmPu": vm,
                "vaDeg": va,
                "normalMaxPu": nvhi,
                "normalMinPu": nvlo,
                "emergencyMaxPu": evhi,
                "emergencyMinPu": evlo,
            })

    # 2. Parse Loads
    loads = []
    for line in sections.get("LOAD", []):
        tok = _split_tokens(line)
        if len(tok) >= 6:
            ibus = _clean_int(tok[0])
            loadid = _clean_str(tok[1]) or "1"
            stat = _clean_int(tok[2], 1)
            area = _clean_int(tok[3], 1) if len(tok) > 3 else 1
            zone = _clean_int(tok[4], 1) if len(tok) > 4 else 1
            pl = _clean_float(tok[5], 0.0) if len(tok) > 5 else 0.0
            ql = _clean_float(tok[6], 0.0) if len(tok) > 6 else 0.0
            ip = _clean_float(tok[7], 0.0) if len(tok) > 7 else 0.0
            iq = _clean_float(tok[8], 0.0) if len(tok) > 8 else 0.0
            yp = _clean_float(tok[9], 0.0) if len(tok) > 9 else 0.0
            yq = _clean_float(tok[10], 0.0) if len(tok) > 10 else 0.0
            owner = _clean_int(tok[11], 1) if len(tok) > 11 else 1
            scale = bool(_clean_int(tok[12], 1) == 1) if len(tok) > 12 else True
            intrpt = bool(_clean_int(tok[13], 0) == 1) if len(tok) > 13 else False
            name = _clean_str(tok[18]) if len(tok) > 18 else (_clean_str(tok[-1]) if len(tok) > 14 and not tok[-1].isdigit() else "")

            loads.append({
                "ibus": ibus,
                "loadid": loadid,
                "inService": bool(stat == 1),
                "area": area,
                "zone": zone,
                "pMw": pl,
                "qMvar": ql,
                "pCurrentMw": ip,
                "qCurrentMvar": iq,
                "pAdmittanceMw": yp,
                "qAdmittanceMvar": yq,
                "owner": owner,
                "isScalable": scale,
                "isInterruptible": intrpt,
                "name": name,
            })

    # 3. Parse Fixed Shunts
    fixed_shunts = []
    for line in sections.get("FIXED_SHUNT", []):
        tok = _split_tokens(line)
        if len(tok) >= 5:
            fixed_shunts.append({
                "ibus": _clean_int(tok[0]),
                "shuntId": _clean_str(tok[1]) or "1",
                "inService": bool(_clean_int(tok[2], 1) == 1),
                "gMw": _clean_float(tok[3], 0.0),
                "bMvar": _clean_float(tok[4], 0.0),
                "name": _clean_str(tok[5]) if len(tok) > 5 else "",
            })

    # 4. Parse Generators
    generators = []
    for line in sections.get("GENERATOR", []):
        tok = _split_tokens(line)
        if len(tok) >= 7:
            ibus = _clean_int(tok[0])
            machid = _clean_str(tok[1]) or "1"
            pg = _clean_float(tok[2], 0.0)
            qg = _clean_float(tok[3], 0.0)
            qt = _clean_float(tok[4], 9999.0)
            qb = _clean_float(tok[5], -9999.0)
            vs = _clean_float(tok[6], 1.0)
            ireg = _clean_int(tok[7], ibus) if len(tok) > 7 else ibus
            nreg = _clean_int(tok[8], 0) if len(tok) > 8 else 0
            mbase = _clean_float(tok[9], 100.0) if len(tok) > 9 else 100.0
            zr = _clean_float(tok[10], 0.0) if len(tok) > 10 else 0.0
            zx = _clean_float(tok[11], 0.0) if len(tok) > 11 else 0.0
            stat = _clean_int(tok[15], 1) if len(tok) > 15 else 1
            rmpct = _clean_float(tok[16], 100.0) if len(tok) > 16 else 100.0
            pt = _clean_float(tok[17], 9999.0) if len(tok) > 17 else 9999.0
            pb = _clean_float(tok[18], 0.0) if len(tok) > 18 else 0.0
            wmod = _clean_int(tok[28], 0) if len(tok) > 28 else 0
            wpf = _clean_float(tok[29], 1.0) if len(tok) > 29 else 1.0
            name = _clean_str(tok[-1]) if len(tok) > 20 and not tok[-1].replace('.', '', 1).isdigit() else ""

            generators.append({
                "ibus": ibus,
                "machid": machid,
                "inService": bool(stat == 1),
                "pMw": pg,
                "qMvar": qg,
                "qMaxMvar": qt,
                "qMinMvar": qb,
                "pMaxMw": pt,
                "pMinMw": pb,
                "vsPu": vs,
                "mbaseMva": mbase,
                "remoteBus": ireg,
                "remoteNode": nreg,
                "remotePct": rmpct,
                "zrPu": zr,
                "zxPu": zx,
                "name": name,
                "windMode": wmod,
                "windPowerFactor": wpf,
            })

    # 5. Parse Branches (AC lines)
    branches = []
    for line in sections.get("BRANCH", []):
        tok = _split_tokens(line)
        if len(tok) >= 6:
            from_b = _clean_int(tok[0])
            to_b = _clean_int(tok[1])
            ckt = _clean_str(tok[2]) or "1"
            r = _clean_float(tok[3])
            x = _clean_float(tok[4])
            b = _clean_float(tok[5])

            name = _clean_str(tok[6])
            rate_start = 7

            rates = []
            for r_idx in range(rate_start, min(len(tok), rate_start + 12)):
                rates.append(_clean_float(tok[r_idx], 0.0))
            while len(rates) < 12:
                rates.append(0.0)

            rate_a = rates[0] if rates and rates[0] > 0 else None

            # After 12 rates: GI, BI, GJ, BJ, STAT, MET, LEN
            idx_after = rate_start + 12
            gi = _clean_float(tok[idx_after], 0.0) if len(tok) > idx_after else 0.0
            bi = _clean_float(tok[idx_after + 1], 0.0) if len(tok) > idx_after + 1 else 0.0
            gj = _clean_float(tok[idx_after + 2], 0.0) if len(tok) > idx_after + 2 else 0.0
            bj = _clean_float(tok[idx_after + 3], 0.0) if len(tok) > idx_after + 3 else 0.0
            stat = _clean_int(tok[idx_after + 4], 1) if len(tok) > idx_after + 4 else 1
            bp = _clean_int(tok[idx_after + 5], 0) if len(tok) > idx_after + 5 else 0
            met = _clean_int(tok[idx_after + 6], 1) if len(tok) > idx_after + 6 else 1
            length = _clean_float(tok[idx_after + 7], 0.0) if len(tok) > idx_after + 7 else 0.0

            branches.append({
                "fromBus": from_b,
                "toBus": to_b,
                "circuitId": ckt,
                "inService": bool(stat == 1),
                "rPu": r,
                "xPu": x,
                "bPu": b,
                "rateMva": rate_a,
                "rateSet": rates,
                "fromShuntGpu": gi,
                "fromShuntBpu": bi,
                "toShuntGpu": gj,
                "toShuntBpu": bj,
                "lengthKm": length,
                "name": name,
                "isBypassed": bool(bp),
                "meteredBus": met,
            })

    # 6. Parse Transformers
    transformers = []
    tr_lines = sections.get("TRANSFORMER", [])
    t_idx = 0
    while t_idx < len(tr_lines):
        line1_tok = _split_tokens(tr_lines[t_idx])
        if len(line1_tok) < 3:
            t_idx += 1
            continue

        from_b = _clean_int(line1_tok[0])
        to_b = _clean_int(line1_tok[1])
        k_bus = _clean_int(line1_tok[2], 0)
        ckt = _clean_str(line1_tok[3]) or "1" if len(line1_tok) > 3 else "1"
        is_3w = (k_bus > 0)
        lines_per_tfr = 5 if is_3w else 4

        if from_b not in bus_kv_map or to_b not in bus_kv_map or (is_3w and k_bus not in bus_kv_map):
            raise ValueError("Transformer references missing bus; no voltage base guessed")
        cw = _clean_int(line1_tok[4], 1) if len(line1_tok) > 4 else 1
        cz = _clean_int(line1_tok[5], 1) if len(line1_tok) > 5 else 1
        cm = _clean_int(line1_tok[6], 1) if len(line1_tok) > 6 else 1
        mag1 = _clean_float(line1_tok[7], 0.0) if len(line1_tok) > 7 else 0.0
        mag2 = _clean_float(line1_tok[8], 0.0) if len(line1_tok) > 8 else 0.0
        name = _clean_str(line1_tok[10]) if len(line1_tok) > 10 else ""
        stat = _clean_int(line1_tok[11], 1) if len(line1_tok) > 11 else 1
        vecgrp = _clean_str(line1_tok[20]) if len(line1_tok) > 20 else ""

        if t_idx + lines_per_tfr - 1 < len(tr_lines):
            line2_tok = _split_tokens(tr_lines[t_idx + 1])
            line3_tok = _split_tokens(tr_lines[t_idx + 2])
            line4_tok = _split_tokens(tr_lines[t_idx + 3])
            line5_tok = _split_tokens(tr_lines[t_idx + 4]) if is_3w else []

            r12 = _clean_float(line2_tok[0]) if len(line2_tok) > 0 else 0.0
            x12 = _clean_float(line2_tok[1]) if len(line2_tok) > 1 else 0.0
            s12 = _clean_float(line2_tok[2], 100.0) if len(line2_tok) > 2 else 100.0
            r12_sys, x12_sys = _convert_transformer_impedance(r12, x12, s12, cz, sbase)

            if is_3w:
                r23 = _clean_float(line2_tok[3]) if len(line2_tok) > 3 else 0.0
                x23 = _clean_float(line2_tok[4]) if len(line2_tok) > 4 else 0.0
                s23 = _clean_float(line2_tok[5], 100.0) if len(line2_tok) > 5 else 100.0
                r23_sys, x23_sys = _convert_transformer_impedance(r23, x23, s23, cz, sbase)

                r31 = _clean_float(line2_tok[6]) if len(line2_tok) > 6 else 0.0
                x31 = _clean_float(line2_tok[7]) if len(line2_tok) > 7 else 0.0
                s31 = _clean_float(line2_tok[8], 100.0) if len(line2_tok) > 8 else 100.0
                r31_sys, x31_sys = _convert_transformer_impedance(r31, x31, s31, cz, sbase)
                vmstar = _clean_float(line2_tok[9], 1.0) if len(line2_tok) > 9 else 1.0
                anstar = _clean_float(line2_tok[10], 0.0) if len(line2_tok) > 10 else 0.0
            else:
                r23_sys, x23_sys, s23 = None, None, None
                r31_sys, x31_sys, s31 = None, None, None
                vmstar, anstar = None, None

            # Winding 1
            w1_raw = _clean_float(line3_tok[0], 1.0) if len(line3_tok) > 0 else 1.0
            nomv1 = _clean_float(line3_tok[1], 0.0) if len(line3_tok) > 1 else 0.0
            ang1 = _clean_float(line3_tok[2], 0.0) if len(line3_tok) > 2 else 0.0
            base_kv1 = bus_kv_map.get(from_b, 100.0)
            ratio1 = winding_ratio(w1_raw, nomv1, base_kv1, cw)

            w1_rates = [_clean_float(line3_tok[k], 0.0) for k in range(3, min(len(line3_tok), 15))]
            while len(w1_rates) < 12:
                w1_rates.append(0.0)

            cod1 = _clean_int(line3_tok[15], 0) if len(line3_tok) > 15 else 0
            cont1 = _clean_int(line3_tok[16], 0) if len(line3_tok) > 16 else 0
            rma1 = _clean_float(line3_tok[18], 1.1) if len(line3_tok) > 18 else 1.1
            rmi1 = _clean_float(line3_tok[19], 0.9) if len(line3_tok) > 19 else 0.9
            vma1 = _clean_float(line3_tok[20], 1.1) if len(line3_tok) > 20 else 1.1
            vmi1 = _clean_float(line3_tok[21], 0.9) if len(line3_tok) > 21 else 0.9
            ntp1 = _clean_int(line3_tok[22], 33) if len(line3_tok) > 22 else 33

            # Winding 2
            w2_raw = _clean_float(line4_tok[0], 1.0) if len(line4_tok) > 0 else 1.0
            nomv2 = _clean_float(line4_tok[1], 0.0) if len(line4_tok) > 1 else 0.0
            ang2 = _clean_float(line4_tok[2], 0.0) if len(line4_tok) > 2 else 0.0
            base_kv2 = bus_kv_map.get(to_b, 100.0)
            ratio2 = winding_ratio(w2_raw, nomv2, base_kv2, cw)
            w2_rates = [_clean_float(line4_tok[k], 0.0) for k in range(3, min(len(line4_tok), 15))]
            while len(w2_rates) < 12:
                w2_rates.append(0.0)

            # Winding 3
            w3 = None
            if is_3w and line5_tok:
                w3_raw = _clean_float(line5_tok[0], 1.0) if len(line5_tok) > 0 else 1.0
                nomv3 = _clean_float(line5_tok[1], 0.0) if len(line5_tok) > 1 else 0.0
                ang3 = _clean_float(line5_tok[2], 0.0) if len(line5_tok) > 2 else 0.0
                base_kv3 = bus_kv_map.get(k_bus, 100.0)
                ratio3 = winding_ratio(w3_raw, nomv3, base_kv3, cw)
                w3_rates = [_clean_float(line5_tok[k], 0.0) for k in range(3, min(len(line5_tok), 15))]
                while len(w3_rates) < 12:
                    w3_rates.append(0.0)
                w3 = {
                    "ratioPu": ratio3,
                    "nominalKv": nomv3,
                    "angleDeg": ang3,
                    "rateMva": w3_rates[0] if w3_rates[0] > 0 else None,
                    "rateSet": w3_rates,
                }

            mag_g, mag_b = magnetizing_admittance(mag1, mag2, cm, s12, sbase, nomv1, base_kv1)
            transformers.append({
                "sourceEncoding": {"cw": cw, "cz": cz, "cm": cm},
                "statusCode": stat,
                "fromBus": from_b,
                "toBus": to_b,
                "tertiaryBus": k_bus if is_3w else None,
                "circuitId": ckt,
                "inService": bool(stat != 0),
                "isThreeWinding": is_3w,
                "name": name,
                "vectorGroup": vecgrp,
                "controlMode": cod1,
                "controlledBus": cont1,
                "winding1": {
                    "ratioPu": ratio1,
                    "nominalKv": nomv1,
                    "angleDeg": ang1,
                    "rateMva": w1_rates[0] if w1_rates[0] > 0 else None,
                    "rateSet": w1_rates,
                    "rMaxPu": rma1,
                    "rMinPu": rmi1,
                    "vMax": vma1,
                    "vMin": vmi1,
                    "numTaps": ntp1,
                },
                "winding2": {
                    "ratioPu": ratio2,
                    "nominalKv": nomv2,
                    "angleDeg": ang2,
                    "rateMva": w2_rates[0] if w2_rates[0] > 0 else None,
                    "rateSet": w2_rates,
                },
                "winding3": w3,
                "impedance": {
                    "r12Pu": r12_sys,
                    "x12Pu": x12_sys,
                    "sbase12Mva": s12,
                    "r23Pu": r23_sys,
                    "x23Pu": x23_sys,
                    "sbase23Mva": s23,
                    "r31Pu": r31_sys,
                    "x31Pu": x31_sys,
                    "sbase31Mva": s31,
                },
                "magnetizing": {"gPu": mag_g, "bPu": mag_b},
                "vmStar": vmstar,
                "anStar": anstar,
            })
            for wn, tokens in ((1,line3_tok),(2,line4_tok),(3,line5_tok)):
                if wn > 1 and not is_3w: continue
                winding = transformers[-1]["winding"+str(wn)]
                for key, idx in {"controlMode":15,"controlledBus":16,"remoteNode":17,"impedanceTable":23}.items():
                    winding[key] = _clean_int(tokens[idx]) if len(tokens)>idx else 0
                if wn > 1:
                    for key,idx in {"rMaxPu":18,"rMinPu":19,"vMax":20,"vMin":21}.items():
                        winding[key] = _clean_float(tokens[idx]) if len(tokens)>idx else None
                    winding["numTaps"] = _clean_int(tokens[22]) if len(tokens)>22 else None
            t_idx += lines_per_tfr
        else:
            raise ValueError("Truncated transformer record")

    # 7. Parse Switched Shunts
    switched_shunts = []
    for line in sections.get("SWITCHED_SHUNT", []):
        tok = _split_tokens(line)
        if len(tok) >= 5:
            ibus = _clean_int(tok[0])
            modsw = _clean_int(tok[2], 1) if len(tok) > 2 else 1
            adjm = _clean_int(tok[3], 0) if len(tok) > 3 else 0
            stat = _clean_int(tok[4], 1) if len(tok) > 4 else 1
            vswhi = _clean_float(tok[5], 1.05) if len(tok) > 5 else 1.05
            vswlo = _clean_float(tok[6], 0.95) if len(tok) > 6 else 0.95
            swreg = _clean_int(tok[7], ibus) if len(tok) > 7 else ibus
            binit = _clean_float(tok[11], 0.0) if len(tok) > 11 else 0.0
            name = _clean_str(tok[12]) if len(tok) > 12 else ""

            blocks = []
            # Blocks of 3 tokens: (S_i, N_i, B_i) starting at index 13
            b_offset = 13
            while b_offset + 2 < len(tok):
                s_on = _clean_int(tok[b_offset], 1)
                n_step = _clean_int(tok[b_offset + 1], 0)
                b_step = _clean_float(tok[b_offset + 2], 0.0)
                if n_step > 0:
                    blocks.append({
                        "inService": bool(s_on > 0),
                        "numSteps": n_step,
                        "stepBMvar": b_step,
                    })
                b_offset += 3

            switched_shunts.append({
                "ibus": ibus,
                "shuntId": _clean_str(tok[1]) or "1",
                "inService": bool(stat == 1),
                "controlMode": modsw,
                "bInitMvar": binit,
                "vHighPu": vswhi,
                "vLowPu": vswlo,
                "controlledBus": swreg,
                "name": name,
                "blocks": blocks,
            })

    # 8. Parse Areas, Zones, Owners
    areas = []
    for line in sections.get("AREA", []):
        tok = _split_tokens(line)
        if tok:
            areas.append({
                "areaNumber": _clean_int(tok[0]),
                "slackBus": _clean_int(tok[1]) if len(tok) > 1 else 0,
                "desiredExportMw": _clean_float(tok[2]) if len(tok) > 2 else 0.0,
                "toleranceMw": _clean_float(tok[3]) if len(tok) > 3 else 10.0,
                "areaName": _clean_str(tok[4]) if len(tok) > 4 else "",
            })

    zones = []
    for line in sections.get("ZONE", []):
        tok = _split_tokens(line)
        if tok:
            zones.append({
                "zoneNumber": _clean_int(tok[0]),
                "zoneName": _clean_str(tok[1]) if len(tok) > 1 else "",
            })

    owners = []
    for line in sections.get("OWNER", []):
        tok = _split_tokens(line)
        if tok:
            owners.append({
                "ownerNumber": _clean_int(tok[0]),
                "ownerName": _clean_str(tok[1]) if len(tok) > 1 else "",
            })

    # 9. Audit Unsupported Equipment
    unsupported_sections_map = {
        "SUBSTATION_TERMINAL": "SubstationTerminal",
        "SYSTEM_SWITCHING_DEVICE": "SystemSwitchingDevice",
        "VOLTAGE_DROOP_CONTROL": "VoltageDroopControl",
        "TWO_TERMINAL_DC": "TwoTerminalDcLine",
        "VSC_DC_LINE": "VscDcLine",
        "IMPEDANCE_CORRECTION": "ImpedanceCorrectionTable",
        "MULTI_TERMINAL_DC": "MultiTerminalDcLine",
        "FACTS_DEVICE": "FactsDevice",
        "GNE": "GneDevice",
        "INDUCTION_MACHINE": "InductionMachine",
    }

    unsupported_equipment = []
    for sec_key, sec_class in unsupported_sections_map.items():
        lines_in_sec = sections.get(sec_key, [])
        if lines_in_sec:
            unsupported_equipment.append({
                "sourceClass": sec_class,
                "count": len(lines_in_sec),
                "details": f"{len(lines_in_sec)} records in RAW section {sec_key}",
            })

    fidelity = "PARTIAL" if unsupported_equipment else "SOURCE_EXACT"

    now_utc = datetime.datetime.now(datetime.timezone.utc).isoformat()
    return {
        "schemaVersion": "ga-psse-bridge/1",
        "metadata": {
            "sourceFile": os.path.basename(raw_path),
            "sourceSha256": file_sha256,
            "sourceFormat": "RAW",
            "extractionMethod": "standalone-raw-parser",
            "psseRelease": rev,
            "timestampUtc": now_utc,
            "sourceFidelity": fidelity,
            "bridgeRevision": "1.1",
            "impedanceBase": "SYSTEM_MVA",
            "impedanceVoltageBase": "NOMINAL_WINDING_KV",
            "parserScope": "PSS/E revision 35-36; unsupported source records retained; capability gate required",
            "unsupportedEquipment": unsupported_equipment,
            "diagnostics": [
                {
                    "level": "INFO" if not unsupported_equipment else "WARNING",
                    "code": "RAW_PARSER_SUCCESS" if not unsupported_equipment else "UNSUPPORTED_EQUIPMENT_PRESENT",
                    "message": f"Parsed {len(buses)} buses, {len(branches)} branches, {len(transformers)} transformers from RAW text" + (f" ({len(unsupported_equipment)} unsupported classes)" if unsupported_equipment else ""),
                }
            ],
        },
        "caseIdentification": {
            "sbaseMva": sbase,
            "baseFrequencyHz": basfrq,
            "titleLine1": title1,
            "titleLine2": title2,
            "psseVersion": rev,
            "solutionStatus": {"isSolved": False, "state": "UNKNOWN", "solutionMethod": "UNVERIFIED_RAW"},
        },
        "network": {
            "sourceSections": sections,
            "buses": buses,
            "loads": loads,
            "generators": generators,
            "branches": branches,
            "transformers": transformers,
            "fixedShunts": fixed_shunts,
            "switchedShunts": switched_shunts,
            "substations": subs,
            "substationNodes": sub_nodes,
            "substationSwitches": sub_switches,
            "areas": areas,
            "zones": zones,
            "owners": owners,
        },
    }


class RawParser:
    """Wrapper class providing a unified interface for RAW text files."""

    def __init__(self, raw_path: str):
        self.raw_path = raw_path
        self._parsed: Optional[Dict[str, Any]] = None

    def to_bridge_dict(self) -> Dict[str, Any]:
        if self._parsed is None:
            self._parsed = parse_raw_file(self.raw_path)
        return self._parsed
