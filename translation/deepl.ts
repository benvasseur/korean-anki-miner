import type { TranslationProvider, TranslationRequest } from './types';

// DeepL free keys end in ':fx' and must hit a different host than Pro keys, so
// the adapter picks the endpoint from the key rather than asking the user.
const FREE_ENDPOINT = 'https://api-free.deepl.com/v2/translate';
const PRO_ENDPOINT = 'https://api.deepl.com/v2/translate';

interface DeeplResponse {
  translations?: Array<{ text?: string }>;
}

/** DeepL API adapter (v2). Like Papago it holds the key, so it runs in the
 *  service worker only. The free tier allows 500k characters/month, which is
 *  effectively unlimited at single-word volume. */
export class DeeplProvider implements TranslationProvider {
  constructor(private readonly apiKey: string) {}

  async translate({ text, source, target }: TranslationRequest): Promise<string> {
    let response: Response;
    try {
      response = await fetch(endpointFor(this.apiKey), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `DeepL-Auth-Key ${this.apiKey}`,
        },
        body: JSON.stringify({
          text: [text],
          source_lang: sourceLang(source),
          target_lang: targetLang(target),
        }),
      });
    } catch {
      throw new Error('Could not reach DeepL — check your network connection.');
    }

    if (!response.ok) {
      throw new Error(errorMessage(response.status));
    }

    const data = (await response.json()) as DeeplResponse;
    const translated = data.translations?.[0]?.text;
    if (translated == null) {
      throw new Error('DeepL returned an unexpected response.');
    }
    return translated;
  }
}

function endpointFor(apiKey: string): string {
  return apiKey.endsWith(':fx') ? FREE_ENDPOINT : PRO_ENDPOINT;
}

// DeepL wants uppercase codes, and regional variants are target-only: as a
// source language it takes the base code (EN, ZH), as a target it needs the
// variant (EN-US, ZH-HANS) — plain EN/PT are deprecated targets.
const TARGET_VARIANTS: Readonly<Record<string, string>> = {
  en: 'EN-US',
  'zh-CN': 'ZH-HANS',
  'zh-TW': 'ZH-HANT',
  pt: 'PT-PT',
};

function sourceLang(code: string): string {
  return code.split('-')[0].toUpperCase();
}

function targetLang(code: string): string {
  return TARGET_VARIANTS[code] ?? code.toUpperCase();
}

function errorMessage(status: number): string {
  if (status === 401 || status === 403) {
    return 'DeepL rejected the API key — double-check it in Options.';
  }
  if (status === 429) {
    return 'DeepL rate limit reached. Try again shortly.';
  }
  if (status === 456) {
    return 'DeepL character quota for this billing period is used up.';
  }
  return `DeepL request failed (HTTP ${status}).`;
}
