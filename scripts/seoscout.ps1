param(
  [Parameter(Position = 0)]
  [ValidateSet('setup', 'search', 'collect', 'generate', 'translate', 'publish')]
  [string]$Action = 'publish',
  [string]$SharedPath = $(if ($env:SEOSCOUT_SHARED_PATH) { $env:SEOSCOUT_SHARED_PATH } else { 'D:\Web出海\tools\seoscout' })
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$SeoDir = Join-Path $ProjectRoot 'seoscout'
$SeoScoutExe = Join-Path $SharedPath '.venv\Scripts\seoscout.exe'
$PythonExe = Join-Path $SharedPath '.venv\Scripts\python.exe'
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
  Push-Location $SeoDir
  try { Invoke-Checked $SeoScoutExe $Arguments }
  finally { Pop-Location }
}

function Invoke-Search {
  Invoke-SeoScout @('search', '--keywords', $KeywordsFile)
  $project = Get-ProjectName
  $results = Join-Path $SeoDir "output\$project\out\search_results.json"
  if (Test-Path -LiteralPath $results) {
    Invoke-Checked $PythonExe @((Join-Path $PSScriptRoot 'curate-seoscout-results.py'), $results, '--policy', (Join-Path $SeoDir 'source-policy.json'), '--top-k', '2')
  }
}

function Invoke-Collect { Invoke-SeoScout @('collect', '--keywords', $KeywordsFile) }
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

if (-not (Test-Path -LiteralPath $SeoScoutExe)) {
  throw "Shared SEOScout is not installed. Run pnpm seoscout:setup first. Expected: $SeoScoutExe"
}
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
