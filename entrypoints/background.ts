import { browser } from 'wxt/browser';
import { addNote, deckNames, modelFieldNames, modelNames } from '../anki/connect';
import {
  isAnkiMessage,
  isOpenOptionsMessage,
  type AddNoteResponse,
  type AnkiFieldsResponse,
  type AnkiMessage,
  type AnkiResourcesResponse,
  type NoteValues,
} from '../anki/messages';
import {
  ankiConfig,
  claudeApiKey,
  claudeModel,
  languagePair,
  papagoClientId,
  papagoClientSecret,
} from '../config';
import { ClaudeProvider } from '../enrichment/claude';
import {
  isEnrichMessage,
  type EnrichMessage,
  type EnrichResponse,
} from '../enrichment/messages';
import { getCachedTranslation, setCachedTranslation } from '../translation/cache';
import { isTranslateMessage, type TranslateResponse } from '../translation/messages';
import { PapagoProvider } from '../translation/papago';

export default defineBackground(() => {
  console.log('[korean-anki-miner] background service worker started');

  // ALL network lives here. The content script and options page message us; they
  // hold no secrets and make no cross-origin calls. Returning a promise sends the
  // async reply.
  browser.runtime.onMessage.addListener((message: unknown) => {
    if (isTranslateMessage(message)) {
      return handleTranslate(message.text);
    }
    if (isAnkiMessage(message)) {
      return handleAnki(message);
    }
    if (isEnrichMessage(message)) {
      return handleEnrich(message);
    }
    if (isOpenOptionsMessage(message)) {
      return browser.runtime.openOptionsPage();
    }
    return undefined;
  });
});

async function handleEnrich(message: EnrichMessage): Promise<EnrichResponse> {
  const apiKey = await claudeApiKey.getValue();
  if (!apiKey) {
    return {
      ok: false,
      code: 'no-credentials',
      error: 'Add your Claude API key in the extension options.',
    };
  }

  const [{ source, target }, model] = await Promise.all([
    languagePair.getValue(),
    claudeModel.getValue(),
  ]);
  try {
    const provider = new ClaudeProvider(apiKey, model);
    const result = await provider.enrich({
      word: message.word,
      sentence: message.sentence,
      back: message.back,
      source,
      target,
    });
    return { ok: true, ...result };
  } catch (error) {
    return {
      ok: false,
      code: 'request-failed',
      error: error instanceof Error ? error.message : 'Enrichment failed.',
    };
  }
}

async function handleAnki(
  message: AnkiMessage,
): Promise<AnkiResourcesResponse | AnkiFieldsResponse | AddNoteResponse> {
  if (message.type === 'anki:addNote') {
    return handleAddNote(message.values);
  }
  try {
    if (message.type === 'anki:resources') {
      const [decks, models] = await Promise.all([deckNames(), modelNames()]);
      return { ok: true, decks, models };
    }
    return { ok: true, fields: await modelFieldNames(message.model) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'AnkiConnect request failed.' };
  }
}

async function handleAddNote(values: NoteValues): Promise<AddNoteResponse> {
  const { deck, model, fields } = await ankiConfig.getValue();
  if (!deck || !model || !fields.front || !fields.back) {
    return {
      ok: false,
      code: 'not-configured',
      error: 'Set up your Anki deck and field mapping in the extension options.',
    };
  }

  // Map our roles to the configured note-type field names. Extra is only
  // included when mapped; Image is handled in a later step.
  const noteFields: Record<string, string> = {
    [fields.front]: values.front,
    [fields.back]: values.back,
  };
  if (fields.extra) {
    noteFields[fields.extra] = values.extra;
  }

  try {
    const noteId = await addNote({
      deckName: deck,
      modelName: model,
      fields: noteFields,
      tags: ['korean-anki-miner'],
    });
    return { ok: true, noteId };
  } catch (error) {
    return {
      ok: false,
      code: 'request-failed',
      error: error instanceof Error ? error.message : 'Could not add the note.',
    };
  }
}

async function handleTranslate(text: string): Promise<TranslateResponse> {
  const { source, target } = await languagePair.getValue();

  const cached = await getCachedTranslation(source, target, text);
  if (cached != null) {
    return { ok: true, translation: cached, cached: true };
  }

  const [clientId, clientSecret] = await Promise.all([
    papagoClientId.getValue(),
    papagoClientSecret.getValue(),
  ]);
  if (!clientId || !clientSecret) {
    return {
      ok: false,
      code: 'no-credentials',
      error: 'Add your Papago API keys in the extension options.',
    };
  }

  try {
    const provider = new PapagoProvider({ clientId, clientSecret });
    const translation = await provider.translate({ text, source, target });
    await setCachedTranslation(source, target, text, translation);
    return { ok: true, translation, cached: false };
  } catch (error) {
    return {
      ok: false,
      code: 'request-failed',
      error: error instanceof Error ? error.message : 'Translation failed.',
    };
  }
}
