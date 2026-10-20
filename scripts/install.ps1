# Lisan - install script
#
#   powershell -ExecutionPolicy Bypass -File scripts/install.ps1
#
# or just double-click install.cmd in the repository root.
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

# Windows PowerShell 5.1 may still default to TLS 1.0/1.1, which GitHub rejects.
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$Plugin       = Split-Path $PSScriptRoot -Parent
$Root         = Split-Path $Plugin -Parent
if (-not $VencordDir) { $VencordDir = Join-Path $Root 'Vencord' }
$UserPlugin   = Join-Path $VencordDir 'src\userplugins\lisan'
$Pnpm         = $null
$PnpmVersion  = '11.9.0'
$Installer    = Join-Path $VencordDir 'dist\Installer\VencordInstallerCli.exe'
$InstallerUrl = 'https://github.com/Vencord/Installer/releases/latest/download/VencordInstallerCli.exe'

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

function Get-NpmPath {
    $npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
    if (-not $npm) { $npm = Get-Command npm -ErrorAction SilentlyContinue }
    if (-not $npm) {
        $node = Get-Command node -ErrorAction SilentlyContinue
        if ($node) {
            $candidate = Join-Path (Split-Path $node.Source) 'npm.cmd'
            if (Test-Path $candidate) { return $candidate }
        }
    }
    if ($npm) { return $npm.Source }
    return $null
}

# ----------------------------------------------------------- 1. prerequisites
Step 'Checking prerequisites'

$git = Get-Command git -ErrorAction SilentlyContinue
if (-not $git) {
    Fail 'Git is not installed (or not on PATH).' 'Install it from https://git-scm.com/download/win, then reopen the terminal.'
}
Info ("git " + ((& git --version) | Out-String).Trim())

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
Info "node $nodeVersion"

# ------------------------------------------------------------------ 2. pnpm
Step 'Checking pnpm'

$pnpmCmd = Get-Command pnpm.cmd -ErrorAction SilentlyContinue
if ($pnpmCmd) {
    $Pnpm = $pnpmCmd.Source
} else {
    $pnpmCmd = Get-Command pnpm -ErrorAction SilentlyContinue
    if ($pnpmCmd) { $Pnpm = $pnpmCmd.Source }
}

if (-not $Pnpm) {
    Info 'pnpm not found, installing...'
    $npmPath = Get-NpmPath
    if (-not $npmPath) { Fail 'npm not found. Install Node.js first.' 'Download it from https://nodejs.org/en/download' }

    & $npmPath install -g "pnpm@$PnpmVersion"
    if ($LASTEXITCODE -ne 0) { Fail 'Could not install pnpm globally.' 'Try running: npm install -g pnpm@' + $PnpmVersion }

    $pnpmCmd = Get-Command pnpm.cmd -ErrorAction SilentlyContinue
    if ($pnpmCmd) { $Pnpm = $pnpmCmd.Source }
    if (-not $Pnpm) {
        $fallback = Join-Path $env:APPDATA 'npm\pnpm.cmd'
        if (Test-Path $fallback) { $Pnpm = $fallback }
    }
}
if (-not $Pnpm) { Fail 'Could not find the pnpm command after installing it.' 'Open a new terminal and run this script again.' }

$pnpmVersion = ((& $Pnpm --version) | Out-String).Trim()
$pnpmMajor = 0
if ($pnpmVersion -match '^(\d+)') { $pnpmMajor = [int]$Matches[1] }

# Older pnpm releases cannot read Vencord's lockfile, so bring them up to the version
# Vencord pins. A newer major (12+) reads it fine and is left alone.
if ($pnpmMajor -lt 11) {
    Info "pnpm $pnpmVersion is older than Vencord expects, installing pnpm@$PnpmVersion..."
    $npmPath = Get-NpmPath
    if (-not $npmPath) { Fail 'npm not found. Install Node.js first.' }
    & $npmPath install -g "pnpm@$PnpmVersion"
    if ($LASTEXITCODE -ne 0) { Fail "Could not install pnpm@$PnpmVersion." }
    $pnpmVersion = ((& $Pnpm --version) | Out-String).Trim()
    Info "pnpm $pnpmVersion"
} elseif ($pnpmVersion -ne $PnpmVersion) {
    Info "pnpm $pnpmVersion (Vencord pins $PnpmVersion; newer versions work, a warning may appear)"
} else {
    Info "pnpm $pnpmVersion"
}

# --------------------------------------------------------------- 3. Vencord
Step 'Checking the Vencord checkout'

