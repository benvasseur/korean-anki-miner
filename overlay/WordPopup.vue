<script setup lang="ts">
// Translation view. The positioned shell + arrow live in CaptionOverlay so this
// and the card preview can share one anchored wrapper.
defineProps<{
  word: string;
  state: 'loading' | 'done' | 'error';
  text: string;
  configured: boolean;
}>();

defineEmits<{
  (e: 'save-to-anki'): void;
  (e: 'open-options'): void;
}>();
</script>

<template>
  <div class="kam-view">
    <div class="kam-word-head">{{ word }}</div>
    <div v-if="state === 'loading'" class="kam-muted">Translating…</div>
    <div v-else-if="state === 'error'" class="kam-error">{{ text }}</div>
    <div v-else class="kam-translation">{{ text }}</div>

    <div v-if="state === 'done'" class="kam-actions">
      <button
        v-if="configured"
        type="button"
        class="kam-btn kam-btn--primary"
        @click="$emit('save-to-anki')"
      >
        Save to Anki
      </button>
      <button v-else type="button" class="kam-linkbtn" @click="$emit('open-options')">
        Set up Anki in Options →
      </button>
    </div>
  </div>
</template>

<style scoped>
.kam-view {
  text-align: center;
}

.kam-word-head {
  font-size: 18px;
  font-weight: 600;
  line-height: 1.2;
}

.kam-translation {
  margin-top: 3px;
  font-size: 15px;
  line-height: 1.3;
  color: #cdd3df;
}

.kam-muted {
  margin-top: 3px;
  font-size: 13px;
  color: #9aa1b1;
  font-style: italic;
}

.kam-error {
  margin-top: 3px;
  font-size: 13px;
  line-height: 1.35;
  color: #ffb4a6;
}

.kam-actions {
  margin-top: 10px;
}

.kam-btn {
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  padding: 6px 14px;
  border: 0;
  border-radius: 6px;
  cursor: pointer;
}

.kam-btn--primary {
  background: #4a90e2;
  color: #fff;
}

.kam-btn--primary:hover {
  background: #3b7fcc;
}

.kam-linkbtn {
  font: inherit;
  font-size: 13px;
  padding: 4px 6px;
  border: 0;
  background: transparent;
  color: #8fb8f0;
  cursor: pointer;
}

.kam-linkbtn:hover {
  text-decoration: underline;
}
</style>
