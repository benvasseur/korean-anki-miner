import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  // web-ext always launches a fresh, disposable, logged-out browser profile —
  // never the real one. Disabled so `npm run dev` just builds; load the
  // unpacked extension into your normal Chrome instead (see README/CLAUDE.md).
  webExt: {
    disabled: true,
  },
  manifest: {
    name: 'Korean Anki Miner',
    description: 'Mine Korean vocabulary from YouTube subtitles into Anki.',
    permissions: ['storage'],
    host_permissions: [
      'https://api-free.deepl.com/*',
      'https://api.deepl.com/*',
      'https://papago.apigw.ntruss.com/*',
      'https://api.anthropic.com/*',
      'https://api.mistral.ai/*',
      'http://127.0.0.1:8765/*',
    ],
  },
});
