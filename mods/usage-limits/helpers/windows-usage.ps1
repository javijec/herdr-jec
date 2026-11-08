param([ValidateSet('claude','codex')][string]$Provider)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false
$override = if ($Provider -eq 'claude') { $env:HERDR_USAGE_CLAUDE_BIN } else { $env:HERDR_USAGE_CODEX_BIN }
$name = if ($override) { $override } else { $Provider }
$cmd = Get-Command $name -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $cmd) { exit 127 }
$arguments = if ($Provider -eq 'claude') { '-p --safe-mode --no-session-persistence --input-format stream-json --output-format stream-json --verbose' } else { 'app-server' }
$psi = New-Object System.Diagnostics.ProcessStartInfo
$ext = [IO.Path]::GetExtension($cmd.Source).ToLowerInvariant()
if ($ext -eq '.cmd' -or $ext -eq '.bat') { $psi.FileName = $env:ComSpec; $psi.Arguments = '/d /s /c ""' + $cmd.Source + '" ' + $arguments + '"' }
else { $psi.FileName = $cmd.Source; $psi.Arguments = $arguments }
$psi.UseShellExecute = $false
$psi.CreateNoWindow = $true
$psi.RedirectStandardInput = $true
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$process = New-Object System.Diagnostics.Process
$process.StartInfo = $psi
try {
  if (-not $process.Start()) { exit 1 }
  $stderr = $process.StandardError.ReadToEndAsync()
  if ($Provider -eq 'claude') { $process.StandardInput.WriteLine('{"type":"control_request","request_id":"herdr-usage-limits","request":{"subtype":"get_usage","skip_behaviors":true}}') }
  else { $process.StandardInput.WriteLine('{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"clientInfo":{"name":"herdr-usage-limits","version":"1.0"}}}') }
  $deadline = [DateTime]::UtcNow.AddSeconds(15)
  $task = $process.StandardOutput.ReadLineAsync()
  while ([DateTime]::UtcNow -lt $deadline) {
    if (-not $task.Wait(200)) { continue }
    $line = $task.Result
    if ($null -eq $line) { break }
    try {
      $msg = $line | ConvertFrom-Json
      if ($Provider -eq 'claude' -and $msg.type -eq 'control_response' -and $msg.response.request_id -eq 'herdr-usage-limits') { [Console]::WriteLine($line); exit 0 }
      if ($Provider -eq 'codex' -and $msg.id -eq 1) {
        if ($msg.error) { exit 1 }
        $process.StandardInput.WriteLine('{"jsonrpc":"2.0","method":"initialized"}')
        $process.StandardInput.WriteLine('{"jsonrpc":"2.0","id":2,"method":"account/rateLimits/read","params":{}}')
      }
      if ($Provider -eq 'codex' -and $msg.id -eq 2) { [Console]::WriteLine($line); exit 0 }
    } catch { }
    $task = $process.StandardOutput.ReadLineAsync()
  }
  exit 1
} catch { exit 1 }
finally {
  if ($process -and $process.Id -and -not $process.HasExited) {
    try {
      $killer = New-Object System.Diagnostics.Process
      $killer.StartInfo = New-Object System.Diagnostics.ProcessStartInfo
      $killer.StartInfo.FileName = (Get-Command taskkill.exe -CommandType Application -ErrorAction Stop).Source
      $killer.StartInfo.Arguments = "/PID $($process.Id) /T /F"
      $killer.StartInfo.UseShellExecute = $false
      $killer.StartInfo.CreateNoWindow = $true
      [void]$killer.Start()
      if (-not $killer.WaitForExit(3000)) { $killer.Kill(); [void]$killer.WaitForExit(1000) }
      $killer.Dispose()
    } catch { }
    if (-not $process.HasExited) { try { $process.Kill() } catch { } }
    [void]$process.WaitForExit(3000)
  }
  if ($process) { $process.Dispose() }
}
