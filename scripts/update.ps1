# Lisan — update script
#
#   powershell -ExecutionPolicy Bypass -File scripts/update.ps1
#
# Re-copies the plugin into the Vencord checkout, typechecks it and rebuilds.
# Vencord is installed as a dev install, so restarting Discord is enough after this.

[CmdletBinding()]
param(
    [string]$VencordDir
)

$ErrorActionPreference = 'Stop'

$Plugin     = Split-Path $PSScriptRoot -Parent
$Root       = Split-Path $Plugin -Parent
if (-not $VencordDir) { $VencordDir = Join-Path $Root 'Vencord' }
$UserPlugin = Join-Path $VencordDir 'src\userplugins\lisan'
$Pnpm       = Join-Path $env:APPDATA 'npm\pnpm.cmd'

function Step($text) { Write-Host "`n==> $text" -ForegroundColor Cyan }
function Info($text) { Write-Host "    $text" -ForegroundColor Gray }
function Fail($text) { Write-Host "`nERROR: $text" -ForegroundColor Red; exit 1 }

if (-not (Test-Path $Pnpm)) { Fail 'pnpm not found. Run scripts/install.ps1 first.' }
if (-not (Test-Path (Join-Path $VencordDir 'package.json'))) { Fail "No Vencord checkout at $VencordDir. Run scripts/install.ps1 first." }

Step 'Copying Lisan into the Vencord checkout'
$sources = Get-ChildItem -Path (Join-Path $Plugin '*') -Include *.ts, *.tsx, *.css -File
if (-not $sources) { Fail "No plugin sources found in $Plugin" }
New-Item -ItemType Directory -Force -Path $UserPlugin | Out-Null
$sources | Copy-Item -Destination $UserPlugin -Force
Info "$($sources.Count) files -> $UserPlugin"

Step 'Typechecking'
Push-Location $VencordDir
try {
    & $Pnpm testTsc
    if ($LASTEXITCODE -ne 0) { Fail 'Typecheck failed. See the errors above.' }
} finally { Pop-Location }

Step 'Building'
Push-Location $VencordDir
try {
    & $Pnpm build
    if ($LASTEXITCODE -ne 0) { Fail 'Build failed.' }
} finally { Pop-Location }

Write-Host "`n==> Done." -ForegroundColor Green
Write-Host '    Fully quit and reopen Discord to load the new build.' -ForegroundColor Green
