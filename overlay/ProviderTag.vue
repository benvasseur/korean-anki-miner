<script setup lang="ts">
// Credits whichever backend produced the text on screen. Now that both paths are
// provider-selectable, "via DeepL" / "via Claude" is the only way to tell from
// the overlay which one actually answered.
defineProps<{
  kind: 'translation' | 'ai';
  /** Short provider name, e.g. 'DeepL' — see translationProviderName(). */
  name: string;
}>();
</script>

<template>
  <p
    class="kam-provider"
    :title="`${kind === 'ai' ? 'Enrichment' : 'Translation'} provided by ${name}`"
  >
    <!-- Generic role icons rather than brand logos: no trademark to keep in sync,
         and one visual language across providers. -->
    <svg
      v-if="kind === 'translation'"
      class="kam-provider__icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18" />
    </svg>
    <svg
      v-else
      class="kam-provider__icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9z" />
      <path d="M18.5 16.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" />
    </svg>
    <span>via {{ name }}</span>
  </p>
</template>

<style scoped>
.kam-provider {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  margin: 6px 0 0;
  font-size: 11px;
  line-height: 1;
  color: #7c8393;
  cursor: default;
}

.kam-provider__icon {
  width: 11px;
  height: 11px;
  flex: none;
}
</style>
