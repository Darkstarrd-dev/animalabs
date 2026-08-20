# Anima 构建入口 — 转发至 animalab/build.ps1
$ErrorActionPreference = "Stop"
$lab = Join-Path $PSScriptRoot "animalab"
if (-not (Test-Path $lab)) { throw "animalab not found: $lab" }
& (Join-Path $lab "build.ps1")
