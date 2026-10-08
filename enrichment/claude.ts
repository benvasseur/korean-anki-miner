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

// Sent per model, not always: both current models take effort, but a model ID
// left in storage from an older build (Haiku 4.5) errors on the parameter.
// `low` suits a single short card — the documented choice when moving a route
// off no-thinking. Raise to 'medium' if dictionary forms or glosses come back weak.
const EFFORT: Readonly<Record<string, Anthropic.OutputConfig['effort']>> = {
  'claude-haiku-5-5': 'low',
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
        // Thinking counts against this, and the current tokenizer makes the same
        // text ~30% more tokens, so leave room for both ahead of the card itself.
        max_tokens: 8192,
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

    // Both models run safety classifiers and neither has a server-side fallback,
    // so a decline arrives as a normal 200 response.
    if (response.stop_reason === 'refusal') {
      throw new Error('Claude declined to answer for this word.');
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
