# Visual polish implementation and QA

Status: implemented in the 2026-09-06 working release. This document records the
current code and runtime artwork; `GAME_IMPROVEMENT_PLAN.md` is a historical
roadmap and is not the source of truth for this release.

## Implemented fixes

### Runtime artwork and character presentation

- Rebuilt all four dog and four dinosaur runtime run frames as true-alpha
  768×512 PNG and WebP exports.
- Removed painted rectangular backgrounds, dark contamination, detached edge
  fragments, and cropped anatomy while retaining soft semitransparent edges.
- Aligned the sequence around consistent body scale and ground/root references,
  with padding retained around the dinosaur snout and tail.
- Replaced selection and landing character art with the matching gameplay idle
  sprites so previews keep the same identity and framing.
- Reduced turning compression from 14% to 7%, grounded its pivot, retained
  instant facing swaps, and kept distance-driven gait advancement.
- Replaced the near-sideways game-over rotation with a brief grounded settle.
- Added matching soft contact shadows and restrained constant-color alpha rims
  in Three.js and Canvas 2D.

### Feedback and rendering parity

- Catch effects now use per-character front/mouth metadata in either direction.
- Awards use explicit monotonic event IDs. Equal-value catches and multiple
  awards in one update therefore create independent feedback.
- Three.js and Canvas floaters show only `+awardedPoints`, use real simulation
  delta time, pause with the game, and expire in 780ms.
- Multiplier/progress lives in the stable HUD and reaches `×4 MAX` through the
  shared scoring thresholds.
- Canvas sprite anchors no longer depend on lazy legacy animation state, fixing
  the loaded-art null-metadata crash path.
- Both renderers show the existing 0.6-second bonus-bird cue as a beneficial
  `BONUS` indicator.
- Catch camera shake, catch zoom, and continuous camera breathing were removed;
  miss shake was reduced to a restrained local emphasis.
- Machine recoil and glow are driven by launch events with a short damped return
  instead of continuous nozzle oscillation.

### Interface, screens, and accessibility

- Reserved a stable HUD region for score, three miss markers, Pause, and streak
  progress; score emphasis was reduced and temporary `+points` now clears.
- Added explicit `Last chance` text at two misses and accurate zero values for a
  zero-catch run.
- Improved start-screen reading order, instructions, nickname requirements,
  selection cues, and comparable character preview scale.
- Made final score dominant, separated player name, renamed `Best combo` to
  `Best streak`, and kept replay immediately available.
- Inactive overlays are now inert/hidden from keyboard navigation, modal focus is
  managed, and quit confirmation defaults to `Continue`.
- Reduced-motion mode uses static state changes and explicitly keeps milestone
  text visible.
- Orange primary actions use dark navy text for readable contrast; focus,
  selection, and danger cues do not rely on color alone.

### Scene hierarchy

- Quieted and softened distant scenery and the player corridor, aligned the sun
  direction between renderers, and reduced competing dust/ground detail.
- Tuned machine materials and launch presentation without adding gameplay or a
  heavier rendering dependency.

## Runtime sprite comparison

- [Before composite](./qa/sprites-before.png)
- [After composite](./qa/sprites-after.png)

Both sheets use the actual runtime WebP files over white, navy, bright magenta,
and the Canvas gameplay-sky gradient. They show all four dog frames followed by
all four dinosaur frames at a consistent scale.

## Export checks

The final 768×512 WebPs were decoded and inspected pixel-by-pixel:

- zero nontransparent pixels on every canvas border;
- one connected foreground component per frame at the 16-pixel threshold;
- no detached dinosaur fragments;
- alpha preserved through the final WebP export, not only in source PNGs.

## Automated checks

Run:

```sh
npm test
npm run check:syntax
npm run lint
npm run test:assets
npm run check:cache-version
```

Interactive viewport screenshots and recordings still require an attached
browser session; the repository checks do not claim to replace that visual QA.
The updated local build received a user visual spot-check before commit. The
complete release matrix remains documented in `QA_BASELINE.md` so a spot-check is
not overstated as exhaustive device coverage.
