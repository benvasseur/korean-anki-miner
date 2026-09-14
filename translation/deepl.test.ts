import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeeplProvider } from './deepl';

const FREE_KEY = 'abc-123:fx';
const PRO_KEY = 'abc-123';

function mockFetch(response: Partial<Response> & { json?: () => Promise<unknown> }) {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, ...response });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** The request body the adapter sent, parsed. */
function sentBody(fetchMock: ReturnType<typeof vi.fn>) {
  return JSON.parse(fetchMock.mock.calls[0]![1].body as string);
}

function ok(text: string) {
  return { json: async () => ({ translations: [{ text }] }) };
}

beforeEach(() => {
  vi.restoreAllMocks();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('DeeplProvider', () => {
  describe('endpoint selection', () => {
    it('routes a Free key (:fx suffix) to the free host', async () => {
      const fetchMock = mockFetch(ok('item'));
      await new DeeplProvider(FREE_KEY).translate({ text: '아이템', source: 'ko', target: 'en' });
      expect(fetchMock.mock.calls[0]![0]).toBe('https://api-free.deepl.com/v2/translate');
    });

    it('routes a Pro key to the paid host', async () => {
      const fetchMock = mockFetch(ok('item'));
      await new DeeplProvider(PRO_KEY).translate({ text: '아이템', source: 'ko', target: 'en' });
      expect(fetchMock.mock.calls[0]![0]).toBe('https://api.deepl.com/v2/translate');
    });

    it('sends the key as a DeepL-Auth-Key header', async () => {
      const fetchMock = mockFetch(ok('item'));
      await new DeeplProvider(FREE_KEY).translate({ text: '아이템', source: 'ko', target: 'en' });
      expect(fetchMock.mock.calls[0]![1].headers.Authorization).toBe(`DeepL-Auth-Key ${FREE_KEY}`);
    });
  });

  describe('language codes', () => {
    it('uppercases the source and target', async () => {
      const fetchMock = mockFetch(ok('item'));
      await new DeeplProvider(FREE_KEY).translate({ text: '아이템', source: 'ko', target: 'ja' });
      expect(sentBody(fetchMock)).toMatchObject({ source_lang: 'KO', target_lang: 'JA' });
    });

    it('expands English to a regional variant as a target (plain EN is deprecated)', async () => {
      const fetchMock = mockFetch(ok('item'));
      await new DeeplProvider(FREE_KEY).translate({ text: '아이템', source: 'ko', target: 'en' });
      expect(sentBody(fetchMock).target_lang).toBe('EN-US');
    });

    it.each([
      ['zh-CN', 'ZH-HANS'],
      ['zh-TW', 'ZH-HANT'],
    ])('maps the %s target to %s', async (target, expected) => {
      const fetchMock = mockFetch(ok('项目'));
      await new DeeplProvider(FREE_KEY).translate({ text: '아이템', source: 'ko', target });
      expect(sentBody(fetchMock).target_lang).toBe(expected);
    });

    it('strips the region from a source code (variants are target-only)', async () => {
      const fetchMock = mockFetch(ok('item'));
      await new DeeplProvider(FREE_KEY).translate({ text: '项目', source: 'zh-CN', target: 'en' });
      expect(sentBody(fetchMock).source_lang).toBe('ZH');
    });

    it('sends the text as an array, as the v2 JSON API requires', async () => {
      const fetchMock = mockFetch(ok('item'));
      await new DeeplProvider(FREE_KEY).translate({ text: '아이템', source: 'ko', target: 'en' });
      expect(sentBody(fetchMock).text).toEqual(['아이템']);
    });
  });

  describe('responses', () => {
    it('returns the first translation', async () => {
      mockFetch(ok('item; thing'));
      const result = await new DeeplProvider(FREE_KEY).translate({
        text: '아이템',
        source: 'ko',
        target: 'en',
      });
      expect(result).toBe('item; thing');
    });

    it('throws when the payload has no translations', async () => {
      mockFetch({ json: async () => ({}) });
      await expect(
        new DeeplProvider(FREE_KEY).translate({ text: '아이템', source: 'ko', target: 'en' }),
      ).rejects.toThrow(/unexpected response/i);
    });
  });

  describe('error mapping', () => {
    it.each([
      [401, /rejected the API key/i],
      [403, /rejected the API key/i],
      [429, /rate limit/i],
      [456, /quota/i],
      [500, /HTTP 500/],
    ])('maps HTTP %i to a useful message', async (status, expected) => {
      mockFetch({ ok: false, status });
      await expect(
        new DeeplProvider(FREE_KEY).translate({ text: '아이템', source: 'ko', target: 'en' }),
      ).rejects.toThrow(expected);
    });

    it('reports a network failure as a connection problem, not a DeepL error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
      await expect(
        new DeeplProvider(FREE_KEY).translate({ text: '아이템', source: 'ko', target: 'en' }),
      ).rejects.toThrow(/network connection/i);
    });
  });
});
