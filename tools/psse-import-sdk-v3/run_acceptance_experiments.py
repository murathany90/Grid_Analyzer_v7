"""V3 portable acceptance runner; installed Siemens tests are a separate suite."""
import subprocess
import sys
from pathlib import Path
if __name__ == "__main__":
    sys.exit(subprocess.call([sys.executable,"-m","unittest","discover","-s","tests","-v"],cwd=Path(__file__).parent))
