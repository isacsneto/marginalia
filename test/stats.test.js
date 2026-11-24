import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  localDay, addDays, daysBetween, applyDelta, byDay, streak, rangeOf, series, totals,
  pagesPerHour, finishedReadings, forecast, bookTime,
} from '../public/stats.js';

let n = 0;
const id = () => `e${++n}`;

test('datas locais e aritmética de dias', () => {
  assert.equal(localDay(new Date(2026, 0, 5, 23, 30)), '2026-01-05'); // 23h30 continua no mesmo dia
  assert.equal(addDays('2026-02-28', 1), '2026-03-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(daysBetween('2026-10-30', '2026-11-02'), 3);
});

test('avanços do mesmo dia se somam; correções descontam dos registros mais recentes', () => {
  let log = [];
  log = applyDelta(log, { book: 'a', delta: 10, date: '2026-11-01', id: id() });
  log = applyDelta(log, { book: 'a', delta: 15, date: '2026-11-01', id: id() });
  assert.equal(log.length, 1);
  assert.equal(log[0].amount, 25);
  log = applyDelta(log, { book: 'a', delta: 30, date: '2026-11-02', id: id() });
  // Digitou 30 a mais ontem: corrige hoje e o desconto sai do registro mais recente primeiro.
  log = applyDelta(log, { book: 'a', delta: -40, date: '2026-11-03', id: id() });
  assert.deepEqual(log.map((e) => [e.date, e.amount]), [['2026-11-01', 15]]);
  // Outro livro não é afetado; sessões com tempo ficam mesmo sem páginas.
  log = [...log, { id: id(), book: 'b', date: '2026-11-03', amount: 5, unit: 'pag', minutes: 20 }];
  log = applyDelta(log, { book: 'b', delta: -5, date: '2026-11-03', id: id() });
  assert.deepEqual(log.find((e) => e.book === 'b'), { id: log.find((e) => e.book === 'b').id, book: 'b', date: '2026-11-03', amount: 0, unit: 'pag', minutes: 20 });
  assert.equal(log.find((e) => e.book === 'a').amount, 15);
});

test('totais por dia separam páginas, áudio e tempo', () => {
  const log = [
    { book: 'a', date: '2026-11-01', amount: 20, unit: 'pag', minutes: 40 },
    { book: 'a', date: '2026-11-01', amount: 10, unit: 'pag', auto: true },
    { book: 'b', date: '2026-11-01', amount: 30, unit: 'min' },
    { book: 'b', date: '2026-11-02', amount: 60, unit: 'min', minutes: 45 }, // ouviu 60 min em 45 (velocidade 1,33×)
  ];
  const days = byDay(log);
  assert.deepEqual(days['2026-11-01'], { pages: 30, audio: 30, time: 70 });
  assert.deepEqual(days['2026-11-02'], { pages: 0, audio: 60, time: 45 });
  assert.deepEqual(totals(days, '2026-11-01', '2026-11-30'), { pages: 30, audio: 90, time: 115, active: 2 });
  assert.equal(pagesPerHour(log), 30); // 20 páginas em 40 minutos
});

test('sequência conta até hoje, ou até ontem se hoje ainda não leu', () => {
  const days = { '2026-11-08': { pages: 5, audio: 0, time: 0 }, '2026-11-09': { pages: 5, audio: 0, time: 0 }, '2026-11-10': { pages: 1, audio: 0, time: 0 } };
  assert.equal(streak(days, '2026-11-10'), 3);
  assert.equal(streak(days, '2026-11-11'), 3);
  assert.equal(streak(days, '2026-11-12'), 0);
});

test('períodos e séries do gráfico', () => {
  const days = { '2026-11-14': { pages: 12, audio: 0, time: 0 }, '2026-10-02': { pages: 40, audio: 0, time: 0 }, '2025-12-31': { pages: 99, audio: 0, time: 0 } };
  const week = rangeOf('semana', '2026-11-14');
  assert.deepEqual(week, { from: '2026-11-08', to: '2026-11-14', bucket: 'day' });
  const s = series(days, week, 'pages');
  assert.equal(s.length, 7);
  assert.equal(s.at(-1).value, 12);
  const year = rangeOf('ano', '2026-11-14');
  assert.equal(year.from, '2025-12-01');
  const m = series(days, year, 'pages');
  assert.equal(m.length, 12);
  assert.equal(m[0].value, 99);
  assert.equal(m.find((p) => p.key === '2026-10').value, 40);
  // "Tudo" com poucos dias fica por dia; com meses de histórico, por mês.
  assert.equal(rangeOf('tudo', '2026-11-14', '2026-11-01').bucket, 'day');
  assert.equal(rangeOf('tudo', '2026-11-14', '2025-01-10').bucket, 'month');
});

test('leituras concluídas, com releituras e duração', () => {
  const books = [
    { id: 'a', status: 'lido', startedAt: '2026-10-01', finishedAt: '2026-10-10', rating: 5, progress: { total: 300 },
      readings: [{ startedAt: '2025-01-01', finishedAt: '2025-01-31', rating: 4 }] },
    { id: 'b', status: 'lido', startedAt: null, finishedAt: '2026-09-01', progress: {}, ai: { pages: 120 } },
    { id: 'c', status: 'lendo', startedAt: '2026-11-01', progress: { current: 10, total: 100 } },
  ];
  const r = finishedReadings(books);
  assert.deepEqual(r.map((x) => [x.book.id, x.nth, x.days, x.size]), [['a', 2, 10, 300], ['b', 1, null, 120], ['a', 1, 31, 300]]);
});

test('previsão de término pelo ritmo recente', () => {
  const book = { id: 'c', format: 'fisico', startedAt: '2026-11-05', progress: { current: 100, total: 300 } };
  const log = [
    { book: 'c', date: '2026-11-05', amount: 50, unit: 'pag' },
    { book: 'c', date: '2026-11-08', amount: 50, unit: 'pag' },
    { book: 'x', date: '2026-11-08', amount: 500, unit: 'pag' },
  ];
  // Começou há 5 dias (05 a 09): 100 páginas / 5 dias = 20 por dia; faltam 200 → 10 dias.
  const f = forecast(book, log, '2026-11-09');
  assert.equal(f.perDay, 20);
  assert.equal(f.days, 10);
  assert.equal(f.date, '2026-11-19');
  assert.equal(f.last, '2026-11-08');
  // Sem total, não prevê o fim.
  assert.equal(forecast({ ...book, progress: { current: 100 } }, log, '2026-11-09').days, null);
});

test('tempo de leitura por livro: só sessões com tempo, ritmo com páginas', () => {
  const log = [
    { id: 'a1', book: 'a', date: '2026-11-01', amount: 20, unit: 'pag', minutes: 30 },
    { id: 'a2', book: 'a', date: '2026-11-03', amount: 0, unit: 'pag', minutes: 15 }, // só tempo
    { id: 'a3', book: 'a', date: '2026-11-02', amount: 40, unit: 'pag' }, // sem tempo: fica fora
    { id: 'b1', book: 'b', date: '2026-11-02', amount: 10, unit: 'pag', minutes: 60 },
  ];
  const t = bookTime(log, 'a');
  assert.deepEqual(t.sessions.map((e) => e.id), ['a2', 'a1']); // mais recente primeiro
  assert.equal(t.minutes, 45);
  assert.equal(t.pages, 20);
  assert.equal(t.pagesPerHour, 40); // 20 pág. em 30 min
  assert.equal(bookTime(log, 'c').pagesPerHour, null);
  assert.equal(bookTime([{ id: 'x', book: 'c', date: '2026-11-01', amount: 5, unit: 'pag', minutes: 5 }], 'c').pagesPerHour, null); // menos de 10 min
});
