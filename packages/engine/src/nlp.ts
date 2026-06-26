import { ScoringConfig } from "./types";

export const DEFAULT_STOP_WORDS = [
  "a","an","the","and","or","but","in","on","at","to","for","of","with","by",
  "is","are","was","were","be","been","being","have","has","had","do","does",
  "did","will","would","could","should","may","might","can","shall","need",
  "dare","ought","used","it","its","this","that","these","those","i","me",
  "my","myself","we","our","ours","ourselves","you","your","yours","yourself",
  "he","him","his","himself","she","her","hers","herself","they","them","their",
  "theirs","themselves","what","which","who","whom","whose","when","where",
  "why","how","all","each","every","both","few","more","most","other","some",
  "such","no","nor","not","only","own","same","so","than","too","very","just",
  "because","as","until","while","about","between","through","during","before",
  "after","above","below","from","up","down","out","off","over","under","again",
  "further","then","once","here","there","please","help","hi","hello","hey",
];

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  exactWeight: 100,
  containsWeight: 75,
  synonymWeight: 60,
  wordOverlapWeight: 50,
  fuzzyWeight: 25,
  wordOverlapThreshold: 0.6,
  fuzzyDistanceRatio: 0.3,
  minWordLength: 2,
  stopWords: DEFAULT_STOP_WORDS,
};

export function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

export function simpleStem(word: string): string {
  if (word.length < 4) return word;
  const suffixes = [
    ["ization", "ize"], ["isation", "ise"],
    ["ingly", ""], ["edly", ""], ["ively", ""],
    ["ment", ""], ["ness", ""], ["tion", "t"], ["sion", "s"],
    ["able", ""], ["ible", ""], ["al", ""], ["ial", ""],
    ["er", ""], ["or", ""], ["ing", "e"], ["ed", "e"],
    ["ly", ""], ["es", "e"], ["ies", "y"], ["ves", "f"],
    ["s", ""],
  ];
  for (const [sfx, replacement] of suffixes) {
    if (word.endsWith(sfx)) {
      const stem = word.slice(0, -sfx.length) + replacement;
      if (stem.length >= 2) return stem;
    }
  }
  return word;
}

export function removeStopWords(words: string[], stopWords: string[]): string[] {
  return words.filter((w) => w.length > 1 && !stopWords.includes(w));
}

export function stemWords(words: string[]): string[] {
  return words.map(simpleStem);
}

export function expandSynonyms(
  words: string[],
  synonymMap: Map<string, string[]>
): string[] {
  const expanded = new Set<string>();
  for (const w of words) {
    expanded.add(w);
    const stemmed = simpleStem(w);
    expanded.add(stemmed);
    if (synonymMap.has(w)) {
      for (const s of synonymMap.get(w)!) {
        expanded.add(s);
        expanded.add(simpleStem(s));
      }
    }
    if (synonymMap.has(stemmed)) {
      for (const s of synonymMap.get(stemmed)!) {
        expanded.add(s);
        expanded.add(simpleStem(s));
      }
    }
  }
  return [...expanded];
}

export function preprocess(
  input: string,
  config: ScoringConfig,
  synonymMap: Map<string, string[]>
): { normalized: string; words: string[]; stemmed: string[]; expanded: string[] } {
  const normalized = normalize(input);
  let words = normalized.split(/\s+/);
  words = removeStopWords(words, config.stopWords);
  const stemmed = stemWords(words);
  const expanded = expandSynonyms(words, synonymMap);
  return { normalized, words, stemmed, expanded };
}

export function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}
