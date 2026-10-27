"""Create local SAV fixtures from original public synthetic RAWX networks.

Development only. These local files exercise binary normalization; neither
Siemens runtime files nor generated SAV data enter the browser package/Git.
"""
from pathlib import Path
import json
import os
import sys

repo = Path(__file__).resolve().parents[1]
root = Path(os.environ.get("PSSE_TEST_ROOT", r"C:\Program Files\PTI\PSSE36\36.5"))
sys.path.insert(0, str(root / f"PSSPY{sys.version_info.major}{sys.version_info.minor}"))
import psse36
import psspy

destination = repo / "private-re" / "synthetic-sav"
destination.mkdir(parents=True, exist_ok=True)
if psspy.psseinit(10000):
    raise RuntimeError("PSS/E initialization failed")
for name in ["report_output", "progress_output", "alert_output", "prompt_output"]:
    getattr(psspy, name)(6, "", [0, 0])
for source in sorted((repo / ".tmp" / "psse-synthetic").glob("*.rawx")):
    target = destination / (source.stem + ".sav")
    if target.exists():
        print(json.dumps({"fixture": source.stem, "cache": "HIT"}))
        continue
    code = psspy.readrawx(str(source), "network", "new")
    if code:
        raise RuntimeError(f"RAWX read failed {source.name}: {code}")
    code = psspy.save(str(target))
    if code:
        raise RuntimeError(f"SAV save failed {source.name}: {code}")
    print(json.dumps({"fixture": source.stem, "cache": "MISS", "bytes": target.stat().st_size}))
psspy.pssehalt_2()
