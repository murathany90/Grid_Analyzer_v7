"""Development-only licensed V4 control reference. Writes only under private-re/.

Captures, per real SAV:
- fnsl automatic-adjustment profile [1,1,1,1,1,0,0,1] at 0.001 MVA tolerance
- fdns automatic-adjustment profile at 0.001 and 0.1 MVA tolerance
- end-state winding ratios and switched-shunt susceptances via writerawx
- solved bus voltages and machine P/Q
Tap/shunt adjustment direction ground truth comes from comparing source vs
solved RAWX against the initial controlled-bus voltage violations.
"""
from pathlib import Path
import hashlib
import json
import os
import sys
import time


def main():
    root = Path(os.environ.get("PSSE_TEST_ROOT", r"C:\Program Files\PTI\PSSE36\36.5"))
    repo = Path(__file__).resolve().parents[1]
    out = repo / "private-re" / "ac-v4-reference"
    out.mkdir(parents=True, exist_ok=True)
    sys.path.insert(0, str(root / f"PSSPY{sys.version_info.major}{sys.version_info.minor}"))
    import psse36
    import psspy
    if psspy.psseinit(20000):
        raise RuntimeError("PSS/E initialization failed")
    for name in ["report_output", "progress_output", "alert_output", "prompt_output"]:
        getattr(psspy, name)(2, str(out / (name + ".log")), [0, 0])

    def snapshot():
        error, bus, mismatch = psspy.maxmsm()
        return {"solved": psspy.solved(), "iterations": psspy.iterat(),
                "sysMismatchMva": psspy.sysmsm(),
                "maxMismatch": {"ierr": error, "bus": bus, "pMw": mismatch.real,
                                "qMvar": mismatch.imag, "magnitudeMva": abs(mismatch)}}

    def rawx_tables(path):
        rawx = json.loads(Path(path).read_text(encoding="utf-8-sig"))
        network = rawx["network"]

        def table(name):
            meta = network.get(name, {})
            return [dict(zip(meta["fields"], row)) for row in meta.get("data", [])]

        return {name: table(name) for name in
                ["bus", "transformer", "switched_shunt", "generator", "fixshunt", "acline"]}

    def voltages_and_machines():
        code, cols = psspy.abusreal(-1, 2, ["PU", "ANGLED"])
        assert code == 0, "abusreal"
        vm, va = cols
        code, cols = psspy.amachreal(-1, 4, ["PGEN", "QGEN"])
        assert code == 0, "amachreal"
        return {"vmPu": list(vm), "vaDeg": list(va), "pgenMw": cols[0], "qgenMvar": cols[1]}

    cases = [Path(arg) for arg in sys.argv[1:]] or [
        repo / "private-re" / "ac-v3-reference" / "20261026_1600_SN1_TR0.sav",
        Path(r"C:\Program Files\PTI\PSSE36\36.5\control1\20261014_1200_SN3_TR0.sav"),
    ]
    profiles = [
        ("fnsl-automatic", psspy.fnsl, [1, 1, 1, 1, 1, 0, 0, 1], 0.001),
        ("fdns-automatic-strict", psspy.fdns, [1, 1, 1, 1, 1, 0, 0, 1], 0.001),
        ("fdns-automatic-operational", psspy.fdns, [1, 1, 1, 1, 1, 0, 0, 1], 0.1),
    ]
    results = []
    for source in cases:
        source = source.resolve(strict=True)
        digest = hashlib.sha256(source.read_bytes()).hexdigest()
        directory = out / digest
        directory.mkdir(parents=True, exist_ok=True)
        assert psspy.case(str(source)) == 0, "case"
        source_rawx = directory / "source.rawx"
        assert psspy.writerawx(str(source_rawx), "network") == 0, "writerawx source"
        source_tables = rawx_tables(source_rawx)
        saved = snapshot()
        runs = []
        for name, method, options, tolerance in profiles:
            assert psspy.case(str(source)) == 0, "case reload"
            ints, reals = [psspy.getdefaultint()] * 9, [psspy.getdefaultreal()] * 21
            ints[0], ints[1], reals[5] = 100, 100, tolerance
            assert psspy.solution_parameters_5(ints, reals) == 0, "solution_parameters_5"
            before = snapshot()
            start = time.perf_counter()
            ierr = method(options)
            run = {"profile": name, "options": options, "toleranceMva": tolerance, "ierr": ierr,
                   "elapsedMs": (time.perf_counter() - start) * 1000, "before": before, **snapshot()}
            if run["solved"] == 0:
                solved_rawx = directory / f"{name}.rawx"
                assert psspy.writerawx(str(solved_rawx), "network") == 0, f"writerawx {name}"
                run["tables"] = {k: rawx_tables(solved_rawx)[k] for k in
                                 ["transformer", "switched_shunt"]}
                run.update(voltages_and_machines())
            runs.append(run)
            print(json.dumps({"source": source.name, **{k: run[k] for k in
                  ["profile", "ierr", "solved", "iterations", "sysMismatchMva", "elapsedMs"]}}, default=str), flush=True)
        results.append({"source": {"name": source.name, "sha256": digest},
                        "savedState": saved, "sourceTables": source_tables, "runs": runs})
    (out / "control-reference.json").write_text(json.dumps(results, default=str), encoding="utf-8")
    print(json.dumps({"output": str(out / "control-reference.json")}), flush=True)
    psspy.pssehalt_2()


if __name__ == "__main__":
    main()
