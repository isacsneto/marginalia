// Listas de referência do Contra os Acadêmicos (contraosacademicos.com.br/lista).
//
// Como o site organiza o estudo ("O Ordenamento das Leituras"):
// - O coração do programa são os Prolegômenos da lista de Filosofia: devem ser lidos por inteiro,
//   sem acrescentar outros livros, antes de qualquer outra lista.
// - Depois vem a própria lista de Filosofia, em níveis (1, 2, 3), cada um em ordem numerada.
// - As listas de área seguem a ordem do "Projeto do Polímata" (Filosofia, História, Matemática,
//   Lógica, Física, Direito, Economia, Psicologia, Ciência Política), cada uma liberada quando a
//   Filosofia chega ao nível que ela pede ("estude também: Filosofia até o nível 2" etc.).
// - Literatura não tem ordem e acompanha tudo; listas por autor não têm ordem entre si.
// - Seções de "Leitura Complementar" são opcionais.
//
// Este módulo baixa as listas (API do WordPress do site; cache local de 30 dias), localiza nelas os
// livros da estante e monta o plano "Contra os Acadêmicos" diretamente dessa estrutura, sem deixar
// a ordem a cargo da IA.
import fs from 'node:fs/promises';
import path from 'node:path';

const SITE = 'https://contraosacademicos.com.br';
const API = `${SITE}/wp-json/wp/v2`;
const TTL_MS = 30 * 24 * 3600 * 1000;
const CACHE_VERSION = 3;
const UA = 'Mozilla/5.0 (Marginalia; app pessoal de leitura)';
const PROGRAM_SLUG = 'o-ordenamento-das-leituras';
const SPINE_SLUG = 'lista-de-leitura-de-filosofia-para-iniciantes-e-interessados';

export const REFERENCE = { id: 'contraosacademicos', name: 'Contra os Acadêmicos', url: `${SITE}/lista/`, program: `${SITE}/lista/${PROGRAM_SLUG}/` };

