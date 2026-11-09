// npm run demo — abre o app com uma estante de exemplo (porta 4322, dados em demo-data/),
// sem tocar nos seus dados. npm run demo:reset recria a estante de exemplo.
// As capas são buscadas sozinhas na primeira abertura.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'demo-data');
const reset = process.argv.includes('--reset');

if (reset) fs.rmSync(dir, { recursive: true, force: true });
if (!fs.existsSync(path.join(dir, 'library.json'))) {
  fs.mkdirSync(dir, { recursive: true });
  const seed = JSON.parse(fs.readFileSync(path.join(root, 'scripts', 'demo', 'library.json'), 'utf8'));
  fs.writeFileSync(path.join(dir, 'library.json'), JSON.stringify(seed, null, 2));
  console.log(`Estante de exemplo criada em ${dir}`);
}

const child = spawn(process.execPath, [path.join(root, 'server.js')], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, DATA_DIR: dir, PORT: process.env.PORT || '4322' },
});
child.on('exit', (code) => process.exit(code ?? 0));
