# Finn The Dyno PopCorn King — Implementation Roadmap

Date: 2026-09-01. Basis: read of `src/`, `index.html`, `styles.css`, `server.mjs`, `api/leaderboard.js`, `data/leaderboard.json`. Only this file was modified; no commit was made.

## Guard rails

- Preserve the simple identity: run left/right, catch popcorn before the floor, 3 misses, lollipop bonuses from birds, synthesized audio, procedural canvas art.
- 6 bounded phases; each is test-backed where possible and reversible (one commit per phase, small commits inside it).
- Baseline tests and browser-visible QA land first (Phase A) so later changes are measurable.
- Do not add mechanics merely because they are possible. Proposed additions below are direct fixes for defects found in the code or materially improve fun/clarity/responsiveness.
- No client-side proof-of-work: it is security theater that a tamperable client can trivially defeat and adds input latency for zero real protection. Score integrity on a JS leaderboard with a client-owned server is not enforceable; the honest target is abuse resistance (rate limiting plus existing validation), and the plan says so plainly.
- New raster artwork is optional, additive, and must fall back to current procedural/sprite rendering if absent.

## Current state (verified, with corrections to the prior audit)

- Files: `src/game.js` (1442 lines) is the entire engine/UI/board in one class; `src/renderer.js` (641), `src/audio.js` (310), `src/input.js` (88), `src/utils.js` (22), `src/main.js` (71). No tests, no `package.json`.
- Static server `server.mjs` (346 lines): `path.normalize` traversal guard at lines 267-274 is correct; cache headers `no-cache` for HTML, `public, max-age=3600` otherwise are already in place; leaderboard is a `data/leaderboard.json` file with a serialized write queue (lines 49-54, 226).
- Vercel API `api/leaderboard.js` (275 lines, CJS module); duplicated name/score/`ts` validation across `server.mjs`, `api/leaderboard.js`, and `#sanitizeLeaderboardEntries` in `game.js`.
- The ignored local development file `data/leaderboard.json` contains `"ts": 1200`. Since it is untracked runtime data and the true timestamp is unknowable, do not invent a replacement timestamp or commit the file. Phase F should make timestamp validation robust for future records.
- `freedinosprite.zip` (5.8MB) at repo root is **gitignored** (`*.zip`) and untracked; the prior "CI/cleanup issue" claim is wrong — it is not in the repo and cannot break CI.
- In `index.html`, the volume slider (`#volume-slider`, width `clamp(112px,19vw,170px)` inside `.hud-volume` with `grid-column: 1 / -1`) already has `width:100%` (styles.css:84-88) and `.hud-volume` already has `max-width:min(100%, 245px)` (styles.css:65). The "slider can be zero-width / clipped" defect is not reproducible and is dropped.
- `game.js:654-681` is `#applyAssist`; it is visible as a soft glow (renderer.js:320-328) and has no separate tick marker. The assist band is `y > 0.22*height && y < 0.86*height`; a visible target marker is an optional polish, not a fix for behavior.
- `#getBatchRange` (game.js:763-770) caps min count at 28; the prior "unbounded → 30+ pieces" claim is wrong as written (capped at 28 with +2). The real issue is qualitative: after batch 3 there is no variety, only a count ramp.
- Bird drop: `dropX = rand(width*0.16, width*0.84)` (game.js:530). On narrow screens this range overlaps the machine: `machine.w = clamp(width*0.14, 80, 140)` and `machine.x = width - machine.w*0.92`, so at width 320 the machine front is ≈246 and `dropX` can be ≈269, i.e. behind/under the machine. On desktop (width ≥ ~1000) the ranges do not overlap. Real issue, narrow-screen-only; Phase B clamps `dropX` clear of the machine and adds the arrival cue.
- Space toggles pause (game.js:221-227); there is no visible pause button, so touch/mobile cannot pause — that claim stands.
- The landing screen is anchored to a single HTML page (not a `#start`-overlay; the game is one page) and is scrollable on short screens — the claim "landing screen is a scrollable page on mobile" is fine, but it is not a separate page.
- Audio: all SFX use one `#toneAt` oscillator with a gain envelope (audio.js:274-290); there is already a `musicGain` vs `sfxGain` split with duckable buses (audio.js:56-66) and a `bass` array that is present but empty (musicPattern.bass = []). The claim "no ducking, mono everything" is exaggerated; real current gaps are: `bass` unused, no music intensity reaction, no suspend/resume re-create.

