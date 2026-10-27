"""Original tiny fixture, metadata-only PQBRAK change; no power-flow solve."""
from pathlib import Path
import json
import os
import sys

repo = Path(__file__).resolve().parents[1]
root = Path(os.environ.get("PSSE_TEST_ROOT", r"C:\Program Files\PTI\PSSE36\36.5"))
sys.path.insert(0, str(root / f"PSSPY{sys.version_info.major}{sys.version_info.minor}"))
import psse36
import psspy

directory = repo / "private-re" / "pqbrak-metadata"
directory.mkdir(parents=True, exist_ok=True)
if psspy.psseinit(1000):
    raise RuntimeError("Initialization failed")
for name in ["report_output", "progress_output", "alert_output", "prompt_output"]:
    getattr(psspy, name)(2, str(directory / (name + ".log")), [0, 0])
if psspy.readrawx(str(repo / ".tmp" / "psse-synthetic" / "basic.rawx"), "network", "new"):
    raise RuntimeError("Fixture read failed")
before = psspy.prmdat("PQBRAK")
if psspy.save(str(directory / "before.sav")):
    raise RuntimeError("Initial metadata save failed")
integers, reals = [psspy.getdefaultint()] * 9, [psspy.getdefaultreal()] * 21
reals[9] = .82
error = psspy.solution_parameters_5(integers, reals)
if error:
    raise RuntimeError(f"Metadata update failed: {error}")
after = psspy.prmdat("PQBRAK")
if psspy.save(str(directory / "after.sav")):
    raise RuntimeError("Changed metadata save failed")
record = {"schema": "ga.psse.pqbrak-metadata-reference.v1", "fixture": "Original public three-bus fixture",
          "referenceVersion": "36.5.0", "powerFlowSolves": 0, "before": {"ierr": before[0], "pqbrak": before[1]},
          "after": {"ierr": after[0], "pqbrak": after[1]}, "changedOption": "solution_parameters_5 REALAR(10)"}
(repo / "evidence" / "psse-ac-dc" / "pqbrak-metadata-reference.json").write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
print(json.dumps(record))
psspy.pssehalt_2()
