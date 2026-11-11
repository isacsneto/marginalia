// Listas de referência do Contra os Acadêmicos (contraosacademicos.com.br/lista).
// O site organiza estudos em listas (Filosofia, História, Economia…, por autor e de literatura),
// cada uma dividida em níveis, e um programa geral ("O Ordenamento das Leituras") que diz em que
// ordem estudar as listas e quais são pré-requisito de quais.
// Aqui baixamos as listas uma vez (cache local de 30 dias), localizamos nelas os livros da estante
// e montamos um resumo curto para os prompts do plano e das sugestões.
import fs from 'node:fs/promises';
import path from 'node:path';

const SITE = 'https://contraosacademicos.com.br';
const INDEX = `${SITE}/lista/`;
const PROGRAM = `${SITE}/lista/o-ordenamento-das-leituras/`;
const TTL_MS = 30 * 24 * 3600 * 1000;
const UA = 'Mozilla/5.0 (Marginalia; app pessoal de leitura)';

export const REFERENCE = { id: 'contraosacademicos', name: 'Contra os Acadêmicos', url: INDEX };

// ---------------------------------------------------------------- HTML -> texto
const ENTITIES = { nbsp: ' ', amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', ndash: '–', mdash: '—', hellip: '…', laquo: '«', raquo: '»' };
function decode(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&(\w+);/g, (m, n) => ENTITIES[n] ?? m);
}
const text = (html) => decode(html.replace(/<sup[\s\S]*?<\/sup>/g, '').replace(/<[^>]+>/g, ' ')).replace(/\[\d+\]/g, '').replace(/\s+/g, ' ').trim();

export function norm(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

// Uma página de lista: título, categoria e, na ordem, seções (h2/h3/h4) com nota e livros.
export function parseList(html, url) {
  const title = text(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] || '');
  const category = text(html.match(/Lista de leitura\s*·\s*([^<]+)/)?.[1] || '');
  const start = html.indexOf('class="ed-body"');
  const endMarks = ['class="ed-share"', 'class="author-box"', '<aside', '<footer'].map((m) => html.indexOf(m, start)).filter((i) => i > start);
  const body = start < 0 ? '' : html.slice(start, endMarks.length ? Math.min(...endMarks) : undefined);
  const sections = [];
  const heads = ['', '', ''];
  let current = null;
  let wantNote = false;
  const re = /<(h[234])[^>]*>([\s\S]*?)<\/\1>|<p[^>]*>([\s\S]*?)<\/p>|<ol[^>]*is-style-livros[^>]*>([\s\S]*?)<\/ol>/g;
  for (const m of body.matchAll(re)) {
    if (m[1]) {
      const depth = Number(m[1][1]) - 2;
      heads[depth] = text(m[2]);
      for (let i = depth + 1; i < heads.length; i++) heads[i] = '';
      current = null;
      wantNote = true;
    } else if (m[3] != null) {
      if (wantNote && !current) {
        const t = text(m[3]);
        if (t) { heads.note = t.length > 220 ? `${t.slice(0, 217).replace(/\s+\S*$/, '')}…` : t; wantNote = false; }
      }
    } else if (m[4]) {
      const items = [...m[4].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((x) => text(x[1])).filter((t) => t && t.length < 300);
      if (!items.length) continue;
      if (!current) {
        current = { path: heads.filter(Boolean).join(' › '), note: heads.note || '', items: [] };
        heads.note = '';
        sections.push(current);
      }
      current.items.push(...items);
    }
  }
  return { url, slug: url.replace(/\/$/, '').split('/').pop(), title, category, sections };
}

// Programa geral: ordem das listas por grupo e os pré-requisitos do "Projeto do Polímata".
export function parseProgram(html) {
  const start = html.indexOf('class="ed-body"');
  const body = html.slice(start, html.indexOf('class="ed-share"', start) > 0 ? html.indexOf('class="ed-share"', start) : undefined);
  const groups = [];
  const prerequisites = [];
  let group = null;
  for (const m of body.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>|<li[^>]*>([\s\S]*?)<\/li>/g)) {
    if (m[1]) { group = { name: text(m[1]).replace(/^\d+\.\s*/, ''), lists: [] }; groups.push(group); continue; }
    const href = m[2].match(/href="([^"]*\/lista\/[^"]+)"/)?.[1];
    const t = text(m[2]);
    if (group && /pol[ií]mata/i.test(group.name)) { if (t) prerequisites.push(t); continue; }
    if (group && t && t.length < 90) group.lists.push({ name: t, slug: href ? href.replace(/\/$/, '').split('/').pop() : null });
  }
  return { groups: groups.filter((g) => g.lists.length), prerequisites };
}

