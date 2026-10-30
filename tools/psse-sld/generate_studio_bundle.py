#!/usr/bin/env python3
"""
Builds:
1. src/features/psse/sld-studio.ts (clean repository source module for SLD Studio)
2. C:/Users/Murathan Yeniceli/Downloads/Grid_Analyzer_PSSE_SLD_Studio_FINAL.html
   (standalone portable HTML with updated localhost bridge CSP and zero hardcoded SLD templates)
"""
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
WORK_REPO = Path(r"C:\Users\Murathan Yeniceli\Downloads\GA_work")
ENHANCED_HTML = Path(r"C:\Users\Murathan Yeniceli\Downloads\Grid_Analyzer_PSSE_SLD_Studio_Enhanced.html")
FINAL_HTML = Path(r"C:\Users\Murathan Yeniceli\Downloads\Grid_Analyzer_PSSE_SLD_Studio_FINAL.html")


def main():
    studio_css = (HERE / "studio_style.css").read_text(encoding="utf-8")
    full_js = (HERE / "studio_runtime.js").read_text(encoding="utf-8")

    # 1) Write clean TypeScript module to repository
    ts_path = WORK_REPO / "src" / "features" / "psse" / "sld-studio.ts"
    css_escaped = json.dumps(studio_css.replace(".psse-module ", ""))
    ts_content = (
        "// @ts-nocheck\n"
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
        + full_js
        + "\n}\n"
    )
    ts_path.write_text(ts_content, encoding="utf-8")
    print("Wrote", ts_path, len(ts_content), "bytes")

    # 2) Build standalone Grid_Analyzer_PSSE_SLD_Studio_FINAL.html from Grid_Analyzer_PSSE_SLD_Studio_Enhanced.html
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
    FINAL_HTML.write_text(final_html, encoding="utf-8")
    print("Wrote", FINAL_HTML, len(final_html), "bytes")


if __name__ == "__main__":
    main()
