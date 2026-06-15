import { createApp } from 'vue';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import { ContentScriptContext } from 'wxt/utils/content-script-context';
import CaptionOverlay from '../overlay/CaptionOverlay.vue';
import { captionText } from '../overlay/caption-store';

const LOG = '[korean-anki-miner]';
const PLAYER_SELECTOR = '#movie_player';
const CAPTION_SEGMENT_SELECTOR = '.ytp-caption-segment';
const NATIVE_CAPTION_SELECTOR = '.ytp-caption-window-container';

/** Read the current caption text from the rendered YouTube caption DOM. */
function readCaption(root: ParentNode): string {
  const segments = root.querySelectorAll<HTMLElement>(CAPTION_SEGMENT_SELECTOR);
  return Array.from(segments, (el) => el.textContent ?? '')
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Resolve once an element matching `selector` exists; undefined if the context dies first. */
function waitForElement(
  selector: string,
  ctx: ContentScriptContext,
): Promise<HTMLElement | undefined> {
  return new Promise((resolve) => {
    const existing = document.querySelector<HTMLElement>(selector);
    if (existing) return resolve(existing);

    const observer = new MutationObserver(() => {
      const el = document.querySelector<HTMLElement>(selector);
      if (el) {
        observer.disconnect();
        resolve(el);
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    ctx.onInvalidated(() => {
      observer.disconnect();
      resolve(undefined);
    });
  });
}

/**
 * Watch the YouTube player for caption changes, invoking `onChange` with the new
 * text whenever it differs. Returns a function that stops watching.
 */
async function watchCaptions(
  ctx: ContentScriptContext,
  onChange: (text: string) => void,
): Promise<() => void> {
  const player = await waitForElement(PLAYER_SELECTOR, ctx);
  if (!player || ctx.isInvalid) return () => {};

  let last = '';
  let scheduled = false;

  const flush = () => {
    scheduled = false;
    const text = readCaption(player);
    if (text !== last) {
      last = text;
      onChange(text);
    }
  };

  // The player mutates constantly (progress bar, time display), so coalesce
  // reads to at most one per animation frame instead of one per mutation.
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    ctx.requestAnimationFrame(flush);
  });
  observer.observe(player, { childList: true, characterData: true, subtree: true });
  ctx.onInvalidated(() => observer.disconnect());

  flush(); // capture a caption that is already on screen
  return () => observer.disconnect();
}

/** Hide YouTube's own caption text so our interactive overlay is the only one shown. */
function hideNativeCaptions(ctx: ContentScriptContext) {
  const style = document.createElement('style');
  style.textContent = `${NATIVE_CAPTION_SELECTOR} { opacity: 0 !important; }`;
  document.head.appendChild(style);
  ctx.onInvalidated(() => style.remove());
}

export default defineContentScript({
  matches: ['*://*.youtube.com/watch*'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    console.log(LOG, 'content script loaded on', location.href);

    hideNativeCaptions(ctx);

    // Mount the overlay in a Shadow DOM so YouTube's CSS and ours stay isolated.
    const ui = await createShadowRootUi(ctx, {
      name: 'kam-overlay',
      position: 'inline',
      anchor: PLAYER_SELECTOR,
      append: 'last',
      // WXT resets the host with `:host { all: initial !important }`, which would
      // clobber inline host styles. Declaring the host styles here (same
      // selector, sourced after the reset, also !important) makes them win, so
      // the host becomes a full-player layer that stacks above YouTube's chrome.
      css: `:host {
        position: absolute !important;
        inset: 0 !important;
        z-index: 60 !important;
        pointer-events: none !important;
      }`,
      onMount: (container) => {
        const app = createApp(CaptionOverlay);
        app.mount(container);
        return app;
      },
      onRemove: (app) => app?.unmount(),
    });
    ui.autoMount(); // mount now, and re-mount if YouTube swaps the player element

    let stop: (() => void) | undefined;
    const startWatching = async () => {
      stop?.();
      captionText.value = '';
      stop = await watchCaptions(ctx, (text) => {
        captionText.value = text;
      });
    };

    startWatching();

    // YouTube is a SPA — re-establish the caption watcher when navigating between
    // videos; the overlay itself is kept mounted by ui.autoMount().
    const onNavigate = () => {
      console.log(LOG, 'yt-navigate-finish →', location.href);
      startWatching();
    };
    window.addEventListener('yt-navigate-finish', onNavigate);
    ctx.onInvalidated(() => window.removeEventListener('yt-navigate-finish', onNavigate));
  },
});
