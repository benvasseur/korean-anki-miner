import { browser } from 'wxt/browser';

// High-frequency words and particles repeat constantly, so caching by surface
// form makes repeats instant at zero Papago quota. Lives in chrome.storage.local
// (per-device, like the keys), keyed by language pair + surface form.
const PREFIX = 'tc:';

function cacheKey(source: string, target: string, text: string): string {
  return `${PREFIX}${source}:${target}:${text}`;
}

export async function getCachedTranslation(
  source: string,
  target: string,
  text: string,
): Promise<string | undefined> {
  const key = cacheKey(source, target, text);
  const stored = await browser.storage.local.get(key);
  const value = stored[key];
  return typeof value === 'string' ? value : undefined;
}

export async function setCachedTranslation(
  source: string,
  target: string,
  text: string,
  translation: string,
): Promise<void> {
  await browser.storage.local.set({ [cacheKey(source, target, text)]: translation });
}
