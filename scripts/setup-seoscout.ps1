param(
  [string]$SharedPath = $env:SEOSCOUT_SHARED_PATH,
  [switch]$Repair,
  [switch]$SkipUpdate
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new()
$ProjectRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'seoscout-common.ps1')
if ([string]::IsNullOrWhiteSpace($SharedPath)) {
  $SharedPath = Get-DefaultSeoScoutSharedPath -ProjectRoot $ProjectRoot
}

$SourcePath = Join-Path $SharedPath 'source'
$VenvPath = Join-Path $SharedPath '.venv'
$ManagedMarker = Join-Path $SharedPath '.game-wiki-template-managed'
$LegacyManagedMarker = Join-Path $SharedPath '.roblox-wiki-template-managed'
$ProvenancePath = Get-SeoScoutProvenancePath $SharedPath

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

function Backup-InvalidInstallation {
  param([switch]$PreserveSource)
  $timestamp = [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmssfff')
  $backupRoot = Join-Path $SharedPath "backups\$timestamp"
  New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null

  $items = @($VenvPath, $ManagedMarker, $LegacyManagedMarker, $ProvenancePath)
  if (-not $PreserveSource) { $items = @($SourcePath) + $items }
  foreach ($item in $items) {
    if (Test-Path -LiteralPath $item) {
      $resolvedShared = [IO.Path]::GetFullPath($SharedPath).TrimEnd('\') + '\'
      $resolvedItem = [IO.Path]::GetFullPath($item)
      if (-not $resolvedItem.StartsWith($resolvedShared, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to move an item outside the shared SEOScout directory: $resolvedItem"
      }
      Move-Item -LiteralPath $item -Destination $backupRoot
    }
  }
  Write-Host "Preserved the invalid installation at $backupRoot"
}

function Test-RecoverablePinnedSource {
  if (-not (Test-Path -LiteralPath (Join-Path $SourcePath '.git'))) { return $false }
  $origin = (& git -c "safe.directory=$SourcePath" -C $SourcePath remote get-url origin 2>$null).Trim()
  if ($LASTEXITCODE -ne 0) { return $false }
  if ((Get-NormalizedRepositoryUrl $origin) -ne (Get-NormalizedRepositoryUrl $SeoScoutRepository)) { return $false }
  $head = (& git -c "safe.directory=$SourcePath" -C $SourcePath rev-parse HEAD 2>$null).Trim()
  if ($LASTEXITCODE -ne 0 -or $head -ne $SeoScoutPinnedCommit) { return $false }
  & git -c "safe.directory=$SourcePath" -C $SourcePath fsck --no-dangling 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) { return $false }

  $dirty = @(& git -c "safe.directory=$SourcePath" -C $SourcePath status --porcelain --untracked-files=all)
  if ($LASTEXITCODE -ne 0) { return $false }
  foreach ($line in $dirty) {
    if ($line.Length -lt 4) { return $false }
    $relativePath = $line.Substring(3).Replace('\', '/')
    if ($relativePath -notin $SeoScoutPatchedFiles) { return $false }
  }
  return $true
}

function Invoke-VerifiedClone {
  $lastCode = 1
  for ($attempt = 1; $attempt -le 3; $attempt += 1) {
    $clonePath = Join-Path $SharedPath ('.clone-' + [Guid]::NewGuid().ToString('N'))
    & git -c http.version=HTTP/1.1 clone --depth 1 --branch main $SeoScoutRepository $clonePath
    $lastCode = $LASTEXITCODE
    if ($lastCode -eq 0) {
      Move-Item -LiteralPath $clonePath -Destination $SourcePath
      return
    }

    if (Test-Path -LiteralPath $clonePath) {
      $failedRoot = Join-Path $SharedPath 'backups\failed-clones'
      New-Item -ItemType Directory -Force -Path $failedRoot | Out-Null
      Move-Item -LiteralPath $clonePath -Destination (Join-Path $failedRoot ([Guid]::NewGuid().ToString('N')))
    }
    if ($attempt -lt 3) {
      Write-Host "Git clone attempt $attempt failed; retrying..."
      Start-Sleep -Seconds (2 * $attempt)
    }
  }
  throw "Unable to clone the approved SEOScout repository after 3 attempts (last exit code $lastCode)."
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw 'Git is required to install the shared SEOScout checkout.'
}
Invoke-SystemPython @('--version')
New-Item -ItemType Directory -Force -Path $SharedPath | Out-Null

$sourceExists = Test-Path -LiteralPath $SourcePath
$installationExists = $sourceExists -or (Test-Path -LiteralPath $VenvPath) -or (Test-Path -LiteralPath $ProvenancePath)
$installationValid = $false
if ($installationExists) {
  try {
    Assert-SeoScoutInstallation -SharedPath $SharedPath -SkipExecutableCheck
    $installationValid = $true
  } catch {
    $installationValid = $false
  }
}

if ($installationExists -and -not $installationValid) {
  if (-not $Repair) {
    throw "The shared SEOScout installation is incomplete or unverifiable. Run pnpm seoscout:repair to preserve it and install a verified copy. Path: $SharedPath"
  }
  $recoverPinnedSource = Test-RecoverablePinnedSource
  Backup-InvalidInstallation -PreserveSource:$recoverPinnedSource
  $sourceExists = $recoverPinnedSource
  if ($recoverPinnedSource) {
    Write-Host 'Reusing the locally verified pinned Git checkout; the virtual environment will be rebuilt.'
  }
}

if (-not $sourceExists) {
  Invoke-VerifiedClone
} else {
  foreach ($relativePath in $SeoScoutPatchedFiles) {
    Invoke-Checked git @('-c', "safe.directory=$SourcePath", '-C', $SourcePath, 'restore', '--', $relativePath)
  }
}

& git -c "safe.directory=$SourcePath" -C $SourcePath cat-file -e "$SeoScoutPinnedCommit`^{commit}" 2>$null
if ($LASTEXITCODE -ne 0) {
  if ($SkipUpdate) {
    throw "Pinned SEOScout commit is not available locally: $SeoScoutPinnedCommit"
  }
  Invoke-Checked git @('-c', "safe.directory=$SourcePath", '-C', $SourcePath, 'fetch', 'origin', $SeoScoutPinnedCommit)
}
Invoke-Checked git @('-c', "safe.directory=$SourcePath", '-C', $SourcePath, 'checkout', '--detach', $SeoScoutPinnedCommit)

$origin = (& git -c "safe.directory=$SourcePath" -C $SourcePath remote get-url origin).Trim()
if ((Get-NormalizedRepositoryUrl $origin) -ne (Get-NormalizedRepositoryUrl $SeoScoutRepository)) {
  throw "SEOScout origin verification failed: $origin"
}

Set-Content -LiteralPath $ManagedMarker -Value "Managed by Non-Roblox Game Wiki Template`n$SeoScoutRepository`n$SeoScoutPinnedCommit" -Encoding utf8
Invoke-SystemPython @((Join-Path $PSScriptRoot 'patch-seoscout-trafilatura.py'), $SourcePath)

if (-not (Test-Path -LiteralPath (Join-Path $VenvPath 'Scripts\python.exe'))) {
  Invoke-SystemPython @('-m', 'venv', $VenvPath)
}

$VenvPython = Join-Path $VenvPath 'Scripts\python.exe'
Invoke-Checked $VenvPython @('-m', 'pip', 'install', '--upgrade', 'pip', 'setuptools', 'wheel')
Invoke-Checked $VenvPython @('-m', 'pip', 'install', '-e', $SourcePath)
Invoke-Checked $VenvPython @('-m', 'pip', 'install', 'yt-dlp>=2024.1.0', 'trafilatura>=2.0,<3')

Write-SeoScoutProvenance -SharedPath $SharedPath -SourcePath $SourcePath

Ensure-SeoScoutProjectEnv -ProjectRoot $ProjectRoot -SharedPath $SharedPath

Assert-SeoScoutInstallation -SharedPath $SharedPath
Write-Host "Shared SEOScout is ready: $SharedPath"
