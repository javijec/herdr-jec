# JEC v0.9: install selected extensions without changing stock mods.
param(
  [ValidateSet('spaces','agents','workspace-status','workspace-chrome')]
  [string[]]$Mods,
  [string]$ConfigPath
)
$ErrorActionPreference = 'Stop'
$appHome = if ($env:HERDR_APP_HOME) { $env:HERDR_APP_HOME } else { Join-Path $HOME '.config/herdr-app' }
if (-not (Get-Command herdr-app -ErrorAction SilentlyContinue)) { throw 'herdr-app no esta en PATH.' }
$profile = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'profile.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$settingsPath = Join-Path $appHome 'jec-settings.json'
$settings = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'config/jec-settings.default.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$inputPath = if ($ConfigPath) { $ConfigPath } else { $settingsPath }
if ($ConfigPath -and -not (Test-Path -LiteralPath $inputPath -PathType Leaf)) { throw "No existe: $inputPath" }
if (Test-Path -LiteralPath $inputPath -PathType Leaf) {
  $user = Get-Content -LiteralPath $inputPath -Raw -Encoding UTF8 | ConvertFrom-Json
  if ($null -eq $user -or $user -isnot [pscustomobject]) { throw 'Configuracion JEC invalida: se espera un objeto JSON.' }
  foreach ($section in $user.PSObject.Properties) {
    if ($section.Name -notin @('mods','status','agents','chrome')) { throw "Opcion desconocida: $($section.Name)" }
    if ($section.Name -eq 'mods') {
      if ($section.Value -isnot [array] -or $section.Value.Count -eq 0) { throw 'mods debe ser una lista no vacia.' }
      foreach ($name in $section.Value) {
        if ($name -isnot [string] -or $name -notin $profile.mods.name) { throw "Mod desconocido: $name" }
      }
      $settings.mods = @($section.Value | Select-Object -Unique)
      continue
    }
    if ($section.Value -isnot [pscustomobject]) { throw "$($section.Name) debe ser un objeto JSON." }
    $target = $settings.($section.Name)
    foreach ($option in $section.Value.PSObject.Properties) {
      if ($null -eq $target.PSObject.Properties[$option.Name]) { throw "Opcion desconocida: $($section.Name).$($option.Name)" }
      $value = $option.Value
      if ($option.Name -eq 'refreshSeconds') {
        if (($value -isnot [int] -and $value -isnot [long]) -or $value -lt 15 -or $value -gt 300) { throw 'refreshSeconds debe ser un entero entre 15 y 300.' }
      } elseif ($value -isnot [bool]) { throw "$($section.Name).$($option.Name) debe ser true o false." }
      $target.($option.Name) = $value
    }
  }
}
if ($PSBoundParameters.ContainsKey('Mods')) { $settings.mods = @($Mods | Select-Object -Unique) }
$Mods = @($settings.mods)
$selected = @($profile.mods | Where-Object { $_.name -in $Mods })
if ($selected.Count -eq 0) { throw 'Selecciona al menos un mod; para volver a Herdr oficial usa restore-official.ps1.' }
$layout = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'layouts/jec.json') -Raw -Encoding UTF8 | ConvertFrom-Json
function Find-Block($node,[string]$id) {
  if ($node.id -eq $id) { return $node }
  foreach ($child in $node.children) {
    $found = Find-Block $child $id
    if ($null -ne $found) { return $found }
  }
}
foreach ($entry in $profile.mods) {
  foreach ($id in $entry.blocks) {
    $block = Find-Block $layout $id
    if ($null -eq $block -or $block.content.mod -ne $entry.id) { throw "Layout incompatible: $id" }
    if ($entry.name -notin $Mods) {
      $block.content.mod = $entry.name
      if ($id -eq 'sidebar-footer') { $block.size.px -= $entry.footerExtra }
    } else {
      $options = switch ($entry.name) {
        'agents' { $settings.agents }
        'workspace-status' { $settings.status }
        'workspace-chrome' { $settings.chrome }
      }
      if ($null -ne $options) {
        if ($null -eq $block.content.props) { $block.content | Add-Member -MemberType NoteProperty -Name props -Value ([pscustomobject]@{}) }
        $block.content.props | Add-Member -MemberType NoteProperty -Name jec -Value $options -Force
      }
      if ($id -eq 'sidebar-footer' -and -not $settings.chrome.machines) { $block.size.px -= $entry.footerExtra }
    }
  }
}
function Switch-Layout([string]$name) {
  $output = & herdr-app do layout.switch --name $name | Out-String
  $reply = $null
  try { $reply = $output | ConvertFrom-Json -ErrorAction Stop } catch {}
  if (-not ($reply -and ($reply.ok -is [bool]) -and $reply.ok -and -not $reply.error)) { throw "No se pudo activar $name. Respuesta: $output" }
}
Write-Host "JEC $($profile.version) | Base: $($profile.upstream)"
# Validate every selected mod before touching the installed layout.
foreach ($entry in $selected) {
  $source = Join-Path $PSScriptRoot "mods/$($entry.id)"
  $global:LASTEXITCODE = 0
  & herdr-app check $source
  if ($LASTEXITCODE -ne 0) { throw "$($entry.id) no paso herdr-app check. No se modifico la instalacion." }
}
$backupRoot = Join-Path $appHome ('jec-backups/install-' + [guid]::NewGuid().ToString('N'))
$layoutPath = Join-Path $appHome 'layouts/jec.json'
$targets = @($selected | ForEach-Object { "mods/$($_.id)" }) + @('layouts/jec.json','jec-settings.json')
# Do not overwrite files while the JEC layout is active.
Switch-Layout 'main'
New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
$existing = @()
foreach ($relative in $targets) {
  $target = Join-Path $appHome $relative
  if (Test-Path -LiteralPath $target) {
    $backup = Join-Path $backupRoot $relative
    New-Item -ItemType Directory -Path (Split-Path -Parent $backup) -Force | Out-Null
    Copy-Item -LiteralPath $target -Destination $backup -Recurse -Force
    $existing += $relative
  }
}
try {
  foreach ($entry in $selected) {
    $source = Join-Path $PSScriptRoot "mods/$($entry.id)"
    $destination = Join-Path $appHome "mods/$($entry.id)"
    New-Item -ItemType Directory -Path $destination -Force | Out-Null
    Copy-Item -Path (Join-Path $source '*') -Destination $destination -Recurse -Force
    Write-Host "Instalado: $destination"
  }
  New-Item -ItemType Directory -Path (Split-Path -Parent $layoutPath) -Force | Out-Null
  # UTF-8 without BOM (also on Windows PowerShell 5.1).
  [IO.File]::WriteAllText($layoutPath, ($layout | ConvertTo-Json -Depth 80), (New-Object System.Text.UTF8Encoding($false)))
  [IO.File]::WriteAllText($settingsPath, ($settings | ConvertTo-Json -Depth 20), (New-Object System.Text.UTF8Encoding($false)))
  Switch-Layout 'jec'
} catch {
  $failure = $_
  try { Switch-Layout 'main' } catch { Write-Warning "No se pudo confirmar main. Respaldos en $backupRoot. No se tocaran mas archivos."; throw $failure }
  foreach ($relative in $targets) {
    $target = Join-Path $appHome $relative
    if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Recurse -Force }
    if ($relative -in $existing) { Copy-Item -LiteralPath (Join-Path $backupRoot $relative) -Destination $target -Recurse -Force }
  }
  throw "Instalacion revertida; layout main activo. Respaldo: $backupRoot. Error: $failure"
}
Write-Host "JEC $($profile.version) activo: $($selected.name -join ', ')"
Write-Host "Respaldo: $backupRoot"
Write-Host "Configuracion: $settingsPath"
Write-Host 'Volver al original: herdr-app do layout.switch --name main'
