import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PapagoProvider } from './papago';

const CREDENTIALS = { clientId: 'id-1', clientSecret: 'secret-1' };

function mockFetch(response: Partial<Response> & { json?: () => Promise<unknown> }) {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, ...response });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function ok(translatedText: string) {
  return { json: async () => ({ message: { result: { translatedText } } }) };
}

function translate() {
  return new PapagoProvider(CREDENTIALS).translate({ text: '아이템', source: 'ko', target: 'en' });
}

beforeEach(() => {
  vi.restoreAllMocks();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PapagoProvider', () => {
  it('sends form-encoded parameters, not JSON', async () => {
    const fetchMock = mockFetch(ok('item'));
    await translate();

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers['Content-Type']).toMatch(/x-www-form-urlencoded/);
    expect(Object.fromEntries(new URLSearchParams(init.body as string))).toEqual({
      source: 'ko',
      target: 'en',
      text: '아이템',
    });
  });

  it('sends the credentials in the NCP gateway headers', async () => {
    const fetchMock = mockFetch(ok('item'));
    await translate();

    const { headers } = fetchMock.mock.calls[0][1];
    expect(headers['X-NCP-APIGW-API-KEY-ID']).toBe('id-1');
    expect(headers['X-NCP-APIGW-API-KEY']).toBe('secret-1');
  });

  it('unwraps the nested translatedText', async () => {
    mockFetch(ok('item; thing'));
    await expect(translate()).resolves.toBe('item; thing');
  });

  it('throws when the nested shape is missing', async () => {
    mockFetch({ json: async () => ({ message: {} }) });
    await expect(translate()).rejects.toThrow(/unexpected response/i);
  });

  it.each([
    [401, /double-check them in Options/i],
    [403, /double-check them in Options/i],
    [429, /rate limit or quota/i],
    [500, /HTTP 500/],
  ])('maps HTTP %i to a useful message', async (status, expected) => {
    mockFetch({ ok: false, status });
    await expect(translate()).rejects.toThrow(expected);
  });
});
