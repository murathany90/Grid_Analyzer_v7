"""Pure-Python PSS(R)E RAWX parser (zero DLL dependencies).

Reads standard PSS(R)E v34-v36 RAWX JSON files and converts them
into the ga-psse-bridge-v1 data contract dictionary.
Works on any platform (Linux, macOS, Windows) without Siemens installation.
"""
import datetime
import hashlib
import json
import math
import os
from typing import Any, Dict, List, Optional


from .electrical import transformer_impedance as _convert_transformer_impedance
from .electrical import winding_ratio, magnetizing_admittance

def _clean_str(val: Any) -> str:
    if val is None:
        return ""
    return str(val).strip()


def _clean_float(val: Any, default: float = 0.0) -> float:
    if val is None:
        return default
    try:
        f = float(val)
        if f != f or f in (float("inf"), float("-inf")):
            raise ValueError("Non-finite numeric input")
        return f
    except (ValueError, TypeError) as exc:
        raise ValueError(f"Invalid numeric input: {val!r}") from exc


def _clean_int(val: Any, default: int = 0) -> int:
    if val is None:
        return default
    try:
        return int(val)
    except (ValueError, TypeError) as exc:
        raise ValueError(f"Invalid numeric input: {val!r}") from exc


def parse_rawx_file(rawx_path: str) -> Dict[str, Any]:
    """Parses a PSS(R)E RAWX file into a ga-psse-bridge-v1 dictionary."""
    rawx_path = os.path.abspath(rawx_path)
    if not os.path.isfile(rawx_path):
        raise FileNotFoundError(f"RAWX file not found: {rawx_path}")

    with open(rawx_path, "rb") as f:
        content = f.read()

    file_sha256 = hashlib.sha256(content).hexdigest()
    text = content.decode("utf-8-sig", errors="replace")
    def reject_constant(value):
        raise ValueError("Non-finite RAWX JSON constant: " + value)
    data = json.loads(text, parse_constant=reject_constant)

    net = data.get("network", {})
    gen_info = data.get("general", {})
    psse_ver = str(gen_info.get("version", "36.5"))

    from .parser_guards import check_rawx
    check_rawx(net)
    # 1. Case Identification
    caseid_table = net.get("caseid", {})
    c_fields = caseid_table.get("fields", [])
    c_data = caseid_table.get("data", [])
    c_dict = dict(zip(c_fields, c_data)) if c_fields and c_data else {}

    sbase = _clean_float(c_dict.get("sbase", 100.0), 100.0)
    basfrq = _clean_float(c_dict.get("basfrq", 60.0), 60.0)
    title1 = _clean_str(c_dict.get("title1", "PSS(R)E RAWX Case"))
    title2 = _clean_str(c_dict.get("title2", ""))

    # 2. Buses
    bus_table = net.get("bus", {})
    b_fields = bus_table.get("fields", [])
    b_rows = bus_table.get("data", [])
    buses = []
    bus_kv_map = {}

    for row in b_rows:
        d = dict(zip(b_fields, row))
        ibus = _clean_int(d.get("ibus"))
        baskv = _clean_float(d.get("baskv", 100.0), 100.0)
        bus_kv_map[ibus] = baskv

        buses.append({
            "ibus": ibus,
            "name": _clean_str(d.get("name")),
            "baskv": baskv,
            "ide": _clean_int(d.get("ide", 1), 1),
            "area": _clean_int(d.get("area", 1), 1),
            "zone": _clean_int(d.get("zone", 1), 1),
            "owner": _clean_int(d.get("owner", 1), 1),
            "vmPu": _clean_float(d.get("vm", 1.0), 1.0),
            "vaDeg": _clean_float(d.get("va", 0.0), 0.0),
            "normalMaxPu": _clean_float(d.get("nvhi", 1.1), 1.1),
            "normalMinPu": _clean_float(d.get("nvlo", 0.9), 0.9),
            "emergencyMaxPu": _clean_float(d.get("evhi", 1.1), 1.1),
            "emergencyMinPu": _clean_float(d.get("evlo", 0.9), 0.9),
        })

    # 3. Loads
    load_table = net.get("load", {})
    l_fields = load_table.get("fields", [])
    l_rows = load_table.get("data", [])
    loads = []

    for row in l_rows:
        d = dict(zip(l_fields, row))
        loads.append({
            "ibus": _clean_int(d.get("ibus")),
            "loadid": _clean_str(d.get("loadid", "1")) or "1",
            "inService": bool(_clean_int(d.get("stat", 1), 1) == 1),
            "area": _clean_int(d.get("area", 1), 1),
            "zone": _clean_int(d.get("zone", 1), 1),
            "pMw": _clean_float(d.get("pl", 0.0)),
            "qMvar": _clean_float(d.get("ql", 0.0)),
            "pCurrentMw": _clean_float(d.get("ip", 0.0)),
            "qCurrentMvar": _clean_float(d.get("iq", 0.0)),
            "pAdmittanceMw": _clean_float(d.get("yp", 0.0)),
            "qAdmittanceMvar": _clean_float(d.get("yq", 0.0)),
            "owner": _clean_int(d.get("owner", 1), 1),
            "isScalable": bool(_clean_int(d.get("scale", 1), 1) == 1),
            "isInterruptible": bool(_clean_int(d.get("intrpt", 0), 0) == 1),
            "name": _clean_str(d.get("name", "")),
        })

    # 4. Fixed Shunts
    fsh_table = net.get("fixshunt", {})
    fsh_fields = fsh_table.get("fields", [])
    fsh_rows = fsh_table.get("data", [])
    fixed_shunts = []

    for row in fsh_rows:
        d = dict(zip(fsh_fields, row))
        fixed_shunts.append({
            "ibus": _clean_int(d.get("ibus")),
            "shuntId": _clean_str(d.get("shntid", "1")) or "1",
            "inService": bool(_clean_int(d.get("stat", 1), 1) == 1),
            "gMw": _clean_float(d.get("gl", 0.0)),
            "bMvar": _clean_float(d.get("bl", 0.0)),
            "name": _clean_str(d.get("name", "")),
        })

    # 5. Generators
    gen_table = net.get("generator", {})
    g_fields = gen_table.get("fields", [])
    g_rows = gen_table.get("data", [])
    generators = []

    for row in g_rows:
        d = dict(zip(g_fields, row))
        ibus = _clean_int(d.get("ibus"))
        generators.append({
            "ibus": ibus,
            "machid": _clean_str(d.get("machid", "1")) or "1",
            "inService": bool(_clean_int(d.get("stat", 1), 1) == 1),
            "pMw": _clean_float(d.get("pg", 0.0)),
            "qMvar": _clean_float(d.get("qg", 0.0)),
            "qMaxMvar": _clean_float(d.get("qt", 9999.0), 9999.0),
            "qMinMvar": _clean_float(d.get("qb", -9999.0), -9999.0),
            "pMaxMw": _clean_float(d.get("pt", 9999.0), 9999.0),
            "pMinMw": _clean_float(d.get("pb", 0.0), 0.0),
            "vsPu": _clean_float(d.get("vs", 1.0), 1.0),
            "mbaseMva": _clean_float(d.get("mbase", 100.0), 100.0),
            "remoteBus": _clean_int(d.get("ireg", ibus), ibus),
            "remoteNode": _clean_int(d.get("nreg", 0), 0),
            "remotePct": _clean_float(d.get("rmpct", 100.0), 100.0),
            "zrPu": _clean_float(d.get("zr", 0.0)),
            "zxPu": _clean_float(d.get("zx", 0.0)),
            "name": _clean_str(d.get("name", "")),
            "windMode": _clean_int(d.get("wmod", 0), 0),
            "windPowerFactor": _clean_float(d.get("wpf", 1.0), 1.0),
        })

    # 6. AC Lines / Branches
    brn_table = net.get("acline", {})
    br_fields = brn_table.get("fields", [])
    br_rows = brn_table.get("data", [])
    branches = []

    for row in br_rows:
        d = dict(zip(br_fields, row))
        from_b = _clean_int(d.get("ibus"))
        rates = [_clean_float(d.get(f"rate{k}", 0.0)) for k in range(1, 13)]
        rate_a = rates[0] if rates and rates[0] > 0 else None

        branches.append({
            "fromBus": from_b,
            "toBus": _clean_int(d.get("jbus")),
            "circuitId": _clean_str(d.get("ckt", "1")) or "1",
            "inService": bool(_clean_int(d.get("stat", 1), 1) == 1),
            "rPu": _clean_float(d.get("rpu", 0.0)),
            "xPu": _clean_float(d.get("xpu", 0.0)),
            "bPu": _clean_float(d.get("bpu", 0.0)),
            "rateMva": rate_a,
            "rateSet": rates,
            "fromShuntGpu": _clean_float(d.get("gi", 0.0)),
            "fromShuntBpu": _clean_float(d.get("bi", 0.0)),
            "toShuntGpu": _clean_float(d.get("gj", 0.0)),
            "toShuntBpu": _clean_float(d.get("bj", 0.0)),
            "lengthKm": _clean_float(d.get("len", 0.0)),
            "name": _clean_str(d.get("name", "")),
            "isBypassed": bool(_clean_int(d.get("bp", 0), 0) == 1),
            "meteredBus": _clean_int(d.get("met", from_b), from_b),
        })

    # 7. Transformers
    tr_table = net.get("transformer", {})
    tr_fields = tr_table.get("fields", [])
    tr_rows = tr_table.get("data", [])
    transformers = []

    for row in tr_rows:
        d = dict(zip(tr_fields, row))
        from_b = _clean_int(d.get("ibus"))
        to_b = _clean_int(d.get("jbus"))
        k_bus = _clean_int(d.get("kbus", 0), 0)
        is_3w = (k_bus > 0)

        if from_b not in bus_kv_map or to_b not in bus_kv_map or (is_3w and k_bus not in bus_kv_map):
            raise ValueError("Transformer references missing bus; no voltage base guessed")
        cw = _clean_int(d.get("cw", 1), 1)
        cz = _clean_int(d.get("cz", 1), 1)
        cm = _clean_int(d.get("cm", 1), 1)
        base_kv1 = bus_kv_map.get(from_b, 100.0)

        w1_raw = _clean_float(d.get("windv1", 1.0), 1.0)
        w2_raw = _clean_float(d.get("windv2", 1.0), 1.0)
        w3_raw = _clean_float(d.get("windv3", 1.0), 1.0)

        # Turns ratio: if cw == 2, entered as nominal kV; ratio = windv / baskv
        r1_pu = winding_ratio(w1_raw, _clean_float(d.get("nomv1", 0)), base_kv1, cw)
        base_kv2 = bus_kv_map.get(to_b, 100.0)
        r2_pu = winding_ratio(w2_raw, _clean_float(d.get("nomv2", 0)), base_kv2, cw)
        base_kv3 = bus_kv_map.get(k_bus, 100.0) if is_3w else 100.0
        r3_pu = winding_ratio(w3_raw, _clean_float(d.get("nomv3", 0)), base_kv3, cw) if is_3w else None

        r1_rates = [_clean_float(d.get(f"wdg1rate{k}", 0.0)) for k in range(1, 13)]
        r2_rates = [_clean_float(d.get(f"wdg2rate{k}", 0.0)) for k in range(1, 13)]
        r3_rates = [_clean_float(d.get(f"wdg3rate{k}", 0.0)) for k in range(1, 13)] if is_3w else [0.0]*12

        s12 = _clean_float(d.get("sbase1_2", 100.0) or d.get("sbase12", 100.0), 100.0)
        r12 = _clean_float(d.get("r1_2") or d.get("r12", 0.0))
        x12 = _clean_float(d.get("x1_2") or d.get("x12", 0.0))
        r12_sys, x12_sys = _convert_transformer_impedance(r12, x12, s12, cz, sbase)

        if is_3w:
            s23 = _clean_float(d.get("sbase2_3", 100.0) or d.get("sbase23", 100.0), 100.0)
            r23 = _clean_float(d.get("r2_3") or d.get("r23", 0.0))
            x23 = _clean_float(d.get("x2_3") or d.get("x23", 0.0))
            r23_sys, x23_sys = _convert_transformer_impedance(r23, x23, s23, cz, sbase)

            s31 = _clean_float(d.get("sbase3_1", 100.0) or d.get("sbase31", 100.0), 100.0)
            r31 = _clean_float(d.get("r3_1") or d.get("r31", 0.0))
            x31 = _clean_float(d.get("x3_1") or d.get("x31", 0.0))
            r31_sys, x31_sys = _convert_transformer_impedance(r31, x31, s31, cz, sbase)
        else:
            s23, r23_sys, x23_sys = None, None, None
            s31, r31_sys, x31_sys = None, None, None

        w1 = {
            "ratioPu": r1_pu,
            "nominalKv": _clean_float(d.get("nomv1", 0.0)),
            "angleDeg": _clean_float(d.get("ang1", 0.0)),
            "rateMva": r1_rates[0] if r1_rates and r1_rates[0] > 0 else None,
            "rateSet": r1_rates,
            "rMaxPu": _clean_float(d.get("rma1", 1.1), 1.1),
            "rMinPu": _clean_float(d.get("rmi1", 0.9), 0.9),
            "vMax": _clean_float(d.get("vma1", 1.1), 1.1),
            "vMin": _clean_float(d.get("vmi1", 0.9), 0.9),
            "numTaps": _clean_int(d.get("ntp1", 33), 33),
        }
        w2 = {
            "ratioPu": r2_pu,
            "nominalKv": _clean_float(d.get("nomv2", 0.0)),
            "angleDeg": _clean_float(d.get("ang2", 0.0)),
            "rateMva": r2_rates[0] if r2_rates and r2_rates[0] > 0 else None,
            "rateSet": r2_rates,
        }
        w3 = None
        if is_3w:
            w3 = {
                "ratioPu": r3_pu,
                "nominalKv": _clean_float(d.get("nomv3", 0.0)),
                "angleDeg": _clean_float(d.get("ang3", 0.0)),
                "rateMva": r3_rates[0] if r3_rates and r3_rates[0] > 0 else None,
                "rateSet": r3_rates,
            }

        transformers.append({
            "fromBus": from_b,
            "toBus": to_b,
            "sourceEncoding": {"cw": cw, "cz": cz, "cm": cm},
            "statusCode": _clean_int(d.get("stat", 1)),
            "tertiaryBus": k_bus if is_3w else None,
            "circuitId": _clean_str(d.get("ckt", "1")) or "1",
            "inService": bool(_clean_int(d.get("stat", 1), 1) != 0),
            "isThreeWinding": is_3w,
            "name": _clean_str(d.get("name", "")),
            "vectorGroup": _clean_str(d.get("vecgrp", "")),
            "controlMode": _clean_int(d.get("cod1", 0), 0),
            "controlledBus": _clean_int(d.get("cont1", 0), 0),
            "winding1": w1,
            "winding2": w2,
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
            "magnetizing": {
                "gPu": magnetizing_admittance(_clean_float(d.get("mag1", 0)), _clean_float(d.get("mag2", 0)), cm, s12, sbase, _clean_float(d.get("nomv1", 0)), base_kv1)[0],
                "bPu": magnetizing_admittance(_clean_float(d.get("mag1", 0)), _clean_float(d.get("mag2", 0)), cm, s12, sbase, _clean_float(d.get("nomv1", 0)), base_kv1)[1],
            },
        })

        for wn in range(1, 4 if is_3w else 2):
            winding = transformers[-1]["winding"+str(wn)]
            for key, src in {"controlMode":"cod","controlledBus":"cont","remoteNode":"node","impedanceTable":"tab"}.items():
                winding[key] = _clean_int(d.get(src+str(wn),0))
            if wn > 1:
                for key,src in {"rMaxPu":"rma","rMinPu":"rmi","vMax":"vma","vMin":"vmi"}.items():
                    winding[key] = _clean_float(d.get(src+str(wn)))
                winding["numTaps"] = _clean_int(d.get("ntp"+str(wn)))

    # 8. Switched Shunts
    wsh_table = net.get("swshunt", {})
    w_fields = wsh_table.get("fields", [])
    w_rows = wsh_table.get("data", [])
    switched_shunts = []

    for row in w_rows:
        d = dict(zip(w_fields, row))
        ibus = _clean_int(d.get("ibus"))
        blocks = []
        for b_idx in range(1, 9):
            n_steps = _clean_int(d.get(f"n{b_idx}", 0), 0)
            b_mvar = _clean_float(d.get(f"b{b_idx}", 0.0), 0.0)
            s_on = _clean_int(d.get(f"s{b_idx}", 0), 0)
            if n_steps > 0:
                blocks.append({
                    "inService": bool(s_on > 0),
                    "numSteps": n_steps,
                    "stepBMvar": b_mvar,
                })

        switched_shunts.append({
            "ibus": ibus,
            "shuntId": _clean_str(d.get("shntid", "1")) or "1",
            "inService": bool(_clean_int(d.get("stat", 1), 1) == 1),
            "controlMode": _clean_int(d.get("modsw", 1), 1),
            "bInitMvar": _clean_float(d.get("binit", 0.0)),
            "vHighPu": _clean_float(d.get("vswhi", 1.05), 1.05),
            "vLowPu": _clean_float(d.get("vswlo", 0.95), 0.95),
            "controlledBus": _clean_int(d.get("swreg", ibus), ibus),
            "name": _clean_str(d.get("name", "")),
            "blocks": blocks,
        })

    # 9. Substations, Nodes, Switches
    subs = []
    for row in net.get("sub", {}).get("data", []):
        d = dict(zip(net["sub"]["fields"], row))
        subs.append({
            "subNumber": _clean_int(d.get("isub")),
            "name": _clean_str(d.get("name")),
            "latitude": _clean_float(d.get("lati")) if d.get("lati") else None,
            "longitude": _clean_float(d.get("long")) if d.get("long") else None,
            "groundingResOhms": _clean_float(d.get("srg")) if d.get("srg") else None,
        })

    nodes = []
    for row in net.get("subnode", {}).get("data", []):
        d = dict(zip(net["subnode"]["fields"], row))
        nodes.append({
            "subNumber": _clean_int(d.get("isub")),
            "nodeNumber": _clean_int(d.get("inode")),
            "name": _clean_str(d.get("name")),
            "electricalBus": _clean_int(d.get("ibus")),
            "inService": bool(_clean_int(d.get("stat", 1), 1) == 1),
            "vmPu": _clean_float(d.get("vm")) if d.get("vm") is not None else None,
            "vaDeg": _clean_float(d.get("va")) if d.get("va") is not None else None,
        })

    switches = []
    for row in net.get("subswd", {}).get("data", []):
        d = dict(zip(net["subswd"]["fields"], row))
        switches.append({
            "subNumber": _clean_int(d.get("isub")),
            "fromNode": _clean_int(d.get("inode")),
            "toNode": _clean_int(d.get("jnode")),
            "circuitId": _clean_str(d.get("swdid", "1")) or "1",
            "name": _clean_str(d.get("name", "")),
            "switchType": _clean_int(d.get("type", 1), 1),
            "isClosed": bool(_clean_int(d.get("stat", 1), 1) == 1),
            "isNormalClosed": bool(_clean_int(d.get("nstat", 1), 1) == 1),
            "xPu": _clean_float(d.get("xpu", 0.0001), 0.0001),
            "ratingMva": None,
        })

    areas = []
    for row in net.get("area", {}).get("data", []):
        d = dict(zip(net["area"]["fields"], row))
        areas.append({
            "areaNumber": _clean_int(d.get("iarea")),
            "slackBus": _clean_int(d.get("isw", 0), 0),
            "desiredExportMw": _clean_float(d.get("pdes", 0.0)),
            "toleranceMw": _clean_float(d.get("ptol", 10.0), 10.0),
            "name": _clean_str(d.get("arname", "")),
        })

    zones = []
    for row in net.get("zone", {}).get("data", []):
        d = dict(zip(net["zone"]["fields"], row))
        zones.append({
            "zoneNumber": _clean_int(d.get("izone")),
            "name": _clean_str(d.get("zoname", "")),
        })

    owners = []
    for row in net.get("owner", {}).get("data", []):
        d = dict(zip(net["owner"]["fields"], row))
        owners.append({
            "ownerNumber": _clean_int(d.get("iowner")),
            "name": _clean_str(d.get("owname", "")),
        })

    unsupported_mappings = [
        ("sysswd", "SystemSwitchingDevice"),
        ("twotermdc", "TwoTerminalDcLine"),
        ("vscdc", "VscDcLine"),
        ("ntermdc", "MultiTerminalDcLine"),
        ("ntermdcconv", "MultiTerminalDcConverter"),
        ("ntermdcbus", "MultiTerminalDcBus"),
        ("ntermdclink", "MultiTerminalDcLink"),
        ("facts", "FactsDevice"),
        ("indmach", "InductionMachine"),
        ("voltagedroop", "VoltageDroopControl"),
        ("impcor", "ImpedanceCorrectionTable"),
        ("msline", "MultiSectionLine"),
        ("subterm", "SubstationTerminal"),
        ("gne", "GneDevice"),
        ("iatrans", "InterAreaTransfer"),
        ("interface", "Interface"),
    ]
    unsupported_equipment = []
    for tbl_name, class_name in unsupported_mappings:
        tbl = net.get(tbl_name, {})
        rows = tbl.get("data", [])
        if rows:
            unsupported_equipment.append({
                "sourceClass": class_name,
                "count": len(rows),
                "details": f"{len(rows)} records in RAWX table '{tbl_name}'",
            })

    known_tables = {name for name,_ in unsupported_mappings} | {
        "caseid", "general", "gauss", "newton", "adjust", "tysl", "solver", "rating", "swdratnam", "swdratset",
        "bus", "load", "fixshunt", "generator", "acline", "transformer", "area", "zone", "owner", "swshunt",
        "sub", "subnode", "subswd", "loadtype", "itfelmt"}
    for table, value in net.items():
        if table not in known_tables and isinstance(value,dict) and value.get("data"):
            unsupported_equipment.append({"sourceClass":"UnknownRawxTable:"+table,"count":len(value["data"]),"details":"Retained; no implemented equations"})
    fidelity = "PARTIAL" if unsupported_equipment else "SOURCE_EXACT"

    now_utc = datetime.datetime.now(datetime.timezone.utc).isoformat()
    return {
        "schemaVersion": "ga-psse-bridge/1",
        "metadata": {
            "sourceFile": os.path.basename(rawx_path),
            "sourceSha256": file_sha256,
            "sourceFormat": "RAWX",
            "extractionMethod": "standalone-rawx-parser",
            "psseRelease": psse_ver,
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
                    "code": "RAWX_PARSER_SUCCESS" if not unsupported_equipment else "UNSUPPORTED_EQUIPMENT_PRESENT",
                    "message": f"Parsed {len(buses)} buses, {len(branches)} branches, {len(transformers)} transformers from RAWX" + (f" ({len(unsupported_equipment)} unsupported classes)" if unsupported_equipment else ""),
                }
            ],
        },
        "caseIdentification": {
            "sbaseMva": sbase,
            "baseFrequencyHz": basfrq,
            "titleLine1": title1,
            "titleLine2": title2,
            "psseVersion": psse_ver,
            "solutionStatus": {"isSolved": False, "state": "UNKNOWN", "solutionMethod": "UNVERIFIED_RAWX"},
        },
        "network": {
            "sourceTables": net,
            "buses": buses,
            "loads": loads,
            "generators": generators,
            "branches": branches,
            "transformers": transformers,
            "fixedShunts": fixed_shunts,
            "switchedShunts": switched_shunts,
            "substations": subs,
            "substationNodes": nodes,
            "substationSwitches": switches,
            "areas": areas,
            "zones": zones,
            "owners": owners,
        },
    }


class RawxParser:
    """Wrapper class for parsing .rawx files into bridge dictionary."""

    def __init__(self, rawx_path: str):
        self.rawx_path = rawx_path

    def to_bridge_dict(self) -> Dict[str, Any]:
        return parse_rawx_file(self.rawx_path)
