"""Independent structural gate shared by mapping and parity validation."""
from collections import Counter
from .electrical import finite

IDENTITY_FIELDS = {
    "buses": ("ibus",), "loads": ("ibus", "loadid"),
    "generators": ("ibus", "machid"), "fixedShunts": ("ibus", "shuntId"),
    "switchedShunts": ("ibus", "shuntId"),
    "branches": ("fromBus", "toBus", "circuitId"),
    "transformers": ("fromBus", "toBus", "tertiaryBus", "circuitId"),
    "substations": ("subNumber",), "substationNodes": ("subNumber", "nodeNumber"),
    "substationSwitches": ("subNumber", "fromNode", "toNode", "circuitId"),
    "areas": ("areaNumber",), "zones": ("zoneNumber",), "owners": ("ownerNumber",),
}


def identity(table, row):
    return tuple(row.get(k) for k in IDENTITY_FIELDS[table])


def duplicates(net):
    def dupkey(table, row):
        if table == "branches":
            return (tuple(sorted((row.get("fromBus", 0), row.get("toBus", 0)))), row.get("circuitId"))
        if table == "transformers":
            return (tuple(sorted(x for x in (row.get("fromBus"), row.get("toBus"), row.get("tertiaryBus")) if x is not None)), row.get("circuitId"))
        if table == "substationSwitches":
            return (row.get("subNumber"), tuple(sorted((row.get("fromNode", 0), row.get("toNode", 0)))), row.get("circuitId"))
        return identity(table, row)
    return [f"{table}:{key!r} ({count})" for table in IDENTITY_FIELDS
            for key, count in Counter(dupkey(table, r) for r in net.get(table, [])).items()
            if count > 1]


def structural_errors(bridge):
    net = bridge.get("network", {})
    errors = ["Duplicate identity " + d for d in duplicates(net)]
    bus_ids = {b.get("ibus") for b in net.get("buses", [])}
    node_ids = {(n.get("subNumber"), n.get("nodeNumber")) for n in net.get("substationNodes", [])}
    subs = {s.get("subNumber") for s in net.get("substations", [])}
    numeric_required = {
        "buses": ("baskv", "ide", "vmPu", "vaDeg"),
        "loads": ("pMw", "qMvar", "pCurrentMw", "qCurrentMvar", "pAdmittanceMw", "qAdmittanceMvar"),
        "generators": ("pMw", "qMvar", "mbaseMva", "vsPu", "pMinMw", "pMaxMw", "qMinMvar", "qMaxMvar"),
        "branches": ("rPu", "xPu", "bPu"), "fixedShunts": ("gMw", "bMvar"),
        "switchedShunts": ("bInitMvar",),
    }
    for table, fields in IDENTITY_FIELDS.items():
        for row in net.get(table, []):
            label = f"{table}:{identity(table, row)!r}"
            for key in numeric_required.get(table, ()):
                if not finite(row.get(key)):
                    errors.append(f"{label} missing/invalid electrical value {key}")
            for key in fields:
                if key != "tertiaryBus" and row.get(key) is None:
                    errors.append(f"{label} missing identity {key}")
            for key in ("ibus", "fromBus", "toBus", "tertiaryBus", "remoteBus", "controlledBus", "electricalBus"):
                if key not in row or row[key] in (None, 0):
                    continue
                # A negative control bus denotes a PSS/E control orientation.
                ref = abs(row[key]) if key in ("remoteBus", "controlledBus") else row[key]
                if ref not in bus_ids:
                    errors.append(f"Topological disconnection: {label}.{key}={row[key]} missing bus")
            if table == "substationSwitches":
                for key in ("fromNode", "toNode"):
                    if (row.get("subNumber"), row.get(key)) not in node_ids:
                        errors.append(f"{label}.{key} missing physical node")
            if table == "substationNodes" and row.get("subNumber") not in subs:
                errors.append(f"{label} missing substation")
            if row.get("remoteNode", 0) and not net.get("substationNodes"):
                errors.append(f"{label} unresolved remote node")
            for winding in ("winding1", "winding2", "winding3"):
                w = row.get(winding) or {}
                ref = w.get("controlledBus", 0)
                if ref and abs(ref) not in bus_ids:
                    errors.append(f"{label}.{winding}.controlledBus={ref} missing bus")
                if w.get("remoteNode", 0):
                    errors.append(f"{label}.{winding}: remote node equivalence unverified")
    # NaN/Inf are invalid even if both models contain the same value.
    def scan(value, path):
        if isinstance(value, dict):
            for k, v in value.items(): scan(v, f"{path}.{k}")
        elif isinstance(value, (list, tuple)):
            for i, v in enumerate(value): scan(v, f"{path}[{i}]")
        elif isinstance(value, float) and not finite(value):
            errors.append(f"{path} non-finite value")
    scan(net, "network")
    return errors
