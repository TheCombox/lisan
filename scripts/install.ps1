# Lisan — install script
#
#   powershell -ExecutionPolicy Bypass -File scripts/install.ps1
#
# Clones Vencord next to this repository, copies the plugin into it, builds the
# bundle and injects Vencord into the Discord desktop app.
#
# Messages are ASCII on purpose: Windows PowerShell 5.1 reads BOM-less UTF-8 files
# as ANSI, which mangles non-ASCII characters.

[CmdletBinding()]
param(
    [string]$VencordDir,
    [switch]$SkipDependencies,
    [switch]$NoConfirm
)

$ErrorActionPreference = 'Stop'

$Plugin      = Split-Path $PSScriptRoot -Parent
$Root        = Split-Path $Plugin -Parent
if (-not $VencordDir) { $VencordDir = Join-Path $Root 'Vencord' }
$UserPlugin  = Join-Path $VencordDir 'src\userplugins\lisan'
$Pnpm        = Join-Path $env:APPDATA 'npm\pnpm.cmd'
$PnpmVersion = '11.9.0'
$Installer   = Join-Path $VencordDir 'dist\Installer\VencordInstallerCli.exe'
$InstallerUrl = 'https://github.com/Vencord/Installer/releases/latest/download/VencordInstallerCli.exe'

function Step($text) { Write-Host "`n==> $text" -ForegroundColor Cyan }
function Info($text) { Write-Host "    $text" -ForegroundColor Gray }
function Fail($text) { Write-Host "`nERROR: $text" -ForegroundColor Red; exit 1 }

# ------------------------------------------------------------------ 1. pnpm
Step 'Checking pnpm'

if (-not (Test-Path $Pnpm)) {
    Info 'pnpm not found, installing...'

    $npm = Get-Command npm -ErrorAction SilentlyContinue
    if (-not $npm) {
        $node = Get-Command node -ErrorAction SilentlyContinue
        if ($node) {
            $candidate = Join-Path (Split-Path $node.Source) 'npm.cmd'
            if (Test-Path $candidate) { $npm = $candidate }
        }
    }
    if (-not $npm) { Fail 'npm not found. Install Node.js first.' }

    $npmPath = if ($npm.Source) { $npm.Source } else { $npm }
    & $npmPath install -g "pnpm@$PnpmVersion"
}

if (-not (Test-Path $Pnpm)) { Fail "Could not install pnpm at $Pnpm" }
Info ("pnpm " + (& $Pnpm --version))

if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Fail 'Node.js not found.' }
Info ("node " + (& node --version))

# --------------------------------------------------------------- 2. Vencord
Step 'Checking the Vencord checkout'

if (-not (Test-Path (Join-Path $VencordDir 'package.json'))) {
    Info "Cloning into $VencordDir (first run takes a while)..."
    git clone --depth 1 --branch main https://github.com/Vendicated/Vencord.git $VencordDir
    if ($LASTEXITCODE -ne 0) { Fail 'Could not clone Vencord.' }
} else {
    Info "Found $VencordDir"
}

# ----------------------------------------------------------- 3. dependencies
if (-not $SkipDependencies) {
    Step 'Installing dependencies'
    Push-Location $VencordDir
    try {
        & $Pnpm install
        if ($LASTEXITCODE -ne 0) { Fail 'pnpm install failed.' }
    } finally { Pop-Location }
}

# --------------------------------------------------------------- 4. plugin
Step 'Copying Lisan into the Vencord checkout'

$sources = Get-ChildItem -Path (Join-Path $Plugin '*') -Include *.ts, *.tsx, *.css -File
if (-not $sources) { Fail "No plugin sources found in $Plugin" }

New-Item -ItemType Directory -Force -Path $UserPlugin | Out-Null
$sources | Copy-Item -Destination $UserPlugin -Force
Info "$($sources.Count) files -> $UserPlugin"

# ---------------------------------------------------------------- 5. build
Step 'Building Vencord'

Push-Location $VencordDir
try {
    & $Pnpm build
    if ($LASTEXITCODE -ne 0) { Fail 'Build failed.' }
} finally { Pop-Location }

$bundle = Join-Path $VencordDir 'dist\vencordDesktopRenderer.js'
if (-not (Test-Path $bundle)) { Fail 'Build produced no renderer bundle.' }
if (-not (Select-String -Path $bundle -Pattern '"Lisan"' -SimpleMatch -Quiet)) {
    Fail 'Lisan is not in the built bundle. Something went wrong.'
}
Info 'Build finished and Lisan is in the bundle.'

# ------------------------------------------------------------- 6. installer
Step 'Preparing the Vencord installer'

if (-not (Test-Path $Installer)) {
    Info 'Downloading...'
    New-Item -ItemType Directory -Force -Path (Split-Path $Installer) | Out-Null
    try {
        Invoke-WebRequest -Uri $InstallerUrl -OutFile $Installer -UseBasicParsing
    } catch {
        Fail "Could not download the installer: $($_.Exception.Message)"
    }
}
Info $Installer

# ------------------------------------------------------------ 7. patch Discord
Step 'Installing into Discord'

Write-Host '    This modifies the Discord app files and installs Vencord.'
Write-Host '    Discord must be closed, including the tray icon.'

$running = Get-Process -Name 'Discord' -ErrorAction SilentlyContinue

$go = $NoConfirm
if (-not $go) {
    $answer = Read-Host '    Continue? (y/n)'
    $go = ($answer -match '^[yY]')
}

if (-not $go) {
    Write-Host "`n    Skipped. The build is ready; install later with:" -ForegroundColor Yellow
    Write-Host "      cd `"$VencordDir`"" -ForegroundColor Yellow
    Write-Host "      .\dist\Installer\VencordInstallerCli.exe -install -branch auto" -ForegroundColor Yellow
    exit 0
}

if ($running) {
    Info 'Closing Discord...'
    $running | Stop-Process -Force
    Start-Sleep -Seconds 4
}

if (Get-Process -Name 'Discord' -ErrorAction SilentlyContinue) {
    Fail 'Discord is still running. Close it manually and try again.'
}

$env:VENCORD_USER_DATA_DIR = $VencordDir
$env:VENCORD_DEV_INSTALL = '1'

& $Installer -install -branch auto
if ($LASTEXITCODE -ne 0) { Fail 'The Vencord installer failed.' }

Write-Host "`n==> Done." -ForegroundColor Green
Write-Host '    Open Discord, then Settings > Vencord > Plugins and enable "Lisan".' -ForegroundColor Green
Write-Host '    Click the gear icon on the Lisan row to pick the engine and target language.' -ForegroundColor Green
