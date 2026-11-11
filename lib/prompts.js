// Prompts das tarefas de IA. Todos pedem um único objeto JSON em português.

export const CATEGORIES = [
  'Filosofia', 'Lógica e Método', 'Política', 'Economia', 'Investimentos e Negócios',
  'Religião e Espiritualidade', 'História', 'Ciência', 'Psicologia', 'Desenvolvimento Pessoal',
  'Tecnologia', 'Literatura', 'Poesia', 'Outros',
];

export const SYSTEM = `Você é um bibliotecário e curador de leitura experiente, que conhece bem filosofia, ciências humanas, ciência e literatura, inclusive edições brasileiras.
Regras:
- Responda SEMPRE com um único objeto JSON válido. Nada de markdown, nada de texto antes ou depois.
- Escreva em português do Brasil, com clareza e sem jargão desnecessário.
- Seja factual. Se não souber algo com segurança, diga isso no campo em vez de inventar.
- Apresente cada obra de forma justa, inclusive quando tradições divergem entre si; descreva as ideias, não julgue o leitor.`;

const fmtLabel = { fisico: 'físico', audiobook: 'audiobook', ebook: 'e-book' };
const statusLabel = { quero_ler: 'quero ler', lendo: 'lendo', lido: 'lido', pausado: 'pausado', abandonado: 'abandonado' };

function catalog(books) {
  return books.map((b) => `- [${b.id}] ${b.title}${b.author ? ` — ${b.author}` : ''}`).join('\n');
}

function richLine(b) {
  const parts = [`[${b.id}] ${b.title}${b.author ? ` — ${b.author}` : ''}`];
  parts.push(`formato: ${fmtLabel[b.format] || b.format}`);
  parts.push(`status: ${statusLabel[b.status] || b.status}`);
  if (b.ownership === 'desejo') parts.push('ainda não comprado');
  if (b.ai?.category) parts.push(`categoria: ${b.ai.category}${b.ai.subcategory ? ` / ${b.ai.subcategory}` : ''}`);
  if (b.ai?.nature) parts.push(`natureza: ${b.ai.nature}`);
  if (b.ai?.difficulty) parts.push(`dificuldade: ${b.ai.difficulty}/5`);
  if (b.ai?.hours) parts.push(`~${b.ai.hours}h`);
  if (b.userPhase) parts.push(`fase no plano original: ${b.userPhase}`);
  if (b.rating) parts.push(`nota do leitor: ${b.rating}/5`);
  if (b.ref) parts.push(`na referência: ${b.ref}`);
  const reads = Number(b.readings) || 0;
  if (b.status === 'lido' && b.reread) parts.push(`RELEITURA: já lido ${reads + 1}x, o leitor quer reler`);
  else if (b.status === 'lido' && reads) parts.push(`lido ${reads + 1}x`);
  else if (b.status === 'lendo' && reads) parts.push(`em releitura (${reads + 1}ª leitura)`);
  return `- ${parts.join(' | ')}`;
}

export function classify(batch, library) {
  return `Classifique os livros abaixo, que fazem parte da biblioteca pessoal do leitor.

LIVROS A CLASSIFICAR:
${batch.map((b) => `- [${b.id}] "${b.title}" — autor informado: ${b.author || '(vazio)'} — formato: ${fmtLabel[b.format] || b.format}`).join('\n')}

BIBLIOTECA COMPLETA (para o campo "related"):
${catalog(library)}

Devolva exatamente este formato:
{"books": [{
  "id": "mesmo id recebido",
  "author": "autor correto; corrija se estiver vazio ou 'a confirmar'. Use 'desconhecido' se não tiver certeza",
  "category": "uma destas: ${CATEGORIES.join(', ')}",
  "subcategory": "ex.: Estoicismo, Escola Austríaca, Romance russo",
  "nature": "teórico | prático | narrativo | misto",
  "difficulty": 1-5 (1 = leitura leve, 5 = muito densa),
  "pages": número aproximado de páginas da edição mais comum no Brasil,
  "hours": horas estimadas de leitura atenta (inteiro),
  "intro": "2 a 4 frases: do que trata, contexto do autor e da obra, e o que o leitor ganha",
  "why": "uma frase curta: por que ler",
  "themes": ["3 a 5 temas centrais"],
  "prerequisites": ["o que ajuda ler antes (títulos ou assuntos); vazio se nada"],
  "related": ["ids da BIBLIOTECA COMPLETA que dialogam com este livro, no máximo 4"]
}]}`;
}

