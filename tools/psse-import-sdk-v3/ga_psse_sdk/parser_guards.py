"""Reject missing electrical source columns rather than manufacturing defaults."""
import math

REQUIRED = {
    "bus": "ibus baskv ide vm va", "load": "ibus loadid stat pl ql ip iq yp yq",
    "generator": "ibus machid pg qg qt qb vs mbase stat pt pb",
    "acline": "ibus jbus ckt rpu xpu bpu stat", "fixshunt": "ibus shntid stat gl bl",
    "transformer": "ibus jbus kbus ckt cw cz cm stat windv1 windv2 r1_2 x1_2 sbase1_2",
}


def check_rawx(net):
    if not isinstance(net, dict) or not net.get("bus", {}).get("data"):
        raise ValueError("RAWX has no electrical bus table")
    case = net.get("caseid", {})
    values = dict(zip(case.get("fields", []), case.get("data", [])))
    if not isinstance(values.get("sbase"), (int, float)) or values["sbase"] <= 0:
        raise ValueError("Missing/invalid RAWX system base")
    for name, table in net.items():
        if not isinstance(table, dict) or "fields" not in table:
            continue
        fields = table["fields"]
        if len(fields) != len(set(fields)):
            raise ValueError(f"Duplicate RAWX columns in {name}")
        if name not in REQUIRED and name not in ("caseid", "area", "zone", "owner", "sub", "subnode", "subswd", "swshunt"):
            continue  # Non-tabular solver/settings records are retained verbatim.
        rows = table.get("data", [])
        if rows and not isinstance(rows[0], list): rows = [rows]
        for row in rows:
            if not isinstance(row, list) or len(row) != len(fields):
                raise ValueError(f"RAWX {name} row width does not match fields")
            d = dict(zip(fields, row))
            for k in REQUIRED.get(name, "").split():
                if k not in d or d[k] is None:
                    raise ValueError(f"RAWX {name} missing required electrical field {k}")
            extra = []
            if name == "acline": extra += [f"rate{i}" for i in range(1,13)]
            if name == "transformer":
                extra += [f"wdg1rate{i}" for i in range(1,13)]
                if d.get("kbus", 0):
                    extra += ["windv3", "r2_3", "x2_3", "sbase2_3", "r3_1", "x3_1", "sbase3_1"]
                    extra += [f"wdg{w}rate{i}" for w in (2,3) for i in range(1,13)]
            for k in extra:
                if k not in d or d[k] is None:
                    raise ValueError(f"RAWX {name} missing electrical field {k}")
            for k, v in d.items():
                if isinstance(v, float) and not math.isfinite(v):
                    raise ValueError(f"RAWX {name}.{k} non-finite numeric value")
