"""Recursive, oriented comparison of every normalized Bridge network leaf.

Display labels and SAV-internal star references are explicitly not electrical
comparisons. Source residues are retained but are not normalized field parity.
"""
import math
from .integrity import IDENTITY_FIELDS, identity, structural_errors

DISPLAY_FIELDS = {"name", "areaName", "zoneName", "ownerName", "vectorGroup"}
SOURCE_ONLY = {"starBus", "sourceEncoding", "vmStar", "anStar", "sourceTables", "sourceSections"}


def compare_fields(left, right, tolerance):
    failures = []
    coverage = {"comparedLeaves": 0, "notComparableLeaves": 0, "excludedFields": sorted(DISPLAY_FIELDS | SOURCE_ONLY),
                "scope": "Normalized Bridge fields; source residue is retained, not claimed electrically implemented"}
    for side, obj in (("reference", left), ("sdk", right)):
        failures.extend(f"{side}: {s}" for s in structural_errors(obj))
    missing = object()

    def walk(a, b, path):
        if isinstance(a, dict) and isinstance(b, dict):
            for key in sorted(a.keys() | b.keys()):
                if key in DISPLAY_FIELDS | SOURCE_ONLY:
                    coverage["notComparableLeaves"] += 1
                    continue
                walk(a.get(key, missing), b.get(key, missing), f"{path}.{key}")
        elif isinstance(a, (list, tuple)) and isinstance(b, (list, tuple)):
            if len(a) != len(b): failures.append(f"{path} array length {len(a)} != {len(b)}")
            for i, (x, y) in enumerate(zip(a, b)): walk(x, y, f"{path}[{i}]")
        else:
            coverage["comparedLeaves"] += 1
            if a is missing or b is missing:
                failures.append(f"{path} missing field on one side")
            elif isinstance(a, bool) or isinstance(b, bool):
                if type(a) is not type(b) or a != b: failures.append(f"{path} status/type mismatch")
            elif isinstance(a, (float, int)) and isinstance(b, (float, int)):
                if not math.isfinite(a) or not math.isfinite(b) or abs(a - b) > tolerance:
                    failures.append(f"{path} mismatch: {a!r} != {b!r}")
            elif a != b:
                failures.append(f"{path} mismatch: {a!r} != {b!r}")

    for table in IDENTITY_FIELDS:
        lrows = left.get("network", {}).get(table, [])
        rrows = right.get("network", {}).get(table, [])
        lm = {identity(table, r): r for r in lrows}
        rm = {identity(table, r): r for r in rrows}
        if lm.keys() != rm.keys(): failures.append(f"{table}: oriented identity sets differ")
        for key in lm.keys() & rm.keys(): walk(lm[key], rm[key], f"{table}{key!r}")
    for key in ("sbaseMva", "baseFrequencyHz"):
        walk(left.get("caseIdentification", {}).get(key, missing), right.get("caseIdentification", {}).get(key, missing), key)
    coverage["failureCount"] = len(failures)
    coverage["sourceResidualComparison"] = "NOT_COMPARABLE: RAW/RAWX source residue has different encodings"
    coverage["unsupportedSourceClasses"] = left.get("metadata", {}).get("unsupportedEquipment", [])
    return failures, coverage
