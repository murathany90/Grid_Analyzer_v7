"""Controlled original fixture: distinguish saved Q-active-set state from voltage start."""
from pathlib import Path
import hashlib
import json
import os
import sys

repo = Path(__file__).resolve().parents[1]
root = Path(os.environ.get("PSSE_TEST_ROOT", r"C:\Program Files\PTI\PSSE36\36.5"))
sys.path.insert(0, str(root / f"PSSPY{sys.version_info.major}{sys.version_info.minor}"))
import psse36
import psspy

directory = repo / "private-re" / "q-state-reference"
directory.mkdir(parents=True, exist_ok=True)
source = repo / ".tmp" / "psse-synthetic" / "q-limits.rawx"
saved = repo / "private-re" / "synthetic-sav" / "q-limits-solved.sav"
if psspy.psseinit(10000):
    raise RuntimeError("PSS/E initialization failed")
for name in ["report_output", "progress_output", "alert_output", "prompt_output"]:
    getattr(psspy, name)(2, str(directory / (name + ".log")), [0, 0])
rows = []


def snapshot(label, options, error):
    rows.append({"condition": label, "options": options, "ierr": error,
                 "solved": psspy.solved(), "iterations": psspy.iterat(),
                 "vmPu": psspy.abusreal(-1, 2, ["PU"])[1][0],
                 "qMvar": psspy.amachreal(-1, 4, ["QGEN"])[1][0],
                 "scheduledVoltagePu": psspy.agenbusreal(-1, 4, ["VSPU"])[1][0]})


if psspy.readrawx(str(source), "network", "new"):
    raise RuntimeError("Synthetic source read failed")
options = [0, 0, 0, 0, 0, 1, 0, 1]
snapshot("Fresh RAWX; apply Q limits", options, psspy.fnsl(options))
if psspy.save(str(saved)):
    raise RuntimeError("SAV fixture write failed")
if psspy.case(str(saved)):
    raise RuntimeError("SAV reload failed")
options = [0, 0, 0, 0, 0, 1, -1, 1]
snapshot("Reload Q-limited SAV; ignore new limit monitoring; flat voltage start", options, psspy.fnsl(options))
if psspy.readrawx(str(source), "network", "new"):
    raise RuntimeError("Fresh RAWX reload failed")
snapshot("Fresh RAWX; ignore Q limits; flat voltage start", options, psspy.fnsl(options))
result = {"schema": "ga.psse.q-state-experiment.v1", "fixture": "Original public three-bus Q-limit fixture",
          "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
          "savedSha256": hashlib.sha256(saved.read_bytes()).hexdigest(), "runs": rows,
          "interpretation": "A saved reactive active set and a flat voltage initialization are independent state dimensions; compare observed values before assigning semantics."}
output = repo / "evidence" / "psse-ac-dc" / "q-active-state-reference.json"
output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
print(json.dumps(result))
psspy.pssehalt_2()