// ---------------------------------------------------------------- texto
const ENTITIES = { nbsp: ' ', amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', ndash: '–', mdash: '—', hellip: '…', laquo: '«', raquo: '»' };
function decode(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&(\w+);/g, (m, n) => ENTITIES[n] ?? m);
}
const text = (html) => decode(String(html).replace(/<sup[\s\S]*?<\/sup>/g, '').replace(/<[^>]+>/g, ' ')).replace(/\[\d+\]/g, '').replace(/\s+/g, ' ').trim();
const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1).replace(/\s+\S*$/, '')}…` : s);

export function norm(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

const OPTIONAL = /complementar|opcion|companions|coment[aá]rios sobre|[uú]teis|interesse hist[oó]rico|onde encontrar|vers[oõ]es bil[ií]ngue|obras completas pela/i;
const PARALLEL = /n[aã]o propriamente filos[oó]fic/i;
const INSTRUCTION = /recomend|aconselh|n[aã]o se exige|sugerimos|observa[çc][aã]o:|tenham prud|fala em especial|podem? ser lid/i;

// ---------------------------------------------------------------- uma lista
// html: o conteúdo da lista (content.rendered da API ou o miolo da página).
// Seções na ordem do site, com os livros de cada uma. Também lê os itens escritos como parágrafo
// numerado ("17. Confissões"), que o site usa em alguns pontos no lugar da lista.
export function parseList(html, { url = '', slug = '', title = '', category = '' } = {}) {
  const body = String(html).split(/<h2[^>]*>\s*(?:<[^>]+>\s*)*(?:Notas|Refer[eê]ncias)\b/i)[0];
  const sections = [];
  const heads = ['', '', ''];
  let current = null;
  let note = '';
  const intro = [];
  let started = false;
  const section = () => {
    if (!current) {
      const p = heads.filter(Boolean);
      current = { path: p.join(' › '), level: heads[0], note, items: [], optional: OPTIONAL.test(p.join(' ')), parallel: PARALLEL.test(p.join(' ')) };
      note = '';
      sections.push(current);
    }
    return current;
  };
  const re = /<(h[2-4])[^>]*>([\s\S]*?)<\/\1>|<p[^>]*>([\s\S]*?)<\/p>|<ol[^>]*is-style-livros[^>]*>([\s\S]*?)<\/ol>/g;
  for (const m of body.matchAll(re)) {
    if (m[1]) {
      started = true;
      const depth = Number(m[1][1]) - 2;
      heads[depth] = text(m[2]);
      for (let i = depth + 1; i < heads.length; i++) heads[i] = '';
      current = null;
      note = '';
    } else if (m[3] != null) {
      const t = text(m[3]);
      if (!t) continue;
      if (/^\d{1,3}\s*[.)]\s+\S/.test(t) && t.length < 200 && started) { section().items.push(t.replace(/^\d{1,3}\s*[.)]\s+/, '')); continue; }
      if (!started) { intro.push(t); continue; }
      if (!current && !note) note = clip(t, 300);
    } else if (m[4]) {
      started = true;
      for (const li of m[4].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)) {
        const t = text(li[1]);
        if (!t) continue;
        // Instruções escritas como lista antes do primeiro título (ex.: Economia, "Na Parte I não se
        // exige…") não são livros. Depois de um título, frases longas são referências bibliográficas.
        if (!heads[0] && !heads[1] && INSTRUCTION.test(t) && !/\(\d{4}\)/.test(t)) { intro.push(t); continue; }
        section().items.push(t);
      }
    }
  }
  return { url, slug: slug || url.replace(/\/$/, '').split('/').pop(), title: text(title), category, intro: clip(intro.join(' '), 900), sections: sections.filter((s) => s.items.length) };
}

// "Título – Autor" (formato da lista de Filosofia). Em listas "Autor – Título" a ordem varia,
// por isso isto só é usado para mostrar os livros que faltam da lista de Filosofia.
export function splitItem(item) {
  const parts = item.split(/\s[–—]\s|\s-\s/);
  if (parts.length < 2) return { title: item, author: '' };
  return { title: parts.slice(0, -1).join(' – ').trim(), author: parts.at(-1).replace(/\(.*?\)/g, '').trim() };
}

// ---------------------------------------------------------------- programa
// Lê do Ordenamento a ordem das listas de área e até que nível de Filosofia cada uma pede.
export function parseProgram(html) {
  const out = { order: [], prerequisites: [] };
  const sect = String(html).split(/Projeto do Pol[ií]mata/i)[1] || '';
  for (const li of sect.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)) {
    const t = text(li[1]);
    const slug = li[1].match(/href="[^"]*\/lista\/([a-z0-9-]+)\/?"/)?.[1];
    if (!t) continue;
    out.prerequisites.push(t);
    const name = t.split(/\s[–—-]\s/)[0].trim();
    // Filosofia "até o nível N" ou "por completo" (= depois do Nível 3); "Pré requisito: Prolegômenos" = nível 0.
    const lvl = /filosofia[^;.]*por completo/i.test(t) ? 3 : Number(t.match(/filosofia[^;.]*?n[ií]vel\s*(\d)/i)?.[1] ?? (/pr[ée].?requisito/i.test(t) ? 0 : 3));
    out.order.push({ name, slug, gate: lvl, needs: t.split(/estude também:/i)[1]?.trim() || '' });
  }
  // Uma lista também espera as outras listas de área que ela pede (Economia pede Direito, que pede
  // a Filosofia completa): o ponto de entrada é o mais tardio entre eles.
  for (const o of out.order) {
    for (const other of out.order) if (other !== o && norm(o.needs).includes(norm(other.name))) o.gate = Math.max(o.gate, other.gate);
  }
  return out;
}

// ---------------------------------------------------------------- download e cache
async function getJSON(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} em ${url}`);
  return res.json();
}

const cacheFile = (dataDir) => path.join(dataDir, 'reference', `${REFERENCE.id}.json`);
let memo = null;
let inflight = null;

export async function loadReference(dataDir) {
  if (memo) return memo;
  try {
    const data = JSON.parse(await fs.readFile(cacheFile(dataDir), 'utf8'));
    memo = data.v === CACHE_VERSION ? data : null;
  } catch { memo = null; }
  return memo;
}

