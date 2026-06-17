import { browser } from 'wxt/browser';

/** Content script → service worker: enrich a word on demand. */
export interface EnrichMessage {
  type: 'enrich';
  word: string;
  sentence: string;
  back: string;
}

export type EnrichResponse =
  | { ok: true; front: string; back: string; extra: string }
  | { ok: false; code: 'no-credentials' | 'request-failed'; error: string };

export function requestEnrichment(
  word: string,
  sentence: string,
  back: string,
): Promise<EnrichResponse> {
  return browser.runtime.sendMessage({
    type: 'enrich',
    word,
    sentence,
    back,
  } satisfies EnrichMessage) as Promise<EnrichResponse>;
}

export function isEnrichMessage(message: unknown): message is EnrichMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    (message as { type?: unknown }).type === 'enrich'
  );
}