## Acceptance baseline

Every phase accepts: `npm test` green (Phase A adds the harness); the game still plays identically on 320px, 390px, and desktop; and prior render/audio behavior is unchanged except where the phase intentionally changes it.

## Roadmap

### Phase A — Foundation: tests + QA baseline

Goal: make every later change measurable.
- Add `package.json` (`"type": "module"`), test script `node --test`.
- Extract deterministic logic from `game.js` into `src/shared/*.mjs` (pure, no DOM): trajectory sampling + bounds validation (lines 792-874), assist math (654-681), scoring/formatMisses/milestone, name sanitization + blocked fragments, leaderboard `normalizeEntries`/`applyRename`.
- Share the leaderboard rules by importing these modules from `game.js`, `server.mjs`, and `api/leaderboard.js` (the last stays CJS — it can `require` the `.mjs` via dynamic import or duplicate-and-test; prefer a tiny CJS wrapper module).
- Port tests for: trajectory stays in-bounds across widths/heights; assist band clamps; name rules; dedupe/tie-break; combo (when Phase D adds it).
- Browser-visible QA baseline: manual checklist on 320×568 / 390×844 / 1366×768 / Safari + Chromium; record a "current behavior" note (times, spawn cadence, feel) as a reference.
- Out of scope: any gameplay change.
- Acceptance: `npm test` green; game behavior byte-identical; checklist recorded.
- Rollback: revert commit; it is mechanical.

Likely files: new `package.json`, `src/shared/*.mjs`, `test/*.test.mjs`, edits to `game.js`, `server.mjs`, `api/leaderboard.js`, README test note.

### Phase B — Bounded, fun-focused gameplay fixes

Real defects, in this order, each flaggable off:

1. **Ramp bound + variety**: the capped range (`Math.min(28, ...)`, game.js:768) is fine; after batch 10 stop raising the count and instead gently shorten recovery between batches (game.js:759). Small, reversible, direct fix to the "count-only" complaint.
2. **"Last chance" clarity**: `#handleMiss` (game.js:722-743) — when `misses === maxMisses - 1`, flash "LAST MISS — catch everything!" in the HUD (`#miss-pill`, styled in `styles.css`); on the third miss the game already ends cleanly.
3. **Visible assist cue**: the existing assist glow is faint and reads as sparkle; add a small target tick under the descending popcorn at the ground plane (draw in `renderer.js`, tune in `#applyAssist`). Improves clarity of an existing system; no behavior change.
4. **Bird arrival cue**: draw a "!" above the bonus bird 0.6s before its drop point (drop logic at game.js:544-567), so the reward is learnable, not a surprise.
5. **Test belt, nothing new**: the client, dev server, and KV API already agree on `normalizeEntries` tie-breaks (best score, earliest `ts`), so do not rewrite them. Add shared-module tests (Phase A) that lock the behavior; change code only if a test fails.

Not in scope: power-ups, jumps, energy, luck buffering, near-miss forgiveness, slow-mo death — none of these are needed to preserve identity and they grew scope in the previous plan.

Likely files: `src/game.js`, `src/renderer.js`, `styles.css`/`index.html` (HUD flash).
Acceptance: manual play on the 3 viewports; count ramp stops growing after batch 10; last-miss warning shows; assist/bird cues visible; tests for milestone/batch logic.
Validation: `npm test` + manual checklist. Rollback: one commit, flags off.

### Phase C — HUD economy, accessibility, and mobile pause

