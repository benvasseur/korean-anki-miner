<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import {
  CLAUDE_MODELS,
  LANGUAGES,
  ankiConfig,
  claudeApiKey,
  claudeModel,
  languagePair,
  papagoClientId,
  papagoClientSecret,
  type AnkiFieldMap,
} from '../../config';
import { fetchAnkiFields, fetchAnkiResources } from '../../anki/messages';

const FIELD_ROLES: ReadonlyArray<{ key: keyof AnkiFieldMap; label: string; required: boolean }> = [
  { key: 'front', label: 'Front — Korean word', required: true },
  { key: 'back', label: 'Back — translation', required: true },
  { key: 'extra', label: 'Extra — sentence / explanation', required: false },
  { key: 'image', label: 'Image — screenshot', required: false },
];

const form = reactive({
  clientId: '',
  clientSecret: '',
  claudeKey: '',
  claudeModel: 'claude-haiku-4-5',
  source: 'ko',
  target: 'en',
  deck: '',
  model: '',
  fields: { front: '', back: '', extra: '', image: '' } as AnkiFieldMap,
});

const loaded = ref(false);
const status = ref<'idle' | 'saved'>('idle');
const validationError = ref('');
let statusTimer: ReturnType<typeof setTimeout> | undefined;

const anki = reactive<{
  state: 'loading' | 'ready' | 'error';
  error: string;
  decks: string[];
  models: string[];
  fields: string[];
}>({ state: 'loading', error: '', decks: [], models: [], fields: [] });

onMounted(async () => {
  const [id, secret, claude, model, pair, ac] = await Promise.all([
    papagoClientId.getValue(),
    papagoClientSecret.getValue(),
    claudeApiKey.getValue(),
    claudeModel.getValue(),
    languagePair.getValue(),
    ankiConfig.getValue(),
  ]);
  form.clientId = id;
  form.clientSecret = secret;
  form.claudeKey = claude;
  form.claudeModel = model;
  form.source = pair.source;
  form.target = pair.target;
  form.deck = ac.deck;
  form.model = ac.model;
  form.fields = { ...ac.fields };
  loaded.value = true;
  await loadResources();
});

async function loadResources() {
  anki.state = 'loading';
  anki.error = '';
  const res = await fetchAnkiResources();
  if (!res.ok) {
    anki.state = 'error';
    anki.error = res.error;
    return;
  }
  anki.decks = res.decks;
  anki.models = res.models;
  anki.state = 'ready';
  if (form.model) await loadFields(form.model);
}

async function loadFields(model: string) {
  if (!model) {
    anki.fields = [];
    return;
  }
  const res = await fetchAnkiFields(model);
  if (!res.ok) {
    anki.state = 'error';
    anki.error = res.error;
    return;
  }
  anki.fields = res.fields;
  // Drop mappings the newly selected note type doesn't have.
  for (const role of FIELD_ROLES) {
    if (form.fields[role.key] && !anki.fields.includes(form.fields[role.key])) {
      form.fields[role.key] = '';
    }
  }
}

