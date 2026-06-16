<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { captionText } from './caption-store';
import WordPopup from './WordPopup.vue';

// Placeholder until Papago is wired behind TranslationProvider (build step 5).
const HARDCODED_TRANSLATION = '— translation —';

// A run of letters/numbers is a clickable word; everything else (quotes, commas,
// ellipses…) is rendered but inert. \p{L}\p{N}\p{M} keeps Hangul (and combining
// marks) together while excluding punctuation, so clicking 일하고... yields 일하고
// and '일하기 / 귀찮다' yield 일하기 / 귀찮다 without the surrounding marks.
const RUN = /[\p{L}\p{N}\p{M}]+|[^\p{L}\p{N}\p{M}]+/gu;
const IS_WORD = /[\p{L}\p{N}\p{M}]/u;

interface Segment {
  text: string;
  word: boolean;
}

// Korean tokens are whitespace-delimited. A clicked word is the surface form
// (stem + particle, e.g. 학교에서), not the dictionary form — the lemma is
// resolved later on save (build step 7).
const tokens = computed<Segment[][]>(() =>
  captionText.value
    .split(/\s+/)
    .filter((t) => t.length > 0)
    .map((token) =>
      (token.match(RUN) ?? []).map((run) => ({ text: run, word: IS_WORD.test(run) })),
    ),
);

const rootEl = ref<HTMLElement | null>(null);
const selected = ref<{ ti: number; si: number; word: string; left: number; top: number } | null>(null);

function isActive(ti: number, si: number): boolean {
  return selected.value?.ti === ti && selected.value?.si === si;
}

function onWordClick(ti: number, si: number, word: string, event: MouseEvent) {
  const root = rootEl.value;
  if (!root) return;
  // Position the popup relative to the overlay root (its positioned ancestor),
  // so the maths is independent of scroll, fullscreen, and any page transforms.
  const wordRect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  const rootRect = root.getBoundingClientRect();
  selected.value = {
    ti,
    si,
    word,
    left: wordRect.left - rootRect.left + wordRect.width / 2,
    top: wordRect.top - rootRect.top,
  };
}

function dismiss() {
  selected.value = null;
}

// Drop the popup when the underlying caption line changes — the word is gone.
watch(captionText, dismiss);

function onDocPointerDown(event: Event) {
  if (!selected.value) return;
  // composedPath pierces the shadow DOM, so we can tell whether the click landed
  // on a word or inside the popup (both managed elsewhere) vs. truly outside.
  const path = event.composedPath();
  const hit = (cls: string) =>
    path.some((n) => n instanceof HTMLElement && n.classList.contains(cls));
  if (!hit('kam-word') && !hit('kam-popup')) dismiss();
}

function onKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape' && selected.value) {
    dismiss();
    // Don't let YouTube also act on Escape (e.g. exit fullscreen).
    event.stopPropagation();
    event.preventDefault();
  }
}

// Word positions shift on resize/fullscreen; simplest correct behaviour is to
// dismiss rather than render a stale popup.
onMounted(() => {
  document.addEventListener('pointerdown', onDocPointerDown, true);
  document.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('resize', dismiss);
  document.addEventListener('fullscreenchange', dismiss);
});
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocPointerDown, true);
  document.removeEventListener('keydown', onKeyDown, true);
  window.removeEventListener('resize', dismiss);
  document.removeEventListener('fullscreenchange', dismiss);
});
</script>

<template>
  <div ref="rootEl" class="kam-overlay-root">
    <p v-if="tokens.length" class="kam-caption">
      <span v-for="(token, ti) in tokens" :key="ti" class="kam-token">
        <template v-for="(seg, si) in token" :key="si">
          <span
            v-if="seg.word"
            class="kam-word"
            :class="{ 'kam-word--active': isActive(ti, si) }"
            @click.stop="onWordClick(ti, si, seg.text, $event)"
            >{{ seg.text }}</span
          >
          <span v-else class="kam-punct">{{ seg.text }}</span>
        </template>
      </span>
    </p>
    <WordPopup
      v-if="selected"
      :word="selected.word"
      :translation="HARDCODED_TRANSLATION"
      :style="{ left: `${selected.left}px`, top: `${selected.top}px` }"
    />
  </div>
</template>

<style scoped>
.kam-overlay-root {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 8%;
  display: flex;
  justify-content: center;
  pointer-events: none; /* let clicks fall through to the player by default */
}

.kam-caption {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.15em 0.35em; /* row gap / column gap between tokens */
  margin: 0;
  max-width: 92%;
  padding: 0.15em 0.6em;
  background: rgba(8, 8, 8, 0.75);
  border-radius: 4px;
  color: #fff;
  font-family: 'YouTube Noto', Roboto, Arial, sans-serif;
  font-size: clamp(18px, 2.6vw, 32px);
  line-height: 1.45;
  pointer-events: none;
}

/* A token groups a word with its attached punctuation, kept adjacent (no gap);
   flex also drops the whitespace text nodes between segments in the template. */
.kam-token {
  display: flex;
  align-items: baseline;
}

.kam-word {
  pointer-events: auto; /* only the words are interactive */
  cursor: pointer;
  padding: 0 1px;
  border-radius: 3px;
  transition: background-color 0.08s ease;
}

.kam-word:hover {
  background: rgba(74, 144, 226, 0.65);
}

.kam-word--active {
  background: rgba(74, 144, 226, 0.9);
}

.kam-punct {
  white-space: pre; /* preserve any internal spacing within a punctuation run */
}
</style>
