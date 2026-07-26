import { browser } from 'wxt/browser';
import type { TranslationProviderId } from '../config';

// High-frequency words and particles repeat constantly, so caching by surface
// form makes repeats instant at zero API quota. Lives in chrome.storage.local
// (per-device, like the keys), keyed by provider + language pair + surface form.
const PREFIX = 'tc:';

function cacheKey(
  provider: TranslationProviderId,
  source: string,
  target: string,
  text: string,
): string {
  return `${PREFIX}${provider}:${source}:${target}:${text}`;
}

export async function getCachedTranslation(
  provider: TranslationProviderId,
  source: string,
  target: string,
  text: string,
): Promise<string | undefined> {
  const key = cacheKey(provider, source, target, text);
  const stored = await browser.storage.local.get(key);
  const value = stored[key];
  return typeof value === 'string' ? value : undefined;
}

export async function setCachedTranslation(
  provider: TranslationProviderId,
  source: string,
  target: string,
  text: string,
  translation: string,
): Promise<void> {
  await browser.storage.local.set({
    [cacheKey(provider, source, target, text)]: translation,
  });
}
