import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MistralProvider } from './mistral';
import { CARD_TOOL_NAME } from './prompt';

const REQUEST = {
  word: '아이템',
  sentence: '그러면서 생각난 아이템이 두 개가 있습니다',
  back: 'item',
  source: 'ko',
  target: 'en',
};

const CARD = { front: '아이템', back: 'item; thing', extra: '<b>Noun.</b> A thing.' };

function mockFetch(response: Partial<Response> & { json?: () => Promise<unknown> }) {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, ...response });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** Mistral returns tool arguments as a JSON *string*, unlike Anthropic's object. */
function toolCall(args: unknown) {
  const argumentsValue = typeof args === 'string' ? args : JSON.stringify(args);
  return {
    json: async () => ({
      choices: [{ message: { tool_calls: [{ function: { arguments: argumentsValue } }] } }],
    }),
  };
}

function enrich() {
  return new MistralProvider('key-1', 'mistral-small-latest').enrich(REQUEST);
}

beforeEach(() => {
  vi.restoreAllMocks();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('MistralProvider', () => {
  it('parses the stringified tool arguments into card fields', async () => {
    mockFetch(toolCall(CARD));
    await expect(enrich()).resolves.toEqual(CARD);
  });

  it('forces a tool call so the response is always structured', async () => {
    const fetchMock = mockFetch(toolCall(CARD));
    await enrich();

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    expect(body.tool_choice).toBe('any');
    expect(body.tools[0].function.name).toBe(CARD_TOOL_NAME);
    expect(body.model).toBe('mistral-small-latest');
  });

  it('passes the word and its sentence as context', async () => {
    const fetchMock = mockFetch(toolCall(CARD));
    await enrich();

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    expect(body.messages[1].content).toContain(REQUEST.word);
    expect(body.messages[1].content).toContain(REQUEST.sentence);
  });

  it('authenticates with a bearer token', async () => {
    const fetchMock = mockFetch(toolCall(CARD));
    await enrich();
    expect(fetchMock.mock.calls[0]![1].headers.Authorization).toBe('Bearer key-1');
  });

  describe('rejects anything that would produce a half-empty card', () => {
    it('throws on unparseable tool arguments', async () => {
      mockFetch(toolCall('{not json'));
      await expect(enrich()).rejects.toThrow(/unexpected response/i);
    });

    it('throws when a required field is missing', async () => {
      mockFetch(toolCall({ front: '아이템', back: 'item' })); // no extra
      await expect(enrich()).rejects.toThrow(/unexpected response/i);
    });

    it('throws when the model answered with prose instead of a tool call', async () => {
      mockFetch({ json: async () => ({ choices: [{ message: { content: 'Sure! …' } }] }) });
      await expect(enrich()).rejects.toThrow(/unexpected response/i);
    });
  });

  describe('error mapping', () => {
    it.each([
      [401, /rejected the API key/i],
      [429, /rate limit/i],
      [500, /HTTP 500/],
    ])('maps HTTP %i to a useful message', async (status, expected) => {
      mockFetch({ ok: false, status });
      await expect(enrich()).rejects.toThrow(expected);
    });

    it('reports a network failure as a connection problem', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
      await expect(enrich()).rejects.toThrow(/network connection/i);
    });
  });
});
