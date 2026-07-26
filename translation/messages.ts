import { browser } from 'wxt/browser';
import type { TranslationProviderId } from '../config';

/** Content script → service worker: translate a clicked word. */
export interface TranslateMessage {
  type: 'translate';
  text: string;
}

export type TranslateResponse =
  // `provider` travels with the result so the popup can credit it without
  // reading config itself (and stays right even if the setting changes mid-flight).
  | { ok: true; translation: string; cached: boolean; provider: TranslationProviderId }
  | { ok: false; code: 'no-credentials' | 'request-failed'; error: string };

/** Sent from the content script; resolved by the service-worker handler. */
export function requestTranslation(text: string): Promise<TranslateResponse> {
  return browser.runtime.sendMessage({
    type: 'translate',
    text,
  } satisfies TranslateMessage) as Promise<TranslateResponse>;
}

export function isTranslateMessage(message: unknown): message is TranslateMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    (message as { type?: unknown }).type === 'translate' &&
    typeof (message as { text?: unknown }).text === 'string'
  );
}
