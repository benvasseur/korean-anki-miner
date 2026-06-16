import { browser } from 'wxt/browser';
import { languagePair, papagoClientId, papagoClientSecret } from '../config';
import { getCachedTranslation, setCachedTranslation } from '../translation/cache';
import { isTranslateMessage, type TranslateResponse } from '../translation/messages';
import { PapagoProvider } from '../translation/papago';

export default defineBackground(() => {
  console.log('[korean-anki-miner] background service worker started');

  // ALL network lives here. The content script messages us; it holds no secrets
  // and makes no cross-origin calls. Returning a promise sends the async reply.
  browser.runtime.onMessage.addListener((message: unknown) => {
    if (isTranslateMessage(message)) {
      return handleTranslate(message.text);
    }
    return undefined;
  });
});

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