// Bloco das listas do Contra os Acadêmicos para o Descobrir (o plano desse modo é montado em código).
const withRef = (books, ref) => (ref ? books.map((b) => ({ ...b, ref: ref.byBook[b.id] || '' })) : books);
function referenceBlock(ref) {
  return ref ? `
REFERÊNCIA: o leitor segue o programa de estudos do site Contra os Acadêmicos (contraosacademicos.com.br/lista). O campo "na referência" diz em que etapa da sequência do site está cada livro dele.
${ref.text}
` : '';
}

export function plan(books, prefs = {}) {
  const minutes = prefs.minutesPerDay || 45;
  const goal = prefs.goal?.trim();
  const active = books.filter((b) => (b.status === 'lido' ? b.reread : b.status !== 'abandonado'));
  const done = books.filter((b) => b.status === 'lido' && !b.reread);
  return `Monte um plano de leitura para a biblioteca abaixo.

Contexto do leitor:
- Tempo disponível: cerca de ${minutes} minutos por dia.
${goal ? `- Objetivo declarado: ${goal}\n` : ''}- Ele gosta de alternar um livro principal (mais denso) com leituras mais leves em paralelo.
- Audiobooks servem para momentos em que não dá para ler (trânsito, academia, tarefas).
- Livros "lendo" devem aparecer primeiro. Livros "ainda não comprado" podem entrar, mas sinalize no motivo.

JÁ LIDOS (não incluir nas fases; use como base do que ele já sabe):
${done.length ? done.map(richLine).join('\n') : '- nenhum'}

A LER:
${active.map(richLine).join('\n')}

Regras:
- Inclua cada livro de "A LER" exatamente uma vez, em alguma fase.
- Ordene de forma progressiva: fundamentos e método antes de obras que dependem deles; clássicos antes de seus comentadores e críticos, quando fizer sentido.
- Se o leitor já tinha um plano ("fase no plano original"), aproveite o que fizer sentido e explique as mudanças relevantes no resumo.
- Fases com 2 a 6 livros, com nome curto e objetivo claro.
- Use seu próprio critério de curador, apoiado na avaliação geral de cada obra: o consenso de especialistas, críticos e leitores sobre importância, dificuldade e pré-requisitos, e o que costumam recomendar programas de estudo reconhecidos (cursos de grandes livros, currículos de humanidades, guias clássicos de leitura). Não siga uma única escola ou lista; quando tradições divergirem sobre a ordem ou o peso de uma obra, escolha e explique brevemente.
- Livros marcados RELEITURA já foram lidos e o leitor quer voltar a eles: posicione cada um onde a releitura rende mais (em geral depois de livros que ampliam o contexto dele) e diga no motivo o que buscar nessa nova leitura.
- Obras densas não se esgotam numa leitura. Em "rereads", indique até 3 livros de "JÁ LIDOS" (nunca os marcados RELEITURA) que valeriam uma releitura agora, considerando dificuldade, nota do leitor e o que ele vai ler a seguir. Se nenhum fizer sentido, devolva [].

Devolva exatamente este formato:
{
  "summary": "3 a 5 frases explicando a lógica do plano",
  "now": [{"id": "...", "role": "principal | paralelo | audiobook", "reason": "por que começar por este agora"}],
  "phases": [{"name": "...", "goal": "o que essa fase constrói", "weeks": número estimado de semanas no ritmo informado, "books": [{"id": "...", "reason": "uma frase: por que aqui, nesta ordem"}]}],
  "parallel": [{"ids": ["id1", "id2"], "reason": "por que funcionam bem juntos (contraste de ritmo, temas que conversam, etc.)"}],
  "routine": ["3 a 5 dicas práticas de rotina para esse leitor"],
  "rereads": [{"id": "id de um livro já lido", "reason": "por que reler agora e o que observar na segunda leitura"}]
}
"now" deve ter de 1 a 3 itens. "parallel" deve ter de 3 a 6 pares.`;
}

