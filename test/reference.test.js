import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseList, parseProgram, matchBooks, buildReferencePlan, referenceContext } from '../lib/reference.js';

// Recortes no formato do conteúdo das listas do Contra os Acadêmicos (API do WordPress).
const FILOSOFIA = `
<p>Insistimos que não se dediquem a outras listas antes de finalizado o estudo dos Prolegômenos.</p>
<h2>Prolegômenos ao estudo</h2>
<h3>Vocação e Vida Intelectual</h3>
<ol class="wp-block-list is-style-livros"><li>A Vida Intelectual – A.D. Sertillanges<sup>[2]</sup></li><li>O Trabalho Intelectual – Jean Guitton</li></ol>
<h3>Prática da leitura</h3>
<ol class="wp-block-list is-style-livros"><li>Como Ler Livros – Mortimer Adler</li></ol>
<h3>Estudo da gramática</h3>
<ol class="wp-block-list is-style-livros"><li>O Trivium – Irmã Miriam Joseph</li></ol>
<h3>Leitura Complementar</h3>
<ol class="wp-block-list is-style-livros"><li>A Instrução dos Principiantes – Hugo de São Vitor</li></ol>
<h2>Nível 1</h2><p>Livros introdutórios.</p>
<h3>Introdução</h3>
<ol class="wp-block-list is-style-livros"><li>A Filosofia a Partir de seus Problemas – Mário Porta</li></ol>
<p>5. Filosofia e Cosmovisão – Mário Ferreira dos Santos</p>
<h3>Filosofia Antiga</h3>
<ol class="wp-block-list is-style-livros"><li>Diálogos II – Górgias, Eutidemo – Platão</li><li>Diálogos III – Fedro, Eutífron – Platão</li></ol>
<h3>Agostinho de Hipona</h3>
<p>17. Confissões</p>
<h2>Nível 3</h2>
<h3>Platão</h3>
<ol class="wp-block-list is-style-livros"><li>A República &#8211; Platão</li><li>Política – Aristóteles</li></ol>
<h3>Livros não propriamente filosóficos, mas necessários</h3>
<ol class="wp-block-list is-style-livros"><li>História da Filosofia – Julián Marias</li></ol>
<h2>Notas</h2>
<ol><li>Nota de rodapé que não é livro.</li></ol>`;

const ECONOMIA = `<ol class="wp-block-list is-style-livros"><li>Na Parte I não se exige uma leitura rígida interna aos tópicos, embora aconselhe-se não sair lendo 4 livros ao mesmo tempo.</li></ol>
<h2>Introduções</h2><ol class="wp-block-list is-style-livros"><li>Henry Hazlitt – Economia numa Única Lição</li></ol>`;

const HISTORIA = `<h2>4. História Geral</h2><ol class="wp-block-list is-style-livros"><li>Fustel de Coulanges – A Cidade Antiga</li></ol>`;

const BRASIL = `<h2>Machado de Assis</h2><ol class="wp-block-list is-style-livros"><li>O alienista</li><li>Dom Casmurro</li></ol>`;

const PROGRAMA = `<h2>Humanas</h2><ol class="wp-block-list is-style-livros"><li><a href="/lista/lista-de-leitura-de-filosofia-para-iniciantes-e-interessados/">Filosofia</a></li></ol>
<h2>4. O Projeto do Polímata</h2><ol>
<li><a href="https://contraosacademicos.com.br/lista/lista-de-leitura-de-filosofia-para-iniciantes-e-interessados/">Filosofia</a> – Pré requisito: Prolegômenos</li>
<li><a href="https://contraosacademicos.com.br/lista/lista-de-leitura-de-historia/">História</a> – Estude também: Filosofia, até o nível 1 ou mais.</li>
<li><a href="https://contraosacademicos.com.br/lista/lista-de-leitura-de-direito/">Direito</a> – Estude também: Filosofia por completo; História (conforme orientações da lista).</li>
<li><a href="https://contraosacademicos.com.br/lista/lista-de-leitura-de-economia/">Economia</a> – Estude também: Filosofia, até o nível 2; História; Direito, até “raízes contemporâneas” ou mais.</li>
</ol>`;

const site = (slug) => `https://contraosacademicos.com.br/lista/${slug}/`;
const ref = {
  program: parseProgram(PROGRAMA),
  lists: [
    parseList(FILOSOFIA, { slug: 'lista-de-leitura-de-filosofia-para-iniciantes-e-interessados', url: site('filosofia'), title: 'Lista de leitura de Filosofia para iniciantes e interessados', category: 'Humanidades' }),
    parseList(ECONOMIA, { slug: 'lista-de-leitura-de-economia', url: site('economia'), title: 'Lista de Leitura de Economia', category: 'Humanidades' }),
    parseList(HISTORIA, { slug: 'lista-de-leitura-de-historia', url: site('historia'), title: 'Lista de Leitura de História', category: 'Humanidades' }),
    parseList(BRASIL, { slug: 'lista-de-literatura-parte-5-brasil', url: site('brasil'), title: 'Lista de Literatura – Parte 5: Brasil', category: 'Literatura' }),
  ],
};
const filosofia = ref.lists[0];

