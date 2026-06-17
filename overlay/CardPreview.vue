<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import { requestEnrichment } from '../enrichment/messages';

// The Extra field is model-generated HTML; allow only basic inline formatting
// and strip every attribute, so an injected onerror/onclick can't run when we
// render it with v-html.
const ALLOWED_TAGS = new Set(['b', 'i', 'u', 'strong', 'em', 'br']);
function sanitizeHtml(html: string): string {
  return html.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, (_match, rawName: string) => {
    const name = rawName.toLowerCase();
    if (!ALLOWED_TAGS.has(name)) return ''; // drop the tag, keep any text
    return _match.startsWith('</') ? `</${name}>` : `<${name}>`; // drop attributes
  });
}

// Mounted fresh when entering preview mode, so initialising the editable draft
// from the prefill props (once) is correct.
const props = defineProps<{
  word: string; // clicked surface form, for enrichment context
  sentence: string; // subtitle line, for enrichment context
  front: string;
  back: string;
  extra: string;
  image: string; // data URL of the captured frame, '' when none; owned by the parent
  showExtra: boolean;
  showImage: boolean;
  saveState: 'idle' | 'saving' | 'saved' | 'error';
  error: string;
}>();

const emit = defineEmits<{
  (e: 'save', draft: { front: string; back: string; extra: string }): void;
  (e: 'cancel'): void;
  (e: 'recapture'): void;
  (e: 'remove'): void;
}>();

const front = ref(props.front);
const back = ref(props.back);
const extra = ref(props.extra);

const enrichState = ref<'idle' | 'loading' | 'error'>('idle');
const enrichError = ref('');

const canSave = computed(() => front.value.trim() !== '' && back.value.trim() !== '');
const busy = computed(
  () => props.saveState === 'saving' || props.saveState === 'saved' || enrichState.value === 'loading',
);

// Extra renders as formatted HTML by default; click to edit the raw source.
const editingExtra = ref(false);
const extraInput = ref<HTMLTextAreaElement | null>(null);
const renderedExtra = computed(() => sanitizeHtml(extra.value));

function startEditExtra() {
  if (busy.value || editingExtra.value) return;
  editingExtra.value = true;
  void nextTick(() => extraInput.value?.focus());
}

async function onEnrich() {
  if (busy.value) return;
  enrichState.value = 'loading';
  enrichError.value = '';
  // The worker owns the Claude call; we pass the original word + sentence as
  // context and write the result back into the editable fields.
  const res = await requestEnrichment(props.word, props.sentence, back.value);
  if (res.ok) {
    front.value = res.front;
    back.value = res.back;
    extra.value = res.extra;
    enrichState.value = 'idle';
  } else {
    enrichState.value = 'error';
    enrichError.value = res.error;
  }
}

function onSave() {
  if (!canSave.value || busy.value) return;
  emit('save', {
    front: front.value.trim(),
    back: back.value.trim(),
    extra: extra.value.trim(),
  });
}
</script>