async function save() {
  validationError.value = '';

  // Saving Papago-only is fine. But once any Anki choice is made, require a
  // usable mapping: a deck, a note type, and at least Front + Back.
  const ankiTouched =
    form.deck || form.model || Object.values(form.fields).some(Boolean);
  if (ankiTouched && (!form.deck || !form.model || !form.fields.front || !form.fields.back)) {
    validationError.value =
      'For Anki, choose a deck and note type and map at least Front and Back.';
    return;
  }

  await Promise.all([
    papagoClientId.setValue(form.clientId.trim()),
    papagoClientSecret.setValue(form.clientSecret.trim()),
    claudeApiKey.setValue(form.claudeKey.trim()),
    claudeModel.setValue(form.claudeModel),
    languagePair.setValue({ source: form.source, target: form.target }),
    ankiConfig.setValue({ deck: form.deck, model: form.model, fields: { ...form.fields } }),
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

        <section>
          <h2>Enrichment — Claude <span class="optional">(optional)</span></h2>
          <p class="hint">
            An Anthropic API key. Used only when you click <em>Enrich with Claude</em> in the card
            preview, to fill the dictionary form and a richer explanation. Stored locally, never synced.
          </p>

          <label class="field">
            <span>API key</span>
            <input
              v-model="form.claudeKey"
              type="password"
              autocomplete="off"
              spellcheck="false"
              placeholder="sk-ant-…"
            />
          </label>

          <label class="field">
            <span>Model</span>
            <select v-model="form.claudeModel">
              <option v-for="m in CLAUDE_MODELS" :key="m.id" :value="m.id">
                {{ m.label }}
              </option>
            </select>
          </label>
        </section>

        <section>
          <h2>Anki</h2>
          <p class="hint">
            Cards are saved through the AnkiConnect add-on — Anki must be running.
          </p>

          <p v-if="anki.state === 'loading'" class="hint">Connecting to Anki…</p>

          <div v-else-if="anki.state === 'error'" class="anki-error">
            <p>{{ anki.error }}</p>
            <button type="button" class="secondary" @click="loadResources">Reload</button>
          </div>

          <template v-else>
            <div class="row">
              <label class="field">
                <span>Deck</span>
                <select v-model="form.deck">
                  <option value="">— select —</option>
                  <option v-for="d in anki.decks" :key="d" :value="d">{{ d }}</option>
                </select>
              </label>

              <label class="field">
                <span>Note type</span>
                <select
                  v-model="form.model"
                  @change="loadFields(($event.target as HTMLSelectElement).value)"
                >
                  <option value="">— select —</option>
                  <option v-for="m in anki.models" :key="m" :value="m">{{ m }}</option>
                </select>
              </label>
            </div>

            <p v-if="!form.model" class="hint">Pick a note type to map its fields.</p>
            <template v-else>
              <label v-for="role in FIELD_ROLES" :key="role.key" class="field">
                <span>{{ role.label }}<span v-if="role.required" class="req">*</span></span>
                <select v-model="form.fields[role.key]">
                  <option value="">{{ role.required ? '— select —' : '— none —' }}</option>
                  <option v-for="f in anki.fields" :key="f" :value="f">{{ f }}</option>
                </select>
              </label>
            </template>

            <button type="button" class="secondary reload" @click="loadResources">
              Reload from Anki
            </button>
          </template>
        </section>

        <div class="actions">
          <button type="submit">Save</button>
          <span v-if="status === 'saved'" class="saved" role="status">Saved ✓</span>
          <span v-if="validationError" class="error-msg" role="alert">{{ validationError }}</span>
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
  /* Fieldsets default to min-width: min-content, which a long <select> option
     would stretch past the card; reset so it tracks the container width. */
  min-width: 0;
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

.optional {
  font-weight: 400;
  font-size: 12px;
  color: #8a90a0;
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
  min-width: 0; /* allow flex children (e.g. in .row) to shrink instead of overflow */
  font-size: 13px;
  font-weight: 600;
}

.req {
  color: #d9534f;
  margin-left: 2px;
}

.field input,
.field select {
  width: 100%;
  min-width: 0;
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

.anki-error {
  margin-bottom: 14px;
  font-size: 13px;
  color: #c0392b;
}

.anki-error p {
  margin: 0 0 10px;
  line-height: 1.5;
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

.secondary {
  background: #6b7280;
}

.secondary:hover {
  background: #5b626f;
}

.reload {
  margin-top: 4px;
  padding: 7px 16px;
  font-size: 13px;
}

.saved {
  color: #2e9e5b;
  font-size: 13px;
  font-weight: 600;
}

.error-msg {
  color: #d9534f;
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
  .anki-error {
    color: #ff8a7a;
  }
}
</style>