Direct fixes:
- **Visible Pause button** (`index.html`/`styles.css`), matching existing `#pause-screen` overlay and Space toggle; `pointercancel`-aware reset in `InputManager` on pause/gameover/blur (input.js already handles blur reset).
- **320px HUD**: `#miss-pill` and `#score-pill` are `clamp(112px,19vw,170px)`; at 320px that is 112px each which is fine, but with the new pause + existing volume toolbar, switch `#hud` to a horizontal flex with wrap so nothing overlaps; keep `#volume-slider` at `min(100%,245px)`.
- **Screen-reader/focus**: `aria-live` announcements for start/gameover (currently only the HUD is `aria-live`); focus-visible rings on `#mute-btn`, `#play-btn`, and control buttons (only `#player-name` has one today, styles.css:503-506).
- **Reduced motion**: `@media (prefers-reduced-motion: reduce)` kill `score-pop`/`milestone-pop` animations (styles.css:120-134, 220-244).
- **In-canvas countdown**: new substate in `game.js` between `play` and popcorn spawn: 3-2-1-GO over ~1.4s; removes the "0.8s first batch while still orienting" gap (`nextBatchAt = 0.8`, game.js:277). Must not double-fire Space pause while substate is active.
- No changes to scoring/assist.

Likely files: `index.html`, `styles.css`, `src/game.js`, `src/input.js`, `src/renderer.js` (countdown draw).
Acceptance: tab through all controls; VoiceOver announces start/gameover; pause works on touch; no movement stuck after `pointercancel`; countdown visible; reduced-motion renders unobtrusively. Validation: manual + Lighthouse/axe (browser only). Rollback: revert commit; countdown is additive.

### Phase D — Feel, audio, and difficulty depth

Small, testable, feature-flagged:
- **Combo multiplier** — a catch-streak ×2 at 5 / ×3 at 10 / ×4 at 18 catches, reset on miss; HUD pill `×N`; affects score only in the scoring module (tested). Simple addition that rewards clean streaks without new mechanics.
- **Audio clarity** (audio.js): use the existing-but-empty `bass` array (a simple root-note line); give `catch` a two-osc hit and `miss` a harsher shape so they stop sounding identical; add a milestone sting; keep `masterGain`/`musicGain`/`sfxGain` architecture, do not add more buses. Rename nothing.
- **Dynamic music intensity**: bump tempo/gain slightly as score/stage increases; stop/resume already exist — add a `visibilitychange` handler that recreates a suspended `AudioContext` so backgrounded Safari tabs resume audio after returning (audio.js:51-77).
- **Difficulty presets** (Easy/Normal/Hard) persisted to `localStorage`: presets adjust flying arc (`#createPopcornTrajectory` intensity/lift bounds), assist strength band, and `#getBatchRange` ceilings from a small table, default Normal. HUD shows a pill only when not Normal. This directly expands the "no difficulty choice" gap without new art.

Likely files: `src/game.js`, `src/audio.js`, `styles.css`, `index.html`; tests for scoring/combo in `src/shared`.
Acceptance: combo multiplies visibly and resets on miss; catch/miss/milestone audibly distinct; music livelier with score; suspend/resume works; presets persist and default Normal. Validation: `npm test` + ear/eye checks + manual 3 viewports. Rollback: flags off.

### Phase E — Visual cohesion + renderer perf (optional raster, fallback required)

- **Art cohesion, procedural**: bunting/confetti at milestones and a couple of perched spectator pigeons on the ground — all procedural canvas (matches existing style), tuned to not distract. Optional; if it churns, skip — clarity over decoration.
- **Renderer cache**: background/machine are full redraws each frame (renderer.js:61-106, 141-305). Cache sky+hill+ground+static machine to an offscreen canvas per DPR, invalidate on `resize`; keep animated parts (puffs, wheels, flame, hit) drawn live. 60fps on 4K and modest phones is the baseline.
- **Optional new raster**: Finn catch/jump/cheer frames or a higher-res machine PNG — *only if* assets are supplied into `assets/sprites/`; renderer must keep `idle`/`run`/`dead` current sprites as fallback and preserve `originX/Y` anchoring (renderer.js:463-464). Loading failure must fall back, never block.
- **Quality slider** for particle density (cap ~350) — code-only.

Likely files: `src/renderer.js`, `src/game.js` (particles/quality), optional `assets/sprites/*`.
Acceptance: 60fps hold at 4K with particles; resize never shows stale cached bg; fallback rendering unchanged if `assets/sprites` empty; optional rasters load or fall back. Validation: rAF frame-time log; visual pass. Rollback: revert commit; cache invalidation is the one invariant (invalidate on resize).

### Phase F — Leaderboard abuse resistance (honest scope)

Careful wording, intentional: this limits abuse, it is not anti-cheat; the client is fully tamperable so "trusted scores" on a JS game are not achievable, and claiming otherwise is unnecessary.

