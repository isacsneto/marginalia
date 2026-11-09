// Marginália: interface em JS puro, sem build. Estado único + render por string.

// ============================================================ utilidades
const $ = (s, el = document) => el.querySelector(s);
const TOUCH = matchMedia('(pointer: coarse)').matches; // celular/tablet: sem Ctrl+V, com câmera
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
// Centavos só quando existem: R$ 40 / R$ 39,90.
const money = (n) => {
  const v = Number(n) || 0;
  const cents = Math.round(v * 100) % 100 !== 0;
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 });
};
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* sem storage */ } },
};

const ICONS = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
  headphones: '<path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1v-6h3zM3 19a2 2 0 0 0 2 2h1v-6H3z"/>',
  tablet: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M11 18h2"/>',
  sparkles: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/>',
  compass: '<circle cx="12" cy="12" r="10"/><path d="m16.2 7.8-2.1 6.3-6.3 2.1 2.1-6.3z"/>',
  map: '<path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/>',
  cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.7 12.4a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.6L21 7H6"/>',
  external: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4L21 8"/><path d="M21 3v5h-5"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
  upload: '<path d="M12 21V9M7 14l5-5 5 5M5 3h14"/>',
  star: '<path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z"/>',
  pen: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  shelf: '<path d="M3 21h18M5 21V5M9 21V3M13 21V6M17 21l2.5-14"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
};
const icon = (n) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`;

// ============================================================ domínio
const STATUS = { quero_ler: 'Quero ler', lendo: 'Lendo', pausado: 'Pausado', lido: 'Lido', abandonado: 'Abandonado' };
const FORMAT = { fisico: 'Físico', audiobook: 'Audiobook', ebook: 'E-book' };
const FORMAT_ICON = { fisico: 'book', audiobook: 'headphones', ebook: 'tablet' };
const OWNERSHIP = { tenho: 'Na estante', desejo: 'Lista de desejos', emprestado: 'Emprestado', vendido: 'Vendido' };
const NATURE_TAG = { 'teórico': 'info', 'prático': 'ok', 'narrativo': 'accent', 'misto': 'warn' };
const CATEGORY_HUE = {
  'Filosofia': 222, 'Lógica e Método': 196, 'Política': 352, 'Economia': 145, 'Investimentos e Negócios': 165,
  'Religião e Espiritualidade': 42, 'História': 28, 'Ciência': 205, 'Psicologia': 280, 'Desenvolvimento Pessoal': 310,
  'Tecnologia': 185, 'Literatura': 12, 'Poesia': 330, 'Outros': 30,
};
const NOTE_FIELDS = [
  ['tese', 'Tese central'], ['argumentos', 'Principais argumentos'], ['conceitos', 'Conceitos novos'],
  ['concordo', 'Pontos com os quais concordo'], ['discordo', 'Pontos dos quais discordo'],
  ['relacoes', 'Relações com outros livros'], ['duvidas', 'Dúvidas para pesquisar'], ['livre', 'Anotações livres'],
];

function newBook(p = {}) {
  const now = new Date().toISOString();
  return {
    id: uid(), title: '', author: '', format: 'fisico', ownership: 'tenho', status: 'quero_ler',
    progress: { current: 0, total: null }, rating: 0, cover: null, coverTried: false,
    notes: {}, purchase: {}, sale: {}, loan: {}, ai: null, guide: null,
    userPhase: null, priority: false, startedAt: null, finishedAt: null, createdAt: now, updatedAt: now,
    ...p,
  };
}
const isAudio = (b) => b.format === 'audiobook';
const unitLabel = (b) => (isAudio(b) ? 'min' : 'pág.');
function pct(b) {
  if (b.status === 'lido') return 100;
  const t = Number(b.progress?.total);
  return t > 0 ? clamp(Math.round((Number(b.progress.current) || 0) / t * 100), 0, 100) : 0;
}
function fmtAmount(b, v) {
  if (v == null || v === '') return '—';
  if (!isAudio(b)) return `${v}`;
  const h = Math.floor(v / 60), m = Math.round(v % 60);
  return h ? `${h}h${String(m).padStart(2, '0')}` : `${m}min`;
}
function hueFor(b) {
  const c = b.ai?.category;
  if (c && CATEGORY_HUE[c] != null) return CATEGORY_HUE[c];
  let h = 0;
  for (const ch of b.title || '') h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}
function remainingHours(b) {
  if (['lido', 'abandonado'].includes(b.status) || b.ownership === 'vendido') return 0;
  const h = Number(b.ai?.hours) || 0;
  return h * (1 - pct(b) / 100);
}

// ============================================================ estado
const state = {
  library: { books: [], plan: null, suggestions: null },
  settings: {}, providers: [],
  view: 'estante',
  filters: { q: '', status: 'todos', format: '', ownership: '', category: '' },
  sort: store.get('sort') || 'plano',
  drawer: { id: null, tab: 'geral' },
  busy: {}, // chave -> timestamp de início
  classifyProgress: null,
  importDraft: null,
};
const books = () => state.library.books;
const byId = (id) => books().find((b) => b.id === id);

// ============================================================ API
async function api(method, url, data) {
  const hasBody = method !== 'GET';
  const res = await fetch(url, {
    method, headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
    body: hasBody ? JSON.stringify(data ?? {}) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Erro ${res.status}`);
  return json;
}

// Salvamento: um PUT por vez; mudanças feitas durante um envio disparam outro em seguida.
let saveTimer = null;
let savePending = false;
let saving = null;
let saveErrorShown = false;
function persist() {
  savePending = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, 350);
}
let conflict = false;
async function flushSave({ keepalive = false } = {}) {
  if (conflict) return;
  if (saving) { await saving; return flushSave({ keepalive }); }
  if (!savePending) return;
  savePending = false;
  const body = JSON.stringify(state.library);
  // keepalive faz o envio sobreviver ao fechamento da aba, mas só aceita corpos até 64 KB.
  const useKeepalive = keepalive && new Blob([body]).size < 64_000;
  saving = fetch('/api/library', { method: 'PUT', keepalive: useKeepalive, headers: { 'Content-Type': 'application/json' }, body })
    .then(async (res) => {
      const json = await res.json().catch(() => ({}));
      if (res.status === 409) {
        conflict = true;
        toast('Esta estante foi alterada em outra aba. Recarregando para mostrar a versão mais recente…', 'err');
        setTimeout(() => location.reload(), 2500);
        return;
      }
      if (!res.ok) throw new Error(json.error || `Erro ${res.status}`);
      state.library.savedAt = json.savedAt;
      saveErrorShown = false;
    })
    .catch((e) => {
      savePending = true;
      if (!saveErrorShown) { toast(`Não foi possível salvar (${e.message}). Tentando de novo…`, 'err'); saveErrorShown = true; }
      clearTimeout(saveTimer);
      saveTimer = setTimeout(flushSave, 5000);
    })
    .finally(() => { saving = null; });
  await saving;
}
// Salva assim que a aba some (troca de aba, minimizar ou fechar).
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { clearTimeout(saveTimer); flushSave({ keepalive: true }); }
});

function updateBook(id, patch) {
  const b = byId(id);
  if (!b) return;
  Object.assign(b, patch, { updatedAt: new Date().toISOString() });
  persist();
}
function setPath(obj, path, value) {
  const keys = path.split('.');
  let o = obj;
  for (const k of keys.slice(0, -1)) o = o[k] ??= {};
  o[keys.at(-1)] = value;
}

// ============================================================ toasts & busy
function toast(msg, type = '') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `${type === 'err' ? '' : icon('check')}<span>${esc(msg)}</span>`;
  $('#toasts').append(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, type === 'err' ? 7000 : 3200);
}

async function withBusy(key, fn) {
  if (state.busy[key]) return;
  state.busy[key] = Date.now();
  renderAll();
  try { return await fn(); }
  catch (e) { toast(e.message, 'err'); }
  finally { delete state.busy[key]; renderAll(); }
}
const isBusy = (k) => !!state.busy[k];
function busyBtn(key, label, attrs, cls = 'btn primary', ico = 'sparkles') {
  if (isBusy(key)) {
    return `<button class="${cls}" disabled><span class="spinner"></span>${esc(label.busy)} <span class="faint" data-elapsed="${key}"></span></button>`;
  }
  return `<button class="${cls}" ${attrs}>${icon(ico)}${esc(label.idle)}</button>`;
}
setInterval(() => {
  for (const el of $$('[data-elapsed]')) {
    const t = state.busy[el.dataset.elapsed];
    if (t) el.textContent = `${Math.round((Date.now() - t) / 1000)}s`;
  }
}, 1000);

// ============================================================ provedor ativo
const AUTO_ORDER = ['claude-cli', 'codex-cli', 'cursor-cli', 'anthropic-api', 'openai-api'];
function activeProvider() {
  const p = state.settings.provider;
  if (p && p !== 'auto') return state.providers.find((x) => x.id === p && x.available) || null;
  return AUTO_ORDER.map((id) => state.providers.find((x) => x.id === id)).find((x) => x?.available) || null;
}
function renderAiPill() {
  const p = activeProvider();
  const pill = $('.ai-pill');
  pill.classList.toggle('on', !!p);
  pill.classList.toggle('off', !p);
  $('.ai-name', pill).textContent = p ? p.label : 'Sem IA';
  pill.title = p ? `IA ativa: ${p.label} (${p.detail})` : 'Nenhuma IA disponível — clique para configurar';
}

