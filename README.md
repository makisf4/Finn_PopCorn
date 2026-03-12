# Finn The Dyno PopCorn King

A polished, self-contained 2D browser game built with **HTML + CSS + JavaScript + Canvas API**.

Finn (a cute black dog with a red collar) runs left and right to catch popcorn launched from a cartoon machine on the right side of the screen.

## Run locally

Use the built-in Node server so all devices share one leaderboard.

```bash
cd /Users/makpap/Desktop/Projects/Finn_PopCorn
node server.mjs
```

Open:

- `http://localhost:8080` on desktop
- `http://<your-local-ip>:8080` on mobile devices in the same network

Fallback for static-only preview (without shared leaderboard API):

```bash
python3 -m http.server 8080
```

## Controls

- Desktop keyboard: `Left Arrow` / `Right Arrow`
- Desktop mouse: on-screen `◀` and `▶` buttons
- Mobile touch: on-screen `◀` and `▶` buttons (portrait-first layout)
- Audio: top-right `🔊/🔇` mute toggle

## Gameplay rules

- Catch popcorn to gain points.
- Score at top = total popcorn caught.
- A miss is counted when popcorn reaches the floor without being caught.
- Game ends after **exactly 3 misses**.
- Start screen includes title + Play button.
- Game Over screen shows final score + Restart button.

## Difficulty and fairness design

- Popcorn is launched in growing batches:
  - Batch 1: 2-3
  - Batch 2: 4-5
  - Batch 3: 8-9
  - Later batches continue increasing progressively.
- Each popcorn piece has unique trajectory variance (arc, speed, timing, gravity, angle).
- Trajectories are generated and validated to stay within visible bounds during flight.
- Subtle adaptive assist adds temporary slowdown/hover while descending and far from Finn, keeping play fair without feeling artificial.

## Visual and feedback polish

- Programmatically rendered cartoon art:
  - Character rendered from PNG frame sequences (`png/Idle`, `png/Run`, `png/Dead`) with horizontal flip for left movement
  - Expressive popcorn machine with firing pulse
  - Popcorn spin/wobble feel
  - Layered background and ground
  - Launch/catch/miss particle effects
- UI polish:
  - Animated score pop
  - Start/Game Over overlays with transitions
  - Touch-friendly controls

## Audio

Synthesized with WebAudio (no external files):

- Launch
- Catch/eat
- Miss
- UI click
- Game over
- Light optional background melody

Audio is unlocked only after user interaction for mobile Safari compatibility.

## Browser support

Test target:

- Brave (Chromium-based modern desktop/mobile)
- Safari (modern iOS/macOS Safari)

Compatibility notes:

- Uses widely supported Canvas 2D APIs.
- Uses `AudioContext` with `webkitAudioContext` fallback.
- Uses `requestAnimationFrame` game loop.
- Uses responsive layout + orientation-safe resizing.

## File structure

- `index.html` - game layout + UI shells
- `styles.css` - responsive styling, controls, overlays
- `png/` - character animation frames (`Idle`, `Run`, `Dead`)
- `src/main.js` - app bootstrap
- `src/game.js` - game loop, physics, batches, collision, fairness, UI state
- `src/renderer.js` - Canvas drawing for all visual assets/effects
- `src/input.js` - keyboard + touch/mouse controls
- `src/audio.js` - synthesized SFX/music + mute/unmute
- `src/utils.js` - math/collision helpers
- `server.mjs` - static server + shared leaderboard API (`GET/POST /api/leaderboard`)