- **Validate timestamps at ingestion** in both `server.mjs` and `api/leaderboard.js`: accept only plausible finite timestamps and replace invalid or implausible values with server time. Do not attempt to reconstruct unknown historical timestamps. The ignored local `data/leaderboard.json` remains runtime data, not a repository deliverable.
- **Server-side rate limiting** (the honest control), same function in both servers: per-name max ~5 records/10min, per-IP ~50/10min for POSTs; respond 429 with `Retry-After`. Read from env + in-memory window for dev.
- **Per-name contention**: rely on existing `normalizeEntries` (best score per name, tie-break by earliest `ts`) — already present in all three implementations — so flooding a name cannot push #1 to a low `ts`.
- **Keep `proofRequired` flag out**: no hashcash, no server-issued challenges, no freshness window; they add surface and latency for zero integrity gain.
- **Constants sharing**: `MAX_ENTRIES=10`, `MAX_NAME_LENGTH=10` live in 3 files; unify via `src/shared` (Phase A) so the documented "drift" risk actually disappears.
- Cache: API responses are already `Cache-Control: no-store` (sendJson, server.mjs:56-62; api sets it too); nothing further.

Likely files: `server.mjs`, `api/leaderboard.js`, `src/shared/*.mjs`.
Acceptance: automated tests cover sanitize/clamp/rate-limit-dedup; a flooding POST session gets 429 and cannot change #1 by low-ts spam; client offline-at-run still queues and syncs (existing `#enqueuePendingLeaderboardOperation` path untouched).
Validation: `npm test` + curl-style scripted POSTs against the dev server handlers. Rollback: revert commit; rate limiting is additive.

## Dependency graph

```
A (tests+shared logic)
 ├─> B (gameplay fixes)  ─ optional parallel to C
 ├─> C (HUD/a11y/pause)
 ├─> D (feel/audio/difficulty)  ─ needs A's scoring tests, B optional
 ├─> E (renderer + optional rasters)  ─ independent, late
 └─> F (leaderboard abuse resistance) ─ needs A's shared sanitize; independent of B–E
```

All phases are individually reversible (one commit each, small commits inside, feature flags where cheap). Rough sizing: A 1d, B 1d, C 1-2d, D 2-3d, E 2-3d, F 1d.

## Prior plan review — key corrections made

- **Removed client-side proof-of-work** (hashcash, server-issued challenges, freshness windows, `proofRequired`). It is client-computable theater: a tamperable client defeats it trivially and it adds latency. The plan now explicitly distinguishes rate limiting (achievable, kept) from anti-cheat (not achievable for a JS client; stated honestly).
- **Corrected hallucinated line references**: audit claims pointed at context that does not exist (e.g. `server.mjs` write-queue confusion, `#getBatchRange` "infinite ramp"); verified references are used instead — static path guard `server.mjs:267-274`, assist `game.js:654`, trajectory generate/validate `game.js:792-874`, bird spawn `game.js:514-542`, origin anchors `renderer.js:463-464`.
- **Removed fabricated defects**: `freedinosprite.zip` is gitignored (`*.zip`) and untracked, so there is no CI/cleanup issue; `#getBatchRange` is already capped (`Math.min(28, …)`, game.js:768); the `hud-volume` "zero-width/clipped slider" is not reproducible (`#volume-slider` is `width:100%`, `.hud-volume` has `max-width:min(100%,245px)`).
- **Kept real defects**: implausible timestamps need server-side validation, there is no visible mobile pause, no difficulty choice, no countdown before the first batch, uniform SFX (single `#tone` shape), an empty `bass` array, no screen-reader/focus coverage, no `prefers-reduced-motion`, per-frame gradient allocation, and duplicated leaderboard validation in three places.
- **Dropped needless scope**: jump, power-ups, energy/luck systems, near-miss forgiveness, streak-refund bands, slow-mo death, "candy shop" machine, vibration, and multi-machine additions — none are required to preserve the game's simple identity, and several were invented mechanics.
- **Optional raster/audio only**: new Finn frames and machine art are optional and must fall back to the current `png/` sprites and procedural drawing.
- **Reduced phase count**: 11 phases (plus scratch items) compressed to 6 bounded phases, each with scope, files, acceptance, validation, and rollback.