// ============================================================ capas
function coverHTML(b, { size = '', badges = true } = {}) {
  const dim = b.ownership === 'vendido' || b.status === 'abandonado' ? ' dim' : '';
  const img = b.cover ? `<img src="${esc(b.cover)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : '';
  const p = pct(b);
  const gen = size === 'xs'
    ? `<div class="gen"><span class="ini">${esc((b.title || '?').replace(/^(o|a|os|as|um|uma)\s+/i, '').charAt(0))}</span></div>`
    : `<div class="gen"><div><div class="t">${esc(b.title)}</div><div class="rule"></div></div><div class="a">${esc(b.author)}</div></div>`;
  return `<div class="cover ${size}${dim}" style="--h:${hueFor(b)}">
    ${gen}
    ${img}
    ${badges && b.priority ? '<span class="ribbon" title="Prioritário"></span>' : ''}
    ${badges && b.format !== 'fisico' ? `<div class="badges"><span class="badge-ico" title="${FORMAT[b.format]}">${icon(FORMAT_ICON[b.format])}</span></div>` : ''}
    ${badges && b.status === 'lendo' && p > 0 ? `<div class="pbar"><span style="width:${p}%"></span></div>` : ''}
  </div>`;
}

// Capas automáticas: o servidor busca (Bing Imagens, Google Books, Open Library), valida
// a proporção e salva uma cópia local em data/covers. coverV marca livros já processados.
const COVER_V = 2;
const isLocalCover = (c) => typeof c === 'string' && c.startsWith('/covers/');
let coverQueueRunning = false;
async function fillCovers() {
  if (coverQueueRunning) return;
  coverQueueRunning = true;
  try {
    const queue = books().filter((b) => b.coverV !== COVER_V && !b.coverManual);
    if (!queue.length) return;
    const total = queue.length;
    let found = 0;
    const worker = async () => {
      while (queue.length) {
        const b = queue.shift();
        if (!byId(b.id)) continue; // excluído enquanto esperava
        try {
          let r = null;
          // Capa externa antiga: baixa uma cópia local; se falhar, busca outra.
          if (b.cover && !isLocalCover(b.cover)) {
            r = await api('POST', '/api/cover/set', { id: b.id, url: b.cover, format: b.format }).catch(() => null);
          }
          if (!r?.cover && !isLocalCover(b.cover)) {
            r = await api('POST', '/api/cover/auto', { id: b.id, title: b.title, author: b.author, format: b.format });
          }
          const patch = { coverV: COVER_V };
          if (r?.cover) { patch.cover = r.cover; found++; }
          if (r?.pages && !b.progress?.total && !isAudio(b)) patch.progress = { ...b.progress, total: r.pages };
          updateBook(b.id, patch);
          scheduleRender();
        } catch { /* offline: tenta de novo na próxima abertura */ }
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    if (total > 1 && found) toast(`${plural(found, 'capa encontrada', 'capas encontradas')}.`);
  } finally { coverQueueRunning = false; }
}

// ============================================================ imagens (screenshots)
// Reduz e recodifica no navegador: imagens grandes ficam leves sem perder legibilidade de texto.
async function prepImage(file, maxSide = 2000) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; // PNG com transparência vira fundo branco no JPEG
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close?.();
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.88));
  const data = await new Promise((resolve) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result).split(',')[1]);
    fr.readAsDataURL(blob);
  });
  return { mediaType: 'image/jpeg', data, url: URL.createObjectURL(blob) };
}
const imageFiles = (list) => [...(list || [])].filter((f) => f.type?.startsWith('image/'));

async function addPendingImages(files) {
  const imgs = imageFiles(files);
  if (!imgs.length) return;
  state.pendingImages ||= [];
  for (const f of imgs) {
    if (state.pendingImages.length >= 6) { toast('Máximo de 6 imagens por vez.', 'err'); break; }
    try { state.pendingImages.push(await prepImage(f)); } catch { toast(`Não consegui abrir ${f.name || 'a imagem'}.`, 'err'); }
  }
  if (modal().open && state.addTab === 'imagem') renderImageTab();
}

async function extractFromImages(el) {
  const imgs = state.pendingImages || [];
  if (!imgs.length) { toast('Adicione uma imagem primeiro.', 'err'); return; }
  if (!state.providers.some((p) => p.available && p.id !== 'cursor-cli')) { toast('Nenhuma IA que leia imagens está disponível.', 'err'); return; }
  await busyButton(el, 'Lendo imagem', async () => {
    const r = await api('POST', '/api/ai/extract-image', { images: imgs.map(({ mediaType, data }) => ({ mediaType, data })) });
    if (!r.books.length) { toast('Não encontrei livros nessa imagem.', 'err'); return; }
    for (const i of imgs) URL.revokeObjectURL(i.url);
    state.pendingImages = [];
    state.importDraft = { books: r.books, phases: [], source: r.source };
    if (modal().open) openAdd('imagem');
  });
}

// ============================================================ IA
async function classify(ids) {
  const targets = ids.map(byId).filter(Boolean);
  if (!targets.length) return;
  if (isBusy('classify')) { toast('Já há uma classificação em andamento.'); return; }
  if (!activeProvider()) { openSettings(); toast('Configure uma IA para classificar.', 'err'); return; }
  const BATCH = 6;
  const PARALLEL = 2; // dois lotes por vez: ~2x mais rápido sem estourar limites do CLI
  const library = books().map((b) => ({ id: b.id, title: b.title, author: b.author }));
  const batches = [];
  for (let i = 0; i < targets.length; i += BATCH) batches.push(targets.slice(i, i + BATCH));
  state.classifyProgress = { done: 0, total: targets.length };
  await withBusy('classify', async () => {
    let failures = 0;
    const worker = async () => {
      while (batches.length && failures < 2) {
        const batch = batches.shift();
        try {
          const { results, provider } = await api('POST', '/api/ai/classify', {
            books: batch.map((b) => ({ id: b.id, title: b.title, author: b.author, format: b.format })), library,
          });
          for (const r of results) applyClassification(r, provider);
        } catch (e) {
          failures++;
          toast(`Falha em um lote: ${e.message}`, 'err');
        }
        state.classifyProgress.done += batch.length;
        renderAll();
      }
    };
    await Promise.all(Array.from({ length: PARALLEL }, worker));
    const ok = targets.filter((b) => byId(b.id)?.ai).length;
    if (ok) toast(`${plural(ok, 'livro classificado', 'livros classificados')}.`);
  });
  state.classifyProgress = null;
  renderAll();
}

function applyClassification(r, provider) {
  const b = byId(r.id);
  if (!b) return;
  const valid = new Set(books().map((x) => x.id));
  const patch = {
    ai: {
      category: r.category || 'Outros', subcategory: r.subcategory || '', nature: r.nature || '',
      difficulty: clamp(Number(r.difficulty) || 3, 1, 5), pages: Number(r.pages) || null, hours: Number(r.hours) || null,
      intro: r.intro || '', why: r.why || '', themes: Array.isArray(r.themes) ? r.themes : [],
      prerequisites: Array.isArray(r.prerequisites) ? r.prerequisites : [],
      related: (Array.isArray(r.related) ? r.related : []).filter((id) => valid.has(id) && id !== b.id),
      provider, classifiedAt: new Date().toISOString(),
    },
  };
  if (r.author && !/desconhecid/i.test(r.author) && !b.author) patch.author = r.author;
  if (patch.ai.pages && !b.progress?.total && !isAudio(b)) patch.progress = { ...b.progress, total: patch.ai.pages };
  updateBook(b.id, patch);
}

async function generatePlan() {
  if (!activeProvider()) { openSettings(); return; }
  const unclassified = books().filter((b) => !b.ai && b.ownership !== 'vendido').length;
  if (unclassified) toast(`Dica: ${plural(unclassified, 'livro ainda não classificado', 'livros ainda não classificados')}; o plano fica melhor depois de classificar.`);
  await withBusy('plan', async () => {
    const candidates = books().filter((b) => b.ownership !== 'vendido');
    const { plan } = await api('POST', '/api/ai/plan', { books: candidates });
    state.library.plan = sanitizePlan(plan);
    persist();
    toast('Plano de leitura atualizado.');
  });
}

function sanitizePlan(plan) {
  if (!plan || typeof plan !== 'object') return null;
  const valid = new Set(books().map((b) => b.id));
  const seen = new Set();
  const ref = (x) => (x && valid.has(x.id) ? { id: x.id, reason: str(x.reason), ...(x.role ? { role: str(x.role) } : {}) } : null);
  const phases = arr(plan.phases).filter((ph) => ph && typeof ph === 'object').map((ph) => ({
    name: str(ph.name) || 'Fase', goal: str(ph.goal), weeks: Number(ph.weeks) || null,
    books: arr(ph.books).map(ref).filter((x) => x && !seen.has(x.id) && seen.add(x.id)),
  })).filter((ph) => ph.books.length);
  return {
    summary: str(plan.summary), provider: str(plan.provider), source: str(plan.source), generatedAt: str(plan.generatedAt),
    phases,
    now: arr(plan.now).map(ref).filter(Boolean).slice(0, 3),
    parallel: arr(plan.parallel).map((p) => ({ reason: str(p?.reason), ids: arr(p?.ids).filter((id) => valid.has(id)) })).filter((p) => p.ids.length >= 2),
    routine: arr(plan.routine).map(str),
  };
}

// Valida a biblioteca inteira (ao abrir e ao restaurar backup): ids seguros, tipos corretos.
function sanitizeLibrary(lib) {
  const ids = new Set();
  const out = { ...lib };
  out.books = arr(lib?.books).filter((b) => b && typeof b === 'object' && str(b.title).trim()).map((b) => {
    let id = typeof b.id === 'string' && /^[\w-]{1,40}$/.test(b.id) && !ids.has(b.id) ? b.id : uid();
    ids.add(id);
    const base = newBook();
    return {
      ...base, ...b, id, title: str(b.title), author: str(b.author),
      format: FORMAT[b.format] ? b.format : 'fisico', ownership: OWNERSHIP[b.ownership] ? b.ownership : 'tenho',
      status: STATUS[b.status] ? b.status : 'quero_ler',
      progress: { ...base.progress, ...(b.progress && typeof b.progress === 'object' ? b.progress : {}) },
      notes: b.notes && typeof b.notes === 'object' ? b.notes : {},
      cover: /^(https?:\/\/|\/covers\/[\w-]+\.(jpg|png|webp|gif)(\?v=\w+)?$)/.test(str(b.cover)) ? b.cover : null,
    };
  });
  state.library = out; // sanitizePlan/Suggestions validam ids contra estes livros
  out.plan = sanitizePlan(lib?.plan);
  out.suggestions = lib?.suggestions ? sanitizeSuggestions(lib.suggestions) : null;
  return out;
}

// A IA pode devolver campos com tipo errado; sem isso, um .map em string quebraria a tela para sempre.
const arr = (v) => (Array.isArray(v) ? v : v ? [v] : []);
const str = (v) => (typeof v === 'string' ? v : v == null ? '' : String(v));
function sanitizeSuggestions(s) {
  const valid = new Set(books().map((b) => b.id));
  return {
    ...s,
    summary: str(s.summary),
    items: arr(s.items).filter((it) => it && it.title).map((it) => ({
      title: str(it.title), author: str(it.author), category: str(it.category), nature: str(it.nature),
      kind: str(it.kind), priority: clamp(Number(it.priority) || 3, 1, 3), why: str(it.why),
      complements: arr(it.complements).filter((id) => valid.has(id)),
    })),
  };
}
function sanitizeGuide(g) {
  const valid = new Set(books().map((b) => b.id));
  return {
    ...g,
    context: str(g.context), structure: str(g.structure), approach: str(g.approach), after: str(g.after),
    keyIdeas: arr(g.keyIdeas).map(str), watchFor: arr(g.watchFor).map(str), questions: arr(g.questions).map(str),
    connections: arr(g.connections).filter((c) => c && valid.has(c.id)).map((c) => ({ id: c.id, note: str(c.note) })),
  };
}

async function suggestBooks() {
  if (!activeProvider()) { openSettings(); return; }
  await withBusy('suggest', async () => {
    const { suggestions } = await api('POST', '/api/ai/suggest', { books: books() });
    state.library.suggestions = sanitizeSuggestions(suggestions);
    persist();
    toast('Novas sugestões prontas.');
  });
}

async function makeGuide(id) {
  const b = byId(id);
  if (!b) return;
  if (!activeProvider()) { openSettings(); return; }
  await withBusy(`guide:${id}`, async () => {
    const { guide } = await api('POST', '/api/ai/guide', {
      book: b, library: books().map((x) => ({ id: x.id, title: x.title, author: x.author })),
    });
    updateBook(id, { guide: sanitizeGuide(guide) });
    toast(`Guia de “${b.title}” pronto.`);
  });
}

// ============================================================ render: raiz
let renderTimer = null;
function scheduleRender() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(() => {
    // Um filtro aberto fecharia se a tela fosse redesenhada agora: tenta de novo depois.
    if (document.activeElement?.tagName === 'SELECT' && document.activeElement.closest('#view')) return scheduleRender();
    renderView();
  }, 250);
}

// Campos de texto do painel: redesenhar enquanto estão focados tiraria o cursor do usuário.
const isTextField = (el) => el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && !['checkbox', 'radio', 'range', 'button'].includes(el.type)));
let drawerDirty = false;
function renderAll() {
  renderView();
  if (!state.drawer.id) return;
  const a = document.activeElement;
  if (a?.closest?.('#drawer') && isTextField(a)) { drawerDirty = true; return; }
  renderDrawer();
}
// Redesenho adiado acontece quando o foco sai dos campos de texto do painel.
$('#drawer').addEventListener('focusout', () => {
  if (!drawerDirty) return;
  setTimeout(() => {
    const a = document.activeElement;
    if (!drawerDirty || !state.drawer.id || (a?.closest?.('#drawer') && isTextField(a))) return;
    drawerDirty = false;
    renderDrawer();
  }, 200);
});
function renderView() {
  const view = $('#view');
  const focused = document.activeElement;
  const restoreSearch = focused?.id === 'search' ? { start: focused.selectionStart } : null;
  for (const a of $$('.tabs a')) a.classList.toggle('active', a.dataset.view === state.view);
  const changedView = view.dataset.view !== state.view;
  view.dataset.view = state.view;
  view.innerHTML = state.view === 'plano' ? viewPlan() : state.view === 'descobrir' ? viewDiscover() : viewShelf();
  // A animação de entrada só roda ao trocar de seção, não a cada atualização.
  if (!changedView) view.firstElementChild?.classList.remove('fade-in');
  if (restoreSearch) {
    const s = $('#search');
    s.focus();
    s.setSelectionRange(restoreSearch.start, restoreSearch.start);
  }
}

// ============================================================ view: estante
function planOrder() {
  const order = new Map();
  let i = 0;
  for (const ph of state.library.plan?.phases || []) for (const x of ph.books) order.set(x.id, i++);
  return order;
}

function filteredBooks() {
  const f = state.filters;
  const q = norm(f.q);
  let list = books().filter((b) => {
    if (f.status !== 'todos' && b.status !== f.status) return false;
    if (f.format && b.format !== f.format) return false;
    if (f.ownership && b.ownership !== f.ownership) return false;
    if (f.category && b.ai?.category !== f.category) return false;
    if (q && !norm(`${b.title} ${b.author} ${b.ai?.category || ''} ${b.ai?.subcategory || ''} ${(b.ai?.themes || []).join(' ')}`).includes(q)) return false;
    return true;
  });
  const order = planOrder();
  const cmp = {
    plano: (a, b) => (order.get(a.id) ?? 1e6) - (order.get(b.id) ?? 1e6),
    titulo: (a, b) => a.title.localeCompare(b.title, 'pt'),
    autor: (a, b) => (a.author || '~').localeCompare(b.author || '~', 'pt'),
    recentes: (a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''),
    dificuldade: (a, b) => (a.ai?.difficulty || 9) - (b.ai?.difficulty || 9),
  }[state.sort] || (() => 0);
  return list.sort(cmp);
}

function viewShelf() {
  const all = books();
  if (!all.length) return emptyShelf();
  const reading = all.filter((b) => b.status === 'lendo');
  const read = all.filter((b) => b.status === 'lido').length;
  const readThisYear = all.filter((b) => b.status === 'lido' && (b.finishedAt || '').startsWith(String(new Date().getFullYear()))).length;
  const owned = all.filter((b) => b.ownership !== 'vendido' && b.ownership !== 'desejo');
  const spent = all.reduce((s, b) => s + (Number(b.purchase?.price) || 0), 0);
  const earned = all.reduce((s, b) => s + (Number(b.sale?.price) || 0), 0);
  const hours = all.reduce((s, b) => s + remainingHours(b), 0);
  const perDay = Number(state.settings.minutesPerDay) || 45;
  const weeks = hours ? Math.ceil((hours * 60) / perDay / 7) : 0;
  const pending = all.filter((b) => !b.ai);
  const counts = Object.fromEntries(Object.keys(STATUS).map((k) => [k, all.filter((b) => b.status === k).length]));
  const categories = [...new Set(all.map((b) => b.ai?.category).filter(Boolean))].sort();
  const list = filteredBooks();
  const f = state.filters;
  const audio = all.filter(isAudio).length;
  const cp = state.classifyProgress;

  return `<div class="fade-in">
    <div class="view-head">
      <div><h1>Sua estante</h1><p class="lede">${plural(all.length, 'livro', 'livros')} · ${read} lido${read === 1 ? '' : 's'}${reading.length ? ` · lendo ${reading.length}` : ''}</p></div>
    </div>

    <div class="stats">
      <div class="card stat"><div class="label">Acervo</div><div class="value">${owned.length}</div>
        <div class="sub">${audio ? `${plural(audio, 'audiobook', 'audiobooks')} · ` : ''}${spent ? `investido ${money(spent)}` : 'físicos e digitais'}${earned ? ` · vendas ${money(earned)}` : ''}</div></div>
      <div class="card stat"><div class="label">Lidos</div><div class="value">${read}<span class="faint" style="font-size:18px"> / ${all.length}</span></div>
        <div class="meter"><span style="width:${all.length ? (read / all.length) * 100 : 0}%"></span></div>${readThisYear ? `<div class="sub">${readThisYear} em ${new Date().getFullYear()}</div>` : ""}</div>
      <div class="card stat"><div class="label">Lendo agora</div><div class="value">${reading.length}</div>
        <div class="sub">${reading.length ? esc(reading.map((b) => b.title).slice(0, 2).join(' · ')) : 'escolha um livro para começar'}</div></div>
      <div class="card stat"><div class="label">Tempo restante</div><div class="value">${hours ? `${Math.round(hours)}h` : '—'}</div>
        <div class="sub">${hours ? `≈ ${plural(weeks, 'semana', 'semanas')} a ${perDay} min/dia` : 'classifique para estimar'}</div></div>
    </div>

    ${pending.length ? `<div class="banner">${icon('sparkles')}<div class="txt">${cp
      ? `Classificando com IA… <b>${cp.done}/${cp.total}</b>`
      : `<b>${plural(pending.length, 'livro sem classificação', 'livros sem classificação')}.</b> A IA identifica categoria, natureza (teórico/prático), dificuldade e escreve uma introdução.`}</div>
      ${busyBtn('classify', { idle: 'Classificar', busy: 'Classificando' }, 'data-action="classify-pending"', 'btn primary sm')}</div>` : ''}

    ${reading.length ? `<div class="section-title"><h2>Lendo agora</h2></div>
      <div class="now-row">${reading.map(nowCard).join('')}</div>` : ''}

    <div class="toolbar">
      <label class="search">${icon('search')}<input id="search" type="search" placeholder="Buscar título, autor, tema…" value="${esc(f.q)}" autocomplete="off"></label>
      <div class="chips">
        <button class="chip ${f.status === 'todos' ? 'active' : ''}" data-action="filter" data-key="status" data-value="todos">Todos <span class="n">${all.length}</span></button>
        ${Object.entries(STATUS).filter(([k]) => counts[k]).map(([k, v]) => `<button class="chip ${f.status === k ? 'active' : ''}" data-action="filter" data-key="status" data-value="${k}">${v} <span class="n">${counts[k]}</span></button>`).join('')}
      </div>
      <select class="select" data-filter="format" aria-label="Formato"><option value="">Formato</option>${Object.entries(FORMAT).map(([k, v]) => `<option value="${k}" ${f.format === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
      <select class="select" data-filter="ownership" aria-label="Acervo"><option value="">Acervo</option>${Object.entries(OWNERSHIP).map(([k, v]) => `<option value="${k}" ${f.ownership === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
      ${categories.length ? `<select class="select" data-filter="category" aria-label="Categoria"><option value="">Categoria</option>${categories.map((c) => `<option ${f.category === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>` : ''}
      <select class="select" data-sort aria-label="Ordenar">${[['plano', 'Ordem do plano'], ['titulo', 'Título'], ['autor', 'Autor'], ['dificuldade', 'Dificuldade'], ['recentes', 'Recentes']].map(([k, v]) => `<option value="${k}" ${state.sort === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
    </div>

    <div id="shelf-results">${shelfResults(list)}</div>
  </div>`;
}

function shelfResults(list = filteredBooks()) {
  return list.length ? `<div class="shelf">${list.map((b) => bookTile(b)).join('')}</div>`
    : `<div class="empty"><h2>Nada por aqui</h2><p>Nenhum livro corresponde aos filtros.</p><button class="btn" data-action="clear-filters">Limpar filtros</button></div>`;
}

function bookTile(b, size = '') {
  return `<button class="book" data-action="open-book" data-id="${b.id}" title="${esc(b.title)}">
    ${coverHTML(b, { size })}
    <div class="meta"><h3>${esc(b.title)}</h3><p>${esc(b.author || '—')}</p></div>
  </button>`;
}

function nowCard(b) {
  const p = pct(b);
  const step = isAudio(b) ? 30 : 10;
  return `<div class="card now-card" role="button" tabindex="0" data-action="open-book" data-id="${b.id}">
    ${coverHTML(b, { badges: false })}
    <div class="body">
      <h3>${esc(b.title)}</h3>
      <p class="muted small">${esc(b.author)}</p>
      <div class="progress-line">
        <div class="meter"><span style="width:${p}%"></span></div>
        <div class="row"><span>${p}%</span><span>${fmtAmount(b, b.progress?.current || 0)}${b.progress?.total ? ` / ${fmtAmount(b, b.progress.total)}` : ''} ${isAudio(b) ? '' : 'pág.'}</span></div>
        <div class="quick">
          <button class="btn sm" data-action="bump" data-id="${b.id}" data-step="${step}">+${step} ${unitLabel(b)}</button>
          <button class="btn sm ghost" data-action="finish" data-id="${b.id}">${icon('check')}Terminei</button>
        </div>
      </div>
    </div>
  </div>`;
}

function emptyShelf() {
  const path = state.settings.importPath;
  return `<div class="empty fade-in">
    <div class="art">${icon('shelf')}</div>
    <h2>Sua estante está vazia</h2>
    <p>Importe sua lista de livros (markdown ou texto livre) ou adicione um por um. Depois a IA classifica, apresenta cada obra e monta um plano de leitura.</p>
    <div class="actions">
      ${path ? `<button class="btn primary" data-action="import-default">${icon('file')}Importar ${esc(path.split(/[\\/]/).pop())}</button>` : ''}
      <button class="btn" data-action="open-add">${icon('plus')}Adicionar livros</button>
    </div>
  </div>`;
}

// ============================================================ view: plano
function viewPlan() {
  const plan = state.library.plan;
  const hasBooks = books().length > 0;
  const prov = activeProvider();
  const head = `<div class="view-head">
    <div><h1>Plano de leitura</h1><p class="lede">Ordem sugerida, o que ler em paralelo e por onde começar.</p></div>
    ${hasBooks ? `<div class="plan-controls">${busyBtn('plan', { idle: plan ? 'Refazer com IA' : 'Gerar com IA', busy: 'Montando plano' }, 'data-action="gen-plan"', plan ? 'btn' : 'btn primary', plan ? 'refresh' : 'sparkles')}</div>` : ''}
  </div>`;
  if (!plan) {
    return `<div class="fade-in">${head}<div class="empty">
      <div class="art">${icon('map')}</div>
      <h2>${hasBooks ? 'Nenhum plano ainda' : 'Adicione livros primeiro'}</h2>
      <p>${hasBooks ? `A IA vai ordenar seus livros em fases progressivas, sugerir leituras em paralelo e dizer por onde começar, considerando ${state.settings.minutesPerDay || 45} min de leitura por dia.` : 'O plano é montado a partir da sua estante.'}</p>
      ${hasBooks && !prov ? '<p class="small">Nenhuma IA configurada. <a href="#" data-action="open-settings">Configurar</a></p>' : ''}
    </div></div>`;
  }

  const done = (id) => byId(id)?.status === 'lido';
  let currentFound = false;
  const phases = plan.phases.map((ph, i) => {
    const allDone = ph.books.every((x) => done(x.id) || byId(x.id)?.status === 'abandonado');
    let cls = '';
    if (allDone) cls = 'done';
    else if (!currentFound) { cls = 'current'; currentFound = true; }
    const read = ph.books.filter((x) => done(x.id)).length;
    return `<div class="phase ${cls}">
      <div class="num">${allDone ? icon('check').replace('<svg', '<svg style="width:20px;height:20px;stroke:#fff;fill:none;stroke-width:2.5"') : i + 1}</div>
      <div class="card">
        <div class="phase-head">
          <div><h3>${esc(ph.name)}</h3>${ph.goal ? `<p class="goal">${esc(ph.goal)}</p>` : ''}</div>
          <div class="tags">${ph.weeks ? `<span class="tag">${icon('clock').replace('<svg', '<svg style="width:13px;height:13px;stroke:currentColor;fill:none;stroke-width:2"')}~${plural(ph.weeks, 'semana', 'semanas')}</span>` : ''}<span class="tag ${allDone ? 'ok' : ''}">${read}/${ph.books.length}</span></div>
        </div>
        <div class="phase-books">${ph.books.map((x) => planRow(x)).join('')}</div>
      </div>
    </div>`;
  }).join('');

  const now = plan.now?.length ? plan.now : derivedNow(plan);
  const ROLE = { principal: 'Principal', paralelo: 'Em paralelo', audiobook: 'No audiobook' };
  return `<div class="fade-in">${head}
    ${plan.summary ? `<div class="card plan-summary">${esc(plan.summary)}<div class="meta">${plan.source === 'arquivo' ? 'Importado do seu arquivo' : `Gerado por ${esc(plan.provider || 'IA')}`} · ${new Date(plan.generatedAt || Date.now()).toLocaleDateString('pt-BR')}</div></div>` : ''}

    ${now.length ? `<div class="section-title"><h2>Comece por aqui</h2></div>
    <div class="start-grid">${now.map((x) => {
      const b = byId(x.id);
      if (!b) return '';
      return `<div class="card start-card" role="button" tabindex="0" data-action="open-book" data-id="${b.id}">${coverHTML(b, { size: 'sm', badges: false })}
        <div><span class="tag accent">${esc(ROLE[x.role] || (b.status === 'lendo' ? 'Lendo' : 'Próximo'))}</span><h3>${esc(b.title)}</h3><p>${esc(x.reason || b.ai?.why || '')}</p></div></div>`;
    }).join('')}</div>` : ''}

    <div class="section-title"><h2>Fases</h2><span class="muted small">${plural(plan.phases.length, 'fase', 'fases')}</span></div>
    <div class="timeline">${phases}</div>

    ${plan.parallel?.length ? `<div class="section-title"><h2>Bons pares para ler em paralelo</h2></div>
    <div class="pairs">${plan.parallel.map((p) => {
      const bs = p.ids.map(byId).filter(Boolean);
      return `<div class="card pair"><div class="covers">${bs.map((b, i) => `${i ? '<span class="plus">+</span>' : ''}<button class="book" data-action="open-book" data-id="${b.id}" style="width:40px">${coverHTML(b, { size: 'xs', badges: false })}</button>`).join('')}</div>
        <div class="names">${bs.map((b) => esc(b.title)).join(' + ')}</div><p>${esc(p.reason)}</p></div>`;
    }).join('')}</div>` : ''}

    ${plan.routine?.length ? `<div class="section-title"><h2>Rotina</h2></div>
    <div class="card routine"><ul>${plan.routine.map((r) => `<li>${esc(r)}</li>`).join('')}</ul></div>` : ''}
  </div>`;
}

function derivedNow(plan) {
  const reading = books().filter((b) => b.status === 'lendo').map((b) => ({ id: b.id }));
  if (reading.length) return reading.slice(0, 3);
  for (const ph of plan.phases) {
    const next = ph.books.find((x) => !['lido', 'abandonado'].includes(byId(x.id)?.status));
    if (next) return [{ id: next.id, reason: next.reason || `Primeiro livro pendente da fase “${ph.name}”.` }];
  }
  return [];
}

function planRow(x) {
  const b = byId(x.id);
  if (!b) return '';
  const st = b.status !== 'quero_ler' ? `<span class="tag ${b.status === 'lido' ? 'ok' : b.status === 'lendo' ? 'accent' : ''}">${STATUS[b.status]}</span>` : (b.ownership === 'desejo' ? '<span class="tag warn">comprar</span>' : '');
  return `<div class="pb ${b.status === 'lido' ? 'is-done' : ''}" role="button" tabindex="0" data-action="open-book" data-id="${b.id}">
    ${coverHTML(b, { size: 'xs', badges: false })}
    <div><div class="t">${esc(b.title)}</div><div class="r">${esc(x.reason || b.author || '')}</div></div>
    <div class="tags">${b.format === 'audiobook' ? '<span class="tag">audiobook</span>' : ''}${st}</div>
  </div>`;
}

// ============================================================ view: descobrir
function viewDiscover() {
  const s = state.library.suggestions;
  const hasBooks = books().length > 0;
  const head = `<div class="view-head">
    <div><h1>Descobrir</h1><p class="lede">Próximas compras que complementam o que você já tem, incluindo contrapontos para uma visão equilibrada.</p></div>
    ${hasBooks ? busyBtn('suggest', { idle: s ? 'Novas sugestões' : 'Sugerir livros', busy: 'Pensando' }, 'data-action="suggest"', s ? 'btn' : 'btn primary', s ? 'refresh' : 'sparkles') : ''}
  </div>`;
  if (!s?.items?.length) {
    return `<div class="fade-in">${head}<div class="empty"><div class="art">${icon('compass')}</div>
      <h2>${hasBooks ? 'O que ler depois?' : 'Adicione livros primeiro'}</h2>
      <p>A IA analisa sua estante, encontra lacunas e sugere livros para comprar: bases, aprofundamentos, contrapontos e leituras de lazer.</p></div></div>`;
  }
  const KIND = { base: ['Base', 'info'], aprofundar: ['Aprofundar', 'accent'], contraponto: ['Contraponto', 'warn'], lazer: ['Lazer', 'ok'] };
  const owned = new Set(books().map((b) => norm(b.title)));
  const items = [...s.items].sort((a, b) => (a.priority || 3) - (b.priority || 3));
  return `<div class="fade-in">${head}
    ${s.summary ? `<div class="card plan-summary">${esc(s.summary)}<div class="meta">Gerado por ${esc(s.provider || 'IA')} · ${new Date(s.generatedAt).toLocaleDateString('pt-BR')}</div></div>` : ''}
    <div class="section-title"><h2>Sugestões</h2></div>
    <div class="sugg-grid">${items.map((it, i) => {
      const [kl, kc] = KIND[it.kind] || [it.kind || 'Sugestão', ''];
      const comp = (it.complements || []).map(byId).filter(Boolean).map((b) => b.title);
      const have = owned.has(norm(it.title));
      const q = encodeURIComponent(`${it.title} ${it.author || ''} livro`);
      const prio = clamp(4 - (Number(it.priority) || 3), 1, 3);
      return `<div class="card sugg">
        <div class="tags"><span class="tag ${kc}">${esc(kl)}</span>${it.category ? `<span class="tag">${esc(it.category)}</span>` : ''}${it.nature ? `<span class="tag ${NATURE_TAG[it.nature] || ''}">${esc(it.nature)}</span>` : ''}
          <span class="prio" title="Prioridade" style="margin-left:auto;align-self:center">${[1, 2, 3].map((n) => `<i class="${n <= prio ? 'on' : ''}"></i>`).join('')}</span></div>
        <h3>${esc(it.title)}</h3><p class="by">${esc(it.author)}</p>
        <p class="why">${esc(it.why)}</p>
        ${comp.length ? `<p class="comp">Complementa: ${esc(comp.join(', '))}</p>` : ''}
        <div class="foot">
          ${have ? `<span class="tag ok">${icon('check').replace('<svg', '<svg style="width:13px;height:13px;stroke:currentColor;fill:none;stroke-width:2.5"')}Na sua lista</span>` : `<button class="btn sm primary" data-action="wish" data-index="${s.items.indexOf(it)}">${icon('plus')}Lista de desejos</button>`}
          <a class="btn sm ghost" href="https://www.google.com/search?tbm=shop&q=${q}" target="_blank" rel="noopener">${icon('cart')}Onde comprar</a>
        </div>
      </div>`;
    }).join('')}</div>
  </div>`;
}

// ============================================================ drawer
function openBook(id, tab = 'geral') {
  state.drawer = { id, tab };
  renderDrawer();
  const d = $('#drawer');
  d.inert = false;
  d.classList.add('open');
  d.setAttribute('aria-hidden', 'false');
  $('#scrim').classList.add('show');
}
function closeDrawer() {
  const d = $('#drawer');
  // inert: o painel fechado (fora da tela) não recebe foco nem teclas.
  if (d.contains(document.activeElement)) document.activeElement.blur();
  state.drawer.id = null;
  drawerDirty = false;
  d.inert = true;
  d.classList.remove('open');
  d.setAttribute('aria-hidden', 'true');
  $('#scrim').classList.remove('show');
  renderView();
}

function renderDrawer() {
  const b = byId(state.drawer.id);
  if (!b) { closeDrawer(); return; }
  drawerDirty = false;
  const tab = state.drawer.tab;
  const scroll = $('.drawer-body')?.scrollTop || 0;
  const tabs = [['geral', 'Visão geral'], ['guia', 'Guia de leitura'], ['notas', 'Anotações'], ['acervo', 'Compra e venda']];
  $('#drawer').innerHTML = `
    <div class="drawer-head">
      <button class="cover-btn" data-action="pick-cover" data-id="${b.id}" title="Trocar capa" aria-label="Trocar capa">${coverHTML(b)}<span class="cover-edit">${icon('image')}Trocar</span></button>
      <div class="info">
        <textarea class="inline-edit title" rows="1" data-field="title" aria-label="Título">${esc(b.title)}</textarea>
        <input class="inline-edit muted" data-field="author" value="${esc(b.author)}" placeholder="Autor" aria-label="Autor">
        <div class="tags">
          ${b.ai?.category ? `<span class="tag">${esc(b.ai.category)}${b.ai.subcategory ? ` · ${esc(b.ai.subcategory)}` : ''}</span>` : ''}
          ${b.ai?.nature ? `<span class="tag ${NATURE_TAG[b.ai.nature] || ''}">${esc(b.ai.nature)}</span>` : ''}
          ${b.priority ? '<span class="tag accent">prioritário</span>' : ''}
          ${b.userPhase ? `<span class="tag" title="Fase no seu plano original">${esc(b.userPhase)}</span>` : ''}
        </div>
      </div>
      <button class="icon-btn close" data-action="close-overlays" aria-label="Fechar">${icon('x')}</button>
    </div>
    <div class="drawer-tabs" role="tablist">${tabs.map(([k, v]) => `<button role="tab" class="${tab === k ? 'active' : ''}" data-action="drawer-tab" data-tab="${k}">${v}</button>`).join('')}</div>
    <div class="drawer-body">${tab === 'guia' ? drawerGuide(b) : tab === 'notas' ? drawerNotes(b) : tab === 'acervo' ? drawerOwnership(b) : drawerOverview(b)}</div>`;
  $('.drawer-body').scrollTop = scroll;
  autoGrow();
}

function segmented(field, options, value, icons = {}) {
  return `<div class="segmented">${Object.entries(options).map(([k, v]) => `<button class="${value === k ? 'active' : ''}" data-action="set" data-field="${field}" data-value="${k}">${icons[k] ? icon(icons[k]) : ''}${v}</button>`).join('')}</div>`;
}

function drawerOverview(b) {
  const p = pct(b);
  const total = b.progress?.total;
  const ai = b.ai;
  const related = (ai?.related || []).map(byId).filter(Boolean);
  return `
    <div><span class="field-label">Status</span>${segmented('status', STATUS, b.status)}</div>

    <div class="progress-edit">
      <span class="field-label" style="margin:0">Progresso · ${p}%</span>
      <input class="range" type="range" min="0" max="${total || 100}" value="${b.progress?.current || 0}" data-field="progress.current" data-number ${total ? '' : 'disabled'} aria-label="Progresso">
      <div class="grid-2">
        <label class="input-group"><input class="input" type="number" min="0" value="${b.progress?.current || 0}" data-field="progress.current" data-number aria-label="Atual"><span class="faint small">${isAudio(b) ? 'min ouvidos' : 'pág. lidas'}</span></label>
        <label class="input-group"><input class="input" type="number" min="0" value="${total || ''}" placeholder="total" data-field="progress.total" data-number aria-label="Total"><span class="faint small">${isAudio(b) ? 'min no total' : 'pág. no total'}</span></label>
      </div>
    </div>

    <div><span class="field-label">Formato</span>${segmented('format', FORMAT, b.format, FORMAT_ICON)}</div>

    <div><span class="field-label">Sua nota</span><div class="stars">${[1, 2, 3, 4, 5].map((n) => `<button class="${n <= (b.rating || 0) ? 'on' : ''}" data-action="rate" data-value="${n}" aria-label="${n} estrela${n > 1 ? 's' : ''}">${icon('star')}</button>`).join('')}</div></div>

    ${ai ? `<div class="ai-block">
      <span class="field-label" style="margin:0;display:flex;align-items:center;gap:6px">${icon('sparkles').replace('<svg', '<svg style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2"')}Sobre o livro</span>
      <p class="lead">${esc(ai.intro)}</p>
      ${ai.why ? `<p><b>Por que ler:</b> ${esc(ai.why)}</p>` : ''}
      <div class="kv">
        <div><div class="k">Natureza</div><div class="v">${esc(ai.nature || '—')}</div></div>
        <div><div class="k">Dificuldade</div><div class="v"><span class="dots">${[1, 2, 3, 4, 5].map((n) => `<i class="${n <= ai.difficulty ? 'on' : ''}"></i>`).join('')}</span></div></div>
        <div><div class="k">Tempo</div><div class="v">${ai.hours ? `~${ai.hours}h` : '—'}${ai.pages ? ` · ${ai.pages}p` : ''}</div></div>
      </div>
      ${ai.themes?.length ? `<div class="tags">${ai.themes.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
      ${ai.prerequisites?.length ? `<p class="small"><b>Ajuda ler antes:</b> ${esc(ai.prerequisites.join('; '))}</p>` : ''}
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
        <span class="faint small">${esc(ai.provider || '')}</span>
        ${busyBtn('classify', { idle: 'Reclassificar', busy: 'Classificando' }, `data-action="classify-one" data-id="${b.id}"`, 'btn sm ghost', 'refresh')}
      </div>
    </div>` : `<div class="ai-block"><p>Este livro ainda não foi analisado. A IA identifica categoria, natureza, dificuldade e escreve uma introdução.</p>
      <div>${busyBtn('classify', { idle: 'Classificar com IA', busy: 'Classificando' }, `data-action="classify-one" data-id="${b.id}"`, 'btn primary sm')}</div></div>`}

    ${related.length ? `<div><span class="field-label">Conversa com</span><div class="related">${related.map((r) => bookTile(r, 'sm')).join('')}</div></div>` : ''}

    <label style="display:flex;gap:10px;align-items:center;cursor:pointer" class="small"><input type="checkbox" data-field="priority" ${b.priority ? 'checked' : ''} style="accent-color:var(--accent)"> Marcar como prioritário</label>`;
}

function drawerGuide(b) {
  const g = b.guide;
  const key = `guide:${b.id}`;
  if (!g) {
    return `<div class="empty" style="padding:30px 10px;margin:0">
      <div class="art">${icon('compass')}</div>
      <h2 style="font-size:22px">Guia de leitura</h2>
      <p>Contexto, estrutura do livro, ideias centrais, pontos de atenção e perguntas para ler ativamente.</p>
      ${busyBtn(key, { idle: 'Gerar guia', busy: 'Escrevendo guia' }, `data-action="guide" data-id="${b.id}"`)}
    </div>`;
  }
  const list = (arr) => `<ul>${(arr || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
  const conns = (g.connections || []).map((c) => ({ ...c, b: byId(c.id) })).filter((c) => c.b);
  return `<div class="guide">
    ${g.context ? `<section><h4>Contexto</h4><p>${esc(g.context)}</p></section>` : ''}
    ${g.structure ? `<section><h4>Estrutura</h4><p>${esc(g.structure)}</p></section>` : ''}
    ${g.keyIdeas?.length ? `<section><h4>Ideias centrais</h4>${list(g.keyIdeas)}</section>` : ''}
    ${g.watchFor?.length ? `<section><h4>Pontos de atenção</h4>${list(g.watchFor)}</section>` : ''}
    ${g.questions?.length ? `<section><h4>Perguntas para ler ativamente</h4>${list(g.questions)}</section>` : ''}
    ${g.approach ? `<section><h4>Como ler</h4><p>${esc(g.approach)}</p></section>` : ''}
    ${conns.length ? `<section><h4>Conexões na sua estante</h4><ul>${conns.map((c) => `<li><a href="#" data-action="open-book" data-id="${c.b.id}"><b>${esc(c.b.title)}</b></a>: ${esc(c.note)}</li>`).join('')}</ul></section>` : ''}
    ${g.after ? `<section><h4>Depois deste</h4><p>${esc(g.after)}</p></section>` : ''}
    <div style="display:flex;justify-content:space-between;align-items:center"><span class="faint small">${esc(g.provider || '')}</span>
      ${busyBtn(key, { idle: 'Refazer guia', busy: 'Escrevendo' }, `data-action="guide" data-id="${b.id}"`, 'btn sm ghost', 'refresh')}</div>
  </div>`;
}

function drawerNotes(b) {
  return `<p class="muted small" style="margin-top:-4px">Modelo de anotação por livro. Tudo é salvo automaticamente.</p>
    ${NOTE_FIELDS.map(([k, label]) => `<label><span class="field-label">${label}</span>
      <textarea class="textarea" data-field="notes.${k}" rows="${k === 'livre' ? 5 : 2}">${esc(b.notes?.[k] || '')}</textarea></label>`).join('')}`;
}

function drawerOwnership(b) {
  return `
    <div><span class="field-label">Situação</span>${segmented('ownership', OWNERSHIP, b.ownership)}</div>
    <div><span class="field-label">Compra</span><div class="grid-2">
      <input class="input" type="date" value="${esc(b.purchase?.date || '')}" data-field="purchase.date" aria-label="Data da compra">
      <input class="input" type="number" step="0.01" min="0" placeholder="Valor (R$)" value="${esc(b.purchase?.price ?? '')}" data-field="purchase.price" data-number aria-label="Valor da compra">
    </div><input class="input" style="margin-top:10px" placeholder="Onde comprou (loja, sebo…)" value="${esc(b.purchase?.where || '')}" data-field="purchase.where"></div>
    ${b.ownership === 'vendido' ? `<div><span class="field-label">Venda</span><div class="grid-2">
      <input class="input" type="date" value="${esc(b.sale?.date || '')}" data-field="sale.date" aria-label="Data da venda">
      <input class="input" type="number" step="0.01" min="0" placeholder="Valor (R$)" value="${esc(b.sale?.price ?? '')}" data-field="sale.price" data-number aria-label="Valor da venda">
    </div><input class="input" style="margin-top:10px" placeholder="Vendido para / onde" value="${esc(b.sale?.to || '')}" data-field="sale.to"></div>` : ''}
    ${b.ownership === 'emprestado' ? `<div><span class="field-label">Empréstimo</span><div class="grid-2">
      <input class="input" placeholder="Com quem está" value="${esc(b.loan?.to || '')}" data-field="loan.to">
      <input class="input" type="date" value="${esc(b.loan?.date || '')}" data-field="loan.date" aria-label="Data do empréstimo">
    </div></div>` : ''}
    <div><span class="field-label">Capa</span><button class="btn sm" data-action="pick-cover" data-id="${b.id}">${icon('image')}Escolher outra capa</button></div>
    <div class="danger-zone"><span class="faint small">Adicionado em ${new Date(b.createdAt).toLocaleDateString('pt-BR')}</span>
      <button class="btn sm danger ghost" data-action="delete-book" data-id="${b.id}">${icon('trash')}Excluir livro</button></div>`;
}

function autoGrow() {
  for (const t of $$('#drawer textarea')) { t.style.height = 'auto'; t.style.height = `${t.scrollHeight + 2}px`; }
}

function setStatus(b, status) {
  const patch = { status };
  const today = new Date().toISOString().slice(0, 10);
  if (status === 'lendo' && !b.startedAt) patch.startedAt = today;
  if (status === 'lido') {
    patch.finishedAt = b.finishedAt || today;
    if (b.progress?.total) patch.progress = { ...b.progress, current: b.progress.total };
  }
  updateBook(b.id, patch);
}

// ============================================================ modais
const modal = () => $('#modal');
function showModal(html, kind = '') {
  state.modalKind = kind;
  modal().innerHTML = html;
  if (!modal().open) modal().showModal();
}
function closeModal() { if (modal().open) modal().close(); }
modal().addEventListener('close', () => { state.modalKind = ''; state.coverPicker = null; });

function renderImageTab() { if (modal().open && state.addTab === 'imagem' && !state.importDraft) openAdd('imagem'); }

function openAdd(tab = 'um') {
  state.addTab = tab;
  const d = tab === 'um' ? null : state.importDraft;
  const tabs = `<div class="segmented" style="margin-bottom:4px">
    <button class="${tab === 'um' ? 'active' : ''}" data-action="add-tab" data-tab="um">${icon('plus')}Um livro</button>
    <button class="${tab === 'imagem' ? 'active' : ''}" data-action="add-tab" data-tab="imagem">${icon('image')}Imagem</button>
    <button class="${tab === 'lista' ? 'active' : ''}" data-action="add-tab" data-tab="lista">${icon('file')}Lista ou arquivo</button></div>`;
  let body;
  if (tab === 'imagem' && !d) {
    const imgs = state.pendingImages || [];
    body = `<div class="modal-body">${tabs}
      <label class="dropzone ${imgs.length ? 'has-images' : ''}" id="dropzone">
        <input type="file" id="img-input" accept="image/*" multiple hidden>
        <span class="dz-icon">${icon('image')}</span>
        <b>${TOUCH ? 'Toque para tirar uma foto ou escolher da galeria' : 'Cole com Ctrl+V, arraste ou clique para escolher'}</b>
        <span class="muted small">Capa, foto da estante, print do Kindle, Audible ou Skoob, página da loja, comprovante de compra…</span>
      </label>
      ${imgs.length ? `<div class="thumbs">${imgs.map((im, i) => `<div class="thumb"><img src="${esc(im.url)}" alt=""><button class="icon-btn" data-action="remove-image" data-index="${i}" aria-label="Remover imagem">${icon('x')}</button></div>`).join('')}</div>` : ''}
      <p class="faint small">A IA identifica título, autor e formato (físico, e-book ou audiobook) e, em comprovantes, também preço, loja e data. Você revisa antes de importar.</p>
      <div class="modal-foot" style="padding:0">
        <button type="button" class="btn ghost" data-action="close-modal">Cancelar</button>
        <button class="btn primary" data-action="read-images" ${imgs.length ? '' : 'disabled'}>${icon('sparkles')}Ler ${imgs.length > 1 ? `${imgs.length} imagens` : 'imagem'} com IA</button>
      </div>
    </div>`;
  } else if (tab === 'um') {
    body = `<form id="add-one" class="modal-body">${tabs}
      <label><span class="field-label">Título</span><input class="input" name="title" required autofocus placeholder="Ex.: Meditações"></label>
      <label><span class="field-label">Autor</span><input class="input" name="author" placeholder="Ex.: Marco Aurélio (a IA completa se ficar vazio)"></label>
      <div><span class="field-label">Formato</span><div class="segmented" data-radio="format">${Object.entries(FORMAT).map(([k, v], i) => `<button type="button" class="${i === 0 ? 'active' : ''}" data-value="${k}">${icon(FORMAT_ICON[k])}${v}</button>`).join('')}</div></div>
      <div><span class="field-label">Situação</span><div class="segmented" data-radio="ownership">${Object.entries(OWNERSHIP).filter(([k]) => k !== 'vendido').map(([k, v], i) => `<button type="button" class="${i === 0 ? 'active' : ''}" data-value="${k}">${v}</button>`).join('')}</div></div>
      <div class="modal-foot" style="padding:0"><button type="button" class="btn ghost" data-action="close-modal">Cancelar</button><button class="btn primary" type="submit">${icon('plus')}Adicionar</button></div>
    </form>`;
  } else if (d) {
    const existing = new Set(books().map((b) => norm(b.title)));
    const fromImage = tab === 'imagem';
    body = `<div class="modal-body">${tabs}
      <p class="muted small">${d.source ? `<b>${esc(d.source)}</b> · ` : ''}${plural(d.books.length, 'livro encontrado', 'livros encontrados')}${d.phases?.length ? ` em ${plural(d.phases.length, 'fase', 'fases')}` : ''}. Desmarque o que não quiser importar.</p>
      <div class="grid-2">
        <div><span class="field-label">${fromImage ? 'Formato (se não detectado)' : 'Formato'}</span><select class="select" id="imp-format" style="width:100%">${Object.entries(FORMAT).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
        <div><span class="field-label">Situação</span><select class="select" id="imp-own" style="width:100%">${Object.entries(OWNERSHIP).filter(([k]) => k !== 'vendido').map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
      </div>
      <div class="preview-list">${d.books.map((b, i) => {
        const dup = existing.has(norm(b.title));
        const extra = [
          FORMAT[b.format] && fromImage ? `<span class="tag">${FORMAT[b.format]}</span>` : '',
          Number(b.price) > 0 ? `<span class="tag ok">${money(b.price)}</span>` : '',
        ].join('');
        return `<label><input type="checkbox" data-imp="${i}" ${dup ? '' : 'checked'}><span style="flex:1;min-width:0"><b>${esc(b.title)}</b>${b.author ? ` <span class="muted">— ${esc(b.author)}</span>` : ''}</span>${extra}${dup ? '<span class="tag">já existe</span>' : b.priority ? '<span class="tag accent">prioritário</span>' : ''}</label>`;
      }).join('')}</div>
      ${d.phases?.length ? `<label class="small" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="imp-plan" checked style="accent-color:var(--accent)"> Usar as fases do arquivo como plano de leitura inicial</label>` : ''}
      <label class="small" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="imp-ai" ${activeProvider() ? 'checked' : 'disabled'} style="accent-color:var(--accent)"> Classificar com IA após importar${activeProvider() ? ` (${esc(activeProvider().label)})` : ' (nenhuma IA configurada)'}</label>
      <div class="modal-foot" style="padding:0"><button class="btn ghost" data-action="import-reset">Voltar</button><button class="btn primary" data-action="import-confirm">${icon('check')}Importar selecionados</button></div>
    </div>`;
  } else {
    body = `<div class="modal-body">${tabs}
      <label><span class="field-label">Caminho do arquivo (.md ou .txt)</span>
        <div class="input-group"><input class="input" id="imp-path" value="${esc(state.settings.importPath || '')}" placeholder="C:\\livros\\lista.md">
        ${busyBtn('parse', { idle: 'Ler', busy: 'Lendo' }, 'data-action="import-path"', 'btn', 'file')}</div></label>
      <div class="faint small" style="text-align:center">ou</div>
      <label><span class="field-label">Cole uma lista</span><textarea class="textarea" id="imp-text" rows="7" placeholder="Um livro por linha, em markdown ou texto livre. Ex.:&#10;1. **A República** — Platão&#10;Meditações - Marco Aurélio"></textarea></label>
      <div class="modal-foot" style="padding:0">
        ${busyBtn('extract', { idle: 'Extrair com IA', busy: 'Extraindo' }, 'data-action="import-ai"', 'btn ghost')}
        ${busyBtn('parse', { idle: 'Ler lista', busy: 'Lendo' }, 'data-action="import-text"', 'btn primary', 'check')}
      </div>
    </div>`;
  }
  showModal(`<div class="modal-head"><h2>Adicionar livros</h2><button class="icon-btn" data-action="close-modal" aria-label="Fechar">${icon('x')}</button></div>${body}`, 'add');
}

// Botões dentro de modais: mostra o spinner no próprio botão, sem redesenhar o modal
// (redesenhar apagaria o que foi digitado).
async function busyButton(el, label, fn) {
  if (el?.disabled) return;
  if (!el || el.tagName === 'LABEL') { try { return await fn(); } catch (e) { toast(e.message, 'err'); return; } }
  const html = el.innerHTML;
  const t0 = Date.now();
  el.disabled = true;
  el.innerHTML = `<span class="spinner"></span>${esc(label)} <span class="faint"></span>`;
  const tick = setInterval(() => { const s = el.querySelector('.faint'); if (s) s.textContent = `${Math.round((Date.now() - t0) / 1000)}s`; }, 1000);
  try { return await fn(); }
  catch (e) { toast(e.message, 'err'); }
  finally { clearInterval(tick); if (el.isConnected) { el.disabled = false; el.innerHTML = html; } }
}

async function parseImport(payload, el) {
  await busyButton(el, 'Lendo', async () => {
    const r = await api('POST', '/api/import/parse', payload);
    if (!r.books.length) {
      toast('Não reconheci livros nesse formato. Tente “Extrair com IA”.', 'err');
      return;
    }
    if (payload.path) { state.settings.importPath = payload.path; api('PUT', '/api/settings', { importPath: payload.path }).catch(() => {}); }
    state.importDraft = r;
    if (modal().open) openAdd('lista');
  });
}

async function extractImport(el) {
  const text = $('#imp-text')?.value.trim();
  if (!text) { toast('Cole a lista primeiro.', 'err'); return; }
  if (!activeProvider()) { toast('Nenhuma IA configurada.', 'err'); return; }
  await busyButton(el, 'Extraindo', async () => {
    const r = await api('POST', '/api/ai/extract', { text });
    if (!r.books.length) { toast('A IA não encontrou livros no texto.', 'err'); return; }
    state.importDraft = r;
    if (modal().open) openAdd('lista');
  });
}

function confirmImport() {
  const d = state.importDraft;
  if (!d) return;
  const format = $('#imp-format').value;
  const ownership = $('#imp-own').value;
  const chosen = $$('[data-imp]').filter((c) => c.checked).map((c) => d.books[Number(c.dataset.imp)]);
  if (!chosen.length) { toast('Nenhum livro selecionado.', 'err'); return; }
  const created = chosen.map((x) => newBook({
    title: str(x.title), author: str(x.author), format: FORMAT[x.format] ? x.format : format, ownership,
    userPhase: x.phase || null, priority: !!x.priority,
    // Dados de compra lidos de comprovantes/prints.
    purchase: {
      ...(Number(x.price) > 0 ? { price: Number(x.price) } : {}),
      ...(str(x.store) ? { where: str(x.store) } : {}),
      ...(/^\d{4}-\d{2}-\d{2}$/.test(str(x.date)) ? { date: x.date } : {}),
    },
  }));
  state.library.books.push(...created);

  if (d.phases?.length && $('#imp-plan')?.checked) {
    const idByTitle = new Map(books().map((b) => [norm(b.title), b.id]));
    state.library.plan = sanitizePlan({
      source: 'arquivo', generatedAt: new Date().toISOString(),
      summary: 'Plano importado do seu arquivo. Use “Refazer com IA” para a IA reorganizar as fases, indicar leituras em paralelo e explicar cada escolha.',
      phases: d.phases.map((ph) => ({ name: ph.name, goal: ph.goal, books: ph.titles.map((t) => ({ id: idByTitle.get(norm(t)), reason: '' })) })),
    });
  }
  const runAi = $('#imp-ai')?.checked;
  state.importDraft = null;
  persist();
  closeModal();
  renderAll();
  toast(`${plural(created.length, 'livro importado', 'livros importados')}.`);
  fillCovers();
  if (runAi) classify(created.map((b) => b.id));
}

function addOne(form) {
  const fd = new FormData(form);
  const pick = (k) => $(`[data-radio="${k}"] .active`, form)?.dataset.value;
  const title = String(fd.get('title') || '').trim();
  if (!title) return;
  if (books().some((b) => norm(b.title) === norm(title)) && !form.dataset.confirmDup) {
    form.dataset.confirmDup = '1';
    toast('Esse título já está na estante. Clique em Adicionar de novo para confirmar.', 'err');
    return;
  }
  const b = newBook({ title, author: String(fd.get('author') || '').trim(), format: pick('format') || 'fisico', ownership: pick('ownership') || 'tenho' });
  state.library.books.push(b);
  persist();
  closeModal();
  renderAll();
  openBook(b.id);
  fillCovers();
  if (activeProvider()) classify([b.id]);
}

function openSettings(typed = null) {
  const s = state.settings;
  const sel = s.provider || 'auto';
  const auto = activeProvider();
  const provRow = (id, name, detail, available) => `<label class="provider ${sel === id ? 'sel' : ''}">
    <input type="radio" name="provider" value="${id}" ${sel === id ? 'checked' : ''}>
    <div><div class="nm">${esc(name)}</div><div class="dt">${esc(detail)}</div></div>
    ${id === 'auto' ? '' : `<span class="st tag ${available ? 'ok' : ''}">${available ? 'disponível' : 'indisponível'}</span>`}
  </label>`;
  showModal(`<div class="modal-head"><h2>Ajustes</h2><button class="icon-btn" data-action="close-modal" aria-label="Fechar">${icon('x')}</button></div>
  <form id="settings" class="modal-body" style="max-height:calc(100vh - 160px);overflow-y:auto">
    <div><span class="field-label">Inteligência artificial</span>
      <div class="provider-list">
        ${provRow('auto', 'Automático', auto ? `usando ${auto.label} agora` : 'nenhuma disponível', true)}
        ${state.providers.map((p) => provRow(p.id, p.label + (p.kind === 'cli' ? ' · logado no PC' : ''), p.detail, p.available)).join('')}
      </div>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      ${busyBtn('test', { idle: 'Testar IA', busy: 'Testando' }, 'type="button" data-action="test-ai"', 'btn sm', 'sparkles')}
      <button type="button" class="btn sm ghost" data-action="refresh-providers">${icon('refresh')}Detectar de novo</button>
    </div>
    <details class="adv" ${s.anthropicKeyHint || s.openaiKeyHint ? '' : ''}>
      <summary>Chaves de API e modelos</summary>
      <div style="display:grid;gap:12px">
        <label><span class="field-label">Anthropic API key</span><input class="input" type="password" name="anthropicKey" autocomplete="off" placeholder="${esc(s.anthropicKeyHint || 'sk-ant-…')}"></label>
        <label><span class="field-label">Modelo Anthropic</span><input class="input" name="anthropicModel" value="${esc(s.anthropicModel || '')}"></label>
        <label><span class="field-label">OpenAI API key</span><input class="input" type="password" name="openaiKey" autocomplete="off" placeholder="${esc(s.openaiKeyHint || 'sk-…')}"></label>
        <label><span class="field-label">Modelo OpenAI</span><input class="input" name="openaiModel" value="${esc(s.openaiModel || '')}"></label>
        <label><span class="field-label">Modelo para CLIs (opcional)</span><input class="input" name="cliModel" value="${esc(s.cliModel || '')}" placeholder="ex.: sonnet, opus, gpt-5…"></label>
        <p class="faint small">As chaves ficam só neste computador, em <code>data/settings.json</code>. Deixe o campo vazio para manter a chave atual.</p>
        ${s.anthropicKeyHint || s.openaiKeyHint ? `<div style="display:flex;gap:8px;flex-wrap:wrap">${s.anthropicKeyHint && s.anthropicKeyHint !== 'variável de ambiente' ? '<label class="small"><input type="checkbox" name="clearAnthropicKey"> remover chave Anthropic</label>' : ''}${s.openaiKeyHint && s.openaiKeyHint !== 'variável de ambiente' ? '<label class="small"><input type="checkbox" name="clearOpenaiKey"> remover chave OpenAI</label>' : ''}</div>` : ''}
      </div>
    </details>
    <div><span class="field-label">Sua rotina</span><div class="grid-2">
      <label class="input-group"><input class="input" type="number" min="5" max="600" name="minutesPerDay" value="${esc(s.minutesPerDay || 45)}"><span class="faint small">min/dia</span></label>
    </div>
    <textarea class="textarea" name="goal" rows="2" style="margin-top:10px" placeholder="Objetivo com a leitura (opcional). Ex.: formação filosófica sólida e entender economia">${esc(s.goal || '')}</textarea></div>
    <div><span class="field-label">Dados</span><div style="display:flex;gap:8px;flex-wrap:wrap">
      <button type="button" class="btn sm" data-action="export">${icon('download')}Exportar backup</button>
      <label class="btn sm">${icon('upload')}Restaurar backup<input type="file" accept="application/json,.json" id="restore" hidden></label>
    </div></div>
    <div class="modal-foot" style="padding:0"><button type="button" class="btn ghost" data-action="close-modal">Cancelar</button><button class="btn primary" type="submit">Salvar</button></div>
  </form>`, 'settings');
  if (typed) {
    const form = $('#settings');
    for (const [k, v] of Object.entries(typed)) {
      for (const input of $$(`[name="${k}"]`, form)) {
        if (input.type === 'radio') { input.checked = input.value === v; input.closest('.provider')?.classList.toggle('sel', input.checked); }
        else if (input.type === 'checkbox') input.checked = v === 'on';
        else if (input.type !== 'file') input.value = v;
      }
    }
  }
}

async function saveSettings(form) {
  const fd = new FormData(form);
  const patch = Object.fromEntries(['provider', 'anthropicKey', 'anthropicModel', 'openaiKey', 'openaiModel', 'cliModel', 'minutesPerDay', 'goal'].map((k) => [k, fd.get(k) ?? '']));
  patch.provider ||= 'auto';
  patch.clearAnthropicKey = fd.get('clearAnthropicKey') === 'on';
  patch.clearOpenaiKey = fd.get('clearOpenaiKey') === 'on';
  try {
    const r = await api('PUT', '/api/settings', patch);
    state.settings = r.settings;
    state.providers = r.providers;
    renderAiPill();
    closeModal();
    renderAll();
    toast('Ajustes salvos.');
  } catch (e) { toast(e.message, 'err'); }
}

function exportBackup() {
  const blob = new Blob([JSON.stringify(state.library, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `marginalia-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ============================================================ escolher capa
async function openCoverPicker(id, query) {
  const b = byId(id);
  if (!b) return;
  const q = query ?? b.title;
  state.coverPicker = { id, query: q, items: null };
  renderCoverPicker();
  try {
    const r = await api('POST', '/api/cover/candidates', { title: q, author: query ? '' : b.author, format: b.format });
    if (state.coverPicker?.id !== id || state.coverPicker.query !== q) return; // usuário já mudou a busca
    state.coverPicker.items = r.items;
  } catch (e) {
    if (state.coverPicker) state.coverPicker.items = [];
    toast(e.message, 'err');
  }
  if (state.modalKind === 'cover') renderCoverPicker();
}

function renderCoverPicker() {
  const cp = state.coverPicker;
  const b = cp && byId(cp.id);
  if (!b) return;
  const grid = cp.items === null
    ? '<div class="cand skeleton"></div>'.repeat(8)
    : cp.items.length
      ? cp.items.map((it, i) => `<button class="cand" data-action="choose-cover" data-index="${i}" title="${esc(it.label)}">
          <img src="${esc(it.thumb)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.closest('.cand').remove()"></button>`).join('')
      : '<p class="muted small">Nada encontrado. Tente outra busca, envie ou cole uma imagem.</p>';
  showModal(`<div class="modal-head"><div><h2>Capa</h2><p class="muted small">${esc(b.title)}</p></div><button class="icon-btn" data-action="close-modal" aria-label="Fechar">${icon('x')}</button></div>
    <div class="modal-body">
      <form id="cover-search" class="input-group"><input class="input" name="q" value="${esc(cp.query)}" aria-label="Buscar capa"><button class="btn">${icon('search')}Buscar</button></form>
      <div class="cover-grid">${grid}</div>
      <div class="cover-actions">
        <label class="btn sm">${icon('upload')}Enviar imagem<input type="file" id="cover-file" accept="image/*" hidden></label>
        ${TOUCH ? '' : '<span class="faint small">ou cole uma imagem com Ctrl+V</span>'}
        ${b.cover ? `<button class="btn sm ghost danger" data-action="remove-cover" style="margin-left:auto">${icon('trash')}Remover capa</button>` : ''}
      </div>
      <form id="cover-url" class="input-group"><input class="input" name="url" placeholder="ou cole o endereço de uma imagem (https://…)" aria-label="URL da imagem"><button class="btn sm">Usar</button></form>
    </div>`, 'cover');
}

async function applyCover(fn, el) {
  const id = state.coverPicker?.id;
  if (!id) return;
  await busyButton(el, 'Salvando', async () => {
    const r = await fn(id);
    // coverManual: escolhida pelo usuário, a busca automática não troca mais.
    updateBook(id, { cover: r.cover, coverV: COVER_V, coverManual: true });
    closeModal();
    renderAll();
    toast('Capa atualizada.');
  });
}
const uploadCover = async (file, el) => {
  const img = await prepImage(file, 1200).catch(() => null);
  if (!img) { toast('Não consegui abrir essa imagem.', 'err'); return; }
  URL.revokeObjectURL(img.url);
  await applyCover((id) => api('POST', '/api/cover/upload', { id, data: img.data }), el);
};

async function restoreBackup(file) {
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.books)) throw new Error('Arquivo não parece um backup da Marginália.');
    if (!confirm(`Substituir a estante atual (${books().length} livros) pelo backup (${data.books.length} livros)?`)) return;
    const savedAt = state.library.savedAt; // mantém a versão atual para o servidor aceitar a gravação
    sanitizeLibrary(data);
    state.library.savedAt = savedAt;
    persist();
    closeModal();
    renderAll();
    toast('Backup restaurado.');
  } catch (e) { toast(e.message, 'err'); }
}

// ============================================================ eventos
document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) {
    const radio = e.target.closest('[data-radio] button');
    if (radio) { for (const b of radio.parentElement.children) b.classList.toggle('active', b === radio); }
    return;
  }
  const { action, id } = el.dataset;
  if (el.tagName === 'A' || el.closest('form')) e.preventDefault();
  switch (action) {
    case 'open-book': openBook(id); break;
    case 'close-overlays': closeDrawer(); break;
    case 'drawer-tab': state.drawer.tab = el.dataset.tab; renderDrawer(); $('.drawer-body').scrollTop = 0; break;
    case 'set': {
      const b = byId(state.drawer.id);
      const { field, value } = el.dataset;
      if (field === 'status') setStatus(b, value);
      else updateBook(b.id, { [field]: value });
      renderAll();
      break;
    }
    case 'rate': { const b = byId(state.drawer.id); const v = Number(el.dataset.value); updateBook(b.id, { rating: b.rating === v ? 0 : v }); renderDrawer(); break; }
    case 'bump': {
      e.stopPropagation();
      const b = byId(id);
      const step = Number(el.dataset.step);
      const total = Number(b.progress?.total) || Infinity;
      updateBook(id, { progress: { ...b.progress, current: Math.min(total, (Number(b.progress?.current) || 0) + step) } });
      renderAll();
      break;
    }
    case 'finish': e.stopPropagation(); setStatus(byId(id), 'lido'); renderAll(); toast(`“${byId(id).title}” concluído. 🎉`); break;
    case 'filter': state.filters[el.dataset.key] = el.dataset.value; renderView(); break;
    case 'clear-filters': state.filters = { q: '', status: 'todos', format: '', ownership: '', category: '' }; renderView(); break;
    case 'classify-pending': classify(books().filter((b) => !b.ai).map((b) => b.id)); break;
    case 'classify-one': classify([id]); break;
    case 'gen-plan': generatePlan(); break;
    case 'suggest': suggestBooks(); break;
    case 'guide': makeGuide(id); break;
    case 'wish': {
      const it = state.library.suggestions.items[Number(el.dataset.index)];
      const b = newBook({
        title: it.title, author: it.author || '', ownership: 'desejo',
        ai: { category: it.category || 'Outros', nature: it.nature || '', difficulty: 3, intro: it.why || '', why: '', themes: [], prerequisites: [], related: (it.complements || []).filter(byId), provider: 'sugestão' },
      });
      state.library.books.push(b);
      persist();
      renderView();
      fillCovers();
      toast(`“${it.title}” na lista de desejos.`);
      break;
    }
    case 'delete-book': {
      if (el.dataset.armed !== '1') { el.dataset.armed = '1'; el.innerHTML = `${icon('trash')}Confirmar exclusão`; setTimeout(() => { if (el.isConnected) { el.dataset.armed = ''; el.innerHTML = `${icon('trash')}Excluir livro`; } }, 3000); return; }
      const b = byId(id);
      state.library.books = books().filter((x) => x.id !== id);
      if (state.library.plan) state.library.plan = sanitizePlan(state.library.plan);
      if (isLocalCover(b.cover)) api('POST', '/api/cover/delete', { id }).catch(() => {});
      persist();
      closeDrawer();
      toast(`“${b.title}” excluído.`);
      break;
    }
    case 'open-add': openAdd(state.importDraft ? (state.addTab === 'imagem' ? 'imagem' : 'lista') : 'um'); break;
    case 'add-tab': openAdd(el.dataset.tab); break;
    case 'import-default': state.importDraft = null; openAdd('lista'); parseImport({ path: state.settings.importPath }, $('[data-action="import-path"]')); break;
    case 'import-path': parseImport({ path: $('#imp-path').value.trim() }, el); break;
    case 'import-text': { const text = $('#imp-text').value; if (text.trim()) parseImport({ text }, el); break; }
    case 'import-ai': extractImport(el); break;
    case 'import-reset': state.importDraft = null; openAdd(state.addTab === 'imagem' ? 'imagem' : 'lista'); break;
    case 'import-confirm': confirmImport(); break;
    case 'close-modal': closeModal(); break;
    case 'read-images': extractFromImages(el); break;
    case 'remove-image': {
      const [img] = (state.pendingImages || []).splice(Number(el.dataset.index), 1);
      if (img) URL.revokeObjectURL(img.url);
      renderImageTab();
      break;
    }
    case 'pick-cover': openCoverPicker(id); break;
    case 'choose-cover': {
      const it = state.coverPicker?.items?.[Number(el.dataset.index)];
      const b = byId(state.coverPicker?.id);
      if (it && b) applyCover((bid) => api('POST', '/api/cover/set', { id: bid, url: it.url, thumb: it.thumb, format: b.format }), el);
      break;
    }
    case 'remove-cover': {
      const bid = state.coverPicker?.id;
      if (!bid) break;
      api('POST', '/api/cover/delete', { id: bid }).catch(() => {});
      updateBook(bid, { cover: null, coverV: COVER_V, coverManual: true });
      closeModal();
      renderAll();
      break;
    }
    case 'open-settings': openSettings(); break;
    case 'refresh-providers': {
      // Preserva o que já foi digitado no formulário ao atualizar a lista.
      await busyButton(el, 'Detectando', async () => { state.providers = await api('GET', '/api/providers'); });
      renderAiPill();
      const form = $('#settings');
      if (!modal().open || !form) break; // modal foi fechado/salvo durante a detecção
      const typed = Object.fromEntries(new FormData(form));
      const advOpen = $('details.adv', form)?.open;
      openSettings(typed);
      if (advOpen) $('#settings details.adv').open = true;
      break;
    }
    case 'test-ai': {
      // Testa o que está no formulário (mesmo sem salvar), não só o que está gravado.
      const typed = Object.fromEntries(new FormData($('#settings')));
      await busyButton(el, 'Testando', async () => {
        const r = await api('POST', '/api/ai/test', typed);
        toast(`${r.provider} respondeu em ${(r.ms / 1000).toFixed(1)}s: ${r.msg || 'ok'}`);
      });
      break;
    }
    case 'export': exportBackup(); break;
    case 'toggle-theme': toggleTheme(); break;
  }
});

document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.id === 'search') {
    // Durante composição (teclas mortas: ã, é, ç) espera o caractere final.
    if (e.isComposing) return;
    state.filters.q = t.value;
    const box = $('#shelf-results');
    if (box) box.innerHTML = shelfResults(); else renderView();
    return;
  }
  if (t.closest('#drawer') && t.dataset.field && t.type !== 'checkbox') {
    const b = byId(state.drawer.id);
    if (!b) return;
    let v = t.value;
    if (t.dataset.number !== undefined) v = v === '' ? null : Number(v);
    setPath(b, t.dataset.field, v);
    b.updatedAt = new Date().toISOString();
    if (t.dataset.field === 'progress.current' || t.dataset.field === 'progress.total') syncProgress(b, t);
    if (t.tagName === 'TEXTAREA') { t.style.height = 'auto'; t.style.height = `${t.scrollHeight + 2}px`; }
    persist();
    // A URL da capa só é aplicada ao sair do campo (evita baixar URLs pela metade).
    if (t.dataset.field !== 'cover') scheduleRender();
  }
});

function syncProgress(b, source) {
  const total = Number(b.progress.total) || 0;
  if (total && b.progress.current > total) b.progress.current = total;
  if (b.progress.current > 0 && b.status === 'quero_ler') {
    b.status = 'lendo';
    b.startedAt ||= new Date().toISOString().slice(0, 10);
    for (const btn of $$('#drawer [data-field="status"]')) btn.classList.toggle('active', btn.dataset.value === 'lendo');
  }
  // Não sobrescreve o campo em que o usuário está digitando; corrige no blur.
  for (const el of $$('#drawer [data-field="progress.current"]')) if (el !== source) el.value = b.progress.current || 0;
  const range = $('#drawer .range');
  if (range) { range.max = total || 100; range.disabled = !total; }
  const label = $('#drawer .progress-edit .field-label');
  if (label) label.textContent = `Progresso · ${pct(b)}%`;
}

document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.dataset.filter) { state.filters[t.dataset.filter] = t.value; renderView(); return; }
  if (t.dataset.sort !== undefined && t.matches('[data-sort]')) { state.sort = t.value; store.set('sort', t.value); renderView(); return; }
  if (t.closest('#drawer') && t.type === 'checkbox' && t.dataset.field) { updateBook(state.drawer.id, { [t.dataset.field]: t.checked }); renderAll(); return; }
  if (t.closest('#drawer') && ['title', 'author', 'cover', 'progress.current'].includes(t.dataset.field)) {
    // Atualiza só a capa do painel (redesenhar tudo tiraria o foco do próximo campo).
    const b = byId(state.drawer.id);
    const headCover = $('#drawer .drawer-head .cover');
    if (headCover) headCover.outerHTML = coverHTML(b);
    if (t.dataset.field === 'progress.current') t.value = b.progress.current || 0;
    renderView();
  }
  if (t.name === 'provider') { for (const l of $$('.provider')) l.classList.toggle('sel', l.contains(t)); }
  if (t.id === 'restore' && t.files[0]) restoreBackup(t.files[0]);
  if (t.id === 'img-input' && t.files.length) addPendingImages(t.files);
  if (t.id === 'cover-file' && t.files[0]) uploadCover(t.files[0], null);
});

