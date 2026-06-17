<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { captionText } from './caption-store';
import { requestTranslation } from '../translation/messages';
import { openOptions, saveNote } from '../anki/messages';
import { ankiConfig, type AnkiConfig } from '../config';
import CardPreview from './CardPreview.vue';
import WordPopup from './WordPopup.vue';

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

const tokens = computed<Segment[][]>(() =>
  captionText.value
    .split(/\s+/)
    .filter((t) => t.length > 0)
    .map((token) =>
      (token.match(RUN) ?? []).map((run) => ({ text: run, word: IS_WORD.test(run) })),
    ),
);

const rootEl = ref<HTMLElement | null>(null);
const popupEl = ref<HTMLElement | null>(null);
const selected = ref<{
  ti: number;
  si: number;
  word: string;
  sentence: string;
  left: number;
  top: number;
} | null>(null);
const result = reactive<{ state: 'loading' | 'done' | 'error'; text: string }>({
  state: 'loading',
  text: '',
});

const mode = ref<'translation' | 'preview'>('translation');
const card = reactive({ front: '', back: '', extra: '' });
const saveState = ref<'idle' | 'saving' | 'saved' | 'error'>('idle');
const saveError = ref('');

// Anki config drives the UI (show the save button? show the Extra field?). Kept
// live so configuring Anki in Options reflects without reloading the video tab.
const anki = reactive({ configured: false, extraMapped: false });
let unwatchAnki: (() => void) | undefined;

function applyAnkiConfig(cfg: AnkiConfig) {
  anki.configured = Boolean(cfg.deck && cfg.model && cfg.fields.front && cfg.fields.back);
  anki.extraMapped = Boolean(cfg.fields.extra);
}

// --- Popup placement -------------------------------------------------------
// Centre the popup on the word, then clamp it inside the player and flip below
// when there isn't room above. The arrow keeps pointing at the word.
const popupStyle = reactive<{ left: string; top: string; visibility: 'hidden' | 'visible' }>({
  left: '0px',
  top: '0px',
  visibility: 'hidden',
});
const arrowStyle = reactive<{ left: string }>({ left: '50%' });
const showArrow = ref(true);
const POPUP_MARGIN = 8;
const POPUP_GAP = 10;
const ARROW_MARGIN = 14;

function positionPopup() {
  const sel = selected.value;
  const root = rootEl.value;
  const popup = popupEl.value;
  if (!sel || !root || !popup) return;

  // The shadow host (inset:0 over #movie_player) gives the player bounds.
  const host = (root.getRootNode() as ShadowRoot).host as HTMLElement | null;
  const bounds = (host ?? root).getBoundingClientRect();
  const rootRect = root.getBoundingClientRect();
  const pw = popup.offsetWidth;
  const ph = popup.offsetHeight;

  const wordCenterX = rootRect.left + sel.left;
  const wordTopY = rootRect.top + sel.top;

  // Horizontal: clamp the centred popup inside [margin, player − margin].
  const minLeft = bounds.left + POPUP_MARGIN;
  const maxLeft = bounds.right - POPUP_MARGIN - pw;
  let leftVp = wordCenterX - pw / 2;
  leftVp = maxLeft >= minLeft ? Math.min(Math.max(leftVp, minLeft), maxLeft) : minLeft;

  // Vertical: prefer above the word, but clamp to stay inside the player so it
  // never spills into YouTube's page UI (which would occlude it). On a small
  // player it may overlap the video — still fully visible above it (z-index 60).
  const minTop = bounds.top + POPUP_MARGIN;
  const maxTop = bounds.bottom - POPUP_MARGIN - ph;
  let topVp = Math.max(wordTopY - POPUP_GAP - ph, minTop);
  if (maxTop >= minTop) topVp = Math.min(topVp, maxTop);

  const arrowX = Math.min(Math.max(wordCenterX - leftVp, ARROW_MARGIN), pw - ARROW_MARGIN);

  popupStyle.left = `${Math.round(leftVp - rootRect.left)}px`;
  popupStyle.top = `${Math.round(topVp - rootRect.top)}px`;
  popupStyle.visibility = 'visible';
  arrowStyle.left = `${Math.round(arrowX)}px`;
  // Only show the arrow when the popup sits cleanly above the word.
  showArrow.value = topVp + ph <= wordTopY + 1;
}

// Reposition whenever the popup resizes (translation→preview, text length,
// textarea drag) and whenever a new word is selected.
let resizeObserver: ResizeObserver | undefined;
watch(popupEl, (el) => {
  resizeObserver?.disconnect();
  if (el) {
    resizeObserver = new ResizeObserver(() => positionPopup());
    resizeObserver.observe(el);
  }
});
watch(selected, async (sel) => {
  if (!sel) return;
  popupStyle.visibility = 'hidden'; // avoid a flash at the previous spot
  await nextTick();
  positionPopup();
});

// Bumped on every click/dismiss / new save so a slow async reply that resolves
// after the user has moved on is ignored.
let requestId = 0;
let saveId = 0;

