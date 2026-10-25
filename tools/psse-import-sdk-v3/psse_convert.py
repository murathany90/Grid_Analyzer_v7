#!/usr/bin/env python3
"""PSS(R)E SAV/RAW/RAWX -> Grid Analyzer Import SDK Converter CLI.

Usage:
  py -3.14 psse_convert.py --input <path_to_sav_or_raw> --output-dir <out_dir> [options]

Options:
  --input, -i       Input file path or glob pattern (.sav, .raw, .rawx)
  --output-dir, -o  Directory where converted files and reports are saved
  --format, -f      Output format: all, raw, rawx, ga-json, canonical (default: all)
  --engine, -e      Extraction engine: auto, caspy, official, standalone (default: auto)
  --validate        Perform key-by-key electrical validation against official exports
"""
import argparse
import glob
import json
import os
import sys
import time
import traceback
from typing import Any, Dict, List, Optional

from ga_psse_sdk.caspy_adapter import CaspyAdapter, sha256_file
from ga_psse_sdk.canonical_mapper import map_bridge_to_canonical
from ga_psse_sdk.standalone_sav_decoder import StandaloneSavDecoder
from ga_psse_sdk.validator import ModelValidator
from ga_psse_sdk.serialization import json_safe
from ga_psse_sdk.raw_parser import RawParser
from ga_psse_sdk.rawx_parser import RawxParser


def find_reference_file(base_name: str, input_file: str, output_dir: str) -> Optional[str]:
    """Finds an independent official reference (.rawx, .raw, or .sav) for validation.
    Enforces independent source and SHA-256 requirements; never selects the input file itself."""
    input_file = os.path.abspath(input_file)
    input_sha = sha256_file(input_file) if os.path.isfile(input_file) else None
    input_ext = os.path.splitext(input_file)[1].lower()

    candidates: List[str] = [
        os.path.join(output_dir, "official", f"{base_name}.rawx"),
        os.path.join(output_dir, "official", f"{base_name}.raw"),
        os.path.join(os.path.dirname(__file__), "evidence", "official_rawx", f"{base_name}.rawx"),
    ]

    # When input is .rawx, look for corresponding .raw or official exports (different format / independent provenance)
    if input_ext == ".rawx":
        candidates.extend([
            os.path.join(os.path.dirname(input_file), f"{base_name}.raw"),
            os.path.join(r"C:\Program Files\PTI\PSSE36\36.5\EXAMPLE", f"{base_name}.raw"),
        ])
    elif input_ext == ".raw":
        candidates.extend([
            os.path.join(os.path.dirname(input_file), f"{base_name}.rawx"),
            os.path.join(r"C:\Program Files\PTI\PSSE36\36.5\EXAMPLE", f"{base_name}.rawx"),
        ])
    elif input_ext == ".sav":
        candidates.extend([
            os.path.join(os.path.dirname(input_file), f"{base_name}.rawx"),
            os.path.join(r"C:\Program Files\PTI\PSSE36\36.5\EXAMPLE", f"{base_name}.rawx"),
            os.path.join(os.path.dirname(input_file), f"{base_name}.raw"),
            os.path.join(r"C:\Program Files\PTI\PSSE36\36.5\EXAMPLE", f"{base_name}.raw"),
        ])

    for c in candidates:
        if not os.path.isfile(c):
            continue
        c_abs = os.path.abspath(c)
        try:
            if os.path.samefile(input_file, c_abs):
                continue
        except OSError:
            pass
        if input_sha and sha256_file(c_abs) == input_sha:
            continue
        return c_abs
    return None


