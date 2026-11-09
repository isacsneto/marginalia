// Lê listas de livros em markdown no formato:
//   ## Fase 1 --- Nome da fase
//   1. **Título** --- Autor
//   **Objetivo da fase:** texto
// Linhas de item podem quebrar e continuar indentadas na linha seguinte.

export function normalizeTitle(s) {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

const UNKNOWN_AUTHOR = /(n[ãa]o confirmad|a confirmar|desconhecid)/i;

function cleanAuthor(raw) {
  let a = String(raw || '')
    .replace(/\(.*?\)/g, '') // "(se ainda não tiver sido lido...)"
    .replace(/\s+/g, ' ')
    .trim();
  if (UNKNOWN_AUTHOR.test(a)) a = '';
  return a;
}

function splitTitleAuthor(text) {
  // **Título** --- Autor   |   **Título** — Autor   |   Título - Autor
  const bold = text.match(/\*\*(.+?)\*\*\s*(?:-{2,3}|—|–|-)?\s*(.*)$/);
  if (bold) return { title: bold[1].replace(/\s-{2,3}\s/g, ' — ').trim(), author: cleanAuthor(bold[2]) };
  const plain = text.match(/^(.+?)\s+(?:-{2,3}|—|–|-)\s+(.+)$/);
  if (plain) return { title: plain[1].trim(), author: cleanAuthor(plain[2]) };
  return { title: text.replace(/\*/g, '').trim(), author: '' };
}

/**
 * @returns {{ books: {title, author, phase, phaseIndex, priority}[], phases: {name, goal, titles: string[]}[] }}
 */
export function parseMarkdownLibrary(md) {
  const lines = String(md).replace(/\r\n?/g, '\n').split('\n');
  const phases = [];
  const byKey = new Map();
  const order = [];
  let section = null; // { type: 'phase' | 'priority' | 'other', phase? }
  let item = null;

  const flush = () => {
    if (!item || !section) { item = null; return; }
    const { title, author } = splitTitleAuthor(item.replace(/\s+/g, ' ').trim());
    item = null;
    if (!title) return;
    const key = normalizeTitle(title);
    if (section.type === 'priority') {
      const b = byKey.get(key);
      if (b) b.priority = true;
      else { const nb = { title, author, priority: true }; byKey.set(key, nb); order.push(nb); }
      return;
    }
    if (section.type !== 'phase') return;
    let b = byKey.get(key);
    if (!b) {
      b = { title, author, phase: section.phase.name, phaseIndex: phases.length - 1 };
      byKey.set(key, b);
      order.push(b);
      section.phase.titles.push(title);
    } else if (!b.author && author) {
      b.author = author;
    }
  };

  for (const line of lines) {
    const h = line.match(/^#{2,3}\s+(.*)$/);
    if (h) {
      flush();
      const heading = h[1].trim();
      if (/^fase\b/i.test(heading)) {
        const name = heading.replace(/^fase\s*\d+\s*(?:-{2,3}|—|–|-|:)\s*/i, '').trim() || heading;
        const phase = { name, goal: '', titles: [] };
        phases.push(phase);
        section = { type: 'phase', phase };
      } else if (/priorit/i.test(heading)) {
        section = { type: 'priority' };
      } else {
        section = { type: 'other' };
      }
      continue;
    }
    const li = line.match(/^\s*(?:\d+\.|[-*])\s+(.*)$/);
    if (li && /\*\*|\s(?:-{2,3}|—)\s/.test(li[1])) { flush(); item = li[1]; continue; }
    if (item && /^\s{2,}\S/.test(line)) { item += ' ' + line.trim(); continue; }
    flush();
    const goal = line.match(/^\*\*Objetivo da fase:\*\*\s*(.*)$/i);
    if (goal && section?.type === 'phase') {
      section.phase.goal = goal[1].trim();
      section.collectingGoal = true;
    } else if (section?.collectingGoal && line.trim()) {
      section.phase.goal += ' ' + line.trim();
    } else if (section) {
      section.collectingGoal = false;
    }
  }
  flush();
  return { books: order, phases };
}
