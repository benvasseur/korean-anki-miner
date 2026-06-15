# CLAUDE.md

## Project
Chrome extension (Manifest V3) for mining Korean vocabulary from YouTube subtitles into Anki.
Personal tool, single user. WHY: existing tools (Migaku, Language Reactor) lock the core loop —
see a word's meaning, click, save to Anki — behind subscriptions and feature bloat. This does only
that loop, and does it well.

Core loop: overlay YouTube captions → click a word → popup shows the translation → an optional
button sends a card to Anki (Korean word / translation / example sentence).

## Stack
- WXT (https://wxt.dev) as the extension framework — MV3, HMR, manifest handling, first-class Vue support.
- Vue 3 (Composition API) + TypeScript for all UI: popup, options page, and the in-page overlay.
- Node tooling. No backend in v1 (see API keys).

## Architecture
- **Content script** — owns the DOM. Reads the current caption, renders the word overlay and the
  translation popup. Mounts the Vue overlay INSIDE a Shadow DOM (see gotchas). Holds no secrets and
  makes no cross-origin calls; it sends messages to the service worker.
- **Service worker (background)** — the privileged hub. ALL network lives here: translation API,
  Claude API, AnkiConnect. Reached via `chrome.runtime` messaging.
- **Storage** — `chrome.storage.sync` for user config (deck, note type, field mapping, language pair).
  `chrome.storage.local` for the translation cache and API keys.

## API split (deliberate — do not collapse into one model)
Two providers on two different paths:
- **Translation (click path)** — Papago (Naver Cloud Platform). Fires on nearly every word, so it is
  optimized for latency and cost. Papago's free personal tier (~10k chars/day) is effectively free at
  single-word volume and is best-in-class for Korean. Returns translated text only (no lemma).
- **Enrichment (save path)** — Claude API. Fires only when the user saves a card. One structured-JSON
  call returns the dictionary form (lemma) + an example sentence (+ reading/POS if wanted), using the
  full subtitle line for in-context disambiguation. The translation field reuses the cached Papago result.
- Both sit behind small adapter interfaces (`TranslationProvider`, `EnrichmentProvider`) so either can
  be swapped without touching callers.

## API keys
- Configurable via the options page, stored in `chrome.storage.local`. NEVER hardcoded.
- Personal tool → a user-supplied key on the user's own machine is acceptable.
- If ever distributed: keys cannot live in the bundle (trivially extractable). Route through a thin Node
  proxy instead. The adapter layer keeps that a config change, not a rewrite.

## Build order (each step independently testable; commit between steps)
1. MV3 skeleton: manifest + a content script that `console.log`s on a watch page. Confirm load-unpacked.
2. Read the current caption from the DOM; handle SPA navigation (`yt-navigate-finish`).
3. Render the overlay in a Shadow DOM; each word a clickable `<span>`.
4. Click → popup with a hardcoded translation. Nail positioning + dismissal.
5. Wire Papago behind `TranslationProvider`; add the local cache.
6. Options page: pull `deckNames` / `modelFieldNames` from AnkiConnect to populate dropdowns; persist config.
7. `addNote` on the save button; map fields per config; auto-fill example with the subtitle line.
8. Polish: duplicate handling, "Anki not running" state, loading/success feedback, editable preview before send.

## Gotchas / hard constraints
- **SPA navigation** — YouTube does not reload between videos. Re-init on `yt-navigate-finish` or the
  script dies silently on the second video.
- **Shadow DOM is mandatory** for the overlay — isolates our CSS from YouTube's and vice versa.
- **Caption source** — read the rendered `.ytp-caption-segment` nodes from the DOM (simple, no auth).
  The `timedtext` endpoint is the alternative but now requires a `pot` (proof-of-origin) token + `c=WEB`
  param; stripping them returns an empty body and the token can't be synthesized. Avoid unless DOM
  reading proves insufficient (then intercept the player's own request rather than building the URL).
- **AnkiConnect** — local HTTP server at `http://127.0.0.1:8765`, up only while Anki desktop runs (needs
  a clear error state). Call it FROM the service worker (grant `host_permissions` for the endpoint), not
  the content script. Set AnkiConnect's `webCorsOriginList` to include the extension origin
  (`chrome-extension://<id>`). Actions used: `deckNames`, `modelNames`, `modelFieldNames`, `addNote`.
- **Korean segmentation** — clicking a space-delimited token yields stem+particle (학교에서 = 학교 + 에서),
  not the lemma. v1: save the token, show Claude's dictionary form on save, make the field editable
  before it commits. Do not block v1 on a morphological analyzer.
- **Translation caching** — cache by surface form in `chrome.storage.local`. High-frequency words and
  particles repeat constantly; caching makes repeats instant at zero quota.

## Out of scope for v1
Non-YouTube sites, audio/TTS, SRS scheduling tweaks, bulk export, accounts/sync. Keep it to the loop.
