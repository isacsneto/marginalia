// Marginália: servidor local sem framework. Serve a interface e uma API JSON
// pequena; os dados ficam em ./data (library.json e settings.json).
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';
import { detectProviders, runAI, DEFAULT_MODELS } from './lib/ai.js';
import * as prompts from './lib/prompts.js';
import { parseMarkdownLibrary } from './lib/importer.js';
import { refreshReference, loadReference, referenceStatus, referenceContext, bookReferences, buildReferencePlan, REFERENCE } from './lib/reference.js';
import { autoCover, coverCandidates, coverFromUrl, coverFromUpload, removeCover, coversDir } from './lib/covers.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, 'public');
// DATA_DIR aponta para outra pasta de dados (é assim que o demo roda sem tocar nos seus).
const DATA = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, 'data');
const LIBRARY_FILE = path.join(DATA, 'library.json');
const SETTINGS_FILE = path.join(DATA, 'settings.json');
const COVERS = coversDir(DATA);
const PORT = Number(process.env.PORT) || 4321;
const HOST = '127.0.0.1';

const EMPTY_LIBRARY = { version: 1, books: [], plans: {}, suggestionSets: {}, planMode: 'ref' };
const DEFAULT_SETTINGS = {
  provider: 'auto', cliModel: '', anthropicKey: '', anthropicModel: DEFAULT_MODELS['anthropic-api'],
  openaiKey: '', openaiModel: DEFAULT_MODELS['openai-api'], minutesPerDay: 45, goal: '',
  importPath: '',
  // Usa as listas do Contra os Acadêmicos (contraosacademicos.com.br/lista) como referência
  // de ordem e níveis no plano e nas sugestões.
  referenceLists: true,
};

// ---------------------------------------------------------------- arquivos
async function readJSON(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return structuredClone(fallback); }
}
async function pruneBackups(base, keep = 7) {
  const names = (await fs.readdir(DATA)).filter((n) => n.startsWith(`${base}.`) && n.endsWith('.bak.json')).sort();
  await Promise.all(names.slice(0, -keep).map((n) => fs.rm(path.join(DATA, n), { force: true })));
}

// Fila única para ler-modificar-gravar: duas requisições nunca se intercalam no disco.
let queue = Promise.resolve();
function serial(fn) {
  const job = queue.then(fn);
  queue = job.catch(() => {});
  return job;
}
const localDate = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// Gravação atômica (arquivo temporário + rename). Chamar sempre dentro de serial().
async function writeJSON(file, value) {
  await fs.mkdir(DATA, { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(value, null, 2), 'utf8');
  // Backup diário (um arquivo por dia, criado na primeira gravação do dia).
  const daily = file.replace(/\.json$/, `.${localDate()}.bak.json`);
  const created = await fs.copyFile(file, daily, fs.constants.COPYFILE_EXCL).then(() => true, () => false);
  await fs.rename(tmp, file);
  if (created) await pruneBackups(path.basename(file, '.json'));
}
const loadSettings = async () => ({ ...DEFAULT_SETTINGS, ...(await readJSON(SETTINGS_FILE, {})) });

function publicSettings(s) {
  const hint = (k) => (k ? `${k.slice(0, 7)}…${k.slice(-4)}` : '');
  const { anthropicKey, openaiKey, ...rest } = s;
  return {
    ...rest,
    anthropicKeyHint: hint(anthropicKey) || (process.env.ANTHROPIC_API_KEY ? 'variável de ambiente' : ''),
    openaiKeyHint: hint(openaiKey) || (process.env.OPENAI_API_KEY ? 'variável de ambiente' : ''),
  };
}

// ---------------------------------------------------------------- HTTP util
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json','.ico': 'image/x-icon', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' };

function send(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(json);
}
async function body(req) {
  // Junta os Buffers antes de decodificar: decodificar pedaço a pedaço quebra
  // caracteres multibyte (ã, é…) divididos entre dois chunks.
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 20_000_000) throw Object.assign(new Error('Corpo grande demais'), { status: 413 });
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  try { return raw ? JSON.parse(raw) : {}; } catch {
    throw Object.assign(new Error('JSON inválido'), { status: 400 });
  }
}
async function serveStatic(req, res) {
  const url = new URL(req.url, 'http://x');
  const decoded = decodeURIComponent(url.pathname);
  // /covers/* vem de data/covers (capas baixadas); o resto, de public/.
  const isCover = decoded.startsWith('/covers/');
  const root = isCover ? COVERS : PUBLIC;
  const rel = url.pathname === '/' ? 'index.html' : (isCover ? decoded.slice('/covers/'.length) : decoded).replace(/^\/+/, '');
  const file = path.normalize(path.join(root, rel));
  if (!file.startsWith(root + path.sep)) return send(res, 403, { error: 'proibido' });
  try {
    const data = await fs.readFile(file);
    // Capas têm ?v= na URL quando mudam, então podem ficar em cache.
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': isCover ? 'max-age=31536000, immutable' : 'no-cache' });
    res.end(data);
  } catch {
    send(res, 404, { error: 'não encontrado' });
  }
}

