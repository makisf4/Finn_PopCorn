# Finn The Dyno PopCorn King

A polished, self-contained browser game built with **HTML + CSS + JavaScript + Web Audio + WebGL (Three.js) or Canvas 2D fallback**.

Finn (a cute black dog, or dinosaur) runs left and right to catch popcorn launched from a cartoon machine on the right side of the screen.

The current presentation uses clean transparent run sprites, a soft stylized 2.5D world, stable mobile HUD layouts, event-driven score feedback, and matching character artwork from selection through gameplay. See [`docs/VISUAL_POLISH_QA.md`](docs/VISUAL_POLISH_QA.md) for the implemented visual-polish record and asset composites.

## Run locally

```bash
cd Finn_PopCorn
node server.mjs
```

Open:

- `http://localhost:8080` on desktop
- `http://<your-local-ip>:8080` on mobile devices in the same network

## Quality checks

```bash
node server.mjs
npm test             # Node's built-in test runner, 68 tests
npm run check:syntax # node --check on every source module
npm run lint        # ESLint (no framework needed, all project rules)
npm run test:assets # ensure runtime asset refs resolve
npm run check:cache-version # unified cache-busting tag
```

The full manual browser smoke-test matrix is in `docs/QA_BASELINE.md`.

## Controls

- Keyboard: `←` / `→` or `A` / `D`
- Pause: `Space` or `Escape`
- Mouse/touch: hold the on-screen `◀` / `▶` movement buttons (Bottom, thumb-safe targets)
- Audio: `🔊/🔇` toggle, `Volume`, and `SFX` sliders in the HUD
- Quality selector: `Auto` / `High` / `Low`

## Gameplay rules

- Catch popcorn and bonus candy to gain points.
- Misses count until 3 end the run.
- Catch streaks multiply catch points (combo).
- One balanced arcade mode uses brisker flight timing and restrained catch assistance.
- At 4,000 points, launch speed increases by 5%; another cumulative 5% is added every 1,000 points thereafter.
- Wave patterns alternate, cluster, sweep or add recovery instead of just rising batch counts.
- Dog and Dinosaur are cosmetic options.
- Game over shows a prominent score plus player, catches, best streak, misses, wave, and time — `Play Again` immediately restarts.

## Renderer architecture

WebGL/Three.js is the primary renderer (camera, perspective, lights, shadow map, UnrealBloom). Characters are animated raster sprite planes (not rigged 3D meshes) driven by shared pure helpers:

- `src/shared/animation.js` — facing swaps and run/idle frame choice; the horizontal mirror sign never interpolates through zero.
- `src/shared/characters.js` — per-character baselines, visible half-widths and mouth offsets.
- `src/shared/catch-region.js` — per-character catch rect and effect origin so catches stay fair for tail differences.
- Canvas 2D renderer (`src/renderer2d.js`) is the documented fallback when WebGL is unavailable; it uses the same sprite frame logic, independent anchoring metadata, a constant-color alpha rim, and an equivalent contact shadow.

## Visual and feedback behavior

- Dog and dinosaur run frames are isolated on genuine transparency, cleaned of detached fragments, exported at a consistent 768×512 canvas, and aligned around stable character/ground references.
- Direction changes remain instant horizontally and use a grounded 7% vertical squash; distance still advances the four-frame gait.
- Catch effects and score floaters originate from character-specific front/mouth positions in both facing directions.
- Every award has an explicit event ID, so consecutive equal-value catches and multiple awards in one update retrigger correctly.
- Floating `+N` labels use simulation elapsed time, pause with the game, and expire after a short readable interval. The HUD owns multiplier information, including `×4 MAX`.
- The machine recoil and launch flare are event-driven and brief. Bonus birds show a readable beneficial `BONUS` cue in both renderers.
- Routine catches do not shake or zoom the camera. Miss shake is restrained, and the active camera no longer breathes continuously.
- Mobile HUD space is reserved for score, three explicit miss markers, pause, and streak progress; two misses add the text “Last chance.”

## Quality settings

- `Auto` lets an FPS tracker assign the effective tier.
- `High` — shadow map 2048, bloom 0.24, particle scale 1.
- `Low` — reduces bloom, shadow map 512, particle scale 0.4, `dprCap` 1.5.
- `prefers-reduced-motion` disables camera movement and animated UI entrances while preserving visible milestone text and all gameplay information.

## Accessibility

- Pinch zoom and zoomable viewport work.
- Dialogs (`Start`, `Pause`, `Quit`, `Game over`) use `role="dialog"`, `aria-modal`, focus trapping and focus restoration.
- Inactive overlays are hidden from accessibility and keyboard interaction; quit confirmation initially focuses the safe `Continue` action.
- Primary actions use dark navy text on orange, and selection/focus/danger states include non-color cues.
- Live regions announce countdown, score changes, misses, pause/resume, and game over.

## Leaderboard

Client uses single-mode entries (`name, score, ts, difficulty`) with Unicode-aware normalization, blocked fragments, run telemetry, and a persistent pending commit queue. Both server implementations share the same validation rules, reject public rename actions, keep one best score per player, and reject clearly implausible telemetry. Writes are not authenticated; rate limits are best-effort and per process or warm serverless instance, so they are abuse friction rather than a complete anti-cheat boundary. Infrastructure errors do not return raw details.

## File structure

- `index.html` – layout and dialog shells
- `styles.css` – responsive layout and focus/reduced-motion rules
- `src/main.js` – app bootstrap and global element refs
- `src/game.js` – game loop, wave director, collision, UI state
- `src/renderer3d.js` – camera, lights, bloom, fog, quality tracking
- `src/renderer2d.js` – Canvas 2D fallback (same character logic)
- `src/renderer.js` – renderer selector (3D → 2D on failure)
- `src/entities3d/` – procedural 3D actors (dog, machine, popcorn, birds, particles)
- `src/shared/gameplay.js` – single-mode balance values + countdown numbers
- `src/shared/waves.js` – wave pattern data
- `src/shared/animation.js` – facing frame helpers (never cross zero)
- `src/shared/characters.js` – per-character sprite metadata
- `src/shared/catch-region.js` – fair catch rect + effect origin
- `src/shared/nickname.js` – Unicode-friendly nickname validation
- `src/shared/quality.js` – auto/high/low presets
- `src/shared/focus.js` – dialog focus trapping
- `png/` – 2D fallback dog animation sequences
- `assets/source-art/` – archived pre-aligned PNG intermediates
- `vendor/three/` – pinned Three.js build
- `server.mjs` – local server + shared leaderboard proxy support
- `api/leaderboard.js` – Vercel KV-backed leaderboard endpoint

## Testing

Node's built-in test runner covers gameplay, animation, limiter, utils, nickname and quality logic.
The manual browser smoke-test matrix in `docs/QA_BASELINE.md` covers portrait, landscape, tablet, desktop, both sides of the 800px breakpoint, both characters/renderers, Low quality, reduced motion, keyboard navigation, and touch controls. Sprite export evidence is recorded separately in `docs/VISUAL_POLISH_QA.md`.

## Deployment

- Static hosting requires no build step.
- Vercel **KV** variables `KV_REST_API_URL` and `KV_REST_API_TOKEN` for persistence.
- `npm run check:cache-version` must stay consistent across `index.html` and imports.
- `data/leaderboard.json` is ignored (see `.gitignore`).