document.addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target;
  if (f.id === 'add-one') addOne(f);
  if (f.id === 'settings') saveSettings(f);
  if (f.id === 'cover-search' && state.coverPicker) openCoverPicker(state.coverPicker.id, f.q.value.trim() || undefined);
  if (f.id === 'cover-url') {
    const url = f.url.value.trim();
    if (!/^https?:\/\//.test(url)) { toast('Cole um endereço que comece com http:// ou https://', 'err'); return; }
    const b = byId(state.coverPicker?.id);
    applyCover((id) => api('POST', '/api/cover/set', { id, url, format: b?.format }), f.querySelector('button'));
  }
});

// Imagens: Ctrl+V e arrastar-e-soltar. No seletor de capa viram a capa; senão, entrada de livros.
function routeImages(files) {
  if (!imageFiles(files).length) return false;
  if (state.modalKind === 'cover') { uploadCover(imageFiles(files)[0], null); return true; }
  if (state.modalKind === 'add' && state.addTab === 'imagem' && !state.importDraft) { addPendingImages(files); return true; }
  if (!modal().open) {
    state.importDraft = null;
    openAdd('imagem');
    addPendingImages(files);
    return true;
  }
  return false;
}
document.addEventListener('paste', (e) => {
  if (routeImages(e.clipboardData?.files)) e.preventDefault();
});
document.addEventListener('dragover', (e) => {
  if ([...(e.dataTransfer?.types || [])].includes('Files')) { e.preventDefault(); $('#dropzone')?.classList.add('over'); }
});
document.addEventListener('dragleave', (e) => { if (!e.relatedTarget) $('#dropzone')?.classList.remove('over'); });
document.addEventListener('drop', (e) => {
  if (![...(e.dataTransfer?.types || [])].includes('Files')) return;
  e.preventDefault();
  $('#dropzone')?.classList.remove('over');
  routeImages(e.dataTransfer.files);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && state.drawer.id && !modal().open) closeDrawer();
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('[role="button"][data-action]')) { e.preventDefault(); e.target.click(); }
  if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) && state.view === 'estante') { e.preventDefault(); $('#search')?.focus(); }
  if (e.key === 'Enter' && e.target.classList?.contains('title')) { e.preventDefault(); e.target.blur(); }
});

