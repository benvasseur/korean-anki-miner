# Improvement plan

Work queue for making this repo hold up as a portfolio / interview piece. Ordered by
value per hour — phase 1 and 2 are the ones that close the gap an interviewer will
actually probe ("how do you test a browser extension?"). Everything below is additive;
the extension works today.

Effort estimates assume familiarity with the code. Check items off as they land.

---

## Phase 1 — Test + lint foundation ✅ done

No test runner exists today; CI only type-checks and builds. This phase is pure setup,
so phase 2 is just writing tests.

- [x] Add `vitest` + `happy-dom` + `@vitest/coverage-v8` as devDependencies.
- [x] Add `vitest.config.ts` using WXT's helper (`defineWxtVitestConfig` from
      `wxt/testing`) so `wxt/browser` imports and the `~/` alias resolve inside tests.
- [x] Add scripts: `"test": "vitest run"`, `"test:watch": "vitest"`.
- [x] Add ESLint (flat config) + Prettier: `eslint`, `typescript-eslint`,
      `eslint-plugin-vue`, `prettier`, `eslint-config-prettier`. Script: `"lint"`.
- [x] Wire both into [.github/workflows/ci.yml](.github/workflows/ci.yml) after `compile`.

**Done when:** `npm run lint && npm test` passes locally and in CI on a green push.

---

## Phase 2 — Unit tests for the pure logic ✅ done

The highest-value target: most of the tricky logic is already pure functions, so this is
writing assertions, not refactoring. Each bullet is one test file.

- [x] `translation/deepl.test.ts` — language mapping (`ko`→`KO`, target `en`→`EN-US`,
      `zh-TW`→`ZH-HANT`), free vs Pro endpoint selection from the `:fx` suffix, and the
      error mapping (401 / 429 / **456 quota** / network throw) against a mocked `fetch`.
- [x] `translation/papago.test.ts` — same shape: request encoding + error mapping.
- [x] `enrichment/mistral.test.ts` — tool-call arguments arrive as a JSON _string_;
      assert the parse, and that a malformed / missing tool call throws rather than
      producing a half-empty card.
- [x] `translation/cache.test.ts` — key includes provider + language pair; a hit under
      one provider is a miss under the other.
