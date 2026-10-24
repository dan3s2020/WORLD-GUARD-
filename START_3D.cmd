@echo off
cd /d "%~dp0"
where py >nul 2>nul
if errorlevel 1 goto use_python
start "WORLD GUARD 3D server" py -3 -m http.server 8000 --bind 127.0.0.1
goto open_game
:use_python
where python >nul 2>nul
if errorlevel 1 goto missing
start "WORLD GUARD 3D server" python -m http.server 8000 --bind 127.0.0.1
:open_game
timeout /t 1 /nobreak >nul
start "" "http://127.0.0.1:8000/play.html"
exit /b 0
:missing
echo Install Python 3, then run START_3D.cmd again.
pause
