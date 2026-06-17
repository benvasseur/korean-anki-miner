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

// --- Claude (Anthropic) enrichment — key local, model synced ---------------
export const claudeApiKey = storage.defineItem<string>('local:claudeApiKey', {
  fallback: '',
});

// Default to the cheapest model — enrichment is a templated formatting task.
export const claudeModel = storage.defineItem<string>('sync:claudeModel', {
  fallback: 'claude-haiku-4-5',
});

/** Models offered for enrichment, cheapest first. */
export const CLAUDE_MODELS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'claude-haiku-4-5', label: 'Haiku 4.5 — cheapest' },
  { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6 — higher quality' },
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
