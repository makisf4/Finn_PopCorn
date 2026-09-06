# Release QA matrix

Manual smoke-test matrix for the browser game. Run `node server.mjs`, open the
game at each viewport, and record pass/fail for every row. Do not substitute the
automated suite for these visual and interaction checks.

## Required viewports

| Viewport | Orientation/class | Layout checks |
| --- | --- | --- |
| 320×568 | Small portrait | HUD stays within roughly 80–96px; title, character, Play, requirements, and top-three leaderboard remain readable |
| 390×844 | Common portrait | No score/streak reflow; touch controls are at least 44×44px and stay thumb-safe |
| 568×320 | Small landscape | Machine, character, HUD, flight corridor, and modals fit without an empty control row |
| 844×390 | Wide landscape | Gameplay proportions remain balanced; bright scenery does not obscure HUD or collectibles |
| 768×1024 | Tablet portrait | Start/results hierarchy and character framing remain deliberate |
| 799px wide | Below breakpoint | Home is accessed through Pause and does not displace HUD controls |
| 801px wide | Above breakpoint | Breakpoint transition does not produce overlap or a large layout jump |
| 1366×768 | Desktop | Keyboard play, scene hierarchy, and result columns remain readable |
| Wide desktop | Wide aspect | Fixed-screen relationships remain stable; no camera-follow parallax or stretched UI |

## Interaction scenarios

| Scenario | Expected result |
| --- | --- |
| Idle and run, both characters | Transparent silhouette, no rectangular fringe, stable root/body scale, soft attached shadow |
| Run both directions and turn | Facing swaps instantly without crossing zero width; 7% squash stays grounded |
| Repeated equal-value catches | Every catch creates a separate local burst and `+N`; no catch camera shake or zoom |
| Maximum streak | HUD progresses through actual thresholds and settles at `×4 MAX`; floaters do not imply double multiplication |
| Bonus bird | Beneficial `BONUS` cue appears for the existing 0.6-second alert in both renderers |
| First and second miss | Marker count updates; second miss adds persistent `Last chance` text and only brief restrained emphasis |
| Pause and quit | Movement clears; Continue and Quit are distinct; quit confirmation focuses Continue; inactive controls cannot receive focus |
| Game over | Score dominates, player is separate, zero catches displays as zero, Best streak is accurate, and Play Again works immediately |
| Leaderboard fallback | Unavailable API still shows local entries without blocking play; current player is highlighted when present |
| Audio | Mute, volume, and SFX controls respond after the first user interaction |

## Renderer and accessibility passes

Run the complete scenario table with:

- Dog and Dinosaur.
- Primary Three.js renderer and forced Canvas 2D fallback.
- High, Low, and Auto quality; Low must retain gameplay information.
- Default motion and `prefers-reduced-motion: reduce`; milestones must remain visible.
- Keyboard-only navigation, including modal focus trapping and restoration.
- Touch/pointer controls, including held movement, release, cancellation, and pause.
- A six-digit score to confirm tabular numerals and stable control placement.

## Capture set

For a formal release, save comparable screenshots and short recordings for idle,
running in both directions, turning, repeated equal-value catches, maximum
streak, bonus warning, second miss, pause, and game over. The sprite before/after
composites already stored under `docs/qa/` cover white, navy, magenta, and the
gameplay-sky background; they do not replace gameplay-size recordings.
