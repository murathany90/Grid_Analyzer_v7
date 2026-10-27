"""Licensed replay of original public tiny fixtures; no private network input."""
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

source = json.loads((repo / ".tmp" / "psse-synthetic" / "basic.rawx").read_text(encoding="utf-8"))
private = repo / "private-re" / "ac-v3-controls"
private.mkdir(parents=True, exist_ok=True)
if psspy.psseinit(1000):
    raise RuntimeError("PSS/E initialization failed")
for name in ["report_output", "progress_output", "alert_output", "prompt_output"]:
    getattr(psspy, name)(2, str(private / (name + ".log")), [0, 0])


def update(table, index, values):
    for key, value in values.items():
        if key not in table["fields"]:
            table["fields"].append(key)
            for row in table["data"]:
                row.append(None)
        table["data"][index][table["fields"].index(key)] = value


conditions = [("wmod0-pv", {"wmod": 0}), ("wmod1-qt-qb", {"wmod": 1, "qt": 5, "qb": -5, "vs": 1.06}),
              ("wmod2-pf-limits", {"wmod": 2, "wpf": .95, "vs": 1.06}),
              ("wmod3-positive-pf", {"wmod": 3, "wpf": .95, "qg": 9}),
              ("wmod3-negative-pf", {"wmod": 3, "wpf": -.95, "qg": 9}),
              ("wmod4-fixed-q", {"wmod": 4, "qg": 12}),
              ("generatorless-type2", {"stat": 0}),
              ("remote-regulation", {"ireg": 3, "vs": 1.01}),
              ("assigned-droop", {"wmod": 1, "droopname": "TEST_DROOP"})]
runs = []
for name, values in conditions:
    model = deepcopy(source)
    network = model["network"]
    update(network["generator"], 1, values)
    if name == "assigned-droop":
        network["voltagedroop"] = {"fields": ["name", "status", "regbus", "qdb", "qmin", "qmax", "vdblow", "vdbhigh", "vlow", "vhigh"],
                                  "data": [["TEST_DROOP", 1, 2, 12, -100, 100, .98, 1.02, .9, 1.1]]}
    file = private / (name + ".rawx")
    file.write_text(json.dumps(model), encoding="utf-8")
    error = psspy.readrawx(str(file), "network", "new")
    if error:
        raise RuntimeError(f"{name} read: {error}")
    integers, reals = [psspy.getdefaultint()] * 9, [psspy.getdefaultreal()] * 21
    integers[0], integers[1], reals[5] = 100, 100, .00001
    if psspy.solution_parameters_5(integers, reals):
        raise RuntimeError("Could not set tiny fixture tolerance")
    options = [0, 0, 0, 0, 0, 1, 0, 1]
    error = psspy.fnsl(options)
    def columns(api, flag, fields):
        code, arrays = getattr(psspy, api)(-1, flag, fields)
        if code:
            raise RuntimeError(f"{name} {api}: {code}")
        return dict(zip(fields, arrays))
    run = {"condition": name, "sourceChanges": values, "options": options, "toleranceMva": .00001, "ierr": error, "solved": psspy.solved(),
           "iterations": psspy.iterat(), "sysMismatchMva": psspy.sysmsm(),
           "bus": {**columns("abusint", 2, ["NUMBER", "TYPE"]), **columns("abusreal", 2, ["PU", "ANGLED"])},
           "machines": {**columns("amachreal", 4, ["PGEN", "QGEN", "QMAX", "QMIN"]),
                        **columns("amachchar", 4, ["DROOPNAME"])}}
    runs.append(run)
result = {"schema": "ga.psse.v3-control-reference.v1", "version": psspy.psseversion(),
          "fixture": "Original public three-bus basic.rawx from tools/psse-synthetic-cases.ts", "runs": runs}
output = repo / "evidence" / "psse-v3" / "tiny-control-reference.json"
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
print(json.dumps(result))
psspy.pssehalt_2()
