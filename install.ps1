# Install Machines on official Herdr; Chat is retired and never installed by default.
param([string[]]$PiAgentHome,[switch]$SkipChatCleanup)
$ErrorActionPreference = 'Stop'
if (-not $SkipChatCleanup) { & (Join-Path $PSScriptRoot 'disable-chat.ps1') -PiAgentHome $PiAgentHome }
$appHome = if ($env:HERDR_APP_HOME) { $env:HERDR_APP_HOME } else { Join-Path $HOME '.config/herdr-app' }
$source = Join-Path $PSScriptRoot 'mods/jec-machines'
$destination = Join-Path $appHome 'mods/jec-machines'
if (Get-Command herdr-app -ErrorAction SilentlyContinue) {
  & herdr-app check $source
  if ($LASTEXITCODE -ne 0) { throw 'Machines no paso herdr-app check.' }
}
New-Item -ItemType Directory -Path $destination -Force | Out-Null
Copy-Item -Path (Join-Path $source '*') -Destination $destination -Recurse -Force
Write-Host "Instalado: $destination"
Write-Host 'Abri Ctrl+Shift+P y busca JEC Machines. Se mantiene el layout oficial main.'
