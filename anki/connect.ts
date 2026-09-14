// AnkiConnect adapter. Runs in the background (which holds the loopback host
// permission); the content script and options page reach it via messages.
// AnkiConnect is a local HTTP server, up only while Anki desktop is running.
const ANKI_CONNECT_URL = 'http://127.0.0.1:8765';
const ANKI_CONNECT_VERSION = 6;

interface AnkiConnectResponse<T> {
  result: T;
  error: string | null;
}

async function invoke<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(ANKI_CONNECT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, version: ANKI_CONNECT_VERSION, params }),
    });
  } catch {
    // An ungranted host permission fails the same way an unreachable server
    // does, and on Firefox that is the likelier cause of the two.
    throw new Error(
      'Anki is not reachable. Check that Anki is running with the AnkiConnect add-on, ' +
        'and that network access is granted in Options.',
    );
  }

  const data = (await response.json()) as AnkiConnectResponse<T>;
  if (data.error) {
    throw new Error(data.error);
  }
  return data.result;
}

export const deckNames = () => invoke<string[]>('deckNames');
export const modelNames = () => invoke<string[]>('modelNames');
export const modelFieldNames = (modelName: string) =>
  invoke<string[]>('modelFieldNames', { modelName });

/** Stores a base64 media file in Anki's collection; returns the stored filename. */
export const storeMediaFile = (filename: string, data: string) =>
  invoke<string>('storeMediaFile', { filename, data });

export interface AnkiNote {
  deckName: string;
  modelName: string;
  fields: Record<string, string>;
  tags?: string[];
}

/** Creates a note; rejects (via invoke) on a duplicate or when Anki is down. */
export const addNote = (note: AnkiNote) =>
  invoke<number>('addNote', { note: { ...note, options: { allowDuplicate: false } } });