// ---------------------------------------------------------------- rotas
const slim = (b) => ({
  id: b.id, title: b.title, author: b.author, format: b.format, status: b.status, ownership: b.ownership, rating: b.rating, userPhase: b.userPhase, ai: b.ai,
  readings: Array.isArray(b.readings) ? b.readings.length : 0, reread: !!b.reread,
});

// Contexto das listas de referência para um prompt (null se desligado ou indisponível).
// Atualiza o cache se tiver mais de 30 dias; sem rede, usa o que já foi baixado.
// As listas baixadas (renova se tiverem mais de 30 dias; sem rede, usa o cache). No modo "ref" elas são
// obrigatórias: sem elas o resultado seria um plano da IA no lugar errado.
async function referenceRequired(settings) {
  if (!settings.referenceLists) throw Object.assign(new Error('As listas de referência estão desligadas nos Ajustes.'), { status: 400 });
  const ref = await refreshReference(DATA).catch(() => loadReference(DATA));
  if (!ref) throw Object.assign(new Error('Não consegui carregar as listas do Contra os Acadêmicos. Verifique a internet e use “Atualizar listas” nos Ajustes.'), { status: 503 });
  return ref;
}

const routes = {
  'GET /api/state': async () => {
    const settings = await loadSettings();
    return {
      library: await readJSON(LIBRARY_FILE, EMPTY_LIBRARY),
      settings: publicSettings(settings),
      providers: await detectProviders(settings),
    };
  },

  'PUT /api/library': async (req) => {
    const lib = await body(req);
    if (!Array.isArray(lib.books)) throw Object.assign(new Error('Formato inválido'), { status: 400 });
    return serial(async () => {
      // Controle de versão: o cliente envia o savedAt que conhece. Se outra aba gravou
      // depois disso, recusa para não sobrescrever dados mais novos com uma cópia antiga.
      const current = await readJSON(LIBRARY_FILE, EMPTY_LIBRARY);
      if (current.savedAt && lib.savedAt !== current.savedAt) {
        throw Object.assign(new Error('A estante foi alterada em outra aba.'), { status: 409 });
      }
      const savedAt = new Date().toISOString();
      await writeJSON(LIBRARY_FILE, { ...EMPTY_LIBRARY, ...lib, savedAt });
      return { ok: true, savedAt };
    });
  },

  'PUT /api/settings': async (req) => {
    const patch = await body(req);
    const next = await serial(async () => {
      const current = await loadSettings();
      const merged = { ...current };
      for (const k of Object.keys(DEFAULT_SETTINGS)) if (k in patch) merged[k] = patch[k];
      // Campos de chave vazios não apagam a chave salva; use clearXKey para remover.
      if (!patch.anthropicKey) merged.anthropicKey = patch.clearAnthropicKey ? '' : current.anthropicKey;
      if (!patch.openaiKey) merged.openaiKey = patch.clearOpenaiKey ? '' : current.openaiKey;
      merged.minutesPerDay = Math.max(5, Math.min(600, Number(merged.minutesPerDay) || 45));
      merged.referenceLists = merged.referenceLists !== false && merged.referenceLists !== 'false';
      await writeJSON(SETTINGS_FILE, merged);
      return merged;
    });
    return { settings: publicSettings(next), providers: await detectProviders(next, { fresh: true }) };
  },

  'GET /api/providers': async () => detectProviders(await loadSettings(), { fresh: true }),

  'POST /api/ai/test': async (req) => {
    // Aceita valores ainda não salvos do formulário (campos vazios mantêm o que está gravado).
    const typed = await body(req);
    const settings = await loadSettings();
    for (const k of ['provider', 'anthropicKey', 'anthropicModel', 'openaiKey', 'openaiModel', 'cliModel']) {
      if (typeof typed[k] === 'string' && typed[k].trim()) settings[k] = typed[k].trim();
    }
    const t0 = Date.now();
    const { data, provider } = await runAI({ system: prompts.SYSTEM, prompt: 'Teste de conexão. Devolva {"ok": true, "msg": "uma saudação curta de bibliotecário"}', effort: 'low' }, settings);
    return { ...data, provider, ms: Date.now() - t0 };
  },

  'POST /api/ai/classify': async (req) => {
    const { books, library } = await body(req);
    const { data, provider } = await runAI({ system: prompts.SYSTEM, prompt: prompts.classify(books, library || books), effort: 'low' }, await loadSettings());
    return { results: Array.isArray(data.books) ? data.books : [], provider };
  },

  'POST /api/ai/plan': async (req) => {
    // mode "ref": segue as listas de referência; "ia": critério próprio da IA.
    // No modo "ref" a ordem vem direto da estrutura do site (sem IA), para não divergir dele.
    const { books, mode } = await body(req);
    const settings = await loadSettings();
    if (mode !== 'ia') return { plan: buildReferencePlan(await referenceRequired(settings), books, settings) };
    const { data, provider } = await runAI({ system: prompts.SYSTEM, prompt: prompts.plan(books.map(slim), settings), effort: 'medium' }, settings);
    return { plan: { ...data, provider, generatedAt: new Date().toISOString(), source: 'ia', mode: 'ia', reference: '' } };
  },

  'POST /api/ai/suggest': async (req) => {
    const { books, mode } = await body(req);
    const settings = await loadSettings();
    const ref = mode === 'ia' ? null : referenceContext(await referenceRequired(settings), books, { candidates: 40 });
    const { data, provider } = await runAI({ system: prompts.SYSTEM, prompt: prompts.suggest(books.map(slim), ref), effort: 'medium' }, settings);
    return { suggestions: { ...data, provider, generatedAt: new Date().toISOString(), mode: ref ? 'ref' : 'ia', reference: ref ? REFERENCE.name : '' } };
  },

  // Listas de referência: estado, atualização manual e onde cada livro da estante aparece.
  'GET /api/reference': async () => referenceStatus(DATA),
  'POST /api/reference/refresh': async () => {
    try { await refreshReference(DATA, { force: true }); } catch (e) { throw Object.assign(e, { status: 502 }); }
    return referenceStatus(DATA);
  },
  'POST /api/reference/match': async (req) => {
    const { books } = await body(req);
    if (!(await loadSettings()).referenceLists) return { matches: {} };
    return { matches: bookReferences(await loadReference(DATA), Array.isArray(books) ? books : []) };
  },

  'POST /api/ai/guide': async (req) => {
    const { book, library } = await body(req);
    const { data, provider } = await runAI({ system: prompts.SYSTEM, prompt: prompts.guide(book, library || []), effort: 'medium' }, await loadSettings());
    return { guide: { ...data, provider, generatedAt: new Date().toISOString() } };
  },

  // Adicionar por conversa: o leitor descreve o livro; se houver ambiguidade, a IA pergunta.
  'POST /api/ai/identify': async (req) => {
    const { messages, library } = await body(req);
    const turns = (Array.isArray(messages) ? messages : [])
      .filter((m) => m && (m.role === 'user' || m.role === 'ai') && typeof m.text === 'string' && m.text.trim())
      .slice(-12).map((m) => ({ role: m.role, text: m.text.slice(0, 2000) }));
    if (!turns.length || turns.at(-1).role !== 'user') throw Object.assign(new Error('Descreva o livro primeiro.'), { status: 400 });
    const { data, provider } = await runAI({ system: prompts.SYSTEM, prompt: prompts.identify(turns, Array.isArray(library) ? library : []), effort: 'low' }, await loadSettings());
    const asking = data.status === 'pergunta' && typeof data.message === 'string' && data.message.trim();
    return {
      status: asking ? 'pergunta' : 'pronto',
      message: typeof data.message === 'string' ? data.message : '',
      options: Array.isArray(data.options) ? data.options.filter((o) => typeof o === 'string' && o.trim()).slice(0, 6) : [],
      books: asking ? [] : (Array.isArray(data.books) ? data.books : []).filter((b) => b && typeof b.title === 'string' && b.title.trim()),
      provider,
    };
  },

  'POST /api/ai/extract': async (req) => {
    const { text } = await body(req);
    const { data } = await runAI({ system: prompts.SYSTEM, prompt: prompts.extract(text || ''), effort: 'low' }, await loadSettings());
    return { books: Array.isArray(data.books) ? data.books : [], phases: [] };
  },

  'POST /api/import/parse': async (req) => {
    const { text, path: file } = await body(req);
    let md = text;
    if (!md && file) {
      try { md = await fs.readFile(file, 'utf8'); } catch (e) {
        throw Object.assign(new Error(`Não consegui ler ${file}: ${e.code || e.message}`), { status: 400 });
      }
    }
    return parseMarkdownLibrary(md || '');
  },

  'POST /api/ai/extract-image': async (req) => {
    const { images } = await body(req);
    const valid = (Array.isArray(images) ? images : []).filter((i) => /^image\/(png|jpeg|webp|gif)$/.test(i?.mediaType) && typeof i.data === 'string').slice(0, 6);
    if (!valid.length) throw Object.assign(new Error('Nenhuma imagem válida enviada.'), { status: 400 });
    const { data, provider } = await runAI({ system: prompts.SYSTEM, prompt: prompts.extractImage(valid.length), images: valid, effort: 'low' }, await loadSettings());
    return { books: Array.isArray(data.books) ? data.books : [], source: data.source || '', provider, phases: [] };
  },

  // Capas: busca automática, candidatas para escolher, URL escolhida e upload/colar.
  'POST /api/cover/auto': async (req) => autoCover(DATA, await body(req)),
  'POST /api/cover/candidates': async (req) => {
    const { title, author, format } = await body(req);
    const items = await coverCandidates(title || '', author || '', format);
    return { items: items.slice(0, 18).map(({ url, thumb, label, source }) => ({ url, thumb, label, source })) };
  },
  'POST /api/cover/set': async (req) => coverFromUrl(DATA, await body(req)),
  'POST /api/cover/upload': async (req) => coverFromUpload(DATA, await body(req)),
  'POST /api/cover/delete': async (req) => { await removeCover(DATA, (await body(req)).id); return { ok: true }; },
};