def convert_file(
    input_file: str,
    output_dir: str,
    target_format: str = "all",
    engine: str = "auto",
    validate: bool = False,
) -> dict:
    input_file = os.path.abspath(input_file)
    base_name = os.path.splitext(os.path.basename(input_file))[0]
    ext = os.path.splitext(input_file)[1].lower()

    case_out_dir = os.path.join(output_dir, base_name)
    os.makedirs(case_out_dir, exist_ok=True)

    start_time = time.time()
    manifest = {
        "inputFile": os.path.basename(input_file),
        "inputPath": input_file,
        "inputBytes": os.path.getsize(input_file),
        "inputSha256": sha256_file(input_file),
        "targetFormat": target_format,
        "requestedEngine": engine,
        "actualEngine": None,
        "artifacts": {},
        "status": "IN_PROGRESS",
    }

    try:
        # Engine Selection
        if engine == "auto":
            if ext == ".raw":
                selected_engine = "raw"
            elif ext == ".rawx":
                selected_engine = "rawx"
            elif ext == ".sav":
                selected_engine = "caspy"
            else:
                selected_engine = "caspy"
        else:
            selected_engine = engine

        manifest["actualEngine"] = selected_engine

        # Extraction
        if selected_engine == "raw":
            raw_parser = RawParser(input_file)
            bridge_dict = raw_parser.to_bridge_dict()
            with open(input_file, "r", encoding="utf-8", errors="replace") as f:
                raw_str = f.read() if target_format in ("all", "raw") else None
            rawx_dict = None

        elif selected_engine == "rawx":
            rawx_parser = RawxParser(input_file)
            bridge_dict = rawx_parser.to_bridge_dict()
            with open(input_file, "r", encoding="utf-8") as f:
                rawx_dict = json.load(f) if target_format in ("all", "rawx") else None
            raw_str = None

        elif selected_engine == "caspy":
            adapter = CaspyAdapter(input_file)
            bridge_dict = adapter.to_bridge_dict()
            rawx_dict = None
            raw_str = None
            if target_format in ("all", "raw", "rawx"):
                manifest.setdefault("warnings", []).append("Direct SAV RAW/RAWX writer is unverified and disabled; use licensed --engine official")

        elif selected_engine == "standalone":
            decoder = StandaloneSavDecoder(input_file)
            bridge_dict = decoder.to_bridge_dict()
            rawx_dict = None
            raw_str = None

        elif selected_engine == "official":
            from ga_psse_sdk import official_export
            res = official_export.export_case(input_file, case_out_dir)
            if not res.get("ok"):
                raise RuntimeError(f"Official psspy export failed: {res.get('error')}")
            off_rawx = os.path.join(case_out_dir, f"{base_name}.rawx")
            if os.path.isfile(off_rawx):
                bridge_dict = RawxParser(off_rawx).to_bridge_dict()
            else:
                adapter = CaspyAdapter(input_file)
                bridge_dict = adapter.to_bridge_dict()
            rawx_dict = None
            raw_str = None

        else:
            raise ValueError(f"Unknown engine: {selected_engine}")

        # Map to CanonicalNetwork
        canonical_net = map_bridge_to_canonical(bridge_dict)

        manifest["capabilities"] = canonical_net["capabilities"]
        manifest["importAccepted"] = False
        # Check if standalone diagnostic mode
        is_diagnostic_only = bool(
            selected_engine == "standalone"
            or bridge_dict.get("metadata", {}).get("sourceFidelity") in ("EXPERIMENTAL", "DIAGNOSTIC_ONLY")
            or len(canonical_net.get("buses", [])) == 0
        )

        # Write Artifacts
        if target_format in ("all", "ga-json"):
            ga_json_path = os.path.join(case_out_dir, f"{base_name}.ga-psse.json")
            with open(ga_json_path, "w", encoding="utf-8") as f:
                json.dump(json_safe(bridge_dict), f, indent=2, allow_nan=False)
            manifest["artifacts"]["gaJson"] = ga_json_path

        if target_format in ("all", "canonical"):
            canon_path = os.path.join(case_out_dir, f"{base_name}.canonical.json")
            with open(canon_path, "w", encoding="utf-8") as f:
                json.dump(json_safe(canonical_net), f, indent=2, allow_nan=False)
            manifest["artifacts"]["canonicalJson"] = canon_path

        if target_format in ("all", "rawx") and rawx_dict:
            rawx_path = os.path.join(case_out_dir, f"{base_name}.rawx")
            with open(rawx_path, "w", encoding="utf-8") as f:
                json.dump(json_safe(rawx_dict), f, indent=2, allow_nan=False)
            manifest["artifacts"]["rawx"] = rawx_path

        if target_format in ("all", "raw") and raw_str:
            raw_path = os.path.join(case_out_dir, f"{base_name}.raw")
            with open(raw_path, "w", encoding="utf-8") as f:
                f.write(raw_str)
            manifest["artifacts"]["raw"] = raw_path

        # Validation (if requested)
        validation_passed = True
        validation_ran = False
        if validate:
            ref_path = find_reference_file(base_name, input_file, output_dir)
            if ref_path:
                validation_ran = True
                if ref_path.endswith(".rawx"):
                    ref_bridge = RawxParser(ref_path).to_bridge_dict()
                else:
                    ref_bridge = RawParser(ref_path).to_bridge_dict()

                validator = ModelValidator()
                val_res = validator.compare_networks(base_name, ref_bridge, bridge_dict)
                manifest["validation"] = val_res
                manifest["referenceFile"] = ref_path
                manifest["referenceSha256"] = sha256_file(ref_path)

                # Write electronic evidence package
                val_dir = os.path.join(output_dir, "validation")
                validator.generate_report([val_res], val_dir)
                manifest["artifacts"]["validationResults"] = os.path.join(val_dir, "validation_results.json")

                if not val_res["all_passed"]:
                    validation_passed = False
                    manifest["validationFailureReasons"] = val_res.get("failure_reasons", [])
            else:
                validation_passed = False
                warnings_list = manifest.setdefault("warnings", [])
                no_ref_msg = f"Independent reference (.rawx/.raw) not found for validation of {base_name}; self-validation rejected."
                warnings_list.append(no_ref_msg)
                manifest["validationStatus"] = "VALIDATION_NOT_RUN"
                manifest["validationFailureReasons"] = [no_ref_msg]

        manifest["elapsedSeconds"] = round(time.time() - start_time, 3)
        manifest["recordCount"] = canonical_net["records"]
        manifest["busCount"] = len(canonical_net["buses"])

        if is_diagnostic_only:
            manifest["status"] = "DIAGNOSTIC_ONLY"
            print(f"DIAGNOSTIC: {base_name} (diagnostic metadata only, electric model BLOCKED) -> {case_out_dir}")
        elif validate and not validation_ran:
            manifest["status"] = "VALIDATION_NOT_RUN"
            print(f"VALIDATION_NOT_RUN: {base_name} (no independent reference) -> {case_out_dir}", file=sys.stderr)
        elif not validation_passed:
            manifest["status"] = "VALIDATION_FAILED"
            print(f"VALIDATION_FAILED: {base_name} -> {manifest.get('validationFailureReasons')}", file=sys.stderr)
        elif canonical_net["capabilities"]["powerFlow"]["state"] != "READY":
            manifest["status"] = canonical_net["capabilities"]["powerFlow"]["state"]
            manifest["inspectionStatus"] = "EXTRACTED_FOR_REVIEW"
            print(f"{manifest['status']}: {base_name} (electrical gate; inspection artifacts only) -> {case_out_dir}")
        else:
            manifest["importAccepted"] = True
            manifest["status"] = "SUCCESS"
            print(f"SUCCESS: {base_name} ({canonical_net['records']} records, {manifest['elapsedSeconds']} s) -> {case_out_dir}")

        manifest_path = os.path.join(case_out_dir, f"{base_name}.manifest.json")
        manifest["artifacts"]["manifest"] = manifest_path
        with open(manifest_path, "w", encoding="utf-8") as f:
            json.dump(json_safe(manifest), f, indent=2, allow_nan=False)

        return manifest

    except Exception as e:
        manifest["status"] = "FAILED"
        manifest["error"] = str(e)
        manifest["traceback"] = traceback.format_exc()
        manifest["elapsedSeconds"] = round(time.time() - start_time, 3)
        manifest_path = os.path.join(case_out_dir, f"{base_name}.manifest.json")
        with open(manifest_path, "w", encoding="utf-8") as f:
            json.dump(json_safe(manifest), f, indent=2, allow_nan=False)
        print(f"FAILED:  {base_name}: {e}", file=sys.stderr)
        return manifest


