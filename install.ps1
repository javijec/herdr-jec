# Restore official Herdr; no JEC mods are currently installed by this repository.
param([string[]]$PiAgentHome)
$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'restore-official.ps1') -PiAgentHome $PiAgentHome
