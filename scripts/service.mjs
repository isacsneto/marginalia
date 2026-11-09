// npm run local:install | local:stop | local:uninstall
// Deixa o app rodando em segundo plano (sem janela) e publicado na sua rede Tailscale.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const action = process.argv[2] ?? 'install';
if (!['install', 'stop', 'uninstall'].includes(action)) {
  console.error('uso: node scripts/service.mjs install|stop|uninstall');
  process.exit(1);
}
if (process.platform !== 'win32') {
  console.error('Por enquanto o modo de segundo plano só existe para Windows. No macOS/Linux, rode "npm start" e "tailscale serve --bg --https=8443 http://127.0.0.1:4321".');
  process.exit(1);
}
const script = path.join(root, 'scripts', 'windows', action === 'install' ? 'install.ps1' : 'stop.ps1');
const run = spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, ...(action === 'uninstall' ? ['-Uninstall'] : [])], { stdio: 'inherit' });
process.exit(run.status ?? 1);
