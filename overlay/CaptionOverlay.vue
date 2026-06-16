<script setup lang="ts">
import { computed } from 'vue';
import { captionText } from './caption-store';

// Korean tokens are whitespace-delimited. A clicked token is the surface form
// (stem + particle, e.g. 학교에서), not the dictionary form — the lemma is
// resolved later on save (build step 7). For now each token is its own span.
const words = computed(() =>
  captionText.value.split(/\s+/).filter((w) => w.length > 0),
);

function onWordClick(word: string) {
  // Build step 4 will replace this with the translation popup.
  console.log('[korean-anki-miner] word clicked:', word);
}
</script>

<template>
  <div class="kam-overlay-root">
    <p v-if="words.length" class="kam-caption">
      <span
        v-for="(word, i) in words"
        :key="i"
        class="kam-word"
        @click="onWordClick(word)"
        >{{ word }}</span
      >
    </p>
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
  gap: 0.15em 0.35em; /* row gap / column gap between words */
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
</style>