export function suggest(books, ref = null) {
  books = withRef(books, ref);
  return `Com base na biblioteca abaixo, sugira de 8 a 10 livros que o leitor ainda NÃO tem e que valeriam a compra.

BIBLIOTECA:
${books.map(richLine).join('\n')}
${referenceBlock(ref)}${ref?.next?.length ? `
O QUE FALTA NA ETAPA ATUAL E NA SEGUINTE (livros do site que ele não tem, na ordem do site):
${ref.next.map((x) => `- ${x}`).join('\n')}

Sugira principalmente esses livros, na ordem em que o site os coloca (primeiro o que falta na etapa atual). Use o título e o autor como estão acima. Só inclua obras de fora dessa relação se ela tiver menos de 8 itens, e diga isso no "why". No "why", diga em que etapa do site a obra está (ex.: "Prolegômenos › Prática da leitura") e por que ela importa ali; nesse modo, use "base" para o que falta na etapa atual e "aprofundar" para a seguinte.
` : ref ? '' : `
Use seu próprio critério, apoiado na avaliação geral das obras: reputação entre especialistas, críticos e leitores, lugar que ocupam nos estudos da área e qualidade das edições em português. Não se limite a uma escola ou lista.
`}
Misture tipos de sugestão:
- "base": obras introdutórias ou de apoio que facilitam livros densos que ele já tem;
- "aprofundar": próximos passos naturais em temas que ele está construindo;
- "contraponto": autores de outras tradições que discutem os mesmos temas, para uma visão equilibrada;
- "lazer": literatura ou divulgação científica que conversa com os temas.
Prefira obras com boa edição em português.

Devolva exatamente este formato:
{
  "summary": "2 a 3 frases sobre lacunas e oportunidades da biblioteca",
  "items": [{
    "title": "...", "author": "...",
    "category": "uma destas: ${CATEGORIES.join(', ')}",
    "nature": "teórico | prático | narrativo | misto",
    "kind": "base | aprofundar | contraponto | lazer",
    "priority": 1-3 (1 = comprar primeiro),
    "why": "2 frases: o que acrescenta e por que agora",
    "complements": ["ids da biblioteca com que mais dialoga, até 3"]
  }]
}`;
}

export function guide(book, library) {
  return `Prepare um guia de leitura para o livro abaixo, pensado para quem vai lê-lo agora.

LIVRO: [${book.id}] "${book.title}" — ${book.author || 'autor não informado'} (${fmtLabel[book.format] || book.format})
${book.ai?.intro ? `Resumo já conhecido: ${book.ai.intro}` : ''}
${book.reads ? `O leitor já leu este livro ${book.reads === 1 ? 'uma vez' : `${book.reads} vezes`} e vai relê-lo. Pense o guia para a releitura: o que só se percebe numa segunda leitura, a arquitetura do argumento, passagens que valem ser revisitadas com calma e perguntas mais profundas.` : ''}

BIBLIOTECA DO LEITOR (para conexões):
${catalog(library.filter((b) => b.id !== book.id))}

Devolva exatamente este formato:
{
  "context": "2 a 4 frases: autor, época e problema que a obra responde",
  "structure": "como o livro está organizado (partes, capítulos-chave) e como navegá-lo",
  "keyIdeas": ["4 a 7 ideias centrais, cada uma em uma frase"],
  "watchFor": ["3 a 5 pontos de atenção: passagens difíceis, conceitos que costumam confundir, armadilhas de interpretação"],
  "questions": ["4 a 6 perguntas para ler ativamente e anotar"],
  "approach": "como ler: ritmo sugerido, se vale ler introdução/apêndices, edição ou tradução recomendada se souber",
  "connections": [{"id": "id da biblioteca", "note": "como dialoga com este livro"}],
  "after": "o que ler em seguida e por quê (pode ser da biblioteca ou não)"
}`;
}

