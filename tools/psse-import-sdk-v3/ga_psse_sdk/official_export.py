"""Official PSS(R)E API export: SAV -> RAW (v36) / RAWX (network domain) / SEQ.

Uses only documented psspy calls whose signatures were verified locally (PSSE 36.5):
  psspy.psseinit(buses)
  psspy.case(sfile)
  psspy.writerawversion(vernum, out, ofile)          out=0 -> file
  psspy.writerawx(sfile, domains)
  psspy.writeseqversion_2(vernum, out, ofile, gzoptn) out=0 -> file

Each case is exported in its own worker process so that a licensing/size failure of one
case cannot poison the next. The PSSE banner / log is stored as evidence.
"""
import argparse
import json
import os
import subprocess
import sys
import time

from . import psse_env

WORKER_FLAG = "--worker"


def _worker(sav, outdir, base, vernum, buses, root):
    res = {"sav": sav, "base": base, "method": "psspy-official", "vernum": vernum,
           "steps": {}, "ok": False}
    psspy = psse_env.import_psspy(root)
    res["psseinit_ierr"] = psspy.psseinit(buses)
    res["case_ierr"] = psspy.case(sav)
    if res["case_ierr"] != 0:
        res["error"] = ("psspy.case failed (ierr=%s). With PSSE Xplore this is typically the "
                        "50-bus/size limit; see log." % res["case_ierr"])
        print("RESULT_JSON:" + json.dumps(res))
        return 2
    os.makedirs(outdir, exist_ok=True)
    raw = os.path.join(outdir, base + ".raw")
    rawx = os.path.join(outdir, base + ".rawx")
    seq = os.path.join(outdir, base + ".seq")
    res["steps"]["writerawversion"] = psspy.writerawversion(vernum, 0, raw)
    res["steps"]["writerawx"] = psspy.writerawx(rawx, "network")
    res["steps"]["writeseqversion_2"] = psspy.writeseqversion_2(vernum, 0, seq, 0)
    res["files"] = {}
    for k, p in (("raw", raw), ("rawx", rawx), ("seq", seq)):
        if os.path.exists(p):
            res["files"][k] = {"path": p, "bytes": os.path.getsize(p)}
    res["seq_has_data"] = seq_has_data(seq) if os.path.exists(seq) else False
    if not res["seq_has_data"] and os.path.exists(seq):
        os.remove(seq)          # no sequence data in the case: do not ship an empty SEQ
        res["files"].pop("seq", None)
    res["ok"] = all(v == 0 for v in res["steps"].values())
    print("RESULT_JSON:" + json.dumps(res))
    return 0 if res["ok"] else 3


def seq_has_data(path):
    """True if a SEQ file holds at least one data record (not just section terminators)."""
    with open(path, "r", errors="replace") as f:
        lines = f.read().splitlines()
    n = 0
    for ln in lines[:]:
        s = ln.strip()
        if not s or s.startswith("@"):
            continue
        if s.startswith("0 /") or s == "0" or s.startswith("Q"):
            continue
        n += 1
    return n > 1  # first line is the header record


def export_case(sav, outdir, base=None, vernum="36", buses=200000, root=None, logdir=None):
    base = base or os.path.splitext(os.path.basename(sav))[0]
    cmd = [sys.executable, "-m", "ga_psse_sdk.official_export", WORKER_FLAG, sav, outdir, base,
           vernum, str(buses)]
    if root:
        cmd.append(root)
    t0 = time.time()
    p = subprocess.run(cmd, capture_output=True, text=True,
                       cwd=os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    res = None
    for line in p.stdout.splitlines():
        if line.startswith("RESULT_JSON:"):
            res = json.loads(line[len("RESULT_JSON:"):])
    if res is None:
        res = {"sav": sav, "base": base, "ok": False, "method": "psspy-official",
               "error": "worker produced no result (exit %s)" % p.returncode}
    res["exitCode"] = p.returncode
    res["seconds"] = round(time.time() - t0, 2)
    if logdir:
        os.makedirs(logdir, exist_ok=True)
        with open(os.path.join(logdir, base + ".psse.stdout.log"), "w", encoding="utf-8") as f:
            f.write(p.stdout)
    return res


# Alias for backwards compatibility
export_one = export_case


def main(argv=None):
    argv = list(sys.argv[1:] if argv is None else argv)
    if argv and argv[0] == WORKER_FLAG:
        sav, outdir, base, vernum, buses = argv[1:6]
        root = argv[6] if len(argv) > 6 else None
        return _worker(sav, outdir, base, vernum, int(buses), root)
    ap = argparse.ArgumentParser(description="SAV -> RAW/RAWX/SEQ via official psspy API")
    ap.add_argument("sav", nargs="+")
    ap.add_argument("--out", required=True)
    ap.add_argument("--log", default=None)
    ap.add_argument("--json", default=None, help="write results JSON (UTF-8) to this path")
    a = ap.parse_args(argv)
    results = [export_case(s, a.out, logdir=a.log) for s in a.sav]
    txt = json.dumps(results, indent=1)
    if a.json:
        with open(a.json, "w", encoding="utf-8") as f:
            f.write(txt)
    print(txt)
    return 0


if __name__ == "__main__":
    sys.exit(main())
