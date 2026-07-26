<script setup lang="ts">
import { ref } from 'vue';

// A labelled API-key input that can be revealed. Keys are long random strings,
// so typos are invisible until a request fails — being able to read one back is
// the difference between "wrong key" and "wrong everything".
defineProps<{ label: string; placeholder?: string }>();

const value = defineModel<string>({ required: true });
const revealed = ref(false);
</script>

<template>
  <label class="field">
    <span>{{ label }}</span>
    <div class="input-wrap">
      <input
        v-model="value"
        :type="revealed ? 'text' : 'password'"
        autocomplete="off"
        spellcheck="false"
        :placeholder="placeholder"
      />
      <!-- Outside the input's flow so it never overlaps the caret; the label
           wrapping us means a bare <button> would submit, hence type="button". -->
      <button
        type="button"
        class="reveal"
        :aria-label="revealed ? 'Hide key' : 'Show key'"
        :aria-pressed="revealed"
        @click="revealed = !revealed"
      >
        {{ revealed ? 'Hide' : 'Show' }}
      </button>
    </div>
  </label>
</template>

<style scoped>
/* Mirrors .field in App.vue — scoped styles don't reach into a child component,
   so the input's look is repeated here rather than shared. */
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 14px;
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
}

.input-wrap {
  position: relative;
  display: flex;
  min-width: 0;
}

input {
  width: 100%;
  min-width: 0;
  font: inherit;
  font-weight: 400;
  padding: 9px 11px;
  padding-right: 62px; /* room for the reveal button */
  border: 1px solid #cfd2db;
  border-radius: 8px;
  background-color: #fff;
  color: #1f2430;
}

input:focus {
  outline: 2px solid #4a90e2;
  outline-offset: 0;
  border-color: transparent;
}

.reveal {
  position: absolute;
  top: 50%;
  right: 6px;
  transform: translateY(-50%);
  padding: 5px 9px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  cursor: pointer;
}

.reveal:hover {
  background: #eef0f4;
  color: #1f2430;
}

.reveal:focus-visible {
  outline: 2px solid #4a90e2;
}

@media (prefers-color-scheme: dark) {
  input {
    background-color: #15171c;
    border-color: #3a3f4b;
    color: #e7e9ee;
  }
  .reveal {
    color: #8a90a0;
  }
  .reveal:hover {
    background: #2c303a;
    color: #e7e9ee;
  }
}
</style>
