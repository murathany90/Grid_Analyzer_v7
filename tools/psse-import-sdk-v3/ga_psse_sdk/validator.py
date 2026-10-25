"""Model validation module comparing official PSS(R)E exports against SDK exports.

Performs key-by-key bidirectional electrical parameter validation across all network classes:
  - Bus VM, VA, BASKV, IDE (no arbitrary bypass for high bus IDs)
  - Load P, Q, inService
  - Generator PG, QG, VS, inService, limits (PMAX, PMIN, QMAX, QMIN)
  - Branch R, X, B, RATE, inService, terminal shunts (GI, BI, GJ, BJ)
  - Transformer turns ratio, R12, X12, angle, inService, 3W parameters
  - Fixed shunt G, B, inService
  - Switched shunt BINIT, inService
  - Substation switches topology & status
Computes maximum absolute differences, enforces strict tolerances, and outputs JSON/CSV/Markdown reports.
"""
import csv
import json
import math
import os
from .serialization import json_safe
from typing import Any, Dict, List, Optional, Set, Tuple


def _diff_float(val1: Any, val2: Any) -> Optional[float]:
    """Returns absolute difference of two numeric values.
    Returns None if either is None (missing value) or not convertible to float."""
    if val1 is None or val2 is None:
        return None
    try:
        f1 = float(val1)
        f2 = float(val2)
        if not math.isfinite(f1) or not math.isfinite(f2):
            return None
        return abs(f1 - f2)
    except (ValueError, TypeError):
        return None


def _diff(val1: Any, val2: Any) -> float:
    """Computes difference between two values.
    If both are None, diff is 0.0.
    If only one is None, diff is inf (fails tolerance check, does NOT assume 0.0)."""
    if val1 is None and val2 is None:
        return 0.0
    if val1 is None or val2 is None:
        return float("inf")
    diff = _diff_float(val1, val2)
    if diff is None:
        return float("inf")
    return diff