// ---------------------------------------------------------------- download e cache
async function get(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} em ${url}`);
  return res.text();
}

const cacheFile = (dataDir) => path.join(dataDir, 'reference', `${REFERENCE.id}.json`);
let memo = null;
let inflight = null;

export async function loadReference(dataDir) {
  if (memo) return memo;
  try { memo = JSON.parse(await fs.readFile(cacheFile(dataDir), 'utf8')); } catch { memo = null; }
  return memo;
}

export async function refreshReference(dataDir, { force = false } = {}) {
  const cached = await loadReference(dataDir);
  if (!force && cached && Date.now() - Date.parse(cached.fetchedAt) < TTL_MS) return cached;
  if (inflight) return inflight;
  inflight = (async () => {
    const [indexHtml, programHtml] = await Promise.all([get(INDEX), get(PROGRAM)]);
    const urls = [...new Set([...indexHtml.matchAll(/href="(https:\/\/contraosacademicos\.com\.br\/lista\/[a-z0-9-]+\/)"/g)].map((m) => m[1]))]
      .filter((u) => u !== INDEX && u !== PROGRAM);
    const lists = [];
    const failed = [];
    // Poucas conexões por vez, para não pesar no site.
    for (let i = 0; i < urls.length; i += 3) {
      const batch = await Promise.allSettled(urls.slice(i, i + 3).map(async (u) => parseList(await get(u), u)));
      batch.forEach((r, j) => (r.status === 'fulfilled' && r.value.sections.length ? lists.push(r.value) : failed.push(urls[i + j])));
    }
    if (!lists.length) throw new Error('Não consegui ler as listas do Contra os Acadêmicos.');
    const data = { source: REFERENCE.url, fetchedAt: new Date().toISOString(), program: parseProgram(programHtml), lists, failed };
    const file = cacheFile(dataDir);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(`${file}.tmp`, JSON.stringify(data));
    await fs.rename(`${file}.tmp`, file);
    memo = data;
    return data;
  })().finally(() => { inflight = null; });
  return inflight;
}

export async function referenceStatus(dataDir) {
  const r = await loadReference(dataDir);
  return {
    ...REFERENCE, updating: !!inflight,
    fetchedAt: r?.fetchedAt || null, lists: r?.lists.length || 0,
    books: r ? r.lists.reduce((n, l) => n + l.sections.reduce((k, s) => k + s.items.length, 0), 0) : 0,
  };
}

// ---------------------------------------------------------------- correspondência com a estante
const STOP = new Set(['o', 'a', 'os', 'as', 'um', 'uma', 'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'no', 'na', 'num', 'numa', 'por', 'para', 'com', 'the', 'of', 'and', 'vol', 'volume', 'tomo', 'livro']);
const words = (s) => norm(s).split(' ').filter((w) => w && !STOP.has(w));
// Sobrenome e nomes marcantes do autor (ignora iniciais e partículas).
const authorKeys = (a) => words(String(a || '').split(/,| e | and |&/)[0]).filter((w) => w.length > 2);

function index(ref) {
  if (ref._index) return ref._index;
  const entries = [];
  for (const list of ref.lists) {
    const listAuthor = /ordenada/.test(list.slug) ? ` ${words(list.slug.replace(/^lista-de-leitura-ordenada-/, '').replace(/-/g, ' ')).join(' ')} ` : '';
    list.sections.forEach((s, si) => s.items.forEach((item) => entries.push({
      list, si, item, n: ` ${words(item).join(' ')} `, listAuthor,
      // Onde procurar o autor: o item, a seção (ex.: "Machado de Assis" › "O alienista") e o autor da lista.
      who: ` ${words(`${item} ${s.path}`).join(' ')}${listAuthor}`,
    })));
  }
  Object.defineProperty(ref, '_index', { value: entries, enumerable: false });
  return entries;
}

// Onde cada livro da estante aparece nas listas: [{ list, title, url, path }].
export function matchBooks(ref, books) {
  if (!ref) return {};
  const entries = index(ref);
  const out = {};
  for (const b of books) {
    const t = words(b.title).join(' ');
    // Título principal, sem subtítulo: "Trivium: As Artes Liberais…" -> "trivium".
    const main = words(String(b.title || '').split(/:| — | – | - /)[0]);
    const keys = authorKeys(b.author);
    if (!t || (!keys.length && t.split(' ').length < 3)) continue;
    const hits = [];
    for (const e of entries) {
      // Com autor: ele precisa aparecer (no item, na seção ou como autor da lista) e todas as palavras
      // do título principal também, em qualquer ordem ("em uma" x "numa" fica de fora por ser stopword).
      // Sem autor: o título inteiro, com 3+ palavras, para "Política" ou "Ética" não casarem com tudo.
      const ok = keys.length
        ? keys.some((k) => e.who.includes(` ${k} `)) && main.length && main.every((w) => e.n.includes(` ${w} `))
        : e.n.includes(` ${t} `);
      if (!ok) continue;
      if (hits.some((h) => h.slug === e.list.slug && h.si === e.si)) continue;
      // A lista do próprio autor (ex.: Santo Agostinho para Confissões) vem primeiro.
      const own = keys.some((k) => e.listAuthor.includes(` ${k} `));
      hits.push({ slug: e.list.slug, si: e.si, list: e.list.title, url: e.list.url, path: e.list.sections[e.si].path, own });
    }
    if (hits.length) out[b.id] = hits;
  }
  // Ordem das referências de cada livro: a lista do próprio autor, depois as listas que mais cobrem a estante.
  const count = {};
  for (const hits of Object.values(out)) for (const h of hits) count[h.slug] = (count[h.slug] || 0) + 1;
  for (const hits of Object.values(out)) hits.sort((a, b) => (b.own - a.own) || (count[b.slug] - count[a.slug]));
  return out;
}

// Para a interface: até 3 referências por livro, com nome curto da lista, seção e link.
export function bookReferences(ref, books) {
  return Object.fromEntries(Object.entries(matchBooks(ref, books)).map(([id, hits]) => [id, hits.slice(0, 3).map((h) => ({ list: shortName(h.list), path: h.path, url: h.url }))]));
}

// "Lista de Leitura Ordenada: Platão" -> "Platão"; "Lista de Leitura de Política" -> "Política".
function shortName(title) { return String(title).replace(/^lista de (leituras? )?(ordenada\s*:?\s*)?(de |do |da )?/i, '').replace(/^sugeridas por /i, 'Sugeridas por ') || title; }

// Texto para os prompts: programa, estrutura das listas que tocam a estante e o que vem a seguir nelas.
export function referenceContext(ref, books, { candidates = 0 } = {}) {
  if (!ref) return null;
  const matches = matchBooks(ref, books);
  const used = new Map();
  for (const hits of Object.values(matches)) for (const h of hits) {
    const l = used.get(h.slug) || { count: 0, levels: new Set() };
    l.count++; l.levels.add(h.si);
    used.set(h.slug, l);
  }
  const lists = ref.lists.filter((l) => used.has(l.slug)).sort((a, b) => used.get(b.slug).count - used.get(a.slug).count).slice(0, 8);
  const lines = [];
  const prog = ref.program;
  if (prog?.groups?.length) {
    lines.push('Programa geral ("O Ordenamento das Leituras"), listas agrupadas como no site:');
    for (const g of prog.groups) lines.push(`- ${g.name}: ${g.lists.map((x) => x.name).join(', ')}`);
  }
  if (prog?.prerequisites?.length) {
    lines.push('Pré-requisitos entre listas ("Projeto do Polímata"):');
    for (const p of prog.prerequisites) lines.push(`- ${p}`);
  }
  if (lists.length) {
    lines.push('', 'Listas em que aparecem livros da estante (seções na ordem do site; * = seção com livro do leitor):');
    for (const l of lists) {
      const u = used.get(l.slug);
      lines.push(`- ${shortName(l.title)} (${l.category || 'lista'}): ${l.sections.map((s, i) => `${u.levels.has(i) ? '*' : ''}${s.path || 'Introdução'}`).filter((s, i, a) => a.indexOf(s) === i).join(' → ')}`);
    }
  }
  const byBook = Object.fromEntries(Object.entries(matches).map(([id, hits]) => [id, hits.slice(0, 2).map((h) => `${shortName(h.list)} › ${h.path || 'início'}`).join('; ')]));

  // Próximos passos: livros das listas usadas, nas seções até uma depois da mais avançada do leitor.
  // Divididos entre as listas, na ordem do site: primeiro o que falta das bases.
  const next = [];
  if (candidates && lists.length) {
    const owned = books.map((b) => words(String(b.title || '').split(/:| — | – | - /)[0]).join(' ')).filter((t) => t.length > 3);
    const perList = Math.ceil(candidates / lists.length);
    for (const l of lists) {
      const max = Math.max(...used.get(l.slug).levels);
      const picked = [];
      for (const s of l.sections.slice(0, max + 2)) for (const item of s.items) {
        const n = ` ${words(item).join(' ')} `;
        if (picked.length < perList && !owned.some((t) => n.includes(` ${t} `))) picked.push(`${item} [${shortName(l.title)} › ${s.path || 'início'}]`);
      }
      next.push(...picked);
    }
  }
  return { text: lines.join('\n'), byBook, next, matches, lists: lists.length };
}
