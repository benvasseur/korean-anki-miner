export default defineContentScript({
  matches: ['*://*.youtube.com/watch*'],
  main() {
    console.log('[korean-anki-miner] content script loaded on', location.href);
  },
});