test('parseList lê seções, itens em parágrafo numerado, opcionais e paralelos, e para nas notas', () => {
  assert.deepEqual(filosofia.sections.map((s) => s.path), [
    'Prolegômenos ao estudo › Vocação e Vida Intelectual', 'Prolegômenos ao estudo › Prática da leitura',
    'Prolegômenos ao estudo › Estudo da gramática', 'Prolegômenos ao estudo › Leitura Complementar',
    'Nível 1 › Introdução', 'Nível 1 › Filosofia Antiga', 'Nível 1 › Agostinho de Hipona',
    'Nível 3 › Platão', 'Nível 3 › Livros não propriamente filosóficos, mas necessários',
  ]);
  assert.equal(filosofia.sections[0].items[0], 'A Vida Intelectual – A.D. Sertillanges'); // sem a nota de rodapé
  assert.deepEqual(filosofia.sections[4].items, ['A Filosofia a Partir de seus Problemas – Mário Porta', 'Filosofia e Cosmovisão – Mário Ferreira dos Santos']);
  assert.deepEqual(filosofia.sections[6].items, ['Confissões']);
  assert.equal(filosofia.sections[3].optional, true);
  assert.equal(filosofia.sections[8].parallel, true);
  assert.ok(!filosofia.sections.flatMap((s) => s.items).some((i) => /rodapé/.test(i)));
  // Instrução escrita como lista antes do primeiro título não vira livro.
  assert.deepEqual(ref.lists[1].sections.flatMap((s) => s.items), ['Henry Hazlitt – Economia numa Única Lição']);
});

test('parseProgram segue o Projeto do Polímata, inclusive a espera por outras listas', () => {
  const o = ref.program.order;
  assert.deepEqual(o.map((x) => x.name), ['Filosofia', 'História', 'Direito', 'Economia']);
  assert.deepEqual(o.map((x) => x.gate), [0, 1, 3, 3]); // Economia pede Direito, que pede a Filosofia completa
  assert.equal(o[1].slug, 'lista-de-leitura-de-historia');
});

test('matchBooks prefere a lista de Filosofia e não confunde autores', () => {
  const m = matchBooks(ref, [
    { id: 'a', title: 'Trivium: As Artes Liberais', author: 'Irmã Miriam Joseph' },
    { id: 'b', title: 'Confissões', author: 'Santo Agostinho' }, // autor só no título da seção
    { id: 'c', title: 'O Alienista', author: 'Machado de Assis' },
    { id: 'd', title: 'Política', author: 'Hannah Arendt' }, // mesmo título, outro autor
    { id: 'e', title: 'Diálogos IV', author: 'Platão' }, // volume que não está na lista
  ]);
  assert.equal(m.a[0].path, 'Prolegômenos ao estudo › Estudo da gramática');
  assert.equal(m.b[0].path, 'Nível 1 › Agostinho de Hipona');
  assert.equal(m.c[0].path, 'Machado de Assis');
  assert.equal(m.d, undefined);
  assert.equal(m.e, undefined);
});

test('buildReferencePlan reproduz a sequência do site e mostra o que falta', () => {
  const books = [
    { id: 'como', title: 'Como Ler Livros', author: 'Mortimer Adler', status: 'lendo' },
    { id: 'conf', title: 'Confissões', author: 'Santo Agostinho', status: 'quero_ler' },
    { id: 'rep', title: 'A República', author: 'Platão', status: 'quero_ler' },
    { id: 'haz', title: 'Economia em uma Única Lição', author: 'Henry Hazlitt', status: 'quero_ler' },
    { id: 'cid', title: 'A Cidade Antiga', author: 'Fustel de Coulanges', status: 'quero_ler' },
    { id: 'ali', title: 'O Alienista', author: 'Machado de Assis', status: 'quero_ler' },
    { id: 'marias', title: 'História da Filosofia', author: 'Julián Marías', status: 'quero_ler' },
    { id: 'sapiens', title: 'Sapiens', author: 'Yuval Harari', status: 'quero_ler' },
  ];
  const plan = buildReferencePlan(ref, books);
  // Prolegômenos -> Nível 1 -> História (liberada no nível 1) -> Nível 3 -> Economia (depois da Filosofia completa).
  assert.deepEqual(plan.phases.map((p) => p.name), ['Prolegômenos', 'Filosofia · Nível 1', 'História', 'Filosofia · Nível 3', 'Economia', 'Em paralelo', 'Fora das listas']);
  const prol = plan.phases[0];
  assert.deepEqual(prol.books.map((x) => x.id || `falta:${x.title}`), ['falta:A Vida Intelectual', 'falta:O Trabalho Intelectual', 'como', 'falta:O Trivium']);
  assert.equal(prol.books[0].author, 'A.D. Sertillanges');
  assert.equal(prol.optionalMissing, 1); // a leitura complementar não aparece como "falta"
  assert.ok(plan.phases[1].books.some((x) => x.id === 'conf'));
  assert.deepEqual(plan.phases.find((p) => p.kind === 'parallel').books.map((x) => x.id), ['marias', 'ali']);
  assert.deepEqual(plan.phases.find((p) => p.kind === 'outside').books.map((x) => x.id), ['sapiens']);
  assert.equal(plan.now[0].id, 'como');
  assert.match(plan.summary, /Você está em Prolegômenos/);
});

