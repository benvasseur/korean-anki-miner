import { browser } from 'wxt/browser';
import { addNote, deckNames, modelFieldNames, modelNames, storeMediaFile } from '../anki/connect';
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
  deeplApiKey,
  enrichmentProvider,
  languagePair,
  mistralApiKey,
  mistralModel,
  papagoClientId,
  papagoClientSecret,
  translationProvider,
} from '../config';
import { ClaudeProvider } from '../enrichment/claude';
import { MistralProvider } from '../enrichment/mistral';
import type { EnrichmentProvider } from '../enrichment/types';
import {
  isEnrichMessage,
  type EnrichMessage,
  type EnrichResponse,
} from '../enrichment/messages';
import { getCachedTranslation, setCachedTranslation } from '../translation/cache';
import { DeeplProvider } from '../translation/deepl';
import { isTranslateMessage, type TranslateResponse } from '../translation/messages';
import { PapagoProvider } from '../translation/papago';
import type { TranslationProvider } from '../translation/types';

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
  // Build the adapter for whichever backend is selected in Options; from here
  // on, both providers behave identically (shared prompt, same result shape).
  const providerId = await enrichmentProvider.getValue();
  let provider: EnrichmentProvider;
  if (providerId === 'mistral') {
    const [apiKey, model] = await Promise.all([mistralApiKey.getValue(), mistralModel.getValue()]);
    if (!apiKey) {
      return {
        ok: false,
        code: 'no-credentials',
        error: 'Add your Mistral API key in the extension options.',
      };
    }
    provider = new MistralProvider(apiKey, model);
  } else {
    const [apiKey, model] = await Promise.all([claudeApiKey.getValue(), claudeModel.getValue()]);
    if (!apiKey) {
      return {
        ok: false,
        code: 'no-credentials',
        error: 'Add your Claude API key in the extension options.',
      };
    }
    provider = new ClaudeProvider(apiKey, model);
  }

  const { source, target } = await languagePair.getValue();
  try {
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

  // Map our roles to the configured note-type field names. Extra and Image are
  // only included when both mapped and present.
  const noteFields: Record<string, string> = {
    [fields.front]: values.front,
    [fields.back]: values.back,
  };
  if (fields.extra) {
    noteFields[fields.extra] = values.extra;
  }

  try {
    if (fields.image && values.image) {
      const filename = await storeFrame(values.image);
      noteFields[fields.image] = `<img src="${filename}">`;
    }
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

/** Stores a captured-frame data URL in Anki's media folder; returns its filename. */
async function storeFrame(dataUrl: string): Promise<string> {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  // Self-generated name (no user input) → safe to drop into the <img> src.
  const filename = `korean-anki-miner-${Date.now()}.jpg`;
  return storeMediaFile(filename, base64);
}

async function handleTranslate(text: string): Promise<TranslateResponse> {
  const [{ source, target }, providerId] = await Promise.all([
    languagePair.getValue(),
    translationProvider.getValue(),
  ]);

  // Cached per provider: the two return different glosses for the same word, so
  // switching providers should not keep serving the old one's answers.
  const cached = await getCachedTranslation(providerId, source, target, text);
  if (cached != null) {
    return { ok: true, translation: cached, cached: true, provider: providerId };
  }

  let provider: TranslationProvider;
  if (providerId === 'papago') {
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
    provider = new PapagoProvider({ clientId, clientSecret });
  } else {
    const apiKey = await deeplApiKey.getValue();
    if (!apiKey) {
      return {
        ok: false,
        code: 'no-credentials',
        error: 'Add your DeepL API key in the extension options.',
      };
    }
    provider = new DeeplProvider(apiKey);
  }

  try {
    const translation = await provider.translate({ text, source, target });
    await setCachedTranslation(providerId, source, target, text, translation);
    return { ok: true, translation, cached: false, provider: providerId };
  } catch (error) {
    return {
      ok: false,
      code: 'request-failed',
      error: error instanceof Error ? error.message : 'Translation failed.',
    };
  }
}
