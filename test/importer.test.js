import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMarkdownLibrary, normalizeTitle } from '../lib/importer.js';
import { parseJSON } from '../lib/ai.js';

const MD = `# Plano

## Fase 1 --- Fundamentos

1.  **Como Ler Livros** --- Mortimer J. Adler e Charles Van Doren
2.  **Trivium: As Artes Liberais** ---
    autor não confirmado

**Objetivo da fase:** desenvolver método
de leitura.

## Fase 2 --- Marxismo

1. **Análise Dialética do Marxismo** --- Mário Ferreira dos Santos (se
    ainda não tiver sido lido)
2. **Poesia Reunida --- Volume 2** --- Afonso Romano de Sant'Anna

## Fase 3 --- Repetição

1. **Analise dialetica do marxismo** --- Mário Ferreira dos Santos

## Os 10 títulos prioritários

1.  **Como Ler Livros** --- Mortimer J. Adler
`;

test('lê fases, autores, objetivos e prioridades', () => {
  const { books, phases } = parseMarkdownLibrary(MD);
  assert.equal(books.length, 4, 'duplicata entre fases é ignorada');
  assert.deepEqual(phases.map((p) => p.name), ['Fundamentos', 'Marxismo', 'Repetição']);
  assert.equal(phases[0].goal, 'desenvolver método de leitura.');
  assert.equal(books[0].author, 'Mortimer J. Adler e Charles Van Doren');
  assert.equal(books[0].priority, true);
  assert.equal(books[1].author, '', 'autor não confirmado vira vazio');
  assert.equal(books[2].author, 'Mário Ferreira dos Santos', 'comentário entre parênteses removido');
  assert.equal(books[3].title, 'Poesia Reunida — Volume 2');
  assert.equal(books[2].phaseIndex, 1);
});

test('aceita texto simples "Título - Autor"', () => {
  const { books } = parseMarkdownLibrary('## Fase 1 --- X\n- Meditações — Marco Aurélio\n');
  assert.deepEqual(books.map((b) => [b.title, b.author]), [['Meditações', 'Marco Aurélio']]);
});

test('normalizeTitle ignora acentos e pontuação', () => {
  assert.equal(normalizeTitle('Ética a Nicômaco!'), 'etica a nicomaco');
});

test('parseJSON tolera cercas de markdown e texto ao redor', () => {
  assert.deepEqual(parseJSON('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(parseJSON('Claro! Aqui está: {"b": [1,2]} espero que ajude'), { b: [1, 2] });
  assert.throws(() => parseJSON('sem json aqui'));
});
