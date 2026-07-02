import type { EnrichmentRequest } from './types';

/**
 * Prompt + card schema shared by every enrichment adapter, so switching the
 * provider in Options never changes what a card looks like. The HTML template
 * below is the user's hand-tuned reference card (긁다) — treat it as data, not
 * prose to be reworded.
 */

export const CARD_TOOL_NAME = 'emit_card';
export const CARD_TOOL_DESCRIPTION = 'Return the enriched Anki card fields.';

/** JSON schema for the card fields; each adapter wraps it in its provider's tool envelope. */
export const CARD_SCHEMA = {
  type: 'object' as const,
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
};

export const SYSTEM_PROMPT = `You write Anki vocabulary cards for an English-speaking learner of Korean.
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

export function buildUserMessage({ word, sentence, back, source, target }: EnrichmentRequest): string {
  return (
    `Source language: ${source}. Target language (for glosses/translations): ${target}.\n` +
    `Word: ${word}\n` +
    `Sentence: ${sentence}\n` +
    `Machine translation: ${back}`
  );
}
