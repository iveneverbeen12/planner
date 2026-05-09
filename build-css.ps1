# Сборка css/tailwind.css (без CDN). Нужен tools\tailwindcss.exe (standalone) или npm install + npx tailwindcss.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root
$exe = Join-Path $root "tools\tailwindcss.exe"
$outDir = Join-Path $root "css"
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }
if (Test-Path $exe) {
    & $exe -i ".\src\tailwind-input.css" -o ".\css\tailwind.css" --minify
    Write-Host "OK: css\tailwind.css (standalone CLI)"
    exit 0
}
$tw = Get-Command tailwindcss -ErrorAction SilentlyContinue
if ($tw) {
    & tailwindcss -i ".\src\tailwind-input.css" -o ".\css\tailwind.css" --minify
    Write-Host "OK: css\tailwind.css (tailwindcss on PATH)"
    exit 0
}
Write-Host "Не найден tools\tailwindcss.exe и команда tailwindcss."
Write-Host "Скачайте standalone: https://github.com/tailwindlabs/tailwindcss/releases (tailwindcss-windows-x64.exe) в tools\tailwindcss.exe"
Write-Host "или выполните: npm install && npm run build:css"
exit 1
