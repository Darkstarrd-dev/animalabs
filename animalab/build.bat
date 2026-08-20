@echo off
REM Anima 构建 — 双击或命令行执行，生成 anima.exe
REM 依赖 Go 1.22+，无需额外工具
setlocal
cd /d "%~dp0"
echo ==^> Anima build
go version || (echo go not found & pause & exit /b 1)
echo ==^> go vet ...
go vet ./... || (echo go vet failed & pause & exit /b 1)
echo ==^> go build ...
set CGO_ENABLED=0
go build -trimpath -ldflags "-s -w" -o ..\anima.exe ./cmd/anima || (echo go build failed & pause & exit /b 1)
for %%I in (..\anima.exe) do echo ==^> done: %%~fI  %%~zI bytes
echo     run:  anima.exe serve
echo           anima.exe run jobs\2026-08-20\example.json --dry-run
endlocal