export function extractImage(count) {
  return `${count > 1 ? `As ${count} imagens anexadas mostram` : 'A imagem anexada mostra'} livros que o leitor quer adicionar à biblioteca.
Pode ser: foto ou print de uma capa, foto de lombadas numa estante, print de app (Kindle, Audible, Storytel, Skoob, Goodreads), página de loja, carrinho ou comprovante de compra.

Identifique cada livro visível e devolva exatamente este formato:
{
  "source": "descrição curta do que é a imagem (ex.: comprovante da Amazon, foto de estante)",
  "books": [{
    "title": "título como publicado no Brasil, com acentos corretos",
    "author": "autor; complete só se tiver certeza, senão vazio",
    "format": "fisico | audiobook | ebook (audiobook para Audible/Storytel/Spotify/Ubook, ebook para Kindle/Kobo/Apple Books, fisico nos demais)",
    "price": valor pago em reais como número (ex.: 39.9) ou null,
    "store": "loja, se aparecer, senão vazio",
    "date": "data da compra AAAA-MM-DD, se aparecer, senão vazio"
  }]
}
Regras: ignore itens que não são livros (frete, brindes, outros produtos); não repita o mesmo livro; se não houver livro legível, devolva "books": [].`;
}

export function extract(text) {
  return `Extraia a lista de livros do texto abaixo. Ignore títulos de seção, comentários e duplicatas.

TEXTO:
"""
${text.slice(0, 40000)}
"""

Devolva exatamente este formato:
{"books": [{"title": "...", "author": "... (vazio se não constar)", "format": "fisico | audiobook | ebook (fisico se não ficar claro)"}]}`;
}

export function identify(turns, library) {
  const owned = library.slice(0, 500).map((b) => `- ${b.title}${b.author ? ` — ${b.author}` : ''}`).join('\n');
  const convo = turns.map((t) => `${t.role === 'user' ? 'LEITOR' : 'VOCÊ'}: ${t.text}`).join('\n');
  return `O leitor quer adicionar livro(s) à biblioteca e descreveu em texto livre o que quer. Descubra exatamente qual edição/obra ele quer dizer.

CONVERSA ATÉ AGORA:
${convo}

LIVROS QUE ELE JÁ TEM:
${owned || '- nenhum'}

Decida:
- "pronto" quando souber com segurança qual obra é (título e autor). Na dúvida pequena, escolha a obra mais conhecida e siga.
- "pergunta" quando houver ambiguidade real: títulos iguais de autores diferentes, descrição vaga que serve a várias obras, nome que não corresponde a nenhum livro que você conheça, ou volumes/séries em que não dá para saber qual. Faça UMA pergunta curta e objetiva e ofereça as opções mais prováveis em "options" (ex.: "Sapiens — Yuval Noah Harari"); não inclua opção do tipo "outro", porque ele pode digitar a resposta. Se ele já respondeu 3 vezes, não pergunte mais: escolha a melhor hipótese.
- Não pergunte sobre formato, situação ou status: se ele não disser, use físico, "tenho" e "quero_ler".
- Se ele mencionar vários livros, devolva todos (e só pergunte sobre os que estiverem ambíguos).
- Se o livro já estiver em "LIVROS QUE ELE JÁ TEM", avise na mensagem, mas devolva mesmo assim (ele pode ter outro formato).

Devolva exatamente este formato:
{
  "status": "pronto | pergunta",
  "message": "uma ou duas frases ao leitor: a pergunta, ou a confirmação do que você entendeu (ex.: 'É o Sapiens, do Harari, em audiobook.')",
  "options": ["opções curtas de resposta quando status = pergunta; senão []"],
  "books": [{
    "title": "título como publicado no Brasil, com acentos corretos",
    "author": "autor",
    "format": "fisico | audiobook | ebook",
    "ownership": "tenho | desejo | emprestado (desejo = quer comprar; emprestado = emprestou a alguém)",
    "status": "quero_ler | lendo | lido",
    "price": valor pago em reais como número ou null,
    "store": "loja, se mencionada, senão vazio",
    "date": "data da compra AAAA-MM-DD, se der para saber (hoje é ${new Date().toISOString().slice(0, 10)}), senão vazio"
  }]
}
Quando status = "pergunta", devolva "books": [].`;
}