document.addEventListener('compositionend', (e) => {
  if (e.target.id === 'search') e.target.dispatchEvent(new Event('input', { bubbles: true }));
});

// Fecha o modal ao clicar no fundo, mas não ao soltar ali um arrasto que começou dentro
// (ex.: selecionar texto num campo e soltar o mouse fora).
let modalPressOnBackdrop = false;
modal().addEventListener('mousedown', (e) => { modalPressOnBackdrop = e.target === modal(); });
modal().addEventListener('click', (e) => { if (e.target === modal() && modalPressOnBackdrop) closeModal(); });

// ============================================================ tema & rotas
function applyTheme() {
  const t = store.get('theme');
  if (t) document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
  const dark = t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  $('[data-action="toggle-theme"]').innerHTML = icon(dark ? 'sun' : 'moon');
}
function toggleTheme() {
  const dark = document.documentElement.dataset.theme
    ? document.documentElement.dataset.theme === 'dark'
    : matchMedia('(prefers-color-scheme: dark)').matches;
  store.set('theme', dark ? 'light' : 'dark');
  applyTheme();
}
function route() {
  const v = location.hash.replace('#', '');
  state.view = ['estante', 'plano', 'descobrir'].includes(v) ? v : 'estante';
  renderView();
  window.scrollTo({ top: 0 });
}
window.addEventListener('hashchange', route);

// ============================================================ início
async function init() {
  applyTheme();
  $$('.top-actions .icon-btn')[1].innerHTML = icon('sliders');
  $('.i-plus').outerHTML = icon('plus');
  $('#view').innerHTML = `<div class="stats" style="margin-top:80px">${'<div class="card stat skeleton" style="height:96px"></div>'.repeat(4)}</div>`;
  try {
    const s = await api('GET', '/api/state');
    sanitizeLibrary(s.library || {});
    state.settings = s.settings;
    state.providers = s.providers;
  } catch (e) {
    $('#view').innerHTML = `<div class="empty"><h2>Servidor indisponível</h2><p>${esc(e.message)}. Rode <code>npm start</code> na pasta do app.</p></div>`;
    return;
  }
  renderAiPill();
  route();
  fillCovers();
}
init();
