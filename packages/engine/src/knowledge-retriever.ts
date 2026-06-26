import { KnowledgeRecord, ScoringConfig } from "./types";
import { preprocess, levenshtein, normalize, DEFAULT_SCORING_CONFIG } from "./nlp";

export class KnowledgeRetriever {
  private config: ScoringConfig;

  constructor(config?: Partial<ScoringConfig>) {
    this.config = { ...DEFAULT_SCORING_CONFIG, ...config };
  }

  search(input: string, records: KnowledgeRecord[]): { record: KnowledgeRecord; score: number } | null {
    if (!input.trim() || records.length === 0) return null;

    const processed = preprocess(input, this.config, new Map());
    const candidates: Array<{ record: KnowledgeRecord; score: number }> = [];

    for (const record of records) {
      const score = this.scoreRecord(processed, record);
      if (score > 0) {
        candidates.push({ record, score });
      }
    }

    if (candidates.length === 0) return null;
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0];
  }

  private scoreRecord(
    processed: ReturnType<typeof preprocess>,
    record: KnowledgeRecord
  ): number {
    const norm = processed.normalized;
    let bestScore = 0;

    // Score against question if available
    if (record.question) {
      const qScore = this.scoreText(processed, record.question);
      if (qScore > bestScore) bestScore = qScore;
    }

    // Score against answer
    const aScore = this.scoreText(processed, record.answer);
    if (aScore > bestScore) bestScore = aScore;

    // Score against keywords
    for (const kw of record.keywords) {
      const kwNorm = normalize(kw);
      if (norm.includes(kwNorm) || kwNorm.includes(norm)) {
        bestScore = Math.max(bestScore, this.config.containsWeight * 0.8);
      }
    }

    // Score against category
    if (record.category) {
      const catNorm = normalize(record.category);
      if (norm.includes(catNorm) || catNorm.includes(norm)) {
        bestScore = Math.max(bestScore, this.config.containsWeight * 0.6);
      }
    }

    return bestScore;
  }

  private scoreText(processed: ReturnType<typeof preprocess>, text: string): number {
    const tProcessed = preprocess(text, this.config, new Map());
    const norm = processed.normalized;
    const tNorm = tProcessed.normalized;

    // Exact
    if (norm === tNorm) return this.config.exactWeight;

    // Contains
    if (norm.includes(tNorm) || tNorm.includes(norm)) return this.config.containsWeight;

    // Word overlap
    const overlap = processed.words.filter((w) => tProcessed.words.includes(w)).length;
    const maxWords = Math.max(processed.words.length, tProcessed.words.length);
    if (maxWords > 0) {
      const ratio = overlap / maxWords;
      if (ratio >= this.config.wordOverlapThreshold) {
        return this.config.wordOverlapWeight + (ratio * 25);
      }
      if (overlap > 0 && ratio >= 0.3) {
        return (this.config.wordOverlapWeight * 0.5) + (ratio * 20);
      }
    }

    // Fuzzy on first 3 significant words of text
    const tWords = tProcessed.words.slice(0, 3);
    let fuzzyMatches = 0;
    for (const w of processed.words) {
      if (w.length < 3) continue;
      for (const tw of tWords) {
        if (tw.length < 3) continue;
        const dist = levenshtein(w, tw);
        if (dist <= 1 || (dist / Math.max(w.length, tw.length)) < this.config.fuzzyDistanceRatio) {
          fuzzyMatches++;
          break;
        }
      }
    }
    if (fuzzyMatches >= Math.min(2, tWords.length)) {
      return this.config.fuzzyWeight + (fuzzyMatches / tWords.length) * 20;
    }

    return 0;
  }
}
