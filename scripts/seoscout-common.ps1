$SeoScoutRepository = 'https://github.com/libin257/seoscout.git'
$SeoScoutPinnedCommit = 'ee41d06b28ae89179c48a99487089bff2add7341'
$SeoScoutPatchedFiles = @(
  'seoscout/core/web.py',
  'seoscout/core/config.py',
  'seoscout/translate.py'
)
$SeoScoutExpectedPatchHashes = @{
  'seoscout/core/web.py' = 'b28ff6db8540c212a760b1b57d817f23e56924a11b0f925b1d8cdf64c6c89bbd'
  'seoscout/core/config.py' = '398ee6a237475397447c77759afb091600b5b29639f0bebb042dfdfdb1639646'
  'seoscout/translate.py' = 'bbf6d5fbbe024079d9f1efd7056fc3a3ade3c7784c26c118a95ceff908a02686'
}

function Get-DefaultSeoScoutSharedPath {
  param([string]$ProjectRoot)
  $workspaceRoot = Split-Path -Parent $ProjectRoot
  return Join-Path $workspaceRoot 'tools\seoscout'
}

function Get-NormalizedRepositoryUrl {
  param([string]$Value)
  return (($Value.Trim().TrimEnd('/')) -replace '\.git$', '').ToLowerInvariant()
}

function Get-SeoScoutProvenancePath {
  param([string]$SharedPath)
  return Join-Path $SharedPath '.seoscout-provenance.json'
}

function Get-Sha256 {
  param([string]$Path)
  $stream = [IO.File]::OpenRead($Path)
  try {
    $algorithm = [Security.Cryptography.SHA256]::Create()
    try {
      $bytes = $algorithm.ComputeHash($stream)
      return ([BitConverter]::ToString($bytes)).Replace('-', '').ToLowerInvariant()
    } finally {
      $algorithm.Dispose()
    }
  } finally {
    $stream.Dispose()
  }
}

function Get-SeoScoutFileHashes {
  param([string]$SourcePath)
  $hashes = [ordered]@{}
  foreach ($relativePath in $SeoScoutPatchedFiles) {
    $fullPath = Join-Path $SourcePath ($relativePath.Replace('/', '\'))
    if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
      throw "Required patched file is missing: $relativePath"
    }
    $hashes[$relativePath] = Get-Sha256 -Path $fullPath
  }
  return $hashes
}

function Write-SeoScoutProvenance {
  param([string]$SharedPath, [string]$SourcePath)
  $head = (& git -c "safe.directory=$SourcePath" -C $SourcePath rev-parse HEAD).Trim()
  if ($LASTEXITCODE -ne 0) { throw 'Unable to read the SEOScout Git commit.' }

  $hashes = Get-SeoScoutFileHashes -SourcePath $SourcePath
  foreach ($relativePath in $SeoScoutPatchedFiles) {
    if ($hashes[$relativePath] -ne $SeoScoutExpectedPatchHashes[$relativePath]) {
      throw "Template patch hash is not approved: $relativePath"
    }
  }

  $record = [ordered]@{
    schema_version = 1
    repository_url = $SeoScoutRepository
    upstream_commit = $head
    installed_at_utc = [DateTime]::UtcNow.ToString('o')
    patched_files = $hashes
  }
  $record | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Get-SeoScoutProvenancePath $SharedPath) -Encoding utf8
}