def main(argv=None):
    parser = argparse.ArgumentParser(description="PSS(R)E Import SDK Converter")
    parser.add_argument("--input", "-i", required=True, nargs="+", help="Input file path(s) or wildcards")
    parser.add_argument("--output-dir", "-o", required=True, help="Output directory")
    parser.add_argument(
        "--format", "-f",
        default="all",
        choices=["all", "raw", "rawx", "ga-json", "canonical"],
        help="Target output format",
    )
    parser.add_argument(
        "--engine", "-e",
        default="auto",
        choices=["auto", "caspy", "official", "standalone", "raw", "rawx"],
        help="Extraction engine",
    )
    parser.add_argument("--validate", action="store_true", help="Perform electrical validation")
    parser.add_argument("--strict", action="store_true", help="Fail with exit code 2 if validation fails or reference is missing")

    args = parser.parse_args(argv)

    files = []
    for pattern in args.input:
        matched = glob.glob(pattern)
        if matched:
            files.extend(matched)
        elif os.path.isfile(pattern):
            files.append(pattern)

    if not files:
        print(f"No matching files found for pattern: {args.input}", file=sys.stderr)
        return 1

    os.makedirs(args.output_dir, exist_ok=True)
    results = []
    for f in sorted(files):
        res = convert_file(f, args.output_dir, args.format, args.engine, args.validate)
        results.append(res)

    batch_manifest = os.path.join(args.output_dir, "batch_manifest.json")
    with open(batch_manifest, "w", encoding="utf-8") as f:
        json.dump(json_safe(results), f, indent=2, allow_nan=False)

    has_failures = any(
        r.get("status") != "SUCCESS"
        or (args.strict and r.get("status") == "VALIDATION_NOT_RUN")
        for r in results
    )
    succeeded_count = sum(1 for r in results if r.get("status") == "SUCCESS")
    diagnostic_count = sum(1 for r in results if r.get("status") == "DIAGNOSTIC_ONLY")
    not_run_count = sum(1 for r in results if r.get("status") == "VALIDATION_NOT_RUN")
    failed_count = sum(1 for r in results if r.get("status") in ("FAILED", "VALIDATION_FAILED"))

    gated_count = sum(1 for r in results if r.get("status") in ("PARTIAL", "BLOCKED"))
    print(
        f"\nBatch Completed: {succeeded_count} succeeded, {diagnostic_count} diagnostic, "
        f"{not_run_count} validation not run, {gated_count} electrically gated, {failed_count} failed ({len(results)} total)."
    )
    return 2 if has_failures else 0


if __name__ == "__main__":
    sys.exit(main())
