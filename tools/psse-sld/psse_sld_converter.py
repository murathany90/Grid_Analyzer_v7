#!/usr/bin/env python3
"""
Grid Analyzer — Native PSS(R)E 36.5 SLD Converter & Local Bridge
Supports:
  1. dump   <in.sld> <out.gasld.json>
  2. build  <in.gasld.json> <out.sld> [--base <base.sld>] [--clean]
  3. patch  <base.sld> <in.gasld.json> <out.sld>
  4. serve  [--port 18765]
"""
import argparse
import base64
import json
import os
import shutil
import struct
import subprocess
import sys
import tempfile
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

HERE = Path(__file__).resolve().parent
DRIVER_PS1 = HERE / "psse_gui_driver.ps1"
DUMP_PY = HERE / "psse_sld_dump.py"
BUILD_PY = HERE / "psse_sld_build.py"
DEFAULT_PSSE_EXE = Path(r"C:\Program Files\PTI\PSSE36\36.5\PSSBIN\psse36.exe")
CONTROL1_DIR = Path(r"C:\Program Files\PTI\PSSE36\36.5\control1")


def find_reference_slds():
    refs = {}
    if not CONTROL1_DIR.exists():
        return refs
    for p in CONTROL1_DIR.rglob("*.sld"):
        low = p.name.lower()
        if "ankara" in low:
            refs["ankara"] = p
        elif "kayseri" in low:
            refs["kayseri"] = p
        elif "konya" in low:
            refs["konya"] = p
        elif "oaytm" in low:
            refs["oaytm"] = p
        refs[p.name] = p
    return refs


def ensure_ascii_path(src: Path, work_dir: Path) -> Path:
    try:
        str(src).encode("ascii")
        return src
    except UnicodeEncodeError:
        safe_name = "".join(ch if ord(ch) < 128 else "_" for ch in src.name)
        dst = work_dir / safe_name
        shutil.copy2(src, dst)
        return dst


def run_psse_dump(sld_path: Path, out_json: Path, timeout: int = 60) -> dict:
    with tempfile.TemporaryDirectory(prefix="ga_sld_dump_") as tmp:
        tmp_dir = Path(tmp)
        safe_sld = ensure_ascii_path(sld_path.resolve(), tmp_dir)
        tmp_out = tmp_dir / "out.gasld.json"
        done_file = tmp_dir / "out.gasld.json.done"
        pre = f"GA_OUT=r'{tmp_out}';"
        cmd = [
            "powershell", "-ExecutionPolicy", "Bypass", "-File", str(DRIVER_PS1),
            "-Sld", str(safe_sld),
            "-Script", str(DUMP_PY),
            "-Pre", pre,
            "-Done", str(done_file),
            "-Timeout", str(timeout),
        ]
        subprocess.run(cmd, check=True)
        if not tmp_out.exists():
            err_file = tmp_dir / "out.gasld.json.err"
            err_txt = err_file.read_text(encoding="utf-8", errors="replace") if err_file.exists() else "Unknown error"
            raise RuntimeError(f"PSS(R)E sliderPy dump failed: {err_txt}")
        shutil.copy2(tmp_out, out_json)
        return json.loads(out_json.read_text(encoding="utf-8"))


def run_psse_build(in_json: Path, out_sld: Path, base_sld: Path = None, clean: bool = False, timeout: int = 60) -> dict:
    refs = find_reference_slds()
    if base_sld is None or not base_sld.exists():
        base_sld = refs.get("ankara") or next(iter(refs.values()), None)
        clean = True
    if base_sld is None or not base_sld.exists():
        raise FileNotFoundError("Base/template .sld file required for PSS(R)E 36.5 GUI build.")
    with tempfile.TemporaryDirectory(prefix="ga_sld_build_") as tmp:
        tmp_dir = Path(tmp)
        safe_base = ensure_ascii_path(base_sld.resolve(), tmp_dir)
        safe_in = tmp_dir / "in.gasld.json"
        shutil.copy2(in_json, safe_in)
        build_log = tmp_dir / "build_log.json"
        done_file = tmp_dir / "build_log.json.done"
        safe_out = tmp_dir / "out.sld"
        clean_flag = "True" if clean else "False"
        pre = f"GA_CLEAN={clean_flag};GA_IN=r'{safe_in}';GA_OUT=r'{build_log}';"
        cmd = [
            "powershell", "-ExecutionPolicy", "Bypass", "-File", str(DRIVER_PS1),
            "-Sld", str(safe_base),
            "-Script", str(BUILD_PY),
            "-Pre", pre,
            "-Done", str(done_file),
            "-SaveAs", str(safe_out),
            "-Timeout", str(timeout),
        ]
        subprocess.run(cmd, check=True)
        if not safe_out.exists():
            raise RuntimeError("PSS(R)E Save As did not produce output .sld file.")
        out_sld.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(safe_out, out_sld)
        return json.loads(build_log.read_text(encoding="utf-8")) if build_log.exists() else {"status": "ok"}


