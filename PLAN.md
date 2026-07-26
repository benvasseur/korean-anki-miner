# Improvement plan

Work queue for making this repo hold up as a portfolio / interview piece. Ordered by
value per hour — phase 1 and 2 are the ones that close the gap an interviewer will
actually probe ("how do you test a browser extension?"). Everything below is additive;
the extension works today.

Effort estimates assume familiarity with the code. Check items off as they land.

---

## Phase 1 — Test + lint foundation (~1h)

No test runner exists today; CI only type-checks and builds. This phase is pure setup,
so phase 2 is just writing tests.

- [ ] Add `vitest` + `happy-dom` + `@vitest/coverage-v8` as devDependencies.
- [ ] Add `vitest.config.ts` using WXT's helper (`defineWxtVitestConfig` from
      `wxt/testing`) so `wxt/browser` imports and the `~/` alias resolve inside tests.
- [ ] Add scripts: `"test": "vitest run"`, `"test:watch": "vitest"`.
- [ ] Add ESLint (flat config) + Prettier: `eslint`, `typescript-eslint`,
      `eslint-plugin-vue`, `prettier`, `eslint-config-prettier`. Script: `"lint"`.
- [ ] Wire both into [.github/workflows/ci.yml](.github/workflows/ci.yml) after `compile`.

**Done when:** `npm run lint && npm test` passes locally and in CI on a green push.

---

## Phase 2 — Unit tests for the pure logic (~4h)

The highest-value target: most of the tricky logic is already pure functions, so this is
writing assertions, not refactoring. Each bullet is one test file.

- [ ] `translation/deepl.test.ts` — language mapping (`ko`→`KO`, target `en`→`EN-US`,
      `zh-TW`→`ZH-HANT`), free vs Pro endpoint selection from the `:fx` suffix, and the
      error mapping (401 / 429 / **456 quota** / network throw) against a mocked `fetch`.
- [ ] `translation/papago.test.ts` — same shape: request encoding + error mapping.
- [ ] `enrichment/mistral.test.ts` — tool-call arguments arrive as a JSON *string*;
      assert the parse, and that a malformed / missing tool call throws rather than
      producing a half-empty card.
- [ ] `translation/cache.test.ts` — key includes provider + language pair; a hit under
      one provider is a miss under the other.
