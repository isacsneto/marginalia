# npm run local:install — deixa o Marginália rodando sozinho neste PC (Windows), sem janela aberta.
#  1. Cria a tarefa "Marginalia" no Agendador: sobe o app (oculto) sempre que você faz login.
#  2. Se o Tailscale estiver instalado, publica o app SÓ na sua rede Tailscale (tailscale serve),
#     com HTTPS, para abrir no celular e nos outros aparelhos. Nada fica exposto na internet.
$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$port = if ($env:PORT) { $env:PORT } else { "4321" }
$tsPort = if ($env:TS_PORT) { $env:TS_PORT } else { "8443" }
$taskName = "Marginalia"
Get-Command node -ErrorAction Stop | Out-Null

Write-Host "Pasta do app: $root"
if (-not (Test-Path (Join-Path $root "node_modules"))) {
  Write-Host "Instalando dependencias..."
  Push-Location $root; & npm install --no-fund --no-audit; Pop-Location
}

# --- tarefa no login (roda como você, para usar o login local do Claude/Codex) ---
# conhost --headless: sem janela nenhuma. Com o Windows Terminal como terminal padrão (Windows 11),
# "-WindowStyle Hidden" é ignorado e a janela aparece; fechá-la derrubaria o app.
$action = New-ScheduledTaskAction -Execute "conhost.exe" `
  -Argument "--headless powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$root\scripts\windows\run-hidden.ps1`"" `
  -WorkingDirectory $root
$trigger = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
  -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -MultipleInstances IgnoreNew
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal `
  -Description "Marginalia em http://127.0.0.1:$port (node $root\server.js)" -Force | Out-Null
Write-Host "Tarefa '$taskName' criada: o app sobe sozinho quando voce faz login."

Start-ScheduledTask -TaskName $taskName
$ok = $false
for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep -Seconds 1
  try { Invoke-WebRequest "http://127.0.0.1:$port/api/providers" -UseBasicParsing -TimeoutSec 3 | Out-Null; $ok = $true; break } catch { }
}
if ($ok) { Write-Host "App no ar: http://localhost:$port" } else { Write-Warning "O app ainda nao respondeu. Veja data\logs\server.log" }

# --- acesso pelos seus outros aparelhos via Tailscale ---
if (-not (Get-Command tailscale -ErrorAction SilentlyContinue)) {
  Write-Host "Tailscale nao encontrado. Para abrir no celular, instale em https://tailscale.com/download e rode este comando de novo."
  exit 0
}
& tailscale serve --bg --https=$tsPort "http://127.0.0.1:$port"
if ($LASTEXITCODE -ne 0) {
  Write-Warning "O 'tailscale serve' nao foi configurado. Se ele pediu para habilitar HTTPS na sua rede, abra o link acima, habilite e rode 'npm run local:install' de novo."
  exit 0
}
$dns = ((& tailscale status --json) | ConvertFrom-Json).Self.DNSName.TrimEnd(".")
Write-Host ""
Write-Host "Pronto! Nos seus aparelhos com Tailscale: https://${dns}:$tsPort"
Write-Host "(so a sua rede Tailscale enxerga esse endereco)"
