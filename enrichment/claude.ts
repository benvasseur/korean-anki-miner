import Anthropic from '@anthropic-ai/sdk';
import {
  CARD_SCHEMA,
  CARD_TOOL_DESCRIPTION,
  CARD_TOOL_NAME,
  SYSTEM_PROMPT,
  buildUserMessage,
} from './prompt';
import type { EnrichmentProvider, EnrichmentRequest, EnrichmentResult } from './types';

// A forced tool call gives us guaranteed, fully-typed structured output without
// relying on the (newer) output_config.format param being typed in this SDK.
const CARD_TOOL: Anthropic.Tool = {
  name: CARD_TOOL_NAME,
  description: CARD_TOOL_DESCRIPTION,
  input_schema: CARD_SCHEMA,
};

/** Claude (Anthropic) enrichment adapter. Runs in the service worker. */
export class ClaudeProvider implements EnrichmentProvider {
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async enrich(request: EnrichmentRequest): Promise<EnrichmentResult> {
    // A user-supplied key on the user's own machine; the SDK adds the
    // dangerous-direct-browser-access header and host_permissions bypass CORS.
    const client = new Anthropic({ apiKey: this.apiKey, dangerouslyAllowBrowser: true });

    let response: Anthropic.Message;
    try {
      response = await client.messages.create({
        model: this.model,
        max_tokens: 2048,
        thinking: { type: 'disabled' },
        system: SYSTEM_PROMPT,
        tools: [CARD_TOOL],
        tool_choice: { type: 'tool', name: CARD_TOOL.name },
        messages: [{ role: 'user', content: buildUserMessage(request) }],
      });
    } catch (error) {
      if (error instanceof Anthropic.AuthenticationError) {
        throw new Error('Claude rejected the API key — check it in Options.');
      }
      if (error instanceof Anthropic.RateLimitError) {
        throw new Error('Claude rate limit reached. Try again shortly.');
      }
      throw new Error(error instanceof Error ? error.message : 'Enrichment failed.');
    }

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
    );
    const card = toolUse?.input as Partial<EnrichmentResult> | undefined;
    if (!card?.front || !card.back || !card.extra) {
      throw new Error('Claude returned an unexpected response.');
    }
    return { front: card.front, back: card.back, extra: card.extra };
  }
}
