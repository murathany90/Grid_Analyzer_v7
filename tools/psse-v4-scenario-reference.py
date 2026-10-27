"""Development-only licensed V4 scenario reference. Writes only under private-re/.

Per real SAV, via the proven RAWX round trip (writerawx -> edit -> readrawx):
- +10% and +20% scaling of every load's PL/QL/IP/IQ/YP/YQ
- one deterministic high-voltage line opened (stat=0)
Each variant solves with the fixed-limits fnsl profile and the automatic
adjustment profile at 0.001 MVA tolerance; solved bus voltages and machine
P/Q are captured for GA parity comparison.
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
        getattr(psspy, name)(2, str(out / ("scenario-" + name + ".log")), [0, 0])

    def snapshot():
        return {"solved": psspy.solved(), "iterations": psspy.iterat(),
                "sysMismatchMva": psspy.sysmsm()}

    def capture(buses):
        code, cols = psspy.abusreal(-1, 2, ["PU", "ANGLED"])
        assert code == 0, "abusreal"
        code, mcols = psspy.amachreal(-1, 4, ["PGEN", "QGEN"])
        assert code == 0, "amachreal"
        return {"vmPu": list(cols[0]), "vaDeg": list(cols[1]),
                "pgenMw": mcols[0], "qgenMvar": mcols[1], "busOrder": buses}

    def solve_profiles(variant_path):
        runs = []
        for name, options in [("fnsl-fixed", [0, 0, 0, 0, 0, 0, 0, 0]),
                              ("fnsl-automatic", [1, 1, 1, 1, 1, 0, 0, 1])]:
            assert psspy.readrawx(str(variant_path), "network", "new") == 0, f"readrawx {name}"
            ints, reals = [psspy.getdefaultint()] * 9, [psspy.getdefaultreal()] * 21
            ints[0], ints[1], reals[5] = 100, 100, 0.001
            assert psspy.solution_parameters_5(ints, reals) == 0
            start = time.perf_counter()
            ierr = psspy.fnsl(options)
            run = {"profile": name, "options": options, "toleranceMva": 0.001, "ierr": ierr,
                   "elapsedMs": (time.perf_counter() - start) * 1000, **snapshot()}
            code, cols = psspy.abusint(-1, 2, ["NUMBER"])
            assert code == 0
            if run["solved"] == 0:
                run.update(capture(cols[0]))
            runs.append(run)
            print(json.dumps({k: run[k] for k in ["profile", "ierr", "solved", "iterations",
                                                  "sysMismatchMva"]}, default=str), flush=True)
        return runs

    cases = [Path(arg) for arg in sys.argv[1:]] or [
        repo / "private-re" / "ac-v3-reference" / "20261026_1600_SN1_TR0.sav",
        Path(r"C:\Program Files\PTI\PSSE36\36.5\control1\20261014_1200_SN3_TR0.sav"),
    ]
    results = []
    for source in cases:
        source = source.resolve(strict=True)
        digest = hashlib.sha256(source.read_bytes()).hexdigest()
        directory = out / digest
        directory.mkdir(parents=True, exist_ok=True)
        assert psspy.case(str(source)) == 0, "case"
        base_rawx = directory / "scenario-base.rawx"
        assert psspy.writerawx(str(base_rawx), "network") == 0, "writerawx"
        base = json.loads(base_rawx.read_text(encoding="utf-8-sig"))
        network = base["network"]

        def rows(name):
            meta = network[name]
            return [dict(zip(meta["fields"], row)) for row in meta.get("data", [])]

        def write_variant(name, mutate):
            variant = json.loads(base_rawx.read_text(encoding="utf-8-sig"))
            mutate(variant["network"])
            path = directory / f"scenario-{name}.rawx"
            path.write_text(json.dumps(variant), encoding="utf-8")
            return {"scenario": name, "runs": solve_profiles(path)}

        def scale_loads(factor):
            def mutate(net):
                fields = net["load"]["fields"]
                for row in net["load"]["data"]:
                    for f in ["pl", "ql", "ip", "iq", "yp", "yq"]:
                        idx = fields.index(f)
                        if isinstance(row[idx], (int, float)):
                            row[idx] = row[idx] * factor
            return mutate

        def open_line(net):
            fields = net["acline"]["fields"]
            bus_fields = net["bus"]["fields"]
            buses = {row[bus_fields.index("ibus")]: row[bus_fields.index("baskv")]
                     for row in net["bus"]["data"]}
            best, best_x = None, -1
            for line in net["acline"]["data"]:
                if not line[fields.index("stat")]:
                    continue
                if buses.get(line[fields.index("ibus")], 0) < 380 or buses.get(line[fields.index("jbus")], 0) < 380:
                    continue
                x = abs(line[fields.index("xpu")])
                if x > best_x:
                    best, best_x = line, x
            assert best is not None, "no 380kV line"
            best[fields.index("stat")] = 0
            print(json.dumps({"openedLine": {"ibus": best[fields.index("ibus")],
                                             "jbus": best[fields.index("jbus")],
                                             "ckt": best[fields.index("ckt")]}}), flush=True)

        scenarios = [
            write_variant("load10", scale_loads(1.1)),
            write_variant("load20", scale_loads(1.2)),
            write_variant("lineout", open_line),
        ]
        results.append({"source": {"name": source.name, "sha256": digest},
                        "busCount": len(network["bus"]["data"]), "scenarios": scenarios})
    (out / "scenario-reference.json").write_text(json.dumps(results, default=str), encoding="utf-8")
    print(json.dumps({"output": str(out / "scenario-reference.json")}), flush=True)
    psspy.pssehalt_2()


if __name__ == "__main__":
    main()
