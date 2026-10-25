@echo off
setlocal
cd /d "%~dp0"
set PYTHONUTF8=0
py -3.14 test_ui\server.py --open %*
endlocal
