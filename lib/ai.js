// Camada de IA: usa um CLI já logado no PC (Claude Code, Codex, Cursor Agent)
// ou uma API key (Anthropic / OpenAI). Todas as tarefas pedem JSON como resposta.
import { spawn } from 'node:child_process';
import os from 'node:os';
import fs from 'node:fs/promises';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

const IS_WIN = process.platform === 'win32';
const TIMEOUT_MS = 6 * 60 * 1000;

export const PROVIDERS = {
  'claude-cli': { label: 'Claude Code', kind: 'cli', bins: ['claude'] },
  'codex-cli': { label: 'Codex', kind: 'cli', bins: ['codex'] },
  'cursor-cli': { label: 'Cursor Agent', kind: 'cli', bins: ['cursor-agent', 'agent'] },
  'anthropic-api': { label: 'API Anthropic', kind: 'api' },
  'openai-api': { label: 'API OpenAI', kind: 'api' },
};
const AUTO_ORDER = ['claude-cli', 'codex-cli', 'cursor-cli', 'anthropic-api', 'openai-api'];

export const DEFAULT_MODELS = {
  'anthropic-api': 'claude-opus-5-5',
  'openai-api': 'gpt-5-mini',
};

// ---------------------------------------------------------------- processos
function quoteForCmd(arg) {
  if (arg === '') return '""';
  return /[\s"&|<>^]/.test(arg) ? `"${arg.replace(/"/g, '""')}"` : arg;
}

// No Windows, child.kill() via shell mata só o cmd.exe; o CLI ficaria órfão.
function killTree(child) {
  if (IS_WIN && child.pid) spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true }).on('error', () => {});
  else child.kill('SIGTERM');
}

// Nome de modelo vai como argumento de linha de comando: aceita só caracteres seguros.
const safeModel = (m) => (/^[\w.:\-/]{1,80}$/.test(m || '') ? m : '');

export function run(cmd, args, { input, timeout = TIMEOUT_MS, cwd } = {}) {
  return new Promise((resolve, reject) => {
    // .cmd/.bat (instalações via npm no Windows) só rodam através do shell.
    const viaShell = IS_WIN && /\.(cmd|bat)$/i.test(cmd);
    const child = viaShell
      ? spawn([cmd, ...args].map(quoteForCmd).join(' '), { shell: true, cwd, windowsHide: true })
      : spawn(cmd, args, { cwd, windowsHide: true });
    let stdout = '';
    let stderr = '';
    // setEncoding usa um decodificador com estado: não quebra caracteres multibyte entre chunks.
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    const timer = setTimeout(() => {
      killTree(child);
      reject(new Error(`Tempo esgotado após ${Math.round(timeout / 1000)}s`));
    }, timeout);
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    // Se o CLI sair antes de ler o prompt (não logado, flag inválida), evita EPIPE não tratado.
    child.stdin.on('error', () => {});
    child.on('error', (e) => { clearTimeout(timer); reject(e); });
    child.on('close', (code) => { clearTimeout(timer); resolve({ code, stdout, stderr }); });
    if (input != null) child.stdin.end(input, 'utf8');
    else child.stdin.end();
  });
}

async function which(bin) {
  try {
    const r = await run(IS_WIN ? 'where' : 'which', [bin], { timeout: 5000 });
    if (r.code !== 0) return null;
    const lines = r.stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    if (!IS_WIN) return lines[0] || null;
    // No Windows, prefira executáveis reais (where também lista scripts sem extensão).
    return lines.find((l) => /\.(exe|cmd|bat)$/i.test(l)) || null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- detecção
let cache = null;
export async function detectProviders(settings = {}, { fresh = false } = {}) {
  if (!cache || fresh || Date.now() - cache.at > 60_000) {
    const bins = {};
    await Promise.all(
      Object.entries(PROVIDERS)
        .filter(([, p]) => p.kind === 'cli')
        .map(async ([id, p]) => {
          for (const b of p.bins) {
            const found = await which(b);
            // "agent" é um nome genérico: só aceita se for do Cursor.
            if (found && (b !== 'agent' || /cursor/i.test(found))) { bins[id] = found; break; }
          }
        }),
    );
    cache = { at: Date.now(), bins };
  }
  return Object.entries(PROVIDERS).map(([id, p]) => {
    if (p.kind === 'cli') {
      const bin = cache.bins[id];
      return { id, label: p.label, kind: p.kind, available: !!bin, detail: bin || 'não encontrado no PATH' };
    }
    const key = apiKeyFor(id, settings);
    return {
      id, label: p.label, kind: p.kind, available: !!key,
      detail: key ? `chave configurada · ${modelFor(id, settings)}` : 'sem API key',
    };
  });
}

function apiKeyFor(id, s) {
  if (id === 'anthropic-api') return s.anthropicKey || process.env.ANTHROPIC_API_KEY || '';
  if (id === 'openai-api') return s.openaiKey || process.env.OPENAI_API_KEY || '';
  return '';
}
function modelFor(id, s) {
  if (id === 'anthropic-api') return s.anthropicModel || DEFAULT_MODELS[id];
  if (id === 'openai-api') return s.openaiModel || DEFAULT_MODELS[id];
  return s.cliModel || '';
}

// Provedores que aceitam imagens (screenshots). O Cursor Agent não tem entrada de imagem no modo -p.
const VISION = new Set(['claude-cli', 'codex-cli', 'anthropic-api', 'openai-api']);

export async function resolveProvider(settings, { images = false } = {}) {
  const list = await detectProviders(settings);
  const wanted = settings.provider && settings.provider !== 'auto' ? settings.provider : null;
  if (wanted) {
    const p = list.find((x) => x.id === wanted);
    if (!p?.available) throw new Error(`${PROVIDERS[wanted]?.label || wanted} não está disponível (${p?.detail || '?'}).`);
    if (images && !VISION.has(p.id)) throw new Error(`${p.label} não lê imagens. Escolha outro provedor em Ajustes (ou Automático).`);
    return p;
  }
  const p = AUTO_ORDER.filter((id) => !images || VISION.has(id)).map((id) => list.find((x) => x.id === id)).find((x) => x?.available);
  if (!p) throw new Error(images
    ? 'Nenhuma IA disponível que leia imagens (Claude Code, Codex ou API key).'
    : 'Nenhuma IA disponível. Instale/logue um CLI (claude, codex, cursor-agent) ou informe uma API key em Ajustes.');
  return p;
}

// ---------------------------------------------------------------- execução
/**
 * Executa uma tarefa e devolve { data, provider }.
 * effort: 'low' | 'medium' | 'high' (usado pela API Anthropic).
 * images: [{ mediaType: 'image/png', data: '<base64>' }] (opcional)
 */
export async function runAI({ system, prompt, effort = 'medium', images = [] }, settings = {}) {
  const provider = await resolveProvider(settings, { images: images.length > 0 });
  const bin = cache?.bins?.[provider.id];
  let text;
  switch (provider.id) {
    case 'claude-cli': text = await runClaudeCli(bin, system, prompt, settings.cliModel, images); break;
    case 'codex-cli': text = await runCodexCli(bin, system, prompt, settings.cliModel, images); break;
    case 'cursor-cli': text = await runCursorCli(bin, system, prompt, settings.cliModel); break;
    case 'anthropic-api': text = await runAnthropic(system, prompt, effort, settings, images); break;
    case 'openai-api': text = await runOpenAI(system, prompt, settings, images); break;
    default: throw new Error(`Provedor desconhecido: ${provider.id}`);
  }
  return { data: parseJSON(text), provider: provider.label };
}

const extFor = (mt) => ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' })[mt] || 'png';

function cliError(name, r) {
  const msg = (r.stderr || r.stdout || '').trim().split(/\r?\n/).slice(-6).join('\n');
  return new Error(`${name} terminou com código ${r.code}${msg ? `:\n${msg}` : ''}`);
}

async function runClaudeCli(bin, system, prompt, model, images = []) {
  // System prompt por arquivo: via cmd.exe (.cmd) um argumento com quebras de linha seria cortado.
  const sysFile = path.join(os.tmpdir(), `marginalia-sys-${process.pid}-${Date.now()}.txt`);
  await fs.writeFile(sysFile, system, 'utf8');
  const withImages = images.length > 0;
  // Com imagens, a mensagem vai como stream-json (blocos de imagem + texto) pelo stdin.
  const args = withImages
    ? ['-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose']
    : ['-p', '--output-format', 'json'];
  args.push('--tools', '', '--no-session-persistence', '--system-prompt-file', sysFile);
  if (safeModel(model)) args.push('--model', safeModel(model));
  const input = withImages
    ? `${JSON.stringify({
      type: 'user',
      message: {
        role: 'user',
        content: [
          ...images.map((i) => ({ type: 'image', source: { type: 'base64', media_type: i.mediaType, data: i.data } })),
          { type: 'text', text: prompt },
        ],
      },
    })}\n`
    : prompt;
  // cwd neutro para não carregar CLAUDE.md de projetos.
  const r = await run(bin, args, { input, cwd: os.tmpdir() }).finally(() => fs.rm(sysFile, { force: true }).catch(() => {}));
  let out;
  try {
    out = withImages
      ? r.stdout.split(/\r?\n/).filter((l) => l.startsWith('{')).map((l) => JSON.parse(l)).find((m) => m.type === 'result')
      : JSON.parse(r.stdout);
  } catch { /* tratado abaixo */ }
  if (!out) throw cliError('claude', r);
  if (out.is_error) throw new Error(`claude: ${out.result || out.subtype || 'erro'}`);
  return out.result || '';
}

async function runCodexCli(bin, system, prompt, model, images = []) {
  const stamp = `${process.pid}-${Date.now()}`;
  const outFile = path.join(os.tmpdir(), `marginalia-codex-${stamp}.txt`);
  const imgFiles = await Promise.all(images.map(async (img, i) => {
    const f = path.join(os.tmpdir(), `marginalia-img-${stamp}-${i}.${extFor(img.mediaType)}`);
    await fs.writeFile(f, Buffer.from(img.data, 'base64'));
    return f;
  }));
  const args = ['exec', '--skip-git-repo-check', '--sandbox', 'read-only', '--color', 'never', '--output-last-message', outFile];
  if (safeModel(model)) args.push('-m', safeModel(model));
  for (const f of imgFiles) args.push('-i', f);
  args.push('-');
  try {
    const r = await run(bin, args, { input: `${system}\n\n${prompt}`, cwd: os.tmpdir() });
    const last = await fs.readFile(outFile, 'utf8').catch(() => '');
    if (last.trim()) return last;
    if (r.code !== 0) throw cliError('codex', r);
    return r.stdout;
  } finally {
    for (const f of [outFile, ...imgFiles]) fs.rm(f, { force: true }).catch(() => {});
  }
}

async function runCursorCli(bin, system, prompt, model) {
  const args = ['-p', '--output-format', 'text'];
  if (safeModel(model)) args.push('--model', safeModel(model));
  const r = await run(bin, args, { input: `${system}\n\n${prompt}`, cwd: os.tmpdir() });
  if (r.code !== 0 || !r.stdout.trim()) throw cliError('cursor-agent', r);
  return r.stdout;
}

// Fallback do servidor em caso de recusa: suportado nestes modelos.
const FALLBACK_MODELS = /^claude-(opus-5|opus-5-5|sonnet-5-5|fable-5-1)$/;

async function runAnthropic(system, prompt, effort, settings, images = []) {
  const client = new Anthropic({ apiKey: apiKeyFor('anthropic-api', settings) });
  const model = modelFor('anthropic-api', settings);
  const content = images.length
    ? [
      ...images.map((i) => ({ type: 'image', source: { type: 'base64', media_type: i.mediaType, data: i.data } })),
      { type: 'text', text: prompt },
    ]
    : prompt;
  const params = {
    model,
    max_tokens: 16000,
    system,
    output_config: { effort },
    messages: [{ role: 'user', content }],
  };
  let res;
  try {
    res = FALLBACK_MODELS.test(model)
      ? await client.beta.messages.create({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' })
      : await client.messages.create(params);
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new Error('API Anthropic: chave inválida.');
    if (e instanceof Anthropic.RateLimitError) throw new Error('API Anthropic: limite de uso atingido, tente mais tarde.');
    if (e instanceof Anthropic.APIError) throw new Error(`API Anthropic (${e.status}): ${e.message}`);
    throw e;
  }
  if (res.stop_reason === 'refusal') throw new Error('A IA recusou este pedido.');
  if (res.stop_reason === 'max_tokens') throw new Error('Resposta da IA cortada (limite de tokens). Tente com menos livros por vez.');
  return res.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
}

async function runOpenAI(system, prompt, settings, images = []) {
  const client = new OpenAI({ apiKey: apiKeyFor('openai-api', settings) });
  const content = images.length
    ? [
      ...images.map((i) => ({ type: 'image_url', image_url: { url: `data:${i.mediaType};base64,${i.data}` } })),
      { type: 'text', text: prompt },
    ]
    : prompt;
  try {
    const r = await client.chat.completions.create({
      model: modelFor('openai-api', settings),
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: system }, { role: 'user', content }],
    });
    return r.choices[0]?.message?.content || '';
  } catch (e) {
    if (e instanceof OpenAI.APIError) throw new Error(`API OpenAI (${e.status}): ${e.message}`);
    throw e;
  }
}

// ---------------------------------------------------------------- JSON
export function parseJSON(text) {
  const t = String(text || '').trim();
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [t, fenced?.[1]];
  const start = t.search(/[[{]/);
  if (start >= 0) {
    const close = t[start] === '{' ? '}' : ']';
    candidates.push(t.slice(start, t.lastIndexOf(close) + 1));
  }
  for (const c of candidates) {
    if (!c) continue;
    try { return JSON.parse(c); } catch { /* tenta o próximo */ }
  }
  throw new Error(`A IA não devolveu JSON válido. Início da resposta: ${t.slice(0, 200)}`);
}
