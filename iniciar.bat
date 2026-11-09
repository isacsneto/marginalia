@echo off
cd /d "%~dp0"
rem Se o app ja esta rodando em segundo plano (npm run local:install), so abre o navegador.
curl -s -o nul --max-time 3 http://127.0.0.1:4321/api/providers && (
  start "" http://localhost:4321
  exit /b
)
if not exist node_modules (
  echo Instalando dependencias...
  call npm install --no-fund --no-audit
)
node server.js
pause
