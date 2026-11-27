# Retire legacy JEC mods; preserve stock mods, sessions and unrelated integrations.
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
# Herdr's JSON reply is authoritative: some Windows launchers leave a stale
# LASTEXITCODE or return a nonzero code even after a successful command.
$layoutOutput = & herdr-app do layout.switch --name main | Out-String
$layoutExit = $LASTEXITCODE
$layoutReply = $null
try { $layoutReply = $layoutOutput | ConvertFrom-Json -ErrorAction Stop } catch { }
if ($layoutReply -and ($layoutReply.ok -is [bool]) -and $layoutReply.ok -and -not $layoutReply.error) {
  Write-Host 'Layout oficial main activado.'
} else {
  throw "No se pudo activar main (exit=$layoutExit, respuesta=$layoutOutput). Abri Herdr y reintenta."
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js es necesario para retirar solo los hooks JEC de Codex. No se movieron los mods.' }
$scripts = @($appHomes | ForEach-Object { Join-Path $_ 'mods/jec-chat/providers/session-hook.cjs' })
& node (Join-Path $PSScriptRoot 'scripts/disable-chat-hooks.cjs') @scripts
if ($LASTEXITCODE -ne 0) { throw 'No se pudieron desactivar los hooks JEC; no se movieron los mods.' }
foreach ($root in $appHomes) {
  foreach ($name in @('jec-chat','jec-pane','jec-chat-native','jec-machines','jec-spaces','jec-agents')) { Backup-Jec (Join-Path $root "mods/$name") $name }
  foreach ($name in @('jec-chat.json','jec-chat-native.json','jec.json')) { Backup-Jec (Join-Path $root "layouts/$name") $name }
}
$ocConfig = if ($env:OPENCODE_CONFIG_DIR) { $env:OPENCODE_CONFIG_DIR } elseif ($env:XDG_CONFIG_HOME) { Join-Path $env:XDG_CONFIG_HOME 'opencode' } else { Join-Path $HOME '.config/opencode' }
Backup-Jec (Join-Path $ocConfig 'plugins/jec-chat-opencode') 'opencode-chat'
$homes = @($PiAgentHome)
$homes += $(if ($env:PI_CODING_AGENT_DIR) { $env:PI_CODING_AGENT_DIR } else { Join-Path $HOME '.pi/agent' })
$homes += $(if ($env:GENTLE_PI_AGENT_HOME) { $env:GENTLE_PI_AGENT_HOME } elseif ($env:GENTLE_SHELL_HOME) { $env:GENTLE_SHELL_HOME } else { Join-Path $HOME '.gentle-shell/agent' })
$homes += $env:GENTLE_SHELL_USER_PI_HOME
foreach ($agentHome in ($homes | Where-Object { $_ } | Select-Object -Unique)) { Backup-Jec (Join-Path $agentHome 'extensions/jec-chat.ts') 'pi-chat' }
Write-Host 'Mods JEC anteriores retirados. Herdr usa su layout oficial main. No se cerraron terminales ni se borraron sesiones.'
Write-Host 'Reinicia o recarga los agentes cuando terminen sus tareas; los plugins ya cargados pueden seguir en memoria hasta entonces.'
