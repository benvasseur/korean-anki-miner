import { describe, expect, it } from 'vitest';
import { wrapLines } from './capture-frame';

/**
 * Stand-in for the canvas 2D context: every character is 10px wide, so widths
 * in these tests read as "characters × 10".
 */
const ctx = {
  measureText: (text: string) => ({ width: text.length * 10 }),
} as unknown as CanvasRenderingContext2D;

describe('wrapLines', () => {
  it('keeps a line that fits on one line', () => {
    expect(wrapLines(ctx, 'abc def', 100)).toEqual(['abc def']);
  });

  it('wraps at the last word that fits', () => {
    // 'abc def' = 70px, adding ' ghi' would be 110px > 100px.
    expect(wrapLines(ctx, 'abc def ghi', 100)).toEqual(['abc def', 'ghi']);
  });

  it('wraps across several lines', () => {
    expect(wrapLines(ctx, 'aa bb cc dd', 50)).toEqual(['aa bb', 'cc dd']);
  });

  it('never drops a word that is wider than maxWidth', () => {
    // A single long word cannot be broken, so it gets its own overflowing line
    // rather than disappearing from the burned-in caption.
    expect(wrapLines(ctx, 'short verylongwordhere', 60)).toEqual(['short', 'verylongwordhere']);
  });

  it('returns no lines for empty text', () => {
    expect(wrapLines(ctx, '', 100)).toEqual([]);
  });

  it('collapses runs of whitespace between words', () => {
    expect(wrapLines(ctx, 'aa   bb', 100)).toEqual(['aa bb']);
  });

  it('preserves every word across the wrap', () => {
    const text = '오늘은 한자에 대해서 이야기를 해보려고 하는데요';
    const wrapped = wrapLines(ctx, text, 80);
    expect(wrapped.join(' ').split(' ')).toEqual(text.split(' '));
  });
});
