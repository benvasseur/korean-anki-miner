import { browser } from 'wxt/browser';

/** Options page → service worker: read AnkiConnect resources for the dropdowns. */
export type AnkiMessage =
  | { type: 'anki:resources' }
  | { type: 'anki:fields'; model: string };

export type AnkiResourcesResponse =
  | { ok: true; decks: string[]; models: string[] }
  | { ok: false; error: string };

export type AnkiFieldsResponse =
  | { ok: true; fields: string[] }
  | { ok: false; error: string };

/** Decks + note types in one round trip, for the deck/model selects. */
export function fetchAnkiResources(): Promise<AnkiResourcesResponse> {
  return browser.runtime.sendMessage({
    type: 'anki:resources',
  } satisfies AnkiMessage) as Promise<AnkiResourcesResponse>;
}

/** Field names for the chosen note type, for the field-mapping selects. */
export function fetchAnkiFields(model: string): Promise<AnkiFieldsResponse> {
  return browser.runtime.sendMessage({
    type: 'anki:fields',
    model,
  } satisfies AnkiMessage) as Promise<AnkiFieldsResponse>;
}

export function isAnkiMessage(message: unknown): message is AnkiMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    typeof (message as { type?: unknown }).type === 'string' &&
    (message as { type: string }).type.startsWith('anki:')
  );
}
