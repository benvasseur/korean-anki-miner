import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  manifest: {
    name: 'Korean Anki Miner',
    description: 'Mine Korean vocabulary from YouTube subtitles into Anki.',
    permissions: ['storage'],
  },
});
