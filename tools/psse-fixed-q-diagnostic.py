"""Tiny original-fixture experiment for fixed-Q and mixed-machine plant semantics.

Development-only PSS/E oracle. No browser dependency and no licensed model input.
"""
from copy import deepcopy
from pathlib import Path
import json
import os
import sys

repo = Path(__file__).resolve().parents[1]
root = Path(os.environ.get("PSSE_TEST_ROOT", r"C:\Program Files\PTI\PSSE36\36.5"))
sys.path.insert(0, str(root / f"PSSPY{sys.version_info.major}{sys.version_info.minor}"))
import psse36
import psspy

source = json.loads((repo / ".tmp" / "psse-synthetic" / "q-zero-range.rawx").read_text(encoding="utf-8"))
directory = repo / "private-re" / "fixed-q-diagnostic"
directory.mkdir(parents=True, exist_ok=True)
if psspy.psseinit(1000):
    raise RuntimeError("PSS/E initialization failed")
for name in ["report_output", "progress_output", "alert_output", "prompt_output"]:
    getattr(psspy, name)(2, str(directory / (name + ".log")), [0, 0])

fields = source["network"]["generator"]["fields"]
index = {name: i for i, name in enumerate(fields)}
template = source["network"]["generator"]["data"][1]


def machine(identifier, p, q, lower, upper):
    row = list(template)
    for key, value in {"machid": identifier, "pg": p, "qg": q, "qb": lower, "qt": upper}.items():
        row[index[key]] = value
    return row


def snapshot():
    errors = []

    def get(function, strings):
        error, columns = function(-1, 4, strings)
        if error:
            errors.append({"function": function.__name__, "fields": strings, "ierr": error})
        return dict(zip(strings, columns or []))

    voltage_error, voltage_columns = psspy.abusreal(-1, 2, ["PU"])
    if voltage_error:
        errors.append({"function": "abusreal", "ierr": voltage_error})
    return {"busVmPu": voltage_columns[0] if voltage_columns else [],
            "machines": {**get(psspy.amachint, ["NUMBER", "STATUS"]),
                         **get(psspy.amachchar, ["ID"]),
                         **get(psspy.amachreal, ["PGEN", "QGEN", "QMAX", "QMIN"])},
            "plants": get(psspy.agenbusreal, ["VSPU"]), "exportErrors": errors}


cases = [
    ("equal_5_input_q_0", [machine("1", 60, 0, 5, 5)]),
    ("equal_5_input_q_9", [machine("1", 60, 9, 5, 5)]),
    ("mixed_fixed_5_and_regulator", [machine("1", 20, 0, 5, 5), machine("2", 40, 0, -100, 100)]),
    ("all_fixed_5_and_minus3", [machine("1", 20, 0, 5, 5), machine("2", 40, 0, -3, -3)]),
]
options = [0, 0, 0, 0, 0, 1, -1, 1]
runs = []
for name, machines in cases:
    model = deepcopy(source)
    model["network"]["generator"]["data"] = [model["network"]["generator"]["data"][0], *machines]
    filename = directory / (name + ".rawx")
    filename.write_text(json.dumps(model) + "\n", encoding="utf-8")
    load_error = psspy.readrawx(str(filename), "network", "new")
    if load_error:
        raise RuntimeError(f"{name}: source read failed {load_error}")
    before = snapshot()
    error = psspy.fnsl(options)
    runs.append({"condition": name, "options": options, "before": before,
                 "ierr": error, "solved": psspy.solved(), "iterations": psspy.iterat(), "after": snapshot()})

result = {"schema": "ga.psse.fixed-q-plant-experiment.v1", "referenceVersion": "36.5.0",
          "fixture": "Original public three-bus source, varied only at bus-2 machine records", "runs": runs}
output = repo / "evidence" / "psse-ac-dc" / "fixed-q-plant-reference.json"
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
print(json.dumps(result))
psspy.pssehalt_2()
