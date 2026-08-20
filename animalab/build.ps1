#Requires -Version 5.1
# Anima 构建脚本 — 生成 Anima/anima.exe（Go 1.22+）
# 用法:  powershell -ExecutionPolicy Bypass -File build.ps1
#        或双击 build.bat
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
if (-not $root) { $root = (Get-Location).Path }
Set-Location $root

Write-Host "==> Anima build" -ForegroundColor Cyan
Write-Host "    root: $root"
go version
if ($LASTEXITCODE -ne 0) { throw "go not found in PATH" }

Write-Host "==> go vet ./..." -ForegroundColor DarkGray
go vet ./...
if ($LASTEXITCODE -ne 0) { throw "go vet failed" }

Write-Host "==> go build" -ForegroundColor Green
# -trimpath 可复现，-s -w 去符号体积更小；CGO_ENABLED=0 静态
$env:CGO_ENABLED = "0"
go build -trimpath -ldflags "-s -w" -o ../anima.exe ./cmd/anima
if ($LASTEXITCODE -ne 0) { throw "go build failed" }

$info = Get-Item ../anima.exe
Write-Host ("==> done: {0}  {1:N1} MB  {2}" -f $info.FullName, ($info.Length/1MB), $info.LastWriteTime) -ForegroundColor Green
Write-Host "    run:  ./anima.exe serve              # http://127.0.0.1:8765"
Write-Host "          ./anima.exe run jobs/2026-08-20/example.json --dry-run"
