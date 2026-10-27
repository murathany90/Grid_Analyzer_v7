"""Original development export helpers; no vendor code or model data."""
from pathlib import Path
import re


def parse_dc_report(filename):
    text = Path(filename).read_text(encoding="cp1252", errors="replace")
    power_scale = 0.001 if any("BUS#-SCT" in line and re.search(r"\bKW\b", line, re.I) for line in text.splitlines()) else 1
    current = None
    rows = []
    skipped = []
    number = re.compile(r"^\s*(\d+)(?:-\s*(\d+))?\s*$")
    for line in text.splitlines():
        if "---" in line[63:] and number.fullmatch(line[:11]):
            match = number.fullmatch(line[:11])
            current = (int(match[1]), int(match[2] or 0))
        elif current and len(line) >= 104 and not line[:64].strip():
            three = re.match(r"\s*3WNDTR\s+(.+?)\s+WND\s+(\d+)\s+(\S+)\s+([-+.\d]+)", line[64:])
            if three:
                rows.append({"from": current[0], "fromSection": current[1], "to": None,
                             "transformerName": three[1].strip(), "winding": int(three[2]),
                             "circuit": three[3], "pMw": float(three[4]) * power_scale,
                             "provenance": "PSSE_REFERENCE_DCLF_REPORT"})
                continue
            match = number.fullmatch(line[64:76])
            if match:
                try:
                    rows.append({"from": current[0], "fromSection": current[1],
                                 "to": int(match[1]), "toSection": int(match[2] or 0),
                                 "circuit": line[99:103].strip(), "pMw": float(line[103:112]) * power_scale,
                                 "provenance": "PSSE_REFERENCE_DCLF_REPORT"})
                except ValueError:
                    skipped.append(line[64:112].strip())
            elif line[64:76].strip() and not line.lstrip().startswith(("X-", "BUS#")):
                skipped.append(line[64:112].strip())
    return {"format": "PSS/E 36.5 DCLF_2 fixed-width report", "flowResolutionMw": 0.1 * power_scale,
            "reportedPowerUnits": "kW" if power_scale < 1 else "MW",
            "flows": rows, "unparsedRows": skipped,
            "caution": "abrnreal P/Q after saved DC angles are AC evaluations and are excluded from DC parity."}


def annotate_reference(record, directory):
    record["units"] = {"buses.PU": "pu", "buses.ANGLE": "rad", "buses.ANGLED": "deg",
                       "generators.PGEN": "MW", "generators.QGEN": "Mvar",
                       "branches.P": "MW", "branches.Q": "Mvar", "branches.AMPS": "A"}
    record["exporterVersion"] = 5
    if "ANGLE" in record.get("buses", {}):
        import math
        record["buses"]["ANGLED"] = [x * 180 / math.pi for x in record["buses"]["ANGLE"]]
    if record["spec"]["method"] == "dclf_2":
        record["dcReport"] = parse_dc_report(Path(directory) / "report_output.log")
    return record
