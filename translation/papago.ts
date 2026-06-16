import type { TranslationProvider, TranslationRequest } from './types';

const ENDPOINT = 'https://papago.apigw.ntruss.com/nmt/v1/translation';

export interface PapagoCredentials {
  clientId: string;
  clientSecret: string;
}

interface PapagoResponse {
  message?: { result?: { translatedText?: string } };
}

/** Papago (Naver Cloud Platform) NMT adapter. Must run where it has the keys and
 *  cross-origin access — i.e. the service worker, never the content script. */
export class PapagoProvider implements TranslationProvider {
  constructor(private readonly credentials: PapagoCredentials) {}

  async translate({ text, source, target }: TranslationRequest): Promise<string> {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-NCP-APIGW-API-KEY-ID': this.credentials.clientId,
        'X-NCP-APIGW-API-KEY': this.credentials.clientSecret,
      },
      body: new URLSearchParams({ source, target, text }).toString(),
    });

    if (!response.ok) {
      throw new Error(errorMessage(response.status));
    }

    const data = (await response.json()) as PapagoResponse;
    const translated = data.message?.result?.translatedText;
    if (translated == null) {
      throw new Error('Papago returned an unexpected response.');
    }
    return translated;
  }
}

function errorMessage(status: number): string {
  if (status === 401 || status === 403) {
    return 'Papago rejected the API keys — double-check them in Options.';
  }
  if (status === 429) {
    return 'Papago rate limit or quota reached. Try again later.';
  }
  return `Papago request failed (HTTP ${status}).`;
}
