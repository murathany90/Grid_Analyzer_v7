@echo off
chcp 65001 >nul
setlocal
set "PY=C:\Users\Murathan Yeniceli\AppData\Local\Programs\Python\Python314\python.exe"
if not exist "%PY%" set "PY=python"
if "%~1"=="" (
  echo Grid Analyzer PSS(R)E 36.5 Yerel SLD Köprüsü başlatılıyor (http://127.0.0.1:18765)...
  "%PY%" "%~dp0psse_sld_converter.py" serve --port 18765
) else (
  "%PY%" "%~dp0psse_sld_converter.py" %*
)