<template>
  <div class="kam-preview">
    <label class="kam-field">
      <span>Front</span>
      <input v-model="front" type="text" :disabled="busy" spellcheck="false" />
    </label>

    <label class="kam-field">
      <span>Back</span>
      <input v-model="back" type="text" :disabled="busy" spellcheck="false" />
    </label>

    <div v-if="showExtra" class="kam-field">
      <span>Extra</span>
      <textarea
        v-if="editingExtra"
        ref="extraInput"
        v-model="extra"
        rows="10"
        :disabled="busy"
        @blur="editingExtra = false"
      ></textarea>
      <div
        v-else
        class="kam-extra"
        role="textbox"
        tabindex="0"
        @click="startEditExtra"
        @focus="startEditExtra"
      >
        <span v-if="!extra.trim()" class="kam-extra__placeholder">(empty — click to add)</span>
        <div v-else v-html="renderedExtra"></div>
      </div>
    </div>

    <div v-if="showImage" class="kam-field">
      <span>Image</span>
      <div v-if="image" class="kam-image">
        <img :src="image" alt="captured frame" class="kam-image__thumb" />
        <div class="kam-image__actions">
          <button type="button" class="kam-btn kam-btn--ghost" :disabled="busy" @click="emit('recapture')">
            Recapture
          </button>
          <button type="button" class="kam-btn kam-btn--ghost" :disabled="busy" @click="emit('remove')">
            Remove
          </button>
        </div>
      </div>
      <div v-else class="kam-image kam-image--empty">
        <span class="kam-image__placeholder">No frame captured</span>
        <button type="button" class="kam-btn kam-btn--ghost" :disabled="busy" @click="emit('recapture')">
          Capture
        </button>
      </div>
    </div>

    <button
      type="button"
      class="kam-btn kam-enrich"
      :disabled="busy"
      @click="onEnrich"
    >
      {{ enrichState === 'loading' ? 'Enriching…' : '✨ Enrich with AI' }}
    </button>

    <div v-if="enrichState === 'error'" class="kam-preview__error">{{ enrichError }}</div>
    <div v-if="saveState === 'error'" class="kam-preview__error">{{ error }}</div>

    <div class="kam-preview__footer">
      <button type="button" class="kam-btn kam-btn--ghost" :disabled="busy" @click="$emit('cancel')">
        Cancel
      </button>
      <div class="kam-preview__save">
        <span v-if="saveState === 'saved'" class="kam-preview__saved">Saved ✓</span>
        <button
          type="button"
          class="kam-btn kam-btn--primary"
          :disabled="!canSave || busy"
          @click="onSave"
        >
          {{ saveState === 'saving' ? 'Saving…' : 'Save' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.kam-preview {
  min-width: 232px;
  text-align: left;
}

.kam-field {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-bottom: 8px;
  font-size: 11px;
  font-weight: 600;
  color: #aab1c0;
}

.kam-field input,
.kam-field textarea {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  font: inherit;
  font-size: 14px;
  font-weight: 400;
  padding: 6px 8px;
  border: 1px solid #3a4150;
  border-radius: 6px;
  background: #2a3040;
  color: #fff;
  resize: vertical;
}

.kam-field input:focus,
.kam-field textarea:focus {
  outline: 2px solid #4a90e2;
  outline-offset: 0;
  border-color: transparent;
}

/* Rendered (read) view of the Extra HTML — styled like the inputs, scrollable. */
.kam-extra {
  box-sizing: border-box;
  max-height: 220px;
  overflow-y: auto;
  padding: 6px 8px;
  border: 1px solid #3a4150;
  border-radius: 6px;
  background: #2a3040;
  color: #fff;
  font-weight: 400;
  font-size: 14px;
  line-height: 1.45;
  cursor: text;
}

.kam-extra:hover {
  border-color: #4a5266;
}

.kam-extra:focus {
  outline: 2px solid #4a90e2;
  outline-offset: 0;
  border-color: transparent;
}

.kam-extra__placeholder {
  color: #6b7280;
}

.kam-image {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.kam-image__thumb {
  display: block;
  width: 100%;
  border-radius: 6px;
  border: 1px solid #3a4150;
}

.kam-image__actions {
  display: flex;
  gap: 6px;
}

.kam-image--empty {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border: 1px dashed #3a4150;
  border-radius: 6px;
  background: #2a3040;
}

.kam-image__placeholder {
  font-weight: 400;
  font-size: 13px;
  color: #6b7280;
}

.kam-enrich {
  width: 100%;
  margin: 2px 0 8px;
  background: #3a2f52;
  color: #d9c9ff;
}

.kam-enrich:not(:disabled):hover {
  background: #483a66;
}

.kam-preview__error {
  margin: 2px 0 8px;
  font-size: 12px;
  line-height: 1.35;
  color: #ffb4a6;
}

.kam-preview__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 4px;
}

.kam-preview__save {
  display: flex;
  align-items: center;
  gap: 8px;
}

.kam-preview__saved {
  font-size: 13px;
  font-weight: 600;
  color: #6ee7a0;
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

.kam-btn:disabled {
  opacity: 0.55;
  cursor: default;
}

.kam-btn--primary {
  background: #4a90e2;
  color: #fff;
}

.kam-btn--primary:not(:disabled):hover {
  background: #3b7fcc;
}

.kam-btn--ghost {
  background: transparent;
  color: #aab1c0;
}

.kam-btn--ghost:not(:disabled):hover {
  color: #fff;
}
</style>
