import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

// WxtVitest wires up the same aliases and globals the extension gets at build
// time, and swaps `wxt/browser` for @webext-core/fake-browser — so modules that
// touch chrome.storage (the translation cache, config items) run under test
// without stubbing the extension APIs by hand.
export default defineConfig({
  test: {
    environment: 'happy-dom',
    // happy-dom's DOMParser is less inert than a real browser's (which gives
    // parsed documents no browsing context): left alone it tries to fetch the
    // iframes and scripts in the sanitizer's attack payloads. Turn that off so
    // the suite never reaches the network.
    environmentOptions: {
      happyDOM: {
        settings: {
          disableIframePageLoading: true,
          disableJavaScriptFileLoading: true,
          disableJavaScriptEvaluation: true,
          disableCSSFileLoading: true,
        },
      },
    },
    include: ['**/*.test.ts'],
    exclude: ['node_modules', '.output', '.wxt', 'e2e'],
    coverage: {
      provider: 'v8',
      include: ['translation/**', 'enrichment/**', 'anki/**', 'overlay/**', 'config/**'],
    },
  },
  plugins: [WxtVitest()],
});
