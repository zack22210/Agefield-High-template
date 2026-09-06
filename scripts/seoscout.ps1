param(
  [Parameter(Position = 0)]
  [ValidateSet('setup', 'repair', 'health', 'search', 'collect', 'generate', 'translate', 'publish')]
  [string]$Action = 'publish',
  [string]$SharedPath = $env:SEOSCOUT_SHARED_PATH
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new()
$ProjectRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'seoscout-common.ps1')
if ([string]::IsNullOrWhiteSpace($SharedPath)) {
  $SharedPath = Get-DefaultSeoScoutSharedPath -ProjectRoot $ProjectRoot
}
$SeoDir = Join-Path $ProjectRoot 'seoscout'
$PythonExe = Join-Path $SharedPath '.venv\Scripts\python.exe'
$SourcePath = Join-Path $SharedPath 'source'
$SeoScoutRunner = Join-Path $PSScriptRoot 'run-seoscout.py'
$KeywordsFile = 'keywords.json'
$GeneratePrompt = 'prompts\generate.md'
$TranslatePrompt = 'prompts\translate.md'

function Invoke-Checked {
  param([string]$File, [string[]]$Arguments, [switch]$AllowFailure)
  & $File @Arguments
  $code = $LASTEXITCODE
  $script:LastNativeExitCode = $code
  if ($code -ne 0 -and -not $AllowFailure) {
    throw "Command failed ($code): $File $($Arguments -join ' ')"
  }
}

function Prepare-Project {
  Invoke-Checked node @((Join-Path $PSScriptRoot 'prepare-seoscout.mjs'))
  $prompt = Get-Content -LiteralPath (Join-Path $SeoDir $GeneratePrompt) -Raw
  if ($prompt.Contains('GAME_NAME_TO_REPLACE') -or $prompt.Contains('OFFICIAL_GAME_URL_TO_REPLACE')) {
    throw 'Replace the game name and official game URL placeholders in seoscout/prompts/generate.md before generation.'
  }
}

function Get-ProjectName {
  $data = Get-Content -LiteralPath (Join-Path $SeoDir $KeywordsFile) -Raw | ConvertFrom-Json
  return (([string]$data.topic_name).Trim().ToLower() -replace '\s+', '_')
}

function Invoke-SeoScout {
  param([string[]]$Arguments)
  Invoke-Checked $PythonExe (@($SeoScoutRunner, $SourcePath, $SeoDir) + $Arguments)
}

function Invoke-Search {
  Invoke-SeoScout @('search', '--keywords', $KeywordsFile)
  $project = Get-ProjectName
  $results = Join-Path $SeoDir "output\$project\out\search_results.json"
  if (Test-Path -LiteralPath $results) {
    Invoke-Checked $PythonExe @((Join-Path $PSScriptRoot 'curate-seoscout-results.py'), $results, '--policy', (Join-Path $SeoDir 'source-policy.json'), '--top-k', '2')
  }
}

function Get-BoundedYoutubeSetting {
  param([string]$Name, [int]$Default = 2)
  $value = $Default
  $envFile = Join-Path $SeoDir '.env'
  $line = Get-Content -LiteralPath $envFile | Where-Object { $_ -match "^$([regex]::Escape($Name))=(\d+)\s*$" } | Select-Object -Last 1
  if ($line -and $line -match '=(\d+)\s*$') {
    $value = [int]$Matches[1]
  }
  return [Math]::Max(1, [Math]::Min(2, $value))
}

function Invoke-Collect {
  # SEOScout's dotenv loader keeps existing process values, so these enforce the
  # template-wide one-or-two-video transcript limit even if .env asks for more.
  $env:YOUTUBE_INITIAL_SEARCH_RESULTS = [string](Get-BoundedYoutubeSetting 'YOUTUBE_INITIAL_SEARCH_RESULTS')
  $env:YOUTUBE_MAX_RESULTS_AFTER_FILTER = [string](Get-BoundedYoutubeSetting 'YOUTUBE_MAX_RESULTS_AFTER_FILTER')
  $env:YOUTUBE_EXTRACT_TOP_K = [string](Get-BoundedYoutubeSetting 'YOUTUBE_EXTRACT_TOP_K')
  Invoke-SeoScout @('collect', '--keywords', $KeywordsFile)
}
function Invoke-Generate { Invoke-SeoScout @('generate', '--keywords', $KeywordsFile, '--prompt', $GeneratePrompt) }
function Invoke-Translate {
  $data = Get-Content -LiteralPath (Join-Path $SeoDir $KeywordsFile) -Raw | ConvertFrom-Json
  if (@($data.languages).Count -gt 0) {
    Invoke-SeoScout @('translate', '--keywords', $KeywordsFile, '--prompt', $TranslatePrompt)
  } else {
    Write-Host 'No non-English languages configured; skipping translation.'
  }
}

if ($Action -eq 'setup') {
  & (Join-Path $PSScriptRoot 'setup-seoscout.ps1') -SharedPath $SharedPath
  exit $LASTEXITCODE
}
if ($Action -eq 'repair') {
  & (Join-Path $PSScriptRoot 'setup-seoscout.ps1') -SharedPath $SharedPath -Repair
  exit $LASTEXITCODE
}
if ($Action -eq 'health') {
  Assert-SeoScoutInstallation -SharedPath $SharedPath
  exit 0
}

Assert-SeoScoutInstallation -SharedPath $SharedPath
if (-not (Test-Path -LiteralPath (Join-Path $SeoDir '.env'))) {
  throw 'Missing seoscout/.env. Copy .env.example and add the required API keys.'
}

Prepare-Project

switch ($Action) {
  'search' { Invoke-Search }
  'collect' { Invoke-Collect }
  'generate' { Invoke-Generate }
  'translate' { Invoke-Translate }
  'publish' {
    Invoke-Search
    Invoke-Collect
    Invoke-Generate
    Invoke-Translate

    $validator = Join-Path $PSScriptRoot 'validate-wiki.mjs'
    Invoke-Checked node @($validator, '--seoscout', '--quarantine') -AllowFailure
    $firstCode = $script:LastNativeExitCode
    if ($firstCode -ne 0) {
      Write-Host 'Retrying rejected or missing generated files once...'
      Invoke-Generate
      Invoke-Translate
      Invoke-Checked node @($validator, '--seoscout')
    }

    & (Join-Path $PSScriptRoot 'sync-seoscout-content.ps1')
    if ($LASTEXITCODE -ne 0) { throw 'Content synchronization failed.' }
    Invoke-Checked node @($validator, '--content')
  }
}
