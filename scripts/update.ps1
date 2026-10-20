# Lisan - update script
#
#   powershell -ExecutionPolicy Bypass -File scripts/update.ps1
#
# or just double-click update.cmd in the repository root.
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
$Pnpm       = $null

function Step($text) { Write-Host "`n==> $text" -ForegroundColor Cyan }
function Info($text) { Write-Host "    $text" -ForegroundColor Gray }
function Fail($text, $hint) {
    Write-Host "`nERROR: $text" -ForegroundColor Red
    if ($hint) { Write-Host "       $hint" -ForegroundColor Yellow }
    exit 1
}

function Get-VencordHash($dir) {
    try {
        $hash = & git -C $dir rev-parse --short HEAD 2>$null
        if ($LASTEXITCODE -eq 0 -and $hash) { return ($hash | Out-String).Trim() }
    } catch { }
    return 'lisan'
}

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Fail 'Node.js is not installed (or not on PATH).' 'Install Node.js 22 or newer from https://nodejs.org/en/download'
}
$nodeVersion = ((& node --version) | Out-String).Trim()
$nodeMajor = 0
if ($nodeVersion -match '^v(\d+)') { $nodeMajor = [int]$Matches[1] }
if ($nodeMajor -lt 22) {
    Fail "Node.js $nodeVersion is too old; Vencord needs 22 or newer." 'Download the current LTS build from https://nodejs.org/en/download'
}

$pnpmCmd = Get-Command pnpm.cmd -ErrorAction SilentlyContinue
if ($pnpmCmd) {
    $Pnpm = $pnpmCmd.Source
} else {
    $pnpmCmd = Get-Command pnpm -ErrorAction SilentlyContinue
    if ($pnpmCmd) { $Pnpm = $pnpmCmd.Source }
}
if (-not $Pnpm) { Fail 'pnpm not found.' 'Run scripts/install.ps1 first.' }
if (-not (Test-Path (Join-Path $VencordDir 'package.json'))) {
    Fail "No Vencord checkout at $VencordDir." 'Run scripts/install.ps1 first.'
}

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
# See install.ps1: supplying the hash keeps the build independent of git state.
$env:VENCORD_HASH = Get-VencordHash $VencordDir

Push-Location $VencordDir
try {
    & $Pnpm build
    if ($LASTEXITCODE -ne 0) { Fail 'Build failed.' 'See the messages above.' }
} finally { Pop-Location }

Write-Host "`n==> Done." -ForegroundColor Green
Write-Host '    Fully quit and reopen Discord to load the new build.' -ForegroundColor Green
