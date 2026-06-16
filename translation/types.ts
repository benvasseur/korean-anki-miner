export interface TranslationRequest {
  /** The surface form to translate (a clicked caption word). */
  text: string;
  /** Source language code, e.g. 'ko'. */
  source: string;
  /** Target language code, e.g. 'en'. */
  target: string;
}

/**
 * Swappable translation backend for the click path (build step 5). Returns the
 * translated text only — no lemma. Keeping this behind an interface means Papago
 * can be replaced (or proxied) without touching callers.
 */
export interface TranslationProvider {
  translate(request: TranslationRequest): Promise<string>;
}
