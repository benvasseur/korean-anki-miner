import { ContentScriptContext } from 'wxt/utils/content-script-context';

const LOG = '[korean-anki-miner]';
const PLAYER_SELECTOR = '#movie_player';
const CAPTION_SEGMENT_SELECTOR = '.ytp-caption-segment';

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
    if (text && text !== last) {
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

export default defineContentScript({
  matches: ['*://*.youtube.com/watch*'],
  main(ctx) {
    console.log(LOG, 'content script loaded on', location.href);

    let stop: (() => void) | undefined;
    const init = async () => {
      stop?.();
      stop = await watchCaptions(ctx, (text) => {
        console.log(LOG, 'caption:', text);
      });
    };

    init();

    // YouTube is a SPA — it does not reload between videos, so the watcher would
    // die silently on the next video without re-init. `yt-navigate-finish` fires
    // once the new watch page's data is ready.
    const onNavigate = () => {
      console.log(LOG, 'yt-navigate-finish →', location.href);
      init();
    };
    window.addEventListener('yt-navigate-finish', onNavigate);
    ctx.onInvalidated(() => window.removeEventListener('yt-navigate-finish', onNavigate));
  },
});
