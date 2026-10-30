#!/usr/bin/env python3
"""
Builds:
1. src/features/psse/sld-studio.ts (clean repository source module for SLD Studio)
2. C:/Users/Murathan Yeniceli/Downloads/Grid_Analyzer_PSSE_SLD_Studio_FINAL.html
   (standalone portable HTML with updated localhost bridge CSP and zero hardcoded SLD templates)
"""
import json
import os
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
WORK_REPO = HERE.parents[1]
DOWNLOADS = Path.home() / 'Downloads'
ENHANCED_HTML = Path(os.environ.get('GA_SLD_HTML_BASE', str(DOWNLOADS / 'Grid_Analyzer_PSSE_SLD_Studio_Enhanced.html')))
FINAL_HTML = Path(os.environ.get('GA_SLD_HTML_OUT', str(DOWNLOADS / 'Grid_Analyzer_PSSE_SLD_Studio_FINAL.html')))


def main():
    studio_css = (HERE / "studio_style.css").read_text(encoding="utf-8")
    full_js = (HERE / "studio_runtime.js").read_text(encoding="utf-8")
    # The browser and TS tests execute exactly the same codec implementation.
    codec = subprocess.check_output([
        'node', '--input-type=module', '-e',
        "import {stripTypeScriptTypes} from 'node:module'; import fs from 'node:fs'; "
        "const s=fs.readFileSync('src/features/psse/sld-binary-codec.ts','utf8'); "
        "process.stdout.write(stripTypeScriptTypes(s).replace(/^export /gm,''));"
    ], cwd=WORK_REPO).decode('utf-8').replace('\r\n', '\n')
    codec = '\n'.join(line.rstrip() for line in codec.splitlines()) + '\n'
    start = full_js.index('function findAscii(') if '/* GENERATED CODEC START */' not in full_js else full_js.index('/* GENERATED CODEC START */')
    end = full_js.index('/* Part 2:')
    layout_path = HERE / 'studio_layout.js'
    layout = layout_path.read_text(encoding='utf-8') if layout_path.exists() else ''
    full_js = full_js[:start] + '/* GENERATED CODEC START */\n' + codec + '\n' + layout + '\n' + full_js[end:]
    (HERE / 'studio_runtime.js').write_text(full_js, encoding='utf-8', newline='\n')

    # 1) Write clean TypeScript module to repository
    ts_path = WORK_REPO / "src" / "features" / "psse" / "sld-studio.ts"
    css_escaped = json.dumps(studio_css.replace(".psse-module ", ""))
    ts_content = (
        "import { startSldStudio } from './sld-studio-runtime.js';\n"
        "/* Grid Analyzer PSS/E Native SLD Studio Module */\n"
        "export function mountPsseSldStudio(): void {\n"
        "  if (typeof window === 'undefined' || (window as any).__GA_SLD_STUDIO_MOUNTED__) return;\n"
        "  (window as any).__GA_SLD_STUDIO_MOUNTED__ = true;\n"
        "  if (typeof document !== 'undefined' && !document.getElementById('ga-sld-studio-style')) {\n"
        "    const st = document.createElement('style');\n"
        "    st.id = 'ga-sld-studio-style';\n"
        f"    st.textContent = {css_escaped};\n"
        "    document.head.appendChild(st);\n"
        "  }\n"
        + "  startSldStudio();\n}\n"
    )
    ts_path.write_text(ts_content, encoding="utf-8", newline="\n")
    (ts_path.parent / "sld-studio-runtime.js").write_text("export function startSldStudio(){\n" + full_js + "\n}\n", encoding="utf-8", newline="\n")
    (ts_path.parent / "sld-studio-runtime.d.ts").write_text("export declare function startSldStudio(): void;\n", encoding="utf-8", newline="\n")
    print("Wrote", ts_path, len(ts_content), "bytes")

    # 2) Build standalone Grid_Analyzer_PSSE_SLD_Studio_FINAL.html from Grid_Analyzer_PSSE_SLD_Studio_Enhanced.html
    if not ENHANCED_HTML.exists():
        print('No optional standalone shell; repository module generated.')
        return
    src_html = ENHANCED_HTML.read_text(encoding="utf-8")
    # Fix CSP so local PSS(R)E 36.5 converter bridge (127.0.0.1:18765) is allowed
    src_html = src_html.replace(
        "connect-src 'none'",
        "connect-src http://127.0.0.1:18765 http://localhost:18765",
    )

    style_start = src_html.find('<style id="ga-sld-studio-style">')
    style_end = src_html.find("</style>", style_start)
    script_start = src_html.find('<script id="ga-sld-studio-script">')
    script_end = src_html.rfind("</script>")

    if style_start == -1 or script_start == -1:
        raise RuntimeError("Could not locate ga-sld-studio-style or ga-sld-studio-script in source HTML")

    final_html = (
        src_html[:style_start]
        + '<style id="ga-sld-studio-style">\n'
        + studio_css
        + src_html[style_end:script_start]
        + '<script id="ga-sld-studio-script">\n'
        + full_js
        + src_html[script_end:]
    )
    FINAL_HTML.write_text(final_html, encoding="utf-8", newline="\n")
    print("Wrote", FINAL_HTML, len(final_html), "bytes")


if __name__ == "__main__":
    main()