class ModelValidator:
    """Compares electrical parameters across official and SDK extracted models bidirectionally."""

    def __init__(self, tolerance: float = 1e-4):
        self.tolerance = tolerance

    def compare_networks(
        self,
        case_name: str,
        official_bridge: Dict[str, Any],
        sdk_bridge: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Compares official and SDK bridge dictionaries bidirectionally across all supported classes."""
        net_off = official_bridge.get("network", {})
        net_sdk = sdk_bridge.get("network", {})

        failure_reasons: List[str] = []

        metrics = {
            "case": case_name,
            "buses": {"count_off": len(net_off.get("buses", [])), "count_sdk": len(net_sdk.get("buses", [])), "max_vm_diff": 0.0, "max_va_diff": 0.0, "max_baskv_diff": 0.0, "missing_in_sdk": [], "extra_in_sdk": [], "passed": True},
            "loads": {"count_off": len(net_off.get("loads", [])), "count_sdk": len(net_sdk.get("loads", [])), "max_p_diff": 0.0, "max_q_diff": 0.0, "missing_in_sdk": [], "extra_in_sdk": [], "passed": True},
            "generators": {"count_off": len(net_off.get("generators", [])), "count_sdk": len(net_sdk.get("generators", [])), "max_pg_diff": 0.0, "max_qg_diff": 0.0, "max_vs_diff": 0.0, "missing_in_sdk": [], "extra_in_sdk": [], "passed": True},
            "branches": {"count_off": len(net_off.get("branches", [])), "count_sdk": len(net_sdk.get("branches", [])), "max_r_diff": 0.0, "max_x_diff": 0.0, "max_b_diff": 0.0, "max_rate_diff": 0.0, "missing_in_sdk": [], "extra_in_sdk": [], "passed": True},
            "transformers": {"count_off": len(net_off.get("transformers", [])), "count_sdk": len(net_sdk.get("transformers", [])), "max_ratio_diff": 0.0, "max_x_diff": 0.0, "max_r_diff": 0.0, "max_angle_diff": 0.0, "missing_in_sdk": [], "extra_in_sdk": [], "passed": True},
            "fixedShunts": {"count_off": len(net_off.get("fixedShunts", [])), "count_sdk": len(net_sdk.get("fixedShunts", [])), "missing_in_sdk": [], "extra_in_sdk": [], "passed": True},
            "switchedShunts": {"count_off": len(net_off.get("switchedShunts", [])), "count_sdk": len(net_sdk.get("switchedShunts", [])), "missing_in_sdk": [], "extra_in_sdk": [], "passed": True},
            "substationSwitches": {"count_off": len(net_off.get("substationSwitches", [])), "count_sdk": len(net_sdk.get("substationSwitches", [])), "missing_in_sdk": [], "extra_in_sdk": [], "passed": True},
            "failure_reasons": failure_reasons,
            "all_passed": True,
        }

        # 1. Compare buses by ibus (bidirectional)
        b_off_map = {b["ibus"]: b for b in net_off.get("buses", [])}
        b_sdk_map = {b["ibus"]: b for b in net_sdk.get("buses", [])}

        missing_buses = set(b_off_map.keys()) - set(b_sdk_map.keys())
        extra_buses = set(b_sdk_map.keys()) - set(b_off_map.keys())

        # Check if extra buses in SDK are legitimate 3W synthetic star buses
        # (must be explicitly documented in 3W transformers as starBus, NOT random high buses)
        trns_sdk = net_sdk.get("transformers", [])
        tr_star_buses = {t.get("starBus") for t in trns_sdk if t.get("isThreeWinding") and t.get("starBus")}
        unexplained_extra_buses = set(extra_buses) - tr_star_buses

        metrics["buses"]["missing_in_sdk"] = sorted(list(missing_buses))
        metrics["buses"]["extra_in_sdk"] = sorted(list(extra_buses))

        if missing_buses:
            metrics["buses"]["passed"] = False
            failure_reasons.append(f"Missing buses in SDK: {sorted(list(missing_buses))}")
        if unexplained_extra_buses:
            metrics["buses"]["passed"] = False
            failure_reasons.append(f"Extra unexplained buses in SDK: {sorted(list(unexplained_extra_buses))}")

        max_vm = 0.0
        max_va = 0.0
        max_kv = 0.0
        for ibus, b1 in b_off_map.items():
            b2 = b_sdk_map.get(ibus)
            if not b2:
                continue
            d_vm = _diff(b1.get("vmPu"), b2.get("vmPu"))
            d_va = _diff(b1.get("vaDeg"), b2.get("vaDeg"))
            d_kv = _diff(b1.get("baskv"), b2.get("baskv"))
            if d_vm > max_vm:
                max_vm = d_vm
            if d_va > max_va:
                max_va = d_va
            if d_kv > max_kv:
                max_kv = d_kv

            if b1.get("ide") is not None and b2.get("ide") is not None and b1.get("ide") != b2.get("ide"):
                metrics["buses"]["passed"] = False
                failure_reasons.append(f"Bus type (IDE) mismatch on bus {ibus}: {b1.get('ide')} vs {b2.get('ide')}")

        metrics["buses"]["max_vm_diff"] = max_vm
        metrics["buses"]["max_va_diff"] = max_va
        metrics["buses"]["max_baskv_diff"] = max_kv
        if max_vm > self.tolerance or max_va > 1e-2 or max_kv > 0.01:
            metrics["buses"]["passed"] = False
            failure_reasons.append(f"Bus tolerance exceeded: max_vm_diff={max_vm:.6e}, max_va_diff={max_va:.6e}, max_kv_diff={max_kv:.6e}")

        # 2. Compare loads by (ibus, loadid) (bidirectional)
        l_off_map = {(l["ibus"], str(l.get("loadid", "1")).strip()): l for l in net_off.get("loads", [])}
        l_sdk_map = {(l["ibus"], str(l.get("loadid", "1")).strip()): l for l in net_sdk.get("loads", [])}

        missing_loads = set(l_off_map.keys()) - set(l_sdk_map.keys())
        extra_loads = set(l_sdk_map.keys()) - set(l_off_map.keys())
        metrics["loads"]["missing_in_sdk"] = [list(k) for k in sorted(missing_loads)]
        metrics["loads"]["extra_in_sdk"] = [list(k) for k in sorted(extra_loads)]

        if missing_loads or extra_loads:
            metrics["loads"]["passed"] = False
            failure_reasons.append(f"Load mismatch: missing={list(missing_loads)}, extra={list(extra_loads)}")

        max_p = 0.0
        max_q = 0.0
        for key, l1 in l_off_map.items():
            l2 = l_sdk_map.get(key)
            if not l2:
                continue
            d_p = _diff(l1.get("pMw"), l2.get("pMw"))
            d_q = _diff(l1.get("qMvar"), l2.get("qMvar"))
            if d_p > max_p:
                max_p = d_p
            if d_q > max_q:
                max_q = d_q

            s1 = bool(l1.get("inService", True))
            s2 = bool(l2.get("inService", True))
            if s1 != s2:
                metrics["loads"]["passed"] = False
                failure_reasons.append(f"Load status mismatch on {key}: {s1} vs {s2}")

        metrics["loads"]["max_p_diff"] = max_p
        metrics["loads"]["max_q_diff"] = max_q
        if max_p > 0.05 or max_q > 0.05:
            metrics["loads"]["passed"] = False
            failure_reasons.append(f"Load power tolerance exceeded: max_p_diff={max_p:.6e}, max_q_diff={max_q:.6e}")

        # 3. Compare generators by (ibus, machid) (bidirectional)
        g_off_map = {(g["ibus"], str(g.get("machid", "1")).strip()): g for g in net_off.get("generators", [])}
        g_sdk_map = {(g["ibus"], str(g.get("machid", "1")).strip()): g for g in net_sdk.get("generators", [])}

        missing_gens = set(g_off_map.keys()) - set(g_sdk_map.keys())
        extra_gens = set(g_sdk_map.keys()) - set(g_off_map.keys())
        metrics["generators"]["missing_in_sdk"] = [list(k) for k in sorted(missing_gens)]
        metrics["generators"]["extra_in_sdk"] = [list(k) for k in sorted(extra_gens)]

        if missing_gens or extra_gens:
            metrics["generators"]["passed"] = False
            failure_reasons.append(f"Generator mismatch: missing={list(missing_gens)}, extra={list(extra_gens)}")

        max_pg = 0.0
        max_qg = 0.0
        max_vs = 0.0
        for key, g1 in g_off_map.items():
            g2 = g_sdk_map.get(key)
            if not g2:
                continue
            d_pg = _diff(g1.get("pMw"), g2.get("pMw"))
            d_qg = _diff(g1.get("qMvar"), g2.get("qMvar"))
            d_vs = _diff(g1.get("vsPu"), g2.get("vsPu"))
            if d_pg > max_pg:
                max_pg = d_pg
            if d_qg > max_qg:
                max_qg = d_qg
            if d_vs > max_vs:
                max_vs = d_vs

            s1 = bool(g1.get("inService", True))
            s2 = bool(g2.get("inService", True))
            if s1 != s2:
                metrics["generators"]["passed"] = False
                failure_reasons.append(f"Generator status mismatch on {key}: {s1} vs {s2}")

            # Check limits if present
            for lim_f in ("pMaxMw", "pMinMw", "qMaxMvar", "qMinMvar"):
                v1 = g1.get(lim_f)
                v2 = g2.get(lim_f)
                if v1 is not None and v2 is not None:
                    d_lim = _diff(v1, v2)
                    if d_lim > 0.1:
                        metrics["generators"]["passed"] = False
                        failure_reasons.append(f"Generator {lim_f} mismatch on {key}: {v1} vs {v2}")

        metrics["generators"]["max_pg_diff"] = max_pg
        metrics["generators"]["max_qg_diff"] = max_qg
        metrics["generators"]["max_vs_diff"] = max_vs
        if max_pg > 0.05 or max_qg > 0.05 or max_vs > 0.01:
            metrics["generators"]["passed"] = False
            failure_reasons.append(f"Generator parameter tolerance exceeded: max_pg_diff={max_pg:.6e}, max_qg_diff={max_qg:.6e}, max_vs_diff={max_vs:.6e}")

        # 4. Compare branches by (fromBus, toBus, circuitId) (bidirectional, undirected topology)
        def _br_key(b):
            u = b["fromBus"]
            v = b["toBus"]
            return (min(u, v), max(u, v), str(b.get("circuitId", "1")).strip())

        br_off_map = {_br_key(b): b for b in net_off.get("branches", [])}
        br_sdk_map = {_br_key(b): b for b in net_sdk.get("branches", [])}

        missing_br = set(br_off_map.keys()) - set(br_sdk_map.keys())
        extra_br = set(br_sdk_map.keys()) - set(br_off_map.keys())
        metrics["branches"]["missing_in_sdk"] = [list(k) for k in sorted(missing_br)]
        metrics["branches"]["extra_in_sdk"] = [list(k) for k in sorted(extra_br)]

        if missing_br or extra_br:
            metrics["branches"]["passed"] = False
            failure_reasons.append(f"Branch mismatch: missing={list(missing_br)}, extra={list(extra_br)}")

        max_r = 0.0
        max_x = 0.0
        max_b = 0.0
        max_rate = 0.0
        for key, br1 in br_off_map.items():
            br2 = br_sdk_map.get(key)
            if not br2:
                continue
            d_r = _diff(br1.get("rPu"), br2.get("rPu"))
            d_x = _diff(br1.get("xPu"), br2.get("xPu"))
            d_b = _diff(br1.get("bPu"), br2.get("bPu"))
            if d_r > max_r:
                max_r = d_r
            if d_x > max_x:
                max_x = d_x
            if d_b > max_b:
                max_b = d_b

            s1 = bool(br1.get("inService", True))
            s2 = bool(br2.get("inService", True))
            if s1 != s2:
                metrics["branches"]["passed"] = False
                failure_reasons.append(f"Branch status mismatch on {key}: {s1} vs {s2}")

            # Rating comparison: if both specify rateMva or if one differs
            r1 = float(br1.get("rateMva") or 0.0)
            r2 = float(br2.get("rateMva") or 0.0)
            d_rate = abs(r1 - r2)
            if d_rate > max_rate:
                max_rate = d_rate

            # Terminal shunts comparison
            for sh_f in ("fromShuntGpu", "fromShuntBpu", "toShuntGpu", "toShuntBpu"):
                sv1 = float(br1.get(sh_f) or 0.0)
                sv2 = float(br2.get(sh_f) or 0.0)
                if abs(sv1 - sv2) > self.tolerance:
                    metrics["branches"]["passed"] = False
                    failure_reasons.append(f"Branch terminal shunt {sh_f} mismatch on {key}: {sv1} vs {sv2}")

        metrics["branches"]["max_r_diff"] = max_r
        metrics["branches"]["max_x_diff"] = max_x
        metrics["branches"]["max_b_diff"] = max_b
        metrics["branches"]["max_rate_diff"] = max_rate
        if max_r > self.tolerance or max_x > self.tolerance or max_b > self.tolerance:
            metrics["branches"]["passed"] = False
            failure_reasons.append(f"Branch impedance tolerance exceeded: max_r={max_r:.6e}, max_x={max_x:.6e}, max_b={max_b:.6e}")
        if max_rate > 0.1:
            metrics["branches"]["passed"] = False
            failure_reasons.append(f"Branch rating tolerance exceeded: max_rate_diff={max_rate:.6e}")

        # 5. Compare transformers (bidirectional)
        tr_off_map = {(t["fromBus"], t["toBus"], str(t.get("circuitId", "1")).strip()): t for t in net_off.get("transformers", [])}
        tr_sdk_map = {(t["fromBus"], t["toBus"], str(t.get("circuitId", "1")).strip()): t for t in net_sdk.get("transformers", [])}

        missing_tr = set(tr_off_map.keys()) - set(tr_sdk_map.keys())
        extra_tr = set(tr_sdk_map.keys()) - set(tr_off_map.keys())
        metrics["transformers"]["missing_in_sdk"] = [list(k) for k in sorted(missing_tr)]
        metrics["transformers"]["extra_in_sdk"] = [list(k) for k in sorted(extra_tr)]

        if missing_tr or extra_tr:
            metrics["transformers"]["passed"] = False
            failure_reasons.append(f"Transformer mismatch: missing={list(missing_tr)}, extra={list(extra_tr)}")

        max_ratio = 0.0
        max_tr_x = 0.0
        max_tr_r = 0.0
        max_angle = 0.0
        for key, t1 in tr_off_map.items():
            t2 = tr_sdk_map.get(key)
            if not t2:
                continue
            r1 = t1.get("winding1", {}).get("ratioPu", 1.0)
            r2 = t2.get("winding1", {}).get("ratioPu", 1.0)
            d_ratio = _diff(r1, r2)
            d_tx = _diff(t1.get("impedance", {}).get("x12Pu"), t2.get("impedance", {}).get("x12Pu"))
            d_tr = _diff(t1.get("impedance", {}).get("r12Pu"), t2.get("impedance", {}).get("r12Pu"))
            ang1 = t1.get("winding1", {}).get("angleDeg", 0.0)
            ang2 = t2.get("winding1", {}).get("angleDeg", 0.0)
            d_ang = _diff(ang1, ang2)

            if d_ratio > max_ratio:
                max_ratio = d_ratio
            if d_tx > max_tr_x:
                max_tr_x = d_tx
            if d_tr > max_tr_r:
                max_tr_r = d_tr
            if d_ang > max_angle:
                max_angle = d_ang

            s1 = bool(t1.get("inService", True))
            s2 = bool(t2.get("inService", True))
            if s1 != s2:
                metrics["transformers"]["passed"] = False
                failure_reasons.append(f"Transformer status mismatch on {key}: {s1} vs {s2}")

            # Audit 3-winding parameters if applicable
            if t1.get("isThreeWinding") or t2.get("isThreeWinding"):
                imp1 = t1.get("impedance", {})
                imp2 = t2.get("impedance", {})
                d_sbase = _diff(imp1.get("sbase12Mva"), imp2.get("sbase12Mva"))
                d_x23 = _diff(imp1.get("x23Pu"), imp2.get("x23Pu"))
                d_x31 = _diff(imp1.get("x31Pu"), imp2.get("x31Pu"))
                if d_sbase > self.tolerance or d_x23 > self.tolerance or d_x31 > self.tolerance:
                    metrics["transformers"]["passed"] = False
                    failure_reasons.append(f"3W transformer parameter mismatch on {key}: d_sbase={d_sbase}, d_x23={d_x23}, d_x31={d_x31}")

        metrics["transformers"]["max_ratio_diff"] = max_ratio
        metrics["transformers"]["max_x_diff"] = max_tr_x
        metrics["transformers"]["max_r_diff"] = max_tr_r
        metrics["transformers"]["max_angle_diff"] = max_angle
        if max_ratio > self.tolerance or max_tr_x > self.tolerance or max_tr_r > self.tolerance:
            metrics["transformers"]["passed"] = False
            failure_reasons.append(f"Transformer tolerance exceeded: max_ratio={max_ratio:.6e}, max_x={max_tr_x:.6e}, max_r={max_tr_r:.6e}")
        if max_angle > 0.05:
            metrics["transformers"]["passed"] = False
            failure_reasons.append(f"Transformer phase angle tolerance exceeded: max_angle={max_angle:.6e}")

        # 6. Compare fixed shunts
        fsh_off_map = {(s["ibus"], str(s.get("shuntId", "1")).strip()): s for s in net_off.get("fixedShunts", [])}
        fsh_sdk_map = {(s["ibus"], str(s.get("shuntId", "1")).strip()): s for s in net_sdk.get("fixedShunts", [])}
        missing_fsh = set(fsh_off_map.keys()) - set(fsh_sdk_map.keys())
        extra_fsh = set(fsh_sdk_map.keys()) - set(fsh_off_map.keys())
        metrics["fixedShunts"]["missing_in_sdk"] = [list(k) for k in sorted(missing_fsh)]
        metrics["fixedShunts"]["extra_in_sdk"] = [list(k) for k in sorted(extra_fsh)]
        if missing_fsh or extra_fsh:
            metrics["fixedShunts"]["passed"] = False
            failure_reasons.append(f"Fixed shunt mismatch: missing={list(missing_fsh)}, extra={list(extra_fsh)}")

        for key, s1 in fsh_off_map.items():
            s2 = fsh_sdk_map.get(key)
            if not s2:
                continue
            d_g = _diff(s1.get("gMw"), s2.get("gMw"))
            d_b = _diff(s1.get("bMvar"), s2.get("bMvar"))
            if d_g > 0.05 or d_b > 0.05:
                metrics["fixedShunts"]["passed"] = False
                failure_reasons.append(f"Fixed shunt parameter mismatch on {key}: d_g={d_g}, d_b={d_b}")
            if bool(s1.get("inService", True)) != bool(s2.get("inService", True)):
                metrics["fixedShunts"]["passed"] = False
                failure_reasons.append(f"Fixed shunt status mismatch on {key}")

        # 7. Compare switched shunts
        wsh_off_map = {(s["ibus"], str(s.get("shuntId", "1")).strip()): s for s in net_off.get("switchedShunts", [])}
        wsh_sdk_map = {(s["ibus"], str(s.get("shuntId", "1")).strip()): s for s in net_sdk.get("switchedShunts", [])}
        missing_wsh = set(wsh_off_map.keys()) - set(wsh_sdk_map.keys())
        extra_wsh = set(wsh_sdk_map.keys()) - set(wsh_off_map.keys())
        metrics["switchedShunts"]["missing_in_sdk"] = [list(k) for k in sorted(missing_wsh)]
        metrics["switchedShunts"]["extra_in_sdk"] = [list(k) for k in sorted(extra_wsh)]
        if missing_wsh or extra_wsh:
            metrics["switchedShunts"]["passed"] = False
            failure_reasons.append(f"Switched shunt mismatch: missing={list(missing_wsh)}, extra={list(extra_wsh)}")

        for key, s1 in wsh_off_map.items():
            s2 = wsh_sdk_map.get(key)
            if not s2:
                continue
            d_b = _diff(s1.get("bInitMvar"), s2.get("bInitMvar"))
            if d_b > 0.05:
                metrics["switchedShunts"]["passed"] = False
                failure_reasons.append(f"Switched shunt bInit mismatch on {key}: d_b={d_b}")
            if bool(s1.get("inService", True)) != bool(s2.get("inService", True)):
                metrics["switchedShunts"]["passed"] = False
                failure_reasons.append(f"Switched shunt status mismatch on {key}")

        # 8. Compare substation switches (if present in either network)
        sw_off = net_off.get("substationSwitches", [])
        sw_sdk = net_sdk.get("substationSwitches", [])
        if sw_off or sw_sdk:
            def _sw_key(s):
                return (s["subNumber"], min(s["fromNode"], s["toNode"]), max(s["fromNode"], s["toNode"]), str(s.get("circuitId", "1")).strip())

            sw_off_map = {_sw_key(s): s for s in sw_off}
            sw_sdk_map = {_sw_key(s): s for s in sw_sdk}
            missing_sw = set(sw_off_map.keys()) - set(sw_sdk_map.keys())
            extra_sw = set(sw_sdk_map.keys()) - set(sw_off_map.keys())
            metrics["substationSwitches"]["missing_in_sdk"] = [list(k) for k in sorted(missing_sw)]
            metrics["substationSwitches"]["extra_in_sdk"] = [list(k) for k in sorted(extra_sw)]
            if missing_sw or extra_sw:
                metrics["substationSwitches"]["passed"] = False
                failure_reasons.append(f"Substation switch topology mismatch: missing={len(missing_sw)}, extra={len(extra_sw)}")

            for key, sw1 in sw_off_map.items():
                sw2 = sw_sdk_map.get(key)
                if not sw2:
                    continue
                if bool(sw1.get("isClosed", True)) != bool(sw2.get("isClosed", True)):
                    metrics["substationSwitches"]["passed"] = False
                    failure_reasons.append(f"Substation switch state mismatch on {key}")

        metrics["all_passed"] = (
            metrics["buses"]["passed"]
            and metrics["loads"]["passed"]
            and metrics["generators"]["passed"]
            and metrics["branches"]["passed"]
            and metrics["transformers"]["passed"]
            and metrics["fixedShunts"]["passed"]
            and metrics["switchedShunts"]["passed"]
            and metrics["substationSwitches"]["passed"]
        )

        from .field_validation import compare_fields
        additional, coverage = compare_fields(official_bridge, sdk_bridge, self.tolerance)
        metrics["fieldCoverage"] = coverage
        failure_reasons.extend(additional)
        metrics["all_passed"] = metrics["all_passed"] and not additional
        metrics["comparisonStatus"] = "PASS_NORMALIZED_FIELDS" if metrics["all_passed"] else "FAIL"
        metrics["fullElectricalModelParity"] = "NOT_COMPARABLE_SOURCE_RESIDUE_AND_GA_SOLVER_UNVERIFIED"
        return metrics

    def generate_report(self, validation_results: List[Dict[str, Any]], out_dir: str):
        """Generates JSON, CSV, and Markdown validation evidence package."""
        os.makedirs(out_dir, exist_ok=True)

        json_path = os.path.join(out_dir, "validation_results.json")
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(json_safe(validation_results), f, indent=2, allow_nan=False)

        csv_path = os.path.join(out_dir, "validation_results.csv")
        with open(csv_path, "w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([
                "Case", "Status", "Buses_Off", "Buses_SDK", "Max_VM_Diff", "Max_VA_Diff",
                "Gens_Off", "Gens_SDK", "Max_PG_Diff", "Max_QG_Diff",
                "Lines_Off", "Lines_SDK", "Max_R_Diff", "Max_X_Diff",
                "Trf_Off", "Trf_SDK", "Max_Ratio_Diff", "Failure_Reasons"
            ])
            for r in validation_results:
                b = r["buses"]
                g = r["generators"]
                br = r["branches"]
                tr = r["transformers"]
                writer.writerow([
                    r["case"],
                    "PASS" if r["all_passed"] else "FAIL",
                    b["count_off"], b["count_sdk"], f"{b['max_vm_diff']:.6e}", f"{b['max_va_diff']:.6e}",
                    g["count_off"], g["count_sdk"], f"{g['max_pg_diff']:.6e}", f"{g['max_qg_diff']:.6e}",
                    br["count_off"], br["count_sdk"], f"{br['max_r_diff']:.6e}", f"{br['max_x_diff']:.6e}",
                    tr["count_off"], tr["count_sdk"], f"{tr['max_ratio_diff']:.6e}",
                    "; ".join(r.get("failure_reasons", [])),
                ])

        md_path = os.path.join(out_dir, "VALIDATION_REPORT.md")
        lines = [
            "# PSS(R)E SDK Electrical Validation Evidence Report",
            "",
            "## Summary",
            f"- Total Models Validated: {len(validation_results)}",
            f"- Models Passed Tolerance ({self.tolerance}): {sum(1 for r in validation_results if r['all_passed'])}",
            f"- Models Failed: {sum(1 for r in validation_results if not r['all_passed'])}",
            "",
            "## Detailed Results Table",
            "",
            "| Case | Status | Buses (Off/SDK) | Max VM Diff (pu) | Max VA Diff (deg) | Gens | Max PG (MW) | Lines | Max X Diff (pu) | Transformers | Details |",
            "| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |",
        ]
        for r in validation_results:
            b = r["buses"]
            g = r["generators"]
            br = r["branches"]
            tr = r["transformers"]
            status_badge = "✅ PASS" if r["all_passed"] else "❌ FAIL"
            reasons_str = "; ".join(r.get("failure_reasons", [])) or "OK"
            lines.append(
                f"| `{r['case']}` | {status_badge} | {b['count_off']}/{b['count_sdk']} | {b['max_vm_diff']:.2e} | {b['max_va_diff']:.2e} | "
                f"{g['count_off']} | {g['max_pg_diff']:.2e} | {br['count_off']} | {br['max_x_diff']:.2e} | "
                f"{tr['count_off']} | {reasons_str} |"
            )

        lines.extend([
            "",
            "## Coverage boundary",
            "PASS means the compared normalized Bridge fields match within tolerance, with identity and structural checks.",
            "Source residue is retained but NOT_COMPARABLE across encodings. This is not complete source or GA solver parity.",
            "Inspect fieldCoverage and the separate Canonical capability gates. Node-breaker/DC/unsupported physics remains blocked.",
            "Saved voltages are source inputs, not convergence evidence; short circuit is not IEC-verified.",
        ])

        with open(md_path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines) + "\n")
