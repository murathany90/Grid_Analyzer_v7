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
import re
import secrets
import shutil
import struct
import subprocess
import tempfile
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import urlparse

HERE = Path(__file__).resolve().parent
DRIVER_PS1 = HERE / "psse_gui_driver.ps1"
DUMP_PY = HERE / "psse_sld_dump.py"
BUILD_PY = HERE / "psse_sld_build.py"
DEFAULT_PSSE_EXE = Path(r"C:\Program Files\PTI\PSSE36\36.5\PSSBIN\psse36.exe")
CONTROL1_DIR = Path(r"C:\Program Files\PTI\PSSE36\36.5\control1")
BRIDGE_TOKEN = secrets.token_urlsafe(32)
ALLOWED_ORIGINS = {"null", "http://127.0.0.1:18765", "http://localhost:18765"}
MAX_PAYLOAD = 50 * 1024 * 1024  # 50 MB payload limit for security


def validate_sld_bytes(raw: bytes) -> tuple[bool, str]:
    if not raw or len(raw) < 512:
        return False, "Dosya boyutu geçerli bir PSS(R)E .sld CArchive binary dosyası için çok küçük (< 512 bayt)."
    vlen = raw[0]
    if vlen < 6 or vlen > 12 or raw[1 + vlen] != 0:
        return False, "Geçersiz PSS(R)E .sld başlığı (CArchive versiyon imzası bulunamadı)."
    ver = raw[1 : 1 + vlen].decode("ascii", errors="replace")
    if not re.match(r"^2\.0\.(48|49|50|51)\.\d+$", ver):
        return False, f"Desteklenmeyen veya sahte .sld versiyon başlığı: '{ver}'."
    has_class = any(
        marker in raw
        for marker in (b"CSldBusbar", b"CSldBranch", b"CSldPointNode", b"CSldLayer")
    )
    if not has_class:
        return False, "Dosya içinde PSS(R)E CArchive SLD sınıf tanımları (CSldBusbar/CSldBranch/CSldLayer) bulunamadı."
    return True, ver


def find_blank_seed_sld() -> Path | None:
    if not CONTROL1_DIR.exists():
        return None
    candidates = sorted(CONTROL1_DIR.rglob("*.sld"), key=lambda p: p.stat().st_size if p.exists() else 10**9)
    for p in candidates:
        try:
            ok, _ = validate_sld_bytes(p.read_bytes())
            if ok:
                return p
        except Exception:
            continue
    return None


def ensure_ascii_path(src: Path, work_dir: Path) -> Path:
    safe_name = "".join(ch if ord(ch) < 128 else "_" for ch in src.name).lstrip("_")
    dst = work_dir / (safe_name or "seed_base.sld")
    shutil.copy2(src, dst)
    return dst


def run_psse_dump(sld_path: Path, out_json: Path, timeout: int = 60) -> dict:
    raw = sld_path.read_bytes()
    ok, msg = validate_sld_bytes(raw)
    if not ok:
        raise ValueError(msg)
    with tempfile.TemporaryDirectory(prefix="ga_sld_dump_", ignore_cleanup_errors=True) as tmp:
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


def run_psse_build(in_json: Path, out_sld: Path, base_sld: Path = None, clean: bool = False, timeout: int = 75) -> dict:
    if base_sld is not None and base_sld.exists():
        ok, msg = validate_sld_bytes(base_sld.read_bytes())
        if not ok:
            raise ValueError(f"Geçersiz baz .sld dosyası: {msg}")
    else:
        base_sld = find_blank_seed_sld()
        clean = True
    if base_sld is None or not base_sld.exists():
        raise FileNotFoundError("PSS(R)E 36.5 GUI oturumu başlatmak için geçerli bir CArchive .sld çekirdek dosyası bulunamadı.")
    with tempfile.TemporaryDirectory(prefix="ga_sld_build_", ignore_cleanup_errors=True) as tmp:
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
        out_bytes = safe_out.read_bytes()
        ok, msg = validate_sld_bytes(out_bytes)
        if not ok:
            raise RuntimeError(f"Üretilen .sld doğrulamadan geçemedi: {msg}")
        out_sld.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(safe_out, out_sld)
        return json.loads(build_log.read_text(encoding="utf-8")) if build_log.exists() else {"status": "ok"}


