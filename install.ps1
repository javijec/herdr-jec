# Copia solo el mod propio al home de Herdr Desktop. No altera el layout ni las teclas.
$ErrorActionPreference = 'Stop'
$source = Join-Path $PSScriptRoot 'mods\jec-chat'
$destination = Join-Path $HOME '.config\herdr-app\mods\jec-chat'
if (-not (Test-Path (Join-Path $source 'mod.json'))) { throw 'No se encontro mods\jec-chat\mod.json' }
New-Item -ItemType Directory -Path $destination -Force | Out-Null
Copy-Item -Path (Join-Path $source '*') -Destination $destination -Recurse -Force
Write-Host "JEC Chat instalado en: $destination"
if (Get-Command herdr-app -ErrorAction SilentlyContinue) {
  & herdr-app check $destination
} else {
  Write-Warning 'herdr-app no esta en PATH. Abri Herdr y ejecuta herdr-app check en la terminal donde este disponible.'
}
Write-Host 'En Herdr: Ctrl+Shift+P -> JEC Chat: ver conversacion de Codex'
