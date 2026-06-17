import Anthropic from '@anthropic-ai/sdk';
import type { EnrichmentProvider, EnrichmentRequest, EnrichmentResult } from './types';

// A forced tool call gives us guaranteed, fully-typed structured output without
// relying on the (newer) output_config.format param being typed in this SDK.
const CARD_TOOL: Anthropic.Tool = {
  name: 'emit_card',
  description: 'Return the enriched Anki card fields.',
  input_schema: {
    type: 'object',
    properties: {
      front: {
        type: 'string',
        description:
          'Dictionary (base) form of the word. Strip particles and conjugation: ' +
          '학교에서 → 학교, 만났어요 → 만나다, 긁었더니 → 긁다. If already a base form, return it unchanged.',
      },
      back: {
        type: 'string',
        description:
          "Short target-language gloss of the word's core meaning(s) for a flashcard back " +
          '— a few words, not a sentence. Include multiple senses when common, e.g. ' +
          '"to scratch; to swipe (a card)".',
      },
      extra: {
        type: 'string',
        description: 'HTML explanation following the exact structure given in the system prompt.',
      },
    },
    required: ['front', 'back', 'extra'],
  },
};

const SYSTEM_PROMPT = `You write Anki vocabulary cards for an English-speaking learner of Korean.
Given a Korean word (as it appeared in a subtitle), the full sentence it came from, and a rough
machine translation, produce the three card fields by calling the emit_card tool.

The "extra" field must be HTML using only <b> and <br> tags, in EXACTLY this structure and tone:

<b>Verb.</b> To scratch an itch, or to scrape a surface with something. Also used colloquially for swiping a credit card (카드를 긁다). Common across everyday physical actions and casual idiomatic expressions.<br><br><b>Key expressions:</b><br>
<b>긁어서</b> — by scratching/scraping<br>
<b>가렵다고 긁다</b> — to scratch because it itches<br>
<b>카드를 긁다</b> — to swipe a card (colloquial, spend money)<br><br><b>Examples:</b><br>
모기에 물린 곳을 긁었더니 더 가려워.<br>
I scratched the mosquito bite and now it itches even more.<br><br>
오늘 카드 너무 긁었나 봐.<br>
I think I swiped my card too much today.<br><br><b>Related:</b><br>
<b>할퀴다</b> — to claw, to scratch (more aggressive; usually animals or in a fight)<br>
<b>비비다</b> — to rub (gentler friction, not necessarily scratching)

Match that structure: a bolded part-of-speech then a one- or two-sentence description (cover colloquial
senses too); "<b>Key expressions:</b>" with 2–4 bolded collocations and glosses; "<b>Examples:</b>" with
1–2 examples (the Korean sentence, then its English translation on the next line, with <br> between
example pairs); "<b>Related:</b>" with 2–3 related words and brief distinctions. Keep it concise. Reuse
the learner's own subtitle sentence as one example when it fits naturally.`;

/** Claude (Anthropic) enrichment adapter. Runs in the service worker. */
export class ClaudeProvider implements EnrichmentProvider {
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async enrich({ word, sentence, back, source, target }: EnrichmentRequest): Promise<EnrichmentResult> {
    // A user-supplied key on the user's own machine; the SDK adds the
    // dangerous-direct-browser-access header and host_permissions bypass CORS.
    const client = new Anthropic({ apiKey: this.apiKey, dangerouslyAllowBrowser: true });

    const userMessage =
      `Source language: ${source}. Target language (for glosses/translations): ${target}.\n` +
      `Word: ${word}\n` +
      `Sentence: ${sentence}\n` +
      `Machine translation: ${back}`;

    let response: Anthropic.Message;
    try {
      response = await client.messages.create({
        model: this.model,
        max_tokens: 2048,
        thinking: { type: 'disabled' },
        system: SYSTEM_PROMPT,
        tools: [CARD_TOOL],
        tool_choice: { type: 'tool', name: CARD_TOOL.name },
        messages: [{ role: 'user', content: userMessage }],
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
