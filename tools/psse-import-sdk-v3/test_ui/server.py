"""Local-only SDK inspection UI. SAV is decoded by the installed native runtime.

No uploaded model is published. One fresh converter process handles each file.
"""
import argparse
import json
import os
from pathlib import Path
import secrets
import subprocess
import sys
import tempfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit

ROOT = Path(__file__).resolve().parents[1]
CONTROL = Path(r"C:\Program Files\PTI\PSSE36\36.5\control1")
SUFFIXES = {".sav", ".raw", ".rawx"}
TOKEN = secrets.token_urlsafe(32)
MAX_UPLOAD = 100 * 1024 * 1024


def inspect_file(path, output, native_python=None):
    """Keep extraction, validation and electrical acceptance visibly distinct."""
    exe = native_python or sys.executable
    cmd = [exe, str(ROOT / "psse_convert.py"), "--input", str(path),
           "--output-dir", str(output), "--format", "all"]
    env = dict(os.environ, PYTHONUTF8="0")  # caspyc uses the native Windows locale
    p = subprocess.run(cmd, cwd=ROOT, env=env, capture_output=True, timeout=180)
    manifest_path = Path(output) / path.stem / (path.stem + ".manifest.json")
    if not manifest_path.is_file():
        raise ValueError("Converter produced no manifest: " + p.stderr.decode(errors="replace")[-1000:])
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest["status"] == "FAILED": raise ValueError(manifest.get("error", "Parser failed"))
    artifacts = manifest["artifacts"]
    bridge = json.loads(Path(artifacts["gaJson"]).read_text(encoding="utf-8"))
    canonical = json.loads(Path(artifacts["canonicalJson"]).read_text(encoding="utf-8"))
    return {"manifest": manifest, "bridge": bridge, "canonical": canonical, "converterExitCode": p.returncode,
            "inspectionOnly": manifest["status"] != "SUCCESS"}


class Handler(BaseHTTPRequestHandler):
    def send(self, code, body, kind="application/json; charset=utf-8", cookie=False):
        data = body if isinstance(body, bytes) else json.dumps(body, ensure_ascii=False, allow_nan=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", kind)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        if cookie: self.send_header("Set-Cookie", f"psse_session={TOKEN}; HttpOnly; SameSite=Strict; Path=/")
        self.end_headers(); self.wfile.write(data)

    def authorized(self):
        return f"psse_session={TOKEN}" in self.headers.get("Cookie", "").split("; ")

    def do_GET(self):
        parsed = urlsplit(self.path)
        if parsed.path == "/health": return self.send(200, {"status": "UP", "nativePython": self.server.native_python})
        if parsed.path in ("/", "/index.html"):
            token = parse_qs(parsed.query).get("token", [""])[0]
            if not self.authorized() and not secrets.compare_digest(token, TOKEN): return self.send(403, {"error": "Open the URL printed by start_test_ui.cmd"})
            return self.send(200, (ROOT/"test_ui"/"index.html").read_bytes(), "text/html; charset=utf-8", True)
        if not self.authorized(): return self.send(403, {"error": "Session required"})
        if parsed.path in ("/app.js", "/style.css"):
            kind = "text/javascript; charset=utf-8" if parsed.path.endswith("js") else "text/css; charset=utf-8"
            return self.send(200, (ROOT/"test_ui"/parsed.path[1:]).read_bytes(), kind)
        if parsed.path == "/api/examples":
            return self.send(200, {"directory": str(CONTROL), "files": [p.name for p in sorted(CONTROL.glob("*")) if p.suffix.lower() in SUFFIXES]})
        self.send(404, {"error": "Not found"})

    def do_POST(self):
        # SameSite cookie plus explicit Origin check: no cross-site uploads.
        if not self.authorized(): return self.send(403, {"error": "Session required"})
        origin = self.headers.get("Origin")
        if origin and origin != f"http://127.0.0.1:{self.server.server_port}": return self.send(403, {"error": "Origin rejected"})
        parsed = urlsplit(self.path)
        if parsed.path not in ("/api/upload", "/api/example"): return self.send(404, {"error": "Not found"})
        name = parse_qs(parsed.query).get("name", [""])[0]
        if not name or Path(name).name != name or "/" in name or "\\" in name or Path(name).suffix.lower() not in SUFFIXES:
            return self.send(400, {"error": "SAV, RAW or RAWX filename required"})
        try:
            with tempfile.TemporaryDirectory(prefix="ga-psse-inspect-") as tmp:
                if parsed.path == "/api/example":
                    path = CONTROL/name
                    if not path.is_file(): return self.send(404, {"error": "control1 file not found"})
                else:
                    size = int(self.headers.get("Content-Length", "0"))
                    if not 0 < size <= MAX_UPLOAD: return self.send(413, {"error": "Maximum file size is 100 MiB"})
                    data = self.rfile.read(size)
                    if len(data) != size: return self.send(400, {"error": "Incomplete upload"})
                    path = Path(tmp)/name; path.write_bytes(data)
                value = inspect_file(path, Path(tmp)/"converted", self.server.native_python)
                # Manifest paths are temporary; all download content is returned.
                value["manifest"]["artifacts"] = {k: Path(v).name for k,v in value["manifest"]["artifacts"].items()}
                self.send(200, value)
        except (ValueError, OSError, subprocess.SubprocessError) as exc:
            self.send(422, {"error": str(exc)})

    def log_message(self, fmt, *args):
        # Never log model content or the bootstrap URL token.
        print("UI request:", self.command, urlsplit(self.path).path, flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--python-sav", default=sys.executable)
    parser.add_argument("--open", action="store_true", help="Open the local UI in the default browser")
    parser.add_argument("--write-session", help="Optional local QA session file (not packaged)")
    args = parser.parse_args()
    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    server.native_python = args.python_sav
    url = f"http://127.0.0.1:{server.server_port}/?token={TOKEN}"
    if args.write_session: Path(args.write_session).write_text(json.dumps({"url": url, "token": TOKEN, "port": server.server_port}))
    print("LOCAL PSS/E MODEL INSPECTION:", url, flush=True)
    print("SAV runtime:", args.python_sav, "| Close this console to stop.", flush=True)
    if args.open:
        import webbrowser
        webbrowser.open(url)
    try: server.serve_forever()
    except KeyboardInterrupt: pass
    finally: server.server_close()


if __name__ == "__main__": main()
