param(
  [string]$SharedPath = $(if ($env:SEOSCOUT_SHARED_PATH) { $env:SEOSCOUT_SHARED_PATH } else { 'D:\Web出海\tools\seoscout' }),
  [switch]$Clean
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$KeywordsPath = Join-Path $ProjectRoot 'seoscout\keywords.json'
$Destination = Join-Path $ProjectRoot 'content'

if (-not (Test-Path -LiteralPath $KeywordsPath)) {
  throw "Missing $KeywordsPath"
}

$Data = Get-Content -LiteralPath $KeywordsPath -Raw | ConvertFrom-Json
$Topic = [string]$Data.topic_name
if ([string]::IsNullOrWhiteSpace($Topic)) {
  Write-Host 'No topic is configured; there is nothing to sync.'
  exit 0
}

$Project = ($Topic.Trim().ToLower() -replace '\s+', '_')
$Source = Join-Path $ProjectRoot "seoscout\output\$Project\articles"
if (-not (Test-Path -LiteralPath $Source)) {
  Write-Host "No generated article directory exists yet: $Source"
  Write-Host 'Continuing without fake articles, as required for homepage-only or insufficient-source projects.'
  exit 0
}

$Files = @(Get-ChildItem -LiteralPath $Source -Recurse -File -Filter '*.mdx')
if ($Files.Count -eq 0) {
  Write-Host "No generated MDX files found under $Source; nothing to sync."
  exit 0
}

New-Item -ItemType Directory -Force -Path (Join-Path $Destination 'en') | Out-Null
if ($Clean) {
  $resolvedDestination = (Resolve-Path -LiteralPath $Destination).Path
  $resolvedProject = (Resolve-Path -LiteralPath $ProjectRoot).Path
  if (-not $resolvedDestination.StartsWith($resolvedProject, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to clean a content directory outside the project: $resolvedDestination"
  }
  Get-ChildItem -LiteralPath $resolvedDestination -Recurse -File -Filter '*.mdx' | Remove-Item -Force
}

$Copied = 0
foreach ($File in $Files) {
  $Relative = [System.IO.Path]::GetRelativePath($Source, $File.FullName)
  $Target = Join-Path $Destination $Relative
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Target) | Out-Null
  Copy-Item -LiteralPath $File.FullName -Destination $Target -Force
  $Copied += 1
}

Write-Host "Synced $Copied MDX file(s) into content/."