def patch_sld_binary(base_bytes: bytes, spec: dict) -> bytes:
    """
    In-place CArchive binary patcher for PSS(R)E .sld (2.0.49.3 / 2.0.51.1).
    Updates symbol (pos_x, pos_y, rot, layer, color) and label (pos_x, pos_y, rot, text)
    while preserving 100% CArchive structural integrity.
    """
    data = bytearray(base_bytes)
    is_v36 = b"2.0.51." in data[:32]
    sym_pad = 37 if is_v36 else 33
    lbl_pos_off = 85 if is_v36 else 81
    lbl_txt_off = 119 if is_v36 else 115

    comps = spec.get("components") or spec.get("comps") or []

    # 1) Patch Symbols in-place
    for c in comps:
        t = c.get("t")
        if t not in ("Symbol", "S"):
            continue
        cid = int(c["id"])
        pos = c.get("pos") or c.get("p")
        if not pos:
            continue
        rot = float(c.get("rot") if "rot" in c else (c.get("r") or 0.0))
        cid_b = struct.pack("<I", cid)
        idx = 0
        while True:
            idx = data.find(cid_b, idx)
            if idx == -1:
                break
            if idx + 150 <= len(data) and data[idx + 4 : idx + 8] == b"\x00\x00\x00\x00" and data[idx + 45] in (0x1C, 0x20, 0x00):
                mlen = data[idx + 45]
                ad_off = idx + 46 + mlen
                ad_cnt = struct.unpack_from("<H", data, ad_off)[0]
                if ad_cnt <= 10:
                    p = ad_off + 2
                    ok = True
                    for _ in range(ad_cnt):
                        if p >= len(data):
                            ok = False
                            break
                        p += 1 + data[p]
                    if ok and p + sym_pad + 24 <= len(data):
                        dx, dy, _ = struct.unpack_from("<ddd", data, p + sym_pad)
                        if -1e5 < dx < 1e5 and -1e5 < dy < 1e5:
                            struct.pack_into("<ddd", data, p + sym_pad, float(pos[0]), float(pos[1]), rot)
                            lyr = c.get("layer") if "layer" in c else c.get("l")
                            if lyr is not None:
                                struct.pack_into("<I", data, idx + 12, int(lyr))
                            col = c.get("color") if "color" in c else c.get("c")
                            if col is not None:
                                struct.pack_into("<I", data, idx + 29, int(col))
                            break
            idx += 1

    # 2) Patch Labels (collect splices from end to start so offsets don't shift earlier records)
    splices = []
    for c in comps:
        t = c.get("t")
        if t not in ("Label", "L"):
            continue
        cid = int(c["id"])
        pos = c.get("pos") or c.get("p")
        txt = c.get("text") if "text" in c else c.get("tx")
        rot = float(c.get("rot") if "rot" in c else (c.get("r") or 0.0))
        cid_b = struct.pack("<I", cid)
        idx = 0
        while True:
            idx = data.find(cid_b, idx)
            if idx == -1:
                break
            if idx + lbl_txt_off + 4 <= len(data) and data[idx + 4 : idx + 8] == b"\x00\x00\x00\x00":
                lyr_val = struct.unpack_from("<I", data, idx + 12)[0]
                if 0 < lyr_val < 64 and data[idx + 16] == 0:
                    if pos:
                        struct.pack_into("<ddd", data, idx + lbl_pos_off, float(pos[0]), float(pos[1]), rot)
                    if txt is not None:
                        old_len = data[idx + lbl_txt_off]
                        if old_len < 250:
                            tb = str(txt).encode("cp1254", errors="replace")[:250]
                            splices.append((idx + lbl_txt_off, old_len, tb))
                    break
            idx += 1

    for off, old_len, tb in sorted(splices, key=lambda x: x[0], reverse=True):
        data[off : off + 1 + old_len] = bytes([len(tb)]) + tb

    return bytes(data)