test('referenceContext lista primeiro o que falta na etapa atual, na ordem do site', () => {
  const ctx = referenceContext(ref, [{ id: 'como', title: 'Como Ler Livros', author: 'Mortimer Adler', status: 'lendo' }], { candidates: 3 });
  assert.deepEqual(ctx.next.map((n) => n.split(' – ')[0]), ['A Vida Intelectual', 'O Trabalho Intelectual', 'O Trivium']);
  assert.equal(ctx.byBook.como, 'Prolegômenos › Prática da leitura');
});

test('encaixes da IA entram na posição pedida, sem mexer na ordem do site nem nos Prolegômenos', async () => {
  const { fitTargets, sanitizeFits } = await import('../lib/reference.js');
  const books = [
    { id: 'como', title: 'Como Ler Livros', author: 'Mortimer Adler', status: 'lendo' },
    { id: 'conf', title: 'Confissões', author: 'Santo Agostinho', status: 'quero_ler' },
    { id: 'warb', title: 'Uma Breve História da Filosofia', author: 'Nigel Warburton', status: 'quero_ler' },
    { id: 'sapiens', title: 'Sapiens', author: 'Yuval Harari', status: 'quero_ler' },
    { id: 'guia', title: 'O Guia do Mochileiro das Galáxias', author: 'Douglas Adams', status: 'quero_ler' },
  ];
  const base = buildReferencePlan(ref, books);
  const targets = fitTargets(base, books);
  assert.ok(!targets.some((t) => t.key === 'nivel-0'), 'Prolegômenos não recebem encaixes');
  assert.ok(targets.some((t) => t.key === 'lista-de-leitura-de-historia'), 'listas de área vazias também podem receber');
  assert.ok(targets.some((t) => t.key === 'paralelo'));
  const fits = sanitizeFits([
    { id: 'warb', phase: 'nivel-1', position: 0, reason: 'panorama antes das fontes' },
    { id: 'sapiens', phase: 'lista-de-leitura-de-historia', position: 1, reason: 'história geral' },
    { id: 'guia', phase: 'paralelo', position: 9, reason: 'lazer' },
    { id: 'conf', phase: 'nivel-3', position: 0, reason: 'não está fora das listas' }, // ignorado
    { id: 'warb2', phase: 'nivel-0', position: 0 }, // ignorado
  ], targets, new Set(['warb', 'sapiens', 'guia']));
  assert.deepEqual(Object.keys(fits).sort(), ['guia', 'sapiens', 'warb']);
  const plan = buildReferencePlan(ref, books, { fits });
  const n1 = plan.phases.find((p) => p.key === 'nivel-1');
  assert.equal(n1.books[0].id, 'warb');
  assert.equal(n1.books[0].fit, true);
  // A ordem do site depois do encaixe continua a mesma.
  assert.deepEqual(n1.books.slice(1).map((x) => x.id || x.title), base.phases.find((p) => p.key === 'nivel-1').books.map((x) => x.id || x.title));
  assert.deepEqual(plan.phases.find((p) => p.key === 'lista-de-leitura-de-historia').books.map((x) => x.id), ['sapiens']);
  assert.ok(plan.phases.find((p) => p.key === 'paralelo').books.some((x) => x.id === 'guia'));
  assert.equal(plan.phases.find((p) => p.kind === 'outside'), undefined);
  // Mesmo se vier um encaixe nos Prolegômenos, ele é ignorado.
  const forced = buildReferencePlan(ref, books, { fits: { warb: { phase: 'nivel-0', position: 0 } } });
  assert.ok(forced.phases.find((p) => p.kind === 'outside').books.some((x) => x.id === 'warb'));
});
