# Install only the modified official Spaces and Agents mods and their derived layout.
$ErrorActionPreference = 'Stop'
$appHome = if ($env:HERDR_APP_HOME) { $env:HERDR_APP_HOME } else { Join-Path $HOME '.config/herdr-app' }
if (-not (Get-Command herdr-app -ErrorAction SilentlyContinue)) { throw 'herdr-app no esta en PATH.' }
$names = @('jec-spaces','jec-agents')
# Validate both before changing any installed files.
foreach ($name in $names) {
  $source = Join-Path $PSScriptRoot "mods/$name"
  $global:LASTEXITCODE = 0
  & herdr-app check $source
  if ($LASTEXITCODE -ne 0) { throw "$name no paso herdr-app check." }
}
foreach ($name in $names) {
  $source = Join-Path $PSScriptRoot "mods/$name"
  $destination = Join-Path $appHome "mods/$name"
  New-Item -ItemType Directory -Path $destination -Force | Out-Null
  Copy-Item -Path (Join-Path $source '*') -Destination $destination -Recurse -Force
  Write-Host "Instalado: $destination"
}
$layoutRoot = Join-Path $appHome 'layouts'
New-Item -ItemType Directory -Path $layoutRoot -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'layouts/jec.json') -Destination (Join-Path $layoutRoot 'jec.json') -Force
$output = & herdr-app do layout.switch --name jec | Out-String
$reply = $null
try { $reply = $output | ConvertFrom-Json -ErrorAction Stop } catch { }
if ($reply -and ($reply.ok -is [bool]) -and $reply.ok -and -not $reply.error) { Write-Host 'JEC Spaces y Agents instalados. Layout jec activo.' }
else { Write-Warning "Mod instalado; selecciona el layout jec en Herdr (Ctrl+Shift+L). Respuesta: $output" }
Write-Host 'Para volver al layout oficial: herdr-app do layout.switch --name main'