class BridgeHandler(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/status":
            refs = find_reference_slds()
            payload = {
                "ok": True,
                "psseInstalled": DEFAULT_PSSE_EXE.exists(),
                "psseExe": str(DEFAULT_PSSE_EXE),
                "referenceSlds": [k for k in ("ankara", "kayseri", "konya", "oaytm") if k in refs],
            }
            body = json.dumps(payload).encode("utf-8")
            self.send_response(200)
            self._cors()
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(body)
            return
        if parsed.path == "/reference-sld":
            qs = parse_qs(parsed.query)
            name = (qs.get("name") or ["ankara"])[0].lower()
            refs = find_reference_slds()
            target = refs.get(name)
            if not target or not target.exists():
                self.send_response(404)
                self._cors()
                self.end_headers()
                return
            raw = target.read_bytes()
            self.send_response(200)
            self._cors()
            self.send_header("Content-Type", "application/octet-stream")
            self.end_headers()
            self.wfile.write(raw)
            return
        self.send_response(404)
        self._cors()
        self.end_headers()

    def do_POST(self):
        parsed = urlparse(self.path)
        length = int(self.headers.get("Content-Length") or 0)
        raw_body = self.rfile.read(length) if length > 0 else b"{}"
        try:
            req = json.loads(raw_body.decode("utf-8"))
            if parsed.path == "/build-sld":
                with tempfile.TemporaryDirectory(prefix="ga_http_build_") as tmp:
                    tmp_dir = Path(tmp)
                    in_json = tmp_dir / "input.gasld.json"
                    out_sld = tmp_dir / "output.sld"
                    in_json.write_text(json.dumps(req.get("diagram") or req), encoding="utf-8")
                    base_sld = None
                    if req.get("baseSldB64"):
                        base_sld = tmp_dir / "base.sld"
                        base_sld.write_bytes(base64.b64decode(req["baseSldB64"]))
                    log = run_psse_build(in_json, out_sld, base_sld=base_sld, clean=bool(req.get("clean", False)))
                    sld_b64 = base64.b64encode(out_sld.read_bytes()).decode("ascii")
                    resp = json.dumps({"ok": True, "log": log, "sldB64": sld_b64}).encode("utf-8")
                    self.send_response(200)
                    self._cors()
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(resp)
                    return
            if parsed.path == "/dump-sld":
                with tempfile.TemporaryDirectory(prefix="ga_http_dump_") as tmp:
                    tmp_dir = Path(tmp)
                    in_sld = tmp_dir / "input.sld"
                    out_json = tmp_dir / "output.gasld.json"
                    in_sld.write_bytes(base64.b64decode(req["sldB64"]))
                    diagram = run_psse_dump(in_sld, out_json)
                    resp = json.dumps({"ok": True, "diagram": diagram}).encode("utf-8")
                    self.send_response(200)
                    self._cors()
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(resp)
                    return
        except Exception as exc:
            err = json.dumps({"ok": False, "error": str(exc)}).encode("utf-8")
            self.send_response(500)
            self._cors()
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(err)


def main():
    ap = argparse.ArgumentParser(description="Grid Analyzer Native PSS(R)E 36.5 SLD Converter")
    sub = ap.add_subparsers(dest="cmd", required=True)

    p_dump = sub.add_parser("dump", help="Dump native .sld to .gasld.json using PSS(R)E 36.5 sliderPy")
    p_dump.add_argument("input_sld", type=Path)
    p_dump.add_argument("output_json", type=Path)

    p_build = sub.add_parser("build", help="Build native .sld from .gasld.json using PSS(R)E 36.5 sliderPy")
    p_build.add_argument("input_json", type=Path)
    p_build.add_argument("output_sld", type=Path)
    p_build.add_argument("--base", type=Path, default=None)
    p_build.add_argument("--clean", action="store_true")

    p_patch = sub.add_parser("patch", help="Fast binary CArchive patch of existing .sld from .gasld.json")
    p_patch.add_argument("base_sld", type=Path)
    p_patch.add_argument("input_json", type=Path)
    p_patch.add_argument("output_sld", type=Path)

    p_serve = sub.add_parser("serve", help="Run local HTTP bridge server for HTML SLD Studio")
    p_serve.add_argument("--port", type=int, default=18765)

    args = ap.parse_args()
    if args.cmd == "dump":
        res = run_psse_dump(args.input_sld, args.output_json)
        print(f"Dumped {len(res.get('components', []))} components to {args.output_json}")
    elif args.cmd == "build":
        log = run_psse_build(args.input_json, args.output_sld, base_sld=args.base, clean=args.clean)
        print(f"Built {args.output_sld}: {json.dumps(log)}")
    elif args.cmd == "patch":
        spec = json.loads(args.input_json.read_text(encoding="utf-8"))
        out_bytes = patch_sld_binary(args.base_sld.read_bytes(), spec)
        args.output_sld.write_bytes(out_bytes)
        print(f"Patched binary {args.output_sld} ({len(out_bytes)} bytes)")
    elif args.cmd == "serve":
        srv = HTTPServer(("127.0.0.1", args.port), BridgeHandler)
        print(f"GA PSS(R)E 36.5 Native SLD Bridge listening on http://127.0.0.1:{args.port}")
        srv.serve_forever()


if __name__ == "__main__":
    main()
