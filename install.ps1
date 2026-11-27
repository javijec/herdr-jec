# Instala JEC Chat sin modificar el layout main ni los mods originales de Herdr.
# El layout personalizado jec-chat alterna Chat/Terminal en la misma area central.
param([switch]$SkipCodexHooks, [switch]$SkipOpenCodePlugin, [switch]$SkipPiExtension, [string[]]$PiAgentHome)
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

if (-not $SkipOpenCodePlugin) {
  # OpenCode v2 discovers directory plugins with a tui.ts entry.
  $ocConfig = if ($env:OPENCODE_CONFIG_DIR) { $env:OPENCODE_CONFIG_DIR }
    elseif ($env:XDG_CONFIG_HOME) { Join-Path $env:XDG_CONFIG_HOME 'opencode' }
    else { Join-Path $HOME '.config\opencode' }
  $ocPlugin = Join-Path $ocConfig 'plugins\jec-chat-opencode'
  $ocSource = Join-Path $PSScriptRoot 'integrations\opencode\tui.ts'
  if (-not (Test-Path $ocSource)) { throw 'No se encontro el plugin JEC de OpenCode.' }
  New-Item -ItemType Directory -Path $ocPlugin -Force | Out-Null
  Copy-Item -LiteralPath $ocSource -Destination (Join-Path $ocPlugin 'tui.ts') -Force
  Write-Host "Plugin OpenCode v2 instalado: $ocPlugin"
  Write-Host 'Reinicia OpenCode desde Herdr y revisa /plugins si solicita habilitar JEC.'
}

if (-not $SkipPiExtension) {
  $piSource = Join-Path $PSScriptRoot 'integrations/pi/jec-chat.ts'
  if (-not (Test-Path $piSource)) { throw 'No se encontro la extension JEC de Pi.' }
  $piHomes = @()
  if ($PiAgentHome) { $piHomes += $PiAgentHome }
  else {
    $piHomes += $(if ($env:PI_CODING_AGENT_DIR) { $env:PI_CODING_AGENT_DIR } else { Join-Path $HOME '.pi/agent' })
    $gentleHome = if ($env:GENTLE_PI_AGENT_HOME) { $env:GENTLE_PI_AGENT_HOME }
      elseif ($env:GENTLE_SHELL_HOME) { $env:GENTLE_SHELL_HOME }
      else { Join-Path $HOME '.gentle-shell/agent' }
    if (Test-Path $gentleHome) { $piHomes += $gentleHome }
    if ($env:GENTLE_SHELL_USER_PI_HOME) { $piHomes += $env:GENTLE_SHELL_USER_PI_HOME }
  }
  foreach ($agentHome in ($piHomes | Where-Object { $_ } | Select-Object -Unique)) {
    $extensionDir = Join-Path $agentHome 'extensions'
    New-Item -ItemType Directory -Path $extensionDir -Force | Out-Null
    Copy-Item -LiteralPath $piSource -Destination (Join-Path $extensionDir 'jec-chat.ts') -Force
    Write-Host "Extension Pi/Gentle Shell instalada: $extensionDir"
  }
  Write-Host 'Reinicia Pi/Gentle Shell desde Herdr (o /reload).'
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
Write-Host 'Listo. En las terminales locales de Codex, OpenCode y Pi/Gentle Shell, el boton Chat estara en su encabezado.'
