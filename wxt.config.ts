import { defineConfig } from 'wxt';

// Every remote host the background talks to. AnkiConnect is added per-browser
// below, because the two engines disagree about ports in match patterns.
const API_HOSTS = [
  'https://api-free.deepl.com/*',
  'https://api.deepl.com/*',
  'https://papago.apigw.ntruss.com/*',
  'https://api.anthropic.com/*',
  'https://api.mistral.ai/*',
];

export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  targetBrowsers: ['chrome', 'firefox'],
  // web-ext always launches a fresh, disposable, logged-out browser profile —
  // never the real one. Disabled so `npm run dev` just builds; load the
  // unpacked extension into your normal browser instead (see README/CLAUDE.md).
  webExt: {
    disabled: true,
  },
  zip: {
    // Firefox gets a sources ZIP by default, and the default exclusions only
    // skip dotfiles — so anything untracked-but-visible would be handed to AMO.
    excludeSources: ['INTERVIEW.md', 'PLAN.md', 'docs/**'],
  },
  manifest: ({ browser }) => ({
    name: 'Korean Anki Miner',
    description: 'Mine Korean vocabulary from YouTube subtitles into Anki.',
    permissions: ['storage'],
    // No popup — the whole UI lives in the YouTube overlay. The button exists so
    // the add-on is pinnable at all (browsers grey out entries with no action)
    // and gives Options a home outside about:addons. Clicking it opens Options.
    action: {
      default_title: 'Korean Anki Miner — options',
      // Firefox otherwise buries new buttons in the overflow menu.
      ...(browser === 'firefox' && { default_area: 'navbar' }),
    },
    host_permissions: [
      ...API_HOSTS,
      // Firefox match patterns cannot carry a port, and it silently drops any
      // pattern that has one (bugs 1362809 / 1468162) — which would leave Anki
      // with no host permission at all. Portless matches every port on the host.
      browser === 'firefox' ? 'http://127.0.0.1/*' : 'http://127.0.0.1:8765/*',
    ],
    ...(browser === 'firefox' && {
      browser_specific_settings: {
        gecko: {
          // Fixed forever once signed: changing it makes a different add-on.
          // Also load-bearing for storage.sync, which Firefox keys by add-on ID.
          id: 'korean-anki-miner@benvasseur.github.io',
          strict_min_version: '140.0',
          // Caption text leaves the device for DeepL/Papago/Anthropic/Mistral,
          // which is `websiteContent` under Mozilla's definitions.
          data_collection_permissions: { required: ['websiteContent'] },
        },
      },
    }),
  }),
});
