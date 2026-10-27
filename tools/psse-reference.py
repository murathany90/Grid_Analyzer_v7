"""Development-only licensed PSS/E oracle; never imported by the browser.

Run with the Python version supported by the local PSS/E installation.
Detailed user model values stay under ignored private-re/. Public reports must
contain aggregates only. Every uncached run reloads the original case.
"""
from pathlib import Path
import argparse
import hashlib
import json
import math
import os
import sys
import time
from psse_reference_io import annotate_reference


def digest(value):
    return hashlib.sha256(value).hexdigest()


def clean(value):
    if isinstance(value, complex):
        return {"real": value.real, "imag": value.imag}
    if isinstance(value, float) and not math.isfinite(value):
        return None
    if isinstance(value, dict):
        return {str(k): clean(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [clean(v) for v in value]
    return value


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("case", type=Path)
    parser.add_argument("--root", type=Path, default=Path(os.environ.get("PSSE_TEST_ROOT", r"C:\Program Files\PTI\PSSE36\36.5")))
    parser.add_argument("--method", choices=["fnsl", "fdns", "nsol", "solv", "dclf_2"], default="fnsl")
    parser.add_argument("--flat", type=int, choices=[0, 1], default=0)
    parser.add_argument("--q-limits", type=int, choices=[-1, 0, 99], default=-1)
    parser.add_argument("--control-profile", choices=["fixed", "automatic"], default="fixed")
    parser.add_argument("--report-units", choices=["mva", "kva"], default="mva")
    parser.add_argument("--iterations", type=int, default=100)
    parser.add_argument("--tolerance-mva", type=float, default=1e-3)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    repo = Path(__file__).resolve().parents[1]
    source = args.case.resolve(strict=True)
    source_hash = digest(source.read_bytes())
    options = [0, 0, 0, 0, 0, args.flat, args.q_limits, 1]
    if args.control_profile == "automatic":
        options[:5] = [1, 1, 1, 1, 1]
    if args.method == "nsol":
        options = options[:7]
    if args.method == "solv":
        control = 1 if args.control_profile == "automatic" else 0
        options = [control, control, args.flat, control, control, 1 if args.q_limits == -1 else 0]
    if args.method == "dclf_2":
        if args.control_profile != "fixed":
            parser.error("DC oracle profile uses explicitly fixed phase controls")
        # No hidden loss estimate; fixed phase angles; save base-case DC angles.
        options = [0, 0, 1, 1, 0, 1]
    spec = {"method": args.method, "options": options, "iterations": args.iterations,
            "toleranceMva": args.tolerance_mva, "profile": args.control_profile + "-controls-v1",
            "oracleVersion": "36.5.0", "harnessVersion": 2}
    if args.report_units == "kva":
        spec["reportPowerUnits"] = "KVA"
    option_hash = digest(json.dumps(spec, sort_keys=True).encode())
    key = f"{source_hash}-{args.method}-{option_hash}"
    directory = repo / "private-re" / "solver-reference" / key
    output = directory / "reference.json"
    if output.exists() and not args.force:
        print(json.dumps({"cache": "HIT", "output": str(output), "key": key}))
        return
    directory.mkdir(parents=True, exist_ok=True)
    sys.path.insert(0, str(args.root / f"PSSPY{sys.version_info.major}{sys.version_info.minor}"))
    import psse36  # Installed Siemens environment bootstrap, not a production dependency.
    import psspy
    init = psspy.psseinit(20000)
    if init != 0:
        raise RuntimeError(f"PSS/E initialization failed: {init}")
    for name in ["report_output", "progress_output", "alert_output", "prompt_output"]:
        getattr(psspy, name)(2, str(directory / (name + ".log")), [0, 0])
    if source.suffix.lower() == ".sav":
        load_error = psspy.case(str(source))
    elif source.suffix.lower() == ".raw":
        load_error = psspy.read(0, str(source))
    else:
        load_error = psspy.readrawx(str(source), "network", "new")
    if load_error != 0:
        raise RuntimeError(f"PSS/E case load failed: {load_error}")
    di, df = psspy.getdefaultint(), psspy.getdefaultreal()
    ints, reals = [di] * 9, [df] * 21
    ints[0], ints[1], reals[5] = args.iterations, args.iterations, args.tolerance_mva
    parameter_error = psspy.solution_parameters_5(ints, reals)
    if parameter_error:
        raise RuntimeError(f"PSS/E solution parameter setting failed: {parameter_error}")
    if args.report_units == "kva" and psspy.power_output(0):
        raise RuntimeError("PSS/E kVA report option failed")
    saved_state = {"solved": psspy.solved(), "sysMismatchMva": psspy.sysmsm(), "maxMismatch": psspy.maxmsm()}
    loaded_bus_types = {"number": psspy.abusint(-1, 2, "NUMBER"), "type": psspy.abusint(-1, 2, "TYPE")}
    start = time.perf_counter()
    if args.method == "dclf_2":
        ierr = psspy.dclf_2(0, 1, options, [0, 0, 0], "1")
    else:
        ierr = getattr(psspy, args.method)(options)
    elapsed = (time.perf_counter() - start) * 1000
    errors = []

    def columns(name, call_args, fields):
        result = {}
        for field in fields:
            try:
                code, arrays = getattr(psspy, name)(*call_args, [field])
                if code:
                    errors.append({"api": name, "field": field, "ierr": code})
                else:
                    result[field] = arrays[0] if arrays else []
            except Exception as exc:
                errors.append({"api": name, "field": field, "exception": str(exc)})
        return result

    buses = {**columns("abusint", [-1, 2], ["NUMBER", "TYPE", "AREA", "ZONE", "OWNER"]),
             **columns("abusreal", [-1, 2], ["PU", "ANGLE", "BASE"])}
    generators = {**columns("amachint", [-1, 4], ["NUMBER", "STATUS"]),
                  **columns("amachchar", [-1, 4], ["ID"]),
                  **columns("amachreal", [-1, 4], ["PGEN", "QGEN", "PMAX", "PMIN", "QMAX", "QMIN"])}
    # Double entries preserve both ends rather than deriving receiving-end flow.
    branch_args = [-1, 1, 3, 4, 2]
    branches = {**columns("abrnint", branch_args, ["FROMNUMBER", "TONUMBER", "STATUS"]),
                **columns("abrnchar", branch_args, ["ID"]),
                **columns("abrnreal", branch_args, ["P", "Q", "MVA", "AMPS", "PLOSS", "QLOSS"])}
    three_args = [-1, 1, 3, 2, 1]
    three = {**columns("atr3int", three_args, ["WIND1NUMBER", "WIND2NUMBER", "WIND3NUMBER", "STATUS"]),
             **columns("atr3char", three_args, ["ID"]),
             **columns("atr3real", three_args, ["VMSTAR", "ANSTAR", "PLOSS", "QLOSS"])}
    winding_args = [-1, 1, 3, 3, 1]
    windings = {**columns("awndint", winding_args, ["WIND1NUMBER", "WIND2NUMBER", "WIND3NUMBER", "WNDNUM", "STATUS"]),
                **columns("awndchar", winding_args, ["ID"]),
                **columns("awndreal", winding_args, ["P", "Q", "MVA", "AMPS", "RATIO", "ANGLE"])}
    result = {"schema": "ga.psse.reference.v1", "provenance": "PSSE_REFERENCE",
              "source": {"name": source.name, "sha256": source_hash}, "optionsHash": option_hash,
              "spec": spec, "version": psspy.psseversion(), "loadError": load_error,
              "savedState": saved_state, "ierr": ierr, "solved": psspy.solved(),
              "loadedSourceBusTypes": loaded_bus_types,
              "iterations": psspy.iterat(), "sysMismatchMva": psspy.sysmsm(),
              "maxMismatch": psspy.maxmsm(), "elapsedMs": elapsed, "buses": buses,
              "generators": generators, "branches": branches, "threeWinding": three,
              "windings": windings, "exportErrors": errors,
              "dcCaution": "DC P/angle evidence only. Saved Q/Vm and AC solved flag are not DC convergence evidence." if args.method == "dclf_2" else None}
    output.write_text(json.dumps(clean(annotate_reference(result, directory)), indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print(json.dumps({"cache": "MISS", "output": str(output), "key": key, "ierr": ierr,
                      "solved": result["solved"], "iterations": result["iterations"],
                      "sysMismatchMva": result["sysMismatchMva"], "elapsedMs": elapsed,
                      "exportErrors": errors}))
    psspy.pssehalt_2()


if __name__ == "__main__":
    main()
