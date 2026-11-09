# Chamado pela tarefa "Marginalia" (via conhost --headless, sem janela). Mantém o servidor no ar
# até a tarefa ser parada ("npm run local:stop") ou você sair da conta: se ele cair, sobe de novo.
$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
Set-Location $root
$port = if ($env:PORT) { $env:PORT } else { "4321" }
$env:NO_OPEN = "1"
$logDir = Join-Path $root "data\logs"
New-Item -ItemType Directory -Force $logDir | Out-Null
$log = Join-Path $logDir "server.log"

function Test-Alive {
  try { Invoke-WebRequest "http://127.0.0.1:$port/api/providers" -UseBasicParsing -TimeoutSec 3 | Out-Null; return $true } catch { return $false }
}

while ($true) {
  # Já tem um Marginália nesta porta (ex.: aberto pelo iniciar.bat)? Fica de reserva.
  if (Test-Alive) { Start-Sleep -Seconds 15; continue }
  # Log simples com rotação (guarda um arquivo antigo de até 5 MB).
  if ((Test-Path $log) -and (Get-Item $log).Length -gt 5MB) { Move-Item $log "$log.1" -Force }
  Add-Content $log "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] iniciando servidor" -Encoding utf8
  # Via cmd: o redirecionamento do PowerShell 5.1 gravaria o log em UTF-16 misturado.
  & cmd.exe /d /c "node `"$root\server.js`" >> `"$log`" 2>&1"
  Add-Content $log "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] servidor parou (codigo $LASTEXITCODE); reiniciando em 10 s" -Encoding utf8
  Start-Sleep -Seconds 10
}
