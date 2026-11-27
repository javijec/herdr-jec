# Instala JEC Chat sin modificar el layout main ni los mods originales de Herdr.
# El layout personalizado jec-chat alterna Chat/Terminal en la misma area central.
param([switch]$SkipCodexHooks)
$ErrorActionPreference = 'Stop'
$modRoot = Join-Path $HOME '.config\herdr-app\mods'
$layoutRoot = Join-Path $HOME '.config\herdr-app\layouts'

foreach ($name in @('jec-chat', 'jec-pane')) {
  $source = Join-Path $PSScriptRoot "mods\$name"
  $destination = Join-Path $modRoot $name
  if (-not (Test-Path (Join-Path $source 'mod.json'))) {
    throw "No se encontro mod.json en $source"
  }
  New-Item -ItemType Directory -Path $destination -Force | Out-Null
  Copy-Item -Path (Join-Path $source '*') -Destination $destination -Recurse -Force
  Write-Host "Instalado: $destination"
}

New-Item -ItemType Directory -Path $layoutRoot -Force | Out-Null
$sourceLayout = Join-Path $PSScriptRoot 'layouts\jec-chat.json'
if (-not (Test-Path $sourceLayout)) { throw 'No se encontro layouts\jec-chat.json' }
$targetLayout = Join-Path $layoutRoot 'jec-chat.json'
Copy-Item -Path $sourceLayout -Destination $targetLayout -Force
Write-Host "Layout instalado: $targetLayout"

if (-not $SkipCodexHooks) {
  if (Get-Command node -ErrorAction SilentlyContinue) {
    $hookInstaller = Join-Path $modRoot 'jec-chat\providers\install-hooks.cjs'
    & node $hookInstaller
    if ($LASTEXITCODE -ne 0) {
      Write-Warning 'No se pudieron instalar los hooks de Codex. JEC Chat seguira usando el detector anterior.'
    }
  } else {
    Write-Warning 'Node.js no esta en PATH; no se instalaron los hooks de Codex.'
  }
}

if (Get-Command herdr-app -ErrorAction SilentlyContinue) {
  foreach ($name in @('jec-chat', 'jec-pane')) {
    & herdr-app check (Join-Path $modRoot $name)
    if ($LASTEXITCODE -ne 0) {
      Write-Warning "herdr-app check fallo para $name. No se cambio el layout."
      exit 1
    }
  }
  & herdr-app do layout.switch --name jec-chat
  if ($LASTEXITCODE -ne 0) {
    Write-Warning 'No se pudo activar el layout automaticamente. En Herdr ejecuta: herdr-app do layout.switch --name jec-chat'
  }
} else {
  Write-Warning 'herdr-app no esta en PATH. Abri Herdr y usa Ctrl+Shift+L para elegir jec-chat.'
}
Write-Host 'Listo. En la terminal de Codex, el boton Chat estara en su encabezado.'