- [ ] `overlay/tokenize.test.ts` — the `RUN` / `IS_WORD` regexes from
      [CaptionOverlay.vue:15-16](overlay/CaptionOverlay.vue#L15-L16). Extract them to
      `overlay/tokenize.ts` first. Cases: `일하고...` → `일하고`, `'일하기 / 귀찮다'`,
      combining marks, digits, mixed Latin/Hangul.
- [ ] `overlay/capture-frame.test.ts` — `wrapLines` greedy wrapping against a stubbed
      `measureText`. (Export it; it's currently module-private.)

**Done when:** `npm test` covers every adapter's error paths. Coverage number is not the
point — the error paths are.

---

## Phase 3 — Harden the sanitizer, then prove it (~2h)

[CardPreview.vue:8-15](overlay/CardPreview.vue#L8-L15) sanitizes model-generated HTML
with a regex before `v-html`. It holds up under probing (allowlist-and-drop is the safe
direction), but "I wrote my own HTML sanitizer with a regex" is a sentence you'd have to
defend under pressure. It also matters beyond the popup: that HTML is written into the
Anki note and rendered by Anki's webview.

- [ ] Rewrite `sanitizeHtml` to parse instead of regex: `new DOMParser().parseFromString`,
      walk the tree, drop non-allowlisted elements (keeping their text) and strip every
      attribute. Same allowlist (`b i u strong em br`), same signature — no caller changes.
- [ ] `overlay/sanitize.test.ts` with adversarial input: `<img src=x onerror=alert(1)>`,
      `<svg/onload=alert(1)>`, `<a href="a>b" onclick=alert(1)>`, `<scr<script>ipt>`,
      unclosed tags, `<b onclick="x">keep me</b>` → `<b>keep me</b>`.

**Done when:** the test file reads like an attack list and all of it is inert. This turns
the weakest-looking part of the codebase into the most obviously deliberate one.

---

## Phase 4 — Extract the popup geometry (~1h)

The clamping math in [CaptionOverlay.vue:77-131](overlay/CaptionOverlay.vue#L77-L131) is
the most intricate logic in the project and the only place that has had a real geometry
bug (a popup taller than the player skipped the clamp and was clipped by the player's
overflow).

- [ ] Extract to `overlay/position.ts` as a pure function: takes player bounds, word
      position, popup size, mode; returns `{ left, top, maxWidth, maxHeight, showArrow }`.
      The Vue component keeps only the DOM reads and style writes.
- [ ] `overlay/position.test.ts` — anchored above the word in the normal case; flips/clamps
      near the top edge; arrow hidden when it can't sit cleanly above; **regression: a
      preview taller than the player is capped and centred, never overflowing**; a sheet
      wider than a mini player is capped in both axes.

**Done when:** the geometry is testable without a DOM, and the regression case is named
as such in the test.

---

## Phase 5 — End-to-end smoke test (~4h)

The differentiator. Very few side projects have E2E for an extension, and it's the direct
answer to "how do you know it works?"

- [ ] Add `@playwright/test`. Launch a persistent Chromium context with
      `--disable-extensions-except=.output/chrome-mv3 --load-extension=...` (headless
      `chromium` channel supports MV3 extensions).
- [ ] Build a **static fixture page** under `e2e/fixtures/` that mimics YouTube's caption
      DOM (`#movie_player`, `.ytp-caption-segment`, a `<video>` with a local sample) —
      do not test against youtube.com; it is slow, unstable, and rate-limits CI.
- [ ] Stub the network: intercept the DeepL/AnkiConnect calls via `page.route`, or seed
      `chrome.storage.local` with a cached translation so the click path needs no key.
- [ ] Test the loop: overlay renders over the fixture caption → click a word → popup shows
      the translation → *Save to Anki* opens the preview → *Save* issues the expected
      `addNote` payload.
- [ ] Add a `e2e` job to CI (own job, `npm run build` first).

**Done when:** `npm run e2e` goes red if the click→card loop breaks.

---

## Phase 6 — Production robustness (~3h)

Small, visible, and each one is a thing an interviewer can ask "what happens if…" about.

- [ ] **Request timeouts.** No fetch in the project uses `AbortController`; a hung DeepL
      call leaves the popup on "Translating…" forever. Add a shared
      `fetchWithTimeout(url, init, ms)` used by all four adapters (~8s network, ~30s AI).
- [ ] **Retry on 429** with one backoff attempt for the translation path (it is the one
      that fires constantly). Enrichment stays single-shot — it costs money.
- [ ] **Cache maintenance.** [translation/cache.ts](translation/cache.ts) has no eviction
      and, since the provider became part of the key, old entries are orphaned. Add a
      "Clear translation cache" button in Options showing the entry count.
- [ ] Check `response.ok` in [anki/connect.ts:24](anki/connect.ts#L24) before `.json()` —
      a non-JSON error body currently throws a parse error instead of a useful message.

---

## Phase 7 — Bundle diet (~2h)

`npm run build` prints five `node:fs` / `node:path` externalization warnings and produces a
**174KB** background bundle, almost all of it `@anthropic-ai/sdk` — for one HTTP call that
the Mistral adapter does in ~10KB with raw `fetch`. Warnings in your own build output are
the kind of thing an interviewer reads out loud.

- [ ] Rewrite `enrichment/claude.ts` as a raw-fetch adapter against
      `POST https://api.anthropic.com/v1/messages` (forced `tool_choice`, same shared
      prompt module), matching the Mistral adapter's shape.
- [ ] Drop the `@anthropic-ai/sdk` dependency.
- [ ] Record the before/after bundle size in the commit message — a measured number is
      worth more than the change itself.

**Done when:** the build is warning-free and the background bundle is under ~20KB.

---

## Phase 8 — Accessibility + setup UX (~5h)

- [ ] **Keyboard access to the overlay.** Caption words are click-only `<span>`s today.
      Roving `tabindex`, Enter/Space to select, arrow keys between words, `aria-live` on
      the popup so the translation is announced. Almost nobody does a11y on a side project.
- [ ] **"Test connection" buttons** in Options for the translation key, the AI key, and
      AnkiConnect — each round-trips one cheap request and reports ✓ / the error. Makes
      setup failures self-diagnosing, and demos well.
- [ ] Finish the roadmap's duplicate handling: `canAddNotes` pre-check + an "add anyway"
      path, so the loop ends cleanly instead of on an AnkiConnect error string.

---

## Phase 9 — Presentation (~1h)

- [x] Replace the static screenshot with the demo recording — [docs/demo.gif](docs/demo.gif)
      (2× speed, 880px, 15fps, 3.6MB) is in the README; [docs/demo.mp4](docs/demo.mp4) is the
      source, kept small (363KB) by the same 2× re-encode.
- [ ] Optionally also embed the mp4 as playable video: upload it to a GitHub issue comment
      and use the resulting `user-attachments` URL (GitHub renders video only from its own
      asset URLs, not relative repo paths).
- [ ] Add the war stories to the README's "decisions worth calling out": the `timedtext`
      `pot`-token dead end, the `:host { all: initial }` fight with WXT's reset, coalescing
      the caption MutationObserver to one read per animation frame, and the tainted-canvas
      fallback for DRM content. The hardest problems solved here are currently invisible to
      anyone who does not read the source.
- [ ] Add a `## Testing` section once phases 2 and 5 land — what is tested at which level,
      and why E2E runs against a fixture rather than youtube.com.

---

## Suggested order

Phases 1 → 2 → 3 close the credibility gap; stop there if time is short. Phase 5 is the
one that gets remembered. Phases 6–8 are depth to reach for once the foundation is in.
