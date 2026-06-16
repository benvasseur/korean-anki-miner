<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import {
  LANGUAGES,
  languagePair,
  papagoClientId,
  papagoClientSecret,
} from '../../config';

const form = reactive({
  clientId: '',
  clientSecret: '',
  source: 'ko',
  target: 'en',
});

const loaded = ref(false);
const status = ref<'idle' | 'saved'>('idle');
let statusTimer: ReturnType<typeof setTimeout> | undefined;

onMounted(async () => {
  const [id, secret, pair] = await Promise.all([
    papagoClientId.getValue(),
    papagoClientSecret.getValue(),
    languagePair.getValue(),
  ]);
  form.clientId = id;
  form.clientSecret = secret;
  form.source = pair.source;
  form.target = pair.target;
  loaded.value = true;
});

async function save() {
  await Promise.all([
    papagoClientId.setValue(form.clientId.trim()),
    papagoClientSecret.setValue(form.clientSecret.trim()),
    languagePair.setValue({ source: form.source, target: form.target }),
  ]);
  status.value = 'saved';
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => (status.value = 'idle'), 1800);
}
</script>

<template>
  <main class="page">
    <h1>Korean Anki Miner</h1>
    <p class="subtitle">Options</p>

    <form class="card" @submit.prevent="save">
      <fieldset :disabled="!loaded">
        <section>
          <h2>Translation — Papago</h2>
          <p class="hint">
            From a Naver Cloud Platform <em>Papago Translation</em> application.
            Stored locally on this device, never synced.
          </p>

          <label class="field">
            <span>Client ID</span>
            <input
              v-model="form.clientId"
              type="text"
              autocomplete="off"
              spellcheck="false"
              placeholder="X-NCP-APIGW-API-KEY-ID"
            />
          </label>

          <label class="field">
            <span>Client Secret</span>
            <input
              v-model="form.clientSecret"
              type="password"
              autocomplete="off"
              spellcheck="false"
              placeholder="X-NCP-APIGW-API-KEY"
            />
          </label>
        </section>

        <section>
          <h2>Languages</h2>
          <div class="row">
            <label class="field">
              <span>Translate from</span>
              <select v-model="form.source">
                <option v-for="lang in LANGUAGES" :key="lang.code" :value="lang.code">
                  {{ lang.label }}
                </option>
              </select>
            </label>

            <label class="field">
              <span>Translate to</span>
              <select v-model="form.target">
                <option v-for="lang in LANGUAGES" :key="lang.code" :value="lang.code">
                  {{ lang.label }}
                </option>
              </select>
            </label>
          </div>
        </section>

        <div class="actions">
          <button type="submit">Save</button>
          <span v-if="status === 'saved'" class="saved" role="status">Saved ✓</span>
        </div>
      </fieldset>
    </form>
  </main>
</template>

<style scoped>
.page {
  max-width: 560px;
  margin: 0 auto;
}

h1 {
  margin: 0;
  font-size: 22px;
}

.subtitle {
  margin: 2px 0 24px;
  color: #8a90a0;
  font-size: 14px;
}

.card {
  background: #fff;
  border: 1px solid #e2e4ea;
  border-radius: 12px;
  padding: 20px 22px;
}

fieldset {
  margin: 0;
  padding: 0;
  border: 0;
}

fieldset:disabled {
  opacity: 0.6;
}

section + section {
  margin-top: 24px;
}

h2 {
  margin: 0 0 6px;
  font-size: 15px;
}

.hint {
  margin: 0 0 14px;
  font-size: 13px;
  line-height: 1.5;
  color: #8a90a0;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 14px;
  font-size: 13px;
  font-weight: 600;
}

.field input,
.field select {
  font: inherit;
  font-weight: 400;
  padding: 9px 11px;
  border: 1px solid #cfd2db;
  border-radius: 8px;
  background-color: #fff;
  color: #1f2430;
}

.field input:focus,
.field select:focus {
  outline: 2px solid #4a90e2;
  outline-offset: 0;
  border-color: transparent;
}

/* Replace the native dropdown arrow (which ignores padding) with a custom
   chevron inset 11px from the right; background-color stays separate so it
   survives the dark-mode override below. */
.field select {
  appearance: none;
  -webkit-appearance: none;
  padding-right: 34px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238a90a0' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 11px center;
}

.row {
  display: flex;
  gap: 14px;
}

.row .field {
  flex: 1;
}

.actions {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 20px;
}

button {
  font: inherit;
  font-weight: 600;
  padding: 9px 20px;
  border: 0;
  border-radius: 8px;
  background: #4a90e2;
  color: #fff;
  cursor: pointer;
}

button:hover {
  background: #3b7fcc;
}

.saved {
  color: #2e9e5b;
  font-size: 13px;
  font-weight: 600;
}

@media (prefers-color-scheme: dark) {
  .card {
    background: #1d2026;
    border-color: #2c303a;
  }
  .field input,
  .field select {
    background-color: #15171c;
    border-color: #3a3f4b;
    color: #e7e9ee;
  }
}
</style>