function isActive(ti: number, si: number): boolean {
  return selected.value?.ti === ti && selected.value?.si === si;
}

async function onWordClick(ti: number, si: number, word: string, event: MouseEvent) {
  const root = rootEl.value;
  if (!root) return;
  // Position relative to the overlay root (its positioned ancestor), so the
  // maths is independent of scroll, fullscreen, and any page transforms.
  const wordRect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  const rootRect = root.getBoundingClientRect();
  selected.value = {
    ti,
    si,
    word,
    sentence: captionText.value, // snapshot now; the line is stable while editing
    left: wordRect.left - rootRect.left + wordRect.width / 2,
    top: wordRect.top - rootRect.top,
  };
  mode.value = 'translation';
  saveState.value = 'idle';
  saveError.value = '';
  saveId++;

  const id = ++requestId;
  result.state = 'loading';
  result.text = '';
  const response = await requestTranslation(word);
  if (id !== requestId) return; // superseded by a newer click/dismiss
  if (response.ok) {
    result.state = 'done';
    result.text = response.translation;
  } else {
    result.state = 'error';
    result.text = response.error;
  }
}

function dismiss() {
  selected.value = null;
  mode.value = 'translation';
  requestId++;
  saveId++;
}

function openPreview() {
  if (!selected.value || result.state !== 'done') return;
  card.front = selected.value.word;
  card.back = result.text;
  card.extra = selected.value.sentence;
  saveState.value = 'idle';
  saveError.value = '';
  mode.value = 'preview';
}

function cancelPreview() {
  mode.value = 'translation';
  saveState.value = 'idle';
  saveError.value = '';
}

async function onSave(draft: { front: string; back: string; extra: string }) {
  saveState.value = 'saving';
  saveError.value = '';
  const id = ++saveId;
  const res = await saveNote(draft);
  if (id !== saveId) return; // superseded
  if (res.ok) {
    saveState.value = 'saved';
    window.setTimeout(() => {
      if (id === saveId) dismiss();
    }, 900);
  } else {
    saveState.value = 'error';
    saveError.value = res.error;
  }
}

// Drop the popup when the caption line changes — but only in translation mode,
// so editing the preview isn't interrupted while the video keeps playing.
watch(captionText, () => {
  if (mode.value === 'translation') dismiss();
});

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
  if (event.key !== 'Escape' || !selected.value) return;
  // Esc backs out of the preview first, then closes the popup.
  if (mode.value === 'preview') cancelPreview();
  else dismiss();
  event.stopPropagation();
  event.preventDefault();
}

onMounted(async () => {
  document.addEventListener('pointerdown', onDocPointerDown, true);
  document.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('resize', dismiss);
  document.addEventListener('fullscreenchange', dismiss);
  applyAnkiConfig(await ankiConfig.getValue());
  unwatchAnki = ankiConfig.watch(applyAnkiConfig);
});
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocPointerDown, true);
  document.removeEventListener('keydown', onKeyDown, true);
  window.removeEventListener('resize', dismiss);
  document.removeEventListener('fullscreenchange', dismiss);
  resizeObserver?.disconnect();
  unwatchAnki?.();
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

    <div
      v-if="selected"
      ref="popupEl"
      class="kam-popup"
      :class="{ 'kam-popup--wide': mode === 'preview' }"
      :style="popupStyle"
    >
      <WordPopup
        v-if="mode === 'translation'"
        :word="selected.word"
        :state="result.state"
        :text="result.text"
        :configured="anki.configured"
        @save-to-anki="openPreview"
        @open-options="openOptions"
      />
      <CardPreview
        v-else
        :front="card.front"
        :back="card.back"
        :extra="card.extra"
        :show-extra="anki.extraMapped"
        :save-state="saveState"
        :error="saveError"
        @save="onSave"
        @cancel="cancelPreview"
      />
      <div
        v-if="showArrow"
        class="kam-popup__arrow"
        :style="arrowStyle"
        aria-hidden="true"
      ></div>
    </div>
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

/* Shared anchored shell for the translation view and the card preview. JS sets
   the exact top-left (clamped), so there's no centering transform here. */
.kam-popup {
  position: absolute;
  box-sizing: border-box;
  min-width: 96px;
  max-width: 280px;
  padding: 10px 12px;
  background: #1f2430;
  color: #fff;
  border-radius: 8px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.45);
  font-family: 'YouTube Noto', Roboto, Arial, sans-serif;
  pointer-events: auto;
}

.kam-popup--wide {
  /* Roomy for editing + the longer Claude-enriched Extra; ~double the previous
     width, capped to the viewport. */
  width: 600px;
  max-width: 90vw;
}

.kam-popup__arrow {
  position: absolute;
  bottom: -5px; /* popup sits above the word; the arrow points down to it */
  width: 11px;
  height: 11px;
  background: #1f2430;
  transform: translateX(-50%) rotate(45deg);
  border-radius: 2px;
}
</style>
