/**
 * Memory alignment via TF-IDF cosine similarity. Replaces the original
 * bag-of-words keyword-hit count (PM-A: the headline ranking rested on the
 * weakest heuristic). Pure, local, no model download, no API call — keeps the
 * ranking legible (we report the top contributing terms as the reason).
 */

const STOPWORDS = new Set([
  "the", "and", "with", "this", "that", "from", "have", "will",
  "name", "description", "metadata", "type", "memory", "file",
  "your", "you", "for", "are", "but", "not", "they", "their",
]);

const LATIN = /[A-Za-z][A-Za-z0-9_-]{3,}/g;
const CJK_RUN = /[一-鿿]{2,}/g;

/**
 * Tokenize into a bag of terms (with repetition, for term frequency).
 * Latin words are lowercased; CJK runs are exploded into character bigrams so
 * "注意力管理" aligns with a memory mentioning "注意力" (shared 注意 / 意力).
 */
export function tokenize(text: string): string[] {
  const tokens: string[] = [];
  for (const w of text.match(LATIN) ?? []) {
    const lw = w.toLowerCase();
    if (!STOPWORDS.has(lw)) tokens.push(lw);
  }
  for (const run of text.match(CJK_RUN) ?? []) {
    for (let i = 0; i < run.length - 1; i++) tokens.push(run.slice(i, i + 2));
  }
  return tokens;
}

function termFreq(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
  return tf;
}

export interface AlignmentModel {
  /** tf-idf weighted profile vector of the whole memory corpus */
  profile: Map<string, number>;
  profileNorm: number;
  idf: Map<string, number>;
  vocabSize: number;
}

const EMPTY_MODEL: AlignmentModel = {
  profile: new Map(),
  profileNorm: 0,
  idf: new Map(),
  vocabSize: 0,
};

/**
 * Build an alignment model from memory documents (one string per memory file).
 * IDF uses sklearn-style smoothing so the model is well-defined even for a
 * single document.
 */
export function buildAlignmentModel(docs: string[]): AlignmentModel {
  const docTokens = docs.map(tokenize).filter((t) => t.length > 0);
  const n = docTokens.length;
  if (n === 0) return EMPTY_MODEL;

  const df = new Map<string, number>();
  for (const tokens of docTokens) {
    for (const term of new Set(tokens)) df.set(term, (df.get(term) ?? 0) + 1);
  }

  const idf = new Map<string, number>();
  for (const [term, d] of df) idf.set(term, Math.log((n + 1) / (d + 1)) + 1);

  // corpus profile = summed tf across docs, weighted by idf
  const corpusTf = new Map<string, number>();
  for (const tokens of docTokens) {
    for (const [term, f] of termFreq(tokens)) corpusTf.set(term, (corpusTf.get(term) ?? 0) + f);
  }
  const profile = new Map<string, number>();
  for (const [term, f] of corpusTf) profile.set(term, f * (idf.get(term) ?? 0));

  let sq = 0;
  for (const w of profile.values()) sq += w * w;

  return { profile, profileNorm: Math.sqrt(sq), idf, vocabSize: df.size };
}

export interface AlignmentScore {
  /** cosine similarity in [0, 1] */
  cosine: number;
  /** terms contributing most to the alignment, for the legible reason */
  topTerms: string[];
}

/** Score how well `text` aligns with the memory profile. */
export function scoreAlignment(model: AlignmentModel, text: string): AlignmentScore {
  if (model.profileNorm === 0) return { cosine: 0, topTerms: [] };
  const tf = termFreq(tokenize(text));

  const contrib: Array<[string, number]> = [];
  let dot = 0;
  let sq = 0;
  for (const [term, f] of tf) {
    const idf = model.idf.get(term);
    if (idf === undefined) continue; // term not in memory vocab → can't align
    const briefW = f * idf;
    sq += briefW * briefW;
    const profileW = model.profile.get(term) ?? 0;
    const c = briefW * profileW;
    if (c > 0) {
      dot += c;
      contrib.push([term, c]);
    }
  }
  const briefNorm = Math.sqrt(sq);
  if (briefNorm === 0 || dot === 0) return { cosine: 0, topTerms: [] };

  const cosine = dot / (briefNorm * model.profileNorm);
  const topTerms = contrib
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([term]) => term);
  return { cosine, topTerms };
}
