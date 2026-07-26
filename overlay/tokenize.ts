/**
 * Splits a caption line into clickable words and inert punctuation.
 *
 * A run of letters/numbers is a word; everything else (quotes, commas, ellipses…)
 * is rendered but not clickable. `\p{L}\p{N}\p{M}` keeps Hangul — and combining
 * marks — together while excluding punctuation, so clicking 일하고... yields
 * 일하고, and '일하기 / 귀찮다' yields 일하기 / 귀찮다 without the surrounding marks.
 */

/** One word or one punctuation run. */
export interface Segment {
  text: string;
  word: boolean;
}

// Global regexes are stateful (lastIndex); these are only used with String.match,
// which resets lastIndex, but keep them module-private to avoid surprises.
const RUN = /[\p{L}\p{N}\p{M}]+|[^\p{L}\p{N}\p{M}]+/gu;
const IS_WORD = /[\p{L}\p{N}\p{M}]/u;

/**
 * Whitespace-separated tokens, each split into its word/punctuation segments.
 * The outer grouping keeps a word visually adjacent to its trailing punctuation.
 */
export function tokenizeCaption(caption: string): Segment[][] {
  return caption
    .split(/\s+/)
    .filter((t) => t.length > 0)
    .map((token) =>
      (token.match(RUN) ?? []).map((run) => ({ text: run, word: IS_WORD.test(run) })),
    );
}
