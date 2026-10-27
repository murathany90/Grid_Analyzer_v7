"""Sanitized index: no bus/equipment identities or reference values exported."""
from pathlib import Path
import hashlib
import json
from psse_reference_io import annotate_reference

repo = Path(__file__).resolve().parents[1]
runs = []
for filename in sorted((repo / "private-re" / "solver-reference").glob("*/reference.json")):
    record = json.loads(filename.read_text(encoding="utf-8"))
    if record.get("exporterVersion") != 5:
        record = annotate_reference(record, filename.parent)
        filename.write_text(json.dumps(record, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    method = record["spec"]["method"]
    status = ("DC_API_COMPLETED_RESIDUAL_REQUIRES_COMPARISON" if record["ierr"] == 0 else "DC_REFERENCE_FAILED") if method == "dclf_2" else ("REFERENCE_CONVERGED" if record["ierr"] == 0 and record["solved"] == 0 else "REFERENCE_NOT_CONVERGED")
    runs.append({"source": record["source"], "optionsHash": record["optionsHash"], "spec": record["spec"],
                 "status": status, "ierr": record["ierr"], "solved": record["solved"],
                 "iterations": record["iterations"], "sysMismatchMva": record["sysMismatchMva"] if method != "dclf_2" else None,
                 "elapsedMs": record["elapsedMs"], "exportErrors": record["exportErrors"],
                 "busCount": len(record["buses"].get("NUMBER", [])),
                 "machineCount": len(record["generators"].get("NUMBER", [])),
                 "branchEndCount": len(record["branches"].get("FROMNUMBER", [])),
                 "threeWindingCount": len(record["threeWinding"].get("WIND1NUMBER", [])),
                 "dcReportFlowCount": len(record.get("dcReport", {}).get("flows", [])),
                 "dcUnparsedRows": len(record.get("dcReport", {}).get("unparsedRows", [])),
                 "referenceSha256": hashlib.sha256(filename.read_bytes()).hexdigest()})
output = repo / "evidence" / "psse-ac-dc" / "reference-runs.json"
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps({"schema": "ga.psse.reference-index.v1", "runs": runs}, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"runs": len(runs), "statuses": {s: sum(r["status"] == s for r in runs) for s in sorted(set(r["status"] for r in runs))}}))