def patch_sld_binary(base_bytes: bytes, spec: dict) -> bytes:
    """
    In-place CArchive binary patcher for PSS(R)E .sld (2.0.48 - 2.0.51).
    Updates symbol (pos_x, pos_y, rot, layer, color), link knee-points,
    and label (pos_x, pos_y, rot, text) while preserving 100% CArchive integrity.
    """
    ok, msg = validate_sld_bytes(base_bytes)
    if not ok:
        raise ValueError(msg)

    data = bytearray(base_bytes)
    is_v36 = b"2.0.51." in data[:32] or b"2.0.50." in data[:32]
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
            if idx + 150 <= len(data) and data[idx + 16] == 0 and data[idx + 45] in (0x1C, 0x20, 0x00):
                mlen = data[idx + 45]
                ad_off = idx + 46 + mlen
                ad_cnt = struct.unpack_from("<H", data, ad_off)[0]
                if ad_cnt <= 10:
                    p = ad_off + 2
                    ok_ad = True
                    for _ in range(ad_cnt):
                        if p >= len(data):
                            ok_ad = False
                            break
                        p += 1 + data[p]
                    if ok_ad and p + sym_pad + 24 <= len(data):
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

    # 2) Patch Link KneePoints in-place when count matches
    for c in comps:
        t = c.get("t")
        if t not in ("Link", "K"):
            continue
        cid = int(c["id"])
        knees = c.get("knees")
        if not knees:
            continue
        cid_b = struct.pack("<I", cid)
        idx = 0
        while True:
            idx = data.find(cid_b, idx)
            if idx == -1:
                break
            if (
                idx + 60 <= len(data)
                and data[idx + 16] == 0
                and data[idx + 20 : idx + 25] == b"\x01\x01\x01\x00\x00"
                and data[idx + 45 : idx + 54] == b"\xe0Q\xb8\xbe?\x00\x00\x00\x00"
            ):
                kcnt = struct.unpack_from("<H", data, idx + 54)[0]
                if kcnt == len(knees) and kcnt > 0:
                    kp = idx + 56
                    for k_idx in range(kcnt):
                        if k_idx == 0 and data[kp : kp + 2] == b"\xff\xff":
                            clen = struct.unpack_from("<H", data, kp + 4)[0]
                            kp += 6 + clen
                        elif data[kp] == 0x80:
                            kp += 2
                        if kp + 21 <= len(data):
                            struct.pack_into("<dd", data, kp + 5, float(knees[k_idx][0]), float(knees[k_idx][1]))
                            kp += 21
                break
            idx += 1

    # 3) Patch Labels (collect splices from end to start so offsets don't shift earlier records)
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
            if idx + lbl_txt_off + 4 <= len(data) and data[idx + 16] == 0:
                lyr_val = struct.unpack_from("<I", data, idx + 12)[0]
                if 0 < lyr_val < 64 and data[idx + 20 : idx + 25] == b"\x01\x01\x01\x00\x00":
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
    def _check_origin_and_token(self, require_token: bool = False) -> tuple[bool, str]:
        origin = self.headers.get("Origin")
        if origin is not None and origin not in ALLOWED_ORIGINS:
            return False, f"Yetkisiz Origin: {origin}"
        if require_token:
            tok = self.headers.get("X-GA-Bridge-Token")
            if not tok or not secrets.compare_digest(tok, BRIDGE_TOKEN):
                return False, "Eksik veya geçersiz X-GA-Bridge-Token başlığı."
        return True, "ok"

    def _cors(self):
        origin = self.headers.get("Origin") or "*"
        self.send_header("Access-Control-Allow-Origin", origin)
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-GA-Bridge-Token")

    def do_OPTIONS(self):
        ok, _ = self._check_origin_and_token()
        self.send_response(204 if ok else 403)
        self._cors()
        self.end_headers()

    def do_GET(self):
        ok, msg = self._check_origin_and_token(require_token=False)
        if not ok:
            self.send_response(403)
            self._cors()
            self.end_headers()
            self.wfile.write(json.dumps({"ok": False, "error": msg}).encode("utf-8"))
            return
        parsed = urlparse(self.path)
        if parsed.path == "/status":
            payload = {
                "ok": True,
                "psseInstalled": DEFAULT_PSSE_EXE.exists(),
                "psseExe": str(DEFAULT_PSSE_EXE),
                "bridgeVersion": "3.0.0",
                "sessionToken": BRIDGE_TOKEN,
            }
            body = json.dumps(payload).encode("utf-8")
            self.send_response(200)
            self._cors()
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(body)
            return
        self.send_response(404)
        self._cors()
        self.end_headers()

    def do_POST(self):
        ok, msg = self._check_origin_and_token(require_token=True)
        if not ok:
            self.send_response(403)
            self._cors()
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": False, "error": msg}).encode("utf-8"))
            return
        parsed = urlparse(self.path)
        length = int(self.headers.get("Content-Length") or 0)
        if length > MAX_PAYLOAD:
            self.send_response(413)
            self._cors()
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": False, "error": f"Payload too large: {length} bytes exceeds {MAX_PAYLOAD} bytes limit"}).encode("utf-8"))
            return
        raw_body = self.rfile.read(length) if length > 0 else b"{}"
        try:
            req = json.loads(raw_body.decode("utf-8"))
            if parsed.path == "/build-sld":
                with tempfile.TemporaryDirectory(prefix="ga_http_build_", ignore_cleanup_errors=True) as tmp:
                    tmp_dir = Path(tmp)
                    in_json = tmp_dir / "input.gasld.json"
                    out_sld = tmp_dir / "output.sld"
                    in_json.write_text(json.dumps(req.get("diagram") or req), encoding="utf-8")
                    base_sld = None
                    if req.get("baseSldB64"):
                        base_bytes = base64.b64decode(req["baseSldB64"])
                        valid, vmsg = validate_sld_bytes(base_bytes)
                        if not valid:
                            raise ValueError(vmsg)
                        base_sld = tmp_dir / "base.sld"
                        base_sld.write_bytes(base_bytes)
                    log = run_psse_build(in_json, out_sld, base_sld=base_sld, clean=bool(req.get("clean", False)))
                    sld_b64 = base64.b64encode(out_sld.read_bytes()).decode("ascii")
                    resp = json.dumps({"ok": True, "log": log, "sldB64": sld_b64}).encode("utf-8")
                    self.send_response(200)
                    self._cors()
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(resp)
                    return
            if parsed.path == "/patch-sld":
                base_bytes = base64.b64decode(req["baseSldB64"])
                patched = patch_sld_binary(base_bytes, req.get("diagram") or req)
                sld_b64 = base64.b64encode(patched).decode("ascii")
                resp = json.dumps({"ok": True, "sldB64": sld_b64}).encode("utf-8")
                self.send_response(200)
                self._cors()
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(resp)
                return
            if parsed.path == "/dump-sld":
                raw_sld = base64.b64decode(req["sldB64"])
                valid, vmsg = validate_sld_bytes(raw_sld)
                if not valid:
                    raise ValueError(vmsg)
                with tempfile.TemporaryDirectory(prefix="ga_http_dump_", ignore_cleanup_errors=True) as tmp:
                    tmp_dir = Path(tmp)
                    in_sld = tmp_dir / "input.sld"
                    out_json = tmp_dir / "output.gasld.json"
                    in_sld.write_bytes(raw_sld)
                    diagram = run_psse_dump(in_sld, out_json)
                    resp = json.dumps({"ok": True, "diagram": diagram}).encode("utf-8")
                    self.send_response(200)
                    self._cors()
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(resp)
                    return
        except ValueError as exc:
            err = json.dumps({"ok": False, "error": str(exc)}).encode("utf-8")
            self.send_response(400)
            self._cors()
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(err)
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
