import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { getCachedTranslation, setCachedTranslation } from './cache';

// fakeBrowser gives a real in-memory chrome.storage, so these exercise the
// actual storage round-trip rather than a hand-rolled stub.
beforeEach(() => {
  fakeBrowser.reset();
});

describe('translation cache', () => {
  it('returns undefined for a word never seen', async () => {
    await expect(getCachedTranslation('deepl', 'ko', 'en', '아이템')).resolves.toBeUndefined();
  });

  it('round-trips a translation', async () => {
    await setCachedTranslation('deepl', 'ko', 'en', '아이템', 'item');
    await expect(getCachedTranslation('deepl', 'ko', 'en', '아이템')).resolves.toBe('item');
  });

  it('keys by provider, so switching backends does not reuse the old gloss', async () => {
    await setCachedTranslation('deepl', 'ko', 'en', '아이템', 'item; thing');

    await expect(getCachedTranslation('papago', 'ko', 'en', '아이템')).resolves.toBeUndefined();

    await setCachedTranslation('papago', 'ko', 'en', '아이템', 'item');
    await expect(getCachedTranslation('deepl', 'ko', 'en', '아이템')).resolves.toBe('item; thing');
    await expect(getCachedTranslation('papago', 'ko', 'en', '아이템')).resolves.toBe('item');
  });

  it('keys by language pair', async () => {
    await setCachedTranslation('deepl', 'ko', 'en', '아이템', 'item');
    await expect(getCachedTranslation('deepl', 'ko', 'ja', '아이템')).resolves.toBeUndefined();
    await expect(getCachedTranslation('deepl', 'en', 'ko', '아이템')).resolves.toBeUndefined();
  });

  it('keys by exact surface form (particles included — that is the point)', async () => {
    await setCachedTranslation('deepl', 'ko', 'en', '학교', 'school');
    await expect(getCachedTranslation('deepl', 'ko', 'en', '학교에서')).resolves.toBeUndefined();
  });

  it('overwrites an existing entry', async () => {
    await setCachedTranslation('deepl', 'ko', 'en', '아이템', 'old');
    await setCachedTranslation('deepl', 'ko', 'en', '아이템', 'new');
    await expect(getCachedTranslation('deepl', 'ko', 'en', '아이템')).resolves.toBe('new');
  });

  it('namespaces its keys so it cannot collide with config items', async () => {
    await setCachedTranslation('deepl', 'ko', 'en', '아이템', 'item');
    const stored = await fakeBrowser.storage.local.get(null);
    expect(Object.keys(stored).every((key) => key.startsWith('tc:'))).toBe(true);
  });

  it('ignores a non-string value left under a cache key', async () => {
    const key = 'tc:deepl:ko:en:아이템';
    await fakeBrowser.storage.local.set({ [key]: { unexpected: true } });
    await expect(getCachedTranslation('deepl', 'ko', 'en', '아이템')).resolves.toBeUndefined();
  });
});
