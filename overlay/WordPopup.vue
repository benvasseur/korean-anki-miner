<script setup lang="ts">
// Positioning (left/top) is supplied by the parent as a fallthrough `style`;
// this component owns its appearance and the upward offset + arrow.
defineProps<{ word: string; translation: string }>();
</script>

<template>
  <div class="kam-popup" role="dialog">
    <div class="kam-popup__word">{{ word }}</div>
    <div class="kam-popup__translation">{{ translation }}</div>
    <div class="kam-popup__arrow" aria-hidden="true"></div>
  </div>
</template>

<style scoped>
.kam-popup {
  position: absolute;
  /* left/top (from parent) point at the top-center of the clicked word; lift
     the popup above it and center it horizontally. */
  transform: translate(-50%, calc(-100% - 10px));
  box-sizing: border-box;
  min-width: 96px;
  max-width: 260px;
  padding: 8px 12px;
  background: #1f2430;
  color: #fff;
  border-radius: 8px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.45);
  font-family: 'YouTube Noto', Roboto, Arial, sans-serif;
  text-align: center;
  pointer-events: auto;
}

.kam-popup__word {
  font-size: 18px;
  font-weight: 600;
  line-height: 1.2;
}

.kam-popup__translation {
  margin-top: 3px;
  font-size: 15px;
  line-height: 1.3;
  color: #cdd3df;
}

.kam-popup__arrow {
  position: absolute;
  left: 50%;
  bottom: -5px;
  width: 11px;
  height: 11px;
  background: #1f2430;
  transform: translateX(-50%) rotate(45deg);
  border-radius: 2px;
}
</style>
