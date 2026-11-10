[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'Medium')]
param(
  [string]$HerdrAppHome,
  [switch]$ReplaceExisting,
  [switch]$Activate
)

$ErrorActionPreference = 'Stop'
$packageRoot = [IO.Path]::GetFullPath($PSScriptRoot).TrimEnd([IO.Path]::DirectorySeparatorChar)

if ([string]::IsNullOrWhiteSpace($HerdrAppHome)) {
  if (-not [string]::IsNullOrWhiteSpace($env:HERDR_APP_HOME)) {
    $HerdrAppHome = $env:HERDR_APP_HOME
  } else {
    $HerdrAppHome = Join-Path $HOME '.config/herdr-app'
  }
}
$appHome = [IO.Path]::GetFullPath($HerdrAppHome).TrimEnd([IO.Path]::DirectorySeparatorChar)

if ([string]::Equals($appHome, $packageRoot, [StringComparison]::OrdinalIgnoreCase) -or
    $appHome.StartsWith($packageRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
  throw "Herdr app home must be outside the layout package: $appHome"
}

$checkedDestinationPaths = @{}
function Assert-NoReparsePointInPath([string]$Path) {
  $absolute = [IO.Path]::GetFullPath($Path)
  $pathRoot = [IO.Path]::GetPathRoot($absolute)
  $current = $pathRoot
  $segments = $absolute.Substring($pathRoot.Length).Split(
    [char[]]@([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar),
    [StringSplitOptions]::RemoveEmptyEntries
  )
  foreach ($segment in $segments) {
    $current = Join-Path $current $segment
    if ($script:checkedDestinationPaths.ContainsKey($current)) { continue }
    $script:checkedDestinationPaths[$current] = $true
    if (Test-Path -LiteralPath $current) {
      $entry = Get-Item -LiteralPath $current -Force
      if (($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw "Destination path contains a reparse point (junction or symlink), which is not allowed: $current"
      }
    }
  }
}

Assert-NoReparsePointInPath $appHome

$requiredFolders = @('layouts', 'mods')
foreach ($folder in $requiredFolders) {
  if (-not (Test-Path -LiteralPath (Join-Path $packageRoot $folder) -PathType Container)) {
    throw "The package is missing required folder '$folder'."
  }
}

$backupRoot = Join-Path $appHome ('.herdr-layout-backups/javijec-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff'))
$copied = 0
$identical = 0
$conflicts = 0
$planned = 0

function Get-FileDigest([string]$Path) {
  $algorithm = [Security.Cryptography.SHA256]::Create()
  $stream = [IO.File]::OpenRead($Path)
  try {
    return [Convert]::ToBase64String($algorithm.ComputeHash($stream))
  } finally {
    $stream.Dispose()
    $algorithm.Dispose()
  }
}

$packageFiles = @()
foreach ($folder in @('layouts', 'mods', 'themes')) {
  $sourceRoot = Join-Path $packageRoot $folder
  if (-not (Test-Path -LiteralPath $sourceRoot -PathType Container)) { continue }

  $sourcePrefix = $sourceRoot.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
  foreach ($source in Get-ChildItem -LiteralPath $sourceRoot -File -Recurse -Force |
      Where-Object { $_.Name -ne 'jsconfig.json' -and -not $_.Name.EndsWith('.d.ts', [StringComparison]::OrdinalIgnoreCase) }) {
    $relative = $source.FullName.Substring($sourcePrefix.Length)
    $target = Join-Path (Join-Path $appHome $folder) $relative
    Assert-NoReparsePointInPath $target
    $packageFiles += [pscustomobject]@{ Folder = $folder; Relative = $relative; Source = $source.FullName; Target = $target }
  }
}

foreach ($file in $packageFiles) {
    $targetParent = Split-Path -Parent $file.Target

    if (Test-Path -LiteralPath $file.Target -PathType Leaf) {
      $sourceHash = Get-FileDigest $file.Source
      $targetHash = Get-FileDigest $file.Target
      if ($sourceHash -eq $targetHash) { $identical++; continue }

      if (-not $ReplaceExisting) {
        $conflicts++
        Write-Warning "Different existing file was left unchanged: $($file.Target) (use -ReplaceExisting to back it up and replace it)."
        continue
      }

      $backup = Join-Path $backupRoot (Join-Path $file.Folder $file.Relative)
      if ($PSCmdlet.ShouldProcess($file.Target, "Back up to '$backup' and replace with the package version")) {
        New-Item -ItemType Directory -Path (Split-Path -Parent $backup) -Force | Out-Null
        Copy-Item -LiteralPath $file.Target -Destination $backup
        New-Item -ItemType Directory -Path $targetParent -Force | Out-Null
        Copy-Item -LiteralPath $file.Source -Destination $file.Target -Force
        $copied++
      } else {
        $planned++
      }
      continue
    }

    if ($PSCmdlet.ShouldProcess($file.Target, 'Install package file')) {
      New-Item -ItemType Directory -Path $targetParent -Force | Out-Null
      Copy-Item -LiteralPath $file.Source -Destination $file.Target
      $copied++
    } else {
      $planned++
    }
}

Write-Host "Layout files copied: $copied; already identical: $identical; conflicts skipped: $conflicts; WhatIf actions: $planned."
Write-Host 'The Gentle Herdr bridge extension is not installed or enabled by this script; configure it separately if you use it.'

if ($Activate) {
  if ($conflicts -gt 0) {
    throw "Cannot activate the layout because $conflicts conflicting file(s) were skipped. Review them, then rerun with -ReplaceExisting if replacement is intended."
  }
  if ($PSCmdlet.ShouldProcess('Herdr', "Switch to layout 'javijec'")) {
    $herdrApp = Get-Command 'herdr-app' -ErrorAction SilentlyContinue
    if (-not $herdrApp) { throw 'herdr-app was not found on PATH; files were installed, but the layout was not activated.' }
    & $herdrApp.Source do layout.switch '{"name":"javijec"}'
    if ($LASTEXITCODE -ne 0) { throw "herdr-app could not switch to layout 'javijec' (exit $LASTEXITCODE)." }
  }
}
