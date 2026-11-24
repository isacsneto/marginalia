// Ritmo de leitura: registro diário do quanto se avançou em cada livro e as contas sobre ele.
// Funções puras (sem DOM nem estado global), usadas pela interface e testadas no Node.
//
// Registro (library.log): [{ id, book, date: 'AAAA-MM-DD', amount, unit: 'pag' | 'min', minutes?, auto? }]
//   amount  — quanto avançou: páginas (unit 'pag') ou minutos de áudio ouvidos (unit 'min');
//   minutes — tempo gasto, quando a leitura foi cronometrada ou registrada à mão;
//   auto    — avanço anotado sozinho ao mudar o progresso; os do mesmo dia e livro se somam.

const pad = (n) => String(n).padStart(2, '0');
/** Data local (não UTC): quem lê às 23h no Brasil continua no mesmo dia. */
export const localDay = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const at = (day) => new Date(`${day}T12:00:00`);
export function addDays(day, n) { const d = at(day); d.setDate(d.getDate() + n); return localDay(d); }
export const daysBetween = (a, b) => Math.round((at(b) - at(a)) / 864e5);
export const isDay = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(at(s).getTime());

/**
 * Aplica um avanço (delta > 0) ou uma correção (delta < 0) ao registro e devolve o novo registro.
 * Avanços entram no registro automático do dia; correções descontam dos registros mais recentes
 * do livro, para que um número digitado errado ontem possa ser consertado hoje.
 */
export function applyDelta(log, { book, delta, date, unit = 'pag', id }) {
  if (!delta) return log;
  if (delta > 0) {
    const i = log.findIndex((x) => x.book === book && x.date === date && x.auto && x.unit === unit);
    if (i >= 0) return log.map((x, j) => (j === i ? { ...x, amount: x.amount + delta } : x));
    return [...log, { id, book, date, amount: delta, unit, auto: true }];
  }
  let left = -delta;
  const order = log.map((x, i) => [x, i]).filter(([x]) => x.book === book && x.amount > 0)
    .sort(([a, i], [b, j]) => b.date.localeCompare(a.date) || j - i);
  const cut = new Map();
  for (const [x, i] of order) {
    if (!left) break;
    const take = Math.min(left, x.amount);
    cut.set(i, x.amount - take);
    left -= take;
  }
  return log.map((x, i) => (cut.has(i) ? { ...x, amount: cut.get(i) } : x)).filter((x) => x.amount > 0 || x.minutes > 0);
}

/** Totais por dia: { 'AAAA-MM-DD': { pages, audio, time } }. time = tempo registrado + minutos ouvidos. */
export function byDay(log) {
  const out = {};
  for (const e of log) {
    const d = (out[e.date] ||= { pages: 0, audio: 0, time: 0 });
    if (e.unit === 'min') { d.audio += e.amount; d.time += e.minutes || e.amount; }
    else { d.pages += e.amount; d.time += e.minutes || 0; }
  }
  return out;
}
export const activeDay = (v) => !!v && (v.pages > 0 || v.audio > 0 || v.time > 0);

/** Dias seguidos com leitura até hoje (ou até ontem, se hoje ainda não leu). */
export function streak(days, today) {
  let d = activeDay(days[today]) ? today : addDays(today, -1);
  let n = 0;
  while (activeDay(days[d])) { n++; d = addDays(d, -1); }
  return n;
}

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
export const RANGES = { semana: 'Semana', mes: '30 dias', ano: '12 meses', tudo: 'Tudo' };

/** Período do filtro: { from, to, bucket }. "Tudo" começa no primeiro registro (ou leitura concluída). */
export function rangeOf(key, today, firstDay = today) {
  if (key === 'semana') return { from: addDays(today, -6), to: today, bucket: 'day' };
  if (key === 'mes') return { from: addDays(today, -29), to: today, bucket: 'day' };
  const monthStart = (day, back) => { const d = at(day); d.setDate(1); d.setMonth(d.getMonth() - back); return localDay(d); };
  if (key === 'ano') return { from: monthStart(today, 11), to: today, bucket: 'month' };
  const from = firstDay < today ? firstDay : today;
  return { from: monthStart(from, 0), to: today, bucket: daysBetween(from, today) > 62 ? 'month' : 'day' };
}