if (-not (Test-Path (Join-Path $VencordDir 'package.json'))) {
    if (Test-Path $VencordDir) {
        $items = @(Get-ChildItem -Force -Path $VencordDir -ErrorAction SilentlyContinue)
        if ($items.Count -gt 0) {
            $backup = "$VencordDir.broken-" + (Get-Date -Format 'yyyyMMdd-HHmmss')
            Info "A previous clone is incomplete; moving it to $(Split-Path $backup -Leaf)"
            try {
                Move-Item -Path $VencordDir -Destination $backup -Force
            } catch {
                Fail "Could not move the incomplete checkout out of the way: $($_.Exception.Message)" "Delete or rename '$VencordDir' manually and run this script again."
            }
        } else {
            Remove-Item -Path $VencordDir -Force
        }
    }

    Info "Cloning into $VencordDir (the first run takes a while)..."
    & git clone --depth 1 --branch main https://github.com/Vendicated/Vencord.git $VencordDir
    if ($LASTEXITCODE -ne 0) {
        Fail 'Could not clone Vencord.' 'Check your internet connection, then run this script again.'
    }
} else {
    Info "Found $VencordDir"
}

# ----------------------------------------------------------- 4. dependencies
if (-not $SkipDependencies) {
    Step 'Installing dependencies'
    Push-Location $VencordDir
    try {
        & $Pnpm install
        if ($LASTEXITCODE -ne 0) {
            Fail 'pnpm install failed.' 'See the messages above. Deleting the Vencord folder and running the script again often fixes it.'
        }
    } finally { Pop-Location }
}

# --------------------------------------------------------------- 5. plugin
Step 'Copying Lisan into the Vencord checkout'

$sources = Get-ChildItem -Path (Join-Path $Plugin '*') -Include *.ts, *.tsx, *.css -File
if (-not $sources) { Fail "No plugin sources found in $Plugin" }

New-Item -ItemType Directory -Force -Path $UserPlugin | Out-Null
$sources | Copy-Item -Destination $UserPlugin -Force
Info "$($sources.Count) files -> $UserPlugin"

# ---------------------------------------------------------------- 6. build
Step 'Building Vencord'

# Vencord's build asks git for the current commit. Supplying the hash ourselves
# keeps the build working even when git refuses the checkout (for example after
# the folder was copied from another PC: "detected dubious ownership").
$env:VENCORD_HASH = Get-VencordHash $VencordDir

Push-Location $VencordDir
try {
    & $Pnpm build
    if ($LASTEXITCODE -ne 0) {
        Fail 'Build failed.' 'See the messages above. Running scripts/install.ps1 again is usually enough to recover.'
    }
} finally { Pop-Location }

$bundle = Join-Path $VencordDir 'dist\vencordDesktopRenderer.js'
if (-not (Test-Path $bundle)) { Fail 'The build produced no renderer bundle.' }
if (-not (Select-String -Path $bundle -Pattern '"Lisan"' -SimpleMatch -Quiet)) {
    Fail 'Lisan is not in the built bundle. Something went wrong.'
}
Info 'Build finished and Lisan is in the bundle.'

# ------------------------------------------------------------- 7. installer
Step 'Preparing the Vencord installer'

if (-not (Test-Path $Installer)) {
    Info 'Downloading...'
    New-Item -ItemType Directory -Force -Path (Split-Path $Installer) | Out-Null
    try {
        Invoke-WebRequest -Uri $InstallerUrl -OutFile $Installer -UseBasicParsing
    } catch {
        Fail "Could not download the installer: $($_.Exception.Message)" 'Check your internet connection or proxy, then run this script again.'
    }
    if (-not (Test-Path $Installer) -or (Get-Item $Installer).Length -eq 0) {
        Fail 'The downloaded installer is empty.' 'Delete dist\Installer and run this script again.'
    }
}
Info $Installer

# ------------------------------------------------------------ 8. patch Discord
Step 'Installing into Discord'

$discordRoots = @(
    (Join-Path $env:LOCALAPPDATA 'Discord'),
    (Join-Path $env:LOCALAPPDATA 'DiscordPTB'),
    (Join-Path $env:LOCALAPPDATA 'DiscordCanary')
)
$discordFound = $false
foreach ($dir in $discordRoots) {
    if (Test-Path (Join-Path $dir 'Update.exe')) { $discordFound = $true }
}
if (-not $discordFound) {
    Fail 'Discord desktop was not found on this PC.' 'Install the normal desktop app from https://discord.com/download. The Microsoft Store version is not supported.'
}

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
    Fail 'Discord is still running.' 'Quit it from the tray icon as well, then run this script again.'
}

$env:VENCORD_USER_DATA_DIR = $VencordDir
$env:VENCORD_DEV_INSTALL = '1'

& $Installer -install -branch auto
if ($LASTEXITCODE -ne 0) {
    Fail 'The Vencord installer failed.' 'Close every Discord window and tray icon, then run this script again.'
}

Write-Host "`n==> Done." -ForegroundColor Green
Write-Host '    Open Discord, then Settings > Vencord > Plugins and enable "Lisan".' -ForegroundColor Green
Write-Host '    Click the gear icon on the Lisan row to pick the engine and target language.' -ForegroundColor Green
Write-Host ''
Write-Host '    Keep this folder: Vencord was installed as a development build and' -ForegroundColor Yellow
Write-Host '    Discord loads its patcher from here. Moving or deleting it breaks Discord.' -ForegroundColor Yellow
Write-Host '    If a Discord update removes Lisan, run this script again.' -ForegroundColor Yellow
