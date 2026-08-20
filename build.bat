@echo off
REM Anima 构建入口 — 转发至 animalab\build.bat
setlocal
cd /d "%~dp0animalab"
call build.bat %*
endlocal