function Assert-SeoScoutInstallation {
  param([string]$SharedPath, [switch]$SkipExecutableCheck)

  $sourcePath = Join-Path $SharedPath 'source'
  $provenancePath = Get-SeoScoutProvenancePath $SharedPath
  $failures = @()

  if (-not (Test-Path -LiteralPath (Join-Path $sourcePath '.git'))) {
    $failures += "Git metadata is missing from $sourcePath"
  }
  if (-not (Test-Path -LiteralPath $provenancePath -PathType Leaf)) {
    $failures += "Provenance record is missing: $provenancePath"
  }
  if ($failures.Count -gt 0) {
    throw "Shared SEOScout verification failed:`n- $($failures -join "`n- ")`nRun pnpm seoscout:repair before phase B."
  }

  try {
    $record = Get-Content -LiteralPath $provenancePath -Raw | ConvertFrom-Json
  } catch {
    throw "Shared SEOScout provenance is unreadable. Run pnpm seoscout:repair before phase B. $($_.Exception.Message)"
  }

  $origin = (& git -c "safe.directory=$sourcePath" -C $sourcePath remote get-url origin).Trim()
  if ($LASTEXITCODE -ne 0) { $failures += 'Unable to read Git origin.' }
  elseif ((Get-NormalizedRepositoryUrl $origin) -ne (Get-NormalizedRepositoryUrl $SeoScoutRepository)) {
    $failures += "Unexpected Git origin: $origin"
  }

  $head = (& git -c "safe.directory=$sourcePath" -C $sourcePath rev-parse HEAD).Trim()
  if ($LASTEXITCODE -ne 0) { $failures += 'Unable to read Git HEAD.' }
  elseif ($head -ne $SeoScoutPinnedCommit) { $failures += "Git HEAD is $head; expected pinned commit $SeoScoutPinnedCommit." }
  if ([string]$record.repository_url -and (Get-NormalizedRepositoryUrl ([string]$record.repository_url)) -ne (Get-NormalizedRepositoryUrl $SeoScoutRepository)) {
    $failures += 'The provenance repository URL does not match the approved repository.'
  }
  if ([string]$record.upstream_commit -ne $SeoScoutPinnedCommit) {
    $failures += 'The provenance commit does not match the pinned commit.'
  }

  $dirty = @(& git -c "safe.directory=$sourcePath" -C $sourcePath status --porcelain --untracked-files=all)
  if ($LASTEXITCODE -ne 0) {
    $failures += 'Unable to inspect the Git working tree.'
  } else {
    foreach ($line in $dirty) {
      if ($line.Length -lt 4) { $failures += "Unrecognized Git status entry: $line"; continue }
      $relativePath = $line.Substring(3).Replace('\', '/')
      if ($relativePath -notin $SeoScoutPatchedFiles) {
        $failures += "Unexpected local source change: $relativePath"
      }
    }
  }

  try {
    $actualHashes = Get-SeoScoutFileHashes -SourcePath $sourcePath
    foreach ($relativePath in $SeoScoutPatchedFiles) {
      $expectedHash = [string]$record.patched_files.PSObject.Properties[$relativePath].Value
      $approvedHash = [string]$SeoScoutExpectedPatchHashes[$relativePath]
      if (-not $approvedHash -or $actualHashes[$relativePath] -ne $approvedHash) {
        $failures += "Patched file does not match the template-approved hash: $relativePath"
      } elseif (-not $expectedHash -or $approvedHash -ne $expectedHash.ToLowerInvariant()) {
        $failures += "Patched file hash mismatch: $relativePath"
      }
    }
  } catch {
    $failures += $_.Exception.Message
  }

  $pythonExe = Join-Path $SharedPath '.venv\Scripts\python.exe'
  if (-not (Test-Path -LiteralPath $pythonExe -PathType Leaf)) { $failures += "Virtual-environment Python is missing: $pythonExe" }

  if ($failures.Count -gt 0) {
    throw "Shared SEOScout verification failed:`n- $($failures -join "`n- ")`nRun pnpm seoscout:repair before phase B."
  }

  if (-not $SkipExecutableCheck) {
    Push-Location $sourcePath
    try {
      & $pythonExe -m seoscout --version | Out-Host
      if ($LASTEXITCODE -ne 0) {
        throw 'The verified SEOScout module failed its version check. Run pnpm seoscout:repair.'
      }
    } finally {
      Pop-Location
    }
  }

  Write-Host "Shared SEOScout verification passed at commit $SeoScoutPinnedCommit."
}
