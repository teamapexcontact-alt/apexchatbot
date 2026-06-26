import { FlowDoc, MatchResult, ScoringConfig } from "./types";
import { preprocess, levenshtein, normalize, DEFAULT_SCORING_CONFIG } from "./nlp";

export class IntentMatcher {
  private config: ScoringConfig;
  private synonymMap: Map<string, string[]>;

  constructor(config?: Partial<ScoringConfig>, synonymMap?: Map<string, string[]>) {
    this.config = { ...DEFAULT_SCORING_CONFIG, ...config };
    this.synonymMap = synonymMap || new Map();
  }

  setSynonymMap(map: Map<string, string[]>) {
    this.synonymMap = map;
  }

  updateConfig(config: Partial<ScoringConfig>) {
    this.config = { ...this.config, ...config };
  }

  match(input: string, flows: FlowDoc[]): MatchResult | null {
    if (!input.trim() || flows.length === 0) return null;

    const processed = preprocess(input, this.config, this.synonymMap);
    const candidates: MatchResult[] = [];

    for (const flow of flows) {
      if (!flow.triggers || flow.triggers.length === 0) continue;

      let bestScore = 0;
      let bestResult: Omit<MatchResult, "flow"> | null = null;

      for (const trigger of flow.triggers) {
        const result = this.scoreTrigger(processed, trigger.trim());
        if (result && result.score > bestScore) {
          bestScore = result.score;
          bestResult = result;
        }
      }

      if (bestResult) {
        candidates.push({ ...bestResult, flow });
      }
    }

    if (candidates.length === 0) return null;

    // Sort by score descending, then priority descending
    candidates.sort((a, b) => b.score - a.score || b.flow.priority - a.flow.priority);
    return candidates[0];
  }

  private scoreTrigger(
    processed: ReturnType<typeof preprocess>,
    trigger: string
  ): Omit<MatchResult, "flow"> | null {
    const tNorm = normalize(trigger);
    const tProcessed = preprocess(trigger, this.config, this.synonymMap);

    // 1. Exact match → highest score
    if (processed.normalized === tNorm) {
      return {
        score: this.config.exactWeight,
        method: "exact",
        details: { matchedTrigger: trigger, wordOverlap: 1, expandedInput: processed.normalized },
      };
    }

    // 2. Contains match
    if (processed.normalized.includes(tNorm) || tNorm.includes(processed.normalized)) {
      return {
        score: this.config.containsWeight,
        method: "contains",
        details: { matchedTrigger: trigger, wordOverlap: Math.max(processed.words.length, tProcessed.words.length) },
      };
    }

    // 3. Synonym match — check if expanded input matches trigger
    const expandedSet = new Set(processed.expanded);
    const tStemmedSet = new Set(tProcessed.stemmed);
    let synonymHits = 0;
    for (const tw of tStemmedSet) {
      for (const ew of expandedSet) {
        if (tw === ew || levenshtein(tw, ew) <= 1) {
          synonymHits++;
          break;
        }
      }
    }
    if (synonymHits >= Math.min(2, tStemmedSet.size)) {
      return {
        score: this.config.synonymWeight,
        method: "synonym",
        details: {
          matchedTrigger: trigger,
          wordOverlap: synonymHits,
          expandedInput: processed.expanded.join(" "),
        },
      };
    }

    // 4. Word overlap
    const overlap = processed.words.filter((w) => tProcessed.words.includes(w)).length;
    const maxWords = Math.max(processed.words.length, tProcessed.words.length);
    if (maxWords > 0) {
      const ratio = overlap / maxWords;
      if (ratio >= this.config.wordOverlapThreshold) {
        const score = this.config.wordOverlapWeight + (ratio * 25);
        return {
          score,
          method: "word_overlap",
          details: { matchedTrigger: trigger, wordOverlap: overlap },
        };
      }
      // Partial overlap gets proportional score
      if (overlap > 0 && ratio >= 0.3) {
        const score = (this.config.wordOverlapWeight * 0.5) + (ratio * 20);
        return {
          score,
          method: "word_overlap",
          details: { matchedTrigger: trigger, wordOverlap: overlap },
        };
      }
    }

    // 5. Fuzzy match on stemmed words (catch typos)
    let fuzzyMatches = 0;
    for (const w of processed.stemmed) {
      if (w.length < this.config.minWordLength) continue;
      for (const tw of tProcessed.stemmed) {
        if (tw.length < this.config.minWordLength) continue;
        const dist = levenshtein(w, tw);
        const maxLen = Math.max(w.length, tw.length);
        if (dist === 0) { fuzzyMatches++; break; }
        if (dist <= 1 || (dist / maxLen) < this.config.fuzzyDistanceRatio) {
          fuzzyMatches++;
          break;
        }
      }
    }

    const fuzzyThreshold = Math.min(2, Math.ceil(tProcessed.stemmed.length * 0.5));
    if (fuzzyMatches >= fuzzyThreshold) {
      const score = this.config.fuzzyWeight + (fuzzyMatches / tProcessed.stemmed.length) * 20;
      return {
        score,
        method: "fuzzy",
        details: { matchedTrigger: trigger, wordOverlap: fuzzyMatches, fuzzyDistance: 1 },
      };
    }

    return null;
  }
}
