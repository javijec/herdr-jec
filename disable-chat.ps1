# Deactivate only JEC Chat; preserve stock mods, sessions and unrelated agent integrations.
param([string[]]$PiAgentHome)
$ErrorActionPreference = 'Stop'
$appHome = if ($env:HERDR_APP_HOME) { $env:HERDR_APP_HOME } else { Join-Path $HOME '.config/herdr-app' }
$defaultHome = Join-Path $HOME '.config/herdr-app'
$appHomes = @($appHome,$defaultHome) | Select-Object -Unique
$backupRoot = Join-Path $appHome ('jec-backups/chat-disabled-' + [guid]::NewGuid().ToString('N'))
function Backup-Jec([string]$Source,[string]$Name) {
  if (-not (Test-Path -LiteralPath $Source)) { return }
  New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
  $dest = Join-Path $backupRoot ($Name + '-' + [guid]::NewGuid().ToString('N'))
  Move-Item -LiteralPath $Source -Destination $dest
  Write-Host "Desactivado: $Source (respaldo: $dest)"
}
if (-not (Get-Command herdr-app -ErrorAction SilentlyContinue)) { throw 'herdr-app no esta en PATH. No se desactivo nada.' }
& herdr-app do layout.switch --name main
if ($LASTEXITCODE -ne 0) { throw 'Abri Herdr y selecciona el layout oficial main antes de reintentar.' }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js es necesario para retirar solo los hooks JEC de Codex. No se movieron los mods.' }
$scripts = @($appHomes | ForEach-Object { Join-Path $_ 'mods/jec-chat/providers/session-hook.cjs' })
& node (Join-Path $PSScriptRoot 'scripts/disable-chat-hooks.cjs') @scripts
if ($LASTEXITCODE -ne 0) { throw 'No se pudieron desactivar los hooks JEC; no se movieron los mods.' }
foreach ($root in $appHomes) {
  foreach ($name in @('jec-chat','jec-pane','jec-chat-native')) { Backup-Jec (Join-Path $root "mods/$name") $name }
  foreach ($name in @('jec-chat.json','jec-chat-native.json')) { Backup-Jec (Join-Path $root "layouts/$name") $name }
}
$ocConfig = if ($env:OPENCODE_CONFIG_DIR) { $env:OPENCODE_CONFIG_DIR } elseif ($env:XDG_CONFIG_HOME) { Join-Path $env:XDG_CONFIG_HOME 'opencode' } else { Join-Path $HOME '.config/opencode' }
Backup-Jec (Join-Path $ocConfig 'plugins/jec-chat-opencode') 'opencode-chat'
$homes = @($PiAgentHome)
$homes += $(if ($env:PI_CODING_AGENT_DIR) { $env:PI_CODING_AGENT_DIR } else { Join-Path $HOME '.pi/agent' })
$homes += $(if ($env:GENTLE_PI_AGENT_HOME) { $env:GENTLE_PI_AGENT_HOME } elseif ($env:GENTLE_SHELL_HOME) { $env:GENTLE_SHELL_HOME } else { Join-Path $HOME '.gentle-shell/agent' })
$homes += $env:GENTLE_SHELL_USER_PI_HOME
foreach ($agentHome in ($homes | Where-Object { $_ } | Select-Object -Unique)) { Backup-Jec (Join-Path $agentHome 'extensions/jec-chat.ts') 'pi-chat' }
Write-Host 'JEC Chat desactivado. No se cerraron terminales ni se borraron sesiones.'
Write-Host 'Reinicia o recarga los agentes cuando terminen sus tareas; los plugins ya cargados pueden seguir en memoria hasta entonces.'