// Só aceita requisições da própria interface: bloqueia DNS rebinding (Host estranho)
// e sites de terceiros disparando chamadas ao servidor (Origin diferente).
// Além do localhost, aceita o nome desta máquina na rede Tailscale (ex.: meu-pc.tailXXXX.ts.net),
// por onde o "tailscale serve" entrega o app aos seus outros aparelhos.
const LOCAL_HOSTS = new Set([`localhost:${PORT}`, `127.0.0.1:${PORT}`, `[::1]:${PORT}`]);
const extraHosts = new Set((process.env.TRUSTED_HOSTS || '').split(',').map((h) => h.trim().toLowerCase()).filter(Boolean));
let tailnetName = '';
let tailnetCheckedAt = 0;
function refreshTailnetName() {
  if (Date.now() - tailnetCheckedAt < 60_000) return;
  tailnetCheckedAt = Date.now();
  exec('tailscale status --json', { timeout: 5000, windowsHide: true, maxBuffer: 4_000_000 }, (err, out) => {
    if (err) return;
    try { tailnetName = (JSON.parse(out).Self?.DNSName || '').replace(/\.$/, '').toLowerCase(); } catch { /* sem tailscale */ }
  });
}
refreshTailnetName();
function hostAllowed(host) {
  if (!host) return false;
  host = host.toLowerCase();
  if (LOCAL_HOSTS.has(host)) return true;
  const name = host.replace(/:\d+$/, '');
  if (extraHosts.has(name) || extraHosts.has(host)) return true;
  if (!name.endsWith('.ts.net')) return false;
  if (name !== tailnetName) refreshTailnetName(); // Tailscale pode ter subido depois do app
  return name === tailnetName;
}
function trusted(req) {
  const host = req.headers.host;
  if (!hostAllowed(host)) return false;
  const origin = req.headers.origin;
  if (origin && origin.replace(/^https?:\/\//, '').toLowerCase() !== host.toLowerCase()) return false;
  if (req.method !== 'GET' && !String(req.headers['content-type'] || '').startsWith('application/json')) return false;
  return true;
}

const server = http.createServer(async (req, res) => {
  if (!trusted(req)) return send(res, 403, { error: 'origem não permitida' });
  let key = req.method;
  try {
    key = `${req.method} ${new URL(req.url, 'http://x').pathname}`;
    const handler = routes[key];
    if (!handler) {
      if (req.method === 'GET' && !key.includes(' /api/')) return await serveStatic(req, res);
      return send(res, 404, { error: 'rota inexistente' });
    }
    send(res, 200, await handler(req));
  } catch (e) {
    if (e instanceof URIError || e.code === 'ERR_INVALID_URL') return send(res, 400, { error: 'URL inválida' });
    if (!e.status) console.error(`[${key}]`, e.message);
    send(res, e.status || 500, { error: e.message || String(e) });
  }
});

server.listen(PORT, HOST, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`\n  📚 Marginália rodando em ${url}\n     Ctrl+C para encerrar.\n`);
  if (!process.env.NO_OPEN) {
    const opener = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open ${url}` : `xdg-open ${url}`;
    exec(opener, () => {});
  }
  // Baixa (ou renova, a cada 30 dias) as listas de referência em segundo plano.
  loadSettings().then((s) => s.referenceLists && refreshReference(DATA)).catch((e) => console.log(`  Listas de referência indisponíveis agora: ${e.message}`));
});
