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

function Merge-JsonSettings($Older, $Newer) {
  $merged = [ordered]@{}
  if ($Older) {
    foreach ($property in $Older.PSObject.Properties) { $merged[$property.Name] = $property.Value }
  }
  if ($Newer) {
    foreach ($property in $Newer.PSObject.Properties) {
      $previous = $merged[$property.Name]
      $oldObject = $previous -is [pscustomobject]
      $newObject = $property.Value -is [pscustomobject]
      if ($oldObject -and $newObject) {
        $merged[$property.Name] = Merge-JsonSettings $previous $property.Value
      } else {
        $merged[$property.Name] = $property.Value
      }
    }
  }
  return [pscustomobject]$merged
}

# Move renamed mods out of the active namespace only after the new copy has been installed.
$legacyMods = @{
  'better-changes' = 'jec-changes'
  'better-files' = 'jec-files'
  'better-tabs' = 'jec-tabs'
  'my-better-sidebar' = 'jec-sidebar'
  'branch-pr' = 'jec-branch-pr'
  'branch-issue' = 'jec-branch-issue'
  'usage-limits' = 'jec-usage-limits'
  'my-machine-vitals' = 'jec-sidebar'
}
foreach ($legacyName in $legacyMods.Keys) {
  $legacyFolder = Join-Path (Join-Path $appHome 'mods') $legacyName
  if (-not (Test-Path -LiteralPath $legacyFolder -PathType Container)) { continue }
  $newFolder = Join-Path (Join-Path $appHome 'mods') $legacyMods[$legacyName]
  if (-not (Test-Path -LiteralPath $newFolder -PathType Container)) {
    Write-Warning "Legacy mod '$legacyName' was left in place because '$($legacyMods[$legacyName])' is not installed."
    continue
  }
  Assert-NoReparsePointInPath $legacyFolder
  Assert-NoReparsePointInPath $newFolder
  $legacyModJson = Join-Path $legacyFolder 'mod.json'
  $newModJson = Join-Path $newFolder 'mod.json'
  $archive = Join-Path (Join-Path $backupRoot 'mods') $legacyName
  if (Test-Path -LiteralPath $archive) {
    Write-Warning "Legacy mod '$legacyName' was left in place because its backup already exists: $archive"
    continue
  }
  if ($legacyName -ne 'my-machine-vitals' -and (Test-Path -LiteralPath $legacyModJson -PathType Leaf) -and (Test-Path -LiteralPath $newModJson -PathType Leaf)) {
    $legacyDocument = Get-Content -LiteralPath $legacyModJson -Raw | ConvertFrom-Json
    $newDocument = Get-Content -LiteralPath $newModJson -Raw | ConvertFrom-Json
    if ($legacyDocument.settings) {
      $newSettings = Merge-JsonSettings $legacyDocument.settings $newDocument.settings
      $newDocument.settings = $newSettings
      if ($PSCmdlet.ShouldProcess($newModJson, "Migrate settings from '$legacyName' and archive its old mod folder")) {
        New-Item -ItemType Directory -Path (Split-Path -Parent $archive) -Force | Out-Null
        $newConfigBackup = Join-Path $backupRoot (Join-Path 'new-mods' (Join-Path $legacyMods[$legacyName] 'mod.json'))
        New-Item -ItemType Directory -Path (Split-Path -Parent $newConfigBackup) -Force | Out-Null
        Copy-Item -LiteralPath $newModJson -Destination $newConfigBackup
        $temp = $newModJson + '.migration-tmp'
        [IO.File]::WriteAllText($temp, ($newDocument | ConvertTo-Json -Depth 100) + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
        Move-Item -LiteralPath $temp -Destination $newModJson -Force
        Move-Item -LiteralPath $legacyFolder -Destination $archive
      }
    } elseif ($PSCmdlet.ShouldProcess($legacyFolder, "Archive renamed legacy mod folder")) {
      New-Item -ItemType Directory -Path (Split-Path -Parent $archive) -Force | Out-Null
      Move-Item -LiteralPath $legacyFolder -Destination $archive
    }
  } elseif ($legacyName -ne 'my-machine-vitals' -and (Test-Path -LiteralPath $legacyModJson -PathType Leaf) -and -not (Test-Path -LiteralPath $newModJson -PathType Leaf)) {
    Write-Warning "Legacy mod '$legacyName' was left in place because its new mod.json is unavailable."
    continue
  } elseif ($PSCmdlet.ShouldProcess($legacyFolder, "Archive renamed legacy mod folder")) {
    New-Item -ItemType Directory -Path (Split-Path -Parent $archive) -Force | Out-Null
    Move-Item -LiteralPath $legacyFolder -Destination $archive
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
