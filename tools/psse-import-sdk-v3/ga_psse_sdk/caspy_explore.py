"""Phase A: exhaustive discovery of what caspy (Siemens saved-case reader) exposes.

Produces, per SAV file, a JSON inventory: every table, every key, python type,
record count, sample values, and empty/unresolvable flags.
"""
import argparse
import glob
import hashlib
import json
import os
import sys
import traceback

from . import psse_env


def _desc(v, nsample=3):
    t = type(v).__name__
    if isinstance(v, tuple):
        d = {"type": "tuple", "len": len(v)}
        if v:
            d["elemType"] = type(v[0]).__name__
            if isinstance(v[0], tuple):
                d["elemLen"] = len(v[0])
                d["innerElemType"] = type(v[0][0]).__name__ if v[0] else None
            d["sample"] = [_jsonable(x) for x in v[:nsample]]
            d["allZeroOrBlank"] = _all_blank(v)
        return d
    return {"type": t, "value": _jsonable(v)}


def _all_blank(v):
    def blank(x):
        if isinstance(x, tuple):
            return all(blank(y) for y in x)
        if isinstance(x, str):
            return x.strip() == ""
        if isinstance(x, (int, float, bool)):
            return x == 0
        return False
    return all(blank(x) for x in v)


def _jsonable(x):
    if isinstance(x, complex):
        return {"re": x.real, "im": x.imag}
    if isinstance(x, tuple):
        return [_jsonable(y) for y in x]
    if isinstance(x, float):
        if x != x or x in (float("inf"), float("-inf")):
            return None
        return x
    if isinstance(x, (int, str, bool)) or x is None:
        return x
    return repr(x)


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def explore(sav_path):
    caspy = psse_env.import_caspy()
    out = {"file": os.path.basename(sav_path), "path": sav_path, "bytes": os.path.getsize(sav_path),
           "sha256": sha256(sav_path), "tables": {}, "errors": []}
    case = caspy.Savecase(sav_path)
    for name in sorted(n for n in dir(case) if not n.startswith("_")):
        val = getattr(case, name)
        if not isinstance(val, dict) and not hasattr(val, "keys"):
            if isinstance(val, (int, float, str)):
                out["tables"][name] = {"_scalar": val}
            continue
        tbl = {}
        for k in val.keys():
            try:
                tbl[k] = _desc(val[k])
            except Exception as e:  # noqa
                tbl[k] = {"error": repr(e)}
                out["errors"].append("%s.%s: %r" % (name, k, e))
        out["tables"][name] = tbl
    size = out["tables"].get("psssiz", {})
    out["sizes"] = {k: v.get("value") for k, v in size.items() if "value" in v}
    return out


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("files", nargs="+")
    ap.add_argument("--out", required=True, help="output directory")
    a = ap.parse_args(argv)
    os.makedirs(a.out, exist_ok=True)
    files = []
    for f in a.files:
        files.extend(glob.glob(f))
    summary = []
    for f in sorted(files):
        base = os.path.splitext(os.path.basename(f))[0]
        try:
            r = explore(f)
            with open(os.path.join(a.out, base + ".caspy_inventory.json"), "w", encoding="utf-8") as fh:
                json.dump(r, fh, indent=1)
            s = r["sizes"]
            summary.append({"file": os.path.basename(f), "ok": True, "bytes": r["bytes"],
                            "NBUS": s.get("NBUS"), "NLOAD": s.get("NLOAD"), "NGEN": s.get("NGEN"),
                            "NLIN": s.get("NLIN"), "NTRFMR": s.get("NTRFMR"), "N3WNDT": s.get("N3WNDT"),
                            "NSHUNT": s.get("NSHUNT"), "NBUSHN": s.get("NBUSHN"), "NFACTS": s.get("NFACTS"),
                            "NDCL": s.get("NDCL"), "NVSC": s.get("NVSC"), "NMTDCL": s.get("NMTDCL"),
                            "NSWD": s.get("NSWD"), "NSTATS": s.get("NSTATS"), "NSNODE": s.get("NSNODE"),
                            "NINDMC": s.get("NINDMC"), "NGNES": s.get("NGNES"), "errors": len(r["errors"])})
            print("OK  ", os.path.basename(f), summary[-1])
        except Exception as e:
            summary.append({"file": os.path.basename(f), "ok": False, "error": repr(e)})
            print("FAIL", os.path.basename(f), repr(e))
            traceback.print_exc()
    with open(os.path.join(a.out, "caspy_summary.json"), "w", encoding="utf-8") as fh:
        json.dump(summary, fh, indent=1)


if __name__ == "__main__":
    main()
