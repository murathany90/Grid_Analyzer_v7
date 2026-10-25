# Standalone SAV binary inspection

`ga_psse_sdk/standalone_sav_decoder.py` inspects record/header structure only.
It has no independent electrical decoder. It emits no synthetic buses or slack,
uses null for unknown system/frequency bases, and is DIAGNOSTIC_ONLY. All
analysis capabilities are blocked. Use installed Siemens caspy or official
PSS/E API for real SAV electrical extraction; these are separate code paths.
