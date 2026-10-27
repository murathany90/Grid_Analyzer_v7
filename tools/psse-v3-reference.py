"""Development-only licensed AC reference matrix. Case values stay in private-re/."""
from pathlib import Path
import argparse
import collections
import hashlib
import json
import os
import struct
import sys
import time


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("cases", type=Path, nargs="+")
    parser.add_argument("--root", type=Path, default=Path(os.environ.get("PSSE_TEST_ROOT", r"C:\Program Files\PTI\PSSE36\36.5")))
    args = parser.parse_args()
    repo = Path(__file__).resolve().parents[1]
    private = repo / "private-re" / "ac-v3-reference"
    private.mkdir(parents=True, exist_ok=True)
    sys.path.insert(0, str(args.root / f"PSSPY{sys.version_info.major}{sys.version_info.minor}"))
    import psse36
    import psspy
    if psspy.psseinit(20000):
        raise RuntimeError("PSS/E initialization failed")
    for name in ["report_output", "progress_output", "alert_output", "prompt_output"]:
        getattr(psspy, name)(2, str(private / (name + ".log")), [0, 0])
    summaries = []

    def checked(error, operation):
        if error:
            raise RuntimeError(f"{operation}: {error}")

    def snapshot():
        error, bus, mismatch = psspy.maxmsm()
        return {"solved": psspy.solved(), "iterations": psspy.iterat(),
                "sysMismatchMva": psspy.sysmsm(), "maxMismatch": {"ierr": error, "bus": bus,
                "pMw": mismatch.real, "qMvar": mismatch.imag, "magnitudeMva": abs(mismatch)}}

    for source_arg in args.cases:
        source = source_arg.resolve(strict=True)
        source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
        directory = private / source_hash
        directory.mkdir(parents=True, exist_ok=True)
        checked(psspy.case(str(source)), "case")
        saved = snapshot()
        bus_error, bus_columns = psspy.abusint(-1, 2, ["NUMBER", "TYPE"])
        checked(bus_error, "abusint.NUMBER/TYPE")
        saved_bus_types = dict(zip(*bus_columns))
        parameters = {name: psspy.prmdat(name) for name in ["THRSHZ", "PQBRAK", "TOLN", "VCTOLQ", "VCTOLV", "DVLIM", "NDVFCT"]}
        rawx_path = directory / "source.rawx"
        checked(psspy.writerawx(str(rawx_path), "network"), "writerawx")
        rawx = json.loads(rawx_path.read_text(encoding="utf-8-sig"))
        network = rawx["network"]
        table = lambda name: [dict(zip(network[name]["fields"], row)) for row in network.get(name, {}).get("data", [])]
        machines, buses, lines, switches, droops = [table(name) for name in ["generator", "bus", "acline", "sysswd", "voltagedroop"]]
        active = [x for x in machines if x.get("stat", 1)]
        threshold = parameters["THRSHZ"][1]
        # writerawx emits decimal .0001 while SAV stores REAL*4 .00009999999747.
        # Compare at the source REAL*4 precision rather than mixing round trips.
        f32 = lambda value: struct.unpack("<f", struct.pack("<f", value))[0]
        ideal = [x for x in lines if x.get("stat", 1) and (x.get("bp", 0) or x.get("rpu", 0) == 0 and f32(abs(x["xpu"])) <= threshold)]
        ideal_switches = [x for x in switches if x.get("stat", 1) and f32(abs(x["xpu"])) <= threshold]
        parent = {x["ibus"]: x["ibus"] for x in buses}
        def find(bus):
            while parent[bus] != bus:
                parent[bus] = parent[parent[bus]]
                bus = parent[bus]
            return bus
        for line in ideal + ideal_switches:
            parent[find(line["jbus"])] = find(line["ibus"])
        group_sizes = collections.Counter(find(x["ibus"]) for x in buses)
        active_machine_groups = {find(x["ibus"]) for x in active}
        droop_error, droop_names = psspy.amachchar(-1, 4, ["DROOPNAME"])
        checked(droop_error, "amachchar.DROOPNAME")
        counts = {"buses": len(buses), "machines": len(machines), "activeMachines": len(active),
                  "activeWmod": dict(collections.Counter(str(x.get("wmod", 0)) for x in active)),
                  "allWmod": dict(collections.Counter(str(x.get("wmod", 0)) for x in machines)),
                  "activeNonzeroWmod": sum(x.get("wmod", 0) != 0 for x in active),
                  "allNonzeroWmod": sum(x.get("wmod", 0) != 0 for x in machines),
                  "activeRemoteMachines": sum(x.get("ireg", 0) not in [0, x["ibus"]] for x in active),
                  "allRemoteMachines": sum(x.get("ireg", 0) not in [0, x["ibus"]] for x in machines),
                  "droopRecords": len(droops), "activeDroopRecords": sum(x.get("status", 1) != 0 for x in droops),
                  "activeNamedDroopMachines": sum(bool((x.get("droopname") or "").strip()) for x in active),
                  "allNamedDroopMachines": sum(bool((x.get("droopname") or "").strip()) for x in machines),
                  "apiAllNamedDroopMachines": sum(bool(x.strip()) for x in droop_names[0]),
                  "idealLines": len(ideal), "idealSwitches": len(ideal_switches),
                  "idealComponentsWithMultipleBuses": sum(x > 1 for x in group_sizes.values()),
                  "idealContractedSourceBusCount": len(group_sizes),
                  "idealCycleRank": len(ideal) + len(ideal_switches) - len(buses) + len(group_sizes),
                  "savedEnergizedBuses": sum(t != 4 for t in saved_bus_types.values()),
                  "savedEnergizedContractedGroups": len({find(bus) for bus, kind in saved_bus_types.items() if kind != 4}),
                  "rawxExportBusTypeDifferences": sum(saved_bus_types[x["ibus"]] != x["ide"] for x in buses),
                  "rawxType2WithoutActiveLocalMachine": sum(x.get("ide") == 2 and x["ibus"] not in {m["ibus"] for m in active} for x in buses),
                  "sourceType2WithoutActiveLocalMachine": sum(saved_bus_types[x["ibus"]] == 2 and x["ibus"] not in {m["ibus"] for m in active} for x in buses),
                  "sourceType2WithoutActiveContractedGroupMachine": sum(saved_bus_types[x["ibus"]] == 2 and find(x["ibus"]) not in active_machine_groups for x in buses)}
        runs = []
        for method in ["fnsl", "fdns"]:
            for profile, options in [("fixed-ignore-q-nondiv", [0, 0, 0, 0, 0, 0, -1, 1]),
                                     ("fixed-limits-nondiv", [0, 0, 0, 0, 0, 0, 0, 1]),
                                     ("fixed-limits", [0, 0, 0, 0, 0, 0, 0, 0]),
                                     ("fixed-limits-source-tolerance", [0, 0, 0, 0, 0, 0, 0, 0]),
                                     ("automatic-limits-nondiv", [1, 1, 1, 1, 1, 0, 0, 1])]:
                checked(psspy.case(str(source)), "case")
                ints, reals = [psspy.getdefaultint()] * 9, [psspy.getdefaultreal()] * 21
                tolerance = parameters["TOLN"][1] if profile.endswith("source-tolerance") else .001
                ints[0], ints[1], reals[5] = 100, 100, tolerance
                checked(psspy.solution_parameters_5(ints, reals), "solution_parameters_5")
                before = snapshot()
                start = time.perf_counter()
                error = getattr(psspy, method)(options)
                run = {"method": method, "profile": profile, "options": options, "toleranceMva": tolerance, "ierr": error,
                       "elapsedMs": (time.perf_counter() - start) * 1000, "before": before, **snapshot()}
                private_result = {"run": run}
                for key, api, call_args, fields in [("buses", "abusreal", [-1, 2], ["PU", "ANGLED"]),
                                                     ("machines", "amachreal", [-1, 4], ["PGEN", "QGEN"])]:
                    code, columns = getattr(psspy, api)(*call_args, fields)
                    checked(code, api)
                    private_result[key] = dict(zip(fields, columns))
                (directory / f"{method}-{profile}.json").write_text(json.dumps(private_result, default=str), encoding="utf-8")
                runs.append(run)
                print(json.dumps({"source": source.name, **run}, default=str), flush=True)
        summaries.append({"source": {"name": source.name, "sha256": source_hash}, "version": psspy.psseversion(),
                          "savedState": saved, "parameters": parameters, "counts": counts, "runs": runs})
    result = {"schema": "ga.psse.v3-reference-matrix.v1", "sourceProvenance": "PSSE_REFERENCE", "cases": summaries}
    output = repo / "evidence" / "psse-v3" / "licensed-ac-reference-summary.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2, default=str) + "\n", encoding="utf-8")
    print(json.dumps({"aggregateOutput": str(output)}), flush=True)
    psspy.pssehalt_2()


if __name__ == "__main__":
    main()
