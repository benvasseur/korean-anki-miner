import { ref } from 'vue';

/**
 * The current caption line, shared between the content script (which reads it
 * from the YouTube DOM) and the overlay UI (which renders it as clickable words).
 * They live in the same content-script bundle, so this module-level ref is shared.
 */
export const captionText = ref('');
