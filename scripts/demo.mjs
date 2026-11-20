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
  demoHistory(seed);
  fs.writeFileSync(path.join(dir, 'library.json'), JSON.stringify(seed, null, 2));
  console.log(`Estante de exemplo criada em ${dir}`);
}

// Histórico de leitura de exemplo para a aba Ritmo, com datas contadas a partir de hoje
// (assim o gráfico dos últimos 30 dias nunca aparece vazio no demo).
function demoHistory(lib) {
  const day = (back) => {
    const d = new Date();
    d.setDate(d.getDate() - back);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  let s = 7;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647; // pseudoaleatório fixo: o demo sai sempre igual
  const log = [];
  // Distribui as páginas lidas entre os dias [from..to] (contados para trás), pulando alguns dias.
  const spread = (b, from, to, total) => {
    const days = [];
    for (let k = from; k >= to; k--) if (rnd() < 0.7) days.push(k);
    if (!days.length) days.push(to);
    const w = days.map(() => 0.4 + rnd());
    const sum = w.reduce((a, c) => a + c, 0);
    let left = total;
    days.forEach((k, i) => {
      const amount = i === days.length - 1 ? left : Math.min(left, Math.round((total * w[i]) / sum));
      left -= amount;
      if (amount <= 0) return;
      const minutes = rnd() < 0.45 ? Math.round(amount * (1.6 + rnd())) : 0; // ~25–40 páginas por hora
      log.push({ id: `demo${log.length + 1}`, book: b.id, date: day(k), amount, unit: 'pag', ...(minutes ? { minutes } : {}) });
    });
  };
  const plan = [
    // título, começou há N dias, terminou há M dias (null = ainda lendo)
    ['Toda Poesia', 170, 104], ['Anatomia do Estado', 98, 91], ['Esquerda & Direita: Perspectivas para a liberdade', 84, 66],
    ['Como Ler Livros', 45, null], ['A abolição do homem', 12, null],
  ];
  for (const [title, start, end] of plan) {
    const b = lib.books.find((x) => x.title === title);
    if (!b) continue;
    b.startedAt = day(start);
    if (end != null) b.finishedAt = day(end);
    spread(b, start, end ?? 0, Number(b.progress?.current) || 0);
  }
  for (const b of lib.books) b.progress = { ...b.progress, mark: Number(b.progress?.current) || 0 };
  lib.log = log;
}

const child = spawn(process.execPath, [path.join(root, 'server.js')], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, DATA_DIR: dir, PORT: process.env.PORT || '4322' },
});
child.on('exit', (code) => process.exit(code ?? 0));
