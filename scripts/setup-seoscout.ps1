param(
  [string]$SharedPath = $(if ($env:SEOSCOUT_SHARED_PATH) { $env:SEOSCOUT_SHARED_PATH } else { 'D:\Web出海\tools\seoscout' }),
  [switch]$SkipUpdate
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$SourcePath = Join-Path $SharedPath 'source'
$VenvPath = Join-Path $SharedPath '.venv'
$ManagedMarker = Join-Path $SharedPath '.game-wiki-template-managed'
$LegacyManagedMarker = Join-Path $SharedPath '.roblox-wiki-template-managed'
$Repo = 'https://github.com/libin257/seoscout.git'

function Invoke-Checked {
  param([string]$File, [string[]]$Arguments)
  & $File @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed ($LASTEXITCODE): $File $($Arguments -join ' ')"
  }
}

function Invoke-SystemPython {
  param([string[]]$Arguments)
  if ($env:SEOSCOUT_PYTHON) {
    Invoke-Checked $env:SEOSCOUT_PYTHON $Arguments
  } elseif (Get-Command python -ErrorAction SilentlyContinue) {
    Invoke-Checked python $Arguments
  } elseif (Get-Command py -ErrorAction SilentlyContinue) {
    Invoke-Checked py (@('-3') + $Arguments)
  } elseif (Get-Command python3 -ErrorAction SilentlyContinue) {
    Invoke-Checked python3 $Arguments
  } else {
    throw 'Python 3.10 or newer is required. Install Python or set SEOSCOUT_PYTHON to python.exe.'
  }
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw 'Git is required to install the shared SEOScout checkout.'
}
Invoke-SystemPython @('--version')
New-Item -ItemType Directory -Force -Path $SharedPath | Out-Null

if (Test-Path -LiteralPath (Join-Path $SourcePath '.git')) {
  if (-not (Test-Path -LiteralPath $ManagedMarker) -and -not (Test-Path -LiteralPath $LegacyManagedMarker)) {
    throw "The existing checkout is not marked as template-managed: $SourcePath"
  }
  if (-not $SkipUpdate) {
    $dirty = @(& git -C $SourcePath status --porcelain)
    $unexpected = @($dirty | Where-Object {
      $file = $_.Substring(3).Replace('\\', '/')
      $file -notin @('seoscout/core/web.py', 'seoscout/core/config.py', 'seoscout/translate.py')
    })
    if ($unexpected.Count -gt 0) {
      throw "SEOScout has unexpected local changes. Review them before updating:`n$($unexpected -join "`n")"
    }
    if ($dirty.Count -gt 0) {
      Invoke-Checked git @('-C', $SourcePath, 'restore', '--', 'seoscout/core/web.py', 'seoscout/core/config.py', 'seoscout/translate.py')
    }
    Invoke-Checked git @('-C', $SourcePath, 'pull', '--ff-only', 'origin', 'main')
  }
} elseif (Test-Path -LiteralPath $SourcePath) {
  $existing = @(Get-ChildItem -LiteralPath $SourcePath -Force)
  if ($existing.Count -gt 0) {
    throw "Refusing to overwrite the non-empty directory: $SourcePath"
  }
  Invoke-Checked git @('clone', '--depth', '1', $Repo, $SourcePath)
} else {
  Invoke-Checked git @('clone', '--depth', '1', $Repo, $SourcePath)
}

Set-Content -LiteralPath $ManagedMarker -Value "Managed by Non-Roblox Game Wiki Template`n$Repo" -Encoding utf8
Invoke-SystemPython @((Join-Path $PSScriptRoot 'patch-seoscout-trafilatura.py'), $SourcePath)

if (-not (Test-Path -LiteralPath (Join-Path $VenvPath 'Scripts\python.exe'))) {
  Invoke-SystemPython @('-m', 'venv', $VenvPath)
}

$VenvPython = Join-Path $VenvPath 'Scripts\python.exe'
Invoke-Checked $VenvPython @('-m', 'pip', 'install', '--upgrade', 'pip', 'setuptools', 'wheel')
Invoke-Checked $VenvPython @('-m', 'pip', 'install', '-e', $SourcePath)
Invoke-Checked $VenvPython @('-m', 'pip', 'install', 'yt-dlp>=2024.1.0', 'trafilatura>=2.0,<3')

$ProjectEnv = Join-Path $ProjectRoot 'seoscout\.env'
if (-not (Test-Path -LiteralPath $ProjectEnv)) {
  Copy-Item -LiteralPath (Join-Path $ProjectRoot 'seoscout\.env.example') -Destination $ProjectEnv
  Write-Host 'Created seoscout/.env. Add SERPER_API_KEY and LLM settings before generation.'
}

$SeoScoutExe = Join-Path $VenvPath 'Scripts\seoscout.exe'
Invoke-Checked $SeoScoutExe @('--version')
Write-Host "Shared SEOScout is ready: $SharedPath"
