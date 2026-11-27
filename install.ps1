# Experimental native installation. Keeps stable jec-chat/jec-pane and hooks untouched.
param([string]$HerdrApp = 'herdr-app', [switch]$Activate)
$ErrorActionPreference = 'Stop'
$commands = & $HerdrApp commands | Out-String
if ($LASTEXITCODE -ne 0 -or $commands -notmatch 'pane\.view') {
  throw 'Se requiere Herdr Desktop compilado con native/herdr-app-pane-view.patch. No se instalo nada.'
}
$source = Join-Path $PSScriptRoot 'mods/jec-chat'
& $HerdrApp check $source
if ($LASTEXITCODE -ne 0) { throw 'El mod no paso herdr-app check. No se instalo nada.' }
$appHome = if ($env:HERDR_APP_HOME) { $env:HERDR_APP_HOME } else { Join-Path $HOME '.config/herdr-app' }
$modRoot = Join-Path $appHome 'mods/jec-chat-native'
$layoutRoot = Join-Path $appHome 'layouts'
New-Item -ItemType Directory -Path $modRoot,$layoutRoot -Force | Out-Null
Copy-Item -Path (Join-Path $source '*') -Destination $modRoot -Recurse -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'layouts/jec-chat-native.json') -Destination (Join-Path $layoutRoot 'jec-chat-native.json') -Force
& $HerdrApp check $modRoot
if ($LASTEXITCODE -ne 0) { throw 'El mod instalado no paso la comprobacion. No se activo el layout.' }
Write-Host 'Instalado layout experimental jec-chat-native. Los mods estables no se modificaron.'
Write-Host 'Inicia la version parcheada de Herdr Desktop. Las integraciones de los agentes deben estar instaladas desde main.'
if ($Activate) {
  & $HerdrApp do layout.switch --name jec-chat-native
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo activar el layout experimental.' }
}
