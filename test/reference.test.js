import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseList, parseProgram, matchBooks, referenceContext } from '../lib/reference.js';

// Recorte no formato das páginas do Contra os Acadêmicos (WordPress, blocos de lista "is-style-livros").
const FILOSOFIA = `<html><h1>Lista de leitura de Filosofia</h1><div class="kicker">Lista de leitura · Humanidades</div>
<div class="ed-body">
<h2>Prolegômenos ao estudo</h2>
<h3>Prática da leitura</h3>
<ol class="wp-block-list is-style-livros"><li>Como Ler Livros – Mortimer Adler</li></ol>
<h3>Estudo da gramática</h3>
<ol class="wp-block-list is-style-livros"><li>O Trivium – Irmã Miriam Joseph<sup>[3]</sup></li></ol>
<h2>Nível 1</h2><p>Livros introdutórios.</p>
<ol class="wp-block-list is-style-livros"><li>Meditações – Marco Aurélio</li><li>Diálogos II – Górgias, Eutidemo – Platão</li><li>Diálogos III – Fedro, Eutífron – Platão</li></ol>
<h2>Nível 3</h2>
<ol class="wp-block-list is-style-livros"><li>A República &#8211; Platão</li><li>Política – Aristóteles</li></ol>
</div><div class="ed-share"><ol class="wp-block-list is-style-livros"><li>Fora do conteúdo – Ninguém</li></ol></div></html>`;

const BRASIL = `<h1>Lista de Literatura – Parte 5: Brasil</h1><div class="ed-body"><h2>Machado de Assis</h2>
<ol class="wp-block-list is-style-livros"><li>O alienista</li><li>Dom Casmurro</li></ol></div><footer></footer>`;

const PROGRAMA = `<div class="ed-body"><h2>Humanas</h2><ul><li><a href="/lista/lista-de-leitura-de-filosofia/">Filosofia</a></li></ul>
<h2>4. O Projeto do Polímata</h2><ul><li>Lógica – Estude também: Filosofia, até o nível 2 ou mais.</li></ul></div><div class="ed-share"></div>`;

const ref = {
  program: parseProgram(PROGRAMA),
  lists: [
    parseList(FILOSOFIA, 'https://contraosacademicos.com.br/lista/lista-de-leitura-de-filosofia/'),
    parseList(BRASIL, 'https://contraosacademicos.com.br/lista/lista-de-literatura-parte-5-brasil/'),
  ],
};

test('parseList lê níveis, seções e livros, ignorando o que está fora do conteúdo', () => {
  const l = ref.lists[0];
  assert.equal(l.title, 'Lista de leitura de Filosofia');
  assert.equal(l.category, 'Humanidades');
  assert.deepEqual(l.sections.map((s) => s.path), ['Prolegômenos ao estudo › Prática da leitura', 'Prolegômenos ao estudo › Estudo da gramática', 'Nível 1', 'Nível 3']);
  assert.equal(l.sections[1].items[0], 'O Trivium – Irmã Miriam Joseph'); // sem a nota de rodapé
  assert.equal(l.sections[3].items[0], 'A República – Platão'); // entidade decodificada
  assert.ok(!l.sections.flatMap((s) => s.items).some((i) => i.includes('Fora do conteúdo')));
});

test('parseProgram separa os grupos de listas e os pré-requisitos', () => {
  assert.deepEqual(ref.program.groups, [{ name: 'Humanas', lists: [{ name: 'Filosofia', slug: 'lista-de-leitura-de-filosofia' }] }]);
  assert.deepEqual(ref.program.prerequisites, ['Lógica – Estude também: Filosofia, até o nível 2 ou mais.']);
});

test('matchBooks encontra o nível de cada livro sem falsos positivos', () => {
  const books = [
    { id: 'a', title: 'Trivium: As Artes Liberais da Lógica', author: 'Irmã Miriam Joseph' }, // subtítulo diferente
    { id: 'b', title: 'Diálogos II: Górgias, Eutidemo e outros', author: 'Platão' },
    { id: 'c', title: 'O Alienista', author: 'Machado de Assis' }, // autor só no título da seção
    { id: 'd', title: 'A República', author: 'Platão' },
    { id: 'e', title: 'Política', author: 'Hannah Arendt' }, // mesmo título, outro autor
    { id: 'f', title: 'Meditações', author: 'René Descartes' }, // idem
    { id: 'g', title: 'Diálogos IV', author: 'Platão' }, // volume que não está na lista
  ];
  const m = matchBooks(ref, books);
  assert.equal(m.a?.[0].path, 'Prolegômenos ao estudo › Estudo da gramática');
  assert.equal(m.b?.length, 1);
  assert.equal(m.b[0].path, 'Nível 1');
  assert.equal(m.c?.[0].path, 'Machado de Assis');
  assert.equal(m.d?.[0].path, 'Nível 3');
  assert.equal(m.e, undefined);
  assert.equal(m.f, undefined);
  assert.equal(m.g, undefined);
});

test('referenceContext marca as seções do leitor e sugere o que falta, sem repetir o que ele tem', () => {
  const books = [{ id: 'x', title: 'Meditações', author: 'Marco Aurélio' }, { id: 'y', title: 'Como Ler Livros', author: 'Mortimer Adler' }];
  const ctx = referenceContext(ref, books, { candidates: 10 });
  assert.match(ctx.text, /\*Prolegômenos ao estudo › Prática da leitura/);
  assert.match(ctx.text, /\*Nível 1/);
  assert.match(ctx.text, /Lógica – Estude também/);
  assert.equal(ctx.byBook.x, 'Filosofia › Nível 1');
  assert.ok(ctx.next.some((n) => n.startsWith('O Trivium')));
  assert.ok(!ctx.next.some((n) => n.startsWith('Meditações') || n.startsWith('Como Ler Livros')));
});
