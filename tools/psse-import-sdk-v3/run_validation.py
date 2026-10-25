"""V3 source/schema/projection evidence runner (see VALIDATION_V3.md)."""
import runpy
from pathlib import Path
if __name__ == "__main__":
    runpy.run_path(str(Path(__file__).parent/"tools"/"validate_v3.py"),run_name="__main__")
