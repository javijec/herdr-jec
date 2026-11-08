[CmdletBinding()]
param(
  # Advance only after reviewing the changes; this replaces the comparison baseline.
  [switch]$AdvanceBaseline
)

$ErrorActionPreference = "Stop"
$manifestPath = Join-Path $PSScriptRoot "upstream-estro.json"
if (-not (Test-Path -LiteralPath $manifestPath)) {
  throw "Missing upstream manifest: $manifestPath"
}

$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$headers = @{
  Accept = "application/vnd.github+json"
  "User-Agent" = "herdr-jec-estro-upstream-check"
}
$api = "https://api.github.com/repos/$($manifest.repository)"

function Get-GitHubJson([string]$uri) {
  for ($attempt = 1; $attempt -le 3; $attempt++) {
    try {
      return Invoke-RestMethod -Method Get -Uri $uri -Headers $headers -TimeoutSec 20
    } catch {
      $statusCode = 0
      try { $statusCode = [int]$_.Exception.Response.StatusCode } catch { }
      $retryable = $statusCode -eq 0 -or $statusCode -eq 429 -or $statusCode -ge 500
      if (-not $retryable -or $attempt -eq 3) {
        throw "GitHub API request failed after $attempt attempt(s): $($_.Exception.Message)"
      }
      Start-Sleep -Seconds ([Math]::Pow(2, $attempt - 1))
    }
  }
}

$head = Get-GitHubJson "$api/commits/$($manifest.branch)"

$headSha = [string]$head.sha
if (-not $headSha) {
  throw "GitHub returned no commit SHA for $($manifest.repository)@$($manifest.branch)."
}

if ($AdvanceBaseline) {
  $manifest.baseline_sha = $headSha
  $manifest.baseline_recorded_utc = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
  $json = $manifest | ConvertTo-Json -Depth 8
  [System.IO.File]::WriteAllText($manifestPath, $json + [Environment]::NewLine, [System.Text.UTF8Encoding]::new($false))
  Write-Host "Baseline advanced to $headSha."
  Write-Host "Only do this after reviewing the diff."
  exit 0
}

$baseSha = [string]$manifest.baseline_sha
if (-not $baseSha) {
  throw "The manifest has no baseline_sha. Review upstream changes, then set a baseline explicitly."
}

Write-Host "Upstream: $($manifest.repository) ($($manifest.branch))"
Write-Host "Baseline: $baseSha"
Write-Host "Current:  $headSha"

if ($headSha -eq $baseSha) {
  Write-Host "No new upstream commits since the baseline."
  exit 0
}

$compareUri = "$api/compare/$baseSha...$headSha"
$comparison = Get-GitHubJson $compareUri

$roots = @($manifest.layout_paths) + @($manifest.mod_paths)
$changes = @($comparison.files | Where-Object {
  $path = [string]$_.filename
  foreach ($root in $roots) {
    if ($path.StartsWith([string]$root, [System.StringComparison]::Ordinal)) { return $true }
  }
  return $false
})

if ($changes.Count -eq 0) {
  Write-Host "Upstream is $($comparison.ahead_by) commit(s) ahead, but no tracked Estro layout/mod paths changed."
  Write-Host "The baseline was left unchanged; use -AdvanceBaseline only after reviewing."
  exit 0
}

Write-Host "Found $($changes.Count) changed file(s) in Estro or its original mods ($($comparison.ahead_by) upstream commit(s) ahead):"
foreach ($file in $changes) {
  Write-Host ""
  Write-Host ("[{0}] {1} (+{2} / -{3})" -f $file.status, $file.filename, $file.additions, $file.deletions)
  if ($file.patch) {
    Write-Output $file.patch
  } else {
    Write-Host "  GitHub did not return a text patch for this file (binary or large file)."
  }
}

Write-Host ""
Write-Host "Full comparison: $($comparison.html_url)"
Write-Host "This is the upstream diff; it does not overwrite or compare your local mods."
Write-Host "After reviewing, advance the saved SHA with: pwsh -File .\check-estro-updates.ps1 -AdvanceBaseline"
