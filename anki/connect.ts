// AnkiConnect adapter. Runs in the service worker (which holds host_permissions
// for 127.0.0.1:8765); the content script and options page reach it via messages.
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
    throw new Error('Anki is not reachable. Is Anki running with the AnkiConnect add-on?');
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