export async function refreshReference(dataDir, { force = false } = {}) {
  const cached = await loadReference(dataDir);
  if (!force && cached && Date.now() - Date.parse(cached.fetchedAt) < TTL_MS) return cached;
  if (inflight) return inflight;
  inflight = (async () => {
    const [raw, temas] = await Promise.all([
      getJSON(`${API}/lista?per_page=100&_fields=slug,link,title,content,tema_lista,meta`),
      getJSON(`${API}/tema_lista?per_page=100&_fields=id,name`),
    ]);
    const tema = Object.fromEntries(temas.map((t) => [t.id, decode(t.name)]));
    const programRaw = raw.find((l) => l.slug === PROGRAM_SLUG);
    const lists = raw.filter((l) => l.slug !== PROGRAM_SLUG).map((l) => ({
      ...parseList(l.content?.rendered || '', { url: l.link, slug: l.slug, title: l.title?.rendered || '', category: (l.tema_lista || []).map((id) => tema[id]).filter(Boolean)[0] || '' }),
      declared: Number(l.meta?.total_titulos) || null,
    })).filter((l) => l.sections.length);
    if (!lists.some((l) => l.slug === SPINE_SLUG)) throw new Error('A lista de Filosofia do Contra os Acadêmicos não veio na resposta do site.');
    const data = { v: CACHE_VERSION, source: REFERENCE.url, fetchedAt: new Date().toISOString(), program: parseProgram(programRaw?.content?.rendered || ''), lists };
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
    id: REFERENCE.id, name: REFERENCE.name, url: REFERENCE.url, updating: !!inflight,
    fetchedAt: r?.fetchedAt || null, lists: r?.lists.length || 0,
    books: r ? r.lists.reduce((n, l) => n + l.sections.reduce((k, s) => k + s.items.length, 0), 0) : 0,
  };
}

// ---------------------------------------------------------------- tipos de lista e prioridade
// Cada livro fica num lugar só do plano; quando aparece em várias listas, vale a de maior prioridade.
function classify(ref) {
  if (ref._kinds) return ref._kinds;
  const programOrder = ref.program?.order || [];
  const kinds = {};
  for (const l of ref.lists) {
    const prog = programOrder.findIndex((p) => p.slug === l.slug);
    let kind = 'aux';
    let rank = 900;
    if (l.slug === SPINE_SLUG) { kind = 'spine'; rank = 0; }
    else if (prog >= 0) { kind = 'subject'; rank = 100 + prog; }
    else if (/humanidades|exatas/i.test(l.category)) { kind = 'subject'; rank = 200; }
    else if (/autor/i.test(l.category)) { kind = 'author'; rank = 300; }
    else if (/literatura/i.test(l.category)) { kind = 'literature'; rank = 400; }
    kinds[l.slug] = { kind, rank, gate: prog >= 0 ? programOrder[prog].gate : 3, needs: prog >= 0 ? programOrder[prog].needs : '' };
  }
  Object.defineProperty(ref, '_kinds', { value: kinds, enumerable: false });
  return kinds;
}

// Nível de Filosofia de uma seção da lista-espinha: Prolegômenos = 0, "Nível N" = N.
const spineLevel = (s) => (/prolegômenos|prolegomenos/i.test(s.level) ? 0 : Number(s.level.match(/n[ií]vel\s*(\d)/i)?.[1] ?? -1));

// ---------------------------------------------------------------- correspondência com a estante
const STOP = new Set(['o', 'a', 'os', 'as', 'um', 'uma', 'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'no', 'na', 'num', 'numa', 'por', 'para', 'com', 'the', 'of', 'and', 'vol', 'volume', 'tomo', 'livro']);
const HONORIFIC = new Set(['santo', 'santa', 'sao', 'sto', 'irma', 'frei', 'padre', 'dom', 'sir', 'dr', 'prof']);
const words = (s) => norm(s).split(' ').filter((w) => w && !STOP.has(w));
const authorKeys = (a) => words(String(a || '').split(/,| e | and |&/)[0]).filter((w) => w.length > 2 && !HONORIFIC.has(w));

function index(ref) {
  if (ref._index) return ref._index;
  const entries = [];
  for (const list of ref.lists) {
    const listAuthor = /ordenada/.test(list.slug) ? ` ${words(list.slug.replace(/^lista-de-leitura-ordenada-/, '').replace(/-/g, ' ')).join(' ')} ` : '';
    list.sections.forEach((s, si) => s.items.forEach((item, ii) => entries.push({
      list, si, ii, item, n: ` ${words(item).join(' ')} `, listAuthor,
      // Onde procurar o autor: o item, a seção (ex.: "Machado de Assis" › "O alienista") e o autor da lista.
      who: ` ${words(`${item} ${s.path}`).join(' ')}${listAuthor}`,
    })));
  }
  Object.defineProperty(ref, '_index', { value: entries, enumerable: false });
  return entries;
}

// Onde cada livro da estante aparece nas listas, do lugar mais importante para o menos.
export function matchBooks(ref, books) {
  if (!ref) return {};
  const entries = index(ref);
  const kinds = classify(ref);
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
      // do título principal também, em qualquer ordem. Sem autor: o título inteiro, com 3+ palavras.
      const ok = keys.length
        ? keys.some((k) => e.who.includes(` ${k} `)) && main.length && main.every((w) => e.n.includes(` ${w} `))
        : e.n.includes(` ${t} `);
      if (!ok || hits.some((h) => h.slug === e.list.slug && h.si === e.si)) continue;
      const s = e.list.sections[e.si];
      const k = kinds[e.list.slug];
      hits.push({
        slug: e.list.slug, si: e.si, ii: e.ii, list: e.list.title, url: e.list.url, path: s.path, item: e.item,
        // Prioridade: Filosofia (seções principais antes das opcionais), listas de área, autor, literatura, auxiliares.
        rank: k.rank + (s.optional || s.parallel ? 50 : 0) + e.si / 1000,
      });
    }
    if (hits.length) out[b.id] = hits.sort((a, b2) => a.rank - b2.rank);
  }
  return out;
}

// "Lista de Leitura Ordenada: Platão" -> "Platão"; "Lista de Leitura de Política" -> "Política".
export function shortName(title) {
  return String(title).replace(/^lista de (leituras? )?(ordenada\s*:?\s*)?(de |do |da )?/i, '').replace(/^sugeridas por /i, 'Sugeridas por ') || title;
}

// Para a interface: até 3 lugares por livro, com nome curto da lista, seção e link.
export function bookReferences(ref, books) {
  return Object.fromEntries(Object.entries(matchBooks(ref, books)).map(([id, hits]) => [id, hits.slice(0, 3).map((h) => ({ list: shortName(h.list), path: h.path, url: h.url }))]));
}

// ---------------------------------------------------------------- plano montado a partir do site
const LEVEL_NAME = (n) => (n === 0 ? 'Prolegômenos' : `Filosofia · Nível ${n}`);
const LEVEL_GOAL = {
  0: 'O coração do programa: formação mínima para estudar. O site pede que sejam lidos por inteiro, sem acrescentar outros livros, antes de qualquer outra lista.',
  1: 'Livros introdutórios, em sua maioria fontes primárias. O site lembra que não há pressa: é normal passar um ano ou mais neste nível.',
  2: 'Leituras mais complexas, para quem já não é iniciante.',
  3: 'Leituras mais árduas, que pedem domínio do texto filosófico.',
};

// books: livros da estante (id, title, author, status, format, ownership, ai.hours…).
// Devolve um plano no mesmo formato dos planos da IA, com fases na ordem do site. Livros que a
// lista de Filosofia pede e você não tem entram como { missing: true, title, author }.
// fits: encaixes feitos pela IA para livros fora das listas, { id: { phase, position, reason } }.
// Eles entram na etapa indicada sem mexer na ordem dos livros do site.
export function buildReferencePlan(ref, books, { minutesPerDay = 45, fits = {} } = {}) {
  const kinds = classify(ref);
  const matches = matchBooks(ref, books);
  const byId = Object.fromEntries(books.map((b) => [b.id, b]));
  const placed = new Map(); // id -> hit escolhido
  for (const [id, hits] of Object.entries(matches)) placed.set(id, hits[0]);
  const isDone = (b) => b?.status === 'lido' && !b.reread;
  const hours = (b) => Number(b?.ai?.hours) || 0;
  const weeks = (rows) => {
    const h = rows.reduce((n, x) => n + (x.id ? (isDone(byId[x.id]) ? 0 : hours(byId[x.id])) : 0), 0);
    return h ? Math.max(1, Math.round((h * 60) / minutesPerDay / 7)) : null;
  };

  const spine = ref.lists.find((l) => l.slug === SPINE_SLUG);
  const levels = [...new Set(spine.sections.map(spineLevel).filter((n) => n >= 0))].sort((a, b) => a - b);
  const phases = [];
  const parallelRows = [];

  // 1) Filosofia, nível a nível, com todos os livros principais (os que faltam aparecem como tal).
  const spinePhase = (n) => {
    const rows = [];
    let optionalMissing = 0;
    spine.sections.forEach((s, si) => {
      if (spineLevel(s) !== n) return;
      const sub = s.path.split(' › ').slice(1).join(' › ') || s.level;
      s.items.forEach((item, ii) => {
        const owner = [...placed].find(([, h]) => h.slug === SPINE_SLUG && h.si === si && h.ii === ii)?.[0];
        if (s.parallel) { if (owner) parallelRows.push({ id: owner, reason: `Filosofia › ${sub}: pode ser lido junto com qualquer nível, depois dos Prolegômenos` }); return; }
        if (owner) rows.push({ id: owner, reason: s.optional ? `${sub} (leitura complementar, opcional)` : sub });
        else if (s.optional) optionalMissing++;
        else rows.push({ missing: true, ...splitItem(item), reason: sub });
      });
    });
    return { key: `nivel-${n}`, name: LEVEL_NAME(n), goal: LEVEL_GOAL[n] || '', kind: 'spine', link: spine.url, optionalMissing, books: rows };
  };

  // 2) Listas de área, cada uma depois do nível de Filosofia que o Polímata pede, na ordem do programa.
  // Todas as listas de área do programa ganham sua etapa (mesmo vazia), para a IA poder encaixar
  // nelas livros de fora das listas; etapas que continuarem vazias somem no fim.
  const subjectPhases = new Map(); // gate -> fases
  const subjectPhase = (slug) => {
    const k = kinds[slug];
    const arr = subjectPhases.get(k.gate) || [];
    let ph = arr.find((x) => x.key === slug);
    if (!ph) {
      const list = ref.lists.find((l) => l.slug === slug);
      ph = { key: slug, rank: k.rank, name: shortName(list.title), kind: 'subject', link: list.url, books: [],
        goal: k.needs ? `Segundo o Projeto do Polímata, estude junto: ${k.needs}` : 'Lista de área do programa, depois da Filosofia.' };
      arr.push(ph);
      subjectPhases.set(k.gate, arr);
    }
    return ph;
  };
  for (const o of ref.program?.order || []) if (o.slug && kinds[o.slug]?.kind === 'subject') subjectPhase(o.slug);
  const others = { author: [], literature: [], aux: [] };
  for (const [id, h] of placed) {
    const k = kinds[h.slug];
    if (k.kind === 'spine') continue;
    if (k.kind === 'subject') subjectPhase(h.slug).books.push({ id, reason: h.path || `Lista de ${shortName(h.list)}`, _o: h.si * 1000 + h.ii });
    else others[k.kind].push({ id, h });
  }

  for (const n of levels) {
    phases.push(spinePhase(n));
    for (const ph of (subjectPhases.get(n) || []).sort((a, b) => a.rank - b.rank)) {
      ph.books.sort((a, b) => a._o - b._o).forEach((x) => delete x._o);
      phases.push({ key: ph.key, name: ph.name, goal: ph.goal, kind: ph.kind, link: ph.link, books: ph.books });
    }
  }

  // 3) Listas por autor: sem ordem entre si, cada uma na ordem interna do site.
  if (others.author.length) {
    const rows = others.author.sort((a, b) => a.h.slug.localeCompare(b.h.slug) || a.h.si - b.h.si || a.h.ii - b.h.ii)
      .map(({ id, h }) => ({ id, reason: `${shortName(h.list)}${h.path ? ` › ${h.path}` : ''}` }));
    phases.push({ key: 'autor', name: 'Listas por autor', kind: 'author', link: REFERENCE.program,
      goal: 'Aprofundamento em autores específicos. O site não define ordem entre estas listas, só a ordem interna de cada uma.', books: rows });
  }

  // 4) Em paralelo: literatura (sem ordem), livros "não propriamente filosóficos" e listas auxiliares.
  for (const { id, h } of [...others.literature, ...others.aux]) parallelRows.push({ id, reason: `${shortName(h.list)}${h.path ? ` › ${h.path}` : ''}` });
  let outside = books.filter((b) => !placed.has(b.id) && b.ownership !== 'vendido' && b.status !== 'abandonado').map((b) => ({ id: b.id, reason: 'Não aparece nas listas do site' }));

  const parallelTrack = { key: 'paralelo', name: 'Em paralelo', kind: 'parallel', link: REFERENCE.url, books: parallelRows,
    goal: 'Literatura não tem ordem de leitura no site e acompanha os estudos; o mesmo vale para os livros de apoio. O site recomenda literatura desde cedo a quem tem pouca bagagem literária.' };

  // Encaixes da IA: cada livro de fora das listas vai para a etapa indicada, depois do item de número
  // "position" daquela etapa (0 = no início). Os Prolegômenos não recebem nada, como pede o site.
  const fitted = new Set();
  for (const ph of [...phases, parallelTrack]) {
    if (ph.key === 'nivel-0') continue;
    const mine = outside.filter((x) => fits[x.id]?.phase === ph.key).map((x) => ({ x, f: fits[x.id] }));
    if (!mine.length) continue;
    const size = ph.books.length;
    const at = (i) => mine.filter(({ f }) => Math.min(Math.max(0, Math.round(Number(f.position) || 0)), size) === i)
      .map(({ x, f }) => { fitted.add(x.id); return { id: x.id, fit: true, reason: `Encaixe da IA: ${String(f.reason || '').slice(0, 300)}` }; });
    const out = [...at(0)];
    ph.books.forEach((row, i) => out.push(row, ...at(i + 1)));
    ph.books = out;
  }
  outside = outside.filter((x) => !fitted.has(x.id));
  for (const ph of phases) ph.weeks = weeks(ph.books);

  const tracks = [];
  if (parallelTrack.books.length) tracks.push({ ...parallelTrack, weeks: null });
  if (outside.length) tracks.push({ key: 'fora', name: 'Fora das listas', kind: 'outside', link: REFERENCE.program, weeks: null, books: outside,
    goal: 'Seus livros que não estão nas listas. O site pede que nada seja acrescentado aos Prolegômenos; leia estes depois deles, como leitura livre, ou peça à IA para encaixá-los na sequência.' });

  // Fase atual: a primeira da sequência com livro principal ainda não lido (os que faltam contam).
  const pending = (x) => (x.missing ? true : !isDone(byId[x.id]) && byId[x.id]?.status !== 'abandonado');
  const current = phases.find((ph) => ph.books.some(pending));
  const reading = books.filter((b) => b.status === 'lendo');
  const now = [];
  for (const b of reading.slice(0, 3)) now.push({ id: b.id, role: b.format === 'audiobook' ? 'audiobook' : 'principal', reason: placed.has(b.id) ? `Em andamento. ${shortName(placed.get(b.id).list)}${placed.get(b.id).path ? ` › ${placed.get(b.id).path}` : ''}.` : 'Em andamento.' });
  const nextOwned = current?.books.find((x) => x.id && pending(x) && !now.some((n) => n.id === x.id));
  if (now.length < 3 && nextOwned) now.push({ id: nextOwned.id, role: 'principal', reason: `Próximo livro da sequência do site: ${current.name} › ${nextOwned.reason}.` });
  const nextParallel = parallelRows.find((x) => pending(x) && !now.some((n) => n.id === x.id));
  if (now.length < 3 && nextParallel) now.push({ id: nextParallel.id, role: 'paralelo', reason: `Leitura em paralelo, sem ordem fixa no site (${nextParallel.reason}).` });

  const owned = books.filter((b) => placed.has(b.id)).length;
  const missing = current ? current.books.filter((x) => x.missing) : [];
  const ownedInCurrent = current ? current.books.filter((x) => x.id) : [];
  const summary = [
    `Plano montado diretamente das listas do Contra os Acadêmicos, na ordem do Ordenamento das Leituras: Prolegômenos, Filosofia nível a nível, e as listas de área conforme o Projeto do Polímata.`,
    current ? `Você está em ${current.name}: tem ${ownedInCurrent.length} dos ${current.books.length} livros desta etapa${missing.length ? `; faltam ${missing.length} (marcados como “falta”)` : ''}.` : 'Você já percorreu todos os livros da sequência que estão na sua estante.',
    `${owned} dos seus ${books.length} livros aparecem nas listas${fitted.size ? `; ${plural(fitted.size, 'foi encaixado', 'foram encaixados')} pela IA na sequência` : ''}${outside.length ? `; ${outside.length} ficam em “Fora das listas”` : ''}.`,
  ].join(' ');

  const plan = {
    summary, source: 'referencia', mode: 'ref', reference: REFERENCE.name, generatedAt: new Date().toISOString(),
    phases: [...phases.filter((p) => p.books.length), ...tracks],
    now, parallel: [], rereads: [],
    routine: [
      'Termine os Prolegômenos antes de começar outra lista: é a regra mais enfatizada pelo site.',
      'Dentro de cada nível de Filosofia, siga a ordem numerada da lista.',
      'Literatura pode ser lida a qualquer momento e em qualquer ordem, junto com os estudos.',
      'Depois dos Prolegômenos, não se prenda a uma única lista: alterne entre as áreas.',
      'Leituras complementares são opcionais; use-as quando um autor ficar difícil.',
    ],
  };
  // Todas as etapas possíveis, inclusive as ainda vazias, para os encaixes da IA (não vai no JSON).
  Object.defineProperty(plan, 'slots', { value: [...phases, parallelTrack], enumerable: false });
  return plan;
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// Etapas em que a IA pode encaixar livros de fora das listas, com os livros do site em ordem
// (para ela indicar a posição). Os Prolegômenos ficam de fora, como pede o site.
export function fitTargets(plan, books) {
  const title = Object.fromEntries(books.map((b) => [b.id, b.title]));
  const out = (plan.slots || plan.phases).filter((ph) => ph.key && ph.key !== 'nivel-0' && ph.kind !== 'outside').map((ph) => ({
    key: ph.key, name: ph.name, goal: ph.goal,
    items: ph.books.filter((x) => !x.fit).map((x) => (x.missing ? x.title : title[x.id])).filter(Boolean),
  }));
  // A trilha paralela existe mesmo sem livros, para receber literatura e leituras de lazer.
  if (!out.some((t) => t.key === 'paralelo')) out.push({ key: 'paralelo', name: 'Em paralelo', goal: 'Literatura e leituras de apoio, sem ordem, junto com qualquer etapa.', items: [] });
  return out;
}

// Valida a resposta da IA: só livros que estão fora das listas, etapas que existem, posição válida.
export function sanitizeFits(raw, targets, outsideIds) {
  const keys = new Map(targets.map((t) => [t.key, t]));
  const out = {};
  for (const f of Array.isArray(raw) ? raw : []) {
    if (!f || !outsideIds.has(f.id) || !keys.has(f.phase)) continue;
    const n = keys.get(f.phase).items.length;
    out[f.id] = { phase: f.phase, position: Math.min(Math.max(0, Math.round(Number(f.position) || 0)), n), reason: String(f.reason || '').slice(0, 300) };
  }
  return out;
}

// ---------------------------------------------------------------- contexto para as sugestões
// Texto curto para o Descobrir no modo "Contra os Acadêmicos": onde o leitor está na sequência e
// os livros que faltam, na ordem do site.
export function referenceContext(ref, books, { candidates = 0 } = {}) {
  if (!ref) return null;
  const plan = buildReferencePlan(ref, books);
  const seq = plan.phases.filter((p) => ['spine', 'subject'].includes(p.kind));
  const isPending = (x) => x.missing || books.find((b) => b.id === x.id)?.status !== 'lido';
  const current = seq.find((p) => p.books.some(isPending));
  const lines = [
    'Programa do site ("O Ordenamento das Leituras"): primeiro os Prolegômenos da lista de Filosofia, por inteiro e sem outros livros; depois Filosofia nível 1, 2 e 3, em ordem; as listas de área entram conforme o Projeto do Polímata; literatura acompanha tudo, sem ordem.',
    'Pré-requisitos do Projeto do Polímata:',
    ...(ref.program?.prerequisites || []).map((p) => `- ${p}`),
    '',
    'Sequência do leitor (montada a partir do site):',
    ...seq.map((p) => `- ${p.name}: ${p.books.map((x) => (x.missing ? `[falta] ${x.title}` : books.find((b) => b.id === x.id)?.title)).filter(Boolean).slice(0, 25).join('; ')}`),
  ];
  const byBook = {};
  for (const ph of plan.phases) for (const x of ph.books) if (x.id) byBook[x.id] = `${ph.name} › ${x.reason}`;
  // Próximos passos: o que falta na etapa atual e na seguinte, na ordem do site.
  const next = [];
  if (candidates) {
    const from = current ? seq.indexOf(current) : 0;
    for (const p of seq.slice(from, from + 2)) for (const x of p.books) if (x.missing && next.length < candidates) next.push(`${x.title}${x.author ? ` – ${x.author}` : ''} [${p.name} › ${x.reason}]`);
  }
  return { text: lines.join('\n'), byBook, next, current: current?.name || '' };
}
