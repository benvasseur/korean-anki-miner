import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  manifest: {
    name: 'Korean Anki Miner',
    description: 'Mine Korean vocabulary from YouTube subtitles into Anki.',
    permissions: ['storage'],
    host_permissions: [
      'https://papago.apigw.ntruss.com/*',
      'http://127.0.0.1:8765/*',
    ],
  },
});
