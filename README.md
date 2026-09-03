# Finn The Dyno PopCorn King

A polished, self-contained browser game built with **HTML + CSS + JavaScript + Web Audio + WebGL (Three.js) or Canvas 2D fallback**.

Finn (a cute black dog, or dinosaur) runs left and right to catch popcorn launched from a cartoon machine on the right side of the screen.

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
npm test             # Node's built-in test runner, 69 tests
npm run check:syntax # node --check on every source module
npm run lint        # ESLint (no framework needed, all project rules)
npm run test:assets # ensure runtime asset refs resolve
npm run check:cache-version # unified cache-busting tag
```

The manual browser smoke-test matrix is in `docs/QA_BASELINE.md`.

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
- Game over shows score, catches, best combo, misses, wave, and time — `Play Again` immediately restarts.

## Renderer architecture

WebGL/Three.js is the primary renderer (camera, perspective, lights, shadow map, UnrealBloom). Characters are animated raster sprite planes (not rigged 3D meshes) driven by shared pure helpers:

- `src/shared/animation.js` — facing swaps and run/idle frame choice; the horizontal mirror sign never interpolates through zero.
- `src/shared/characters.js` — per-character baselines, visible half-widths and mouth offsets.
- `src/shared/catch-region.js` — per-character catch rect and effect origin so catches stay fair for tail differences.
- Canvas 2D renderer (`src/renderer2d.js`) is the documented fallback when WebGL is unavailable; it uses the same sprite frame logic plus a soft rim to keep silhouettes readable.

## Quality settings

- `Auto` lets an FPS tracker assign the effective tier.
- `High` — shadow map 2048, bloom 0.24, particle scale 1.
- `Low` — reduces bloom, shadow map 512, particle scale 0.4, `dprCap` 1.5.
- `prefers-reduced-motion` disables camera shake, breathing camera motion and bloom pulses; gameplay particles are still allowed (turn squash, idle grounding).

## Accessibility

- Pinch zoom and zoomable viewport work.
- Dialogs (`Start`, `Pause`, `Quit`, `Game over`) use `role="dialog"`, `aria-modal`, focus trapping and focus restoration.
- Live regions announce countdown, score changes, misses, pause/resume, game over and last-chance warnings.

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
The manual browser smoke-test matrix is in `docs/QA_BASELINE.md`. A clean responsive set (e.g. 320×568, 390×844, 768×1024, 1366×768, wide desktop) should confirm no HUD overlap, no zero-scale facing and `Home` confirmation.

## Deployment

- Static hosting requires no build step.
- Vercel **KV** variables `KV_REST_API_URL` and `KV_REST_API_TOKEN` for persistence.
- `npm run check:cache-version` must stay consistent across `index.html` and imports.
- `data/leaderboard.json` is ignored (see `.gitignore`).
