import { browser } from 'wxt/browser';

/** Card role values, mapped to the configured note-type fields in the worker. */
export interface NoteValues {
  front: string;
  back: string;
  extra: string;
}

/** Options page / content script → service worker. */
export type AnkiMessage =
  | { type: 'anki:resources' }
  | { type: 'anki:fields'; model: string }
  | { type: 'anki:addNote'; values: NoteValues };

export type AnkiResourcesResponse =
  | { ok: true; decks: string[]; models: string[] }
  | { ok: false; error: string };

export type AnkiFieldsResponse =
  | { ok: true; fields: string[] }
  | { ok: false; error: string };

export type AddNoteResponse =
  | { ok: true; noteId: number }
  | { ok: false; code: 'not-configured' | 'request-failed'; error: string };

/** Message the worker to open the options page (content scripts can't directly). */
export interface OpenOptionsMessage {
  type: 'open-options';
}

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

/** Create a note from the role values; the worker maps roles to fields. */
export function saveNote(values: NoteValues): Promise<AddNoteResponse> {
  return browser.runtime.sendMessage({
    type: 'anki:addNote',
    values,
  } satisfies AnkiMessage) as Promise<AddNoteResponse>;
}

export function openOptions(): void {
  void browser.runtime.sendMessage({ type: 'open-options' } satisfies OpenOptionsMessage);
}

export function isOpenOptionsMessage(message: unknown): message is OpenOptionsMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    (message as { type?: unknown }).type === 'open-options'
  );
}

export function isAnkiMessage(message: unknown): message is AnkiMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    typeof (message as { type?: unknown }).type === 'string' &&
    (message as { type: string }).type.startsWith('anki:')
  );
}
