export interface EnrichmentRequest {
  /** The clicked surface form (e.g. 학교에서). */
  word: string;
  /** The full subtitle line, for in-context disambiguation. */
  sentence: string;
  /** The current (Papago) translation, as refinement context. */
  back: string;
  /** Source language code, e.g. 'ko'. */
  source: string;
  /** Target language code, e.g. 'en'. */
  target: string;
}

export interface EnrichmentResult {
  /** Dictionary / base form of the word (lemma). */
  front: string;
  /** Concise target-language gloss (may refine the input translation). */
  back: string;
  /** HTML explanation for the card's extra field. */
  extra: string;
}

/**
 * Swappable enrichment backend for the save path (build step 8). Fires only on
 * demand (the "Enrich" button), never automatically. Lives in the service
 * worker — it holds the Claude key and makes the cross-origin call.
 */
export interface EnrichmentProvider {
  enrich(request: EnrichmentRequest): Promise<EnrichmentResult>;
}
