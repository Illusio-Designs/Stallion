// Search used by the list pages. It forgives what people actually do when they type:
// capital letters, extra or missing spaces ("rajopti" for "Raj Optical"), words in any
// order ("optical raj"), part of a word ("prati"), accents, and one wrong letter ("pratek").
// Results are ranked: whole words and word starts first, loose matches last.

export const normalize = (s) => String(s ?? '')
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9ऀ-ॿ઀-૿]+/g, ' ')
  .trim();

// True when a and b differ by at most one letter added, removed, changed or swapped.
const withinOne = (a, b) => {
  if (a === b) return true;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  let i = 0;
  while (i < la && i < lb && a[i] === b[i]) i += 1;
  if (la === lb) {
    if (a.slice(i + 1) === b.slice(i + 1)) return true;
    return a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2);
  }
  return la > lb ? a.slice(i + 1) === b.slice(i) : b.slice(i + 1) === a.slice(i);
};

// Score of one query word against the words of the text: 0 = no match.
const wordScore = (tok, words, tight) => {
  let best = 0;
  for (const w of words) {
    if (w === tok) return 5;
    if (w.startsWith(tok)) best = Math.max(best, 4);
    else if (w.includes(tok)) best = Math.max(best, 2.5);
  }
  if (best) return best;
  if (tight.includes(tok)) return 2; // the word runs across two words, e.g. "rajopti"
  if (tok.length >= 4) {
    for (const w of words) {
      if (withinOne(tok, w.slice(0, tok.length)) || withinOne(tok, w)) return 1;
    }
  }
  return 0;
};

// Returns 0 when the row does not match, otherwise a score (higher is better).
export const searchScore = (query, fields) => {
  const q = normalize(query);
  if (!q) return 1;
  const text = normalize(Array.isArray(fields) ? fields.filter((f) => f != null && f !== '').join(' ') : fields);
  if (!text) return 0;
  const words = text.split(' ');
  const tight = words.join('');
  const qTight = q.replace(/ /g, '');
  let total = 0;
  const toks = q.split(' ');
  for (const t of toks) {
    const s = wordScore(t, words, tight);
    if (!s) {
      // the whole phrase may still run through the text without spaces
      return tight.includes(qTight) ? 2 : 0;
    }
    total += s;
  }
  if (text.startsWith(q)) total += 3;
  return total;
};

// Filter and rank rows. getFields(row) returns the texts to look in.
export const searchRows = (rows, query, getFields) => {
  if (!normalize(query)) return rows;
  return rows
    .map((row, i) => ({ row, i, s: searchScore(query, getFields(row)) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.row);
};
