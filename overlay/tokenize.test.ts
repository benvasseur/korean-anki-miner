import { describe, expect, it } from 'vitest';
import { tokenizeCaption } from './tokenize';

/** Flattens to `word|punct` strings so expectations stay readable. */
function flat(caption: string): string[][] {
  return tokenizeCaption(caption).map((token) =>
    token.map((seg) => `${seg.text}${seg.word ? '' : '|p'}`),
  );
}

/** Every clickable word, in order — what a click can actually yield. */
function words(caption: string): string[] {
  return tokenizeCaption(caption)
    .flat()
    .filter((seg) => seg.word)
    .map((seg) => seg.text);
}

describe('tokenizeCaption', () => {
  it('splits a plain Korean line into one token per word', () => {
    expect(flat('오늘은 한자에 대해서')).toEqual([['오늘은'], ['한자에'], ['대해서']]);
  });

  it('keeps trailing punctuation out of the clickable word', () => {
    expect(flat('일하고...')).toEqual([['일하고', '...|p']]);
    expect(words('일하고...')).toEqual(['일하고']);
  });

  it('keeps quotes around a word inert', () => {
    expect(words("'일하기 / 귀찮다'")).toEqual(['일하기', '귀찮다']);
  });

  it('groups a word with its adjacent punctuation in one token', () => {
    // The grouping is what keeps 「word,」 rendered without a gap.
    expect(flat('안녕하세요, 반갑습니다!')).toEqual([
      ['안녕하세요', ',|p'],
      ['반갑습니다', '!|p'],
    ]);
  });

  it('treats digits and Latin text as clickable words', () => {
    expect(words('2026년 K-pop')).toEqual(['2026년', 'K', 'pop']);
  });

  it('collapses runs of whitespace', () => {
    expect(flat('  오늘은   한자에  ')).toEqual([['오늘은'], ['한자에']]);
  });

  it('returns nothing for an empty or whitespace-only caption', () => {
    expect(tokenizeCaption('')).toEqual([]);
    expect(tokenizeCaption('   ')).toEqual([]);
  });

  it('keeps a word with combining marks in one piece', () => {
    // Decomposed Hangul (jamo + combining marks) must not split mid-syllable.
    const decomposed = '한'; // 한, NFD
    expect(words(decomposed)).toEqual([decomposed]);
  });

  it('handles punctuation-only tokens', () => {
    expect(flat('— …')).toEqual([['—|p'], ['…|p']]);
    expect(words('— …')).toEqual([]);
  });

  it('splits a word joined by punctuation into separately clickable parts', () => {
    expect(flat('한국·일본')).toEqual([['한국', '·|p', '일본']]);
  });

  it('is stable across repeated calls (no leaking regex lastIndex)', () => {
    const caption = '오늘은 한자에 대해서';
    expect(flat(caption)).toEqual(flat(caption));
  });
});