/** Série para o gráfico de barras: um ponto por dia ou por mês do período, com o valor da métrica. */
export function series(days, { from, to, bucket }, metric) {
  const out = [];
  if (bucket === 'day') {
    for (let d = from; d <= to; d = addDays(d, 1)) {
      const dt = at(d);
      out.push({ key: d, value: days[d]?.[metric] || 0, label: `${dt.getDate()}`, long: `${WEEKDAYS[dt.getDay()]}, ${dt.getDate()} ${MONTHS[dt.getMonth()]}` });
    }
    return out;
  }
  const idx = new Map();
  for (let d = from.slice(0, 7); d <= to.slice(0, 7);) {
    const [y, m] = d.split('-').map(Number);
    idx.set(d, out.length);
    out.push({ key: d, value: 0, label: MONTHS[m - 1], long: `${MONTHS[m - 1]} ${y}` });
    d = m === 12 ? `${y + 1}-01` : `${y}-${pad(m + 1)}`;
  }
  for (const [day, v] of Object.entries(days)) {
    if (day < from || day > to) continue;
    const i = idx.get(day.slice(0, 7));
    if (i != null) out[i].value += v[metric] || 0;
  }
  return out;
}

/** Soma das métricas num período. */
export function totals(days, from, to) {
  const t = { pages: 0, audio: 0, time: 0, active: 0 };
  for (const [day, v] of Object.entries(days)) {
    if (day < from || day > to) continue;
    t.pages += v.pages; t.audio += v.audio; t.time += v.time;
    if (activeDay(v)) t.active++;
  }
  return t;
}

/** Páginas por hora, só com registros que têm páginas e tempo. */
export function pagesPerHour(log, from = '0000', to = '9999') {
  let pages = 0, min = 0;
  for (const e of log) {
    if (e.unit !== 'pag' || !(e.minutes > 0) || !(e.amount > 0) || e.date < from || e.date > to) continue;
    pages += e.amount; min += e.minutes;
  }
  return min >= 10 ? pages / (min / 60) : null;
}

/**
 * Tempo de leitura de um livro: sessões com tempo anotado (cronômetro ou à mão).
 * Para livros em páginas, pagesPerHour usa só as sessões que têm páginas e tempo.
 */
export function bookTime(log, book) {
  const sessions = log.filter((e) => e.book === book && e.minutes > 0)
    .sort((a, b) => b.date.localeCompare(a.date));
  let minutes = 0, pages = 0, pagedMin = 0;
  for (const e of sessions) {
    minutes += e.minutes;
    if (e.unit === 'pag' && e.amount > 0) { pages += e.amount; pagedMin += e.minutes; }
  }
  return { sessions, minutes, pages, pagesPerHour: pagedMin >= 10 ? pages / (pagedMin / 60) : null };
}

const size = (b) => Number(b.progress?.total) || (b.format === 'audiobook' ? 0 : Number(b.ai?.pages) || 0);

/** Leituras concluídas (inclui releituras do histórico), da mais recente para a mais antiga. */
export function finishedReadings(books) {
  const out = [];
  for (const b of books) {
    const past = Array.isArray(b.readings) ? b.readings : [];
    const all = [...past, ...(b.status === 'lido' ? [{ startedAt: b.startedAt, finishedAt: b.finishedAt, rating: b.rating }] : [])];
    all.forEach((r, i) => {
      const start = isDay(String(r.startedAt || '').slice(0, 10)) ? String(r.startedAt).slice(0, 10) : null;
      const end = isDay(String(r.finishedAt || '').slice(0, 10)) ? String(r.finishedAt).slice(0, 10) : null;
      const days = start && end && end >= start ? daysBetween(start, end) + 1 : null;
      out.push({ book: b, nth: i + 1, startedAt: start, finishedAt: end, days, rating: Number(r.rating) || 0, size: size(b) });
    });
  }
  return out.sort((a, b) => (b.finishedAt || '').localeCompare(a.finishedAt || ''));
}

/**
 * Previsão para um livro em andamento: ritmo das últimas duas semanas (ou desde que começou,
 * se faz menos tempo) e quando termina nesse ritmo.
 */
export function forecast(book, log, today, window = 14) {
  const total = Number(book.progress?.total) || 0;
  const left = total ? Math.max(0, total - (Number(book.progress?.current) || 0)) : null;
  const unit = book.format === 'audiobook' ? 'min' : 'pag';
  const started = isDay(String(book.startedAt || '').slice(0, 10)) ? String(book.startedAt).slice(0, 10) : null;
  const span = Math.max(1, Math.min(window, started ? daysBetween(started, today) + 1 : window));
  const from = addDays(today, -(span - 1));
  const recent = log.filter((e) => e.book === book.id && e.unit === unit && e.date >= from && e.date <= today)
    .reduce((s, e) => s + e.amount, 0);
  const perDay = recent / span;
  const last = log.filter((e) => e.book === book.id && e.amount > 0).reduce((m, e) => (e.date > m ? e.date : m), '');
  if (!perDay || left == null) return { perDay, left, days: null, date: null, last: last || null };
  const days = Math.ceil(left / perDay);
  return { perDay, left, days, date: addDays(today, days), last: last || null };
}
