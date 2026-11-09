// Capas: busca candidatas em várias fontes, valida a imagem e salva uma cópia local
// em data/covers/<id>.<ext> (assim a capa não some quando o site original muda).
import fs from 'node:fs/promises';
import path from 'node:path';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const firstAuthor = (a) => String(a || '').split(/\s+e\s+|,|;|&/)[0].trim();

async function get(url, { as = 'json', timeout = 9000 } = {}) {
  const r = await fetch(url, {
    signal: AbortSignal.timeout(timeout), redirect: 'follow',
    headers: { 'User-Agent': UA, 'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.6' },
  });
  if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status}`), { status: r.status });
  return as === 'json' ? r.json() : as === 'text' ? r.text() : r;
}

// ---------------------------------------------------------------- fontes
const GOOD_HOSTS = /estantevirtual|amazon|goodreads|mlstatic|saraiva|travessa|livrariacultura|skoob|martinsfontes|companhiadasletras|record|zahar|edipro|openlibrary|books\.google|audible|storytel|leitura|livrariavila|grupoautentica|todavia|ubu|vozes|paulus|erealizacoes|vide/i;
const BAD_HOSTS = /slideshare|youtube|ytimg|pinterest|facebook|instagram|wikimedia\.org\/.*\.svg|scribd|pdf/i;

const STOP = new Set(['uma', 'uns', 'umas', 'dos', 'das', 'del', 'the', 'and', 'com', 'sem', 'por', 'para', 'que', 'outros', 'volume', 'vol']);
const words = (s) => [...new Set(norm(s).split(' ').filter((w) => w.length > 2 && !STOP.has(w)))];
const ROMAN = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10 };
// Número de volume/parte: "Volume 2", "Vol. II", "Diálogos III".
function volumeOf(s) {
  const m = norm(s).match(/\b(?:volume|vol|livro|tomo|parte)\s+(\d+|[ivx]+)\b/) || norm(s).match(/\b(i{1,3}|iv|vi{0,3}|ix|x)\b(?!.*\b(i{1,3}|iv|vi{0,3}|ix|x)\b)/);
  if (!m) return null;
  return /^\d+$/.test(m[1]) ? Number(m[1]) : ROMAN[m[1]] ?? null;
}

// Pontuação de uma candidata. "match" (0–1) mede quanto do título principal aparece na legenda.
function relevance(label, url, title, author) {
  const l = norm(label);
  const main = title.split(/[:—–]|\s-{1,3}\s/)[0]; // título sem subtítulo
  const mainWords = words(main);
  const allWords = words(title);
  const frac = (ws) => (ws.length ? ws.filter((w) => l.includes(w)).length / ws.length : 0);
  const match = frac(mainWords);
  const sur = words(firstAuthor(author)).pop();
  let s = match * 5 + frac(allWords) * 2;
  if (sur && (l.includes(sur) || norm(url).includes(sur))) s += 1.5;
  if (GOOD_HOSTS.test(url)) s += 1.5;
  if (BAD_HOSTS.test(url)) s -= 6;
  if (/capa|cover|livro|book/.test(l)) s += 0.3;
  const vt = volumeOf(title);
  const vl = volumeOf(label);
  if (vt && vl && vt !== vl) s -= 5; // volume errado
  if (vt && vl === vt) s += 1.5;
  return { score: s, match };
}

// Busca de imagens do Bing (HTML público, sem chave). Cada resultado traz um JSON no atributo "m".
async function bing(title, author, extra = 'livro capa') {
  const q = `"${title}" ${firstAuthor(author)} ${extra}`.trim();
  const html = await get(`https://www.bing.com/images/search?q=${encodeURIComponent(q)}&form=HDRSC2&first=1`, { as: 'text' });
  const out = [];
  const re = /\bm="(\{[^"]*?\})"/g;
  let m;
  while ((m = re.exec(html)) && out.length < 24) {
    try {
      const j = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
      if (j.murl) out.push({ url: j.murl, thumb: j.turl || j.murl, label: j.t || '', source: 'bing' });
    } catch { /* ignora item malformado */ }
  }
  return out;
}

async function openLibrary(title, author) {
  const params = new URLSearchParams({ title, limit: '5', fields: 'cover_i,title,author_name,number_of_pages_median' });
  if (author) params.set('author', firstAuthor(author));
  const data = await get(`https://openlibrary.org/search.json?${params}`);
  return (data.docs || []).filter((d) => d.cover_i).map((d) => ({
    url: `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg`,
    thumb: `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg`,
    label: `${d.title} ${(d.author_name || []).join(' ')}`, source: 'openlibrary', pages: d.number_of_pages_median || null,
  }));
}

