# npm run local:stop — para o app rodando em segundo plano (a tarefa volta a subir no próximo login).
# npm run local:uninstall — também remove a tarefa e o "tailscale serve".
param([switch]$Uninstall)
$port = if ($env:PORT) { $env:PORT } else { "4321" }
$tsPort = if ($env:TS_PORT) { $env:TS_PORT } else { "8443" }
$taskName = "Marginalia"

Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
# O laço do run-hidden.ps1 religaria o servidor: encerra o que tenha sobrado da tarefa.
Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe' OR Name = 'conhost.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -like "*run-hidden.ps1*" } |
  ForEach-Object { & taskkill /PID $_.ProcessId /T /F *> $null }
# Servidor que tenha sobrado na porta (só se for o node deste app).
Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
  $p = Get-CimInstance Win32_Process -Filter "ProcessId = $($_.OwningProcess)"
  if ($p -and $p.Name -eq "node.exe" -and $p.CommandLine -like "*server.js*") { & taskkill /PID $p.ProcessId /T /F *> $null }
}
Write-Host "Marginalia parado."

if ($Uninstall) {
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
  if (Get-Command tailscale -ErrorAction SilentlyContinue) { & tailscale serve --https=$tsPort off *> $null }
  Write-Host "Tarefa '$taskName' e 'tailscale serve' (porta $tsPort) removidos."
}
