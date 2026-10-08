import Anthropic from '@anthropic-ai/sdk';
import { CARD_SCHEMA, SYSTEM_PROMPT, buildUserMessage } from './prompt';
import type { EnrichmentProvider, EnrichmentRequest, EnrichmentResult } from './types';

// Structured outputs, not the forced tool call this used to make: Sonnet 5.5
// rejects `tool_choice: {type: 'tool'}` outright, and the tool only ever existed
// to get JSON back, which is exactly what output_config.format is for.
const CARD_FORMAT: Anthropic.JSONOutputFormat = {
  type: 'json_schema',
  schema: CARD_SCHEMA,
};

// Haiku 4.5 errors on the effort parameter, so it is sent per model rather than
// always. `low` suits a single short card: the model thinks briefly or not at
// all. Raise to 'medium' if dictionary forms or glosses come back weak.
const EFFORT: Readonly<Record<string, Anthropic.OutputConfig['effort']>> = {
  'claude-sonnet-5-5': 'low',
};

/** Claude (Anthropic) enrichment adapter. Runs in the background. */
export class ClaudeProvider implements EnrichmentProvider {
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async enrich(request: EnrichmentRequest): Promise<EnrichmentResult> {
    // A user-supplied key on the user's own machine; the SDK adds the
    // dangerous-direct-browser-access header and host_permissions bypass CORS.
    const client = new Anthropic({ apiKey: this.apiKey, dangerouslyAllowBrowser: true });

    const effort = EFFORT[this.model];
    let response: Anthropic.Message;
    try {
      response = await client.messages.create({
        model: this.model,
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        output_config: { format: CARD_FORMAT, ...(effort ? { effort } : {}) },
        messages: [{ role: 'user', content: buildUserMessage(request) }],
      });
    } catch (error) {
      // The user-facing message replaces the SDK's, so keep the original as
      // `cause` — it is the only place the real status/body survives.
      if (error instanceof Anthropic.AuthenticationError) {
        throw new Error('Claude rejected the API key — check it in Options.', { cause: error });
      }
      if (error instanceof Anthropic.RateLimitError) {
        throw new Error('Claude rate limit reached. Try again shortly.', { cause: error });
      }
      throw new Error(error instanceof Error ? error.message : 'Enrichment failed.', {
        cause: error,
      });
    }

    // Found by type, never by position: with thinking on, the reply can open
    // with a thinking block.
    const text = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === 'text',
    )?.text;
    const card = text ? safeParse(text) : undefined;
    if (!card?.front || !card.back || !card.extra) {
      throw new Error('Claude returned an unexpected response.');
    }
    return { front: card.front, back: card.back, extra: card.extra };
  }
}

function safeParse(text: string): Partial<EnrichmentResult> | undefined {
  try {
    return JSON.parse(text) as Partial<EnrichmentResult>;
  } catch {
    return undefined;
  }
}