// A cota anônima do Google Books esgota com frequência: depois de um 429, pula por 1 hora.
let googleBlockedUntil = 0;
async function googleBooks(title, author) {
  if (Date.now() < googleBlockedUntil) return [];
  const q = [`intitle:${title}`, author ? `inauthor:${firstAuthor(author)}` : ''].filter(Boolean).join('+');
  try {
    const data = await get(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=6&printType=books`);
    return (data.items || []).filter((i) => i.volumeInfo?.imageLinks?.thumbnail).map((i) => {
      const v = i.volumeInfo;
      const url = v.imageLinks.thumbnail.replace(/^http:/, 'https:').replace('&edge=curl', '').replace('zoom=1', 'zoom=2');
      return { url, thumb: url, label: `${v.title} ${(v.authors || []).join(' ')}`, source: 'google', pages: v.pageCount || null };
    });
  } catch (e) {
    if (e.status === 429 || e.status === 403) googleBlockedUntil = Date.now() + 3600_000;
    return [];
  }
}

/** Candidatas ordenadas da mais provável para a menos provável. */
export async function coverCandidates(title, author, format = 'fisico') {
  const extra = format === 'audiobook' ? 'audiobook capa' : 'livro capa';
  const results = await Promise.allSettled([bing(title, author, extra), googleBooks(title, author), openLibrary(title, author)]);
  const all = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
  const seen = new Set();
  return all
    .map((c, i) => { const r = relevance(c.label, c.url, title, author); return { ...c, score: r.score - i * 0.01, match: r.match }; })
    .filter((c) => (seen.has(c.url) ? false : seen.add(c.url)))
    .sort((a, b) => b.score - a.score);
}

// ---------------------------------------------------------------- imagem
// Lê largura/altura do cabeçalho (JPEG, PNG, GIF, WebP) sem dependências.
export function imageInfo(buf) {
  if (buf.length < 30) return null;
  if (buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG') return { ext: 'png', w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  if (buf.toString('ascii', 0, 3) === 'GIF') return { ext: 'gif', w: buf.readUInt16LE(6), h: buf.readUInt16LE(8) };
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const kind = buf.toString('ascii', 12, 16);
    if (kind === 'VP8X') return { ext: 'webp', w: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3) };
    if (kind === 'VP8L') { const b = buf.readUInt32LE(21); return { ext: 'webp', w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1 }; }
    if (kind === 'VP8 ') return { ext: 'webp', w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
    return null;
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const marker = buf[i + 1];
      const len = buf.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { ext: 'jpg', h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
      }
      i += 2 + len;
    }
  }
  return null;
}

function looksLikeCover(info, format) {
  if (!info || info.w < 120 || info.h < 150) return false;
  const ratio = info.h / info.w;
  // Livros: retrato. Audiobooks costumam ter capa quadrada.
  return format === 'audiobook' ? ratio >= 0.9 && ratio <= 1.8 : ratio >= 1.15 && ratio <= 2.0;
}

export async function download(url, { format = 'fisico', strict = true } = {}) {
  const r = await get(url, { as: 'raw', timeout: 10000 });
  const len = Number(r.headers.get('content-length') || 0);
  if (len > 8_000_000) throw new Error('imagem grande demais');
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > 8_000_000) throw new Error('imagem grande demais');
  const info = imageInfo(buf);
  if (!info) throw new Error('não é uma imagem suportada');
  if (strict && !looksLikeCover(info, format)) throw new Error('proporção não parece capa');
  return { buf, ...info };
}

// ---------------------------------------------------------------- armazenamento
export function coversDir(dataDir) { return path.join(dataDir, 'covers'); }
const safeId = (id) => (/^[\w-]{1,40}$/.test(id) ? id : null);

async function store(dataDir, id, buf, ext) {
  const dir = coversDir(dataDir);
  await fs.mkdir(dir, { recursive: true });
  // Remove versões antigas com outra extensão.
  for (const e of ['jpg', 'png', 'webp', 'gif']) if (e !== ext) await fs.rm(path.join(dir, `${id}.${e}`), { force: true });
  await fs.writeFile(path.join(dir, `${id}.${ext}`), buf);
  return `/covers/${id}.${ext}?v=${Date.now().toString(36)}`;
}

/** Procura e salva automaticamente a melhor capa. Devolve { cover, pages, source }. */
export async function autoCover(dataDir, { id, title, author, format }) {
  if (!safeId(id)) throw Object.assign(new Error('id inválido'), { status: 400 });
  const cands = await coverCandidates(title, author, format);
  const pages = cands.find((c) => c.pages)?.pages || null;
  // Tenta as mais relevantes; para cada uma, a imagem original e depois a miniatura.
  // Automático só aceita candidatas cujo título principal bate (≥ 60% das palavras);
  // na dúvida, fica a capa gerada e o usuário escolhe em "Trocar capa".
  for (const c of cands.filter((x) => x.match >= 0.6 && x.score > 3).slice(0, 8)) {
    for (const url of [...new Set([c.url, c.thumb])]) {
      try {
        const img = await download(url, { format });
        return { cover: await store(dataDir, id, img.buf, img.ext), pages, source: c.source };
      } catch { /* próxima */ }
    }
  }
  return { cover: null, pages, source: null };
}

/** Salva uma URL escolhida pelo usuário (validação de proporção mais branda). */
export async function coverFromUrl(dataDir, { id, url, thumb, format }) {
  if (!safeId(id)) throw Object.assign(new Error('id inválido'), { status: 400 });
  if (!/^https?:\/\//.test(url || '')) throw Object.assign(new Error('URL inválida'), { status: 400 });
  for (const u of [...new Set([url, thumb].filter(Boolean))]) {
    try {
      const img = await download(u, { format, strict: false });
      return { cover: await store(dataDir, id, img.buf, img.ext) };
    } catch { /* tenta a miniatura */ }
  }
  throw Object.assign(new Error('Não consegui baixar essa imagem.'), { status: 422 });
}

/** Salva uma imagem enviada/colada pelo usuário (base64). */
export async function coverFromUpload(dataDir, { id, data }) {
  if (!safeId(id)) throw Object.assign(new Error('id inválido'), { status: 400 });
  const buf = Buffer.from(String(data || ''), 'base64');
  const info = imageInfo(buf);
  if (!info) throw Object.assign(new Error('Imagem não reconhecida (use JPG, PNG, WebP ou GIF).'), { status: 400 });
  return { cover: await store(dataDir, id, buf, info.ext) };
}

export async function removeCover(dataDir, id) {
  if (!safeId(id)) return;
  for (const e of ['jpg', 'png', 'webp', 'gif']) await fs.rm(path.join(coversDir(dataDir), `${id}.${e}`), { force: true });
}
