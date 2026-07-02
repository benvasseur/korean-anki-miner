import { storage } from 'wxt/utils/storage';

/**
 * Shared configuration, defined once and imported by the options page (writer)
 * and the service worker (reader, from build step 5 onward).
 *
 * Per the security model: API keys live in `chrome.storage.local` (device-local,
 * never synced off the machine), while user preferences live in
 * `chrome.storage.sync` so they follow the user across browsers.
 */

// --- Papago (Naver Cloud Platform) credentials — local only ----------------
export const papagoClientId = storage.defineItem<string>('local:papagoClientId', {
  fallback: '',
});
export const papagoClientSecret = storage.defineItem<string>('local:papagoClientSecret', {
  fallback: '',
});

// --- AI enrichment — keys local, provider/model synced ----------------------
/** Which backend the "Enrich with AI" button uses. */
export type EnrichmentProviderId = 'claude' | 'mistral';

export const enrichmentProvider = storage.defineItem<EnrichmentProviderId>(
  'sync:enrichmentProvider',
  { fallback: 'claude' },
);

export const ENRICHMENT_PROVIDERS: ReadonlyArray<{ id: EnrichmentProviderId; label: string }> = [
  { id: 'claude', label: 'Claude (Anthropic)' },
  { id: 'mistral', label: 'Mistral' },
];

export const claudeApiKey = storage.defineItem<string>('local:claudeApiKey', {
  fallback: '',
});

// Default to the cheapest model — enrichment is a templated formatting task.
export const claudeModel = storage.defineItem<string>('sync:claudeModel', {
  fallback: 'claude-haiku-4-5',
});

/** Models offered for Claude enrichment, cheapest first. */
export const CLAUDE_MODELS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'claude-haiku-4-5', label: 'Haiku 4.5 — cheapest' },
  { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6 — higher quality' },
];

export const mistralApiKey = storage.defineItem<string>('local:mistralApiKey', {
  fallback: '',
});

// The -latest aliases track Mistral's current model of each tier, so the
// extension doesn't need an update when they rotate versions.
export const mistralModel = storage.defineItem<string>('sync:mistralModel', {
  fallback: 'mistral-small-latest',
});

/** Models offered for Mistral enrichment, cheapest first. */
export const MISTRAL_MODELS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'mistral-small-latest', label: 'Mistral Small — cheapest' },
  { id: 'mistral-large-latest', label: 'Mistral Large — higher quality' },
];

// --- Language pair — synced preference -------------------------------------
export interface LanguagePair {
  /** Language the captions are in (translated from). */
  source: string;
  /** Language to translate into. */
  target: string;
}

export const languagePair = storage.defineItem<LanguagePair>('sync:languagePair', {
  fallback: { source: 'ko', target: 'en' },
});

// --- Anki / AnkiConnect — synced preference --------------------------------
/** Maps our card roles to a note type's field names. '' means unmapped. */
export interface AnkiFieldMap {
  front: string; // required: Korean word (clicked surface form)
  back: string; // required: Papago translation
  extra: string; // optional: subtitle sentence now, Claude explanation later
  image: string; // optional: video screenshot (implemented later)
}

export interface AnkiConfig {
  deck: string;
  model: string; // note type
  fields: AnkiFieldMap;
}

export const ankiConfig = storage.defineItem<AnkiConfig>('sync:ankiConfig', {
  fallback: { deck: '', model: '', fields: { front: '', back: '', extra: '', image: '' } },
});

/** Papago-supported languages, narrowed to a useful subset for the dropdowns. */
export const LANGUAGES: ReadonlyArray<{ code: string; label: string }> = [
  { code: 'ko', label: 'Korean' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: 'Japanese' },
  { code: 'zh-CN', label: 'Chinese (Simplified)' },
  { code: 'zh-TW', label: 'Chinese (Traditional)' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'ru', label: 'Russian' },
  { code: 'vi', label: 'Vietnamese' },
];
