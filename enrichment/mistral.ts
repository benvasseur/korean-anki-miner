import {
  CARD_SCHEMA,
  CARD_TOOL_DESCRIPTION,
  CARD_TOOL_NAME,
  SYSTEM_PROMPT,
  buildUserMessage,
} from './prompt';
import type { EnrichmentProvider, EnrichmentRequest, EnrichmentResult } from './types';

// Mistral (La Plateforme) enrichment adapter. A raw-fetch adapter like Papago
// and AnkiConnect — one endpoint, no SDK. Runs in the service worker.
const ENDPOINT = 'https://api.mistral.ai/v1/chat/completions';

interface MistralResponse {
  choices?: Array<{
    message?: {
      tool_calls?: Array<{ function?: { arguments?: string } }>;
    };
  }>;
}

export class MistralProvider implements EnrichmentProvider {
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async enrich(request: EnrichmentRequest): Promise<EnrichmentResult> {
    let response: Response;
    try {
      response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 2048,
          temperature: 0.3, // templated formatting task; Mistral recommends 0.0–0.7
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: buildUserMessage(request) },
          ],
          tools: [
            {
              type: 'function',
              function: {
                name: CARD_TOOL_NAME,
                description: CARD_TOOL_DESCRIPTION,
                parameters: CARD_SCHEMA,
              },
            },
          ],
          // 'any' forces a tool call, giving the same structured-output
          // guarantee as Claude's forced tool_choice.
          tool_choice: 'any',
        }),
      });
    } catch {
      throw new Error('Could not reach Mistral — check your network connection.');
    }

    if (response.status === 401) {
      throw new Error('Mistral rejected the API key — check it in Options.');
    }
    if (response.status === 429) {
      throw new Error('Mistral rate limit reached. Try again shortly.');
    }
    if (!response.ok) {
      throw new Error(`Mistral request failed (HTTP ${response.status}).`);
    }

    const data = (await response.json()) as MistralResponse;
    // Tool arguments arrive as a JSON string (unlike Anthropic's object).
    const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    let card: Partial<EnrichmentResult> | undefined;
    try {
      card = args ? (JSON.parse(args) as Partial<EnrichmentResult>) : undefined;
    } catch {
      card = undefined;
    }
    if (!card?.front || !card.back || !card.extra) {
      throw new Error('Mistral returned an unexpected response.');
    }
    return { front: card.front, back: card.back, extra: card.extra };
  }
}