- [x] `overlay/tokenize.test.ts` — the `RUN` / `IS_WORD` regexes from
      [CaptionOverlay.vue:15-16](overlay/CaptionOverlay.vue#L15-L16). Extract them to
      `overlay/tokenize.ts` first. Cases: `일하고...` → `일하고`, `'일하기 / 귀찮다'`,
      combining marks, digits, mixed Latin/Hangul.
- [x] `overlay/capture-frame.test.ts` — `wrapLines` greedy wrapping against a stubbed
      `measureText`. (Export it; it's currently module-private.)

**Done when:** `npm test` covers every adapter's error paths. Coverage number is not the
point — the error paths are.

---

## Phase 3 — Harden the sanitizer, then prove it ✅ done

The Extra field was sanitized with a regex before `v-html`. It held up under probing
(allowlist-and-drop is the safe direction), but "I wrote my own HTML sanitizer with a
regex" is a sentence you'd have to defend under pressure — and it matters beyond the
popup, since that HTML is also written into the Anki note and rendered by Anki's webview.
Now [overlay/sanitize.ts](overlay/sanitize.ts), parser-based, with 30 attack cases.

- [x] Rewrite `sanitizeHtml` to parse instead of regex: `new DOMParser().parseFromString`,
      walk the tree, drop non-allowlisted elements (keeping their text) and strip every
      attribute. Same allowlist (`b i u strong em br`), same signature — no caller changes.
- [x] `overlay/sanitize.test.ts` with adversarial input: `<img src=x onerror=alert(1)>`,
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
      the translation → _Save to Anki_ opens the preview → _Save_ issues the expected
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

The background bundle is **206KB**, almost all of it `@anthropic-ai/sdk` — for one HTTP
call that the Mistral adapter does in ~10KB with raw `fetch`.

The five `node:fs` / `node:path` externalization warnings this phase originally called out
are **already gone**, cleared by the 2026-09-14 dependency upgrade rather than by anything
here. The size half went the other way in the same upgrade: 174KB → 206KB, as the SDK moved
0.104 → 0.125. So the measured win is now larger than when this was written.

- [ ] Rewrite `enrichment/claude.ts` as a raw-fetch adapter against
      `POST https://api.anthropic.com/v1/messages` (forced `tool_choice`, same shared
      prompt module), matching the Mistral adapter's shape.
- [ ] Drop the `@anthropic-ai/sdk` dependency.
- [ ] Record the before/after bundle size in the commit message — a measured number is
      worth more than the change itself.
- [ ] Add `enrichment/claude.test.ts` while the adapter is being rewritten — it is the only
      provider with no test, and a raw-fetch shape makes it as testable as the Mistral one.

**Done when:** the background bundle is under ~20KB.

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
      anyone who does not read the source. Two more from the Firefox port: - **The AnkiConnect CORS step that was never needed.** This repo's own README and
      CLAUDE.md prescribed adding the extension origin to `webCorsOriginList` for years.
      Testing on Firefox showed it works untouched; AnkiConnect's `allowOrigin` explains
      why twice over (a request with no `Origin` is allowed outright, and the default
      `http://localhost` entry already admits extension origins). The architecture note
      "all network lives in the background" is what made it unnecessary — background
      fetches under host permissions bypass CORS and send no `Origin`. The best version
      of this story is that documentation lost to a test, not that the fix was clever. - **Firefox silently drops match patterns containing a port.** `http://127.0.0.1:8765/*`
      is valid on Chrome and ignored entirely on Firefox (bug 1362809) — no error, just no
      host permission, so every Anki call would fail with a misleading "Anki is not
      reachable". The Firefox target uses the portless form.
- [ ] Add a `## Testing` section once phases 2 and 5 land — what is tested at which level,
      and why E2E runs against a fixture rather than youtube.com.

---

## Phase 10 — Firefox + distribution

The port landed 2026-09-14: MV3 on both browsers, gecko settings, a per-browser AnkiConnect
origin, a host-permission grant step in Options (Firefox treats MV3 host permissions as
optional), plus the toolbar button and icon set. CI builds both targets and the release
workflow ships both zips.

- [x] Firefox build target (`npm run dev:firefox` / `build:firefox` / `zip:firefox`).
- [x] Toolbar button + icon set — without an `action` the add-on was greyed out and
      unpinnable in both browsers, and shipped no icon art at all.
- [ ] **Decide the distribution goal, because the two answers diverge.** An _unlisted_
      AMO add-on is signed and self-installable in normal Firefox but invisible to everyone
      else — good for daily use, worth nothing as a portfolio artifact. Only a _listed_
      add-on is publicly demonstrable. Pick before spending effort: - Unlisted: `web-ext sign --channel=unlisted`, automated validation, minutes. - Listed: source zip upload (Vite bundles the code — already configured, with
      `INTERVIEW.md` / `PLAN.md` / `docs/` excluded), plus a privacy policy, since the
      manifest declares `data_collection_permissions: ['websiteContent']`.
- [ ] Verify against current store policy before submitting anywhere — the Chrome Web Store
      has no rule against YouTube extensions (Migaku and Language Reactor both ship there
      doing this), but Google is less predictable about its own properties, and the
      `http://127.0.0.1` AnkiConnect call is the part most likely to draw a reviewer
      question on either store. Explain it plainly in the listing.

---

## Suggested order

Phases 1 → 2 → 3 close the credibility gap; stop there if time is short. Phase 5 is the
one that gets remembered. Phases 6–8 are depth to reach for once the foundation is in.
